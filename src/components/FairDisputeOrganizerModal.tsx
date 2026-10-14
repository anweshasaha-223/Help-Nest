import React, { useState, useEffect } from 'react';
import {
  X,
  Scale,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Users,
  FileText,
  Cpu,
  RefreshCw,
  Handshake,
  Check,
} from 'lucide-react';
import type { FairDisputeDossier, LanguageCode } from '../types';

interface FairDisputeOrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  disputeId?: string;
  bookingReference?: string;
  token?: string | null;
  lang?: LanguageCode;
}

export const FairDisputeOrganizerModal: React.FC<FairDisputeOrganizerModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  disputeId,
  bookingReference,
  token,
  lang = 'en',
}) => {
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState<FairDisputeDossier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDossier = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/fair-dispute-organizer', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bookingId,
          disputeId,
          language: lang,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDossier(data.dossier);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to generate Fair Dispute Dossier.');
      }
    } catch {
      setError('Network error contacting Gemma 4 Fair Dispute service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchDossier();
    }
  }, [isOpen, bookingId, disputeId, lang]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl my-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-amber-800/20 dark:border-amber-700/30 overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col max-h-[92vh]">
        {/* Top Accent Bar */}
        <div className="h-2 w-full bg-linear-to-r from-amber-600 via-teal-700 to-emerald-600" />

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Fair Dispute Organizer
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Google Gemma 4 E4B
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Neutral, Unbiased Dispute Synthesis Grounded in Booking Records & Field Notes
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
                Google Gemma 4 E4B is synthesizing an unbiased dispute resolution dossier...
              </p>
              <p className="text-xs text-slate-400">
                Analyzing customer booking facts, technician on-site notes, and mutual cooperative bylaws.
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold">Unable to generate Dispute Dossier</p>
                <p className="text-xs mt-1 opacity-90">{error}</p>
                <button
                  onClick={fetchDossier}
                  className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Gemma 4 Inference
                </button>
              </div>
            </div>
          )}

          {dossier && !loading && (
            <>
              {/* Impartial Overview Card */}
              <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 shadow-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                    Booking Ref: {dossier.bookingReference || bookingReference} • {dossier.category}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Logged: {new Date(dossier.generatedAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Impartial Ombudsman Summary
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
                  {dossier.impartialSummary}
                </p>
              </div>

              {/* Side-by-Side: Customer vs Worker Perspective */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Perspective */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-teal-600" />
                      Customer Position
                    </span>
                    {dossier.customerPerspective.feedbackRating && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-bold">
                        ★ {dossier.customerPerspective.feedbackRating} / 5
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">Reported Problem:</div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 italic">
                    "{dossier.customerPerspective.reportedIssue}"
                  </p>
                  {dossier.customerPerspective.reviewComment && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                      Feedback: {dossier.customerPerspective.reviewComment}
                    </p>
                  )}
                </div>

                {/* Worker Perspective */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      Technician Service Record
                    </span>
                    <span className="text-xs text-slate-500">
                      {dossier.workerPerspective.recordedNotesCount} field note(s)
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">Assigned: {dossier.workerPerspective.workerName}</div>
                  <div className="space-y-1 pt-1">
                    {dossier.workerPerspective.onSiteObservations.length > 0 ? (
                      dossier.workerPerspective.onSiteObservations.map((obs, i) => (
                        <div key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{obs}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">Standard on-site completion recorded.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Factual Event Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  Chronological Event Timeline
                </h4>
                <div className="space-y-2">
                  {dossier.timeline.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-start gap-3"
                    >
                      <div className="w-2 h-2 rounded-full bg-teal-600 dark:bg-teal-400 mt-1.5 shrink-0" />
                      <div className="flex-1 text-xs sm:text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.stage}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mt-0.5">{item.recordedFact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Common Ground Facts */}
              {dossier.commonGroundFacts && dossier.commonGroundFacts.length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Identified Common Ground Facts
                  </h4>
                  {dossier.commonGroundFacts.map((fact, idx) => (
                    <p key={idx} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{fact}</span>
                    </p>
                  ))}
                </div>
              )}

              {/* Proposed Cooperative Remedies */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Handshake className="w-3.5 h-3.5 text-amber-600" />
                  Proposed Cooperative Remedies (Bylaw Grounded)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dossier.proposedCooperativeRemedies.map((remedy, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-xs space-y-1.5"
                    >
                      <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        {remedy.remedyTitle}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{remedy.description}</p>
                      <div className="pt-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        Grounding: {remedy.groundedInBylaws}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Audit Notice */}
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{dossier.dataAuditNotice}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  {dossier.modelUsed}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between">
          <button
            onClick={fetchDossier}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Analysis
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-teal-700 hover:bg-teal-800 text-white transition shadow-sm"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
