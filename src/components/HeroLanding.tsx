'use client';

import LightRays from '@/components/ui/LightRays';
import MatrixGrid from '@/components/ui/MatrixGrid';
import { fetchLandingPageData, getImageUrl } from '@/services/cmsService';
import type { CmsNavigationLink, CmsPageSection, LandingPageData } from '@/types/cms';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import {
    ArrowRight, Award, BookOpen, Building2, Calendar, ChevronRight,
    Clock,
    ExternalLink, Facebook, FileText, FlaskConical, Globe, GraduationCap,
    Heart, Linkedin, Mail, MapPin, Menu, Microscope, Phone, Quote,
    Twitter,
    Users, X, Youtube
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';

// ==========================================
// Icon map — maps DB icon names → Lucide components
// ==========================================
const iconMap: Record<string, React.ElementType> = {
  'graduation-cap': GraduationCap, 'users': Users, 'book-open': BookOpen,
  'flask-conical': FlaskConical, 'globe': Globe, 'file-text': FileText,
  'microscope': Microscope, 'award': Award, 'heart': Heart,
  'building-2': Building2, 'calendar': Calendar, 'facebook': Facebook,
  'linkedin': Linkedin, 'youtube': Youtube, 'twitter': Twitter,
  'mail': Mail, 'phone': Phone, 'map-pin': MapPin, 'clock': Clock,
  'external-link': ExternalLink, 'quote': Quote,
};
const getIcon = (name: string | null): React.ElementType => {
  if (!name) return GraduationCap;
  return iconMap[name] || GraduationCap;
};

// ==========================================
// Scroll‑reveal wrapper
// ==========================================
const Reveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({
  children, className = '', delay = 0,
}) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ==========================================
// Section heading
// ==========================================
const SectionHeading: React.FC<{ title: string; subtitle?: string; light?: boolean }> = ({
  title, subtitle, light,
}) => (
  <div className="text-center mb-12 md:mb-16">
    <h2 className={`text-3xl md:text-4xl lg:text-5xl font-bold mb-4 ${light ? 'text-white' : 'text-[#2C1810]'}`}>
      {title}
    </h2>
    {subtitle && (
      <p className={`text-lg max-w-2xl mx-auto ${light ? 'text-white/70' : 'text-[#6B5744]'}`}>{subtitle}</p>
    )}
    <div className={`mt-5 mx-auto w-16 h-1 rounded-full ${light ? 'bg-[#D4A574]' : 'bg-[#5D4037]'}`} />
  </div>
);

// ==========================================
// Animated counter (for stat values)
// ==========================================
const AnimatedCounter: React.FC<{ value: string }> = ({ value }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const numMatch = value.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1]) : 0;
  const suffix = value.replace(/\d+/, '');
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView || !num) return;
    let curr = 0;
    const step = Math.max(1, Math.floor(num / 60));
    const timer = setInterval(() => {
      curr += step;
      if (curr >= num) { setCount(num); clearInterval(timer); }
      else setCount(curr);
    }, 30);
    return () => clearInterval(timer);
  }, [inView, num]);

  return <span ref={ref}>{inView ? `${count}${suffix}` : value}</span>;
};

