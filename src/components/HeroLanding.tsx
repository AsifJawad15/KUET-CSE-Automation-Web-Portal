'use client';

// ==========================================
// HeroLanding — Landing page orchestrator
// Single Responsibility: Fetches data, manages navbar state, composes sections
// Open/Closed: Add a new section by creating a component + adding one line here
// ==========================================

import Footer from '@/components/Footer';
import {
  ClubsSection, ContactSection, GallerySection,
  HeroCarousel, HodMessageSection, LabsSection,
  NewsSection, ProgramsSection, QuickNavSection,
  ResearchSection, StatsSection,
} from '@/components/landing';
import type { StatItem } from '@/components/landing/StatsSection';
import MatrixGrid from '@/components/ui/MatrixGrid';
import { supabase } from '@/lib/supabase';
import { fetchLandingPageData } from '@/services/cmsService';
import type { CmsNavigationLink, CmsPageSection, LandingPageData } from '@/types/cms';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';

// ── Types ──────────────────────────────────────────

interface DbStats {
  students: number;
  faculty: number;
  courses: number;
  labs: number;
  alumni: number;
  papers: number;
}

// ── Helpers ────────────────────────────────────────

/** Build StatItem[] from live DB counts, falling back to CMS stats. */
function buildStats(dbStats: DbStats | null, cmsStats: LandingPageData['stats']): StatItem[] {
  if (dbStats) {
    return [
      { id: 'db-students', icon: 'graduation-cap', value: `${dbStats.students}+`, label: 'Students' },
      { id: 'db-faculty',  icon: 'users',          value: `${dbStats.faculty}+`,  label: 'Faculty Members' },
      { id: 'db-courses',  icon: 'book-open',      value: `${dbStats.courses}+`,  label: 'Courses' },
      { id: 'db-labs',     icon: 'flask-conical',   value: `${dbStats.labs}+`,     label: 'Research Labs' },
      { id: 'db-alumni',   icon: 'globe',           value: `${dbStats.alumni}+`,   label: 'Alumni Worldwide' },
      { id: 'db-papers',   icon: 'file-text',       value: `${dbStats.papers}+`,   label: 'Research Papers' },
    ];
  }
  return cmsStats.map(s => ({ id: s.id, icon: s.icon || 'graduation-cap', value: s.value, label: s.label }));
}

// ── Main Component ─────────────────────────────────

