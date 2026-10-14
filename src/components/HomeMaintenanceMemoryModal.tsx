import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Calendar,
  Wrench,
  Sun,
  Cpu,
  RefreshCw,
  Home,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { HomeMaintenanceMemory, LanguageCode } from '../types';

interface HomeMaintenanceMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
  token?: string | null;
  lang?: LanguageCode;
}

export const HomeMaintenanceMemoryModal: React.FC<HomeMaintenanceMemoryModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  token,
  lang = 'en',
}) => {
  const [loading, setLoading] = useState(false);
  const [memory, setMemory] = useState<HomeMaintenanceMemory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMemory = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/home-maintenance-memory', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerId,
          language: lang,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMemory(data.memory);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to retrieve Home Maintenance Memory.');
      }
    } catch {
      setError('Network error contacting Gemma 4 Home Maintenance service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMemory();
    }
  }, [isOpen, customerId, lang]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl my-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-teal-800/20 dark:border-teal-700/30 overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col max-h-[92vh]">
        {/* Accent Bar */}
        <div className="h-2 w-full bg-linear-to-r from-emerald-600 via-teal-700 to-cyan-600" />

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 rounded-xl border border-teal-200 dark:border-teal-800">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Home Maintenance Memory
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-900 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-300 dark:border-teal-700 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Google Gemma 4 E4B
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Customer-Approved Repair History & Preventive Follow-Up Intelligence
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
                Google Gemma 4 E4B is analyzing verified repair history & household fixture memory...
              </p>
              <p className="text-xs text-slate-400">
                Cross-referencing completed technician receipts, past replaced parts, and preventive seasonal needs.
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold">Unable to load Maintenance Memory</p>
                <p className="text-xs mt-1 opacity-90">{error}</p>
                <button
                  onClick={fetchMemory}
                  className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Gemma 4 Inference
                </button>
              </div>
            </div>
          )}

          {memory && !loading && (
            <>
              {/* Household Fixture Health Assessment */}
              <div className="p-5 rounded-2xl bg-linear-to-br from-teal-50 via-emerald-50/50 to-cyan-50/30 dark:from-slate-800 dark:via-teal-950/40 dark:to-slate-850 border border-teal-200 dark:border-teal-800/60 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                      Household Health Status
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      {memory.householdHealthAssessment}
                    </h3>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 text-xs font-semibold text-teal-800 dark:text-teal-300 self-start sm:self-auto">
                    {memory.totalCompletedRepairs} Completed Service(s) on Record
                  </div>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-2 border-t border-teal-200/50 dark:border-teal-900/60">
                  {memory.serviceHistorySummary}
                </p>
              </div>

              {/* Verified Past Repairs Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-teal-600" />
                    Customer-Approved Repair History
                  </h4>
                  <span className="text-xs text-slate-500">
                    {memory.completedRepairs.length} Verified Receipt(s)
                  </span>
                </div>

                {memory.completedRepairs.length > 0 ? (
                  <div className="space-y-2.5">
                    {memory.completedRepairs.map((repair, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white">
                              {repair.category} Service
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              ({repair.bookingReference})
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                              Completed
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Problem Resolved: {repair.resolvedProblem}
                          </p>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Technician: {repair.technicianName}</span>
                            {repair.partsUsedOrEstimated && repair.partsUsedOrEstimated.length > 0 && (
                              <>
                                <span>•</span>
                                <span>Parts: {repair.partsUsedOrEstimated.join(', ')}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 font-mono shrink-0 self-start sm:self-auto">
                          {repair.date}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-850 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-1.5">
                    <Sparkles className="w-6 h-6 text-teal-600 mx-auto" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No Past Completed Repairs Yet
                    </p>
                    <p className="text-xs text-slate-500">
                      As services are performed and approved by you, your home memory timeline will record details automatically.
                    </p>
                  </div>
                )}
              </div>

              {/* Proactive Preventive Follow-Ups */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  Recommended Preventive Follow-Ups (Gemma 4 Suggestions)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {memory.proactiveFollowUps.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800/60 shadow-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-teal-600" />
                          {item.componentOrFixture}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300">
                          {item.recommendedTrade}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{item.urgencyReason}</p>
                      <div className="text-[11px] text-teal-700 dark:text-teal-400 flex items-center gap-1 pt-1 font-mono">
                        <Clock className="w-3 h-3" />
                        Suggested Window: {item.suggestedInspectionDate}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Climate-Specific Seasonal Home Care Tips */}
              {memory.seasonalHomeCareTips && memory.seasonalHomeCareTips.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-600" />
                    Seasonal Kolkata Household Care Advisories
                  </h4>
                  <ul className="space-y-1.5">
                    {memory.seasonalHomeCareTips.map((tip, i) => (
                      <li key={i} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Data Integrity Notice */}
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{memory.dataIntegrityNotice}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  {memory.modelUsed}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between">
          <button
            onClick={fetchMemory}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh History
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-teal-700 hover:bg-teal-800 text-white transition shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
