"""FastAPI service for historical analysis and live resume screening."""
from __future__ import annotations

import os
import re
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

import pdfplumber
from docx import Document
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

ROOT = Path(__file__).resolve().parents[1]
UPLOADS = ROOT / "uploads"
ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def db_url() -> URL:
    password = os.getenv("MYSQL_PASSWORD")
    if not password:
        raise RuntimeError("Set MYSQL_PASSWORD before starting the API.")
    return URL.create("mysql+pymysql", username=os.getenv("MYSQL_USER", "root"), password=password,
                      host=os.getenv("MYSQL_HOST", "127.0.0.1"), port=int(os.getenv("MYSQL_PORT", "3306")),
                      database=os.getenv("MYSQL_DATABASE", "resume_screening_db"))


engine = create_engine(db_url(), pool_pre_ping=True)
app = FastAPI(title="Resume Screening & Ranking API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"], allow_methods=["*"], allow_headers=["*"])


def query_rows(statement: str, values: dict | None = None) -> list[dict]:
    with engine.connect() as connection:
        return [dict(row) for row in connection.execute(text(statement), values or {}).mappings()]


def extract_text(path: Path) -> str:
    try:
        if path.suffix.lower() == ".pdf":
            with pdfplumber.open(path) as pdf:
                return "\n".join(page.extract_text() or "" for page in pdf.pages)
        document = Document(path)
        return "\n".join(paragraph.text for paragraph in document.paragraphs)
    except Exception as exc:
        raise HTTPException(422, "The resume could not be read. Use a text-based PDF or DOCX file.") from exc


def profile_from_text(content: str, known_skills: list[str]) -> dict:
    compact = re.sub(r"\s+", " ", content).strip()
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    name = lines[0] if lines and len(lines[0].split()) <= 5 else "Candidate"
    skill_set = {skill for skill in known_skills if re.search(r"(?<!\w)" + re.escape(skill) + r"(?!\w)", compact, re.I)}
    education = next((label for label in ["Ph.D.", "Master's", "MBA", "Bachelor's", "B.Sc", "B.Tech", "B.E."] if label.lower() in compact.lower()), "Not detected")
    experience_matches = re.findall(r"(\d{1,2})\+?\s*(?:years?|yrs?)", compact, re.I)
    experience = max((int(value) for value in experience_matches), default=0)
    certs = [cert for cert in ["AWS", "Google", "Azure", "Cisco", "TensorFlow"] if re.search(r"(?<!\w)" + cert + r"(?!\w)", compact, re.I)]
    projects = len(re.findall(r"\bprojects?\b", compact, re.I))
    return {"name": name[:255], "skills": sorted(skill_set), "education": education, "experience_years": experience, "certifications": certs, "projects_count": projects}


@app.get("/health")
def health() -> dict:
    query_rows("SELECT 1")
    return {"status": "ok"}


@app.get("/roles")
def roles() -> list[str]:
    return [row["Job_Role"] for row in query_rows("SELECT DISTINCT Job_Role FROM historical_candidates ORDER BY Job_Role")]


@app.get("/candidates")
def candidates(page: int = Query(1, ge=1), page_size: int = Query(25, ge=5, le=100), search: str | None = None,
               role: str | None = None, decision: str | None = None, min_score: int | None = Query(None, ge=0, le=100),
               sort: str = "AI_Score", direction: str = "desc") -> dict:
    allowed_sort = {"Resume_ID", "Name", "Job_Role", "Experience_Years", "AI_Score", "Recruiter_Decision"}
    if sort not in allowed_sort or direction.lower() not in {"asc", "desc"}:
        raise HTTPException(400, "Invalid sort parameters.")
    where, values = ["1=1"], {}
    if search:
        where.append("(c.Name LIKE :search OR c.Job_Role LIKE :search OR EXISTS (SELECT 1 FROM historical_skills hs WHERE hs.Resume_ID=c.Resume_ID AND hs.Skill LIKE :search))")
        values["search"] = f"%{search.strip()}%"
    if role: where.append("c.Job_Role = :role"); values["role"] = role
    if decision: where.append("c.Recruiter_Decision = :decision"); values["decision"] = decision
    if min_score is not None: where.append("c.AI_Score >= :score"); values["score"] = min_score
    clause = " AND ".join(where)
    total = query_rows(f"SELECT COUNT(*) AS total FROM historical_candidates c WHERE {clause}", values)[0]["total"]
    values.update({"limit": page_size, "offset": (page - 1) * page_size})
    items = query_rows(f"""SELECT c.Resume_ID,c.Name,c.Job_Role,c.Experience_Years,c.Education,c.Certifications,c.Projects_Count,c.Salary_Expectation,c.AI_Score,c.Recruiter_Decision,
      GROUP_CONCAT(hs.Skill ORDER BY hs.Skill SEPARATOR ', ') AS Skills
      FROM historical_candidates c LEFT JOIN historical_skills hs ON hs.Resume_ID=c.Resume_ID
      WHERE {clause} GROUP BY c.Resume_ID ORDER BY c.{sort} {direction.upper()} LIMIT :limit OFFSET :offset""", values)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@app.get("/analytics")
