-- ============================================================
-- Notification Push Outbox Setup
-- Purpose: prepare reliable external push delivery (OneSignal/FCM)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  provider text NOT NULL DEFAULT 'onesignal',
  token text NOT NULL,
  app_version text,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, token)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_active
  ON public.device_push_tokens (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_provider_active
  ON public.device_push_tokens (provider, is_active);

CREATE TABLE IF NOT EXISTS public.notification_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_push_outbox_pending
  ON public.notification_push_outbox (status, next_attempt_at);

CREATE OR REPLACE FUNCTION public.enqueue_notification_push_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notification_push_outbox (notification_id, status)
  VALUES (NEW.id, 'pending')
  ON CONFLICT (notification_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_push_outbox ON public.notifications;

CREATE TRIGGER trg_notifications_push_outbox
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_notification_push_outbox();

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_push_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_push_tokens_select_own" ON public.device_push_tokens;
DROP POLICY IF EXISTS "device_push_tokens_insert_own" ON public.device_push_tokens;
DROP POLICY IF EXISTS "device_push_tokens_update_own" ON public.device_push_tokens;
DROP POLICY IF EXISTS "device_push_tokens_delete_own" ON public.device_push_tokens;

CREATE POLICY "device_push_tokens_select_own" ON public.device_push_tokens
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "device_push_tokens_insert_own" ON public.device_push_tokens
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "device_push_tokens_update_own" ON public.device_push_tokens
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "device_push_tokens_delete_own" ON public.device_push_tokens
FOR DELETE USING (auth.uid() = user_id);

-- Outbox table is backend/internal only; no client-facing policies are added.
