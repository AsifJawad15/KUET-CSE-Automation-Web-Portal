// ==========================================
// Shared Icon Map
// Single Responsibility: Maps DB icon names → Lucide components
// DRY: Used by HeroLanding, PublicLayout, and any CMS-driven UI
// ==========================================

import {
  Award, BookOpen, Building2, Calendar, ChevronRight, Clock,
  ExternalLink, Facebook, FileText, FlaskConical, Globe, GraduationCap,
  Heart, Linkedin, Mail, MapPin, Microscope, Phone, Quote,
  Twitter, Users, Youtube,
} from 'lucide-react';
import type { ElementType } from 'react';

const ICON_MAP: Record<string, ElementType> = {
  'graduation-cap': GraduationCap,
  'users': Users,
  'book-open': BookOpen,
  'flask-conical': FlaskConical,
  'globe': Globe,
  'file-text': FileText,
  'microscope': Microscope,
  'award': Award,
  'heart': Heart,
  'building-2': Building2,
  'calendar': Calendar,
  'facebook': Facebook,
  'linkedin': Linkedin,
  'youtube': Youtube,
  'twitter': Twitter,
  'mail': Mail,
  'phone': Phone,
  'map-pin': MapPin,
  'clock': Clock,
  'external-link': ExternalLink,
  'quote': Quote,
  'chevron-right': ChevronRight,
};

const DEFAULT_ICON = GraduationCap;

/**
 * Resolve a CMS icon name to a Lucide component.
 * Falls back to GraduationCap if the name is null or unknown.
 */
export function getIcon(name: string | null | undefined): ElementType {
  if (!name) return DEFAULT_ICON;
  return ICON_MAP[name] ?? DEFAULT_ICON;
}

export { ICON_MAP, DEFAULT_ICON };
