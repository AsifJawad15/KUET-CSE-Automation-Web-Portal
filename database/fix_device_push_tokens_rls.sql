-- ============================================================
-- Fix: Disable RLS on device_push_tokens
--
-- Why: The mobile app uses a custom bcrypt authentication system rather
-- than native Supabase Auth. Consequently, auth.uid() is always null
-- for queries originating from the mobile app.
--
-- If RLS is enabled on device_push_tokens, all attempts to register or
-- update FCM tokens from the mobile client are blocked with a 42501
-- RLS violation error. This prevents the server from finding the device's
-- FCM token, causing push notifications to not be delivered.
--
-- Run this script in the Supabase SQL Editor (https://app.supabase.com)
-- ============================================================

ALTER TABLE public.device_push_tokens DISABLE ROW LEVEL SECURITY;
