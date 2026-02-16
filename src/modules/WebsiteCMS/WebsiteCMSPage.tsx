'use client';

import { cmsSupabase, getImageUrl } from '@/services/cmsService';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle, Check, ChevronDown, Edit2, ExternalLink,
    Eye, EyeOff, Globe, GraduationCap, Image, Layout,
    Loader2, MessageSquare, Microscope, Navigation, Newspaper,
    Plus, Save, Search, Settings, Trash2, Trophy,
    Users, X
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

/* ═══════════════════════════════════════════════
   CMS Table configurations — maps each CMS table
   to metadata used for the admin UI
   ═══════════════════════════════════════════════ */

interface CmsTableConfig {
  key: string;
  label: string;
  table: string;
  icon: React.ElementType;
  description: string;
  columns: ColumnConfig[];
}

interface ColumnConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'image' | 'json' | 'datetime' | 'url';
  required?: boolean;
  editable?: boolean;
  options?: string[];
  placeholder?: string;
  width?: string;
}

const CMS_TABLES: CmsTableConfig[] = [
  {
    key: 'hero_slides', label: 'Hero Slides', table: 'cms_hero_slides', icon: Image,
    description: 'Manage the hero carousel images and call-to-action buttons on the landing page.',
    columns: [
      { key: 'image_path', label: 'Image', type: 'text', required: true, editable: true, placeholder: 'e.g. 1.jpeg' },
      { key: 'title', label: 'Title', type: 'text', editable: true, placeholder: 'Slide title' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', editable: true, placeholder: 'Slide subtitle' },
      { key: 'cta_text', label: 'CTA Text', type: 'text', editable: true, placeholder: 'Learn More' },
      { key: 'cta_link', label: 'CTA Link', type: 'url', editable: true, placeholder: '/about' },
      { key: 'display_order', label: 'Order', type: 'number', required: true, editable: true },
      { key: 'is_active', label: 'Active', type: 'boolean', editable: true },
    ],
  },
  {
    key: 'department_info', label: 'Department Info', table: 'cms_department_info', icon: Settings,
    description: 'Key-value pairs for department name, address, email, phone, social links, etc.',
    columns: [
      { key: 'key', label: 'Key', type: 'text', required: true, editable: true, placeholder: 'e.g. department_name' },
      { key: 'value', label: 'Value', type: 'textarea', editable: true, placeholder: 'Value' },
      { key: 'value_type', label: 'Type', type: 'select', editable: true, options: ['string', 'url', 'email', 'phone', 'html'] },
    ],
  },
  {
    key: 'hod_message', label: 'HOD Message', table: 'cms_hod_message', icon: MessageSquare,
    description: 'Head of Department details, photo, and welcome message.',
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true, editable: true },
      { key: 'designation', label: 'Designation', type: 'text', required: true, editable: true },
      { key: 'photo_path', label: 'Photo', type: 'text', editable: true, placeholder: 'e.g. hod.jpeg' },
      { key: 'message', label: 'Message', type: 'textarea', required: true, editable: true },
      { key: 'tenure_start', label: 'Tenure Start', type: 'datetime', editable: true },
      { key: 'tenure_end', label: 'Tenure End', type: 'datetime', editable: true },
      { key: 'is_active', label: 'Active', type: 'boolean', editable: true },
    ],
  },
  {
    key: 'stats', label: 'Statistics', table: 'cms_stats', icon: Trophy,
    description: 'Counters displayed on the landing page (students, faculty, alumni, etc.).',
    columns: [
      { key: 'label', label: 'Label', type: 'text', required: true, editable: true, placeholder: 'e.g. Students' },
      { key: 'value', label: 'Value', type: 'text', required: true, editable: true, placeholder: 'e.g. 1200+' },
      { key: 'icon', label: 'Icon', type: 'text', editable: true, placeholder: 'e.g. users' },
      { key: 'display_order', label: 'Order', type: 'number', editable: true },
      { key: 'is_active', label: 'Active', type: 'boolean', editable: true },
    ],
  },
  {
    key: 'news_events', label: 'News & Events', table: 'cms_news_events', icon: Newspaper,
    description: 'News articles, events, and activities displayed on the landing page.',
    columns: [
      { key: 'title', label: 'Title', type: 'text', required: true, editable: true },
      { key: 'slug', label: 'Slug', type: 'text', editable: true },
      { key: 'excerpt', label: 'Excerpt', type: 'textarea', editable: true },
      { key: 'body', label: 'Body', type: 'textarea', editable: true },
      { key: 'image_path', label: 'Image', type: 'text', editable: true },
      { key: 'category', label: 'Category', type: 'select', required: true, editable: true, options: ['NEWS', 'EVENT', 'ACTIVITY'] },
      { key: 'is_featured', label: 'Featured', type: 'boolean', editable: true },
      { key: 'published_at', label: 'Published', type: 'datetime', editable: true },
    ],
  },
  {
    key: 'research', label: 'Research', table: 'cms_research_highlights', icon: Microscope,
    description: 'Research highlights, publications, and grants.',
    columns: [
      { key: 'title', label: 'Title', type: 'text', required: true, editable: true },
      { key: 'description', label: 'Description', type: 'textarea', editable: true },
      { key: 'image_path', label: 'Image', type: 'text', editable: true },
      { key: 'category', label: 'Category', type: 'select', required: true, editable: true, options: ['PUBLICATION', 'JOURNAL', 'CONFERENCE', 'UGC_PROJECT', 'GRANT'] },
      { key: 'external_link', label: 'Link', type: 'url', editable: true },
      { key: 'display_order', label: 'Order', type: 'number', editable: true },
      { key: 'is_active', label: 'Active', type: 'boolean', editable: true },
    ],
  },
  {
    key: 'labs', label: 'Labs & Facilities', table: 'cms_lab_facilities', icon: Settings,
    description: 'Computer labs, research labs, and other department facilities.',
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true, editable: true },
      { key: 'description', label: 'Description', type: 'textarea', editable: true },
      { key: 'image_path', label: 'Image', type: 'text', editable: true },
      { key: 'room_number', label: 'Room', type: 'text', editable: true },
      { key: 'equipment', label: 'Equipment', type: 'json', editable: true, placeholder: '["item1","item2"]' },
      { key: 'display_order', label: 'Order', type: 'number', editable: true },
      { key: 'is_active', label: 'Active', type: 'boolean', editable: true },
    ],
  },
  {
    key: 'clubs', label: 'Clubs & Activities', table: 'cms_clubs_activities', icon: Users,
    description: 'Student clubs, organizations, and extracurricular activities.',
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true, editable: true },
      { key: 'description', label: 'Description', type: 'textarea', editable: true },
      { key: 'logo_path', label: 'Logo', type: 'text', editable: true },
      { key: 'external_link', label: 'Link', type: 'url', editable: true },
      { key: 'display_order', label: 'Order', type: 'number', editable: true },
      { key: 'is_active', label: 'Active', type: 'boolean', editable: true },
    ],
  },
  {
    key: 'gallery', label: 'Gallery', table: 'cms_gallery', icon: Image,
    description: 'Photo gallery images for campus, events, and labs.',
    columns: [
      { key: 'image_path', label: 'Image', type: 'text', required: true, editable: true },
      { key: 'caption', label: 'Caption', type: 'text', editable: true },
      { key: 'category', label: 'Category', type: 'select', required: true, editable: true, options: ['CAMPUS', 'EVENT', 'LAB', 'GENERAL'] },
      { key: 'display_order', label: 'Order', type: 'number', editable: true },
      { key: 'is_active', label: 'Active', type: 'boolean', editable: true },
    ],
  },
  {
    key: 'navigation', label: 'Navigation Links', table: 'cms_navigation_links', icon: Navigation,
    description: 'Navigation menu items and quick-link URLs.',
    columns: [
      { key: 'label', label: 'Label', type: 'text', required: true, editable: true },
      { key: 'url', label: 'URL', type: 'url', required: true, editable: true },
      { key: 'section', label: 'Section', type: 'text', editable: true, placeholder: 'e.g. navbar, footer, quick-links' },
      { key: 'icon', label: 'Icon', type: 'text', editable: true },
      { key: 'display_order', label: 'Order', type: 'number', editable: true },
      { key: 'is_active', label: 'Active', type: 'boolean', editable: true },
    ],
  },
  {
    key: 'sections', label: 'Page Sections', table: 'cms_page_sections', icon: Layout,
    description: 'Toggle visibility and ordering of landing page sections.',
    columns: [
      { key: 'section_key', label: 'Section Key', type: 'text', required: true, editable: true },
      { key: 'title', label: 'Title', type: 'text', editable: true },
      { key: 'subtitle', label: 'Subtitle', type: 'text', editable: true },
      { key: 'is_visible', label: 'Visible', type: 'boolean', editable: true },
      { key: 'display_order', label: 'Order', type: 'number', editable: true },
    ],
  },
  {
    key: 'programs', label: 'Programs', table: 'cms_programs', icon: GraduationCap,
    description: 'Academic programs — undergraduate, postgraduate, PhD.',
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true, editable: true },
      { key: 'short_name', label: 'Short Name', type: 'text', editable: true },
      { key: 'degree_type', label: 'Degree', type: 'select', required: true, editable: true, options: ['UNDERGRADUATE', 'POSTGRADUATE', 'PHD'] },
      { key: 'description', label: 'Description', type: 'textarea', editable: true },
      { key: 'duration', label: 'Duration', type: 'text', editable: true, placeholder: 'e.g. 4 years' },
      { key: 'total_credits', label: 'Credits', type: 'number', editable: true },
      { key: 'is_active', label: 'Active', type: 'boolean', editable: true },
      { key: 'display_order', label: 'Order', type: 'number', editable: true },
    ],
  },
];

