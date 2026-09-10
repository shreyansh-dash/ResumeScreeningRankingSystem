# Shortlist — Resume Screening & Ranking System

An evidence-first dashboard for a 1,000-candidate historical dataset and a live PDF/DOCX screening workflow. New resumes are compared with candidates hired for the selected role; the result includes a score, rank, skill gaps, and profile metrics.

## Prerequisites

- MySQL 8.0+
- Python 3.10+

## Setup

1. Run [database/schema.sql](database/schema.sql) in MySQL Workbench.
2. Set your MySQL password for the current PowerShell session and import the dataset:

```powershell
$env:MYSQL_PASSWORD = "your-password"
.\venv\Scripts\python.exe database\import_script.py
```

3. Install API dependencies and start the service:

```powershell
.\venv\Scripts\pip.exe install -r backend\requirements.txt
.\venv\Scripts\uvicorn.exe backend.app:app --reload --port 8000
```

4. In a second terminal, serve the frontend:

```powershell
.\venv\Scripts\python.exe -m http.server 5500 --directory frontend
```

Open `http://127.0.0.1:5500`.

## Optional environment settings

`MYSQL_USER` defaults to `root`; `MYSQL_HOST`, `MYSQL_PORT`, and `MYSQL_DATABASE` default to `127.0.0.1`, `3306`, and `resume_screening_db`. Do not commit passwords. Use `--replace` only when intentionally reloading the historical dataset.
