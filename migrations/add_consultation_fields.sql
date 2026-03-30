-- Run this in your Supabase SQL editor (supabase.com → SQL Editor)
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS preferred_time text;
