-- ============================================================
-- UMS Student Dashboard — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID    REFERENCES auth.users PRIMARY KEY,
  student_id  TEXT    UNIQUE NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('student', 'lecturer')),
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  address     TEXT,
  program     TEXT,
  level       TEXT
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id     UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  icon   TEXT,
  color  TEXT,
  name   TEXT,
  score  TEXT,
  pct    INTEGER
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title      TEXT        NOT NULL,
  time       TEXT,
  color      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timetable (day_of_week: 0=Sunday … 6=Saturday)
CREATE TABLE IF NOT EXISTS timetable (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time         TEXT,
  room         TEXT,
  subject      TEXT,
  lesson_type  TEXT
);

-- Exam config (single row)
CREATE TABLE IF NOT EXISTS exam_config (
  id         INTEGER DEFAULT 1 PRIMARY KEY CHECK (id = 1),
  semester   TEXT,
  scheduled  INTEGER,
  countdown  TEXT,
  hall       TEXT
);

-- Exam items
CREATE TABLE IF NOT EXISTS exam_items (
  id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day     TEXT,
  month   TEXT,
  weekday TEXT,
  time    TEXT,
  subject TEXT,
  icon    TEXT,
  room    TEXT,
  status  TEXT
);

-- Lecturers
CREATE TABLE IF NOT EXISTS lecturers (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  dept     TEXT,
  av       TEXT,
  bg       TEXT,
  status   TEXT,
  slabel   TEXT,
  sclass   TEXT,
  courses  TEXT[],
  hours    TEXT,
  location TEXT,
  mode     TEXT,
  micon    TEXT
);

-- Resources
CREATE TABLE IF NOT EXISTS resources (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT        NOT NULL,
  type        TEXT,
  course      TEXT,
  lecturer    TEXT,
  description TEXT,
  file_name   TEXT,
  size        TEXT,
  uploaded    TEXT,
  due_date    TEXT,
  icon        TEXT,
  file_path   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Consultations
CREATE TABLE IF NOT EXISTS consultations (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id    UUID        NOT NULL,
  lecturer_id   TEXT        NOT NULL,
  lecturer_name TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- After running this SQL:
-- 1. Go to Storage → New bucket → name: "resources", Public: ON
-- 2. Go to Authentication → Settings → JWT expiry → set 604800 (7 days)
-- 3. Run: node seed.js  (to populate data and create auth users)
-- ============================================================
