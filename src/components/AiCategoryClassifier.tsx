import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, HelpCircle, ArrowRight, RefreshCw, Wand2 } from 'lucide-react';
import type { SupportedServiceCategory, CategoryClassificationResult, LanguageCode } from '../types';

interface AiCategoryClassifierProps {
  problemDescription: string;
  mediaFile?: File | null;
  currentSelectedCategory: SupportedServiceCategory | null;
  onSelectCategory: (category: SupportedServiceCategory, suggestedSkill?: string) => void;
  token?: string | null;
  lang?: LanguageCode;
  t?: Record<string, string>;
}

export const AiCategoryClassifier: React.FC<AiCategoryClassifierProps> = ({
  problemDescription,
  mediaFile,
  currentSelectedCategory,
  onSelectCategory,
  token,
  lang = 'en',
  t = {},
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CategoryClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClassify = async () => {
    if (!problemDescription.trim() && !mediaFile) {
      setError(
        lang === 'bn'
          ? 'অনুগ্রহ করে প্রথমে সমস্যার বিবরণ লিখুন বা ছবি যুক্ত করুন।'
          : lang === 'hi'
          ? 'कृपया पहले समस्या का विवरण दर्ज करें या छवि जोड़ें।'
          : 'Please enter a problem description or attach an image first.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let res: Response;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      if (mediaFile) {
        const formData = new FormData();
        formData.append('problemDescription', problemDescription);
        formData.append('media', mediaFile);
        res = await fetch('/api/ai/classify-category', {
          method: 'POST',
          headers,
          body: formData,
        });
      } else {
        res = await fetch('/api/ai/classify-category', {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ problemDescription }),
        });
      }

      if (res.ok) {
        const data: CategoryClassificationResult = await res.json();
        setResult(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to classify service category.');
      }
    } catch {
      setError(
        lang === 'bn'
          ? 'সার্ভার সংযোগে ত্রুটি। অনুগ্রহ করে ম্যানুয়ালি নির্বাচন করুন।'
          : lang === 'hi'
          ? 'सर्वर से कनेक्ट करने में त्रुटि। कृपया मैन्युअल रूप से श्रेणी चुनें।'
          : 'Unable to reach classification service. Please select category manually.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result?.suggestedCategory) {
      onSelectCategory(result.suggestedCategory, result.suggestedSubcategory);
    }
  };

  return (
    <div className="rounded-xl border border-teal-200/80 dark:border-teal-800/80 bg-gradient-to-br from-teal-50/50 via-white to-emerald-50/30 dark:from-teal-950/20 dark:via-slate-900 dark:to-emerald-950/10 p-3.5 space-y-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300">
            <Wand2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>{t.autoClassifyCategoryBtn || 'AI Service Category Auto-Classifier'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-100 dark:bg-teal-900/80 text-teal-800 dark:text-teal-200 font-normal">
                Gemma 4
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === 'bn'
                ? 'আপনার সমস্যার বিবরণ ও ছবি বিশ্লেষণ করে সঠিক মিস্ত্রি বিভাগ শনাক্ত করে।'
                : lang === 'hi'
                ? 'आपकी समस्या के विवरण और तस्वीर से सही कार्य श्रेणी का सुझाव देता है।'
                : 'Analyzes description & defect photo to suggest trade category & skills.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClassify}
          disabled={loading || (!problemDescription.trim() && !mediaFile)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 active:scale-95 text-white text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer shadow-xs"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>
            {loading
              ? t.autoClassifyingBtn || (lang === 'bn' ? 'শনাক্ত হচ্ছে...' : lang === 'hi' ? 'पहचान हो रही है...' : 'Analyzing...')
              : t.autoClassifyCategoryBtn || (lang === 'bn' ? 'Gemma 4 দিয়ে শনাক্ত করুন' : lang === 'hi' ? 'Gemma 4 से श्रेणी पहचानें' : 'Classify with Gemma 4')}
          </span>
        </button>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="p-3 rounded-lg bg-white dark:bg-slate-850 border border-teal-200 dark:border-teal-800 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.suggestedCategoryLabel || 'Suggested Category'}:
              </span>
              <strong className="text-sm font-bold text-teal-800 dark:text-teal-300">
                {result.suggestedCategory}
              </strong>
              {result.suggestedSubcategory && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 font-medium">
                  {result.suggestedSubcategory}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Confidence:</span>
              <span
                className={`font-semibold font-mono ${
                  result.confidenceScore >= 0.8
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : result.confidenceScore >= 0.6
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {Math.round(result.confidenceScore * 100)}%
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-slate-700 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">{t.classificationReasonLabel || 'Reasoning'}:</strong>{' '}
              {result.reasoning}
            </p>
            {result.physicalUncertaintyNote && (
              <p className="text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-1">
                <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>{t.uncertaintyNoteLabel || 'Physical Verification Note'}:</strong>{' '}
                  {result.physicalUncertaintyNote}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleApply}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                currentSelectedCategory === result.suggestedCategory
                  ? 'bg-emerald-700 text-white'
                  : 'bg-teal-700 hover:bg-teal-800 text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {currentSelectedCategory === result.suggestedCategory
                  ? (lang === 'bn' ? '✓ ক্যাটাগরি প্রয়োগ করা হয়েছে' : lang === 'hi' ? '✓ श्रेणी लागू की गई' : '✓ Category Applied')
                  : t.confirmCategoryBtn || (lang === 'bn' ? 'ক্যাটাগরি নিশ্চিত ও প্রয়োগ করুন' : lang === 'hi' ? 'श्रेणी की पुष्टि करें और लागू करें' : 'Confirm & Apply Category')}
              </span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {t.selectManuallyBtn || 'or select any category manually below'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
