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
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

# Paths
ROOT = Path(__file__).resolve().parents[1]
UPLOADS = ROOT / "uploads"
FRONTEND_DIR = ROOT / "frontend"
ALLOWED_EXTENSIONS = {".pdf", ".docx"}

# Ensure directories exist
UPLOADS.mkdir(parents=True, exist_ok=True)


def db_url() -> URL:
    password = os.getenv("MYSQL_PASSWORD", "Amity1234")
    if not password:
        raise RuntimeError("Set MYSQL_PASSWORD before starting the API.")
    return URL.create(
        "mysql+pymysql",
        username=os.getenv("MYSQL_USER", "root"),
        password=password,
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        database=os.getenv("MYSQL_DATABASE", "resume_screening_db")
    )


engine = create_engine(db_url(), pool_pre_ping=True)
app = FastAPI(title="Resume Screening & Ranking API", version="2.0.0")

# 1. FIXED CORS - Highly permissive for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def query_rows(statement: str, values: dict | None = None) -> list[dict]:
    with engine.connect() as connection:
        return [
            dict(row) for row in connection.execute(
                text(statement),
                values or {}
            ).mappings()
        ]


def extract_text(path: Path) -> str:
    try:
        if path.suffix.lower() == ".pdf":
            with pdfplumber.open(path) as pdf:
                return "\n".join(
                    page.extract_text() or "" for page in pdf.pages if page.extract_text()
                )
        document = Document(path)
        return "\n".join(
            paragraph.text for paragraph in document.paragraphs
        )
    except Exception as exc:
        raise HTTPException(
            422,
            f"The resume could not be read. Error: {str(exc)}"
        ) from exc


def profile_from_text(content: str, known_skills: list[str]) -> dict:
    compact = re.sub(r"\s+", " ", content).strip()
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    name = lines[0] if lines and len(lines[0].split()) <= 5 else "Candidate"
    
    skill_set = {
        skill for skill in known_skills
        if re.search(
            r"(?<!\w)" + re.escape(skill) + r"(?!\w)",
            compact,
            re.I
        )
    }
    
    education = next(
        (
            label for label in [
                "Ph.D.", "Master's", "MBA", "Bachelor's", "B.Sc", "B.Tech", "B.E."
            ]
            if label.lower() in compact.lower()
        ),
        "Not detected"
    )
    
    experience_matches = re.findall(
        r"(\d{1,2})\+?\s*(?:years?|yrs?)",
        compact,
        re.I
    )
    experience = max(
        (int(value) for value in experience_matches),
        default=0
    )
    
    certs = [
        cert for cert in [
            "AWS", "Google", "Azure", "Cisco", "TensorFlow"
        ]
        if re.search(r"(?<!\w)" + cert + r"(?!\w)", compact, re.I)
    ]
    
    projects = len(re.findall(r"\bprojects?\b", compact, re.I))
    
    return {
        "name": name[:255],
        "skills": sorted(skill_set),
        "education": education,
        "experience_years": experience,
        "certifications": certs,
        "projects_count": projects
    }


# ================== API ENDPOINTS ==================

