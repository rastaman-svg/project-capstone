-- Postgres port of the PHP version's database/schema.sql +
-- migration_v2.sql + migration_v3.sql, consolidated into one file
-- since this is a fresh system with no prior MySQL data to carry over.
--
-- Run once against a fresh database:
--   psql "$DATABASE_URL" -f sql/schema.sql

CREATE TYPE program_type AS ENUM ('COLLEGE_OJT', 'SHS_WORK_IMMERSION');
CREATE TYPE admin_role AS ENUM ('SUPERADMIN', 'STAFF');
CREATE TYPE shift_type AS ENUM ('AM', 'PM');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'ADJUSTED', 'INCOMPLETE');

CREATE TABLE users (
    id                    SERIAL PRIMARY KEY,
    student_id            VARCHAR(20) UNIQUE NOT NULL,
    first_name            VARCHAR(100) NOT NULL,
    last_name             VARCHAR(100) NOT NULL,
    email                 VARCHAR(255) UNIQUE NOT NULL,
    password_hash         VARCHAR(255),
    program_type          program_type NOT NULL,
    year_level            VARCHAR(50) NOT NULL,
    course                VARCHAR(150) NOT NULL,
    section               VARCHAR(50),
    company_advisor       VARCHAR(150) NOT NULL,
    ojt_start_date        DATE NOT NULL,
    total_required_hours  NUMERIC(6,2) NOT NULL DEFAULT 486.00,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_program ON users(program_type);

CREATE TABLE admin (
    id             SERIAL PRIMARY KEY,
    username       VARCHAR(50) UNIQUE NOT NULL,
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL DEFAULT '',
    role           admin_role NOT NULL DEFAULT 'STAFF',
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Seed one admin account with an empty password hash — see README.md
-- for how to set the real password (same "run once from the CLI,
-- never a public URL" approach as the PHP version).
INSERT INTO admin (username, email, password_hash, role)
VALUES ('superadmin', 'admin@school.edu.ph', '', 'SUPERADMIN');

CREATE TABLE face_encodings (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encoding_data   TEXT NOT NULL,       -- JSON-stringified float array (face-api.js descriptor)
    encoding_model  VARCHAR(50) NOT NULL DEFAULT 'face_api_js_v1',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attendance (
    id                       SERIAL PRIMARY KEY,
    user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date                     DATE NOT NULL,
    shift                    shift_type NOT NULL,
    time_in                  TIMESTAMPTZ,
    time_out                 TIMESTAMPTZ,
    time_in_method           VARCHAR(10),   -- 'FACE' or NULL
    time_out_method          VARCHAR(10),   -- 'QR' or NULL
    total_hours_rendered     NUMERIC(5,2),
    status                   attendance_status NOT NULL DEFAULT 'PRESENT',
    adjusted_by_admin_id     INTEGER REFERENCES admin(id),
    adjustment_note          TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, date, shift)
);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date);

CREATE TABLE power_events (
    id                    SERIAL PRIMARY KEY,
    is_power_online       BOOLEAN NOT NULL,
    note                  TEXT,
    changed_by_admin_id   INTEGER REFERENCES admin(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO power_events (is_power_online, note) VALUES (TRUE, 'Initial state');

CREATE TABLE resources (
    id             SERIAL PRIMARY KEY,
    title          VARCHAR(200) NOT NULL,
    program_type   program_type,          -- NULL = visible to both programs
    file_name      VARCHAR(255) NOT NULL,
    stored_path    VARCHAR(500) NOT NULL, -- Vercel Blob URL, not a local path (see README)
    uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings (
    id                          INTEGER PRIMARY KEY DEFAULT 1,
    college_ojt_default_hours   NUMERIC(6,2) NOT NULL DEFAULT 486.00,
    shs_default_hours           NUMERIC(6,2) NOT NULL DEFAULT 80.00,
    am_time_in_start            TIME NOT NULL DEFAULT '06:00:00',
    am_time_in_end              TIME NOT NULL DEFAULT '10:00:00',
    pm_time_in_start            TIME NOT NULL DEFAULT '12:00:00',
    pm_time_in_end              TIME NOT NULL DEFAULT '15:00:00',
    am_time_out_start           TIME NOT NULL DEFAULT '10:00:00',
    am_time_out_end             TIME NOT NULL DEFAULT '13:00:00',
    pm_time_out_start           TIME NOT NULL DEFAULT '15:00:00',
    pm_time_out_end             TIME NOT NULL DEFAULT '20:00:00',
    CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO settings (id) VALUES (1);
