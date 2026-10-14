import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Star,
  Briefcase,
  TrendingUp,
  Cpu,
  RefreshCw,
  Printer,
  FileBadge2,
} from 'lucide-react';
import type { WorkerDigitalPassport, WorkerProfile, LanguageCode } from '../types';

interface WorkerDigitalPassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerId?: string;
  worker?: WorkerProfile | null;
  token?: string | null;
  lang?: LanguageCode;
}

export const WorkerDigitalPassportModal: React.FC<WorkerDigitalPassportModalProps> = ({
  isOpen,
  onClose,
  workerId,
  worker,
  token,
  lang = 'en',
}) => {
  const [loading, setLoading] = useState(false);
  const [passport, setPassport] = useState<WorkerDigitalPassport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPassport = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/worker-digital-passport', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workerId: workerId || worker?.id,
          language: lang,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPassport(data.passport);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to generate Worker Digital Passport.');
      }
    } catch {
      setError('Network error contacting Gemma 4 AI service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPassport();
    }
  }, [isOpen, workerId, worker?.id, lang]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl my-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-teal-800/20 dark:border-teal-700/30 overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col max-h-[92vh]">
        {/* Decorative Top Accent Bar */}
        <div className="h-2 w-full bg-linear-to-r from-teal-700 via-emerald-600 to-amber-500" />

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 rounded-xl border border-teal-200 dark:border-teal-800">
              <FileBadge2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Worker Digital Passport
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Google Gemma 4 E4B
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Cooperative Skill Verification & Completed Jobs Credential
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
              <Loader2 className="w-10 h-10 animate-spin text-teal-600 dark:text-teal-400 mx-auto" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Google Gemma 4 E4B is synthesizing verified skills and completed jobs...
              </p>
              <p className="text-xs text-slate-400">
                Auditing authentic database booking records & trade KYC credentials.
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold">Unable to load Digital Passport</p>
                <p className="text-xs mt-1 opacity-90">{error}</p>
                <button
                  onClick={fetchPassport}
                  className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Gemma 4 Inference
                </button>
              </div>
            </div>
          )}

          {passport && !loading && (
            <>
              {/* Technician Identity & Credential Banner */}
              <div className="p-5 rounded-2xl bg-linear-to-br from-teal-50 via-emerald-50/50 to-amber-50/30 dark:from-slate-800 dark:via-teal-950/40 dark:to-slate-850 border border-teal-200/80 dark:border-teal-800/60 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-teal-700 text-white flex items-center justify-center font-bold text-xl shadow-md border-2 border-amber-400/80">
                      {passport.workerName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {passport.workerName}
                        {passport.verified && (
                          <span title="Verified by Cooperative Society" className="inline-flex">
                            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-teal-800 dark:text-teal-300">
                          {passport.category} Technician
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">ID: {passport.workerId}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          KYC {passport.kycStatus === 'VERIFIED' ? 'Verified' : passport.kycStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Total Completed</div>
                      <div className="text-lg font-bold text-teal-700 dark:text-teal-400 font-mono">
                        {passport.totalCompletedJobs} jobs
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Rating</div>
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1 font-mono">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        {passport.averageRating.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Executive Summary by Gemma 4 */}
                <div className="mt-4 pt-4 border-t border-teal-200/50 dark:border-teal-900/60 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="font-semibold text-teal-900 dark:text-teal-200">Executive Summary: </span>
                  {passport.executiveSummary}
                </div>
              </div>

              {/* Verified Skills Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Award className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    Verified Technical Skills
                  </h4>
                  <span className="text-xs text-slate-500">
                    {passport.verifiedSkillsBreakdown.length} Competencies Evaluated
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {passport.verifiedSkillsBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-teal-500/40 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {item.skill}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${
                            item.level === 'MASTER'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                              : item.level === 'PROFICIENT'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-300 dark:border-teal-700'
                          }`}
                        >
                          {item.level}
                        </span>
                      </div>
                      {item.evidenceNote && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">
                          {item.evidenceNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Completed Jobs Volume & Cooperative Standing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Completed Jobs Metrics */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-teal-600" />
                    Completed Jobs Breakdown
                  </h4>
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Total Completed Volume:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {passport.completedJobsSummary.totalVolume} jobs
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Specialized Tasks:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {passport.completedJobsSummary.specializedTasksCount}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Punctuality Score:</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
                        {passport.completedJobsSummary.punctualityRate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cooperative Standing */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Cooperative Society Standing
                  </h4>
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Membership Tier:</span>
                      <span className="font-semibold text-teal-700 dark:text-teal-300">
                        {passport.cooperativeStanding.membershipStatus}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Welfare Contribution:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        ₹{passport.cooperativeStanding.welfareContributionInr}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Settlement Standard:</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                        {passport.cooperativeStanding.fairSettlementRatio}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Career Milestone Advice */}
              {passport.careerMilestoneAdvice && passport.careerMilestoneAdvice.length > 0 && (
                <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200 flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                    Next Cooperative Career Milestones
                  </h4>
                  <ul className="space-y-1.5">
                    {passport.careerMilestoneAdvice.map((advice, i) => (
                      <li key={i} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-teal-600 dark:text-teal-400 font-bold">•</span>
                        <span>{advice}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Data Integrity Notice */}
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{passport.dataIntegrityNotice}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  {passport.modelUsed}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between">
          <button
            onClick={fetchPassport}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Record
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save
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
    </div>
  );
};
