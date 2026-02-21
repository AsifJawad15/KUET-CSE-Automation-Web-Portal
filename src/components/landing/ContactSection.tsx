// ==========================================
// Contact CTA Section
// Single Responsibility: Renders "Have a Query?" contact call-to-action
// ==========================================

'use client';

import Reveal from '@/components/ui/Reveal';
import { getImageUrl } from '@/services/cmsService';
import { Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

interface ContactSectionProps {
  backgroundImagePath: string | null | undefined;
  email: string;
}

const ContactSection: React.FC<ContactSectionProps> = ({ backgroundImagePath, email }) => (
  <section className="relative py-20 md:py-28 overflow-hidden">
    {/* Background */}
    <div
      className="absolute inset-0 bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${getImageUrl(backgroundImagePath)})` }}
    />
    <div className="absolute inset-0 bg-[#3E2723]/70" />
    <div className="absolute inset-0 bg-gradient-to-b from-[#161a1d]/40 via-transparent to-[#161a1d]/40" />

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
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#D4A574] text-[#2C1810] font-semibold rounded-full
              hover:bg-[#C4956A] transition-all hover:shadow-lg hover:shadow-[#D4A574]/30 hover:scale-105 active:scale-95"
          >
            <Mail className="w-5 h-5" /> Contact Us
          </Link>
          <a
            href={`mailto:${email}`}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 border border-white/25 text-white font-semibold rounded-full
              hover:bg-white/20 transition-all hover:scale-105 active:scale-95 backdrop-blur-md"
          >
            <Phone className="w-5 h-5" /> Email Directly
          </a>
        </div>
      </Reveal>
    </div>
  </section>
);

export default ContactSection;