def analytics() -> dict:
    summary = query_rows("SELECT COUNT(*) AS candidates, SUM(Recruiter_Decision='Hire') AS hires, ROUND(AVG(AI_Score),1) AS average_score FROM historical_candidates")[0]
    by_role = query_rows("SELECT Job_Role, COUNT(*) AS candidates, SUM(Recruiter_Decision='Hire') AS hires, ROUND(AVG(AI_Score),1) AS average_score FROM historical_candidates GROUP BY Job_Role ORDER BY Job_Role")
    skills = query_rows("""SELECT c.Job_Role, hs.Skill, COUNT(*) AS frequency FROM historical_candidates c JOIN historical_skills hs ON hs.Resume_ID=c.Resume_ID
                          WHERE c.Recruiter_Decision='Hire' GROUP BY c.Job_Role,hs.Skill ORDER BY c.Job_Role,frequency DESC""")
    return {"summary": summary, "by_role": by_role, "skills": skills}


@app.post("/screen-resume")
async def screen_resume(file: Annotated[UploadFile, File(...)], target_role: Annotated[str, Form(...)], expected_salary: Annotated[float | None, Form()] = None) -> dict:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(415, "Only PDF and DOCX resumes are accepted.")
    role_exists = query_rows("SELECT 1 FROM historical_candidates WHERE Job_Role=:role LIMIT 1", {"role": target_role})
    if not role_exists:
        raise HTTPException(400, "Choose a target role available in the historical dataset.")
    UPLOADS.mkdir(exist_ok=True)
    stored_path = UPLOADS / f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}{suffix}"
    with stored_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    parsed_text = extract_text(stored_path)
    known_skills = [row["Skill"] for row in query_rows("SELECT DISTINCT Skill FROM historical_skills")]
    profile = profile_from_text(parsed_text, known_skills)
    hired = query_rows("SELECT Resume_ID,AI_Score,Experience_Years,Projects_Count,Education,Certifications,Salary_Expectation FROM historical_candidates WHERE Job_Role=:role AND Recruiter_Decision='Hire'", {"role": target_role})
    hired_ids = [row["Resume_ID"] for row in hired]
    placeholders = ",".join(str(int(identifier)) for identifier in hired_ids) or "0"
    top_skill_rows = query_rows(f"SELECT Skill,COUNT(*) AS frequency FROM historical_skills WHERE Resume_ID IN ({placeholders}) GROUP BY Skill ORDER BY frequency DESC LIMIT 12")
    benchmark_skills = [row["Skill"] for row in top_skill_rows]
    matched = [skill for skill in profile["skills"] if skill in benchmark_skills]
    missing = [skill for skill in benchmark_skills if skill not in profile["skills"]]
    avg_experience = sum(row["Experience_Years"] for row in hired) / len(hired)
    avg_projects = sum(row["Projects_Count"] for row in hired) / len(hired)
    avg_salary = sum(float(row["Salary_Expectation"]) for row in hired) / len(hired)
    skill_score = (len(matched) / len(benchmark_skills) * 100) if benchmark_skills else 0
    experience_score = max(0, 100 - abs(profile["experience_years"] - avg_experience) / max(avg_experience, 1) * 100)
    project_score = min(100, profile["projects_count"] / max(avg_projects, 1) * 100)
    education_score = 100 if any(profile["education"].lower() in str(row["Education"]).lower() for row in hired) else 50
    salary_score = 100 if expected_salary is None else max(0, 100 - abs(expected_salary - avg_salary) / max(avg_salary, 1) * 100)
    score = round(skill_score*.45 + experience_score*.25 + project_score*.15 + education_score*.10 + salary_score*.05, 1)
    rank = 1 + sum(row["AI_Score"] > score for row in hired)
    decision = "Strong match" if score >= 75 else "Potential match" if score >= 50 else "Needs development"
    feedback = f"For {target_role}, prioritize {', '.join(missing[:3]) or 'clearer evidence of role-specific work'}."
    with engine.begin() as connection:
        result = connection.execute(text("INSERT INTO live_uploads (Candidate_Name,File_Path,Parsed_Text,Target_Role,Calculated_Score) VALUES (:name,:path,:content,:role,:score)"), {"name":profile["name"],"path":str(stored_path),"content":parsed_text,"role":target_role,"score":score})
        upload_id = result.lastrowid
        for skill in profile["skills"]:
            connection.execute(text("INSERT IGNORE INTO live_upload_skills (Upload_ID,Skill) VALUES (:upload_id,:skill)"), {"upload_id":upload_id,"skill":skill})
    return {"upload_id": upload_id, "target_role": target_role, "profile": profile, "score": score, "rank": rank, "benchmark_size": len(hired), "decision": decision, "matched_skills": matched, "missing_skills": missing, "feedback": feedback, "comparison": {"candidate_experience":profile["experience_years"], "hired_experience":round(avg_experience,1), "candidate_projects":profile["projects_count"], "hired_projects":round(avg_projects,1), "candidate_salary":expected_salary, "hired_salary":round(avg_salary), "skill_match":round(skill_score,1)}}
