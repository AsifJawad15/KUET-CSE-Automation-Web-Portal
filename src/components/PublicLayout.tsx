'use client';

import { fetchLandingPageData } from '@/services/cmsService';
import type { CmsNavigationLink, LandingPageData } from '@/types/cms';
import { motion } from 'framer-motion';
import {
    ArrowRight, ExternalLink, Facebook, GraduationCap, Linkedin, Mail, MapPin,
    Menu, Phone, Twitter, X, Youtube
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';

const iconMap: Record<string, React.ElementType> = {
  facebook: Facebook, linkedin: Linkedin, youtube: Youtube, twitter: Twitter,
  mail: Mail, phone: Phone, 'map-pin': MapPin, 'external-link': ExternalLink,
};
const getIcon = (name: string | null): React.ElementType => {
  if (!name) return GraduationCap;
  return iconMap[name] || GraduationCap;
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [data, setData] = useState<LandingPageData | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    fetchLandingPageData().then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  if (!data) return <div className="min-h-screen bg-[#FDF8F3]" />;

  const navOf = (s: string): CmsNavigationLink[] => data.navLinks.filter(l => l.section === s);
  const navbarLinks = navOf('NAVBAR');
  const socialLinks = navOf('SOCIAL');
  const dept = data.departmentInfo;
  const shortName = dept['short_name'] || 'CSE, KUET';
  const uniName = dept['university_name'] || 'KUET';
  const deptName = dept['department_name'] || 'Department of CSE';

  return (
    <div className="min-h-screen bg-[#FDF8F3]">
      {/* NAVBAR */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#FDF8F3]/95 backdrop-blur-xl shadow-lg shadow-[#5D4037]/5 border-b border-[#DCC5B2]/50'
          : 'bg-[#2C1810]/90 backdrop-blur-md'
      }`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16 md:h-20">
          <Link href="/" className="flex items-center gap-3 group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              scrolled ? 'bg-[#5D4037]' : 'bg-white/15 backdrop-blur-md border border-white/20'
            }`}>
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className={`text-lg font-bold transition-colors ${scrolled ? 'text-[#2C1810]' : 'text-white'}`}>
              {shortName}
            </span>
          </Link>
          <div className="hidden lg:flex items-center gap-1">
            {navbarLinks.map(l => (
              <Link key={l.id} href={l.url} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                pathname === l.url
                  ? (scrolled ? 'text-[#5D4037] bg-[#F5EDE4] font-bold' : 'text-[#D4A574] bg-white/10 font-bold')
                  : (scrolled ? 'text-[#6B5744] hover:text-[#2C1810] hover:bg-[#F5EDE4]' : 'text-white/80 hover:text-white hover:bg-white/10')
              }`}>{l.label}</Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className={`hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              scrolled ? 'bg-[#5D4037] text-white hover:bg-[#4E342E]' : 'bg-white/15 backdrop-blur-md text-white border border-white/25 hover:bg-white/25'
            }`}>Sign In <ArrowRight className="w-4 h-4" /></Link>
            <button onClick={() => setMobileMenu(!mobileMenu)} className={`lg:hidden p-2 rounded-lg ${scrolled ? 'text-[#2C1810]' : 'text-white'}`}>
              {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-[#FDF8F3]/98 backdrop-blur-xl border-t border-[#DCC5B2]/50">
            <div className="px-4 py-4 space-y-1">
              {navbarLinks.map(l => (
                <Link key={l.id} href={l.url} onClick={() => setMobileMenu(false)}
                  className="block px-4 py-3 text-[#2C1810] font-medium rounded-lg hover:bg-[#F5EDE4]">{l.label}</Link>
              ))}
            </div>
          </motion.div>
        )}
      </nav>

      {/* PAGE CONTENT */}
      <main className="pt-20">{children}</main>

      {/* FOOTER */}
      <footer className="bg-[#0F0A06] text-white">
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
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-14 grid md:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#5D4037] flex items-center justify-center"><GraduationCap className="w-5 h-5 text-white" /></div>
              <div><p className="font-bold text-lg">{shortName}</p><p className="text-white/50 text-xs">{uniName}</p></div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-4 max-w-sm">{dept['mission']?.substring(0, 180) || deptName}</p>
            <div className="space-y-2 text-sm text-white/60">
              <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-[#D4A574] mt-0.5 flex-shrink-0" /><span>{dept['address'] || 'KUET, Khulna-9203'}</span></div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#D4A574] flex-shrink-0" /><span>{dept['phone'] || ''}</span></div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#D4A574] flex-shrink-0" /><span>{dept['email'] || ''}</span></div>
            </div>
          </div>
          {[
            { title: 'About', links: navOf('FOOTER_ABOUT') },
            { title: 'Academics', links: navOf('FOOTER_ACADEMICS') },
            { title: 'Quick Links', links: navOf('FOOTER_QUICK_LINKS') },
          ].map(col => (
            <div key={col.title}>
              <h3 className="font-bold text-[#D4A574] mb-4 text-sm uppercase tracking-wider">{col.title}</h3>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l.id}><Link href={l.url} className="text-white/60 hover:text-white text-sm transition-colors">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-white/40 text-sm">&copy; {new Date().getFullYear()} {deptName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
