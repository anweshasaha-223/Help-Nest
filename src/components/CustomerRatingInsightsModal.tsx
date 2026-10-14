import React, { useState, useEffect } from 'react';
import {
  X,
  Star,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ThumbsUp,
  TrendingUp,
  Cpu,
  RefreshCw,
  ListChecks,
  Info,
} from 'lucide-react';
import type { CustomerRatingInsights, LanguageCode } from '../types';

interface CustomerRatingInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerId?: string;
  workerName?: string;
  token?: string | null;
  lang?: LanguageCode;
}

export const CustomerRatingInsightsModal: React.FC<CustomerRatingInsightsModalProps> = ({
  isOpen,
  onClose,
  workerId,
  workerName,
  token,
  lang = 'en',
}) => {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<CustomerRatingInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/customer-rating-insights', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workerId,
          language: lang,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to generate Customer Rating Insights.');
      }
    } catch {
      setError('Network error contacting Gemma 4 Rating Insights service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInsights();
    }
  }, [isOpen, workerId, lang]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl my-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-amber-800/20 dark:border-amber-700/30 overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col max-h-[92vh]">
        {/* Accent Bar */}
        <div className="h-2 w-full bg-linear-to-r from-amber-500 via-teal-700 to-emerald-600" />

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800">
              <Star className="w-6 h-6 fill-amber-400 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Customer Rating Insights
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Google Gemma 4 E4B
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Genuine Rating Analysis & Practical Coaching for Trade Excellence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-amber-600 dark:text-amber-400 mx-auto" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Google Gemma 4 E4B is analyzing verified customer reviews & star ratings...
              </p>
              <p className="text-xs text-slate-400">
                Extracting praised strengths, constructive improvements, and on-site trade checklist.
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold">Unable to generate Rating Insights</p>
                <p className="text-xs mt-1 opacity-90">{error}</p>
                <button
                  onClick={fetchInsights}
                  className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Gemma 4 Inference
                </button>
              </div>
            </div>
          )}

          {insights && !loading && (
            <>
              {/* Rating Overview Card */}
              <div className="p-5 rounded-2xl bg-linear-to-br from-amber-50 via-teal-50/40 to-slate-50 dark:from-slate-800 dark:via-amber-950/30 dark:to-slate-850 border border-amber-200/80 dark:border-amber-900/60 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                      Performance Profile • {insights.category}
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                      {insights.workerName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-center">
                      <div className="text-[11px] text-slate-500">Average Rating</div>
                      <div className="text-xl font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1 font-mono">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        {insights.averageRating.toFixed(1)}
                      </div>
                    </div>
                    <div className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                      <div className="text-[11px] text-slate-500">Reviews Analyzed</div>
                      <div className="text-xl font-bold text-teal-700 dark:text-teal-400 font-mono">
                        {insights.totalReviewsAnalyzed}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-3 border-t border-amber-200/50 dark:border-amber-900/60">
                  <span className="font-semibold text-amber-900 dark:text-amber-200">Customer Sentiment: </span>
                  {insights.customerSentimentSummary}
                </p>
              </div>

              {/* Praised Strengths & Improvement Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Highlighted Strengths */}
                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                    Customer Praised Strengths
                  </h4>
                  <ul className="space-y-1.5">
                    {insights.highlightedStrengths.map((str, idx) => (
                      <li key={idx} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Improvement Suggestions */}
                <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                    Suggestions for 5-Star Growth
                  </h4>
                  <ul className="space-y-1.5">
                    {insights.actionableImprovementSuggestions.map((sug, idx) => (
                      <li key={idx} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-teal-600 dark:text-teal-400 font-bold">•</span>
                        <span>{sug}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Trade Excellence Checklist */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-amber-600" />
                  Pre-Departure Trade Excellence Checklist
                </h4>
                <div className="space-y-1.5">
                  {insights.tradeExcellenceChecklist.map((checkItem, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-md bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                        {idx + 1}
                      </span>
                      <span>{checkItem}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Size Transparency Note */}
              {insights.sampleSizeLimitationNote && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{insights.sampleSizeLimitationNote}</span>
                </div>
              )}

              {/* Data Integrity Notice */}
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{insights.dataIntegrityNotice}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  {insights.modelUsed}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between">
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Insights
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-teal-700 hover:bg-teal-800 text-white transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
