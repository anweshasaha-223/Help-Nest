import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Globe,
  Edit3,
  Save,
  CheckSquare,
  ListTodo,
  FileText,
  ShieldCheck,
  Check,
} from 'lucide-react';
import type { ComplaintToActionRecord } from '../types';
import type { LanguageCode } from '../i18n/translations';

interface ComplaintToActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: ComplaintToActionRecord;
  token: string;
  userRole: 'CUSTOMER' | 'WORKER' | 'ADMIN';
  t: Record<string, string>;
  lang?: LanguageCode;
  onRecordUpdated?: (updated: ComplaintToActionRecord) => void;
}

export const ComplaintToActionModal: React.FC<ComplaintToActionModalProps> = ({
  isOpen,
  onClose,
  record,
  token,
  userRole,
  t,
  lang = 'en',
  onRecordUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [correctedSummary, setCorrectedSummary] = useState(
    record.corrections?.correctedSummary || record.problemSummary
  );
  const [correctedActionsText, setCorrectedActionsText] = useState(
    (record.corrections?.correctedActionItems || record.suggestedActionItems).join('\n')
  );
  const [correctionNotes, setCorrectionNotes] = useState(record.corrections?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveCorrections = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const actionItems = correctedActionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/ai/complaint-to-action/${record.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          correctedSummary: correctedSummary.trim(),
          correctedActionItems: actionItems,
          notes: correctionNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save corrections.');
      }

      setSuccess(t.correctionsSavedNotice || 'Corrections saved successfully.');
      setIsEditing(false);
      if (onRecordUpdated && data.record) {
        onRecordUpdated(data.record);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Error saving corrections.');
    } finally {
      setSaving(false);
    }
  };

  const currentSummary = record.corrections?.correctedSummary || record.problemSummary;
  const currentActions = record.corrections?.correctedActionItems || record.suggestedActionItems;

  const workerLanguageLabel =
    record.workerPreferredLanguage === 'bn'
      ? 'বাংলা (Bengali)'
      : record.workerPreferredLanguage === 'hi'
      ? 'हिन्दी (Hindi)'
      : 'English';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-linear-to-r from-teal-50/80 to-emerald-50/50 dark:from-slate-850 dark:to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-700/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                {t.complaintToActionTitle || 'AI Complaint-to-Action Converter'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>Ref: <strong className="font-mono text-teal-700 dark:text-teal-400">{record.bookingReference || record.id}</strong></span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Lang: {record.complaintLanguage}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notices */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Original Complaint vs Facts card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Original Customer Statement ({record.customerName})
            </span>
            <p className="text-xs text-slate-800 dark:text-slate-200 italic leading-relaxed">
              "{record.originalComplaint}"
            </p>

            {/* Facts vs Hypotheses Separation */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                  <Check className="w-3.5 h-3.5" /> {t.customerFactsLabel || 'Customer-Stated Facts'}
                </span>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                  {record.customerFacts?.map((fact, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5" /> {t.aiSuggestionsLabel || 'AI Suggestions & Hypotheses'}
                </span>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                  {record.aiSuggestions?.map((sug, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-teal-600 font-bold">•</span>
                      <span>{sug}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Structured Problem Summary */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t.complaintSummaryLabel || 'Structured Problem Summary'}
              </label>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-teal-700 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> {t.correctDetailsBtn || 'Correct Details'}
                </button>
              )}
            </div>

            {isEditing ? (
              <textarea
                rows={3}
                value={correctedSummary}
                onChange={(e) => setCorrectedSummary(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                placeholder="Refine problem summary..."
              />
            ) : (
              <p className="text-xs p-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/40 text-teal-900 dark:text-teal-200 font-medium leading-relaxed">
                {currentSummary}
              </p>
            )}
          </div>

          {/* Worker Translated Summary (Requirement 1: Translated to worker's preferred language) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-teal-600" />
                {t.translatedForWorkerLabel || 'Worker Translated Summary'} ({workerLanguageLabel})
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-semibold font-mono">
                {record.workerPreferredLanguage.toUpperCase()}
              </span>
            </div>
            <p className="text-xs p-3 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 font-medium leading-relaxed">
              {record.translatedSummaryForWorker}
            </p>
          </div>

          {/* Suggested Action Items for Worker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5 text-teal-600" />
              {t.suggestedActionsLabel || 'Suggested Action Items for Worker'}
            </label>

            {isEditing ? (
              <textarea
                rows={4}
                value={correctedActionsText}
                onChange={(e) => setCorrectedActionsText(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                placeholder="One action item per line..."
              />
            ) : (
              <div className="space-y-1.5">
                {currentActions.map((action, idx) => (
                  <div
                    key={idx}
                    className="text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-200 flex items-start gap-2"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Missing Information & Follow-Up Questions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Missing Information */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                {t.missingInfoNotice || 'Information to Confirm'}
              </label>
              <div className="space-y-1">
                {record.missingInformation?.length > 0 ? (
                  record.missingInformation.map((item, idx) => (
                    <div
                      key={idx}
                      className="text-xs p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 text-amber-900 dark:text-amber-200"
                    >
                      • {item}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic p-2">None missing</p>
                )}
              </div>
            </div>

            {/* Follow-up Questions */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-teal-600" />
                {t.followUpQuestionsLabel || 'Follow-up Questions'}
              </label>
              <div className="space-y-1">
                {record.customerFollowUpQuestions?.length > 0 ? (
                  record.customerFollowUpQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      ? {q}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic p-2">No follow-up questions needed</p>
                )}
              </div>
            </div>
          </div>

          {/* Corrections History Note if corrected */}
          {record.corrections && !isEditing && (
            <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-300 text-xs">
              <strong>Human Correction Applied:</strong> Edited by {record.corrections.correctedBy} (
              {record.corrections.correctedByRole}) on {new Date(record.corrections.correctedAt).toLocaleString()}
              {record.corrections.notes && <p className="mt-1 italic">Note: "{record.corrections.notes}"</p>}
            </div>
          )}

          {/* Editing Notes input */}
          {isEditing && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reason for Correction / Notes
              </label>
              <input
                type="text"
                placeholder="Optional correction note..."
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Model: {record.modelUsed}
          </span>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCorrections}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition disabled:opacity-60 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : (t.saveCorrectionsBtn || 'Save Corrections')}
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                {t.closeBtn || 'Close'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