/* ═══════════════════════════════════════════════
   Main CMS Admin Page Component
   ═══════════════════════════════════════════════ */

export default function WebsiteCMSPage() {
  const [activeTab, setActiveTab] = useState(CMS_TABLES[0].key);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [tabDropdownOpen, setTabDropdownOpen] = useState(false);

  const activeConfig = CMS_TABLES.find(t => t.key === activeTab)!;

  // ── Show toast notification ──
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Fetch rows for the active table ──
  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await cmsSupabase
        .from(activeConfig.table)
        .select('*')
        .order('created_at' in (rows[0] || {}) ? 'created_at' : 'updated_at', { ascending: false });

      if (error) throw error;
      setRows(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
      // Fallback: try ordering by id
      try {
        const { data } = await cmsSupabase.from(activeConfig.table).select('*');
        setRows(data || []);
      } catch {
        showToast('error', 'Failed to fetch data');
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConfig.table, showToast]);

  useEffect(() => {
    fetchRows();
    setEditingRow(null);
    setIsCreating(false);
    setSearchQuery('');
  }, [fetchRows]);

  // ── Create new record ──
  const handleCreate = async (formData: Record<string, unknown>) => {
    setSaving(true);
    try {
      // Clean up: remove id field for new records
      const cleaned = { ...formData };
      delete cleaned.id;
      delete cleaned.created_at;
      delete cleaned.updated_at;

      const { error } = await cmsSupabase.from(activeConfig.table).insert(cleaned);
      if (error) throw error;
      showToast('success', 'Record created successfully');
      setIsCreating(false);
      setEditingRow(null);
      fetchRows();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create record';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ── Update existing record ──
  const handleUpdate = async (formData: Record<string, unknown>) => {
    setSaving(true);
    try {
      const id = formData.id as string;
      const cleaned = { ...formData };
      delete cleaned.id;
      delete cleaned.created_at;
      delete cleaned.updated_at;

      const { error } = await cmsSupabase.from(activeConfig.table).update(cleaned).eq('id', id);
      if (error) throw error;
      showToast('success', 'Record updated successfully');
      setEditingRow(null);
      fetchRows();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update record';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete record ──
  const handleDelete = async (id: string) => {
    try {
      const { error } = await cmsSupabase.from(activeConfig.table).delete().eq('id', id);
      if (error) throw error;
      showToast('success', 'Record deleted');
      setDeleteConfirm(null);
      fetchRows();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete record';
      showToast('error', message);
    }
  };

  // ── Toggle boolean field directly ──
  const handleToggle = async (id: string, field: string, currentValue: boolean) => {
    try {
      const { error } = await cmsSupabase
        .from(activeConfig.table)
        .update({ [field]: !currentValue })
        .eq('id', id);
      if (error) throw error;
      setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: !currentValue } : r)));
    } catch {
      showToast('error', 'Failed to toggle');
    }
  };

  // ── Filter rows by search ──
  const filteredRows = rows.filter(row => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some(v =>
      v != null && String(v).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-green-500/90 text-white'
                : 'bg-red-500/90 text-white'
            }`}
          >
            {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="bg-white dark:bg-[#161a1d] rounded-2xl shadow-sm border border-[#DCC5B2] dark:border-[#161a1d] p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-[#D4A574]/20 rounded-xl flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#D4A574]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#2C1810] dark:text-white">Website CMS</h1>
            <p className="text-sm text-[#6B5744] dark:text-[#b1a7a6]">
              Manage all landing page content — images, text, sections, and more.
            </p>
          </div>
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="bg-white dark:bg-[#161a1d] rounded-2xl shadow-sm border border-[#DCC5B2] dark:border-[#161a1d] p-2">
        {/* Desktop tabs */}
        <div className="hidden lg:flex flex-wrap gap-1">
          {CMS_TABLES.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#D4A574] text-[#2C1810] shadow-sm'
                    : 'text-[#6B5744] dark:text-[#b1a7a6] hover:bg-[#D4A574]/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        {/* Mobile dropdown */}
        <div className="lg:hidden relative">
          <button
            onClick={() => setTabDropdownOpen(!tabDropdownOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-[#D4A574]/10 text-[#2C1810] dark:text-white"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {React.createElement(activeConfig.icon, { className: 'w-4 h-4' })}
              {activeConfig.label}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${tabDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {tabDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-[#161a1d] border border-[#DCC5B2] dark:border-[#161a1d] rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {CMS_TABLES.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => { setActiveTab(t.key); setTabDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-[#D4A574]/10 ${
                      activeTab === t.key ? 'text-[#D4A574] font-medium' : 'text-[#6B5744] dark:text-[#b1a7a6]'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Table content area ── */}
      <div className="bg-white dark:bg-[#161a1d] rounded-2xl shadow-sm border border-[#DCC5B2] dark:border-[#161a1d] overflow-hidden">
        {/* Sub-header: description + actions */}
        <div className="p-4 border-b border-[#DCC5B2]/50 dark:border-[#161a1d]/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#2C1810] dark:text-white flex items-center gap-2">
                {React.createElement(activeConfig.icon, { className: 'w-5 h-5 text-[#D4A574]' })}
                {activeConfig.label}
                <span className="text-xs font-normal text-[#8B7355] dark:text-[#b1a7a6]/70 ml-2">
                  {filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''}
                </span>
              </h2>
              <p className="text-xs text-[#8B7355] dark:text-[#b1a7a6] mt-0.5">{activeConfig.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search…"
                  className="pl-9 pr-3 py-2 text-sm bg-[#FAF7F3] dark:bg-[#0b090a] border border-[#DCC5B2] dark:border-[#161a1d] rounded-lg text-[#2C1810] dark:text-[#f5f3f4] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/40 w-48"
                />
              </div>
              {/* Add new */}
              <button
                onClick={() => {
                  const blank: Record<string, unknown> = {};
                  activeConfig.columns.forEach(c => {
                    if (c.type === 'boolean') blank[c.key] = true;
                    else if (c.type === 'number') blank[c.key] = 0;
                    else if (c.type === 'json') blank[c.key] = [];
                    else blank[c.key] = '';
                  });
                  setEditingRow(blank);
                  setIsCreating(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#D4A574] text-[#2C1810] text-sm font-medium rounded-lg hover:bg-[#C4956A] transition-colors"
              >
                <Plus className="w-4 h-4" /> Add New
              </button>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#D4A574] animate-spin" />
            <span className="ml-2 text-sm text-[#8B7355]">Loading {activeConfig.label}…</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-[#D4A574]/10 rounded-full flex items-center justify-center mb-3">
              {React.createElement(activeConfig.icon, { className: 'w-7 h-7 text-[#D4A574]/50' })}
            </div>
            <p className="text-sm text-[#8B7355]">
              {searchQuery ? 'No matching records found.' : `No ${activeConfig.label.toLowerCase()} yet.`}
            </p>
            {!searchQuery && (
              <button
                onClick={() => {
                  const blank: Record<string, unknown> = {};
                  activeConfig.columns.forEach(c => {
                    if (c.type === 'boolean') blank[c.key] = true;
                    else if (c.type === 'number') blank[c.key] = 0;
                    else if (c.type === 'json') blank[c.key] = [];
                    else blank[c.key] = '';
                  });
                  setEditingRow(blank);
                  setIsCreating(true);
                }}
                className="mt-3 text-sm text-[#D4A574] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Create first record
              </button>
            )}
          </div>
        ) : (
          /* ── Data table ── */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAF7F3] dark:bg-[#0b090a]">
                  {activeConfig.columns.map(col => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left text-xs font-semibold text-[#6B5744] dark:text-[#b1a7a6] uppercase tracking-wide"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#6B5744] dark:text-[#b1a7a6] uppercase tracking-wide w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCC5B2]/30 dark:divide-[#161a1d]/30">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id as string}
                    className="hover:bg-[#FAF7F3]/60 dark:hover:bg-[#0b090a]/40 transition-colors"
                  >
                    {activeConfig.columns.map(col => (
                      <td key={col.key} className="px-4 py-3 text-[#2C1810] dark:text-[#f5f3f4] max-w-[200px]">
                        {renderCellValue(row, col, (id, field, val) => handleToggle(id, field, val), setImagePreview)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingRow({ ...row }); setIsCreating(false); }}
                          className="p-1.5 text-[#6B5744] dark:text-[#b1a7a6]/70 hover:text-[#D4A574] hover:bg-[#D4A574]/10 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deleteConfirm === (row.id as string) ? (
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleDelete(row.id as string)}
                              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md text-xs font-bold"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="p-1.5 text-[#6B5744] hover:bg-[#6B5744]/10 rounded-md"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(row.id as string)}
                            className="p-1.5 text-[#6B5744] dark:text-[#b1a7a6]/70 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit / Create Modal ── */}
      <AnimatePresence>
        {editingRow && (
          <EditModal
            row={editingRow}
            columns={activeConfig.columns}
            isCreating={isCreating}
            saving={saving}
            tableLabel={activeConfig.label}
            onSave={(data) => isCreating ? handleCreate(data) : handleUpdate(data)}
            onClose={() => { setEditingRow(null); setIsCreating(false); }}
          />
        )}
      </AnimatePresence>

      {/* ── Image preview modal ── */}
      <AnimatePresence>
        {imagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setImagePreview(null)}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={e => e.stopPropagation()}
              className="relative max-w-3xl max-h-[80vh]"
            >
              <button
                onClick={() => setImagePreview(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white dark:bg-[#161a1d] rounded-full flex items-center justify-center shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
              <img src={imagePreview} alt="Preview" className="max-w-full max-h-[80vh] rounded-lg object-contain" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation overlay ── */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="sr-only" aria-live="polite">
            Confirm deletion — click the checkmark to delete or X to cancel.
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Cell value renderer
   ═══════════════════════════════════════════════ */

function renderCellValue(
  row: Record<string, unknown>,
  col: ColumnConfig,
  onToggle: (id: string, field: string, val: boolean) => void,
  onImagePreview: (url: string) => void,
) {
  const val = row[col.key];

  if (col.type === 'boolean') {
    return (
      <button
        onClick={() => onToggle(row.id as string, col.key, val as boolean)}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
          val
            ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
            : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
        }`}
      >
        {val ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        {val ? 'Yes' : 'No'}
      </button>
    );
  }

  if (col.type === 'image' || (col.key.includes('image') || col.key.includes('photo') || col.key.includes('logo'))) {
    if (!val) return <span className="text-[#8B7355]/50 text-xs">—</span>;
    const url = getImageUrl(val as string);
    return (
      <button onClick={() => onImagePreview(url)} className="group relative">
        <img src={url} alt="" className="w-10 h-10 rounded-md object-cover border border-[#DCC5B2]/50" />
        <div className="absolute inset-0 bg-black/30 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Eye className="w-3.5 h-3.5 text-white" />
        </div>
      </button>
    );
  }

  if (col.type === 'url') {
    if (!val) return <span className="text-[#8B7355]/50 text-xs">—</span>;
    return (
      <a
        href={val as string}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#D4A574] hover:underline text-xs flex items-center gap-1 truncate max-w-[150px]"
      >
        <ExternalLink className="w-3 h-3 shrink-0" />
        <span className="truncate">{val as string}</span>
      </a>
    );
  }

  if (col.type === 'json') {
    if (!val) return <span className="text-[#8B7355]/50 text-xs">—</span>;
    const arr = Array.isArray(val) ? val : [];
    return (
      <div className="flex flex-wrap gap-1 max-w-[200px]">
        {arr.slice(0, 3).map((item: string, i: number) => (
          <span key={i} className="px-1.5 py-0.5 bg-[#D4A574]/10 text-[#6B5744] dark:text-[#D4A574] rounded text-xs">
            {item}
          </span>
        ))}
        {arr.length > 3 && <span className="text-xs text-[#8B7355]">+{arr.length - 3}</span>}
      </div>
    );
  }

  if (col.type === 'select') {
    return (
      <span className="inline-block px-2 py-0.5 bg-[#D4A574]/10 text-[#6B5744] dark:text-[#D4A574] rounded text-xs font-medium">
        {val as string || '—'}
      </span>
    );
  }

  if (col.type === 'datetime') {
    if (!val) return <span className="text-[#8B7355]/50 text-xs">—</span>;
    try {
      return <span className="text-xs">{new Date(val as string).toLocaleDateString()}</span>;
    } catch {
      return <span className="text-xs">{val as string}</span>;
    }
  }

  if (col.type === 'textarea') {
    const text = (val as string) || '';
    return <span className="text-xs truncate block max-w-[200px]" title={text}>{text.slice(0, 80)}{text.length > 80 ? '…' : ''}</span>;
  }

  // Default: text / number
  if (val == null || val === '') return <span className="text-[#8B7355]/50 text-xs">—</span>;
  return <span className="text-xs truncate block max-w-[200px]">{String(val)}</span>;
}