@app.get("/health")
def health() -> dict:
    try:
        query_rows("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}


@app.get("/roles")
def roles() -> list[str]:
    try:
        return [
            row["Job_Role"] for row in query_rows(
                "SELECT DISTINCT Job_Role FROM historical_candidates ORDER BY Job_Role"
            )
        ]
    except Exception as e:
        print(f"Error fetching roles: {e}")
        return ["AI Researcher", "Data Scientist", "Cybersecurity Analyst", "Software Engineer"] # Fallback


@app.get("/candidates")
def candidates(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=100),
    search: str | None = None,
    role: str | None = None,
    decision: str | None = None,
    min_score: int | None = Query(None, ge=0, le=100),
    max_score: int | None = Query(None, ge=0, le=100),
    min_experience: int | None = Query(None, ge=0),
    max_experience: int | None = Query(None, ge=0),
    min_salary: float | None = Query(None, ge=0),
    max_salary: float | None = Query(None, ge=0),
    certification: str | None = None,
    sort: str = "AI_Score",
    direction: str = "desc"
) -> dict:
    allowed_sort = {
        "Resume_ID", "Name", "Job_Role", "Experience_Years", 
        "AI_Score", "Recruiter_Decision"
    }
    
    if sort not in allowed_sort or direction.lower() not in {"asc", "desc"}:
        raise HTTPException(400, "Invalid sort parameters.")

    where, values = ["1=1"], {}

    if search:
        where.append(
            "(c.Name LIKE :search OR c.Job_Role LIKE :search OR "
            "c.Certifications LIKE :search OR "
            "EXISTS (SELECT 1 FROM historical_skills hs WHERE "
            "hs.Resume_ID=c.Resume_ID AND hs.Skill LIKE :search))"
        )
        values["search"] = f"%{search.strip()}%"

    if role:
        where.append("c.Job_Role = :role")
        values["role"] = role

    if decision:
        where.append("c.Recruiter_Decision = :decision")
        values["decision"] = decision

    if min_score is not None:
        where.append("c.AI_Score >= :score")
        values["score"] = min_score

    if max_score is not None:
        where.append("c.AI_Score <= :max_score")
        values["max_score"] = max_score

    if min_experience is not None:
        where.append("c.Experience_Years >= :min_experience")
        values["min_experience"] = min_experience

    if max_experience is not None:
        where.append("c.Experience_Years <= :max_experience")
        values["max_experience"] = max_experience

    if min_salary is not None:
        where.append("c.Salary_Expectation >= :min_salary")
        values["min_salary"] = min_salary

    if max_salary is not None:
        where.append("c.Salary_Expectation <= :max_salary")
        values["max_salary"] = max_salary

    if certification:
        where.append("c.Certifications LIKE :certification")
        values["certification"] = f"%{certification}%"

    clause = " AND ".join(where)
    
    try:
        total_res = query_rows(
            f"SELECT COUNT(*) AS total FROM historical_candidates c WHERE {clause}",
            values
        )
        total = total_res[0]["total"] if total_res else 0

        values.update({
            "limit": page_size,
            "offset": (page - 1) * page_size
        })

        items = query_rows(
            f"""SELECT c.Resume_ID, c.Name, c.Job_Role, c.Experience_Years, c.Education, c.Certifications,
                   c.Projects_Count, c.Salary_Expectation, c.AI_Score, c.Recruiter_Decision,
                   GROUP_CONCAT(hs.Skill ORDER BY hs.Skill SEPARATOR ', ') AS Skills
                FROM historical_candidates c
                LEFT JOIN historical_skills hs ON hs.Resume_ID=c.Resume_ID
                WHERE {clause}
                GROUP BY c.Resume_ID
                ORDER BY c.{sort} {direction.upper()}
                LIMIT :limit OFFSET :offset""",
            values
        )

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    except Exception as e:
        import traceback
        print("Candidates endpoint error:")
        print(traceback.format_exc())
        raise HTTPException(500, f"Could not load candidates: {str(e)}") from e


