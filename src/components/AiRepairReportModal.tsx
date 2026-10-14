import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  FileText,
  Download,
  Save,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Package,
  ShieldCheck,
  Loader2,
  Calendar,
  User,
} from 'lucide-react';
import jsPDF from 'jspdf';
import type { RepairReportRecord, BookingRecord, LanguageCode, UserRole } from '../types';

interface AiRepairReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingRecord;
  userRole: UserRole;
  workerName?: string;
  token?: string | null;
  lang?: LanguageCode;
  t?: Record<string, string>;
  onReportSaved?: (report: RepairReportRecord) => void;
}

export const AiRepairReportModal: React.FC<AiRepairReportModalProps> = ({
  isOpen,
  onClose,
  booking,
  userRole,
  workerName,
  token,
  lang = 'en',
  t = {},
  onReportSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<RepairReportRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit mode for worker
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editWorkPerformed, setEditWorkPerformed] = useState('');
  const [editOutstandingIssues, setEditOutstandingIssues] = useState('');
  const [editMaintenanceSuggestions, setEditMaintenanceSuggestions] = useState<string[]>([]);
  const [editCustomerSummary, setEditCustomerSummary] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchOrGenerateReport = async () => {
      setLoading(true);
      setError(null);
      setSaveSuccess(false);

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // 1. Try to get existing report first
        const getRes = await fetch(`/api/ai/repair-report/${booking.id}`, { headers });
        if (getRes.ok) {
          const existingData = await getRes.json();
          if (existingData.report && isMounted) {
            setReport(existingData.report);
            populateEditState(existingData.report);
            setLoading(false);
            return;
          }
        }

        // 2. If worker and no existing report, generate new one using real job data
        if (userRole === 'WORKER' || userRole === 'ADMIN') {
          const postRes = await fetch('/api/ai/repair-report', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              bookingId: booking.id,
              bookingReference: booking.bookingReference,
              customerComplaint: booking.problemDescription || 'Standard service request',
              workerFieldNotes: booking.additionalInstructions ? [booking.additionalInstructions] : [],
              completedChecklistItems: booking.requiredSkills || [],
              confirmedParts: booking.priceRevision?.approved
                ? [
                    {
                      partName: booking.priceRevision.materialsDescription || 'Approved Spares',
                      quantity: 1,
                      costInr: booking.priceRevision.additionalMaterialsInr,
                      confirmedByCustomer: true,
                    },
                  ]
                : [],
              customerApprovedChanges: booking.priceRevision?.approved
                ? `Approved price revision: +₹${booking.priceRevision.additionalMaterialsInr} for ${booking.priceRevision.materialsDescription}`
                : undefined,
              jobStatusHistory: [
                `Created at ${booking.createdAt || booking.preferredDate}`,
                `Accepted by technician`,
                `Status: ${booking.status}`,
              ],
            }),
          });

          if (postRes.ok) {
            const newReport: RepairReportRecord = await postRes.json();
            if (isMounted) {
              setReport(newReport);
              populateEditState(newReport);
            }
          } else {
            const err = await postRes.json().catch(() => ({}));
            if (isMounted) setError(err.error || 'Failed to generate report.');
          }
        } else {
          // Customer viewing, but not generated yet
          if (isMounted) {
            setError(
              lang === 'bn'
                ? 'কর্মী এখনো কাজের চূড়ান্ত রিপোর্ট সম্পন্ন ও সংরক্ষণ করেননি।'
                : lang === 'hi'
                ? 'तकनीशियन ने अभी तक अंतिम सेवा रिपोर्ट तैयार और स्वीकृत नहीं की है।'
                : 'Technician has not finalized the repair report yet.'
            );
          }
        }
      } catch {
        if (isMounted) setError('Network error loading service report.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrGenerateReport();

    return () => {
      isMounted = false;
    };
  }, [isOpen, booking, userRole, token, lang]);

  const populateEditState = (rep: RepairReportRecord) => {
    setEditTitle(rep.reportTitle);
    setEditWorkPerformed(rep.workPerformed.join('\n'));
    setEditOutstandingIssues(rep.outstandingIssues || '');
    setEditMaintenanceSuggestions([...(rep.preventiveMaintenanceSuggestions || [])]);
    setEditCustomerSummary(rep.customerSummary);
  };

  if (!isOpen) return null;

  const handleSaveReport = async () => {
    if (!report) return;
    setSavingReport(true);
    setError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/ai/repair-report/${report.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          reportTitle: editTitle,
          workPerformed: editWorkPerformed
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          outstandingIssues: editOutstandingIssues || null,
          preventiveMaintenanceSuggestions: editMaintenanceSuggestions,
          customerSummary: editCustomerSummary,
          workerApproved: true,
        }),
      });

      if (res.ok) {
        const updated: RepairReportRecord = await res.json();
        setReport(updated);
        setIsEditing(false);
        setSaveSuccess(true);
        if (onReportSaved) onReportSaved(updated);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to save report.');
      }
    } catch {
      setError('Network error saving report.');
    } finally {
      setSavingReport(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!report) return;

    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      let y = 20;

      // Header Banner
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(15, 118, 110); // Teal
      doc.text('HELP NEST COOPERATIVE SOCIETY', 14, y);
      y += 7;

      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('Official Verified Service & Repair Report', 14, y);
      y += 10;

      // Meta Box
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Booking Reference: ${booking.bookingReference}`, 14, y);
      doc.text(`Date: ${new Date(report.createdAt).toLocaleDateString()}`, 120, y);
      y += 5;
      doc.text(`Service Trade: ${booking.workerCategory}`, 14, y);
      doc.text(`Customer: ${booking.customerName}`, 120, y);
      y += 5;
      doc.text(`Technician: ${booking.workerName || workerName || 'Coop Assigned'}`, 14, y);
      doc.text(`Status: ${report.workerApproved ? 'Approved & Signed' : 'Draft'}`, 120, y);
      y += 10;

      // Horizontal Rule
      doc.setDrawColor(203, 213, 225);
      doc.line(14, y, 196, y);
      y += 7;

      // Section: Original Problem
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('1. Reported Defect / Customer Complaint', 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const probLines = doc.splitTextToSize(report.originalReportedProblem, 180);
      doc.text(probLines, 14, y);
      y += probLines.length * 5 + 5;

      // Section: Work Performed
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('2. Work Performed On-Site', 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      report.workPerformed.forEach((step) => {
        const stepLines = doc.splitTextToSize(`• ${step}`, 180);
        doc.text(stepLines, 14, y);
        y += stepLines.length * 5;
      });
      y += 5;

      // Section: Parts Used
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('3. Confirmed Materials & Spare Parts', 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      if (report.partsUsed && report.partsUsed.length > 0) {
        report.partsUsed.forEach((part) => {
          doc.text(`• ${part.partName} (Qty: ${part.quantity}) — ₹${part.costInr}`, 14, y);
          y += 5;
        });
      } else {
        doc.text('• No new parts used (Labor & diagnostic service only).', 14, y);
        y += 5;
      }
      y += 5;

      // Section: Customer Summary
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('4. Customer Summary & Result', 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const sumLines = doc.splitTextToSize(report.customerSummary, 180);
      doc.text(sumLines, 14, y);
      y += sumLines.length * 5 + 5;

      // Section: Preventive Maintenance
      if (report.preventiveMaintenanceSuggestions && report.preventiveMaintenanceSuggestions.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('5. Preventive Maintenance Suggestions', 14, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        report.preventiveMaintenanceSuggestions.forEach((sugg) => {
          const sLines = doc.splitTextToSize(`• ${sugg}`, 180);
          doc.text(sLines, 14, y);
          y += sLines.length * 5;
        });
        y += 5;
      }

      // Footer
      y = 275;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Help Nest Workers Cooperative — Certified Community Quality Standards', 14, y);
      doc.text(`Generated via Gemma 4 Engine · Ref: ${booking.bookingReference}`, 120, y);

      doc.save(`HelpNest_Report_${booking.bookingReference}.pdf`);
    } catch {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 my-8 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{t.repairReportTitle || 'AI Repair & Service Report'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200">
                  Gemma 4
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ref: <span className="font-mono font-semibold">{booking.bookingReference}</span> ·{' '}
                {booking.workerCategory}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-teal-600 dark:text-teal-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {t.generatingRepairReport ||
                (lang === 'bn'
                  ? 'Gemma 4 সার্ভিস রিপোর্ট প্রস্তুত করছে...'
                  : lang === 'hi'
                  ? 'Gemma 4 सेवा रिपोर्ट तैयार कर रहा है...'
                  : 'Gemma 4 is compiling service report from field notes and status logs...')}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success */}
        {saveSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{t.reportSavedSuccess || 'Repair report saved and approved successfully.'}</span>
          </div>
        )}

        {/* Report Content */}
        {!loading && report && (
          <div className="space-y-4 text-xs">
            {/* Title & Metadata Banner */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                  {booking.workerCategory} Service Documentation
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    report.workerApproved
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {report.workerApproved ? '✓ Verified & Approved' : 'Draft / Under Review'}
                </span>
              </div>

              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full font-bold text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100"
                />
              ) : (
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {report.reportTitle}
                </h4>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>Customer: {booking.customerName}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Wrench className="w-3 h-3" />
                  <span>Technician: {booking.workerName || workerName || 'Assigned Worker'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Date: {new Date(report.createdAt).toLocaleDateString()}</span>
                </span>
              </div>
            </div>

            {/* Original Reported Problem */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <strong className="block text-slate-900 dark:text-slate-100 font-semibold">
                Original Reported Problem:
              </strong>
              <p className="text-slate-700 dark:text-slate-300">{report.originalReportedProblem}</p>
            </div>

            {/* Work Performed */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <strong className="block text-slate-900 dark:text-slate-100 font-semibold flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-teal-600" />
                <span>{t.workPerformedLabel || 'Work Performed On-Site'}:</span>
              </strong>

              {isEditing ? (
                <textarea
                  rows={4}
                  value={editWorkPerformed}
                  onChange={(e) => setEditWorkPerformed(e.target.value)}
                  placeholder="One step per line..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                />
              ) : (
                <ul className="space-y-1.5 list-disc list-inside text-slate-700 dark:text-slate-300">
                  {report.workPerformed.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Parts Used (Confirmed only) */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <strong className="block text-slate-900 dark:text-slate-100 font-semibold flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-teal-600" />
                <span>{t.partsUsedLabel || 'Confirmed Spare Parts & Materials'}:</span>
              </strong>

              {report.partsUsed && report.partsUsed.length > 0 ? (
                <div className="space-y-1">
                  {report.partsUsed.map((part, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-850 font-mono text-xs"
                    >
                      <span className="font-sans font-medium text-slate-800 dark:text-slate-200">
                        {part.partName} (Qty: {part.quantity})
                      </span>
                      <strong className="text-teal-700 dark:text-teal-400">₹{part.costInr}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 dark:text-slate-400 italic">
                  {t.noPartsUsedNotice || '✓ No new parts used (Labor & diagnostic service only).'}
                </p>
              )}
            </div>

            {/* Customer Summary */}
            <div className="p-3.5 rounded-xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-850 space-y-1.5">
              <strong className="block text-teal-900 dark:text-teal-200 font-bold">
                {t.customerSummaryLabel || 'Customer Summary'}:
              </strong>
              {isEditing ? (
                <textarea
                  rows={2}
                  value={editCustomerSummary}
                  onChange={(e) => setEditCustomerSummary(e.target.value)}
                  className="w-full rounded-lg border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-slate-100"
                />
              ) : (
                <p className="text-slate-800 dark:text-slate-200">{report.customerSummary}</p>
              )}
            </div>

            {/* Outstanding Issues & Preventive Maintenance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Outstanding issues */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <strong className="block text-slate-900 dark:text-slate-100 font-semibold">
                  {t.outstandingIssuesLabel || 'Outstanding Issues'}:
                </strong>
                {isEditing ? (
                  <input
                    type="text"
                    value={editOutstandingIssues}
                    onChange={(e) => setEditOutstandingIssues(e.target.value)}
                    placeholder="None or describe follow-up required..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <p className="text-slate-600 dark:text-slate-400">
                    {report.outstandingIssues || 'None. Defect fully resolved on site.'}
                  </p>
                )}
              </div>

              {/* Preventive Maintenance */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <strong className="block text-slate-900 dark:text-slate-100 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t.maintenanceSuggestionsLabel || 'Maintenance Suggestions'}:</span>
                </strong>
                {report.preventiveMaintenanceSuggestions &&
                report.preventiveMaintenanceSuggestions.length > 0 ? (
                  <ul className="space-y-1 list-disc list-inside text-slate-700 dark:text-slate-300">
                    {report.preventiveMaintenanceSuggestions.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400 italic">None required.</p>
                )}
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 text-white font-semibold cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.downloadPdfReport || 'Download PDF Report'}</span>
              </button>

              {userRole === 'WORKER' || userRole === 'ADMIN' ? (
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingReport}
                        onClick={handleSaveReport}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-95 text-white font-bold transition-all cursor-pointer shadow-xs"
                      >
                        {savingReport ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>{t.saveAndApproveReport || 'Save & Approve Report'}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Report Details</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
