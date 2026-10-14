import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  Save,
  SkipForward,
  Loader2,
} from 'lucide-react';
import type {
  BookingGapAnalysisResult,
  BookingRequirementQuestion,
  LanguageCode,
  Coordinates,
} from '../types';

interface AiBookingGapFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingDraft: {
    serviceCategory: string;
    problemDescription: string;
    preferredDate: string;
    preferredTimeSlot: string;
    urgency: string;
    customerCoords: Coordinates;
    customerAddress?: string;
    additionalInstructions?: string;
    bookingReference?: string;
    bookingId?: string;
  };
  token?: string | null;
  lang?: LanguageCode;
  t?: Record<string, string>;
  onGapsResolved: (confirmedAnswers: Record<string, string>) => void;
}

export const AiBookingGapFinderModal: React.FC<AiBookingGapFinderModalProps> = ({
  isOpen,
  onClose,
  bookingDraft,
  token,
  lang = 'en',
  t = {},
  onGapsResolved,
}) => {
  const [loading, setLoading] = useState(false);
  const [gapResult, setGapResult] = useState<BookingGapAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [savingAnswers, setSavingAnswers] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchGapAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/ai/booking-gap-finder', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            serviceCategory: bookingDraft.serviceCategory,
            problemDescription: bookingDraft.problemDescription,
            customerLocationAddress:
              bookingDraft.customerAddress || bookingDraft.customerCoords.addressLabel || '',
            preferredTimeSlot: bookingDraft.preferredTimeSlot,
            urgency: bookingDraft.urgency,
            additionalInstructions: bookingDraft.additionalInstructions || '',
            bookingReference: bookingDraft.bookingReference,
            bookingId: bookingDraft.bookingId,
          }),
        });

        if (res.ok) {
          const data: BookingGapAnalysisResult = await res.json();
          if (isMounted) {
            setGapResult(data);
            // Pre-populate any existing answers
            const initial: Record<string, string> = {};
            const qList = data.recommendedQuestions || data.missingQuestions || [];
            qList.forEach((q) => {
              if (q.customerAnswer) {
                initial[q.id] = q.customerAnswer;
              }
            });
            setUserAnswers(initial);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          if (isMounted) {
            setError(err.error || 'Failed to analyze booking gaps.');
          }
        }
      } catch {
        if (isMounted) {
          setError('Unable to connect to gap analyzer.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchGapAnalysis();

    return () => {
      isMounted = false;
    };
  }, [isOpen, bookingDraft, token]);

  if (!isOpen) return null;

  const handleAnswerChange = (questionId: string, value: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSaveAndProceed = async () => {
    setSavingAnswers(true);
    try {
      if (gapResult) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        await fetch('/api/ai/booking-gap-answers', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            gapAnalysisId: gapResult.id,
            bookingId: bookingDraft.bookingId,
            answers: userAnswers,
          }),
        });
      }
      onGapsResolved(userAnswers);
      onClose();
    } catch {
      // Proceed even on network issue
      onGapsResolved(userAnswers);
      onClose();
    } finally {
      setSavingAnswers(false);
    }
  };

  const handleSkipOptional = () => {
    onGapsResolved(userAnswers);
    onClose();
  };

  const isEmergency = bookingDraft.urgency === 'EMERGENCY';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{t.gapFinderTitle || 'AI Booking Requirement Gap Finder'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200">
                  Gemma 4
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'মিস্ত্রি আসার আগে প্রয়োজনীয় জরুরি তথ্য যাচাইকরণ।'
                  : lang === 'hi'
                  ? 'कर्मी के पहुंचने से पहले आवश्यक विवरणों की त्वरित जांच।'
                  : 'Identifies missing key details before dispatch to ensure smooth service.'}
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

        {/* Emergency Exemption Notice */}
        {isEmergency && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2.5 text-xs text-red-900 dark:text-red-200">
            <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">
                {lang === 'bn'
                  ? 'জরুরি বুকিং অগ্রাধিকার সক্রিয়'
                  : lang === 'hi'
                  ? 'आपातकालीन बुकिंग प्राथमिकता सक्रिय'
                  : 'Emergency Priority Active'}
              </strong>
              <span>
                {t.emergencySkipNotice ||
                  'Emergency request will NEVER be blocked by missing nonessential questions. Answer what you know or skip directly.'}
              </span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-teal-700 dark:text-teal-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {t.checkingGaps || (lang === 'bn' ? 'Gemma 4 অনুপস্থিত তথ্য বিশ্লেষণ করছে...' : lang === 'hi' ? 'Gemma 4 लापता जानकारी की जांच कर रहा है...' : 'Gemma 4 is checking for information gaps...')}
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Gap Results */}
        {!loading && gapResult && (
          <div className="space-y-4">
            {/* Completeness Score Bar */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {lang === 'bn' ? 'বুকিং সম্পূর্ণতা স্তর' : lang === 'hi' ? 'बुकिंग पूर्णता स्कोर' : 'Booking Completeness Score'}
                </span>
                <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                  {gapResult.completenessScore}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all duration-500"
                  style={{ width: `${gapResult.completenessScore}%` }}
                />
              </div>

              {/* Already Confirmed Items */}
              {gapResult.confirmedInformation && gapResult.confirmedInformation.length > 0 && (
                <div className="pt-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? '✓ নিশ্চিত তথ্য:' : lang === 'hi' ? '✓ पहले से उपलब्ध जानकारी:' : '✓ Already Confirmed:'}{' '}
                  </span>
                  <span>{gapResult.confirmedInformation.join(' · ')}</span>
                </div>
              )}
            </div>

            {/* Questions Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>
                  {t.missingDetailsNotice || (lang === 'bn' ? 'প্রয়োজনীয় বিস্তারিত তথ্য' : lang === 'hi' ? 'लापता जानकारी की चेकलिस्ट' : 'Recommended Clarification Questions')}
                </span>
              </h4>

              {(gapResult.recommendedQuestions || gapResult.missingQuestions || []).length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === 'bn'
                      ? 'অসাধারণ! আপনার বুকিংয়ে প্রয়োজনীয় সব তথ্য সম্পূর্ণ আছে।'
                      : lang === 'hi'
                      ? 'शानदार! आपकी बुकिंग में सभी आवश्यक विवरण पूर्ण हैं।'
                      : 'Excellent! Your booking contains all key details needed by the technician.'}
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {(gapResult.recommendedQuestions || gapResult.missingQuestions || []).map((q: BookingRequirementQuestion) => (
                    <div
                      key={q.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-850 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                q.isMandatory
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {q.isMandatory
                                ? t.mandatoryGapBadge || 'Mandatory'
                                : t.optionalGapBadge || 'Optional'}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                              [{q.category}]
                            </span>
                          </div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100 pt-1">
                            {q.question}
                          </p>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                        {q.reason}
                      </p>

                      <input
                        type="text"
                        value={userAnswers[q.id] || ''}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        placeholder={
                          q.placeholder ||
                          (lang === 'bn'
                            ? 'আপনার উত্তর লিখুন...'
                            : lang === 'hi'
                            ? 'अपना उत्तर यहां लिखें...'
                            : 'Enter details...')
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-700"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSkipOptional}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>
                  {t.skipOptionalQuestions ||
                    (lang === 'bn' ? 'স্কিপ করুন' : lang === 'hi' ? 'छोड़ें और आगे बढ़ें' : 'Skip & Continue')}
                </span>
              </button>

              <button
                type="button"
                disabled={savingAnswers}
                onClick={handleSaveAndProceed}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                {savingAnswers ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>
                  {t.saveGapAnswers ||
                    (lang === 'bn' ? 'উত্তর সংরক্ষণ ও নিশ্চিত করুন' : lang === 'hi' ? 'उत्तर सहेजें और आगे बढ़ें' : 'Save Answers & Proceed')}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
