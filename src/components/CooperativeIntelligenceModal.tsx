import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  BarChart3,
  Cpu,
  RefreshCw,
  Coins,
  Compass,
} from 'lucide-react';
import type { CooperativeIntelligenceReport, LanguageCode } from '../types';

interface CooperativeIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string | null;
  lang?: LanguageCode;
}

export const CooperativeIntelligenceModal: React.FC<CooperativeIntelligenceModalProps> = ({
  isOpen,
  onClose,
  token,
  lang = 'en',
}) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CooperativeIntelligenceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligence = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/cooperative-intelligence', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          language: lang,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to generate Cooperative Intelligence Report.');
      }
    } catch {
      setError('Network error contacting Gemma 4 Cooperative Intelligence service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchIntelligence();
    }
  }, [isOpen, lang]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl my-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-teal-800/20 dark:border-teal-700/30 overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col max-h-[92vh]">
        {/* Accent Bar */}
        <div className="h-2 w-full bg-linear-to-r from-teal-700 via-amber-500 to-emerald-600" />

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 rounded-xl border border-teal-200 dark:border-teal-800">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Cooperative Intelligence Command
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Google Gemma 4 E4B
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Executive Synthesis of Booking Trends, Sector Demand & Fair 90:10 Welfare Health
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
                Google Gemma 4 E4B is synthesizing real cooperative booking trends...
              </p>
              <p className="text-xs text-slate-400">
                Evaluating database demand volume, Salt Lake sector clusters, and welfare mutual aid reserves.
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold">Unable to generate Cooperative Intelligence</p>
                <p className="text-xs mt-1 opacity-90">{error}</p>
                <button
                  onClick={fetchIntelligence}
                  className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Gemma 4 Inference
                </button>
              </div>
            </div>
          )}

          {report && !loading && (
            <>
              {/* Executive Metrics Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Total Bookings</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono mt-1">
                    {report.totalBookingsAnalyzed}
                  </div>
                  <div className="text-[11px] text-teal-700 dark:text-teal-400 mt-1 font-medium">
                    Verified in database
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Active Workers</div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-1">
                    {report.totalActiveWorkers}
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-1 font-medium">
                    KYC Verified Ready
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Worker Payouts (90%)</div>
                  <div className="text-2xl font-bold text-teal-700 dark:text-teal-400 font-mono mt-1">
                    ₹{report.fairDispatchHealth.workerPayoutTotalInr.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-teal-600 mt-1 font-medium">
                    Direct fair earnings
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Welfare Fund (10%)</div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">
                    ₹{report.fairDispatchHealth.welfareFundContributionInr.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-amber-600 mt-1 font-medium">
                    Mutual safety reserves
                  </div>
                </div>
              </div>

              {/* Popular Services Ranking */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-teal-600" />
                    Popular Services & Demand Ranking
                  </h4>
                  <span className="text-xs text-slate-500">
                    Real Booking Breakdown
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.popularServicesRanking.map((item) => (
                    <div
                      key={item.category}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs font-bold font-mono">
                            #{item.rank}
                          </span>
                          <span className="font-semibold text-sm text-slate-900 dark:text-white">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-teal-800 dark:text-teal-300 font-mono">
                          {item.bookingCount} bookings ({item.percentage}%)
                        </span>
                      </div>

                      {/* Percentage Bar */}
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-600 dark:bg-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(8, item.percentage))}%` }}
                        />
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {item.trendCommentary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Geographic Hotspots & Fair Dispatch Health */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Geographic Demand Hotspots */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    Geographic Demand Hotspots
                  </h4>
                  <div className="space-y-2">
                    {report.geographicDemandHotspots.map((spot, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex justify-between font-semibold text-slate-900 dark:text-white">
                          <span>{spot.zoneOrSector}</span>
                          <span className="text-teal-700 dark:text-teal-400 font-mono">
                            {spot.demandVolume} request(s)
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">{spot.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fair Dispatch Health */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-600" />
                    Fair Dispatch & 90:10 Health
                  </h4>
                  <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                    <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Status: {report.fairDispatchHealth.fairnessStatus}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {report.fairDispatchHealth.utilizationBalanceComment}
                    </p>
                  </div>
                </div>
              </div>

              {/* Strategic Cooperative Action Items */}
              {report.strategicCooperativeActionItems && report.strategicCooperativeActionItems.length > 0 && (
                <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                    Strategic Directives for Cooperative Managing Committee
                  </h4>
                  <ul className="space-y-1.5">
                    {report.strategicCooperativeActionItems.map((action, i) => (
                      <li key={i} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-teal-600 dark:text-teal-400 font-bold">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Data Integrity Notice */}
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{report.dataIntegrityNotice}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  {report.modelUsed}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between">
          <button
            onClick={fetchIntelligence}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Intelligence
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
