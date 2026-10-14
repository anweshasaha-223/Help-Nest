import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  Send,
  Loader2,
  FileCheck,
  Building,
  Coins,
  Scale,
  Calendar,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import type { CoopPolicyExplanationResult, LanguageCode } from '../types';

interface AiCoopRuleExplainerProps {
  token?: string | null;
  lang?: LanguageCode;
  t?: Record<string, string>;
  workerName?: string;
  workerTrade?: string;
}

export const AiCoopRuleExplainer: React.FC<AiCoopRuleExplainerProps> = ({
  token,
  lang = 'en',
  t = {},
  workerName,
  workerTrade,
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<CoopPolicyExplanationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const quickQuestions = [
    {
      q: 'How is the 90:10 payment split calculated?',
      bn: '৯০:১০ পেমেন্ট বিভাজন কীভাবে গণনা করা হয়?',
      hi: '90:10 भुगतान विभाजन की गणना कैसे होती है?',
      icon: Coins,
    },
    {
      q: 'What happens when a customer cancels a booking late or after arrival?',
      bn: 'গ্রাহক দেরিতে বা পৌঁছানোর পর বাতিল করলে কি ক্ষতিপূরণ পাওয়া যায়?',
      hi: 'ग्राहक द्वारा देर से या पहुंचने के बाद रद्द करने पर क्या नियम है?',
      icon: Scale,
    },
    {
      q: 'How does the Cooperative Welfare Fund support workers?',
      bn: 'সমিতি কল্যাণ তহবিল কীভাবে কর্মীদের সহায়তা করে?',
      hi: 'सहकारी कल्याण कोष से श्रमिकों को क्या सहायता मिलती है?',
      icon: ShieldCheck,
    },
    {
      q: 'What are the cooperative leave, sickness, and offline availability rules?',
      bn: 'ছুটি ও অসুস্থতাকালীন অফলাইন থাকার নিয়মাবলি কী?',
      hi: 'अवकाश, बीमारी और कार्य उपलब्धता के क्या नियम हैं?',
      icon: Calendar,
    },
    {
      q: 'How can a worker file a payment or pricing dispute?',
      bn: 'পেমেন্ট বা মূল্য বিরোধ কীভাবে রিপোর্ট করতে হয়?',
      hi: 'भुगतान या मूल्य विवाद की रिपोर्ट कैसे करें?',
      icon: Scale,
    },
  ];

  const handleAsk = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/coop-policy-explainer', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: q }),
      });

      if (res.ok) {
        const result: CoopPolicyExplanationResult = await res.json();
        setHistory((prev) => [result, ...prev]);
        setQuestion('');
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to explain policy.');
      }
    } catch {
      setError('Unable to reach Cooperative Rule Explainer service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50 via-white to-amber-100/30 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-850 border border-amber-200/80 dark:border-amber-800/80 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{t.ruleExplainerTitle || 'AI Cooperative Rule Explainer'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                  Gemma 4
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t.ruleExplainerSubtext ||
                  'Official bylaws assistant: Answers questions strictly from Help Nest Cooperative verified policies with exact section citations.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-900 dark:text-amber-300 shadow-2xs">
            <Building className="w-3.5 h-3.5 text-amber-700" />
            <span>Coop Society Bylaws v2026.1</span>
          </div>
        </div>

        {/* Quick Questions Pills */}
        <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-900/40 space-y-2">
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            {lang === 'bn' ? 'দ্রুত জিজ্ঞাস্য নিয়মাবলি:' : lang === 'hi' ? 'त्वरित नियम प्रश्न:' : 'Common Cooperative Rule Topics:'}
          </span>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((item, idx) => {
              const Icon = item.icon;
              const displayText = lang === 'bn' ? item.bn : lang === 'hi' ? item.hi : item.q;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAsk(item.q)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-white dark:bg-slate-850 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-800 dark:text-slate-200 text-xs transition-colors cursor-pointer shadow-2xs text-left"
                >
                  <Icon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{displayText}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(question);
          }}
          className="mt-4 flex gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              t.askRulePlaceholder ||
              (lang === 'bn'
                ? 'সমিতির কোনো নিয়ম বা আর্থিক বিভাজন সম্পর্কে জিজ্ঞাসা করুন...'
                : lang === 'hi'
                ? 'सहकारी समिति के नियमों, लाभ या मुआवजे के बारे में पूछें...'
                : 'Ask about 90:10 payout, late cancellation fee, emergency fund...')
            }
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-600 dark:focus:border-amber-400 placeholder-slate-400"
          />

          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{t.askRuleBtn || 'Ask Rule Assistant'}</span>
          </button>
        </form>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Answers Stream */}
      <div className="space-y-3">
        {history.map((item, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 shadow-xs space-y-3 text-xs"
          >
            {/* Question */}
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <strong className="text-slate-900 dark:text-slate-100">{item.question}</strong>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Model: {item.modelUsed}
              </span>
            </div>

            {/* Gemma 4 Explanation */}
            <div className="space-y-1.5">
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                {item.explanation}
              </p>
            </div>

            {/* Verified Policy Citations */}
            {item.relevantPolicyCitations && item.relevantPolicyCitations.length > 0 && (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-400 font-semibold text-[11px]">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>{t.policyCitationLabel || 'Verified Cooperative Policy Citations'}:</span>
                </div>
                <ul className="space-y-0.5 list-disc list-inside text-slate-600 dark:text-slate-400 text-[11px]">
                  {item.relevantPolicyCitations.map((cit, cIdx) => (
                    <li key={cIdx} className="font-mono">
                      {cit}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Verified Official Figures */}
            {item.verifiedFigures &&
              (Array.isArray(item.verifiedFigures)
                ? item.verifiedFigures.length > 0
                : Object.keys(item.verifiedFigures).length > 0) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {t.verifiedFiguresLabel || 'Official Bylaw Figures'}:
                  </span>
                  {(Array.isArray(item.verifiedFigures)
                    ? item.verifiedFigures
                    : Object.entries(item.verifiedFigures).map(([k, v]) => `${k}: ${v}`)
                  ).map((fig: string, fIdx: number) => (
                    <span
                      key={fIdx}
                      className="px-2 py-0.5 rounded-md bg-amber-100/70 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[11px] font-mono font-bold text-amber-900 dark:text-amber-300"
                    >
                      {fig}
                    </span>
                  ))}
                </div>
              )}

            {/* Escalation to Admin if unverified */}
            {item.contactAdminRecommendation && (
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                <span>{item.contactAdminRecommendation}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
