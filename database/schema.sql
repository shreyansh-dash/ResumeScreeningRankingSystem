-- Run this file in MySQL Workbench before importing the CSV.
-- MySQL 8.0+ is recommended.
CREATE DATABASE IF NOT EXISTS resume_screening_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_0900_ai_ci;

USE resume_screening_db;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(320) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('candidate', 'recruiter', 'company_admin') NOT NULL,
    session_token VARCHAR(128) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_session_token (session_token),
    INDEX idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historical_candidates (
    Resume_ID INT UNSIGNED NOT NULL, 
    Name VARCHAR(255) NOT NULL,
    Education VARCHAR(255) NOT NULL, 
    Certifications TEXT NULL,
    Projects_Count SMALLINT UNSIGNED NOT NULL, 
    Job_Role VARCHAR(150) NOT NULL,
    AI_Score TINYINT UNSIGNED NOT NULL, 
    Recruiter_Decision ENUM('Hire', 'Reject') NOT NULL,
    Salary_Expectation DECIMAL(12,2) UNSIGNED NOT NULL, 
    Experience_Years SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (Resume_ID), 
    CONSTRAINT chk_historical_ai_score CHECK (AI_Score BETWEEN 0 AND 100),
    INDEX idx_historical_role_decision (Job_Role, Recruiter_Decision),
    INDEX idx_historical_score (AI_Score), 
    INDEX idx_historical_name (Name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historical_skills (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, 
    Resume_ID INT UNSIGNED NOT NULL, 
    Skill VARCHAR(150) NOT NULL,
    PRIMARY KEY (id), 
    UNIQUE KEY uq_historical_skill (Resume_ID, Skill), 
    INDEX idx_historical_skill (Skill),
    CONSTRAINT fk_historical_skills_candidate FOREIGN KEY (Resume_ID)
      REFERENCES historical_candidates (Resume_ID) 
      ON DELETE CASCADE 
      ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_uploads (
    Upload_ID BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, 
    Candidate_Name VARCHAR(255) NOT NULL,
    File_Path VARCHAR(1024) NOT NULL, 
    Parsed_Text LONGTEXT NOT NULL, 
    Target_Role VARCHAR(150) NOT NULL,
    Calculated_Score DECIMAL(5,2) NOT NULL, 
    Uploaded_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (Upload_ID), 
    CONSTRAINT chk_live_upload_score CHECK (Calculated_Score BETWEEN 0 AND 100),
    INDEX idx_live_upload_role_score (Target_Role, Calculated_Score), 
    INDEX idx_live_upload_uploaded_at (Uploaded_At)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_upload_skills (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, 
    Upload_ID BIGINT UNSIGNED NOT NULL, 
    Skill VARCHAR(150) NOT NULL,
    PRIMARY KEY (id), 
    UNIQUE KEY uq_live_upload_skill (Upload_ID, Skill), 
    INDEX idx_live_upload_skill (Skill),
    CONSTRAINT fk_live_upload_skills_upload FOREIGN KEY (Upload_ID)
      REFERENCES live_uploads (Upload_ID) 
      ON DELETE CASCADE 
      ON UPDATE CASCADE
) ENGINE=InnoDB;