@app.get("/analytics")
def analytics(
    search: str | None = None,
    role: str | None = None,
    decision: str | None = None,
    min_score: int | None = Query(None, ge=0, le=100),
    max_score: int | None = Query(None, ge=0, le=100),
    min_experience: int | None = Query(None, ge=0),
    max_experience: int | None = Query(None, ge=0),
    min_salary: float | None = Query(None, ge=0),
    max_salary: float | None = Query(None, ge=0),
    certification: str | None = None,
) -> dict:
    """Return dashboard analytics using the same filters as the candidate pool."""
    where = ["1=1"]
    values = {}

    if search:
        where.append(
            "(c.Name LIKE :search OR c.Job_Role LIKE :search OR "
            "c.Certifications LIKE :search OR "
            "EXISTS (SELECT 1 FROM historical_skills hs WHERE "
            "hs.Resume_ID=c.Resume_ID AND hs.Skill LIKE :search))"
        )
        values["search"] = f"%{search.strip()}%"

    if role:
        where.append("c.Job_Role = :role")
        values["role"] = role

    if decision:
        where.append("c.Recruiter_Decision = :decision")
        values["decision"] = decision

    if min_score is not None:
        where.append("c.AI_Score >= :min_score")
        values["min_score"] = min_score

    if max_score is not None:
        where.append("c.AI_Score <= :max_score")
        values["max_score"] = max_score

    if min_experience is not None:
        where.append("c.Experience_Years >= :min_experience")
        values["min_experience"] = min_experience

    if max_experience is not None:
        where.append("c.Experience_Years <= :max_experience")
        values["max_experience"] = max_experience

    if min_salary is not None:
        where.append("c.Salary_Expectation >= :min_salary")
        values["min_salary"] = min_salary

    if max_salary is not None:
        where.append("c.Salary_Expectation <= :max_salary")
        values["max_salary"] = max_salary

    if certification:
        where.append("c.Certifications LIKE :certification")
        values["certification"] = f"%{certification}%"

    clause = " AND ".join(where)

    try:
        by_role = query_rows(
            f"""
            SELECT
                c.Job_Role,
                COUNT(*) AS candidates,
                SUM(c.Recruiter_Decision = 'Hire') AS hires,
                SUM(c.Recruiter_Decision = 'Reject') AS rejects
            FROM historical_candidates c
            WHERE {clause}
            GROUP BY c.Job_Role
            ORDER BY candidates DESC
            """,
            values,
        )

        salaries = query_rows(
            f"""
            SELECT
                c.Job_Role,
                ROUND(AVG(c.Salary_Expectation), 2) AS average_salary
            FROM historical_candidates c
            WHERE {clause}
            GROUP BY c.Job_Role
            ORDER BY average_salary DESC
            """,
            values,
        )

        skills = query_rows(
            f"""
            SELECT
                c.Job_Role,
                hs.Skill,
                COUNT(*) AS frequency
            FROM historical_candidates c
            INNER JOIN historical_skills hs ON hs.Resume_ID = c.Resume_ID
            WHERE {clause}
            GROUP BY c.Job_Role, hs.Skill
            ORDER BY c.Job_Role, frequency DESC
            """,
            values,
        )

        score_decisions = query_rows(
            f"""
            SELECT
                CASE
                    WHEN c.AI_Score >= 80 THEN '80-100'
                    WHEN c.AI_Score >= 50 THEN '50-79'
                    ELSE '0-49'
                END AS score_band,
                SUM(c.Recruiter_Decision = 'Hire') AS hires,
                SUM(c.Recruiter_Decision = 'Reject') AS rejects
            FROM historical_candidates c
            WHERE {clause}
            GROUP BY
                CASE
                    WHEN c.AI_Score >= 80 THEN '80-100'
                    WHEN c.AI_Score >= 50 THEN '50-79'
                    ELSE '0-49'
                END
            ORDER BY
                CASE
                    WHEN score_band = '80-100' THEN 1
                    WHEN score_band = '50-79' THEN 2
                    ELSE 3
                END
            """,
            values,
        )

        experience = query_rows(
            f"""
            SELECT
                c.Experience_Years,
                COUNT(*) AS candidates
            FROM historical_candidates c
            WHERE {clause}
            GROUP BY c.Experience_Years
            ORDER BY c.Experience_Years
            """,
            values,
        )

        total_candidates = sum(int(r["candidates"] or 0) for r in by_role)
        total_hires = sum(int(r["hires"] or 0) for r in by_role)
        total_rejects = sum(int(r["rejects"] or 0) for r in by_role)

        return {
            "summary": {
                "candidates": total_candidates,
                "hires": total_hires,
                "rejects": total_rejects,
            },
            "by_role": by_role,
            "skills": skills,
            "salaries": salaries,
            "score_decisions": score_decisions,
            "experience": experience,
        }
    except Exception as e:
        import traceback
        print("Analytics endpoint error:")
        print(traceback.format_exc())
        raise HTTPException(500, f"Could not load analytics: {str(e)}") from e


