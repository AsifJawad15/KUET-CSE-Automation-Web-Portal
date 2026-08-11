"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, AlertCircle, HelpCircle } from 'lucide-react';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { DAYS, PERIODS } from './constants';

interface Teacher {
  user_id: string;
  full_name: string;
  teacher_uid: string;
}

interface TeacherAvailabilityManagerProps {
  teachers: Teacher[];
}

type AvailabilityType = 'available' | 'unavailable' | 'preferred' | 'not_preferred';

interface CellState {
  dayOfWeek: number;
  periodNo: number;
  type: AvailabilityType;
  note: string;
}

export default function TeacherAvailabilityManager({ teachers }: TeacherAvailabilityManagerProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [grid, setGrid] = useState<Record<string, CellState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Initialize empty grid for a teacher
  const resetGrid = useCallback(() => {
    const newGrid: Record<string, CellState> = {};
    for (const d of DAYS) {
      for (const p of PERIODS) {
        const key = `${d.value}|${p.id}`;
        newGrid[key] = {
          dayOfWeek: d.value,
          periodNo: p.id,
          type: 'available',
          note: '',
        };
      }
    }
    setGrid(newGrid);
  }, []);

  // Load teacher availability
  useEffect(() => {
    async function load() {
      if (!selectedTeacherId) {
        resetGrid();
        return;
      }
      setLoading(true);
      setMessage(null);
      try {
        const res = await fetch(`/api/routine-generator/teacher-availability?teacher_user_id=${selectedTeacherId}`);
        if (!res.ok) throw new Error('Failed to fetch availability data');
        const data = await res.json();

        const newGrid: Record<string, CellState> = {};
        // Set all to default available first
        for (const d of DAYS) {
          for (const p of PERIODS) {
            const key = `${d.value}|${p.id}`;
            newGrid[key] = {
              dayOfWeek: d.value,
              periodNo: p.id,
              type: 'available',
              note: '',
            };
          }
        }

        // Apply database overrides
        for (const row of data || []) {
          const key = `${row.day_of_week}|${row.start_period}`;
          newGrid[key] = {
            dayOfWeek: row.day_of_week,
            periodNo: row.start_period,
            type: row.availability_type as AvailabilityType,
            note: row.note || '',
          };
        }

        setGrid(newGrid);
      } catch (err: any) {
        setMessage({ text: err.message || 'Failed to load teacher availability', type: 'error' });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedTeacherId, resetGrid]);

  const handleCellClick = (dayValue: number, periodId: number) => {
    const key = `${dayValue}|${periodId}`;
    setGrid((prev) => {
      const copy = { ...prev };
      const current = copy[key]?.type || 'available';
      let nextType: AvailabilityType = 'available';

      if (current === 'available') nextType = 'unavailable';
      else if (current === 'unavailable') nextType = 'preferred';
      else if (current === 'preferred') nextType = 'not_preferred';
      else nextType = 'available';

      copy[key] = {
        ...copy[key],
        type: nextType,
      };
      return copy;
    });
  };

  const handleSave = async () => {
    if (!selectedTeacherId) return;
    setSaving(true);
    setMessage(null);
    try {
      const availabilities = Object.values(grid).map((cell) => ({
        dayOfWeek: cell.dayOfWeek,
        startPeriod: cell.periodNo,
        endPeriod: cell.periodNo,
        availabilityType: cell.type,
        note: cell.note,
      }));

      const res = await fetch('/api/routine-generator/teacher-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherUserId: selectedTeacherId,
          availabilities,
        }),
      });

      if (!res.ok) throw new Error('Failed to save teacher availability');

      setMessage({ text: 'Teacher availability settings updated.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to save settings.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const getCellStyles = (type: AvailabilityType) => {
    switch (type) {
      case 'unavailable':
        return 'bg-red-500/20 border-red-500 hover:bg-red-500/30 text-red-600 dark:text-red-400 font-semibold';
      case 'preferred':
        return 'bg-green-500/20 border-green-500 hover:bg-green-500/30 text-green-600 dark:text-green-400 font-semibold';
      case 'not_preferred':
        return 'bg-amber-500/20 border-amber-500 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold';
      default:
        return 'bg-white dark:bg-[#0b090a] border-gray-200 dark:border-[#3d4951] hover:bg-slate-50 dark:hover:bg-[#3d4951]/20 text-gray-400';
    }
  };

  const getCellLabel = (type: AvailabilityType) => {
    switch (type) {
      case 'unavailable':
        return 'Unavailable';
      case 'preferred':
        return 'Preferred';
      case 'not_preferred':
        return 'Avoid';
      default:
        return 'Free';
    }
  };

  return (
    <div className="space-y-4">
      {/* Selector Card */}
      <SpotlightCard className="p-4 rounded-xl border border-gray-200 dark:border-[#3d4951]" spotlightColor="rgba(217, 162, 153, 0.1)">
        <label className="block max-w-sm">
          <span className="text-xs font-semibold text-gray-700 dark:text-[#d3d3d3] block mb-1.5">Select Faculty Member</span>
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-[#D9A299] focus:ring-2 focus:ring-[#D9A299]/30 dark:border-[#3d4951] dark:bg-[#0b090a] dark:text-white"
          >
            <option value="">-- Choose Teacher --</option>
            {teachers.map((t) => (
              <option key={t.user_id} value={t.user_id}>
                {t.full_name} ({t.teacher_uid})
              </option>
            ))}
          </select>
        </label>
      </SpotlightCard>

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

      {selectedTeacherId ? (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="ml-2 text-sm text-gray-500">Loading availability calendar...</span>
          </div>
        ) : (
          <SpotlightCard className="p-5 rounded-2xl border border-gray-200 dark:border-[#3d4951]">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">Availability Grid</h3>
                <p className="text-[10px] text-gray-400">Click cells to cycle: Free → Unavailable → Preferred → Avoid</p>
              </div>

              {/* Legend */}
              <div className="flex gap-2 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-white border border-gray-300 inline-block" />
                  <span>Free</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-red-500/20 border border-red-500 inline-block" />
                  <span>Unavailable</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-green-500/20 border border-green-500 inline-block" />
                  <span>Preferred</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500 inline-block" />
                  <span>Avoid</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 dark:border-[#3d4951] rounded-lg">
              <table className="w-full border-collapse text-center text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-slate-800 text-white border-b border-gray-200 dark:border-[#3d4951]">
                    <th className="p-2 w-20 sticky left-0 z-10 bg-slate-800">Day</th>
                    {PERIODS.map((p) => (
                      <th key={p.id} className="p-2 text-[10px] min-w-[80px]">
                        <div>P{p.id}</div>
                        <div className="text-[8px] font-normal text-gray-400">{p.start}-{p.end}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((d) => (
                    <tr key={d.value} className="border-b border-gray-100 dark:border-[#3d4951]">
                      <td className="p-2 bg-gray-50 dark:bg-white/[0.02] text-gray-800 dark:text-zinc-300 font-semibold sticky left-0 z-10">
                        {d.label}
                      </td>
                      {PERIODS.map((p) => {
                        const key = `${d.value}|${p.id}`;
                        const cell = grid[key];
                        const type = cell?.type || 'available';

                        return (
                          <td key={p.id} className="p-1">
                            <button
                              onClick={() => handleCellClick(d.value, p.id)}
                              className={`w-full py-2.5 border rounded text-[10px] transition-all outline-none ${getCellStyles(type)}`}
                            >
                              {getCellLabel(type)}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Calendar
              </button>
            </div>
          </SpotlightCard>
        )
      ) : (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-[#3d4951] rounded-xl text-gray-400">
          Please select a faculty member above to configure their availability/preferences.
        </div>
      )}
    </div>
  );
}
