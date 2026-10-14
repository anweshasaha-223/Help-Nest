import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Sparkles,
  Send,
  HelpCircle,
  ShieldCheck,
  Scale,
  Award,
  AlertTriangle,
  ChevronRight,
  Info,
} from 'lucide-react';
import type { CoopPolicyExplanationResult } from '../types';
import type { LanguageCode } from '../i18n/translations';

interface CoopRuleExplainerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  workerName?: string;
  t: Record<string, string>;
  lang?: LanguageCode;
}

export const CoopRuleExplainerDrawer: React.FC<CoopRuleExplainerDrawerProps> = ({
  isOpen,
  onClose,
  token,
  workerName,
  t,
  lang = 'en',
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoopPolicyExplanationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickFaqs = [
    t.quickRuleFaq1 || 'How is the 90:10 payment split calculated?',
    t.quickRuleFaq2 || 'What happens if a customer cancels after arrival?',
    t.quickRuleFaq3 || 'How do I claim Cooperative Welfare Fund assistance?',
    t.quickRuleFaq4 || 'What are the shift availability and offline rules?',
    t.quickRuleFaq5 || 'How are payment disputes resolved by the society?',
  ];

  const handleAskQuestion = async (qText: string) => {
    const textToAsk = qText.trim();
    if (!textToAsk || textToAsk.length < 3) return;

    setQuestion(textToAsk);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/coop-policy-explainer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: textToAsk }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to explain cooperative policy.');
      }

      setResult(data.explanation);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Error retrieving policy explanation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-linear-to-r from-teal-50/80 to-emerald-50/50 dark:from-slate-850 dark:to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-700/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                {t.ruleExplainerTitle || 'Gemma 4 Cooperative Rule Explainer'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified Grounding on Approved Help Nest Bylaws (2026 Edition)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Quick FAQ Pills */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Suggested Questions
            </span>
            <div className="flex flex-wrap gap-2">
              {quickFaqs.map((faq, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskQuestion(faq)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 hover:text-teal-800 dark:hover:bg-teal-950/60 dark:hover:text-teal-300 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 transition flex items-center gap-1.5 text-left cursor-pointer disabled:opacity-50"
                >
                  <span>{faq}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Question Input Box */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAskQuestion(question);
                  }
                }}
                placeholder={t.askRulePlaceholder || 'Ask any question about bylaws, 90:10 split, cancellation, or welfare...'}
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-700"
              />
              <button
                onClick={() => handleAskQuestion(question)}
                disabled={loading || !question.trim()}
                className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition disabled:opacity-60 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading ? (t.askingRule || 'Consulting...') : (t.askRuleBtn || 'Ask Assistant')}</span>
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400">
              <Sparkles className="w-6 h-6 animate-pulse mx-auto text-teal-700 mb-2" />
              <p className="text-xs font-medium">Retrieving verified bylaws and formulating Gemma 4 answer...</p>
            </div>
          )}

          {/* Result Card */}
          {result && !loading && (
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                    Question Answered
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    "{result.question}"
                  </h4>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shrink-0">
                  <ShieldCheck className="w-3 h-3" /> Verified Bylaw
                </span>
              </div>

              {/* Answer Text */}
              <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed space-y-2 whitespace-pre-line">
                {result.answer}
              </div>

              {/* Citations & Figures */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                {Boolean(result.policyReferences && result.policyReferences.length > 0) && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      {t.policyCitationLabel || 'Verified Bylaw Citations'}:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.policyReferences?.map((ref, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2.5 py-1 rounded-md bg-teal-100/70 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-mono font-medium border border-teal-200/80 dark:border-teal-800"
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.verifiedFigures && Object.keys(result.verifiedFigures).length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      {t.verifiedFiguresLabel || 'Approved Official Figures'}:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(result.verifiedFigures).map(([k, v], idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-[11px]"
                        >
                          <span className="text-slate-400 block text-[10px] capitalize">
                            {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </span>
                          <strong className="text-teal-700 dark:text-teal-400 font-bold">{String(v)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.adminContactNote && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-900/40">
                    {result.adminContactNote}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Constitution Guarantee Notice */}
          <div className="p-3 rounded-xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-900/30 text-teal-900 dark:text-teal-300 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Cooperative Bylaw Guarantee:</strong> Help Nest rules are established by democratic member vote.
              This AI assistant uses strict factual retrieval to explain verified policies and cannot alter payment ratios,
              deduct penalties, or change cooperative ledger balances.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-mono text-[11px]">
            Engine: {result?.modelUsed || 'Gemma 4 Verified RAG'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition cursor-pointer"
          >
            {t.closeBtn || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