@app.post("/screen-resume")
async def screen_resume(
    file: Annotated[UploadFile, File(...)],
    target_role: Annotated[str, Form(...)],
    expected_salary: Annotated[float | None, Form()] = None
) -> dict:
    try:
        print(f"📥 Received file: {file.filename} for role: {target_role}")
        
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(415, "Only PDF and DOCX resumes are accepted.")

        role_exists = query_rows(
            "SELECT 1 FROM historical_candidates WHERE Job_Role=:role LIMIT 1",
            {"role": target_role}
        )
        if not role_exists:
            # Fallback to avoid breaking if DB is empty
            print(f"Warning: Role {target_role} not found in DB. Proceeding anyway.")

        stored_path = UPLOADS / f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}{suffix}"

        with stored_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        parsed_text = extract_text(stored_path)
        
        known_skills = [
            row["Skill"] for row in query_rows(
                "SELECT DISTINCT Skill FROM historical_skills"
            )
        ]
            
        profile = profile_from_text(parsed_text, known_skills)

        hired = query_rows(
            """SELECT Resume_ID, AI_Score, Experience_Years, Projects_Count,
                      Education, Certifications, Salary_Expectation
               FROM historical_candidates
               WHERE Job_Role=:role AND Recruiter_Decision='Hire'""",
            {"role": target_role}
        )

        if not hired:
            raise HTTPException(
                422,
                f"No historical hired candidates are available for the selected role: {target_role}."
            )
        else:
            hired_ids = [row["Resume_ID"] for row in hired]
            placeholders = ",".join(str(int(identifier)) for identifier in hired_ids) or "0"
            
            top_skill_rows = query_rows(
                f"""SELECT Skill, COUNT(*) AS frequency
                   FROM historical_skills
                   WHERE Resume_ID IN ({placeholders})
                   GROUP BY Skill ORDER BY frequency DESC LIMIT 12"""
            )
            benchmark_skills = [row["Skill"] for row in top_skill_rows]
            
            avg_experience = sum(row["Experience_Years"] for row in hired) / len(hired)
            avg_projects = sum(row["Projects_Count"] for row in hired) / len(hired)
            avg_salary = sum(float(row["Salary_Expectation"]) for row in hired) / len(hired)
            hired_len = len(hired)

        matched = [skill for skill in profile["skills"] if skill in benchmark_skills]
        missing = [skill for skill in benchmark_skills if skill not in profile["skills"]]

        skill_score = (len(matched) / len(benchmark_skills) * 100) if benchmark_skills else 50
        experience_score = max(0, 100 - abs(profile["experience_years"] - avg_experience) / max(avg_experience, 1) * 100)
        project_score = min(100, profile["projects_count"] / max(avg_projects, 1) * 100)
        education_score = 100 if any(profile["education"].lower() in str(row["Education"]).lower() for row in hired) else 50
        
        salary_score = 100
        if expected_salary is not None:
            salary_score = max(0, 100 - abs(expected_salary - avg_salary) / max(avg_salary, 1) * 100)

        score = round(
            skill_score * .45 + experience_score * .25 + project_score * .15 + 
            education_score * .10 + salary_score * .05, 
            1
        )
        
        rank = 1 + sum(row["AI_Score"] > score for row in hired)
        decision = "Strong match" if score >= 75 else "Potential match" if score >= 50 else "Needs development"
        feedback = f"For {target_role}, prioritize {', '.join(missing[:3]) or 'clearer evidence of role-specific work'}."

        upload_id = 0
        try:
            with engine.begin() as connection:
                result = connection.execute(
                    text("""INSERT INTO live_uploads
                           (Candidate_Name, File_Path, Parsed_Text, Target_Role, Calculated_Score)
                           VALUES (:name, :path, :content, :role, :score)"""),
                    {"name": profile["name"], "path": str(stored_path), "content": parsed_text, "role": target_role, "score": score}
                )
                upload_id = result.lastrowid
        except Exception as e:
            print(f"Warning: Could not insert live_upload to DB: {e}")

        return {
            "upload_id": upload_id,
            "target_role": target_role,
            "profile": profile,
            "score": score,
            "rank": rank,
            "benchmark_size": hired_len,
            "decision": decision,
            "matched_skills": matched,
            "missing_skills": missing,
            "feedback": feedback,
            "comparison": {
                "candidate_experience": profile["experience_years"],
                "hired_experience": round(avg_experience, 1),
                "candidate_projects": profile["projects_count"],
                "hired_projects": round(avg_projects, 1),
                "candidate_salary": expected_salary,
                "hired_salary": round(avg_salary),
                "skill_match": round(skill_score, 1)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(500, f"Server error processing resume: {str(e)}")


# ================== FILE SERVING (FIXED) ==================

# Serve specific HTML file for root
@app.get("/")
def serve_frontend_index():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "API is running. Frontend index.html not found."}

# Mount static files (css, js, etc.) under /static to avoid route conflicts
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

