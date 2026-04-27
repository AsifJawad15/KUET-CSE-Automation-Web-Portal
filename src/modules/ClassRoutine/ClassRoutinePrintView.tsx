"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DAYS, PERIODS, BREAK_AFTER_PERIOD, TERMS } from './constants';
import { DisplaySlot } from './types';
import {
  formatCombinedTeacherInitials,
  getSlotSpan,
  slotMatchesPeriod,
} from './helpers';

export interface RoutinePrintInfo {
  revision: string;
  classStartingDate: string;
  roomNote: string;
  coordinators: RoutineCoordinator[];
}

export interface RoutineCoordinator {
  user_id: string;
  full_name: string;
  designation: string;
}

interface ClassRoutinePrintViewProps {
  displaySlots: DisplaySlot[];
  selectedTerm: string;
  selectedSession: string;
  selectedSection: string;
  printInfo: RoutinePrintInfo;
}

function formatTime(value: string) {
  const [hourText, minute = '00'] = value.split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${String(normalizedHour).padStart(2, '0')}:${minute} ${suffix}`;
}

function getTeacherUidList(slot: DisplaySlot) {
  return formatCombinedTeacherInitials(slot.teachers).replace(/\s*&\s*/g, ' / ');
}

function getPrintedCourseCode(slot: DisplaySlot) {
  if (slot.course_type?.toLowerCase() === 'theory' && slot.isCombined) {
    return `${slot.course_code}c`;
  }
  return slot.course_code;
}

function shouldPrintTeacherInfo(slot: DisplaySlot) {
  const match = slot.course_code.match(/(\d+)\s*$/);
  if (!match) return true;
  const courseNumber = Number(match[1]);
  return courseNumber % 2 !== 0;
}

function getUniqueTeachers(slots: DisplaySlot[]) {
  const teachers = new Map<string, { name: string; uid: string }>();
  slots.forEach((slot) => {
    slot.teachers.forEach((teacher) => {
      const key = teacher.teacher_uid || teacher.full_name;
      if (!teachers.has(key)) {
        teachers.set(key, { name: teacher.full_name, uid: teacher.teacher_uid });
      }
    });
  });
  return [...teachers.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getUniqueCourses(slots: DisplaySlot[]) {
  const courses = new Map<string, { code: string; title: string }>();
  slots.forEach((slot) => {
    if (!courses.has(slot.course_code)) {
      courses.set(slot.course_code, { code: slot.course_code, title: slot.course_title });
    }
  });
  return [...courses.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export default function ClassRoutinePrintView({
  displaySlots,
  selectedTerm,
  selectedSession,
  selectedSection,
  printInfo,
}: ClassRoutinePrintViewProps) {
  const [mounted, setMounted] = useState(false);
  const termLabel = TERMS.find((term) => term.value === selectedTerm)?.label || selectedTerm;
  const teachers = getUniqueTeachers(displaySlots);
  const courses = getUniqueCourses(displaySlots);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getSlotsForCell = (dayValue: number, period: (typeof PERIODS)[0]) =>
    displaySlots.filter((slot) => slot.day_of_week === dayValue && slotMatchesPeriod(slot, period));

  const isCellCovered = (dayValue: number, periodIndex: number) => {
    for (let i = periodIndex - 1; i >= 0; i--) {
      const slots = getSlotsForCell(dayValue, PERIODS[i]);
      if (slots.length > 0) {
        const maxSpan = Math.max(...slots.map((slot) => getSlotSpan(slot)));
        if (i + maxSpan > periodIndex) return true;
        break;
      }
    }
    return false;
  };

  const printSheet = (
    <div className="routine-print-root">
      <style jsx global>{`
        .routine-print-root {
          display: none;
        }

        @media print {
          html,
          body {
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          body.printing-routine > *:not(.routine-print-root) {
            display: none !important;
          }

          .routine-print-root,
          .routine-print-root * {
            visibility: visible !important;
          }

          .routine-print-root {
            display: block;
            position: fixed;
            inset: 0;
            width: 297mm;
            height: 210mm;
            overflow: hidden;
            background: #fff;
            color: #0f172a;
            font-family: Georgia, "Times New Roman", Times, serif;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .routine-print-page {
            display: flex !important;
            flex-direction: column;
            width: 297mm;
            height: 210mm;
            padding: 3mm;
            overflow: hidden;
            box-sizing: border-box;
            border: 1.4px solid #111827;
            background: #ffffff;
          }

          .routine-print-header {
            border: 1px solid #111827;
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
            padding: 2mm 3mm;
            text-align: center;
            line-height: 1.05;
          }

          .routine-print-header h1 {
            margin: 0;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0;
          }

          .routine-print-header p {
            margin: 1px 0 0;
            font-size: 9px;
          }

          .routine-print-header h2 {
            margin: 3px 0 0;
            font-size: 13px;
            font-weight: 900;
            letter-spacing: 0.03em;
            text-transform: uppercase;
          }

          .routine-print-header h3 {
            margin: 1px 0 0;
            font-size: 11px;
            font-weight: 800;
            text-decoration: underline;
          }

          .routine-print-content {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 23%;
            gap: 3mm;
            flex: 1;
            min-height: 0;
            margin-top: 2mm;
            overflow: hidden;
          }

          .routine-print-main,
          .routine-print-sidebar {
            display: flex;
            flex-direction: column;
            min-width: 0;
            overflow: hidden;
          }

          .routine-print-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1mm;
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            padding: 1mm 1.5mm;
            font-size: 8px;
            font-weight: 700;
          }

          .routine-print-section {
            margin: 0 0 1mm;
            text-align: center;
            font-size: 12px;
            font-weight: 900;
            letter-spacing: 0.03em;
          }

          .routine-print-root table {
            table-layout: fixed;
            width: 100%;
            border-collapse: collapse;
          }

          .routine-print-root th,
          .routine-print-root td {
            border: 0.75px solid #111827 !important;
            box-sizing: border-box;
          }

          .routine-table {
            flex: 1;
            height: 100%;
            font-size: 8px;
            line-height: 1.08;
          }

          .routine-table thead th {
            background: #172133 !important;
            color: #ffffff !important;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }

          .routine-period-row th {
            height: 5mm;
            padding: 0.7mm;
          }

          .routine-time-row th {
            height: 14mm;
            padding: 0.8mm 0.5mm;
          }

          .routine-day-cell {
            width: 14mm;
            background: #f8fafc !important;
            font-size: 8.5px;
            font-weight: 900;
            text-align: left;
            padding-left: 1mm;
          }

          .routine-table tbody tr {
            height: 18%;
          }

          .routine-table tbody td {
            padding: 0.8mm;
            text-align: center;
            vertical-align: middle;
            background: #ffffff;
          }

          .routine-slot {
            display: flex;
            min-height: 7mm;
            flex-direction: column;
            justify-content: center;
            border-radius: 1mm;
            background: #f8fafc;
            padding: 0.8mm 0.5mm;
            font-weight: 900;
          }

          .routine-slot + .routine-slot {
            margin-top: 0.7mm;
          }

          .routine-slot-room {
            margin-top: 0.5mm;
            color: #475569;
            font-size: 6px;
            font-weight: 700;
          }

          .routine-break {
            width: 4.5mm;
            background: #f1f5f9 !important;
            color: #172133 !important;
            font-size: 7px;
            font-weight: 900;
            letter-spacing: 0.08em;
          }

          .routine-room-note {
            margin-top: 1.5mm;
            border: 1px solid #111827;
            background: #f8fafc;
            padding: 1mm 1.5mm;
            font-size: 8px;
            font-weight: 800;
          }

          .routine-print-sidebar {
            display: flex;
            flex-direction: column;
            gap: 2mm;
          }

          .routine-print-block {
            border: 1px solid #111827;
            overflow: hidden;
          }

          .routine-print-block h3 {
            margin: 0;
            border-bottom: 1px solid #111827;
            background: #172133 !important;
            color: #ffffff !important;
            padding: 1mm;
            text-align: center;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.02em;
            text-transform: uppercase;
          }

          .side-table {
            font-size: 7px;
            line-height: 1.08;
          }

          .side-table th {
            background: #e2e8f0 !important;
            font-weight: 900;
            padding: 0.8mm 0.6mm;
            text-transform: uppercase;
          }

          .side-table td {
            padding: 0.65mm 0.7mm;
            vertical-align: middle;
          }

          .routine-print-signatures {
            display: none;
          }

          .routine-signature-band {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8mm;
            flex: 0 0 31mm;
            margin-top: 2mm;
            border: 1px solid #111827;
            background: #f8fafc;
            padding: 4mm 8mm 2.5mm;
            text-align: center;
            font-size: 8px;
            line-height: 1.18;
            overflow: hidden;
          }

          .routine-signature-card {
            min-height: 21mm;
          }

          .routine-signature-card.empty {
            opacity: 0.85;
          }

          .routine-signature-card .signature-line {
            width: 45mm;
            height: 8mm;
            margin: 0 auto 1mm;
            border-bottom: 1.2px solid #111827;
          }

          .routine-signature-card .signature-name {
            font-size: 8.5px;
            font-weight: 900;
          }

          .routine-signature-card .signature-role {
            font-weight: 800;
          }

          .routine-print-signatures-old {
            margin-top: auto;
            border: 1px solid #111827;
            background: #f8fafc;
            padding: 2mm 1.5mm;
            text-align: center;
            font-size: 6.2px;
            line-height: 1.12;
          }

          .signature-item + .signature-item {
            margin-top: 2mm;
          }

          .signature-line {
            width: 33mm;
            height: 5mm;
            margin: 0 auto 0.7mm;
            border-bottom: 1px solid #111827;
          }

          .signature-name {
            font-weight: 900;
          }

          .routine-print-main,
          .routine-print-sidebar,
          .routine-print-block,
          .routine-print-signatures,
          .routine-print-table,
          .routine-print-table tr,
          .routine-print-table tbody,
          .routine-print-table thead {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }

          @page {
            size: A4 landscape;
            margin: 0;
          }
        }
      `}</style>

      <div className="routine-print-page">
        <header className="routine-print-header">
          <h1>Department of Computer Science and Engineering</h1>
          <p>Khulna University of Engineering &amp; Technology</p>
          <p>Khulna 9203</p>
          <h2>Class Routine {printInfo.revision ? `(${printInfo.revision})` : ''}</h2>
          <h3>Class Routine - {termLabel}</h3>
        </header>

        <div className="routine-print-content">
          <section className="routine-print-main">
            <div className="routine-print-meta">
              <span>Session: {selectedSession}</span>
              <span>Class Starting Date: {printInfo.classStartingDate || '........................'}</span>
            </div>

            <h4 className="routine-print-section">SEC - {selectedSection}</h4>

            <table className="routine-print-table routine-table">
              <thead>
                <tr className="routine-period-row">
                  <th className="w-[14mm]">Period</th>
                {PERIODS.map((period) => (
                  <React.Fragment key={period.id}>
                    <th>{period.id}</th>
                    {BREAK_AFTER_PERIOD.includes(period.id) && (
                      <th rowSpan={2} className="routine-break">
                        B<br />R<br />E<br />A<br />K
                      </th>
                    )}
                  </React.Fragment>
                ))}
              </tr>
              <tr className="routine-time-row">
                <th>Day</th>
                {PERIODS.map((period) => (
                  <th key={period.id}>
                    <div>Time</div>
                    <div>{formatTime(period.start)}</div>
                    <div>to</div>
                    <div>{formatTime(period.end)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day.value}>
                  <td className="routine-day-cell">{day.label}</td>
                  {PERIODS.map((period, periodIndex) => {
                    if (isCellCovered(day.value, periodIndex)) {
                      return (
                        <React.Fragment key={`${day.value}-${period.id}-covered`}>
                          {BREAK_AFTER_PERIOD.includes(period.id) && <td />}
                        </React.Fragment>
                      );
                    }

                    const slots = getSlotsForCell(day.value, period);
                    const maxSpan = slots.length ? Math.max(...slots.map((slot) => getSlotSpan(slot))) : 1;

                    return (
                      <React.Fragment key={`${day.value}-${period.id}`}>
                        <td colSpan={maxSpan}>
                          {slots.map((slot) => (
                            <div key={slot.id} className="routine-slot">
                              <div>
                                {getPrintedCourseCode(slot)}
                                {slot.section ? ` (${slot.section})` : ''}
                                {shouldPrintTeacherInfo(slot) ? ` (${getTeacherUidList(slot)})` : ''}
                              </div>
                            </div>
                          ))}
                        </td>
                        {BREAK_AFTER_PERIOD.includes(period.id) && <td />}
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="routine-room-note">
            Room No.: {printInfo.roomNote || 'Theory: 306, Lab: CSE-201, CSE-202, CSE-306'}
          </p>
        </section>

        <aside className="routine-print-sidebar">
          <div className="routine-print-block">
            <h3>List of Teachers</h3>
            <table className="routine-print-table side-table">
              <thead>
                <tr>
                  <th className="w-[10mm]">Sl.</th>
                  <th>Teacher Name</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher, index) => (
                  <tr key={teacher.uid || teacher.name}>
                    <td className="border border-black px-0.5 py-px text-center">{index + 1}.</td>
                    <td className="border border-black px-0.5 py-px">
                      {teacher.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="routine-print-block">
            <h3>List of Courses</h3>
            <table className="routine-print-table side-table">
              <thead>
                <tr>
                  <th className="w-[17mm]">Course No.</th>
                  <th>Course Title</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.code}>
                    <td className="border border-black px-0.5 py-px">{course.code}</td>
                    <td className="border border-black px-0.5 py-px">{course.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="routine-print-signatures">
            {printInfo.coordinators.map((coordinator) => (
                <div key={coordinator.user_id} className="signature-item">
                  <div className="signature-line" />
                  <p className="signature-name">({coordinator.full_name})</p>
                  <p>{coordinator.designation}</p>
                  <p>Undergraduate Course Coordinator</p>
                  <p>Department of Computer Science and Engineering</p>
                  <p>Khulna University of Engineering &amp; Technology</p>
                </div>
              ))}

            <div className="signature-item">
              <div className="signature-line" />
              <p className="signature-name">(Head of the Department)</p>
              <p>Department of Computer Science and Engineering</p>
              <p>Khulna University of Engineering &amp; Technology</p>
            </div>
          </div>
        </aside>
        </div>

        <div className="routine-signature-band">
          {(printInfo.coordinators.length > 0 ? printInfo.coordinators.slice(0, 2) : [null, null]).map((coordinator, index) => (
            <div
              key={coordinator?.user_id || `empty-coordinator-${index}`}
              className={`routine-signature-card ${coordinator ? '' : 'empty'}`}
            >
              <div className="signature-line" />
              <p className="signature-name">
                {coordinator ? `(${coordinator.full_name})` : '(Course Coordinator)'}
              </p>
              {coordinator && <p>{coordinator.designation}</p>}
              <p className="signature-role">Undergraduate Course Coordinator</p>
              <p>Department of Computer Science and Engineering</p>
              <p>Khulna University of Engineering &amp; Technology</p>
            </div>
          ))}

          <div className="routine-signature-card">
            <div className="signature-line" />
            <p className="signature-name">(Head of the Department)</p>
            <p className="signature-role">Head of the Department</p>
            <p>Department of Computer Science and Engineering</p>
            <p>Khulna University of Engineering &amp; Technology</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(printSheet, document.body);
}
