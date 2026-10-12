-- Apply after database/cms_baseline.sql to the separate CMS database.
-- CMS mutations are made only by the authenticated administrative server API.
DO $$ DECLARE t record; p record; predicate text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY(ARRAY[
 'cms_hero_slides','cms_department_info','cms_hod_message','cms_stats','cms_news_events','cms_research_highlights',
 'cms_lab_facilities','cms_clubs_activities','cms_gallery','cms_navigation_links','cms_page_sections','cms_programs',
 'cms_tv_announcements','cms_tv_ticker','cms_tv_settings','cms_tv_events','cms_tv_devices']) LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t.tablename);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t.tablename);
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t.tablename LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t.tablename);
  END LOOP;
  IF t.tablename NOT LIKE 'cms_tv_%' THEN
   predicate:='true';
   IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t.tablename AND column_name='is_active') THEN predicate:='is_active'; END IF;
   IF t.tablename='cms_page_sections' THEN predicate:='is_visible'; END IF;
   IF t.tablename='cms_news_events' THEN predicate:='published_at IS NOT NULL AND published_at<=now()'; END IF;
   EXECUTE format('GRANT SELECT ON public.%I TO anon,authenticated',t.tablename);
   EXECUTE format('CREATE POLICY public_content ON public.%I FOR SELECT TO anon,authenticated USING(%s)',t.tablename,predicate);
  END IF;
 END LOOP;
END $$;
