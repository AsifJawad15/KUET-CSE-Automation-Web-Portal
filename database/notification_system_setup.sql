-- ============================================================
-- KUET CSE AUTOMATION — NOTIFICATION SYSTEM
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. NOTIFICATIONS TABLE ──────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID            DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Content
  type          TEXT            NOT NULL,  -- See types below
  title         TEXT            NOT NULL,
  body          TEXT            NOT NULL,
  icon          TEXT,                       -- optional emoji/icon name hint for UI

  -- Targeting strategy
  target_type   TEXT            NOT NULL DEFAULT 'USER',
  -- 'ALL'       → every logged-in user
  -- 'ROLE'      → target_value = 'STUDENT' | 'TEACHER'
  -- 'YEAR_TERM' → target_value = '3-2'
  -- 'SECTION'   → target_value = 'A|B|C', target_year_term required
  -- 'COURSE'    → target_value = course_code (e.g. 'CSE 3201')
  -- 'USER'      → target_value = specific user_id

  target_value      TEXT,          -- role / year_term / section / course_code / user_id
  target_year_term  TEXT,          -- used when target_type = 'SECTION' to narrow scope

  -- Source
  created_by        UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_by_role   TEXT,          -- 'STUDENT_CR' | 'TEACHER' | 'ADMIN'

  -- Rich metadata (course_code, room, exam_date, etc.)
  metadata      JSONB           DEFAULT '{}',

  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ     -- optional TTL; NULL = never expires
);

-- ── 2. NOTIFICATION READS TABLE ────────────────────────────

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id  UUID  REFERENCES notifications(id) ON DELETE CASCADE,
  user_id          UUID  REFERENCES profiles(user_id)  ON DELETE CASCADE,
  read_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

-- ── 3. INDEXES ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_target_type
  ON notifications (target_type, target_value);

CREATE INDEX IF NOT EXISTS idx_notifications_target_year_term
  ON notifications (target_year_term);

CREATE INDEX IF NOT EXISTS idx_notifications_expires_at
  ON notifications (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_reads_user
  ON notification_reads (user_id);

-- ── 4. ENABLE REALTIME ──────────────────────────────────────
-- This allows the app to subscribe to new notifications in real-time
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE notification_reads REPLICA IDENTITY FULL;

-- Add to replication (Supabase realtime)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ── 5. ROW LEVEL SECURITY ───────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_auth" ON notifications;
DROP POLICY IF EXISTS "notification_reads_select" ON notification_reads;
DROP POLICY IF EXISTS "notification_reads_insert" ON notification_reads;

-- ┌────────────────────────────────────────────────────────────────────┐
-- │ SELECT: user can see a notification if:                           │
-- │  a) target_type = 'ALL'                                           │
-- │  b) target_type = 'ROLE'  AND their role matches                  │
-- │  c) target_type = 'YEAR_TERM'  AND their term matches            │
-- │  d) target_type = 'SECTION' AND term+section match               │
-- │  e) target_type = 'COURSE' AND they are enrolled in that course  │
-- │  f) target_type = 'USER'   AND target_value = their user_id      │
-- └────────────────────────────────────────────────────────────────────┘
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      target_type = 'ALL'

      OR (target_type = 'ROLE' AND target_value = (
        SELECT role::text FROM profiles WHERE user_id = auth.uid()
          ))

      OR (target_type = 'YEAR_TERM' AND target_value = (
            SELECT term FROM students WHERE user_id = auth.uid()
          ))

      OR (target_type = 'SECTION' AND (
            SELECT term = target_year_term AND section = target_value
            FROM students WHERE user_id = auth.uid()
          ))

      OR (target_type = 'COURSE' AND EXISTS (
            SELECT 1
            FROM students s
        JOIN course_offerings co ON co.term = s.term
            JOIN courses c ON c.id = co.course_id
            WHERE s.user_id = auth.uid()
              AND c.code = target_value
          ))

      OR (target_type = 'USER' AND target_value = auth.uid()::TEXT)

      OR created_by = auth.uid()
    )
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- INSERT: any authenticated user (CR, teacher, admin)
CREATE POLICY "notifications_insert_auth" ON notifications
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- READ receipts: only own
CREATE POLICY "notification_reads_select" ON notification_reads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notification_reads_insert" ON notification_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 6. HELPER: fetch unread count for caller ─────────────────
-- Usage: SELECT * FROM get_my_unread_notification_count();
CREATE OR REPLACE FUNCTION get_my_unread_notification_count()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) FROM notifications n
  WHERE (
    n.target_type = 'ALL'
    OR (n.target_type = 'ROLE' AND n.target_value = (SELECT role::text FROM profiles WHERE user_id = auth.uid()))
    OR (n.target_type = 'YEAR_TERM' AND n.target_value = (SELECT term FROM students WHERE user_id = auth.uid()))
    OR (n.target_type = 'SECTION' AND EXISTS (
          SELECT 1 FROM students WHERE user_id = auth.uid()
            AND term = n.target_year_term AND section = n.target_value))
    OR (n.target_type = 'COURSE' AND EXISTS (
          SELECT 1 FROM students s
          JOIN course_offerings co ON co.term = s.term
          JOIN courses c ON c.id = co.course_id
          WHERE s.user_id = auth.uid() AND c.code = n.target_value))
    OR (n.target_type = 'USER' AND n.target_value = auth.uid()::TEXT)
  )
  AND (n.expires_at IS NULL OR n.expires_at > NOW())
  AND NOT EXISTS (
    SELECT 1 FROM notification_reads r
    WHERE r.notification_id = n.id AND r.user_id = auth.uid()
  );
$$;

-- ── 7. COMMENTED NOTIFICATION TYPES REFERENCE ───────────────
-- 'room_allocated'        — CR allocated a room for a class
-- 'room_request_approved' — Teacher room request approved
-- 'room_request_rejected' — Teacher room request rejected
-- 'notice_posted'         — Admin/Teacher/CR posted a notice
-- 'exam_scheduled'        — Class test / mid / final scheduled
-- 'class_cancelled'       — Class cancelled
-- 'class_rescheduled'     — Class rescheduled
-- 'assignment_due'        — Assignment deadline
-- 'attendance_low'        — Attendance < 75% warning
-- 'announcement'          — General announcement
-- 'term_upgrade'          — Term upgrade approved/rejected
-- 'makeup_class'          — Makeup class scheduled
-- 'geo_attendance_open'   — Geo attendance room opened for class
-- 'optional_course'       — Optional/elective course assigned
