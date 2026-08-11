"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, Save, Plus, Trash2, HelpCircle } from 'lucide-react';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { getRequirements, saveRequirements } from '@/services/routineGeneratorService';

interface CourseInfo {
  id: string;
  code: string;
  title: string;
  course_type: string;
  credit: number;
}

interface CourseOffering {
  id: string;
  course_id: string;
  teacher_user_id: string;
  courses: CourseInfo;
}

interface CourseRequirementEditorProps {
  session: string;
  year: number;
  term: number;
  section: string;
  offerings: CourseOffering[];
  rooms: { room_number: string; room_type: string | null }[];
}

export default function CourseRequirementEditor({
  session,
  year,
  term,
  section,
  offerings,
  rooms,
}: CourseRequirementEditorProps) {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Group offerings by course to extract unique courses
  const uniqueCourses = React.useMemo(() => {
    const map = new Map<string, { course: CourseInfo; offeringId: string }>();
    for (const off of offerings) {
      if (off.courses && !map.has(off.course_id)) {
        map.set(off.course_id, { course: off.courses, offeringId: off.id });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.course.code.localeCompare(b.course.code));
  }, [offerings]);

  // Load requirements when selection changes
  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage(null);
      try {
        const data = await getRequirements(session, year, term);

        // Build list of requirements. For any unique course that does not have a requirement,
        // we populate default values.
        const merged = uniqueCourses.map(({ course, offeringId }) => {
          const existing = data.find((r) => r.course_id === course.id);
          const isLab = course.course_type?.toLowerCase() === 'lab' || course.course_type?.toLowerCase() === 'sessional';

          if (existing) {
            return {
              ...existing,
              // Make sure arrays are mapped properly
              lab_groups: existing.lab_groups || [],
              preferred_room_numbers: existing.preferred_room_numbers || [],
            };
          }

          // Fallback default requirement
          return {
            session,
            year,
            term,
            section: null,
            course_id: course.id,
            course_offering_id: offeringId,
            course_type: course.course_type || 'Theory',
            required_theory_slots: isLab ? 0 : Math.ceil(course.credit || 3),
            required_lab_slots: isLab ? 1 : 0,
            lab_duration_periods: 3,
            theory_duration_periods: 1,
            needs_combined_section: false,
            lab_groups: isLab ? ['A1', 'A2'] : [],
            preferred_room_type: isLab ? 'lab' : 'classroom',
            preferred_room_numbers: [],
            priority: 1,
            // Temporary UI field
            course_code: course.code,
            course_title: course.title,
          };
        });

        // Add back code and title info for easy rendering
        const enriched = merged.map((m) => {
          const match = uniqueCourses.find((uc) => uc.course.id === m.course_id);
          return {
            ...m,
            course_code: match?.course.code || m.course_code || 'CSE ???',
            course_title: match?.course.title || m.course_title || 'Unknown Course',
          };
        });

        setRequirements(enriched);
      } catch (err: any) {
        setMessage({ text: err.message || 'Failed to load requirements.', type: 'error' });
      } finally {
        setLoading(false);
      }
    }

    if (uniqueCourses.length > 0) {
      load();
    } else {
      setRequirements([]);
    }
  }, [session, year, term, section, uniqueCourses]);

  const updateField = (index: number, field: string, value: any) => {
    setRequirements((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveRequirements(requirements);
      if (result.success) {
        setMessage({ text: 'Course scheduling requirements saved successfully.', type: 'success' });
      } else {
        throw new Error(result.error || 'Failed to save requirements');
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to save requirements.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="ml-2 text-sm text-gray-500">Loading requirements...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`p-3 rounded-lg border text-sm flex justify-between ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-bold">×</button>
        </div>
      )}

      {requirements.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-300 dark:border-[#3d4951] rounded-xl text-gray-400">
          No courses found for this term selection. Please confirm course allocations first.
        </div>
      ) : (
        <SpotlightCard className="p-0 rounded-2xl overflow-hidden border border-gray-200 dark:border-[#3d4951]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 dark:bg-[#161a1d] text-white border-b border-gray-200 dark:border-[#3d4951]">
                  <th className="p-3">Course Code / Title</th>
                  <th className="p-3 w-28">Type</th>
                  <th className="p-3 w-24">Req. Slots</th>
                  <th className="p-3 w-24">Slot Duration</th>
                  <th className="p-3 w-32">Lab Groups</th>
                  <th className="p-3 w-40">Preferred Rooms</th>
                  <th className="p-3 w-24">Combined?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#3d4951]">
                {requirements.map((req, idx) => {
                  const isLab = req.course_type?.toLowerCase() === 'lab' || req.course_type?.toLowerCase() === 'sessional';
                  return (
                    <tr key={req.course_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 text-gray-700 dark:text-gray-200">
                      <td className="p-3">
                        <div className="font-bold text-gray-900 dark:text-white">{req.course_code}</div>
                        <div className="text-[10px] text-gray-400">{req.course_title}</div>
                      </td>
                      <td className="p-3">
                        <select
                          value={req.course_type}
                          onChange={(e) => updateField(idx, 'course_type', e.target.value)}
                          className="w-full bg-white dark:bg-[#0b090a] border border-gray-200 dark:border-[#3d4951] rounded px-1.5 py-1 text-[11px] outline-none"
                        >
                          <option value="Theory">Theory</option>
                          <option value="Lab">Lab</option>
                          <option value="Sessional">Sessional</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={isLab ? req.required_lab_slots : req.required_theory_slots}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateField(idx, isLab ? 'required_lab_slots' : 'required_theory_slots', val);
                          }}
                          className="w-16 bg-white dark:bg-[#0b090a] border border-gray-200 dark:border-[#3d4951] rounded px-1.5 py-1 text-[11px] outline-none text-center"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={isLab ? req.lab_duration_periods : req.theory_duration_periods}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateField(idx, isLab ? 'lab_duration_periods' : 'theory_duration_periods', val);
                          }}
                          className="w-20 bg-white dark:bg-[#0b090a] border border-gray-200 dark:border-[#3d4951] rounded px-1.5 py-1 text-[11px] outline-none"
                        >
                          {isLab ? (
                            <>
                              <option value="3">3 Periods</option>
                              <option value="4">4 Periods</option>
                            </>
                          ) : (
                            <>
                              <option value="1">1 Period</option>
                              <option value="2">2 Periods</option>
                            </>
                          )}
                        </select>
                      </td>
                      <td className="p-3">
                        {isLab ? (
                          <input
                            type="text"
                            placeholder="e.g. A1,A2"
                            value={req.lab_groups.join(',')}
                            onChange={(e) => {
                              const val = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                              updateField(idx, 'lab_groups', val);
                            }}
                            className="w-full bg-white dark:bg-[#0b090a] border border-gray-200 dark:border-[#3d4951] rounded px-1.5 py-1 text-[11px] outline-none"
                          />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="e.g. 306,308"
                          value={req.preferred_room_numbers.join(',')}
                          onChange={(e) => {
                            const val = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                            updateField(idx, 'preferred_room_numbers', val);
                          }}
                          className="w-full bg-white dark:bg-[#0b090a] border border-gray-200 dark:border-[#3d4951] rounded px-1.5 py-1 text-[11px] outline-none"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={req.needs_combined_section}
                          onChange={(e) => updateField(idx, 'needs_combined_section', e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500 h-3.5 w-3.5 border-gray-300"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-200 dark:border-[#3d4951] flex justify-end gap-2 bg-slate-50/50 dark:bg-white/[0.01]">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Requirements
            </button>
          </div>
        </SpotlightCard>
      )}
    </div>
  );
}
