// ==========================================
// CMS Service — Supabase data fetching
// Uses a SEPARATE Supabase client for CMS DB
// (CMS tables live in a different project)
// ==========================================

import type {
    CmsClubActivity,
    CmsDepartmentInfo,
    CmsGalleryItem,
    CmsHeroSlide,
    CmsHodMessage,
    CmsLabFacility,
    CmsNavigationLink,
    CmsNewsEvent,
    CmsPageSection,
    CmsProgram,
    CmsResearchHighlight,
    CmsStat,
    LandingPageData,
} from '@/types/cms';
import { createClient } from '@supabase/supabase-js';

// CMS Supabase client (separate from academic DB)
const CMS_URL = process.env.NEXT_PUBLIC_CMS_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const CMS_KEY = process.env.NEXT_PUBLIC_CMS_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const CMS_BUCKET = 'cms-images';

export const cmsSupabase = createClient(CMS_URL, CMS_KEY);

/**
 * Build public URL for images in the cms-images storage bucket.
 * DB stores just the filename (e.g. "1.jpeg").
 */
export const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${CMS_URL}/storage/v1/object/public/${CMS_BUCKET}/${path}`;
};

/**
 * Fetch ALL data needed for the landing page in a single parallel batch.
 */
export async function fetchLandingPageData(): Promise<LandingPageData> {
  const [
    heroRes, deptRes, hodRes, statsRes,
    newsRes, researchRes, labsRes, clubsRes,
    galleryRes, navRes, sectionsRes, programsRes,
  ] = await Promise.all([
    cmsSupabase.from('cms_hero_slides').select('*').eq('is_active', true).order('display_order'),
    cmsSupabase.from('cms_department_info').select('*'),
    cmsSupabase.from('cms_hod_message').select('*').eq('is_active', true).limit(1).single(),
    cmsSupabase.from('cms_stats').select('*').eq('is_active', true).order('display_order'),
    cmsSupabase.from('cms_news_events').select('*').order('published_at', { ascending: false }).limit(6),
    cmsSupabase.from('cms_research_highlights').select('*').eq('is_active', true).order('display_order').limit(6),
    cmsSupabase.from('cms_lab_facilities').select('*').eq('is_active', true).order('display_order'),
    cmsSupabase.from('cms_clubs_activities').select('*').eq('is_active', true).order('display_order'),
    cmsSupabase.from('cms_gallery').select('*').eq('is_active', true).order('display_order').limit(8),
    cmsSupabase.from('cms_navigation_links').select('*').eq('is_active', true).order('display_order'),
    cmsSupabase.from('cms_page_sections').select('*').order('display_order'),
    cmsSupabase.from('cms_programs').select('*').eq('is_active', true).order('display_order'),
  ]);

  // Convert department info array → key-value map
  const departmentInfo: Record<string, string> = {};
  (deptRes.data as CmsDepartmentInfo[] | null)?.forEach(row => {
    if (row.key && row.value) departmentInfo[row.key] = row.value;
  });

  return {
    heroSlides: (heroRes.data as CmsHeroSlide[]) || [],
    departmentInfo,
    hodMessage: (hodRes.data as CmsHodMessage) || null,
    stats: (statsRes.data as CmsStat[]) || [],
    news: (newsRes.data as CmsNewsEvent[]) || [],
    research: (researchRes.data as CmsResearchHighlight[]) || [],
    labs: (labsRes.data as CmsLabFacility[]) || [],
    clubs: (clubsRes.data as CmsClubActivity[]) || [],
    gallery: (galleryRes.data as CmsGalleryItem[]) || [],
    navLinks: (navRes.data as CmsNavigationLink[]) || [],
    pageSections: (sectionsRes.data as CmsPageSection[]) || [],
    programs: (programsRes.data as CmsProgram[]) || [],
  };
}
