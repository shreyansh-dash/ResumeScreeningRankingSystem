"""Import the historical resume CSV into MySQL.

Run schema.sql in MySQL Workbench first. Credentials are read from environment
variables, never stored in source control.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, URL

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV_PATH = PROJECT_ROOT / "data" / "AI_Resume_Screening.csv"
REQUIRED_COLUMNS = {"Resume_ID", "Name", "Skills", "Experience (Years)", "Education", "Certifications", "Job Role", "Recruiter Decision", "Salary Expectation ($)", "Projects Count", "AI Score (0-100)"}
RENAME_COLUMNS = {"Experience (Years)": "Experience_Years", "Job Role": "Job_Role", "Recruiter Decision": "Recruiter_Decision", "Salary Expectation ($)": "Salary_Expectation", "Projects Count": "Projects_Count", "AI Score (0-100)": "AI_Score"}


def database_url() -> URL:
    password = os.getenv("MYSQL_PASSWORD", "Amity1234")
    if not password:
        raise ValueError("MYSQL_PASSWORD must be set before importing data.")
    return URL.create("mysql+pymysql", username=os.getenv("MYSQL_USER", "root"), password=password,
                      host=os.getenv("MYSQL_HOST", "127.0.0.1"), port=int(os.getenv("MYSQL_PORT", "3306")),
                      database=os.getenv("MYSQL_DATABASE", "resume_screening_db"))


def load_and_validate_csv(csv_path: Path) -> pd.DataFrame:
    if not csv_path.is_file():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    df = pd.read_csv(csv_path)
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing required columns: {sorted(missing)}")
    if df.empty or df["Resume_ID"].isna().any() or df["Resume_ID"].duplicated().any():
        raise ValueError("CSV must have records with present, unique Resume_ID values.")
    df = df.rename(columns=RENAME_COLUMNS).copy()
    numeric = ["Resume_ID", "Experience_Years", "Projects_Count", "AI_Score", "Salary_Expectation"]
    for column in numeric:
        df[column] = pd.to_numeric(df[column], errors="raise")
    if not df["AI_Score"].between(0, 100).all():
        raise ValueError("AI Score (0-100) values must be between 0 and 100.")
    if (df[["Experience_Years", "Projects_Count", "Salary_Expectation"]] < 0).any().any():
        raise ValueError("Experience, projects, and salary values cannot be negative.")
    df["Recruiter_Decision"] = df["Recruiter_Decision"].astype(str).str.strip().str.title()
    invalid = set(df["Recruiter_Decision"]) - {"Hire", "Reject"}
    if invalid:
        raise ValueError(f"Unexpected Recruiter Decision values: {sorted(invalid)}")
    for column in ["Name", "Education", "Job_Role"]:
        if df[column].isna().any() or df[column].astype(str).str.strip().eq("").any():
            raise ValueError(f"{column} must be present for every record.")
    df["Certifications"] = df["Certifications"].where(df["Certifications"].notna(), None)
    return df


def skill_rows(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for resume_id, skills in df[["Resume_ID", "Skills"]].itertuples(index=False):
        rows.extend({"Resume_ID": int(resume_id), "Skill": skill.strip()} for skill in str(skills).split(",") if skill.strip())
    return pd.DataFrame(rows).drop_duplicates()


def import_historical_data(engine: Engine, csv_path: Path, replace: bool) -> tuple[int, int]:
    df = load_and_validate_csv(csv_path)
    candidates = df[["Resume_ID", "Name", "Education", "Certifications", "Projects_Count", "Job_Role", "AI_Score", "Recruiter_Decision", "Salary_Expectation", "Experience_Years"]].copy()
    skills = skill_rows(df)
    with engine.begin() as connection:
        if replace:
            connection.execute(text("DELETE FROM historical_skills"))
            connection.execute(text("DELETE FROM historical_candidates"))
        if connection.execute(text("SELECT COUNT(*) FROM historical_candidates")).scalar_one():
            raise RuntimeError("Historical tables already contain data. Re-run with --replace to reload them.")
        candidates.to_sql("historical_candidates", connection, if_exists="append", index=False, method="multi", chunksize=500)
        skills.to_sql("historical_skills", connection, if_exists="append", index=False, method="multi", chunksize=1000)
    return len(candidates), len(skills)


def main() -> None:
    parser = argparse.ArgumentParser(description="Import historical resume data into MySQL.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV_PATH)
    parser.add_argument("--replace", action="store_true", help="Delete and replace historical data.")
    args = parser.parse_args()
    engine = create_engine(database_url(), pool_pre_ping=True)
    candidates, skills = import_historical_data(engine, args.csv.resolve(), args.replace)
    print(f"Imported {candidates} candidates and {skills} normalized skills.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Import failed: {error}", file=sys.stderr)
        sys.exit(1)
