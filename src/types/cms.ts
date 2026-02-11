// ==========================================
// CMS Database Types — Landing Page Content
// Maps to the 12 cms_* tables in Supabase
// ==========================================

export type CmsNewsCategory = 'NEWS' | 'EVENT' | 'ACTIVITY';
export type CmsResearchCategory = 'PUBLICATION' | 'JOURNAL' | 'CONFERENCE' | 'UGC_PROJECT' | 'GRANT';
export type CmsGalleryCategory = 'CAMPUS' | 'EVENT' | 'LAB' | 'GENERAL';
export type CmsDegreeType = 'UNDERGRADUATE' | 'POSTGRADUATE' | 'PHD';

export interface CmsHeroSlide {
  id: string;
  image_path: string;
  title: string | null;
  subtitle: string | null;
  cta_text: string | null;
  cta_link: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CmsDepartmentInfo {
  id: string;
  key: string;
  value: string | null;
  value_type: string;
  updated_at: string;
}

export interface CmsHodMessage {
  id: string;
  name: string;
  designation: string;
  photo_path: string | null;
  message: string;
  tenure_start: string | null;
  tenure_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CmsStat {
  id: string;
  label: string;
  value: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  updated_at: string;
}

export interface CmsNewsEvent {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  body: string | null;
  image_path: string | null;
  category: CmsNewsCategory;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CmsResearchHighlight {
  id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  category: CmsResearchCategory;
  external_link: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CmsLabFacility {
  id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  room_number: string | null;
  equipment: string[];
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CmsClubActivity {
  id: string;
  name: string;
  description: string | null;
  logo_path: string | null;
  external_link: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CmsGalleryItem {
  id: string;
  image_path: string;
  caption: string | null;
  category: CmsGalleryCategory;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CmsNavigationLink {
  id: string;
  label: string;
  url: string;
  section: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CmsPageSection {
  id: string;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  is_visible: boolean;
  display_order: number;
  updated_at: string;
}

export interface CmsProgram {
  id: string;
  name: string;
  short_name: string | null;
  degree_type: CmsDegreeType;
  description: string | null;
  duration: string | null;
  total_credits: number | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

// Aggregated data for the landing page
export interface LandingPageData {
  heroSlides: CmsHeroSlide[];
  departmentInfo: Record<string, string>;
  hodMessage: CmsHodMessage | null;
  stats: CmsStat[];
  news: CmsNewsEvent[];
  research: CmsResearchHighlight[];
  labs: CmsLabFacility[];
  clubs: CmsClubActivity[];
  gallery: CmsGalleryItem[];
  navLinks: CmsNavigationLink[];
  pageSections: CmsPageSection[];
  programs: CmsProgram[];
}
