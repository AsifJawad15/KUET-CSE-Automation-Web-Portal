/**
 * Reusable PDF generator for KUET CSE Automation system.
 * Uses jsPDF + jspdf-autotable for all report types.
 *
 * Usage:
 *   import { downloadAttendancePDF, downloadTablePDF } from '@/lib/pdfGenerator';
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Shared brand colours (RGB) ────────────────────────────────────────────
const BRAND = {
  headerBg: [44, 24, 16] as [number, number, number],       // #2C1810
  headerText: [255, 255, 255] as [number, number, number],
  subHeaderBg: [245, 237, 228] as [number, number, number],  // #F5EDE4
  subHeaderText: [93, 64, 55] as [number, number, number],   // #5D4037
  rowAlt: [250, 247, 243] as [number, number, number],       // #FAF7F3
  rowText: [44, 24, 16] as [number, number, number],
  border: [220, 197, 178] as [number, number, number],       // #DCC5B2
  present: [5, 150, 105] as [number, number, number],        // emerald-600
  absent: [220, 38, 38] as [number, number, number],         // red-600
  late: [217, 119, 6] as [number, number, number],           // amber-600
  muted: [139, 115, 85] as [number, number, number],         // #8B7355
};

// ─── KUET/CSE letterhead ───────────────────────────────────────────────────
function drawKUETHeader(doc: jsPDF, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.subHeaderText);
  doc.text('DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING', pageW / 2, y, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BRAND.muted);
  doc.text('Khulna University of Engineering & Technology', pageW / 2, y + 5, { align: 'center' });

  return y + 5;
}

// ─── Attendance PDF ────────────────────────────────────────────────────────
export interface AttendancePDFOptions {
  courseCode: string;
  courseTitle: string;
  term: string;
  session?: string;
  courseType: string;
  sectionLabel: string;
  dates: string[];
  rows: {
    roll: string;
    name: string;
    statuses: Record<string, string>;
  }[];
}

export function downloadAttendancePDF(opts: AttendancePDFOptions): void {
  const {
    courseCode, courseTitle, term, session,
    courseType, sectionLabel, dates, rows,
  } = opts;

  // Landscape for wide tables (many dates), portrait otherwise
  const orientation: 'l' | 'p' = dates.length > 10 ? 'l' : 'p';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // ── Letterhead ──
  let y = 15;
  y = drawKUETHeader(doc, y);

  // ── Title ──
  y += 7;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.headerBg);
  doc.text(`Attendance Sheet \u2014 ${term}`, pageW / 2, y, { align: 'center' });

  // ── Meta row ──
  y += 7;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BRAND.rowText);
  doc.text(`Subject Code: ${courseCode}`, margin, y);
  doc.text(`Subject Name: ${courseTitle}`, pageW - margin, y, { align: 'right' });

  y += 5;
  doc.text(`Session: ${session ?? '\u2014'}`, margin, y);
  doc.text(`Type: ${courseType}`, pageW - margin, y, { align: 'right' });

  // ── Section label ──
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.subHeaderText);
  doc.text(`Section / Group: ${sectionLabel}`, margin, y);

  // ── Build table columns ──
  const dateHeaders = dates.map(d => {
    const dt = new Date(d.slice(0, 10) + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  });

  const head = [['SL No.', 'Class Roll No.', 'Name', ...dateHeaders]];

  const body = rows.map((row, i) => {
    const dateCells = dates.map(d => {
      const s = row.statuses[d];
      if (!s) return '';
      return s === 'present' ? 'P' : s === 'absent' ? 'A' : 'L';
    });
    return [String(i + 1), row.roll, row.name, ...dateCells];
  });

  // ── Summary row ──
  const totalClasses = dates.length;
  const summaryRow = ['', '', `Total: ${totalClasses} class${totalClasses !== 1 ? 'es' : ''}`,
    ...dates.map(() => '')];

  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    head,
    body: [...body, summaryRow],
    theme: 'grid',
    headStyles: {
      fillColor: BRAND.headerBg,
      textColor: BRAND.headerText,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      lineColor: BRAND.border,
      lineWidth: 0.3,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: BRAND.rowText,
      lineColor: BRAND.border,
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: BRAND.rowAlt,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },      // SL
      1: { halign: 'center', cellWidth: 22 },      // Roll
      2: { halign: 'left', cellWidth: 'auto' },    // Name
      // date columns: narrow, centered
      ...Object.fromEntries(
        dates.map((_, di) => [di + 3, { halign: 'center' as const, cellWidth: 10 }])
      ),
    },
    didParseCell(data) {
      // Colour P / A / L cells
      if (data.section === 'body' && data.column.index >= 3) {
        const val = String(data.cell.raw ?? '');
        if (val === 'P') {
          data.cell.styles.textColor = BRAND.present;
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'A') {
          data.cell.styles.textColor = BRAND.absent;
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'L') {
          data.cell.styles.textColor = BRAND.late;
          data.cell.styles.fontStyle = 'bold';
        }
      }
      // Summary row styling
      const lastRow = body.length;
      if (data.section === 'body' && data.row.index === lastRow) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = BRAND.subHeaderBg;
        data.cell.styles.textColor = BRAND.subHeaderText;
      }
    },
  });

  // ── Footer on each page ──
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.muted);
    const pageH = doc.internal.pageSize.getHeight();
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}   \u2022   Page ${p} of ${totalPages}`,
      pageW / 2, pageH - 8, { align: 'center' }
    );
  }

  const safeTitle = courseCode.replace(/\s+/g, '_');
  const safeSection = sectionLabel.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Attendance_${safeTitle}_${safeSection}.pdf`);
}

// ─── Generic Table PDF ─────────────────────────────────────────────────────
// Reuse this for any other page (marks, results, room booking, etc.)
export interface TablePDFOptions {
  title: string;
  subtitle?: string;
  metaLeft?: string[];
  metaRight?: string[];
  columns: string[];
  rows: (string | number)[][];
  orientation?: 'p' | 'l';
  filename?: string;
}

export function downloadTablePDF(opts: TablePDFOptions): void {
  const {
    title, subtitle, metaLeft = [], metaRight = [],
    columns, rows, orientation = 'p', filename = 'report',
  } = opts;

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  let y = 15;
  y = drawKUETHeader(doc, y);

  // Title
  y += 7;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.headerBg);
  doc.text(title, pageW / 2, y, { align: 'center' });

  if (subtitle) {
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.muted);
    doc.text(subtitle, pageW / 2, y, { align: 'center' });
  }

  // Meta rows
  const maxMeta = Math.max(metaLeft.length, metaRight.length);
  for (let i = 0; i < maxMeta; i++) {
    y += 5;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.rowText);
    if (metaLeft[i]) doc.text(metaLeft[i], margin, y);
    if (metaRight[i]) doc.text(metaRight[i], pageW - margin, y, { align: 'right' });
  }

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [columns],
    body: rows.map(r => r.map(String)),
    theme: 'grid',
    headStyles: {
      fillColor: BRAND.headerBg,
      textColor: BRAND.headerText,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      lineColor: BRAND.border,
      lineWidth: 0.3,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: BRAND.rowText,
      lineColor: BRAND.border,
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: BRAND.rowAlt,
    },
  });

  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.muted);
    const pageH = doc.internal.pageSize.getHeight();
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}   \u2022   Page ${p} of ${totalPages}`,
      pageW / 2, pageH - 8, { align: 'center' }
    );
  }

  doc.save(`${filename.replace(/\s+/g, '_')}.pdf`);
}