const HeroLanding: React.FC = () => {
  const [data, setData] = useState<LandingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);

  // ── Data fetching ──

  useEffect(() => {
    fetchLandingPageData()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    async function fetchDbStats() {
      try {
        const [studentsRes, teachersRes, coursesRes, roomsRes] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }),
          supabase.from('teachers').select('*', { count: 'exact', head: true }),
          supabase.from('courses').select('*', { count: 'exact', head: true }),
          supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('room_type', 'lab'),
        ]);
        setDbStats({
          students: studentsRes.count || 0,
          faculty: teachersRes.count || 0,
          courses: coursesRes.count || 0,
          labs: roomsRes.count || 0,
          alumni: 5000,
          papers: 500,
        });
      } catch { /* fallback to CMS stats */ }
    }
    fetchDbStats();
  }, []);

  // ── Navbar scroll ──

  useEffect(() => {
    const h = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  // ── Loading / error ──

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b090a] flex items-center justify-center">
        <motion.div animate={{ y: [0, -18, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }} className="flex flex-col items-center gap-4">
          <img src="/kuet-logo.png" alt="KUET" className="w-20 h-20 object-contain drop-shadow-lg" />
          <span className="text-[#D4A574] text-sm font-medium tracking-wide">Loading...</span>
        </motion.div>
      </div>
    );
  }
  if (!data) return null;

  // ── Derived data ──

  const sec = (k: string): CmsPageSection | undefined => data.pageSections.find(s => s.section_key === k);
  const vis = (k: string) => sec(k)?.is_visible !== false;
  const navOf = (s: string): CmsNavigationLink[] => data.navLinks.filter(l => l.section === s);

  const navbarLinks  = navOf('NAVBAR');
  const quickNavLinks = navOf('QUICK_NAV');
  const socialLinks  = navOf('SOCIAL');
  const dept         = data.departmentInfo;
  const uniName      = dept['university_name'] || 'KUET';
  const shortName    = dept['short_name'] || 'CSE, KUET';

  const stats = buildStats(dbStats, data.stats);

  // ── Render ──

  return (
    <div className="min-h-screen bg-[#FDF8F3] overflow-x-hidden">

      {/* ── NAVBAR ─────────────────────────────── */}
      <Navbar
        scrolled={navScrolled}
        mobileOpen={mobileMenu}
        onToggleMobile={() => setMobileMenu(p => !p)}
        links={navbarLinks}
        shortName={shortName}
      />

      {/* ── HERO ───────────────────────────────── */}
      {vis('hero') && (
        <HeroCarousel slides={data.heroSlides} universityName={uniName} />
      )}

      {/* Matrix grid background */}
      <div className="fixed inset-0 z-[1] pointer-events-none">
        <MatrixGrid baseOpacity={0.15} hoverRadius={140} dotColor="rgba(93,64,55,0.08)" glowColor="rgba(212,165,116,0.45)" />
      </div>

      {/* ── HOD MESSAGE ────────────────────────── */}
      {vis('hod_message') && data.hodMessage && (
        <HodMessageSection hodMessage={data.hodMessage} sectionTitle={sec('hod_message')?.title || undefined} />
      )}

      {/* ── NOTICES MARQUEE ────────────────────── */}
      {vis('notices') && data.news.length > 0 && (
        <div className="bg-[#5D4037] text-white py-3 overflow-hidden">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...data.news, ...data.news].map((n, i) => (
              <span key={i} className="mx-8 flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 bg-[#D4A574] text-[#2C1810] text-xs font-bold rounded-full">{n.category}</span>
                {n.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── STATS ──────────────────────────────── */}
      {vis('stats') && <StatsSection stats={stats} />}

      {/* ── QUICK NAVIGATION ───────────────────── */}
      {vis('quick_nav') && (
        <QuickNavSection
          links={quickNavLinks}
          backgroundImagePath={data.heroSlides[1]?.image_path || data.heroSlides[0]?.image_path}
          sectionTitle={sec('quick_nav')?.title || undefined}
          sectionSubtitle={sec('quick_nav')?.subtitle || undefined}
        />
      )}

      {/* ── NEWS & EVENTS ──────────────────────── */}
      {vis('news') && (
        <NewsSection
          news={data.news}
          sectionTitle={sec('news')?.title || undefined}
          sectionSubtitle={sec('news')?.subtitle || undefined}
        />
      )}

      {/* ── RESEARCH ───────────────────────────── */}
      {vis('research') && (
        <ResearchSection
          research={data.research}
          sectionTitle={sec('research')?.title || undefined}
          sectionSubtitle={sec('research')?.subtitle || undefined}
        />
      )}

      {/* ── LABS ───────────────────────────────── */}
      {vis('labs') && (
        <LabsSection
          labs={data.labs}
          sectionTitle={sec('labs')?.title || undefined}
          sectionSubtitle={sec('labs')?.subtitle || undefined}
        />
      )}

      {/* ── CLUBS ──────────────────────────────── */}
      {vis('clubs') && (
        <ClubsSection
          clubs={data.clubs}
          sectionTitle={sec('clubs')?.title || undefined}
          sectionSubtitle={sec('clubs')?.subtitle || undefined}
        />
      )}

      {/* ── GALLERY ────────────────────────────── */}
      {vis('gallery') && (
        <GallerySection
          gallery={data.gallery}
          sectionTitle={sec('gallery')?.title || undefined}
          sectionSubtitle={sec('gallery')?.subtitle || undefined}
        />
      )}

      {/* ── PROGRAMS ───────────────────────────── */}
      {vis('programs') && (
        <ProgramsSection
          programs={data.programs}
          sectionTitle={sec('programs')?.title || undefined}
          sectionSubtitle={sec('programs')?.subtitle || undefined}
        />
      )}

      {/* ── CONTACT CTA ────────────────────────── */}
      <ContactSection
        backgroundImagePath={data.heroSlides[3]?.image_path || data.heroSlides[0]?.image_path}
        email={dept['email'] || 'head@cse.kuet.ac.bd'}
      />

      {/* ── FOOTER ─────────────────────────────── */}
      <Footer departmentInfo={dept} socialLinks={socialLinks} navOf={navOf} />
    </div>
  );
};

export default HeroLanding;

// ── Navbar (co-located — only used by HeroLanding) ──

interface NavbarProps {
  scrolled: boolean;
  mobileOpen: boolean;
  onToggleMobile: () => void;
  links: CmsNavigationLink[];
  shortName: string;
}

const Navbar: React.FC<NavbarProps> = ({ scrolled, mobileOpen, onToggleMobile, links, shortName }) => (
  <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
    scrolled
      ? 'bg-[#FDF8F3]/95 backdrop-blur-xl shadow-lg shadow-[#5D4037]/5 border-b border-[#DCC5B2]/50'
      : 'bg-transparent'
  }`}>
    <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16 md:h-20">
      <Link href="/" className="flex items-center gap-3 group">
        <img src="/kuet-logo.png" alt="KUET" className="w-10 h-10 object-contain" />
        <span className={`text-lg font-bold transition-colors ${scrolled ? 'text-[#2C1810]' : 'text-white'}`}>
          {shortName}
        </span>
      </Link>

      <div className="hidden lg:flex items-center gap-1">
        {links.map(l => (
          <Link key={l.id} href={l.url} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            scrolled
              ? 'text-[#6B5744] hover:text-[#2C1810] hover:bg-[#F5EDE4]'
              : 'text-white/80 hover:text-white hover:bg-white/10'
          }`}>{l.label}</Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Link href="/auth/signin" className={`hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
          scrolled
            ? 'bg-[#5D4037] text-white hover:bg-[#4E342E]'
            : 'bg-white/15 backdrop-blur-md text-white border border-white/25 hover:bg-white/25'
        }`}>
          Sign In <ArrowRight className="w-4 h-4" />
        </Link>
        <button onClick={onToggleMobile} className={`lg:hidden p-2 rounded-lg ${scrolled ? 'text-[#2C1810]' : 'text-white'}`}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
    </div>

    <AnimatePresence>
      {mobileOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          className="lg:hidden bg-[#FDF8F3]/98 backdrop-blur-xl border-t border-[#DCC5B2]/50">
          <div className="px-4 py-4 space-y-1">
            {links.map(l => (
              <Link key={l.id} href={l.url} onClick={onToggleMobile}
                className="block px-4 py-3 text-[#2C1810] font-medium rounded-lg hover:bg-[#F5EDE4]">{l.label}</Link>
            ))}
            <Link href="/auth/signin" onClick={onToggleMobile}
              className="block px-4 py-3 text-white font-semibold bg-[#5D4037] rounded-lg text-center mt-2">Sign In</Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </nav>
);