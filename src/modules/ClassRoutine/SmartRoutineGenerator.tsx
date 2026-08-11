"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Calendar, Users, Sliders, CheckSquare, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { getAllTeachers } from '@/services/teacherService';
import { getAllRooms } from '@/services/roomService';
import {
  generateRoutine,
  getDraftsList,
  getDraftDetails,
  deleteDraft,
  publishDraft,
  GeneratorOptions,
} from '@/services/routineGeneratorService';

import RoutineGenerationSetup from './RoutineGenerationSetup';
import CourseRequirementEditor from './CourseRequirementEditor';
import RoutineDraftCards from './RoutineDraftCards';
import SmartRoutineGrid from './SmartRoutineGrid';
import ConflictSummaryPanel from './ConflictSummaryPanel';
import TeacherAvailabilityManager from './TeacherAvailabilityManager';

export default function SmartRoutineGenerator() {
  const [activeSubTab, setActiveSubTab] = useState<'generate' | 'availability'>('generate');

  // Selected filters
  const [session, setSession] = useState('2023-2024');
  const [term, setTerm] = useState('3-2');
  const [section, setSection] = useState('A');

  // Metadata loaders
  const [teachers, setTeachers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Drafts state
  const [drafts, setDrafts] = useState<any[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<any | null>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [loadingDraftDetails, setLoadingDraftDetails] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load static metadata (teachers, rooms, offerings)
  useEffect(() => {
    async function loadMeta() {
      setLoadingMeta(true);
      try {
        // Fallback fetch wrapper to ensure robustness if services are missing
        const [teachersData, roomsData] = await Promise.all([
          getAllTeachers().catch(() => []),
          getAllRooms().catch(() => []),
        ]);

        // Fetch course offerings matching session/term
        const offeringsRes = await fetch('/api/course-offerings').catch(() => null);
        const offeringsData = offeringsRes?.ok ? await offeringsRes.json() : [];

        setTeachers(teachersData || []);
        setRooms(roomsData || []);
        setOfferings(offeringsData || []);
      } catch (err) {
        console.error('Failed to load generator metadata:', err);
      } finally {
        setLoadingMeta(false);
      }
    }
    loadMeta();
  }, []);

  // Year/Term split helper for filters
  const filterYear = Number(term.split('-')[0]) || 3;
  const filterTerm = Number(term.split('-')[1]) || 2;

  // Filter offerings based on target batch
  const filteredOfferings = offerings.filter((o) => {
    // offerings contain string term like "3-2"
    return o.term === term && o.session === session;
  });

  // Load drafts list for selected batch
  const loadDraftsList = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const list = await getDraftsList(session, filterYear, filterTerm, section);
      setDrafts(list || []);
      if (list && list.length > 0) {
        // Auto-select first draft if none selected
        if (!selectedDraftId || !list.some((d) => d.id === selectedDraftId)) {
          setSelectedDraftId(list[0].id);
        }
      } else {
        setSelectedDraftId(null);
        setSelectedDraft(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDrafts(false);
    }
  }, [session, filterYear, filterTerm, section, selectedDraftId]);

  useEffect(() => {
    loadDraftsList();
  }, [session, term, section, loadDraftsList]);

  // Load selected draft details (slots)
  useEffect(() => {
    async function loadDetails() {
      if (!selectedDraftId) {
        setSelectedDraft(null);
        return;
      }
      setLoadingDraftDetails(true);
      try {
        const res = await getDraftDetails(selectedDraftId);
        if (res.success && res.data) {
          setSelectedDraft(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDraftDetails(false);
      }
    }
    loadDetails();
  }, [selectedDraftId]);

  // Trigger solver routine generation
  const handleGenerate = async (options: GeneratorOptions) => {
    setGenerating(true);
    setPublishMessage(null);
    try {
      const res = await generateRoutine(session, filterYear, filterTerm, section, 5, options);
      if (res.success && res.data?.success !== false) {
        setSelectedDraftId(null); // Clear selected to force reload first recommendation
        await loadDraftsList();
      } else {
        alert(res.data?.message || res.error || 'Solver failed to find a valid routine configuration.');
      }
    } catch (err: any) {
      alert(err.message || 'Generation request failed.');
    } finally {
      setGenerating(false);
    }
  };

  // Delete draft
  const handleDeleteDraft = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this routine draft?')) return;
    try {
      const res = await deleteDraft(id);
      if (res.success) {
        if (selectedDraftId === id) {
          setSelectedDraftId(null);
          setSelectedDraft(null);
        }
        await loadDraftsList();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Publish routine
  const handlePublish = async () => {
    if (!selectedDraftId) return;
    if (selectedDraft?.hard_conflict_count > 0) {
      alert('Cannot publish this routine because it contains hard conflicts.');
      return;
    }
    if (!window.confirm('This will write the routine slots into the main timetable grid. Proceed?')) return;

    setPublishing(true);
    setPublishMessage(null);
    try {
      const res = await publishDraft(selectedDraftId, true);
      if (res.success) {
        setPublishMessage({
          text: `Routine successfully published! ${res.data?.publishedSlotsCount || 0} slots written to the main routine planner.`,
          type: 'success',
        });
        setSelectedDraftId(null);
        setSelectedDraft(null);
        await loadDraftsList();
      } else {
        throw new Error(res.error || 'Failed to publish');
      }
    } catch (err: any) {
      setPublishMessage({ text: err.message || 'Failed to publish routine draft.', type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  // Build locked slots (mock or from locked listings)
  // We extract rooms currently busy for other sections
  const otherLockedSlots = React.useMemo(() => {
    if (!selectedDraft || !selectedDraft.slots) return [];
    
    // Filter slots for other sections
    const otherSlots = selectedDraft.slots.filter((s: any) => s.section !== section);
    
    // Map to LockedSlot display format
    return otherSlots.map((s: any) => {
      const teacherName = s.course_offerings?.teachers?.full_name || 'Teacher';
      const courseCode = s.course_offerings?.courses?.code || 'Course';
      return {
        id: s.id,
        courseCode: `${courseCode} (${s.section || 'Other'})`,
        teacherUserId: s.teacher_user_id,
        teacherName: teacherName,
        roomNumber: s.room_number,
        dayOfWeek: s.day_of_week,
        startPeriod: s.start_period,
        endPeriod: s.end_period,
        section: s.section,
        startTime: s.start_time?.substring(0, 5),
        endTime: s.end_time?.substring(0, 5),
      };
    });
  }, [selectedDraft, section]);

  if (loadingMeta) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <span className="ml-3 text-sm text-gray-500 font-medium">Initializing smart constraints parser...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs header */}
      <div className="border-b border-gray-200 dark:border-[#3d4951] flex gap-4">
        <button
          onClick={() => setActiveSubTab('generate')}
          className={`pb-2.5 text-xs font-bold transition-all border-b-2 outline-none flex items-center gap-1.5 ${
            activeSubTab === 'generate'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Setup & Generate
        </button>
        <button
          onClick={() => setActiveSubTab('availability')}
          className={`pb-2.5 text-xs font-bold transition-all border-b-2 outline-none flex items-center gap-1.5 ${
            activeSubTab === 'availability'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Users className="w-4 h-4" />
          Faculty Availability
        </button>
      </div>

      {activeSubTab === 'availability' ? (
        <TeacherAvailabilityManager teachers={teachers} />
      ) : (
        <div className="space-y-6">
          {/* Setup / parameters config card */}
          <RoutineGenerationSetup
            selectedSession={session}
            selectedTerm={term}
            selectedSection={section}
            onSessionChange={setSession}
            onTermChange={setTerm}
            onSectionChange={setSection}
            onGenerate={handleGenerate}
            generating={generating}
            rooms={rooms}
          />

          {/* Tabular view splits requirements and schedule draft previews */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
            {/* Left 3 cols: requirements config or generated grid */}
            <div className="xl:col-span-3 space-y-6">
              {/* Course Requirements Configuration */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">
                    Course Schedule Requirements & Constraints
                  </h3>
                </div>
                <CourseRequirementEditor
                  session={session}
                  year={filterYear}
                  term={filterTerm}
                  section={section}
                  offerings={filteredOfferings}
                  rooms={rooms}
                />
              </div>

              {/* Generated Recommendations Drafts Preview Grid */}
              {loadingDrafts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="ml-2 text-xs text-gray-500">Checking recommended draft archives...</span>
                </div>
              ) : drafts.length > 0 ? (
                <div className="space-y-6">
                  {/* Draft Selection Cards */}
                  <RoutineDraftCards
                    drafts={drafts}
                    selectedDraftId={selectedDraftId}
                    onSelectDraft={setSelectedDraftId}
                    onDeleteDraft={handleDeleteDraft}
                  />

                  {/* Recommendation Timetable Grid */}
                  {selectedDraftId && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center flex-wrap gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                          <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">
                            Schedule Preview: {selectedDraft?.draft_name || 'Selected Draft'}
                          </h3>
                          <div className="flex bg-slate-100 dark:bg-[#0b090a] rounded-lg p-0.5 border border-gray-200/50 dark:border-[#3d4951]/50 text-[11px]">
                            <button
                              onClick={() => setSection('A')}
                              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                                section === 'A'
                                  ? 'bg-white dark:bg-[#161a1d] text-indigo-600 dark:text-indigo-400 shadow-sm'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              Section A
                            </button>
                            <button
                              onClick={() => setSection('B')}
                              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                                section === 'B'
                                  ? 'bg-white dark:bg-[#161a1d] text-indigo-600 dark:text-indigo-400 shadow-sm'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              Section B
                            </button>
                          </div>
                        </div>
                        {selectedDraft && (
                          <div className="flex gap-2">
                            <button
                              disabled={publishing || selectedDraft.hard_conflict_count > 0}
                              onClick={handlePublish}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-green-600/10"
                            >
                              {publishing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckSquare className="w-3.5 h-3.5" />
                              )}
                              Publish Schedule
                            </button>
                          </div>
                        )}
                      </div>

                      {publishMessage && (
                        <div
                          className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
                            publishMessage.type === 'success'
                              ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'
                              : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                          }`}
                        >
                          {publishMessage.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span>{publishMessage.text}</span>
                        </div>
                      )}

                      {loadingDraftDetails ? (
                        <div className="flex items-center justify-center py-16">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                          <span className="ml-2 text-xs text-gray-500">Mapping routine matrix...</span>
                        </div>
                      ) : (
                        selectedDraft && (
                          <SmartRoutineGrid
                            draftId={selectedDraft.id}
                            draftSlots={(selectedDraft.slots || []).filter((s: any) => s.section === section)}
                            lockedSlots={otherLockedSlots}
                            rooms={rooms}
                            onRefresh={async () => {
                              // Reload details
                              const res = await getDraftDetails(selectedDraft.id);
                              if (res.success && res.data) {
                                setSelectedDraft(res.data);
                              }
                              // Reload list to sync score/warnings
                              await loadDraftsList();
                            }}
                            onSelectSlot={() => {}}
                          />
                        )
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-gray-300 dark:border-[#3d4951] rounded-xl text-gray-400">
                  No routine drafts generated yet for this academic selection. Set options and click &quot;Smart Generate Routine&quot; above to create recommendations.
                </div>
              )}
            </div>

            {/* Right 1 col: Diagnostics summary details */}
            <div className="xl:col-span-1">
              {selectedDraft ? (
                <ConflictSummaryPanel
                  draftName={selectedDraft.draft_name}
                  score={selectedDraft.score}
                  hardConflictCount={selectedDraft.hard_conflict_count}
                  softWarningCount={selectedDraft.soft_warning_count}
                  summary={selectedDraft.summary}
                  slots={selectedDraft.slots || []}
                />
              ) : (
                <SpotlightCard className="p-4 rounded-xl border border-gray-200 dark:border-[#3d4951] text-center text-gray-400 text-xs py-12">
                  Select or generate a draft recommendation to run routine validation analytics.
                </SpotlightCard>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
