'use client';

import PublicLayout from '@/components/PublicLayout';
import { fetchLandingPageData, getImageUrl } from '@/services/cmsService';
import type { LandingPageData } from '@/types/cms';
import { motion } from 'framer-motion';
import {
    Clock, Facebook, Linkedin, Mail, MapPin, Phone, Send,
    Twitter, Youtube
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

const socialIcons: Record<string, React.ElementType> = {
  facebook: Facebook, linkedin: Linkedin, youtube: Youtube, twitter: Twitter,
};

export default function ContactPage() {
  const [data, setData] = useState<LandingPageData | null>(null);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { fetchLandingPageData().then(setData); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    // Simulate send — can be hooked to an API or mailto
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setSent(false), 4000);
    }, 1200);
  };

  if (!data) return <PublicLayout><div className="min-h-screen" /></PublicLayout>;

  const dept = data.departmentInfo;
  const socialLinks = data.navLinks.filter(l => l.section === 'SOCIAL');

  return (
    <PublicLayout>
      {/* Hero with background image */}
      <section className="relative h-72 md:h-80 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getImageUrl(data.heroSlides[0]?.image_path)})` }} />
        <div className="absolute inset-0 bg-[#3E2723]/65" />
        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#FDF8F3] to-transparent" />
        <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Contact Us</h1>
            <p className="text-white/80 text-lg">Have a query? We&apos;d love to hear from you</p>
          </motion.div>
        </div>
      </section>

      {/* Contact section */}
      <section className="max-w-6xl mx-auto px-6 md:px-8 py-16">
        <div className="grid lg:grid-cols-5 gap-10">

          {/* LEFT — Contact info card */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            className="lg:col-span-2 space-y-6">
            {/* Department code snippet card */}
            <div className="bg-[#1A0F08] rounded-2xl p-6 border border-[#2C1810]/60">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-2 text-white/40 text-xs font-mono">department.cse</span>
              </div>
              <pre className="text-sm font-mono leading-relaxed">
                <span className="text-[#8B7355]">{'1  '}</span>
                <span className="text-[#D4A574] font-bold">const</span>
                <span className="text-white"> department</span>
                <span className="text-[#8B7355]"> = {'{'}</span>{'\n'}
                <span className="text-[#8B7355]">{'2  '}</span>
                <span className="text-white">{'  '}name: </span>
                <span className="text-green-400">&quot;CSE, KUET&quot;</span>
                <span className="text-[#8B7355]">,</span>{'\n'}
                <span className="text-[#8B7355]">{'3  '}</span>
                <span className="text-white">{'  '}focus: </span>
                <span className="text-green-400">&quot;Innovation&quot;</span>
                <span className="text-[#8B7355]">,</span>{'\n'}
                <span className="text-[#8B7355]">{'4  '}</span>
                <span className="text-white">{'  '}status: </span>
                <span className="text-green-400">&quot;Open to queries&quot;</span>{'\n'}
                <span className="text-[#8B7355]">{'5  }'}</span>
              </pre>
            </div>

            {/* Info cards */}
            <div className="bg-white rounded-2xl p-5 border border-[#E8DDD1] shadow-warm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#5D4037]/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-[#5D4037]" />
              </div>
              <div>
                <p className="text-[#8B7355] text-xs uppercase tracking-wider font-semibold">Email</p>
                <p className="text-[#2C1810] font-medium">{dept['email'] || 'head@cse.kuet.ac.bd'}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-[#E8DDD1] shadow-warm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#5D4037]/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-[#5D4037]" />
              </div>
              <div>
                <p className="text-[#8B7355] text-xs uppercase tracking-wider font-semibold">Phone</p>
                <p className="text-[#2C1810] font-medium">{dept['phone'] || '+880-2477-733318'}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-[#E8DDD1] shadow-warm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#5D4037]/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-[#5D4037]" />
              </div>
              <div>
                <p className="text-[#8B7355] text-xs uppercase tracking-wider font-semibold">Location</p>
                <p className="text-[#2C1810] font-medium text-sm">{dept['address'] || 'KUET, Khulna-9203, Bangladesh'}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-[#E8DDD1] shadow-warm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#5D4037]/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-[#5D4037]" />
              </div>
              <div>
                <p className="text-[#8B7355] text-xs uppercase tracking-wider font-semibold">Office Hours</p>
                <p className="text-[#2C1810] font-medium text-sm">Sun – Thu, 8:00 AM – 5:00 PM</p>
              </div>
            </div>

            {/* Social links */}
            {socialLinks.length > 0 && (
              <div>
                <p className="text-[#5D4037] font-bold text-sm mb-3">Follow Us</p>
                <div className="flex gap-3">
                  {socialLinks.map(s => {
                    const Icon = socialIcons[s.icon || ''] || Mail;
                    return (
                      <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                        className="w-11 h-11 rounded-xl bg-[#F5EDE4] flex items-center justify-center text-[#5D4037] hover:bg-[#5D4037] hover:text-white transition-all duration-300">
                        <Icon className="w-5 h-5" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* RIGHT — Contact Form */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 md:p-10 border border-[#E8DDD1] shadow-warm-lg space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-[#2C1810] mb-1">Send us a message</h2>
                <p className="text-[#8B7355] text-sm">Fill out the form and we&apos;ll get back to you shortly.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[#5D4037] text-xs font-bold uppercase tracking-wider mb-2">Your Name</label>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-[#FAF7F3] border-2 border-[#E8DDD1] rounded-xl text-[#2C1810] placeholder-[#B8A898]
                      focus:outline-none focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/20 transition-all" />
                </div>
                <div>
                  <label className="block text-[#5D4037] text-xs font-bold uppercase tracking-wider mb-2">Your Email</label>
                  <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 bg-[#FAF7F3] border-2 border-[#E8DDD1] rounded-xl text-[#2C1810] placeholder-[#B8A898]
                      focus:outline-none focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/20 transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-[#5D4037] text-xs font-bold uppercase tracking-wider mb-2">Subject</label>
                <input type="text" required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder="Academic inquiry, collaboration, etc."
                  className="w-full px-4 py-3 bg-[#FAF7F3] border-2 border-[#E8DDD1] rounded-xl text-[#2C1810] placeholder-[#B8A898]
                    focus:outline-none focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/20 transition-all" />
              </div>

              <div>
                <label className="block text-[#5D4037] text-xs font-bold uppercase tracking-wider mb-2">Message</label>
                <textarea required rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="Your message..."
                  className="w-full px-4 py-3 bg-[#FAF7F3] border-2 border-[#E8DDD1] rounded-xl text-[#2C1810] placeholder-[#B8A898]
                    focus:outline-none focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/20 transition-all resize-none" />
              </div>

              <button type="submit" disabled={sending}
                className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#5D4037] via-[#4E342E] to-[#5D4037]
                  text-white font-semibold rounded-xl hover:from-[#4E342E] hover:to-[#3E2723] transition-all duration-300
                  hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed">
                {sending ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {sending ? 'Sending...' : 'Send Message'}
              </button>

              {sent && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                  ✓ Message sent successfully! We&apos;ll get back to you soon.
                </motion.div>
              )}
            </form>
          </motion.div>
        </div>
      </section>

      {/* Map section */}
      {dept['map_embed_url'] && (
        <section className="max-w-6xl mx-auto px-6 md:px-8 pb-16">
          <div className="rounded-2xl overflow-hidden border border-[#E8DDD1] shadow-warm h-80">
            <iframe src={dept['map_embed_url']} width="100%" height="100%" style={{ border: 0 }}
              allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="KUET Location" />
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