/* ═══════════════════════════════════════════════
   Edit / Create Modal
   ═══════════════════════════════════════════════ */

function EditModal({
  row,
  columns,
  isCreating,
  saving,
  tableLabel,
  onSave,
  onClose,
}: {
  row: Record<string, unknown>;
  columns: ColumnConfig[];
  isCreating: boolean;
  saving: boolean;
  tableLabel: string;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({ ...row });

  const handleFieldChange = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-40 bg-black/50 flex items-start justify-center pt-10 sm:pt-20 p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-[#161a1d] w-full max-w-lg rounded-2xl shadow-2xl border border-[#DCC5B2] dark:border-[#161a1d] overflow-hidden"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DCC5B2]/50 dark:border-[#161a1d]/50">
          <h3 className="text-lg font-semibold text-[#2C1810] dark:text-white">
            {isCreating ? `Add ${tableLabel.replace(/s$/, '')}` : `Edit ${tableLabel.replace(/s$/, '')}`}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[#D4A574]/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#6B5744]" />
          </button>
        </div>

        {/* Modal form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {columns.filter(c => c.editable !== false).map(col => (
            <div key={col.key}>
              <label className="block text-xs font-medium text-[#6B5744] dark:text-[#b1a7a6] mb-1">
                {col.label}
                {col.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {renderFormField(col, formData[col.key], (val) => handleFieldChange(col.key, val))}
            </div>
          ))}
        </form>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#DCC5B2]/50 dark:border-[#161a1d]/50 bg-[#FAF7F3]/50 dark:bg-[#0b090a]/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#6B5744] hover:bg-[#DCC5B2]/20 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#D4A574] text-[#2C1810] text-sm font-medium rounded-lg hover:bg-[#C4956A] disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> {isCreating ? 'Create' : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Form field renderer (inside modal)
   ═══════════════════════════════════════════════ */

function renderFormField(
  col: ColumnConfig,
  value: unknown,
  onChange: (val: unknown) => void,
) {
  const baseInputClass =
    'w-full px-3 py-2 text-sm bg-[#FAF7F3] dark:bg-[#0b090a] border border-[#DCC5B2] dark:border-[#161a1d] rounded-lg text-[#2C1810] dark:text-[#f5f3f4] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/40 placeholder:text-[#8B7355]/50';

  switch (col.type) {
    case 'boolean':
      return (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
            value ? 'bg-[#D4A574]' : 'bg-[#DCC5B2]/50 dark:bg-[#161a1d]'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
              value ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      );

    case 'textarea':
      return (
        <textarea
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={col.placeholder}
          rows={4}
          className={`${baseInputClass} resize-y`}
        />
      );

    case 'select':
      return (
        <select
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          className={baseInputClass}
        >
          <option value="">Select…</option>
          {col.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'number':
      return (
        <input
          type="number"
          value={value != null ? Number(value) : ''}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={col.placeholder}
          className={baseInputClass}
        />
      );

    case 'datetime':
      return (
        <input
          type="date"
          value={value ? String(value).split('T')[0] : ''}
          onChange={e => onChange(e.target.value || null)}
          className={baseInputClass}
        />
      );

    case 'json':
      return (
        <textarea
          value={Array.isArray(value) ? JSON.stringify(value, null, 2) : (value as string) || '[]'}
          onChange={e => {
            try { onChange(JSON.parse(e.target.value)); }
            catch { onChange(e.target.value); }
          }}
          placeholder={col.placeholder || '["item1", "item2"]'}
          rows={3}
          className={`${baseInputClass} font-mono text-xs resize-y`}
        />
      );

    case 'image':
    case 'text':
    case 'url':
    default:
      return (
        <div className="relative">
          <input
            type="text"
            value={(value as string) || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={col.placeholder}
            required={col.required}
            className={baseInputClass}
          />
          {/* Image preview */}
          {(col.key.includes('image') || col.key.includes('photo') || col.key.includes('logo')) && typeof value === 'string' && value.length > 0 ? (
            <div className="mt-2">
              <img
                src={getImageUrl(value)}
                alt="Preview"
                className="w-16 h-16 rounded-lg object-cover border border-[#DCC5B2]/50"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          ) : null}
        </div>
      );
  }
}