// ==========================================
// MAIN COMPONENT
// ==========================================
const HeroLanding: React.FC = () => {
  const router = useRouter();
  const [data, setData] = useState<LandingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  // Fetch CMS data
  useEffect(() => {
    fetchLandingPageData()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Hero auto‑slide
  useEffect(() => {
    if (!data?.heroSlides.length) return;
    const t = setInterval(() => setCurrentSlide(p => (p + 1) % data.heroSlides.length), 6000);
    return () => clearInterval(t);
  }, [data?.heroSlides.length]);

  // Navbar scroll effect
  useEffect(() => {
    const h = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  // ---- loading / error ----
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0A06] flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
          <GraduationCap className="w-12 h-12 text-[#D4A574]" />
        </motion.div>
      </div>
    );
  }
  if (!data) return null;

  // ---- helpers ----
  const sec = (k: string): CmsPageSection | undefined => data.pageSections.find(s => s.section_key === k);
  const vis = (k: string) => sec(k)?.is_visible !== false;
  const navOf = (s: string): CmsNavigationLink[] => data.navLinks.filter(l => l.section === s);
  const navbarLinks = navOf('NAVBAR');
  const quickNavLinks = navOf('QUICK_NAV');
  const socialLinks = navOf('SOCIAL');
  const dept = data.departmentInfo;
  const deptName = dept['department_name'] || 'Department of CSE';
  const uniName = dept['university_name'] || 'KUET';
  const shortName = dept['short_name'] || 'CSE, KUET';

  // ==========================================
  return (
    <div className="min-h-screen bg-[#FDF8F3] overflow-x-hidden">

      {/* ═══════════════════════════════════════
          NAVBAR — transparent → solid on scroll
          ═══════════════════════════════════════ */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          navScrolled
            ? 'bg-[#FDF8F3]/95 backdrop-blur-xl shadow-lg shadow-[#5D4037]/5 border-b border-[#DCC5B2]/50'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              navScrolled ? 'bg-[#5D4037]' : 'bg-white/15 backdrop-blur-md border border-white/20'
            }`}>
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className={`text-lg font-bold transition-colors ${navScrolled ? 'text-[#2C1810]' : 'text-white'}`}>
              {shortName}
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-1">
            {navbarLinks.map(l => (
              <Link key={l.id} href={l.url} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                navScrolled
                  ? 'text-[#6B5744] hover:text-[#2C1810] hover:bg-[#F5EDE4]'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}>{l.label}</Link>
            ))}
          </div>

          {/* Sign In + Mobile */}
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className={`hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              navScrolled
                ? 'bg-[#5D4037] text-white hover:bg-[#4E342E]'
                : 'bg-white/15 backdrop-blur-md text-white border border-white/25 hover:bg-white/25'
            }`}>
              Sign In <ArrowRight className="w-4 h-4" />
            </Link>
            <button onClick={() => setMobileMenu(!mobileMenu)} className={`lg:hidden p-2 rounded-lg ${navScrolled ? 'text-[#2C1810]' : 'text-white'}`}>
              {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileMenu && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-[#FDF8F3]/98 backdrop-blur-xl border-t border-[#DCC5B2]/50">
              <div className="px-4 py-4 space-y-1">
                {navbarLinks.map(l => (
                  <Link key={l.id} href={l.url} onClick={() => setMobileMenu(false)}
                    className="block px-4 py-3 text-[#2C1810] font-medium rounded-lg hover:bg-[#F5EDE4]">{l.label}</Link>
                ))}
                <Link href="/auth/signin" onClick={() => setMobileMenu(false)}
                  className="block px-4 py-3 text-white font-semibold bg-[#5D4037] rounded-lg text-center mt-2">Sign In</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ═══════════════════════════════════════
          HERO CAROUSEL — BRACU‑style overlays
          ═══════════════════════════════════════ */}
      {vis('hero') && data.heroSlides.length > 0 && (
        <section className="relative h-screen overflow-hidden">
          {data.heroSlides.map((slide, i) => (
            <div key={slide.id} className={`absolute inset-0 transition-all duration-[1500ms] ${i === currentSlide ? 'opacity-100' : 'opacity-0'}`}>
              {/* Background image */}
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-[8000ms]"
                style={{
                  backgroundImage: `url(${getImageUrl(slide.image_path)})`,
                  transform: i === currentSlide ? 'scale(1.08)' : 'scale(1)',
                }} />
              {/* ◆ Warm brown / beige tint overlay (BRACU‑style) */}
              <div className="absolute inset-0 bg-[#3E2723]/45" />
              {/* ◆ Top edge gradient — darker */}
              <div className="absolute top-0 inset-x-0 h-[45%] bg-gradient-to-b from-[#1A0F08]/85 via-[#1A0F08]/30 to-transparent" />
              {/* ◆ Bottom edge gradient — darker */}
              <div className="absolute bottom-0 inset-x-0 h-[55%] bg-gradient-to-t from-[#0F0A06] via-[#0F0A06]/60 to-transparent" />
              {/* ◆ Side vignette */}
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(15,10,6,0.55) 100%)' }} />
            </div>
          ))}

          {/* LightRays */}
          <div className="absolute inset-0 z-[2] opacity-50 pointer-events-none">
            <LightRays raysOrigin="top-center" raysColor="#D4A574" raysSpeed={0.5} lightSpread={0.8}
              rayLength={3.5} followMouse mouseInfluence={0.15} pulsating fadeDistance={1.8} saturation={1.2} />
          </div>

          {/* Content */}
          <div className="relative z-10 h-full flex flex-col justify-center items-center text-center px-6">
            <AnimatePresence mode="wait">
              <motion.div key={currentSlide} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.6 }} className="max-w-4xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
                  <GraduationCap className="w-4 h-4 text-[#D4A574]" />
                  <span className="text-sm text-white/90 font-medium">{uniName}</span>
                </div>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight">
                  {data.heroSlides[currentSlide]?.title}
                </h1>
                <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
                  {data.heroSlides[currentSlide]?.subtitle}
                </p>
                {data.heroSlides[currentSlide]?.cta_text && (
                  <Link href={data.heroSlides[currentSlide]?.cta_link || '#'}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-[#D4A574] text-[#2C1810] font-semibold rounded-full
                      hover:bg-[#C4956A] transition-all hover:shadow-lg hover:shadow-[#D4A574]/30 hover:scale-105 active:scale-95">
                    {data.heroSlides[currentSlide]?.cta_text}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-3">
            {data.heroSlides.map((_, i) => (
              <button key={i} onClick={() => setCurrentSlide(i)}
                className={`h-2 rounded-full transition-all duration-500 ${i === currentSlide ? 'w-10 bg-[#D4A574]' : 'w-2 bg-white/40 hover:bg-white/60'}`} />
            ))}
          </div>

          {/* Scroll indicator */}
          <motion.div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20" animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-1.5">
              <motion.div className="w-1.5 h-2.5 rounded-full bg-[#D4A574]" animate={{ y: [0, 12, 0] }} transition={{ repeat: Infinity, duration: 2 }} />
            </div>
          </motion.div>
        </section>
      )}

      {/* Matrix grid background overlay */}
      <div className="fixed inset-0 z-[1] pointer-events-none">
        <MatrixGrid baseOpacity={0.15} hoverRadius={140} dotColor="rgba(93,64,55,0.08)" glowColor="rgba(212,165,116,0.45)" />
      </div>

      {/* ═══════════════════════════════════════
          HOD MESSAGE — like BRACU founder section
          ═══════════════════════════════════════ */}
      {vis('hod_message') && data.hodMessage && (
        <section className="py-20 md:py-28 bg-[#FDF8F3]">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <Reveal>
              <SectionHeading title={sec('hod_message')?.title || 'Message from the Head'} />
            </Reveal>
            <Reveal delay={0.15}>
              <div className="grid md:grid-cols-5 gap-10 md:gap-16 items-center">
                {/* Photo with warm overlay */}
                <div className="md:col-span-2 relative">
                  <div className="relative overflow-hidden rounded-2xl shadow-warm-lg">
                    <img src={getImageUrl(data.hodMessage.photo_path)} alt={data.hodMessage.name}
                      className="w-full aspect-[3/4] object-cover" />
                    {/* ◆ Subtle warm beige tint */}
                    <div className="absolute inset-0 bg-[#5D4037]/10" />
                    {/* ◆ Vignette border */}
                    <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 60px rgba(93,64,55,0.25)' }} />
                    {/* ◆ Bottom brown gradient */}
                    <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-[#2C1810]/70 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 z-10">
                      <p className="text-white font-bold text-lg">{data.hodMessage.name}</p>
                      <p className="text-white/80 text-sm">{data.hodMessage.designation}</p>
                    </div>
                  </div>
                </div>
                {/* Quote */}
                <div className="md:col-span-3">
                  <Quote className="w-10 h-10 text-[#D4A574] mb-4 opacity-60" />
                  <p className="text-xl md:text-2xl leading-relaxed text-[#2C1810]/90 italic mb-6">
                    &ldquo;{data.hodMessage.message}&rdquo;
                  </p>
                  <div className="w-16 h-0.5 bg-[#D4A574] mb-4" />
                  <p className="font-bold text-[#5D4037]">{data.hodMessage.name}</p>
                  <p className="text-[#8B7355] text-sm">{data.hodMessage.designation}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════
          NOTICES MARQUEE — thin accent bar
          ═══════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════
          STATS — animated counters
          ═══════════════════════════════════════ */}
      {vis('stats') && data.stats.length > 0 && (
        <section className="py-16 bg-[#F5EDE4]">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {data.stats.map((s, i) => {
                const Icon = getIcon(s.icon);
                return (
                  <Reveal key={s.id} delay={i * 0.08}>
                    <div className="text-center group">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-white shadow-warm flex items-center justify-center
                        group-hover:shadow-warm-lg group-hover:scale-110 transition-all duration-300">
                        <Icon className="w-6 h-6 text-[#5D4037]" />
                      </div>
                      <div className="text-3xl md:text-4xl font-bold text-[#5D4037]">
                        <AnimatedCounter value={s.value} />
                      </div>
                      <p className="text-sm text-[#6B5744] mt-1">{s.label}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════
          QUICK NAVIGATION — "Find Your Way"
          ═══════════════════════════════════════ */}
      {vis('quick_nav') && quickNavLinks.length > 0 && (
        <section className="py-20 md:py-28 bg-[#FDF8F3]">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <Reveal>
              <SectionHeading
                title={sec('quick_nav')?.title || 'Find Your Way'}
                subtitle={sec('quick_nav')?.subtitle || 'Explore the paths and opportunities CSE, KUET has to offer'}
              />
            </Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
              {quickNavLinks.map((l, i) => {
                const Icon = getIcon(l.icon);
                return (
                  <Reveal key={l.id} delay={i * 0.08}>
                    <Link href={l.url}
                      className="group flex items-center gap-4 p-5 md:p-6 bg-white rounded-2xl border border-[#E8DDD1]
                        hover:border-[#D4A574] hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300">
                      <div className="w-12 h-12 rounded-xl bg-[#5D4037]/10 flex items-center justify-center flex-shrink-0
                        group-hover:bg-[#5D4037] transition-colors">
                        <Icon className="w-5 h-5 text-[#5D4037] group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#2C1810] group-hover:text-[#5D4037] transition-colors">{l.label}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#D4C8BC] group-hover:text-[#D4A574] transition-colors flex-shrink-0" />
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════
          NEWS & EVENTS
          ═══════════════════════════════════════ */}
      {vis('news') && data.news.length > 0 && (
        <section className="py-20 md:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <Reveal>
              <SectionHeading
                title={sec('news')?.title || 'News & Activities'}
                subtitle={sec('news')?.subtitle || "What's happening at CSE, KUET"}
              />
            </Reveal>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.news.map((n, i) => (
                <Reveal key={n.id} delay={i * 0.1}>
                  <div className={`group bg-[#FFFBF7] rounded-2xl overflow-hidden border border-[#E8DDD1]
                    hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300
                    ${i === 0 ? 'md:col-span-2 lg:col-span-2 md:row-span-2' : ''}`}>
                    {n.image_path && (
                      <div className="relative overflow-hidden">
                        <img src={getImageUrl(n.image_path)} alt={n.title}
                          className={`w-full object-cover transition-transform duration-700 group-hover:scale-110 ${i === 0 ? 'h-64 md:h-80' : 'h-48'}`} />
                        {/* ◆ Beige tint overlay */}
                        <div className="absolute inset-0 bg-[#5D4037]/15 group-hover:bg-[#5D4037]/5 transition-all duration-500" />
                        {/* ◆ Bottom brown gradient edge */}
                        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#2C1810]/60 via-[#2C1810]/20 to-transparent" />
                        <span className="absolute top-3 left-3 px-3 py-1 bg-[#D4A574] text-[#2C1810] text-xs font-bold rounded-full">{n.category}</span>
                      </div>
                    )}
                    <div className="p-5">
                      {n.published_at && (
                        <p className="text-xs text-[#8B7355] mb-2">{new Date(n.published_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      )}
                      <h3 className={`font-bold text-[#2C1810] mb-2 line-clamp-2 group-hover:text-[#5D4037] transition-colors ${i === 0 ? 'text-xl' : 'text-base'}`}>{n.title}</h3>
                      {n.excerpt && <p className="text-[#6B5744] text-sm line-clamp-2">{n.excerpt}</p>}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════
          RESEARCH HIGHLIGHTS
          ═══════════════════════════════════════ */}
      {vis('research') && data.research.length > 0 && (
        <section className="py-20 md:py-28 bg-[#F5EDE4]">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <Reveal>
              <SectionHeading
                title={sec('research')?.title || 'Research in CSE'}
                subtitle={sec('research')?.subtitle || 'Advancing knowledge through innovation'}
              />
            </Reveal>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.research.map((r, i) => (
                <Reveal key={r.id} delay={i * 0.08}>
                  <div className="group bg-white rounded-2xl overflow-hidden border border-[#E8DDD1] hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300">
                    {r.image_path && (
                      <div className="relative overflow-hidden">
                        <img src={getImageUrl(r.image_path)} alt={r.title} className="w-full h-48 object-cover transition-transform duration-700 group-hover:scale-110" />
                        {/* ◆ Brown tint overlay */}
                        <div className="absolute inset-0 bg-[#5D4037]/20 group-hover:bg-[#5D4037]/10 transition-all" />
                        {/* ◆ Bottom gradient edge */}
                        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#2C1810]/70 to-transparent" />
                        <span className="absolute bottom-3 left-3 text-white text-xs font-medium bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">{r.category}</span>
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="font-bold text-[#2C1810] mb-2 line-clamp-2 group-hover:text-[#5D4037]">{r.title}</h3>
                      {r.description && <p className="text-[#6B5744] text-sm line-clamp-3">{r.description}</p>}
                      {r.external_link && (
                        <a href={r.external_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-[#5D4037] hover:text-[#D4A574]">
                          View Paper <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════
          LABS & FACILITIES
          ═══════════════════════════════════════ */}
      {vis('labs') && data.labs.length > 0 && (
        <section className="py-20 md:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <Reveal>
              <SectionHeading
                title={sec('labs')?.title || 'Your Future Starts Here'}
                subtitle={sec('labs')?.subtitle || 'State-of-the-art lab facilities'}
              />
            </Reveal>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.labs.map((l, i) => (
                <Reveal key={l.id} delay={i * 0.08}>
                  <div className="group relative overflow-hidden rounded-2xl h-72 cursor-pointer">
                    <img src={getImageUrl(l.image_path)} alt={l.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    {/* ◆ Beige/brown tint overlay */}
                    <div className="absolute inset-0 bg-[#3E2723]/40 group-hover:bg-[#3E2723]/55 transition-all duration-500" />
                    {/* ◆ Bottom gradient edge */}
                    <div className="absolute bottom-0 inset-x-0 h-2/3 bg-gradient-to-t from-[#1A0F08]/90 via-[#1A0F08]/40 to-transparent" />
                    <div className="absolute bottom-0 inset-x-0 p-5 z-10">
                      <h3 className="text-lg font-bold text-white mb-1">{l.name}</h3>
                      {l.description && <p className="text-white/70 text-sm line-clamp-2">{l.description}</p>}
                      {l.room_number && <p className="text-[#D4A574] text-xs mt-2">Room: {l.room_number}</p>}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════
          CLUBS & ACTIVITIES
          ═══════════════════════════════════════ */}
      {vis('clubs') && data.clubs.length > 0 && (
        <section className="py-20 md:py-28 bg-[#F5EDE4]">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <Reveal>
              <SectionHeading
                title={sec('clubs')?.title || 'Clubs & Activities'}
                subtitle={sec('clubs')?.subtitle || 'Get involved in our vibrant community'}
              />
            </Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {data.clubs.map((c, i) => (
                <Reveal key={c.id} delay={i * 0.08}>
                  <div className="group bg-white rounded-2xl p-6 border border-[#E8DDD1] hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300 text-center">
                    {c.logo_path && (
                      <div className="relative w-16 h-16 mx-auto mb-4 rounded-xl overflow-hidden">
                        <img src={getImageUrl(c.logo_path)} alt={c.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-[#5D4037]/10" />
                      </div>
                    )}
                    <h3 className="font-bold text-[#2C1810] mb-2 group-hover:text-[#5D4037]">{c.name}</h3>
                    {c.description && <p className="text-[#6B5744] text-sm line-clamp-2">{c.description}</p>}
                    {c.external_link && (
                      <a href={c.external_link} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-[#D4A574] hover:text-[#5D4037]">
                        Visit <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════
          GALLERY — dark background for drama
          ═══════════════════════════════════════ */}
      {vis('gallery') && data.gallery.length > 0 && (
        <section className="py-20 md:py-28 bg-[#1A0F08]">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <Reveal>
              <SectionHeading light title={sec('gallery')?.title || 'Gallery'} subtitle={sec('gallery')?.subtitle || 'Life at CSE, KUET in pictures'} />
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.gallery.map((g, i) => (
                <Reveal key={g.id} delay={i * 0.06}>
                  <div className={`group relative overflow-hidden rounded-xl cursor-pointer ${i === 0 || i === 5 ? 'md:col-span-2 md:row-span-2' : ''}`}>
                    <img src={getImageUrl(g.image_path)} alt={g.caption || ''}
                      className={`w-full object-cover transition-transform duration-700 group-hover:scale-110 ${i === 0 || i === 5 ? 'h-64 md:h-full' : 'h-40 md:h-48'}`} />
                    {/* ◆ Warm brown tint — appears on hover */}
                    <div className="absolute inset-0 bg-[#3E2723]/0 group-hover:bg-[#3E2723]/40 transition-all duration-500" />
                    {/* ◆ Bottom gradient edge — always visible */}
                    <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#1A0F08]/70 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                    {/* Caption on hover */}
                    {g.caption && (
                      <div className="absolute bottom-0 inset-x-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-500 z-10">
                        <p className="text-white text-sm font-medium">{g.caption}</p>
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════
          PROGRAMS
          ═══════════════════════════════════════ */}
      {vis('programs') && data.programs.length > 0 && (
        <section className="py-20 md:py-28 bg-[#FDF8F3]">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <Reveal>
              <SectionHeading
                title={sec('programs')?.title || 'Academic Programs'}
                subtitle={sec('programs')?.subtitle || "Comprehensive programs designed for tomorrow's tech leaders"}
              />
            </Reveal>
            <div className="grid md:grid-cols-3 gap-6">
              {data.programs.map((p, i) => (
                <Reveal key={p.id} delay={i * 0.1}>
                  <div className="group bg-white rounded-2xl p-7 border border-[#E8DDD1] hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300">
                    <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full mb-4 ${
                      p.degree_type === 'UNDERGRADUATE' ? 'bg-[#5D4037]/10 text-[#5D4037]'
                        : p.degree_type === 'POSTGRADUATE' ? 'bg-[#8B6914]/10 text-[#8B6914]'
                        : 'bg-[#D4A574]/20 text-[#A87B50]'
                    }`}>{p.degree_type}</span>
                    <h3 className="text-lg font-bold text-[#2C1810] mb-2 group-hover:text-[#5D4037]">{p.short_name || p.name}</h3>
                    {p.description && <p className="text-[#6B5744] text-sm mb-4 line-clamp-3">{p.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-[#8B7355]">
                      {p.duration && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{p.duration}</span>}
                      {p.total_credits && <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{p.total_credits} credits</span>}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════
          CONTACT US — "Have a Query?" section with background image
          ═══════════════════════════════════════ */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        {/* Background image with warm brown overlay */}
        <div className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{ backgroundImage: `url(${getImageUrl(data.heroSlides[3]?.image_path || data.heroSlides[0]?.image_path)})` }} />
        <div className="absolute inset-0 bg-[#3E2723]/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A0F08]/40 via-transparent to-[#1A0F08]/40" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-8 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
              <Mail className="w-4 h-4 text-[#D4A574]" />
              <span className="text-sm text-white/90 font-medium">Get in Touch</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Contact Us or Have a Query?
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
              Whether you have questions about admissions, research collaborations, or academic programs — we&apos;re here to help.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#D4A574] text-[#2C1810] font-semibold rounded-full
                  hover:bg-[#C4956A] transition-all hover:shadow-lg hover:shadow-[#D4A574]/30 hover:scale-105 active:scale-95">
                <Mail className="w-5 h-5" /> Contact Us
              </Link>
              <a href={`mailto:${dept['email'] || 'head@cse.kuet.ac.bd'}`}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 border border-white/25 text-white font-semibold rounded-full
                  hover:bg-white/20 transition-all hover:scale-105 active:scale-95 backdrop-blur-md">
                <Phone className="w-5 h-5" /> Email Directly
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          CTA
          ═══════════════════════════════════════ */}
      {vis('cta') && (
        <section className="py-20 md:py-28 bg-[#FDF8F3]">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <Reveal>
              <div className="relative rounded-3xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#5D4037] via-[#3E2723] to-[#1A0F08]" />
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'g\' width=\'20\' height=\'20\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M 20 0 L 0 0 0 20\' fill=\'none\' stroke=\'white\' stroke-width=\'0.5\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'url(%23g)\'/%3E%3C/svg%3E")' }} />
                <div className="relative z-10 px-8 md:px-16 py-16 md:py-24 text-center">
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                    {sec('cta')?.title || 'Ready to Begin Your Journey?'}
                  </h2>
                  <p className="text-white/70 max-w-xl mx-auto mb-8 text-lg">
                    {sec('cta')?.subtitle || 'Join the CSE KUET community today'}
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Link href="/programs"
                      className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#D4A574] text-[#2C1810] font-semibold rounded-full
                        hover:bg-[#C4956A] transition-all hover:scale-105 active:scale-95">
                      Explore Programs <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link href="/contact"
                      className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 border border-white/25 text-white font-semibold rounded-full
                        hover:bg-white/20 transition-all hover:scale-105 active:scale-95">
                      Contact Us
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════ */}
      <footer className="bg-[#0F0A06] text-white">
        {/* Top CTA strip */}
        <div className="border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#D4A574]" />
              <span className="text-white/80 text-sm">Get in touch: {dept['email'] || 'head@cse.kuet.ac.bd'}</span>
            </div>
            <div className="flex items-center gap-4">
              {socialLinks.map(s => {
                const Icon = getIcon(s.icon);
                return (
                  <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#D4A574] hover:text-[#2C1810] transition-all">
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main footer grid */}
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-14 grid md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#5D4037] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-lg">{shortName}</p>
                <p className="text-white/50 text-xs">{uniName}</p>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-4 max-w-sm">{dept['mission']?.substring(0, 180) || deptName}</p>
            <div className="space-y-2 text-sm text-white/60">
              <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-[#D4A574] mt-0.5 flex-shrink-0" /><span>{dept['address'] || 'KUET, Khulna-9203'}</span></div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#D4A574] flex-shrink-0" /><span>{dept['phone'] || ''}</span></div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#D4A574] flex-shrink-0" /><span>{dept['email'] || ''}</span></div>
            </div>
          </div>

          {/* Link columns */}
          {[
            { title: 'About', links: navOf('FOOTER_ABOUT') },
            { title: 'Academics', links: navOf('FOOTER_ACADEMICS') },
            { title: 'Quick Links', links: navOf('FOOTER_QUICK_LINKS') },
          ].map(col => (
            <div key={col.title}>
              <h3 className="font-bold text-[#D4A574] mb-4 text-sm uppercase tracking-wider">{col.title}</h3>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l.id}>
                    <Link href={l.url} className="text-white/60 hover:text-white text-sm transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-white/40 text-sm">&copy; {new Date().getFullYear()} {deptName}. All rights reserved.</p>
            <div className="flex gap-6 text-sm text-white/40">
              <a href="#" className="hover:text-white/70">Privacy Policy</a>
              <a href="#" className="hover:text-white/70">Terms</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default HeroLanding;
