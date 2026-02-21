// ==========================================
// Shared Footer Component
// Single Responsibility: Renders the site footer
// DRY: Eliminates duplication between HeroLanding and PublicLayout
// ==========================================

'use client';

import type { CmsNavigationLink } from '@/types/cms';
import { GraduationCap, Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import { getIcon } from '@/components/ui/iconMap';

interface FooterProps {
  departmentInfo: Record<string, string>;
  socialLinks: CmsNavigationLink[];
  navOf: (section: string) => CmsNavigationLink[];
}

const Footer: React.FC<FooterProps> = ({ departmentInfo, socialLinks, navOf }) => {
  const dept = departmentInfo;
  const shortName = dept['short_name'] || 'CSE, KUET';
  const uniName = dept['university_name'] || 'KUET';
  const deptName = dept['department_name'] || 'Department of CSE';

  const footerColumns = [
    { title: 'About', links: navOf('FOOTER_ABOUT') },
    { title: 'Academics', links: navOf('FOOTER_ACADEMICS') },
    { title: 'Quick Links', links: navOf('FOOTER_QUICK_LINKS') },
  ];

  return (
    <footer className="bg-[#0b090a] text-white">
      {/* Top CTA strip */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#D4A574]" />
            <span className="text-white/80 text-sm">
              Get in touch: {dept['email'] || 'head@cse.kuet.ac.bd'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {socialLinks.map(s => {
              const Icon = getIcon(s.icon);
              return (
                <a
                  key={s.id}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#D4A574] hover:text-[#2C1810] transition-all"
                >
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
          <p className="text-white/60 text-sm leading-relaxed mb-4 max-w-sm">
            {dept['mission']?.substring(0, 180) || deptName}
          </p>
          <div className="space-y-2 text-sm text-white/60">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#D4A574] mt-0.5 flex-shrink-0" />
              <span>{dept['address'] || 'KUET, Khulna-9203'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#D4A574] flex-shrink-0" />
              <span>{dept['phone'] || ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#D4A574] flex-shrink-0" />
              <span>{dept['email'] || ''}</span>
            </div>
          </div>
        </div>

        {/* Link columns */}
        {footerColumns.map(col => (
          <div key={col.title}>
            <h3 className="font-bold text-[#D4A574] mb-4 text-sm uppercase tracking-wider">
              {col.title}
            </h3>
            <ul className="space-y-2.5">
              {col.links.map(l => (
                <li key={l.id}>
                  <Link
                    href={l.url}
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Copyright */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-white/40 text-sm">
            &copy; {new Date().getFullYear()} {deptName}. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-white/40">
            <a href="#" className="hover:text-white/70">Privacy Policy</a>
            <a href="#" className="hover:text-white/70">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
