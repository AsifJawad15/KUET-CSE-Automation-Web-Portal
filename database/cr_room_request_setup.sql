-- ==========================================
-- CR (Class Representative) & Room Request System
-- Tables: class_representatives, cr_room_requests
-- ==========================================

-- ── 1. Add is_cr column to students table ──────────────

ALTER TABLE students ADD COLUMN IF NOT EXISTS is_cr BOOLEAN DEFAULT FALSE;

-- ── 2. CR Room Requests Table ──────────────────────────

CREATE TABLE IF NOT EXISTS cr_room_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  teacher_user_id UUID NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
  room_number TEXT REFERENCES rooms(room_number) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  term TEXT NOT NULL,
  session TEXT NOT NULL,
  section TEXT,
  reason TEXT,
  request_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_remarks TEXT,
  admin_user_id UUID REFERENCES admins(user_id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Indexes ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_students_is_cr ON students(is_cr) WHERE is_cr = TRUE;
CREATE INDEX IF NOT EXISTS idx_cr_room_requests_status ON cr_room_requests(status);
CREATE INDEX IF NOT EXISTS idx_cr_room_requests_student ON cr_room_requests(student_user_id);

-- ── 4. Trigger for updated_at ──────────────────────────

CREATE OR REPLACE TRIGGER set_cr_room_requests_updated_at
  BEFORE UPDATE ON cr_room_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── 5. RLS Policies (development - permissive) ────────

ALTER TABLE cr_room_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to cr_room_requests" ON cr_room_requests
  FOR ALL USING (true) WITH CHECK (true);
