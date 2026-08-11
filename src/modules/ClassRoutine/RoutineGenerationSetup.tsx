"use client";

import React, { useState } from 'react';
import { Loader2, Zap, Settings2 } from 'lucide-react';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { SESSIONS, TERMS, SECTIONS } from './constants';
import { GeneratorOptions } from '@/services/routineGeneratorService';

interface RoutineGenerationSetupProps {
  selectedSession: string;
  selectedTerm: string;
  selectedSection: string;
  onSessionChange: (val: string) => void;
  onTermChange: (val: string) => void;
  onSectionChange: (val: string) => void;
  onGenerate: (options: GeneratorOptions & { theoryRooms: string[]; labRooms: string[] }) => Promise<void>;
  generating: boolean;
  rooms: { room_number: string; room_type: string | null; is_active: boolean }[];
}

export default function RoutineGenerationSetup({
  selectedSession,
  selectedTerm,
  selectedSection,
  onSessionChange,
  onTermChange,
  onSectionChange,
  onGenerate,
  generating,
  rooms,
}: RoutineGenerationSetupProps) {
  const [options, setOptions] = useState<GeneratorOptions>({
    includeExistingSelectedSlots: false,
    respectTeacherAvailability: true,
    respectRoomCapacity: true,
    allowSaturday: false,
  });

  const classroomRooms = React.useMemo(() => rooms.filter(r => r.is_active && r.room_type !== 'lab'), [rooms]);
  const labRooms = React.useMemo(() => rooms.filter(r => r.is_active && r.room_type === 'lab'), [rooms]);

  const [theoryRoomsOption, setTheoryRoomsOption] = useState<string[]>([]);
  const [labRoomsOption, setLabRoomsOption] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
    if (rooms.length > 0 && !initialized) {
      setTheoryRoomsOption(classroomRooms.map(r => r.room_number));
      setLabRoomsOption(labRooms.map(r => r.room_number));
      setInitialized(true);
    }
  }, [rooms, initialized, classroomRooms, labRooms]);

  const handleToggleTheoryRoom = (roomNum: string) => {
    setTheoryRoomsOption(prev => 
      prev.includes(roomNum) ? prev.filter(r => r !== roomNum) : [...prev, roomNum]
    );
  };

  const handleToggleLabRoom = (roomNum: string) => {
    setLabRoomsOption(prev => 
      prev.includes(roomNum) ? prev.filter(r => r !== roomNum) : [...prev, roomNum]
    );
  };

  const handleToggle = (key: keyof GeneratorOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerateClick = () => {
    onGenerate({
      ...options,
      theoryRooms: theoryRoomsOption,
      labRooms: labRoomsOption,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* 1. Academic Selection Filters */}
      <SpotlightCard className="p-4 rounded-xl border border-gray-200 dark:border-[#3d4951] space-y-4" spotlightColor="rgba(217, 162, 153, 0.1)">
        <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Academic Batch Selection</h3>
        
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-semibold text-gray-400 block mb-1">Academic Session</span>
            <select
              value={selectedSession}
              onChange={(e) => onSessionChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-[#D9A299] focus:ring-2 focus:ring-[#D9A299]/30 dark:border-[#3d4951] dark:bg-[#0b090a] dark:text-white"
            >
              {SESSIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold text-gray-400 block mb-1">Year & Term</span>
            <select
              value={selectedTerm}
              onChange={(e) => onTermChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-[#D9A299] focus:ring-2 focus:ring-[#D9A299]/30 dark:border-[#3d4951] dark:bg-[#0b090a] dark:text-white"
            >
              {TERMS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>
      </SpotlightCard>

      {/* 2. Room Selection Checkboxes */}
      <SpotlightCard className="p-4 rounded-xl border border-gray-200 dark:border-[#3d4951] space-y-4" spotlightColor="rgba(217, 162, 153, 0.1)">
        <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Rooms configuration</h3>
        
        <div className="space-y-4 text-[11px] overflow-y-auto max-h-[140px] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#DCC5B2] dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          <div>
            <span className="text-[10px] font-bold text-gray-400 block mb-1">Theory Classrooms</span>
            <div className="flex flex-col gap-1">
              {classroomRooms.map((r) => (
                <label key={r.room_number} className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={theoryRoomsOption.includes(r.room_number)}
                    onChange={() => handleToggleTheoryRoom(r.room_number)}
                    className="rounded text-red-600 focus:ring-red-500 h-3.5 w-3.5 border-gray-300"
                  />
                  <span>{r.room_number}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 block mb-1">Laboratory Rooms</span>
            <div className="flex flex-col gap-1">
              {labRooms.map((r) => (
                <label key={r.room_number} className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={labRoomsOption.includes(r.room_number)}
                    onChange={() => handleToggleLabRoom(r.room_number)}
                    className="rounded text-red-600 focus:ring-red-500 h-3.5 w-3.5 border-gray-300"
                  />
                  <span>{r.room_number}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* 3. Solver Parameters Setup */}
      <SpotlightCard className="p-4 rounded-xl border border-gray-200 dark:border-[#3d4951] space-y-4 lg:col-span-2 flex flex-col justify-between" spotlightColor="rgba(217, 162, 153, 0.1)">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="w-4 h-4 text-[#D9A299] dark:text-[#ba181b]" />
            <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Solver Constraints & Weights</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.respectTeacherAvailability}
                  onChange={() => handleToggle('respectTeacherAvailability')}
                  className="rounded text-red-600 focus:ring-red-500 h-4 w-4 border-gray-300 mt-0.5"
                />
                <div>
                  <span className="font-semibold text-gray-800 dark:text-white block">Respect Teacher Availability</span>
                  <span className="text-[10px] text-gray-400">Do not schedule classes when teachers are unavailable.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.respectRoomCapacity}
                  onChange={() => handleToggle('respectRoomCapacity')}
                  className="rounded text-red-600 focus:ring-red-500 h-4 w-4 border-gray-300 mt-0.5"
                />
                <div>
                  <span className="font-semibold text-gray-800 dark:text-white block">Enforce Room Capacities</span>
                  <span className="text-[10px] text-gray-400">Avoid assigning large classes to rooms that are too small.</span>
                </div>
              </label>
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.allowSaturday}
                  onChange={() => handleToggle('allowSaturday')}
                  className="rounded text-red-600 focus:ring-red-500 h-4 w-4 border-gray-300 mt-0.5"
                />
                <div>
                  <span className="font-semibold text-gray-800 dark:text-white block">Allow Saturday Classes</span>
                  <span className="text-[10px] text-gray-400">Include Saturday in the generated routine schedule.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer opacity-50 cursor-not-allowed">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="rounded text-red-600 focus:ring-red-500 h-4 w-4 border-gray-300 mt-0.5"
                />
                <div>
                  <span className="font-semibold text-gray-800 dark:text-white block">Respect Master Locked Slots</span>
                  <span className="text-[10px] text-gray-400">Always active. Prevents overlaps with other semesters.</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4 pt-2 border-t border-gray-100 dark:border-[#3d4951]/50">
          <button
            onClick={handleGenerateClick}
            disabled={generating}
            className="px-5 py-2.5 bg-gradient-to-r from-[#D9A299] to-[#DCC5B2] dark:from-[#ba181b] dark:to-[#e5383b] text-white rounded-lg hover:shadow-lg hover:shadow-[#D9A299]/25 dark:hover:shadow-red-600/25 transition-all flex items-center gap-2 text-xs font-semibold disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Recommendations...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Smart Generate Routine
              </>
            )}
          </button>
        </div>
      </SpotlightCard>
    </div>
  );
}
