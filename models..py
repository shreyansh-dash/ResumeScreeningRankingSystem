from pydantic import BaseModel
from typing import Optional

class Candidate(BaseModel):
    Resume_ID: str
    Name: str
    Education: str
    Certifications: str
    Projects_Count: int
    Job_Role: str
    AI_Score: float
    Recruiter_Decision: str
    Salary_Expectation: float
    Experience_Years: int

class AnalyticsResponse(BaseModel):
    hire_ratio_by_role: dict
    avg_salary_by_role: dict
    avg_salary_by_experience: dict
    top_skills_by_role: dict
    score_vs_decision_agreement: dict
    experience_distribution: dict
