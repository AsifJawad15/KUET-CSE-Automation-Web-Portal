// ==========================================
// Shared types for landing page section components
// ==========================================

import type { CmsPageSection } from '@/types/cms';

/** Section visibility/config helpers passed to every section component */
export interface SectionConfig {
  title: string | null | undefined;
  subtitle: string | null | undefined;
}

/** Extract section config from a CmsPageSection */
export function getSectionConfig(
  section: CmsPageSection | undefined,
  defaults: { title: string; subtitle?: string },
): SectionConfig {
  return {
    title: section?.title || defaults.title,
    subtitle: section?.subtitle || defaults.subtitle,
  };
}
