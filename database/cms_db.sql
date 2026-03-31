-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.cms_clubs_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  logo_path text,
  external_link text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_clubs_activities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_department_info (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  value_type text NOT NULL DEFAULT 'text'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_department_info_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_gallery (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  image_path text NOT NULL,
  caption text,
  category USER-DEFINED NOT NULL DEFAULT 'GENERAL'::cms_gallery_category,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_gallery_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_hero_slides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  image_path text NOT NULL,
  title text,
  subtitle text,
  cta_text text,
  cta_link text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_hero_slides_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_hod_message (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  designation text NOT NULL,
  photo_path text,
  message text NOT NULL,
  tenure_start date,
  tenure_end date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_hod_message_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_lab_facilities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_path text,
  room_number text,
  equipment jsonb DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_lab_facilities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_navigation_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL,
  url text NOT NULL,
  section text NOT NULL CHECK (section = ANY (ARRAY['NAVBAR'::text, 'QUICK_NAV'::text, 'FOOTER_ACADEMICS'::text, 'FOOTER_RESEARCH'::text, 'FOOTER_ABOUT'::text, 'FOOTER_QUICK_LINKS'::text, 'SOCIAL'::text])),
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_navigation_links_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_news_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE,
  excerpt text,
  body text,
  image_path text,
  category USER-DEFINED NOT NULL DEFAULT 'NEWS'::cms_news_category,
  is_featured boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_news_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_page_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE CHECK (section_key = ANY (ARRAY['hero'::text, 'hod_message'::text, 'notices'::text, 'stats'::text, 'quick_nav'::text, 'news'::text, 'research'::text, 'labs'::text, 'clubs'::text, 'gallery'::text, 'cta'::text, 'programs'::text])),
  title text,
  subtitle text,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_page_sections_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  degree_type USER-DEFINED NOT NULL,
  description text,
  duration text,
  total_credits numeric,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_programs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_research_highlights (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_path text,
  category USER-DEFINED NOT NULL DEFAULT 'PUBLICATION'::cms_research_category,
  external_link text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_research_highlights_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_stats_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_tv_announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT ''::text,
  type text NOT NULL DEFAULT 'notice'::text CHECK (type = ANY (ARRAY['notice'::text, 'class-test'::text, 'assignment'::text, 'lab-test'::text, 'quiz'::text, 'event'::text, 'other'::text])),
  course_code text,
  priority text NOT NULL DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  scheduled_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL DEFAULT 'Admin'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_tv_announcements_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_tv_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  description text,
  image_url text,
  speaker_name text,
  speaker_image_url text,
  event_date date,
  event_time text,
  location text,
  badge_text text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_tv_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_tv_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT ''::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_tv_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cms_tv_ticker (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'SPECIAL UPDATE'::text,
  text text NOT NULL,
  type text NOT NULL DEFAULT 'notice'::text CHECK (type = ANY (ARRAY['notice'::text, 'class-test'::text, 'assignment'::text, 'lab-test'::text, 'quiz'::text, 'event'::text, 'other'::text])),
  course_code text,
  announcement_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_tv_ticker_pkey PRIMARY KEY (id),
  CONSTRAINT cms_tv_ticker_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.cms_tv_announcements(id)
);