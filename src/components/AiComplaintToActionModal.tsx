import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Edit3,
  Save,
  Globe,
  UserCheck,
  Cpu,
  ListChecks,
  FileQuestion,
  Loader2,
  Check,
  Shield,
  Wrench,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import type { ComplaintToActionRecord, LanguageCode, UserRole } from '../types';

interface AiComplaintToActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId?: string;
  bookingReference?: string;
  complaintText: string;
  userRole: UserRole;
  workerPreferredLanguage?: 'en' | 'hi' | 'bn';
  token?: string | null;
  lang?: LanguageCode;
  t?: Record<string, string>;
  onRecordUpdated?: (record: ComplaintToActionRecord) => void;
}

export const AiComplaintToActionModal: React.FC<AiComplaintToActionModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  bookingReference,
  complaintText,
  userRole,
  workerPreferredLanguage = 'en',
  token,
  lang = 'en',
  t = {},
  onRecordUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<ComplaintToActionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Correction mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editProblemSummary, setEditProblemSummary] = useState('');
  const [editCustomerFacts, setEditCustomerFacts] = useState<string[]>([]);
  const [editMissingInfo, setEditMissingInfo] = useState<string[]>([]);
  const [correctionNote, setCorrectionNote] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Worker task checkmarks
  const [completedActions, setCompletedActions] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadRecord = async () => {
      setLoading(true);
      setError(null);
      setSaveSuccess(false);

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Call the Complaint-to-Action endpoint
        const res = await fetch('/api/ai/complaint-to-action', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            complaintText: complaintText || 'Customer reported a service defect.',
            bookingId,
            bookingReference,
            workerPreferredLanguage,
          }),
        });

        if (res.ok) {
          const data: ComplaintToActionRecord = await res.json();
          if (isMounted) {
            setRecord(data);
            setEditProblemSummary(data.structuredProblemSummary || data.problemSummary || '');
            setEditCustomerFacts([...(data.customerStatedFacts || data.customerFacts || [])]);
            setEditMissingInfo([...(data.missingInformationBeforeStart || data.missingInformation || [])]);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          if (isMounted) setError(err.error || 'Failed to analyze complaint.');
        }
      } catch {
        if (isMounted) setError('Unable to reach Complaint-to-Action service.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadRecord();

    return () => {
      isMounted = false;
    };
  }, [isOpen, bookingId, bookingReference, complaintText, workerPreferredLanguage, token]);

  if (!isOpen) return null;

  const handleToggleAction = (index: number) => {
    setCompletedActions((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleSaveCorrections = async () => {
    if (!record) return;
    setSavingCorrection(true);
    setSaveSuccess(false);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/ai/complaint-to-action/${record.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          correctedByRole: userRole,
          correctedStructuredSummary: editProblemSummary,
          correctedCustomerFacts: editCustomerFacts,
          correctedMissingInfo: editMissingInfo,
          correctionNote: correctionNote || `Corrected by ${userRole}`,
        }),
      });

      if (res.ok) {
        const updated: ComplaintToActionRecord = await res.json();
        setRecord(updated);
        setIsEditing(false);
        setSaveSuccess(true);
        if (onRecordUpdated) onRecordUpdated(updated);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to save correction.');
      }
    } catch {
      setError('Network error saving correction.');
    } finally {
      setSavingCorrection(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 my-8 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{t.complaintToActionTitle || 'AI Complaint-to-Action Converter'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200">
                  Gemma 4
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'গ্রাহকের অভিযোগকে কর্মীর জন্য কাঠামোগত কর্মপরিকল্পনায় রূপান্তর করে।'
                  : lang === 'hi'
                  ? 'शिकायत को संरचित समस्या सारांश और कर्मी कार्य-योजना में बदलता है।'
                  : 'Converts unstructured customer complaint into worker actions and verified facts.'}
                {bookingReference ? ` · Ref: ${bookingReference}` : ''}
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
            <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {lang === 'bn'
                ? 'Gemma 4 অভিযোগ বিশ্লেষণ ও কর্মপরিকল্পনা তৈরি করছে...'
                : lang === 'hi'
                ? 'Gemma 4 शिकायत का विश्लेषण और कार्य-योजना तैयार कर रहा है...'
                : 'Gemma 4 is processing complaint and formulating worker action items...'}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {saveSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{t.correctionsSavedNotice || 'Corrections and verified facts saved successfully.'}</span>
          </div>
        )}

        {!loading && record && (
          <div className="space-y-4">
            {/* Top Badge: Verified Facts vs AI Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Customer Facts */}
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-850 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
                  <UserCheck className="w-4 h-4" />
                  <span>{t.customerFactsLabel || 'Customer-Stated Facts (Verified)'}</span>
                </div>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                  {(record.customerStatedFacts || record.customerFacts || []).map((fact, idx) => (
                    <li key={idx} className="text-xs">
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI Technical Hypotheses */}
              <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-850 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300 font-bold">
                  <Cpu className="w-4 h-4" />
                  <span>{t.aiSuggestionsLabel || 'AI Technical Hypotheses (Suggested)'}</span>
                </div>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                  {(record.aiTechnicalSuggestions || record.aiSuggestions || []).map((sugg, idx) => (
                    <li key={idx} className="text-xs">
                      {sugg}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Problem Summary (Editable) */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 dark:text-slate-100">
                  {t.complaintSummaryLabel || 'Structured Problem Summary'}
                </h4>
                {record.isCorrected && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                    Corrected by {record.correctedByRole}
                  </span>
                )}
              </div>

              {isEditing ? (
                <textarea
                  rows={2}
                  value={editProblemSummary}
                  onChange={(e) => setEditProblemSummary(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
                />
              ) : (
                <p className="text-slate-700 dark:text-slate-300">{record.structuredProblemSummary}</p>
              )}
            </div>

            {/* Translated Summary for Worker */}
            {record.translatedProblemSummary && (
              <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-850 bg-teal-50/30 dark:bg-teal-950/20 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-semibold">
                  <Globe className="w-3.5 h-3.5" />
                  <span>
                    {t.translatedForWorkerLabel || 'Translated Summary for Technician'} (
                    {record.workerPreferredLanguage?.toUpperCase()}):
                  </span>
                </div>
                <p className="text-slate-800 dark:text-slate-200 italic">
                  "{record.translatedProblemSummary}"
                </p>
              </div>
            )}

            {/* Action Items for Worker */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t.suggestedActionsLabel || 'Suggested Action Items for Worker'}</span>
              </h4>
              <div className="space-y-1.5">
                {(record.suggestedActionItemsForWorker || record.suggestedActionItems || []).map((action, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!completedActions[idx]}
                      onChange={() => handleToggleAction(idx)}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-0"
                    />
                    <span
                      className={
                        completedActions[idx]
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-200'
                      }
                    >
                      {action}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Safety Reminders & Hazards */}
            {record.safetyReminders && record.safetyReminders.length > 0 && (
              <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-bold">
                  <Shield className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>
                    {lang === 'bn'
                      ? 'কাজের নিরাপত্তা সতর্কতা (Gemma 4)'
                      : lang === 'hi'
                      ? 'कार्य सुरक्षा सावधानियां (Gemma 4)'
                      : 'On-Site Safety Precautions & Hazard Guidance'}
                  </span>
                </div>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                  {record.safetyReminders.map((rem, idx) => (
                    <li key={idx} className="text-xs">
                      {rem}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preparation Checklist */}
            {record.preparationChecklist && record.preparationChecklist.length > 0 && (
              <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/40 dark:bg-teal-950/20 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-bold">
                  <Wrench className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>
                    {lang === 'bn'
                      ? 'কাজে যাওয়ার পূর্ব প্রস্তুতি ও সরঞ্জামের তালিকা'
                      : lang === 'hi'
                      ? 'साइट पर जाने से पहले उपकरण चेकलिस्ट'
                      : 'Tool & Equipment Preparation Checklist'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {record.preparationChecklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-800 dark:text-slate-200"
                    >
                      <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="truncate">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unfamiliar Terms Glossary */}
            {record.unfamiliarTermsGlossary && record.unfamiliarTermsGlossary.length > 0 && (
              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-bold">
                  <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>
                    {lang === 'bn'
                      ? 'কাজের পরিভাষা ও প্রযুক্তিগত শব্দের সহজ ব্যাখ্যা'
                      : lang === 'hi'
                      ? 'तकनीकी शब्दों की सरल व्याख्या'
                      : 'Service Terms & Customer Slang Explained'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {record.unfamiliarTermsGlossary.map((gloss, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750">
                      <span className="font-semibold text-blue-900 dark:text-blue-300">{gloss.term}: </span>
                      <span className="text-slate-700 dark:text-slate-300">{gloss.explanation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Info & Questions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Missing Info */}
              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 space-y-1.5">
                <h5 className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{t.missingInfoNotice || 'Verify Before Starting'}</span>
                </h5>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                  {(record.missingInformationBeforeStart || record.missingInformation || []).map((item, idx) => (
                    <li key={idx} className="text-xs">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Clarifying Questions Before Accepting / Customer Follow-ups */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-1.5">
                <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <FileQuestion className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    {lang === 'bn'
                      ? 'কাজ শুরুর আগে গ্রাহককে জিজ্ঞাসা করার প্রশ্ন'
                      : lang === 'hi'
                      ? 'काम स्वीकारने से पहले स्पष्टीकरण प्रश्न'
                      : 'Clarifying Questions for Resident'}
                  </span>
                </h5>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                  {(record.clarifyingQuestionsBeforeAccepting || record.followUpQuestionsForCustomer || record.customerFollowUpQuestions || []).map((q, idx) => (
                    <li key={idx} className="text-xs">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Edit / Correction Form */}
            {isEditing && (
              <div className="p-3.5 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50/20 dark:bg-indigo-950/30 space-y-2.5 text-xs">
                <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    {lang === 'bn'
                      ? 'ভুল তথ্য সংশোধন নোট যোগ করুন'
                      : lang === 'hi'
                      ? 'सटीक सुधार विवरण दर्ज करें'
                      : 'Add Inaccuracy Correction Note'}
                  </span>
                </h5>
                <input
                  type="text"
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="e.g. Corrected valve type or clarified exact floor location..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
                />
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Model: {record.modelUsed}
              </span>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {lang === 'bn' ? 'বাতিল' : lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      disabled={savingCorrection}
                      onClick={handleSaveCorrections}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      {savingCorrection ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>{t.saveCorrectionsBtn || 'Save Corrections'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                    <span>{t.correctDetailsBtn || 'Edit / Correct Details'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
