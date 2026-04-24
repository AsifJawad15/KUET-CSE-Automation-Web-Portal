-- FCM notifications + admin/head/staff roles.
-- Apply this in Supabase SQL editor before deploying the updated apps.

DO $$
DECLARE
  role_type regtype;
BEGIN
  SELECT atttypid::regtype
  INTO role_type
  FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass
    AND attname = 'role';

  IF role_type IS NOT NULL THEN
    EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', role_type, 'HEAD');
    EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', role_type, 'STAFF');
  END IF;
END $$;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS is_head boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS teachers_one_active_head_idx
  ON public.teachers ((department))
  WHERE is_head = true;

CREATE TABLE IF NOT EXISTS public.staffs (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  staff_uid text NOT NULL DEFAULT ('S-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)) UNIQUE,
  full_name text NOT NULL,
  phone text,
  designation text NOT NULL DEFAULT 'Administrative Staff',
  department text NOT NULL DEFAULT 'CSE',
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_push_tokens
  ALTER COLUMN provider SET DEFAULT 'fcm';

CREATE UNIQUE INDEX IF NOT EXISTS device_push_tokens_token_unique_idx
  ON public.device_push_tokens(token);

CREATE INDEX IF NOT EXISTS device_push_tokens_user_provider_active_idx
  ON public.device_push_tokens(user_id, provider, is_active);

CREATE INDEX IF NOT EXISTS notification_push_outbox_status_next_idx
  ON public.notification_push_outbox(status, next_attempt_at, created_at);

CREATE OR REPLACE FUNCTION public.enqueue_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notification_push_outbox(notification_id, status)
  VALUES (NEW.id, 'pending')
  ON CONFLICT (notification_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_enqueue_push ON public.notifications;
CREATE TRIGGER notifications_enqueue_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_notification_push();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staffs_touch_updated_at ON public.staffs;
CREATE TRIGGER staffs_touch_updated_at
BEFORE UPDATE ON public.staffs
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();
