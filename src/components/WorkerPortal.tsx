import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Play,
  Award,
  FileText,
  MapPin,
  ShieldCheck,
  Clock,
  Wallet,
  UserCheck,
  AlertCircle,
  Database,
  Trash2,
  RefreshCw,
  X,
  Search,
  Phone,
  Calendar,
  Coins,
  Sliders,
  Scale,
  Shield,
  Info,
  ChevronDown,
  ChevronUp,
  Siren,
  AlertTriangle,
  HeartHandshake,
  Users,
  Tag,
  Send,
  Mic,
  MicOff,
  Vote,
  Handshake,
  Timer,
  CheckSquare,
  Sparkles,
  Plus,
  ThumbsUp,
  ThumbsDown,
  ShieldAlert,
  QrCode,
  CreditCard,
  Banknote,
  BookOpen,
  Bell,
  ExternalLink,
  Image as ImageIcon,
  GraduationCap,
  Star,
  Navigation,
} from 'lucide-react';
import type {
  WorkerProfile,
  BookingRecord,
  BookingStatus,
  ShiftPreference,
  Coordinates,
  WelfareLedgerEntry,
  EmergencyAlert,
  CommunityBulkBooking,
  DisputeRecord,
  DisputeCategory,
  WelfareRequest,
  WelfareBenefitCategory,
  CollaborationRequest,
  CollaborationStatus,
  TimeProtectionRecord,
  CancellationProtectionReason,
  SparePartItem,
  SparePartsEstimateRecord,
  CoopProposal,
  CoopProposalCategory,
  SafeVisitAction,
  SafeVisitLogRecord,
  ProblemReport,
} from '../types';
import {
  type LanguageCode,
  translateCategory,
  translateSlot,
  translateUrgency,
  translateArea,
  translateStatus,
} from '../i18n/translations';
import { LiveTrackingMap } from './LiveTrackingMap';
import { ProblemReportingModal } from './ProblemReportingModal';
import { JobNotesModal } from './JobNotesModal';
import { DemoPaymentModal } from './DemoPaymentModal';
import { AiComplaintToActionModal } from './AiComplaintToActionModal';
import { AiRepairReportModal } from './AiRepairReportModal';
import { AiCoopRuleExplainer } from './AiCoopRuleExplainer';
import { WorkerLearnSection } from './WorkerLearnSection';
import { EarningsChart } from './EarningsChart';
import { WorkerDigitalPassportModal } from './WorkerDigitalPassportModal';
import { CustomerRatingInsightsModal } from './CustomerRatingInsightsModal';
import { FairDisputeOrganizerModal } from './FairDisputeOrganizerModal';
import { FileBadge2 } from 'lucide-react';
import {
  loadLocalJobNotes,
  syncPendingNotesToServer,
  getPendingOfflineNotesCount,
  mergeServerAndLocalNotes,
} from '../services/jobNotesService';
import type { JobNote } from '../types';

// Dedicated browser localStorage keys for Worker offline management
const WORKER_OFFLINE_STORAGE_KEY = 'helpnest_worker_offline_bookings';
const WORKER_PENDING_QUEUE_KEY = 'helpnest_worker_pending_sync_queue';

// Status progression rank order to prevent overwriting newer progress with older offline states
const STATUS_PROGRESSION_RANK: Record<string, number> = {
  PENDING: 1,
  ACCEPTED: 2,
  IN_PROGRESS: 3,
  COMPLETED: 4,
  REJECTED: 4,
  CANCELLED: 4,
};

function loadWorkerOfflineBookings(): BookingRecord[] {
  try {
    const raw = localStorage.getItem(WORKER_OFFLINE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse offline bookings from localStorage:', err);
    return [];
  }
}

function saveWorkerOfflineBookings(list: BookingRecord[]): void {
  try {
    localStorage.setItem(WORKER_OFFLINE_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to write offline bookings to localStorage:', err);
  }
}

function mergeWorkerBookings(
  existingList: BookingRecord[],
  incomingList: BookingRecord[]
): BookingRecord[] {
  const map = new Map<string, BookingRecord>();

  // Populate from existing local records
  for (const b of existingList) {
    if (b && (b.id || b.bookingReference)) {
      map.set(b.id || b.bookingReference, b);
    }
  }

  // Merge incoming records with safe conflict resolution
  for (const inc of incomingList) {
    if (!inc || (!inc.id && !inc.bookingReference)) continue;
    const key = inc.id || inc.bookingReference;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...inc, updatedAt: inc.updatedAt || new Date().toISOString() });
    } else {
      const existingRank = STATUS_PROGRESSION_RANK[existing.status] || 0;
      const incRank = STATUS_PROGRESSION_RANK[inc.status] || 0;

      // Safe conflict resolution: Never overwrite newer server/progress status with older status
      if (incRank >= existingRank) {
        map.set(key, {
          ...existing,
          ...inc,
          updatedAt: inc.updatedAt || existing.updatedAt || new Date().toISOString(),
        });
      } else {
        // Keep existing higher status progress
        map.set(key, {
          ...inc,
          status: existing.status,
          updatedAt: existing.updatedAt || inc.updatedAt,
        });
      }
    }
  }

  const merged = Array.from(map.values()).sort((a, b) => {
    const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tB - tA;
  });

  saveWorkerOfflineBookings(merged);
  return merged;
}

interface WorkerPortalProps {
  worker: WorkerProfile;
  token: string;
  activeTab: 'jobs' | 'earnings' | 'cooperativeFund' | 'profile' | 'collaboration' | 'voting' | 'rules' | 'learn';
  setActiveTab: (tab: 'jobs' | 'earnings' | 'cooperativeFund' | 'profile' | 'collaboration' | 'voting' | 'rules' | 'learn') => void;
  bookings: BookingRecord[];
  onRefreshData: () => Promise<void>;
  onStatusUpdated?: (booking: BookingRecord, nextStatus: BookingStatus) => void;
  t: Record<string, string>;
  lang?: LanguageCode;
  isOnline: boolean;
}

export const WorkerPortal: React.FC<WorkerPortalProps> = ({
  worker,
  token,
  activeTab,
  setActiveTab,
  bookings,
  onRefreshData,
  onStatusUpdated,
  t,
  lang = 'en',
  isOnline,
}) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Google Gemma 4 E4B Modal States
  const [showWorkerPassportModal, setShowWorkerPassportModal] = useState(false);
  const [showRatingInsightsModal, setShowRatingInsightsModal] = useState(false);
  const [workerDisputeBooking, setWorkerDisputeBooking] = useState<BookingRecord | null>(null);

  // Requirement 1: Configurable Cooperative Profit-Sharing Split Setting (stored in settings)
  const [splitSetting, setSplitSetting] = useState<{
    workerSharePercent: number;
    coopFundPercent: number;
  }>(() => {
    try {
      const raw = localStorage.getItem('helpnest_coop_split_setting');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.workerSharePercent === 'number') {
          const w = Math.max(50, Math.min(99, Math.round(parsed.workerSharePercent)));
          return { workerSharePercent: w, coopFundPercent: 100 - w };
        }
      }
    } catch {
      // fallback to standard default
    }
    return { workerSharePercent: 90, coopFundPercent: 10 };
  });

  const handleUpdateSplit = (workerPercent: number) => {
    const valid = Math.max(50, Math.min(99, Math.round(workerPercent)));
    const updated = { workerSharePercent: valid, coopFundPercent: 100 - valid };
    setSplitSetting(updated);
    try {
      localStorage.setItem('helpnest_coop_split_setting', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Cooperative Ledger State
  const [serverLedger, setServerLedger] = useState<WelfareLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Local storage & offline state
  const [savedOfflineBookings, setSavedOfflineBookings] = useState<BookingRecord[]>(() =>
    loadWorkerOfflineBookings()
  );
  const [showLocalStorageModal, setShowLocalStorageModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BookingStatus>('ALL');
  const [syncStatus, setSyncStatus] = useState<string>('Sync Pending Connection');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Gemma 4 Modal states for Worker
  const [selectedComplaintJob, setSelectedComplaintJob] = useState<BookingRecord | null>(null);
  const [selectedReportJob, setSelectedReportJob] = useState<BookingRecord | null>(null);

  // Online / Offline tracking via browser online/offline events
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : isOnline
  );
  const effectiveOnline = browserOnline && isOnline;

  const [showDistributionGuide, setShowDistributionGuide] = useState(false);
  const [totalSocietyFund, setTotalSocietyFund] = useState<number>(28400);

  // Feature 2: Worker Emergency SOS
  const [showSosConfirmModal, setShowSosConfirmModal] = useState(false);
  const [activeSosAlert, setActiveSosAlert] = useState<EmergencyAlert | null>(null);
  const [sendingSos, setSendingSos] = useState(false);
  const [cancellingSos, setCancellingSos] = useState(false);
  const [shareLocationWithSos, setShareLocationWithSos] = useState(false);

  // Feature 1: Price Revision Proposal
  const [adjustingPriceJob, setAdjustingPriceJob] = useState<BookingRecord | null>(null);
  const [proposedLaborInr, setProposedLaborInr] = useState<number>(worker.baseRateInr);
  const [proposedMaterialsInr, setProposedMaterialsInr] = useState<number>(0);
  const [proposedMaterialsNote, setProposedMaterialsNote] = useState<string>('');
  const [revisionReason, setRevisionReason] = useState<string>('');
  const [submittingRevision, setSubmittingRevision] = useState(false);

  // Feature 3: Community Bulk Booking
  const [communityBulkList, setCommunityBulkList] = useState<CommunityBulkBooking[]>([]);
  const [loadingBulk, setLoadingBulk] = useState(false);
  const [acceptingBulkId, setAcceptingBulkId] = useState<string | null>(null);

  // Feature 4: Worker Dispute Resolution
  const [disputeModalJob, setDisputeModalJob] = useState<BookingRecord | null>(null);
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategory>('PRICING_DISAGREEMENT');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [workerDisputes, setWorkerDisputes] = useState<DisputeRecord[]>([]);

  // Feature 5: Worker Welfare Assistance
  const [welfareBenefitCategory, setWelfareBenefitCategory] = useState<WelfareBenefitCategory>('TRAINING_SUPPORT');
  const [welfareAmountInr, setWelfareAmountInr] = useState<number>(2000);
  const [welfareReason, setWelfareReason] = useState<string>('');
  const [submittingWelfare, setSubmittingWelfare] = useState(false);
  const [welfareRequests, setWelfareRequests] = useState<WelfareRequest[]>([]);

  // FEATURE 1: WORKER-TO-WORKER HELP NETWORK
  const [collabRequests, setCollabRequests] = useState<CollaborationRequest[]>([]);
  const [loadingCollab, setLoadingCollab] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabModalJob, setCollabModalJob] = useState<BookingRecord | null>(null);
  const [collabSkill, setCollabSkill] = useState('');
  const [collabDuration, setCollabDuration] = useState(2);
  const [collabNotes, setCollabNotes] = useState('');
  const [collabAiSummary, setCollabAiSummary] = useState('');
  const [analyzingCollabAi, setAnalyzingCollabAi] = useState(false);
  const [submittingCollab, setSubmittingCollab] = useState(false);
  const [acceptingCollabId, setAcceptingCollabId] = useState<string | null>(null);

  // Requirement 5: Real-Time Worker GPS Tracking
  const [activeTrackingJobId, setActiveTrackingJobId] = useState<string | null>(null);
  const [gpsErrorText, setGpsErrorText] = useState<string | null>(null);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);

  // FEATURE 3: WORKER TIME PROTECTION (CANCELLATION COMPENSATION)
  const [showTimeProtectionModal, setShowTimeProtectionModal] = useState(false);
  const [timeProtectionJob, setTimeProtectionJob] = useState<BookingRecord | null>(null);
  const [timeProtReason, setTimeProtReason] = useState<CancellationProtectionReason>('CUSTOMER_NO_SHOW');
  const [timeProtDetails, setTimeProtDetails] = useState('');
  const [timeProtDistKm, setTimeProtDistKm] = useState(3.5);
  const [timeProtWastedMins, setTimeProtWastedMins] = useState(45);
  const [submittingTimeProt, setSubmittingTimeProt] = useState(false);
  const [timeProtectionRecords, setTimeProtectionRecords] = useState<TimeProtectionRecord[]>([]);

  // FEATURE 4: SMART SPARE PARTS ESTIMATOR (GEMMA 4)
  const [sparePartsJob, setSparePartsJob] = useState<BookingRecord | null>(null);
  const [sparePartsItems, setSparePartsItems] = useState<SparePartItem[]>([]);
  const [sparePartsLaborInr, setSparePartsLaborInr] = useState<number>(worker.baseRateInr);
  const [generatingPartsAi, setGeneratingPartsAi] = useState(false);
  const [submittingPartsEstimate, setSubmittingPartsEstimate] = useState(false);
  const [newPartName, setNewPartName] = useState('');
  const [newPartQty, setNewPartQty] = useState(1);
  const [newPartPrice, setNewPartPrice] = useState(100);
  const [sparePartsEstimates, setSparePartsEstimates] = useState<SparePartsEstimateRecord[]>([]);

  // FEATURE 5: WORKER COOPERATIVE VOTING
  const [coopProposals, setCoopProposals] = useState<CoopProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [showNewProposalModal, setShowNewProposalModal] = useState(false);
  const [newProposalTitle, setNewProposalTitle] = useState('');
  const [newProposalDesc, setNewProposalDesc] = useState('');
  const [newProposalCategory, setNewProposalCategory] = useState<CoopProposalCategory>('TRAINING');
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [votingProposalId, setVotingProposalId] = useState<string | null>(null);

  // FEATURE 6: SAFE VISIT CHECK-IN
  const [safeVisitLogs, setSafeVisitLogs] = useState<SafeVisitLogRecord[]>([]);
  const [sharedSupportPhone] = useState('+91 98300 00112 (Coop Safety Desk)');
  const [paymentModalJob, setPaymentModalJob] = useState<BookingRecord | null>(null);
  const [manualReminderMinutes, setManualReminderMinutes] = useState<number | null>(null);
  const [manualReminderSecondsLeft, setManualReminderSecondsLeft] = useState<number | null>(null);
  const [activeReminderJobId, setActiveReminderJobId] = useState<string | null>(null);
  const [safeActionLoading, setSafeActionLoading] = useState<string | null>(null);

  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechTextInput, setSpeechTextInput] = useState('');
  const [speechResponse, setSpeechResponse] = useState<string | null>(null);
  const [processingSpeech, setProcessingSpeech] = useState(false);

  // Problem Reporting & Gemma 4 AI Analysis for Worker
  const [problemModalJob, setProblemModalJob] = useState<BookingRecord | null>(null);
  const [problemReports, setProblemReports] = useState<ProblemReport[]>([]);

  const fetchWorkerProblemReports = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    try {
      const res = await fetch('/api/problem-reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProblemReports(data.reports || []);
      }
    } catch {
      // offline fallback
    }
  }, [token, effectiveOnline]);

  // FEATURE: WORKER OFFLINE JOB NOTES & AUTO-SYNC
  const [jobNotesModalBooking, setJobNotesModalBooking] = useState<BookingRecord | null>(null);
  const [workerJobNotes, setWorkerJobNotes] = useState<JobNote[]>(() => loadLocalJobNotes(worker.id));
  const [pendingNotesCount, setPendingNotesCount] = useState<number>(() => getPendingOfflineNotesCount(worker.id));

  const refreshWorkerNotesState = useCallback(() => {
    const local = loadLocalJobNotes(worker.id);
    setWorkerJobNotes(local);
    setPendingNotesCount(getPendingOfflineNotesCount(worker.id));
  }, [worker.id]);

  const fetchServerJobNotes = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    try {
      const res = await fetch(`/api/worker/job-notes?workerId=${worker.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notes)) {
          const merged = mergeServerAndLocalNotes(data.notes, worker.id);
          setWorkerJobNotes(merged);
          setPendingNotesCount(getPendingOfflineNotesCount(worker.id));
        }
      }
    } catch {
      // offline fallback
    }
  }, [token, effectiveOnline, worker.id]);

  // Fetch cooperative ledger from server
  const fetchCoopLedger = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    setLoadingLedger(true);
    try {
      const res = await fetch('/api/cooperative/ledger', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setServerLedger(data.ledger || []);
        if (data.summary?.totalSocietyFundInr) {
          setTotalSocietyFund(data.summary.totalSocietyFundInr);
        }
      }
    } catch {
      // offline fallback
    } finally {
      setLoadingLedger(false);
    }
  }, [token, effectiveOnline]);

  const fetchWorkerAlerts = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    try {
      const res = await fetch('/api/emergency/alerts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const active = (data.alerts as EmergencyAlert[]).find(
          (a) => a.workerId === worker.id && a.status === 'ACTIVE_DEMO'
        );
        setActiveSosAlert(active || null);
      }
    } catch {
      // offline fallback
    }
  }, [token, effectiveOnline, worker.id]);

  const handleSendSosAlert = async () => {
    setSendingSos(true);
    try {
      const activeJob = bookings.find(
        (b) => b.workerId === worker.id && (b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS')
      );

      let coordsToShare = shareLocationWithSos ? worker.coordinates : undefined;
      if (shareLocationWithSos && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition | null>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (p) => resolve(p),
              () => resolve(null),
              { timeout: 3000 }
            );
          });
          if (pos) {
            coordsToShare = {
              lat: Number(pos.coords.latitude.toFixed(6)),
              lng: Number(pos.coords.longitude.toFixed(6)),
              addressLabel: worker.coordinates?.addressLabel || 'Current Device Location',
            };
          }
        } catch {
          // Keep worker.coordinates
        }
      }

      const res = await fetch('/api/emergency/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workerId: worker.id,
          bookingId: activeJob?.id,
          shareLocation: shareLocationWithSos,
          coordinates: coordsToShare,
        }),
      });
      const data = await res.json();
      if (res.ok && data.alert) {
        setActiveSosAlert(data.alert);
        setShowSosConfirmModal(false);
        setStatusFeedback({
          type: 'success',
          text: 'DEMO ALERT SENT: Emergency alert transmitted to Cooperative Safety Dispatch.',
        });
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Failed to trigger SOS alert.' });
      }
    } catch (err: any) {
      console.warn('SOS dispatch failed:', err);
      setStatusFeedback({ type: 'error', text: 'Network error triggering SOS alert.' });
    } finally {
      setSendingSos(false);
    }
  };

  const handleCancelSosAlert = async () => {
    if (!activeSosAlert) return;
    setCancellingSos(true);
    try {
      const res = await fetch(`/api/emergency/alerts/${activeSosAlert.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'CANCELLED_FALSE_ALARM',
          cancellationReason: 'Worker cancelled alert as false alarm from Worker Dashboard',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveSosAlert(null);
        setStatusFeedback({
          type: 'success',
          text: 'SOS alert cancelled. Status marked as false alarm.',
        });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error cancelling alert.' });
    } finally {
      setCancellingSos(false);
    }
  };

  const fetchCommunityBulk = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    setLoadingBulk(true);
    try {
      const res = await fetch('/api/community-bulk', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCommunityBulkList(data.bulkBookings || []);
      }
    } catch {
      // offline fallback
    } finally {
      setLoadingBulk(false);
    }
  }, [token, effectiveOnline]);

  const handleAcceptCommunityBulk = async (bulkId: string) => {
    setAcceptingBulkId(bulkId);
    setStatusFeedback(null);
    try {
      const res = await fetch(`/api/community-bulk/${bulkId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: data.message || 'Accepted group request! Individual households assigned.',
        });
        await fetchCommunityBulk();
        await onRefreshData();
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Failed to accept group booking.' });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error accepting group booking.' });
    } finally {
      setAcceptingBulkId(null);
    }
  };

  const fetchWorkerDisputes = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    try {
      const res = await fetch('/api/disputes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWorkerDisputes(data.disputes || []);
      }
    } catch {
      // offline fallback
    }
  }, [token, effectiveOnline]);

  const handleWorkerSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModalJob) return;
    setSubmittingDispute(true);
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: disputeModalJob.id,
          category: disputeCategory,
          description: disputeDescription,
          evidenceNote: disputeEvidence,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: `Complaint ${data.complaintReference || ''} submitted successfully for review.`,
        });
        setDisputeModalJob(null);
        setDisputeDescription('');
        setDisputeEvidence('');
        await fetchWorkerDisputes();
        await onRefreshData();
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Failed to submit dispute.' });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error submitting dispute.' });
    } finally {
      setSubmittingDispute(false);
    }
  };

  const fetchWorkerWelfareRequests = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    try {
      const res = await fetch('/api/welfare/requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWelfareRequests(data.requests || []);
      }
    } catch {
      // offline fallback
    }
  }, [token, effectiveOnline]);

  const handleSubmitWelfareRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!welfareReason.trim()) return;
    setSubmittingWelfare(true);
    try {
      const res = await fetch('/api/welfare/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          benefitCategory: welfareBenefitCategory,
          requestedAmountInr: welfareAmountInr,
          reason: welfareReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: data.message || 'Demo welfare assistance request submitted for society review.',
        });
        setWelfareReason('');
        await fetchWorkerWelfareRequests();
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Failed to submit welfare request.' });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error submitting welfare request.' });
    } finally {
      setSubmittingWelfare(false);
    }
  };

  const handleProposePriceRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingPriceJob || !revisionReason.trim()) return;
    setSubmittingRevision(true);
    try {
      const res = await fetch(`/api/bookings/${adjustingPriceJob.id}/propose-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          laborInr: proposedLaborInr,
          materialsInr: proposedMaterialsInr,
          materialsNote: proposedMaterialsNote,
          reason: revisionReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: data.message || 'Price adjustment proposal sent to customer for approval.',
        });
        setAdjustingPriceJob(null);
        setRevisionReason('');
        setProposedMaterialsNote('');
        await onRefreshData();
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Failed to propose price revision.' });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error proposing price revision.' });
    } finally {
      setSubmittingRevision(false);
    }
  };

  // FEATURE 1: WORKER-TO-WORKER HELP NETWORK HANDLERS
  const fetchCollaborationRequests = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    setLoadingCollab(true);
    try {
      const res = await fetch('/api/collaboration/requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCollabRequests(data.requests || []);
      }
    } catch {
      // offline fallback
    } finally {
      setLoadingCollab(false);
    }
  }, [token, effectiveOnline]);

  const handleAiSuggestCollab = async (desc: string, cat: string) => {
    setAnalyzingCollabAi(true);
    try {
      const res = await fetch('/api/collaboration/ai-suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          problemDescription: desc,
          category: cat,
          currentSkills: collabSkill ? [collabSkill] : [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCollabAiSummary(data.jobSummary || '');
        if (data.suggestedSkills && data.suggestedSkills.length > 0 && !collabSkill) {
          setCollabSkill(data.suggestedSkills[0]);
        }
        if (data.expectedDurationHours) {
          setCollabDuration(data.expectedDurationHours);
        }
      }
    } catch {
      // fallback summary
      setCollabAiSummary(`${cat} task: ${desc.slice(0, 70)} (Requires dual-technician collaboration).`);
    } finally {
      setAnalyzingCollabAi(false);
    }
  };

  const handleCreateCollaborationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabSkill.trim()) return;
    setSubmittingCollab(true);
    try {
      const res = await fetch('/api/collaboration/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: collabModalJob?.id,
          bookingReference: collabModalJob?.bookingReference,
          requiredSkill: collabSkill,
          serviceCategory: collabModalJob?.workerCategory || worker.category,
          jobLocationArea: worker.coordinates?.addressLabel || worker.serviceZone,
          expectedDurationHours: collabDuration,
          jobSummary: collabAiSummary || `${worker.category} assistance needed for ${collabSkill}`,
          notes: collabNotes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: data.message || 'Collaboration request broadcast to eligible cooperative workers [DEMO].',
        });
        setShowCollabModal(false);
        setCollabModalJob(null);
        setCollabSkill('');
        setCollabNotes('');
        setCollabAiSummary('');
        await fetchCollaborationRequests();
        await onRefreshData();
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Failed to create collaboration request.' });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error creating collaboration request.' });
    } finally {
      setSubmittingCollab(false);
    }
  };

  const handleAcceptCollaboration = async (requestId: string) => {
    setAcceptingCollabId(requestId);
    try {
      const res = await fetch(`/api/collaboration/requests/${requestId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: data.message || 'Collaboration accepted! Contact your peer.',
        });
        await fetchCollaborationRequests();
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Failed to accept collaboration.' });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error accepting collaboration.' });
    } finally {
      setAcceptingCollabId(null);
    }
  };

  const handleUpdateCollaborationStatus = async (requestId: string, status: CollaborationStatus) => {
    try {
      const res = await fetch(`/api/collaboration/requests/${requestId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: data.message || `Collaboration status updated to ${status}.`,
        });
        await fetchCollaborationRequests();
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error updating collaboration status.' });
    }
  };

  // FEATURE 3: WORKER TIME PROTECTION HANDLERS
  const fetchTimeProtectionRecords = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    try {
      const res = await fetch('/api/time-protection/records', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTimeProtectionRecords(data.records || []);
      }
    } catch {
      // offline fallback
    }
  }, [token, effectiveOnline]);

  const handleRecordTimeProtection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeProtectionJob) return;
    setSubmittingTimeProt(true);
    try {
      const res = await fetch('/api/time-protection/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: timeProtectionJob.id,
          cancellationReason: timeProtReason,
          reasonDetails: timeProtDetails,
          travelDistanceKm: timeProtDistKm,
          wastedTimeMinutes: timeProtWastedMins,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: `Time Protection recorded: ₹${data.record.estimatedDemoCompensationInr} estimated demo compensation.`,
        });
        setShowTimeProtectionModal(false);
        setTimeProtectionJob(null);
        setTimeProtDetails('');
        await fetchTimeProtectionRecords();
        await onRefreshData();
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Failed to record time protection.' });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error recording time protection.' });
    } finally {
      setSubmittingTimeProt(false);
    }
  };

  // FEATURE 4: SMART SPARE PARTS ESTIMATOR HANDLERS
  const fetchSparePartsEstimates = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    try {
      const res = await fetch('/api/spare-parts/estimates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSparePartsEstimates(data.estimates || []);
      }
    } catch {
      // offline fallback
    }
  }, [token, effectiveOnline]);

  const handleOpenSparePartsModal = (job: BookingRecord) => {
    setSparePartsJob(job);
    setSparePartsLaborInr(job.workerShareInr || worker.baseRateInr);
    // If existing estimate found, populate items
    const existing = sparePartsEstimates.find((e) => e.bookingId === job.id);
    if (existing) {
      setSparePartsItems(existing.items);
      setSparePartsLaborInr(existing.laborChargeInr);
    } else {
      // Clear or pre-generate with Gemma 4
      handleGeneratePartsAi(job);
    }
  };

  const handleGeneratePartsAi = async (job: BookingRecord) => {
    setGeneratingPartsAi(true);
    try {
      const res = await fetch('/api/spare-parts/ai-estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          problemDescription: job.problemDescription,
          category: job.workerCategory,
          workerBaseRate: worker.baseRateInr,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSparePartsItems(data.items || []);
        if (data.suggestedLaborInr) setSparePartsLaborInr(data.suggestedLaborInr);
      }
    } catch {
      // fallback defaults
    } finally {
      setGeneratingPartsAi(false);
    }
  };

  const handleAddSparePartItem = () => {
    if (!newPartName.trim()) return;
    const newItem: SparePartItem = {
      id: `item-${Date.now()}`,
      name: newPartName.trim(),
      quantity: Math.max(1, newPartQty),
      unit: 'pc',
      estimatedUnitPriceInr: Math.max(0, newPartPrice),
      totalPriceInr: Math.max(1, newPartQty) * Math.max(0, newPartPrice),
      isCustomAdded: true,
    };
    setSparePartsItems([...sparePartsItems, newItem]);
    setNewPartName('');
    setNewPartQty(1);
    setNewPartPrice(100);
  };

  const handleRemoveSparePartItem = (id: string) => {
    setSparePartsItems(sparePartsItems.filter((i) => i.id !== id));
  };

  const handleUpdateSparePartQty = (id: string, qty: number) => {
    setSparePartsItems(
      sparePartsItems.map((i) =>
        i.id === id
          ? { ...i, quantity: Math.max(1, qty), totalPriceInr: Math.max(1, qty) * i.estimatedUnitPriceInr }
          : i
      )
    );
  };

  const handleUpdateSparePartPrice = (id: string, price: number) => {
    setSparePartsItems(
      sparePartsItems.map((i) =>
        i.id === id
          ? { ...i, estimatedUnitPriceInr: Math.max(0, price), totalPriceInr: i.quantity * Math.max(0, price) }
          : i
      )
    );
  };

  const handleSubmitSparePartsEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sparePartsJob || sparePartsItems.length === 0) return;
    setSubmittingPartsEstimate(true);
    try {
      const res = await fetch('/api/spare-parts/estimates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: sparePartsJob.id,
          items: sparePartsItems,
          laborChargeInr: sparePartsLaborInr,
          workerNotes: `Submitted by ${worker.name}. Customer approval required before changing invoice.`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: data.message || 'Spare parts estimate submitted. Awaiting customer confirmation.',
        });
        setSparePartsJob(null);
        await fetchSparePartsEstimates();
        await onRefreshData();
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Failed to submit estimate.' });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error submitting estimate.' });
    } finally {
      setSubmittingPartsEstimate(false);
    }
  };

  // FEATURE 5: WORKER COOPERATIVE VOTING HANDLERS
  const fetchCoopProposals = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    setLoadingProposals(true);
    try {
      const res = await fetch('/api/coop/proposals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCoopProposals(data.proposals || []);
      }
    } catch {
      // offline fallback
    } finally {
      setLoadingProposals(false);
    }
  }, [token, effectiveOnline]);

  const handleVoteProposal = async (proposalId: string, voteType: 'FOR' | 'AGAINST') => {
    setVotingProposalId(proposalId);
    try {
      const res = await fetch(`/api/coop/proposals/${proposalId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ voteType }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: data.message || `Vote recorded: ${voteType} [DEMO].`,
        });
        await fetchCoopProposals();
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Duplicate vote or voting error.' });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error casting vote.' });
    } finally {
      setVotingProposalId(null);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProposalTitle.trim() || !newProposalDesc.trim()) return;
    setSubmittingProposal(true);
    try {
      const res = await fetch('/api/coop/proposals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newProposalTitle,
          description: newProposalDesc,
          category: newProposalCategory,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: data.message || 'New cooperative proposal published for member voting [DEMO].',
        });
        setShowNewProposalModal(false);
        setNewProposalTitle('');
        setNewProposalDesc('');
        await fetchCoopProposals();
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Failed to create proposal.' });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error submitting proposal.' });
    } finally {
      setSubmittingProposal(false);
    }
  };

  // FEATURE 6: SAFE VISIT CHECK-IN HANDLERS
  const fetchSafeVisitLogs = useCallback(async () => {
    if (!token || !effectiveOnline) return;
    try {
      const res = await fetch('/api/safe-visit/logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSafeVisitLogs(data.logs || []);
      }
    } catch {
      // offline fallback
    }
  }, [token, effectiveOnline]);

  const handleSafeVisitAction = async (job: BookingRecord, action: SafeVisitAction) => {
    setSafeActionLoading(`${job.id}-${action}`);
    try {
      const res = await fetch('/api/safe-visit/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: job.id,
          action,
          sharedContactName: 'Cooperative Safety Dispatch',
          sharedContactPhone: sharedSupportPhone,
          safetyNote: action === 'REQUEST_ASSISTANCE' ? 'Worker flagged urgent assistance required on-site' : undefined,
          manualReminderMinutes: manualReminderMinutes || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: data.message || `Safe visit action: ${action} recorded.`,
        });
        await fetchSafeVisitLogs();
        await onRefreshData();
      } else {
        setStatusFeedback({ type: 'error', text: data.error || 'Failed to record safe visit.' });
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error recording safe visit.' });
    } finally {
      setSafeActionLoading(null);
    }
  };

  // Manual timer countdown effect for Safe Visit Check-in
  useEffect(() => {
    if (manualReminderSecondsLeft === null || manualReminderSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setManualReminderSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setStatusFeedback({
            type: 'error',
            text: `SAFETY REMINDER EXPIRED: Please check in visit status for booking ${activeReminderJobId || ''}.`,
          });
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [manualReminderSecondsLeft, activeReminderJobId]);

  const handleStartManualReminder = (jobId: string, minutes: number) => {
    setActiveReminderJobId(jobId);
    setManualReminderMinutes(minutes);
    setManualReminderSecondsLeft(minutes * 60);
    setStatusFeedback({
      type: 'success',
      text: `Manual safety check-in timer set for ${minutes} minutes.`,
    });
  };

  // FEATURE 7: VOICE-FIRST OFFLINE ASSISTANT HANDLER
  const handleProcessVoiceCommand = async (commandText: string) => {
    if (!commandText.trim()) return;
    setProcessingSpeech(true);
    setSpeechResponse(null);

    // If offline, execute locally with deterministic rules!
    if (!effectiveOnline) {
      const lower = commandText.toLowerCase();
      if (/pending|new|baki|কাজ|लंबित/i.test(lower)) {
        setActiveTab('jobs');
        setSpeechResponse(lang === 'bn' ? 'অফলাইন মোড: পেন্ডিং কাজের তালিকা দেখানো হচ্ছে।' : lang === 'hi' ? 'ऑफ़लाइन मोड: लंबित कार्यों की सूची दिखाई जा रही है।' : 'Offline Mode: Displaying your pending jobs queue.');
      } else if (/completed|shompurno|আজকের|সম্পন্ন|पूर्ण/i.test(lower)) {
        setActiveTab('jobs');
        setSpeechResponse(lang === 'bn' ? 'অফলাইন মোড: সম্পন্ন কাজের ইতিহাস দেখানো হচ্ছে।' : lang === 'hi' ? 'ऑफ़लाइन मोड: पूर्ण कार्य इतिहास दिखाया जा रहा है।' : 'Offline Mode: Displaying your completed work history.');
      } else if (/payment|wallet|taka|টাকা|হিসাব|कमाई|कोष/i.test(lower)) {
        setActiveTab('cooperativeFund');
        setSpeechResponse(lang === 'bn' ? 'অফলাইন মোড: সমবায় তহবিল ব্যালেন্স দেখানো হচ্ছে।' : lang === 'hi' ? 'ऑफ़लाइन मोड: सहकारी कोष शेष दिखाया जा रहा है।' : 'Offline Mode: Displaying your cooperative fund ledger.');
      } else if (/collab|help|helper|সাহায্য|मदद/i.test(lower)) {
        setActiveTab('collaboration');
        setSpeechResponse(lang === 'bn' ? 'অফলাইন মোড: সহকর্মী সহায়তা নেটওয়ার্ক খোলা হয়েছে।' : lang === 'hi' ? 'ऑफ़लाइन मोड: श्रमिक सहायता नेटवर्क खोला गया।' : 'Offline Mode: Opening Worker Help Network.');
      } else {
        setSpeechResponse(lang === 'bn' ? `অফলাইন মোড: "${commandText}" গ্রহণ করা হয়েছে। স্থানীয় ড্যাশবোর্ড সক্রিয়।` : lang === 'hi' ? `ऑफ़लाइन मोड: "${commandText}" स्वीकार किया गया। डैशबोर्ड सक्रिय है।` : `Offline Mode: Command "${commandText}" processed locally.`);
      }
      setProcessingSpeech(false);
      return;
    }

    try {
      const res = await fetch('/api/assistant/voice-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transcript: commandText,
          language: lang,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSpeechResponse(data.localizedResponse || 'Command processed.');
        if (data.targetTab) {
          setActiveTab(data.targetTab);
        }
      } else {
        setSpeechResponse('Voice assistant unavailable. Switched to local mode.');
      }
    } catch {
      setSpeechResponse('Network error. Processed locally.');
    } finally {
      setProcessingSpeech(false);
    }
  };

  const handleToggleSpeechRecognition = () => {
    if (isListeningSpeech) {
      setIsListeningSpeech(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setStatusFeedback({
        type: 'error',
        text: 'Speech recognition is not supported in this browser. Please use the text input below.',
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang === 'bn' ? 'bn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListeningSpeech(true);
        setSpeechTranscript('');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSpeechTranscript(transcript);
        setIsListeningSpeech(false);
        handleProcessVoiceCommand(transcript);
      };

      recognition.onerror = () => {
        setIsListeningSpeech(false);
      };

      recognition.onend = () => {
        setIsListeningSpeech(false);
      };

      recognition.start();
    } catch {
      setIsListeningSpeech(false);
      setSpeechSupported(false);
    }
  };

  useEffect(() => {
    fetchWorkerAlerts();
    fetchCommunityBulk();
    fetchWorkerDisputes();
    fetchWorkerWelfareRequests();
    fetchCollaborationRequests();
    fetchTimeProtectionRecords();
    fetchSparePartsEstimates();
    fetchCoopProposals();
    fetchSafeVisitLogs();
    fetchWorkerProblemReports();
    fetchServerJobNotes();
  }, [
    fetchWorkerAlerts,
    fetchCommunityBulk,
    fetchWorkerDisputes,
    fetchWorkerWelfareRequests,
    fetchCollaborationRequests,
    fetchTimeProtectionRecords,
    fetchSparePartsEstimates,
    fetchCoopProposals,
    fetchSafeVisitLogs,
    fetchWorkerProblemReports,
    fetchServerJobNotes,
  ]);

  useEffect(() => {
    if (activeTab === 'cooperativeFund' || activeTab === 'earnings') {
      fetchCoopLedger();
      fetchWorkerWelfareRequests();
    }
  }, [activeTab, fetchCoopLedger, fetchWorkerWelfareRequests]);

  // Save configurable split to server application settings
  const handleSaveSplitSettingsToServer = async (newWorkerPercent: number) => {
    handleUpdateSplit(newWorkerPercent);
    if (!effectiveOnline) return;
    try {
      await fetch('/api/cooperative/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workerSharePercent: newWorkerPercent }),
      });
    } catch {
      // offline fallback
    }
  };

  // Simulate Demo Settlement for a completed job
  const handleSettleDemoJob = async (job: BookingRecord) => {
    setUpdatingId(job.id);
    try {
      if (effectiveOnline) {
        const res = await fetch(`/api/bookings/${job.id}/settle-demo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ workerSharePercent: splitSetting.workerSharePercent }),
        });
        if (res.ok) {
          const data = await res.json();
          await onRefreshData();
          await fetchCoopLedger();
          setStatusFeedback({
            type: 'success',
            text: data.message || `Demo settlement confirmed: ₹${data.booking?.workerShareInr} to worker and ₹${data.booking?.welfareShareInr} to cooperative fund.`,
          });
          return;
        }
      }

      // Offline fallback
      const gross = job.amountInr;
      const workerNet = Math.round(gross * (splitSetting.workerSharePercent / 100));
      const welfareFund = gross - workerNet;
      const updatedJob: BookingRecord = {
        ...job,
        paymentStatus: 'PAID',
        workerShareInr: workerNet,
        welfareShareInr: welfareFund,
        updatedAt: new Date().toISOString(),
      };
      const updatedList = savedOfflineBookings.map((b) => (b.id === job.id ? updatedJob : b));
      saveWorkerOfflineBookings(updatedList);
      setSavedOfflineBookings(updatedList);
      setStatusFeedback({
        type: 'success',
        text: `Demo settlement saved locally (${splitSetting.workerSharePercent}% / ${splitSetting.coopFundPercent}%). Will sync upon reconnection.`,
      });
    } catch {
      setStatusFeedback({
        type: 'error',
        text: 'Failed to process demo settlement.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // Auto-synchronize pending changes after reconnection
  const handleReconnectionSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('Synchronizing...');
    try {
      // 1. Replay queued status updates from offline session if any
      const rawQueue = localStorage.getItem(WORKER_PENDING_QUEUE_KEY);
      if (rawQueue) {
        try {
          const queue: Array<{ bookingId: string; nextStatus: BookingStatus }> = JSON.parse(rawQueue);
          if (Array.isArray(queue) && queue.length > 0) {
            for (const item of queue) {
              await fetch(`/api/bookings/${item.bookingId}/status`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: item.nextStatus, actingAsWorkerId: worker.id }),
              });
            }
          }
        } catch {
          // ignore malformed queue
        }
        localStorage.removeItem(WORKER_PENDING_QUEUE_KEY);
      }

      // 2. Replay & synchronize queued offline job notes if any
      if (token) {
        const notesSyncRes = await syncPendingNotesToServer(token);
        if (notesSyncRes.success && notesSyncRes.syncedCount > 0) {
          setStatusFeedback({
            type: 'success',
            text:
              lang === 'bn'
                ? `ইন্টারনেট সংযোগ পুনরুদ্ধার হয়েছে! ${notesSyncRes.syncedCount}টি অফলাইন কাজের নোট স্বয়ংক্রিয়ভাবে সার্ভারে সিঙ্ক হয়েছে।`
                : lang === 'hi'
                ? `इंटरनेट कनेक्शन बहाल हुआ! ${notesSyncRes.syncedCount} ऑफ़लाइन कार्य नोट्स स्वचालित रूप से सर्वर पर सिंक हो गए।`
                : `Reconnected! ${notesSyncRes.syncedCount} offline job note(s) automatically synchronized to server.`,
          });
        }
        await fetchServerJobNotes();
        refreshWorkerNotesState();
      }

      // 3. Fetch fresh bookings from server
      await onRefreshData();

      setSyncStatus('Synced with Server');
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      setSyncStatus(effectiveOnline ? 'Sync Failed' : 'Connection Error');
    } finally {
      setIsSyncing(false);
    }
  }, [
    isSyncing,
    token,
    worker.id,
    onRefreshData,
    fetchServerJobNotes,
    refreshWorkerNotesState,
    lang,
  ]);

  // Listen to browser online and offline events
  useEffect(() => {
    const handleOnlineEvent = () => {
      setBrowserOnline(true);
      handleReconnectionSync();
    };
    const handleOfflineEvent = () => {
      setBrowserOnline(false);
      setSyncStatus('Offline — Saved Bookings Available');
    };

    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);

    return () => {
      window.removeEventListener('online', handleOnlineEvent);
      window.removeEventListener('offline', handleOfflineEvent);
    };
  }, [handleReconnectionSync]);

  // Requirement 2 & 6: Automatically Save Customer Details in localStorage and track real sync status
  useEffect(() => {
    if (effectiveOnline) {
      if (Array.isArray(bookings)) {
        if (bookings.length > 0) {
          setSavedOfflineBookings((prev) => {
            const merged = mergeWorkerBookings(prev, bookings);
            return merged;
          });
        }
        setSyncStatus('Synced with Server');
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } else {
      setSyncStatus('Offline — Saved Bookings Available');
    }
  }, [bookings, effectiveOnline]);

  // Profile & KYC state
  const [shift, setShift] = useState<ShiftPreference>(worker.shift);
  const [serviceZone, setServiceZone] = useState(worker.serviceZone);
  const [skillsInput, setSkillsInput] = useState(worker.skills.join(', '));
  const [baseRateInr, setBaseRateInr] = useState(worker.baseRateInr);
  const [docType, setDocType] = useState(
    worker.kycDocumentType || 'Aadhaar + ITI Trade Certificate'
  );
  const [docNumber, setDocNumber] = useState(worker.kycDocumentNumber || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Seamless fallback to offline saved bookings when device has no connection
  const rawBookings = effectiveOnline
    ? bookings
    : (savedOfflineBookings.length > 0 ? savedOfflineBookings : bookings);

  // De-duplicate bookings strictly by booking ID
  const effectiveBookings = Array.from(
    new Map((rawBookings || []).map((b) => [b.id, b])).values()
  );
  const pendingJobs = effectiveBookings.filter((b) => b.status === 'PENDING');
  const activeJobs = effectiveBookings.filter((b) => ['ACCEPTED', 'IN_PROGRESS'].includes(b.status));
  const completedJobs = effectiveBookings.filter((b) => b.status === 'COMPLETED');

  // Dedicated state for New Job Received notification modal
  const [newJobModal, setNewJobModal] = useState<BookingRecord | null>(null);

  // De-duplicated list of transaction records for Cooperative Profit-Sharing Ledger (Requirement 1)
  const combinedLedgerMap = new Map<
    string,
    {
      id: string;
      bookingReference: string;
      customerName: string;
      date: string;
      grossAmountInr: number;
      workerShareInr: number;
      welfareContributionInr: number;
      workerSharePercent: number;
      isDemo: boolean;
      paymentMethod: string;
    }
  >();

  for (const item of serverLedger) {
    const key = item.bookingId || item.bookingReference || item.id;
    combinedLedgerMap.set(key, {
      id: item.bookingId || item.id,
      bookingReference: item.bookingReference,
      customerName: item.customerName,
      date: item.timestamp?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      grossAmountInr: item.grossAmountInr,
      workerShareInr: item.workerNetInr,
      welfareContributionInr: item.welfareContributionInr,
      workerSharePercent: item.workerSharePercent || splitSetting.workerSharePercent,
      isDemo: true,
      paymentMethod: item.paymentMode || 'UPI (DEMO)',
    });
  }

  for (const job of completedJobs) {
    if (job.paymentStatus === 'PAID') {
      const key = job.id || job.bookingReference;
      if (!combinedLedgerMap.has(key)) {
        combinedLedgerMap.set(key, {
          id: job.id,
          bookingReference: job.bookingReference,
          customerName: job.customerName,
          date: job.settledAt?.slice(0, 10) || job.preferredDate,
          grossAmountInr: job.amountInr,
          workerShareInr: job.workerShareInr,
          welfareContributionInr: job.welfareShareInr,
          workerSharePercent: splitSetting.workerSharePercent,
          isDemo: true,
          paymentMethod: job.paymentMethod || 'UPI (DEMO)',
        });
      }
    }
  }

  const coopTransactions = Array.from(combinedLedgerMap.values());
  const unSettledCompletedJobs = completedJobs.filter((b) => b.paymentStatus !== 'PAID');

  const handleToggleAvailability = async () => {
    if (!effectiveOnline) {
      setStatusFeedback({
        type: 'error',
        text: t.offlineBanner,
      });
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/workers/${worker.id}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isAvailable: !worker.isAvailable }),
      });
      const data = await res.json();
      if (res.ok) {
        await onRefreshData();
        setStatusFeedback({
          type: 'success',
          text: data.worker.isAvailable ? t.statusAvailable : t.statusOffline,
        });
      }
    } catch {
      setStatusFeedback({
        type: 'error',
        text: 'Failed to update availability status.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleJobStatusChange = async (bookingId: string, nextStatus: BookingStatus) => {
    if (updatingId) return; // Prevent duplicate clicks while request is in flight

    // Requirement 3 & 5: Handle offline status update safely, saving to localStorage & queueing sync
    if (!effectiveOnline) {
      const target = savedOfflineBookings.find((b) => b.id === bookingId || b.bookingReference === bookingId);
      if (target) {
        const updatedTarget: BookingRecord = {
          ...target,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        };
        const updatedList = savedOfflineBookings.map((b) =>
          b.id === bookingId || b.bookingReference === bookingId ? updatedTarget : b
        );
        saveWorkerOfflineBookings(updatedList);
        setSavedOfflineBookings(updatedList);

        try {
          const rawQueue = localStorage.getItem(WORKER_PENDING_QUEUE_KEY);
          const queue = rawQueue ? JSON.parse(rawQueue) : [];
          queue.push({ bookingId, nextStatus, timestamp: new Date().toISOString() });
          localStorage.setItem(WORKER_PENDING_QUEUE_KEY, JSON.stringify(queue));
        } catch {
          // ignore
        }

        if (onStatusUpdated) {
          onStatusUpdated(updatedTarget, nextStatus);
        }

        const label =
          nextStatus === 'ACCEPTED'
            ? t.worker_status_ACCEPTED || 'JOB ACCEPTED'
            : nextStatus === 'IN_PROGRESS'
            ? t.status_IN_PROGRESS || 'WORK IN PROGRESS'
            : nextStatus === 'COMPLETED'
            ? t.status_COMPLETED || 'WORK COMPLETED'
            : nextStatus;

        setStatusFeedback({
          type: 'success',
          text: `Offline update: ${label} saved locally. Will sync with server once connection is restored.`,
        });
      }
      return;
    }

    setUpdatingId(bookingId);
    setStatusFeedback(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus, actingAsWorkerId: worker.id }),
      });
      const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
      if (!res.ok) {
        setStatusFeedback({ type: 'error', text: data.error || 'Error updating job status.' });
      } else {
        await onRefreshData();
        if (data.booking) {
          // Automatically update offline storage with new status
          setSavedOfflineBookings((prev) => mergeWorkerBookings(prev, [data.booking]));
        }
        const confirmedLabel =
          nextStatus === 'ACCEPTED'
            ? t.worker_status_ACCEPTED || 'JOB ACCEPTED'
            : nextStatus === 'IN_PROGRESS'
            ? t.status_IN_PROGRESS || 'WORK IN PROGRESS'
            : nextStatus === 'COMPLETED'
            ? t.status_COMPLETED || 'WORK COMPLETED'
            : data.message;
        setStatusFeedback({
          type: 'success',
          text: `${confirmedLabel} — ${data.message}`,
        });
        if (data.booking && onStatusUpdated) {
          onStatusUpdated(data.booking, nextStatus);
        }
      }
    } catch {
      setStatusFeedback({ type: 'error', text: 'Network error updating status.' });
    } finally {
      setUpdatingId(null);
    }
  };

  // Requirement 4: Clear locally saved booking history from dedicated key without deleting original server data
  const handleClearOfflineHistory = () => {
    localStorage.removeItem(WORKER_OFFLINE_STORAGE_KEY);
    setSavedOfflineBookings([]);
    setShowClearConfirm(false);
    setStatusFeedback({
      type: 'success',
      text: t.clearHistorySuccess || 'Locally saved booking history cleared successfully. Server database records remain unchanged.',
    });
  };

  // Filter offline bookings by search text and status
  const filteredOfflineBookings = savedOfflineBookings.filter((job) => {
    if (statusFilter !== 'ALL' && job.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchRef = job.bookingReference?.toLowerCase().includes(q);
      const matchId = job.id?.toLowerCase().includes(q);
      const matchName = job.customerName?.toLowerCase().includes(q);
      const matchPhone = job.customerPhone?.toLowerCase().includes(q);
      const matchCategory = job.workerCategory?.toLowerCase().includes(q);
      const matchLocation = job.customerLocation?.addressLabel?.toLowerCase().includes(q);
      return matchRef || matchId || matchName || matchPhone || matchCategory || matchLocation;
    }
    return true;
  });

  const handleSaveWorkerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setStatusFeedback({ type: 'error', text: t.offlineBanner });
      return;
    }
    setSavingProfile(true);
    try {
      const parsedSkills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/workers/${worker.id}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shift,
          serviceZone,
          skills: parsedSkills,
          baseRateInr: Number(baseRateInr),
        }),
      });
      if (res.ok) {
        await onRefreshData();
        setStatusFeedback({ type: 'success', text: 'Worker profile saved.' });
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setStatusFeedback({ type: 'error', text: t.offlineBanner });
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/workers/${worker.id}/kyc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentType: docType,
          documentNumber: docNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusFeedback({ type: 'error', text: data.error || 'KYC submission failed.' });
      } else {
        await onRefreshData();
        setStatusFeedback({ type: 'success', text: data.message });
      }
    } finally {
      setSavingProfile(false);
    }
  };

  // Requirement 5: Real-Time Worker GPS Tracking & Coordinates Synchronization
  useEffect(() => {
    if (!activeTrackingJobId) {
      if (gpsWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchId);
        setGpsWatchId(null);
      }
      return;
    }

    const targetJob = bookings.find((b) => b.id === activeTrackingJobId);
    if (!targetJob || (targetJob.status !== 'ACCEPTED' && targetJob.status !== 'IN_PROGRESS')) {
      if (gpsWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchId);
        setGpsWatchId(null);
      }
      setActiveTrackingJobId(null);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsErrorText('Geolocation API is not supported by your browser.');
      setActiveTrackingJobId(null);
      return;
    }

    const transmitLocation = (pos: GeolocationPosition) => {
      setGpsErrorText(null);
      const coords: Coordinates = {
        lat: Math.round(pos.coords.latitude * 10000) / 10000,
        lng: Math.round(pos.coords.longitude * 10000) / 10000,
        addressLabel: `${worker.name} (Live GPS)`,
      };
      fetch('/api/worker/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workerId: worker.id,
          bookingId: activeTrackingJobId,
          coordinates: {
            ...coords,
            accuracy: pos.coords.accuracy,
          },
        }),
      }).catch(() => {
        // Handled gracefully on temporary disconnection
      });
    };

    const handleGpsError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setGpsErrorText(
          'Location permission was denied. Please enable browser location permissions to transmit live tracking.'
        );
        setActiveTrackingJobId(null);
      } else {
        setGpsErrorText(`GPS location error (${err.message}). Retrying...`);
      }
    };

    navigator.geolocation.getCurrentPosition(transmitLocation, handleGpsError, {
      enableHighAccuracy: true,
      timeout: 10000,
    });

    const watchId = navigator.geolocation.watchPosition(transmitLocation, handleGpsError, {
      enableHighAccuracy: true,
      maximumAge: 4000,
      timeout: 15000,
    });
    setGpsWatchId(watchId);

    return () => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [activeTrackingJobId, bookings, token, worker.id, worker.name]);

  const handleUpdateWorkerCoordinates = async (coords: Coordinates, bookingId?: string) => {
    if (!isOnline) return;
    try {
      if (bookingId) {
        await fetch('/api/worker/location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            workerId: worker.id,
            bookingId,
            coordinates: coords,
          }),
        });
      }
      await fetch(`/api/workers/${worker.id}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ coordinates: coords }),
      });
      await onRefreshData();
    } catch {
      // offline/error ignored
    }
  };

  const handleDownloadInvoice = async (booking: BookingRecord) => {
    const res = await fetch(`/api/bookings/${booking.id}/invoice`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HelpNest_Invoice_${booking.bookingReference}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="@container space-y-6 pb-20 sm:pb-6">
      {/* Top Worker Summary & Availability Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col @xl:flex-row @xl:items-center @xl:justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-lg flex items-center justify-center shrink-0 border border-slate-700">
            {worker.avatarInitials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{worker.name}</h1>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">· {translateCategory(worker.category, lang)}</span>
              <span
                className={`text-xs font-semibold ${
                  worker.verified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                · {worker.verified ? `✓ ${t.verifiedMemberLabel}` : t.unverifiedMemberLabel}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>{(worker.rating ?? 5.0).toFixed(1)}</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                  ({worker.reviewCount ?? 0} {lang === 'bn' ? 'রিভিউ' : lang === 'hi' ? 'समीक्षाएं' : 'reviews'})
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.workerWelcome} · {translateArea(worker.serviceZone, lang)} · {translateSlot(worker.shift, lang)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between @xl:justify-end gap-3 pt-2 @xl:pt-0 border-t @xl:border-t-0 border-slate-100 dark:border-slate-800">
          <div className="text-left @xl:text-right">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">{t.availabilityStatus}</span>
            <strong
              className={`text-xs font-semibold ${
                worker.isAvailable ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {worker.isAvailable ? t.statusAvailable : t.statusOffline}
            </strong>
          </div>

          <button
            type="button"
            disabled={savingProfile}
            onClick={handleToggleAvailability}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              worker.isAvailable
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700'
                : 'bg-teal-700 text-white hover:bg-teal-800'
            }`}
          >
            {worker.isAvailable ? t.toggleOfflineBtn : t.toggleAvailableBtn}
          </button>

          {/* Local Storage Button (Requirement 1) */}
          <button
            type="button"
            onClick={() => setShowLocalStorageModal(true)}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-teal-700 text-white hover:bg-slate-800 dark:hover:bg-teal-600 transition-colors cursor-pointer shadow-2xs active:scale-95"
            title="Open locally saved customer bookings"
          >
            <Database className="w-4 h-4 text-teal-300 dark:text-teal-200 shrink-0" />
            <span>Local Storage</span>
            {savedOfflineBookings.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-teal-800 dark:bg-teal-900 text-teal-100 font-bold tabular-nums">
                {savedOfflineBookings.length}
              </span>
            )}
          </button>

          {/* Worker Emergency SOS Button (Feature 2) */}
          <button
            type="button"
            onClick={() => setShowSosConfirmModal(true)}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer shadow-2xs active:scale-95"
            title="Trigger Emergency SOS Alert (Demo Simulation)"
          >
            <Siren className="w-4 h-4 shrink-0" />
            <span>Emergency SOS</span>
          </button>

          {/* Feature 7: Voice-First Multilingual Assistant */}
          <button
            type="button"
            onClick={() => {
              setShowVoiceModal(true);
              setSpeechResponse(null);
            }}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-800 hover:bg-teal-700 text-white transition-colors cursor-pointer shadow-2xs active:scale-95"
            title="Voice Assistant (Bengali, Hindi, English)"
          >
            <Mic className="w-4 h-4 text-teal-300 shrink-0" />
            <span>Voice Assistant</span>
          </button>

          {/* Gemma 4 Feature 1: Worker Digital Passport Button */}
          <button
            type="button"
            onClick={() => setShowWorkerPassportModal(true)}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white transition-colors cursor-pointer shadow-2xs active:scale-95"
            title="View Verified Skills & Completed Jobs Passport (Google Gemma 4 E4B)"
          >
            <FileBadge2 className="w-4 h-4 text-amber-300 shrink-0" />
            <span>Digital Passport</span>
          </button>

          {/* Gemma 4 Feature 5: Customer Rating Insights Button */}
          <button
            type="button"
            onClick={() => setShowRatingInsightsModal(true)}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-900 transition-colors cursor-pointer shadow-2xs active:scale-95"
            title="Customer Rating Insights & Trade Coaching (Google Gemma 4 E4B)"
          >
            <Star className="w-4 h-4 fill-slate-900 text-slate-900 shrink-0" />
            <span>Rating Insights</span>
          </button>
        </div>
      </div>

      {/* Feature 2: Active Emergency SOS Status Banner */}
      {activeSosAlert && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border-2 border-red-500 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-start gap-3">
            <Siren className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-0.5">
              <strong className="text-sm font-bold text-red-900 dark:text-red-200 block">
                DEMO ALERT SENT — Cooperative Safety Dispatch Notified
              </strong>
              <p className="text-red-800 dark:text-red-300 text-[11px]">
                Alert ID: <code className="font-mono font-bold">{activeSosAlert.id}</code> · Timestamp:{' '}
                {new Date(activeSosAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                {activeSosAlert.bookingReference ? ` · Linked Booking: ${activeSosAlert.bookingReference}` : ''}
              </p>
              <p className="text-[10px] text-red-700 dark:text-red-400 italic">
                * Note: Hackathon simulation only. Police and emergency services are not contacted without certified integration. Precise location is protected.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={cancellingSos}
            onClick={handleCancelSosAlert}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 font-bold hover:bg-red-100 dark:hover:bg-red-950 cursor-pointer whitespace-nowrap self-start sm:self-center"
          >
            {cancellingSos ? 'Cancelling...' : 'Cancel False Alarm'}
          </button>
        </div>
      )}

      {/* Desktop Sub-Nav Tabs & Offline Status Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl w-fit max-w-full border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveTab('jobs')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'jobs' ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.navWorkerJobs} ({pendingJobs.length + activeJobs.length})
          </button>
          {/* FEATURE 1: WORKER-TO-WORKER HELP NETWORK TAB */}
          <button
            type="button"
            onClick={() => setActiveTab('collaboration')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'collaboration'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Handshake className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>{t.navWorkerCollab || 'Peer Help'}</span>
            {collabRequests.filter((r) => r.status === 'HELP_REQUESTED').length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500 text-white font-bold">
                {collabRequests.filter((r) => r.status === 'HELP_REQUESTED').length}
              </span>
            )}
          </button>
          {/* FEATURE 5: WORKER COOPERATIVE VOTING TAB */}
          <button
            type="button"
            onClick={() => setActiveTab('voting')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'voting'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Vote className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>{t.navWorkerVoting || 'Coop Democracy'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('earnings')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'earnings'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.navWorkerEarnings}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cooperativeFund')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cooperativeFund'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>{t.navCooperativeFund || 'Cooperative Fund'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.navWorkerProfile}
          </button>
          {/* GEMMA 4 FEATURE 5: AI COOPERATIVE RULE EXPLAINER TAB */}
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-amber-700 text-white shadow-2xs'
                : 'text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>{t.ruleExplainerTitle ? (lang === 'bn' ? 'নিয়ম সহায়ক' : lang === 'hi' ? 'नियम सहायक' : 'Coop Rules (AI)') : 'Coop Rules (AI)'}</span>
          </button>
          {/* REQUIREMENT 3: WORKER LEARN & SKILLS SECTION */}
          <button
            type="button"
            onClick={() => setActiveTab('learn')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'learn'
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-teal-800 dark:text-teal-300 hover:text-teal-950 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>{lang === 'bn' ? 'শিক্ষা ও দক্ষতা' : lang === 'hi' ? 'सीखें और कौशल' : 'Learn & Skills'}</span>
          </button>
        </div>

        {/* Status Indicator & Pending Offline Notes Sync Badge */}
        <div className="flex flex-wrap items-center gap-2">
          {pendingNotesCount > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>
                {lang === 'bn'
                  ? `${pendingNotesCount}টি অফলাইন নোট সিঙ্কের অপেক্ষায়`
                  : lang === 'hi'
                  ? `${pendingNotesCount} ऑफ़लाइन नोट्स सिंक लंबित`
                  : `${pendingNotesCount} Offline Note${pendingNotesCount > 1 ? 's' : ''} Pending Sync`}
              </span>
              {effectiveOnline && (
                <button
                  type="button"
                  onClick={handleReconnectionSync}
                  disabled={isSyncing}
                  className="ml-1 px-2 py-0.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  {isSyncing ? '...' : (lang === 'bn' ? 'সিঙ্ক' : lang === 'hi' ? 'सिंक' : 'Sync All')}
                </button>
              )}
            </div>
          )}

          {!effectiveOnline ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>Offline — Saved Bookings Available</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>{syncStatus}</span>
              {lastSyncTime && (
                <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 font-mono">
                  ({lastSyncTime})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {statusFeedback && (
        <motion.div
          key={statusFeedback.text}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
            statusFeedback.type === 'success'
              ? 'bg-teal-50 border-teal-200 text-teal-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <span>{statusFeedback.text}</span>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="underline ml-4 cursor-pointer"
          >
            OK
          </button>
        </motion.div>
      )}

      {/* TAB 1: INSTANT JOB NOTIFICATIONS & ACTIVE WORK MANAGEMENT */}
      {activeTab === 'jobs' && (
        <div className="space-y-6">
          {/* Requirement 3: Fair Job Distribution System Architecture & Queue Rotation Policy */}
          <div className="rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/50 dark:bg-teal-950/20 p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-700 text-white shrink-0">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Fair Job Distribution System
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-700">
                      Cooperative Queue
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Formula: Matching Score = (Proximity × 0.45) + (Skill × 0.30) + (Fairness × 0.25)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDistributionGuide(!showDistributionGuide)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-300 text-xs font-semibold hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors cursor-pointer"
              >
                <span>{showDistributionGuide ? 'Hide Allocation Logic' : 'View Allocation Logic'}</span>
                {showDistributionGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showDistributionGuide && (
              <div className="mt-4 pt-4 border-t border-teal-200/80 dark:border-teal-800/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <strong className="text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                    1. Availability & Shift Verification
                  </strong>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Matches only on-duty cooperative workers whose registered shift overlaps with the customer's selected time slot.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <strong className="text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-teal-600" />
                    2. Trade Skill & KYC Badge Matching (30%)
                  </strong>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Evaluates verified municipal/trade certifications, category badges, and specific problem trade skills.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <strong className="text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    3. Proximity & Radius Routing (45%)
                  </strong>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Computed via real-time GPS Haversine distance from the customer's household location to minimize worker travel time.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <strong className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-emerald-600" />
                    4. Workload Balancing & Fair Queue (25%)
                  </strong>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Prioritizes cooperative workers who received fewer jobs this week to prevent star-worker monopoly, and grants an onboarding boost to new members.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Requirement 4: Top High-Visibility Alert Banner for New Job Received */}
          {pendingJobs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white shadow-lg flex flex-wrap items-center justify-between gap-3 border border-teal-500/40"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-amber-300 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wide">
                      New Job Received
                    </span>
                    <span className="text-xs font-mono font-bold text-teal-200">
                      {pendingJobs[0].bookingReference}
                    </span>
                    <span className="text-[11px] text-teal-300">
                      · {pendingJobs[0].realTimeDelivered ? 'Real-Time Dispatched' : 'Queued in Database'}
                    </span>
                  </div>
                  <p className="text-xs text-white/90 mt-0.5">
                    <strong>{pendingJobs[0].customerName}</strong> ({pendingJobs[0].customerPhone}) requested {translateCategory(pendingJobs[0].workerCategory, lang)} for {pendingJobs[0].preferredDate} · {translateSlot(pendingJobs[0].preferredTimeSlot, lang)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewJobModal(pendingJobs[0])}
                  className="px-3.5 py-1.5 rounded-xl bg-white/90 hover:bg-white text-slate-900 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  View Details
                </button>
                <button
                  type="button"
                  disabled={updatingId === pendingJobs[0].id}
                  onClick={() => handleJobStatusChange(pendingJobs[0].id, 'ACCEPTED')}
                  className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  Accept Job
                </button>
                <button
                  type="button"
                  disabled={updatingId === pendingJobs[0].id}
                  onClick={() => handleJobStatusChange(pendingJobs[0].id, 'REJECTED')}
                  className="px-3 py-1.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold transition-all cursor-pointer active:scale-95"
                >
                  Reject
                </button>
              </div>
            </motion.div>
          )}

          {/* Incoming Pending Job Requests */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{t.instantJobNotifications} ({pendingJobs.length})</span>
              </h2>
              {!effectiveOnline && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Offline mode active
                </span>
              )}
            </div>

            {/* Offline notification advisory */}
            {!effectiveOnline && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Device is currently offline</p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    New incoming booking requests cannot arrive from the server without an active internet connection. All previously received customer bookings are safely stored and accessible via the <strong>Local Storage</strong> button.
                  </p>
                </div>
              </div>
            )}

            {pendingJobs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4">{t.noPendingJobs}</p>
            ) : (
              <div className="space-y-4">
                {pendingJobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-xl border border-teal-700/40 dark:border-teal-600/40 bg-teal-50/20 dark:bg-teal-950/20 p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-teal-700 text-white font-bold text-xs">
                            {translateCategory(job.workerCategory, lang)}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {job.bookingReference}
                          </span>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            · {translateUrgency(job.urgency, lang)}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            job.realTimeDelivered
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${job.realTimeDelivered ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                            {job.realTimeDelivered ? 'Real-Time Dispatched' : 'Synced from Queue'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
                          <span>{job.customerName}</span>
                          <a
                            href={`tel:${job.customerPhone}`}
                            className="text-xs font-mono font-normal text-teal-700 dark:text-teal-400 hover:underline"
                          >
                            ({job.customerPhone})
                          </a>
                        </h3>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block">{t.estimatedEarnings}</span>
                        <strong className="text-base text-teal-800 dark:text-teal-400">₹{job.workerShareInr}</strong>
                        <span className="text-xs text-slate-500 dark:text-slate-400 block">
                          ({t.grossBookingAmount}: ₹{job.amountInr})
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                      <p>
                        <strong className="text-slate-900 dark:text-slate-100">{lang === 'bn' ? 'সেবার নাম' : lang === 'hi' ? 'सेवा का नाम' : 'Service'}:</strong>{' '}
                        <span className="font-semibold text-teal-800 dark:text-teal-400">{translateCategory(job.workerCategory, lang)}</span>
                      </p>
                      <p>
                        <strong className="text-slate-900 dark:text-slate-100">{t.customerRequirement}:</strong> {job.problemDescription}
                      </p>
                      <p>
                        <strong className="text-slate-900 dark:text-slate-100">{t.scheduledSlot}:</strong> {job.preferredDate} ·{' '}
                        {translateSlot(job.preferredTimeSlot, lang)}
                      </p>
                      <p className="flex items-start gap-1">
                        <strong className="text-slate-900 dark:text-slate-100 shrink-0">{t.jobLocation}:</strong>{' '}
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {job.customerLocation.addressLabel ||
                            `${job.customerLocation.lat}, ${job.customerLocation.lng}`}
                        </span>
                      </p>
                      {/* Attached Problem Media links if customer provided photos/videos */}
                      {job.problemMediaUrls && job.problemMediaUrls.length > 0 && (
                        <div className="pt-1.5">
                          <strong className="text-slate-900 dark:text-slate-100 block mb-1">
                            Attached Media ({job.problemMediaUrls.length}):
                          </strong>
                          <div className="flex flex-wrap gap-2">
                            {job.problemMediaUrls.map((url, mediaIdx) => (
                              <a
                                key={mediaIdx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-[11px] font-medium hover:underline shadow-2xs"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Attachment {mediaIdx + 1}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Requirement 3: Fair Job Distribution Score Breakdown & Allocation Reason */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-3.5 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-semibold">
                          <Scale className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span>Fair Job Distribution Breakdown</span>
                        </div>
                        <span className="font-mono font-bold text-teal-700 dark:text-teal-300 text-xs bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                          Match Score: {job.matchingScore || job.dispatchBreakdown?.weightedTotal || 96}/100
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] tabular-nums">
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">PROXIMITY (45%)</span>
                          <strong className="text-slate-900 dark:text-slate-100">
                            {job.dispatchBreakdown?.proximityScore ?? 95}/100
                          </strong>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">
                            {job.dispatchBreakdown?.distanceKm !== null && job.dispatchBreakdown?.distanceKm !== undefined
                              ? `${job.dispatchBreakdown.distanceKm.toFixed(1)} km away`
                              : 'Within service zone'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">SKILL MATCH (30%)</span>
                          <strong className="text-slate-900 dark:text-slate-100">
                            {job.dispatchBreakdown?.skillScore ?? 96}/100
                          </strong>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">
                            Category & Trade Badges
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">FAIR ROTATION (25%)</span>
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            {job.dispatchBreakdown?.fairnessScore ?? 98}/100
                          </strong>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">
                            Equitable workload queue
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                        <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          Formula: Matching Score = (Proximity × 0.45) + (Skill × 0.30) + (Fairness × 0.25)
                        </p>
                        <p className="text-slate-700 dark:text-slate-300">
                          <strong>Assignment Reason:</strong> {job.dispatchBreakdown?.explanation || 'Assigned via cooperative fair queue rotation prioritizing available verified workers with lower recent job allocations to ensure balanced livelihood distribution.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={updatingId === job.id}
                        onClick={() => handleJobStatusChange(job.id, 'ACCEPTED')}
                        className="min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer shadow-2xs active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {updatingId === job.id ? t.updatingStatus : t.acceptJobBtn}
                        </span>
                      </motion.button>

                      <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={updatingId === job.id}
                        onClick={() => handleJobStatusChange(job.id, 'REJECTED')}
                        className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>{t.rejectJobBtn}</span>
                      </motion.button>

                      {/* Defect Problem Report & Gemma 4 AI Diagnosis */}
                      <button
                        type="button"
                        onClick={() => setProblemModalJob(job)}
                        className={`min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                          job.hasProblemReport || problemReports.some((r) => r.bookingId === job.id)
                            ? 'border-teal-400 dark:border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 shadow-2xs hover:bg-teal-100'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                        title="Inspect customer defect media and Gemma 4 AI analysis"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>
                          {job.hasProblemReport || problemReports.some((r) => r.bookingId === job.id)
                            ? 'Defect Report & AI Diagnosis'
                            : (t.reportProblemBtn || 'Report Defect / AI Diagnose')}
                        </span>
                        {(job.hasProblemReport || problemReports.some((r) => r.bookingId === job.id)) && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </button>

                      {/* Job Notes & Local Offline Log Button */}
                      {(() => {
                        const jobNotes = workerJobNotes.filter((n) => n.bookingId === job.id);
                        const hasPending = jobNotes.some((n) => !n.synced);
                        return (
                          <button
                            type="button"
                            onClick={() => setJobNotesModalBooking(job)}
                            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 text-xs font-semibold hover:bg-teal-100/70 dark:hover:bg-teal-900/60 cursor-pointer shadow-2xs transition-colors"
                            title="Open job notes and local field log"
                          >
                            <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                            <span>{t.jobNotesBtn || 'Job Notes'}</span>
                            {jobNotes.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-200 dark:bg-teal-800 text-teal-900 dark:text-teal-100 font-bold tabular-nums">
                                {jobNotes.length}
                              </span>
                            )}
                            {hasPending && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500 text-white font-bold animate-pulse">
                                Offline
                              </span>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Active Accepted / In-Progress Jobs */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t.activeJobsTitle} ({activeJobs.length})
            </h2>

            {activeJobs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                {lang === 'bn' ? 'বর্তমানে কোনো গৃহীত বা চলমান কাজ নেই।' : lang === 'hi' ? 'फिलहाल कोई स्वीकृत या प्रगति पर कार्य नहीं है।' : 'No accepted or in-progress jobs at the moment.'}
              </p>
            ) : (
              <div className="space-y-5">
                {activeJobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {job.bookingReference} · {job.preferredDate} ({translateSlot(job.preferredTimeSlot, lang)})
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                          {job.customerName} — {job.customerPhone}
                        </h3>
                      </div>
                      <span className="text-xs font-semibold text-teal-800 dark:text-teal-400">
                        {job.status === 'ACCEPTED'
                          ? t.worker_status_ACCEPTED || 'JOB ACCEPTED'
                          : translateStatus(job.status, lang)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-slate-100">{t.customerRequirement}:</strong> {job.problemDescription}
                    </p>

                    {/* Real-time Synchronized Payment Method & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        {job.paymentMethod === 'CASH' ? (
                          <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <QrCode className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        )}
                        <span className="text-slate-600 dark:text-slate-400">Payment Method:</span>
                        <strong className="text-slate-900 dark:text-slate-100">
                          {job.paymentMethod === 'CASH' ? 'Cash on Service' : 'UPI Payment'}
                        </strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Payment Status:</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          job.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                        }`}>
                          {job.paymentStatus === 'PAID'
                            ? (job.paymentMethod === 'CASH' ? 'Paid by Cash' : 'Paid via UPI')
                            : 'Payment Pending'}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300 font-bold ml-1">
                          Net: ₹{job.workerShareInr} (90%)
                        </span>
                      </div>
                    </div>

                    {/* Live 3-Step Workflow Progress: Start -> Work In Progress -> Work Completed */}
                    <div className="grid grid-cols-1 @md:grid-cols-3 gap-2.5 pt-1">
                      <div className="p-2.5 rounded-lg border border-teal-700 bg-teal-50/70 dark:bg-teal-950/40 text-xs">
                        <span className="font-mono text-[10px] text-teal-800 dark:text-teal-400 block">STEP 1</span>
                        <strong className="text-teal-900 dark:text-teal-200">{t.step1Workflow}</strong>
                      </div>
                      <div
                        className={`p-2.5 rounded-lg border text-xs ${
                          job.status === 'IN_PROGRESS'
                            ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="font-mono text-[10px] block">STEP 2</span>
                        <strong>
                          {job.status === 'IN_PROGRESS' ? t.step2Workflow : t.step2Workflow.replace(/^●\s*/, '')}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400 text-xs">
                        <span className="font-mono text-[10px] block">STEP 3</span>
                        <strong>{t.step3Workflow.replace(/^★\s*/, '')}</strong>
                      </div>
                    </div>

                    {/* Requirement 5: Real-Time Worker GPS Tracking Controls */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Navigation className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {lang === 'bn' ? 'গ্রাহকের জন্য লাইভ জিপিএস ট্র্যাকিং' : lang === 'hi' ? 'ग्राहक के लिए लाइव जीपीएस ट्रैकिंग' : 'Live GPS Location Sharing'}
                          </span>
                          {activeTrackingJobId === job.id && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 animate-pulse border border-emerald-300 dark:border-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>BROADCASTING</span>
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setGpsErrorText(null);
                            if (activeTrackingJobId === job.id) {
                              setActiveTrackingJobId(null);
                            } else {
                              setActiveTrackingJobId(job.id);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            activeTrackingJobId === job.id
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-300 hover:bg-rose-200'
                              : 'bg-teal-700 text-white hover:bg-teal-800 shadow-2xs'
                          }`}
                        >
                          {activeTrackingJobId === job.id
                            ? (lang === 'bn' ? 'ট্র্যাকিং বন্ধ করুন' : lang === 'hi' ? 'ट्रैकिंग बंद करें' : 'Stop Live Sharing')
                            : (lang === 'bn' ? 'লাইভ জিপিএস শেয়ার শুরু করুন' : lang === 'hi' ? 'लाइव जीपीएस शेयर शुरू करें' : 'Start Live GPS Sharing')}
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {lang === 'bn'
                          ? 'লোকেশন কেবল এই সক্রিয় কাজের সময় গ্রাহকের সাথে শেয়ার করা হয়। কাজ সম্পন্ন বা বাতিল হলে ট্র্যাকিং স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যায়।'
                          : lang === 'hi'
                          ? 'स्थान केवल इस सक्रिय कार्य के दौरान ग्राहक के साथ साझा किया जाता है। कार्य पूर्ण या रद्द होने पर ट्रैकिंग अपने आप बंद हो जाती है।'
                          : 'Location is only shared with the customer while traveling or working on this active booking. Tracking stops automatically once work is completed.'}
                      </p>

                      {gpsErrorText && (
                        <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{gpsErrorText}</span>
                        </div>
                      )}
                    </div>

                    <LiveTrackingMap
                      customerLocation={job.customerLocation}
                      workerLocation={job.liveWorkerLocation || worker.coordinates}
                      customerName={job.customerName}
                      workerName={worker.name}
                      title={`${t.liveMapTitle} — ${job.bookingReference}`}
                      onUpdateCoordinates={(coords) => handleUpdateWorkerCoordinates(coords, job.id)}
                      updateButtonLabel={t.detectGpsBtn}
                      isLiveTracking={activeTrackingJobId === job.id || Boolean(job.liveWorkerLocation?.isLive)}
                      lastUpdateTimestamp={job.liveWorkerLocation?.updatedAt}
                      trackingStatusText={activeTrackingJobId === job.id ? 'Live GPS Broadcasting' : 'GPS Ready'}
                    />

                    {/* Feature 1: Worker Price Revision Status Banner */}
                    {job.priceRevision && (
                      <div className="p-3 rounded-xl border text-xs space-y-1 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800">
                        <div className="flex items-center justify-between">
                          <strong className="text-amber-950 dark:text-amber-200 flex items-center gap-1.5 font-bold">
                            <Tag className="w-3.5 h-3.5 text-amber-600" />
                            Price Revision: {job.priceRevision.status}
                          </strong>
                          <span className="font-mono font-bold text-amber-900 dark:text-amber-100">
                            Proposed Total: ₹{job.priceRevision.proposedTotalInr}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-850 dark:text-amber-300">
                          {job.priceRevision.status === 'PENDING_APPROVAL'
                            ? `Proposal submitted (Labor ₹${job.priceRevision.laborInr}, Materials ₹${job.priceRevision.materialsInr}). Awaiting customer confirmation before changing booking amount.`
                            : job.priceRevision.status === 'APPROVED'
                            ? `Customer approved revised amount of ₹${job.amountInr}.`
                            : 'Customer declined revision. Original amount applies.'}
                        </p>
                      </div>
                    )}

                    {/* Feature 4: Dispute indicator if dispute exists */}
                    {job.disputeStatus && (
                      <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-900 dark:text-red-200 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <Scale className="w-4 h-4 text-red-600" />
                          <span>Dispute filed: {job.disputeStatus}</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">Reference: {job.disputeId}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {t.estimatedEarnings}: <strong className="text-slate-900 dark:text-slate-100">₹{job.workerShareInr}</strong> ·{' '}
                        {t.welfareContribution}: ₹{job.welfareShareInr}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Feature 1: Propose Price Revision */}
                        {['ACCEPTED', 'IN_PROGRESS'].includes(job.status) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustingPriceJob(job);
                              setProposedLaborInr(worker.baseRateInr);
                              setProposedMaterialsInr(0);
                              setProposedMaterialsNote('');
                              setRevisionReason('');
                            }}
                            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
                            title="Propose price revision with additional labor or materials requiring customer approval"
                          >
                            <Tag className="w-3.5 h-3.5 text-slate-500" />
                            <span>Propose Price Revision</span>
                          </button>
                        )}

                        {/* Defect Problem Report & Gemma 4 AI Diagnosis */}
                        <button
                          type="button"
                          onClick={() => setProblemModalJob(job)}
                          className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                            job.hasProblemReport || problemReports.some((r) => r.bookingId === job.id)
                              ? 'border-teal-400 dark:border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 shadow-2xs hover:bg-teal-100'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                          }`}
                          title="Inspect defect photo and Gemma 4 AI technical analysis"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <span>
                            {job.hasProblemReport || problemReports.some((r) => r.bookingId === job.id)
                              ? 'Defect Report & AI Diagnosis'
                              : (t.reportProblemBtn || 'Report Defect / AI Diagnose')}
                          </span>
                          {(job.hasProblemReport || problemReports.some((r) => r.bookingId === job.id)) && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                        </button>

                        {/* Gemma 4 Feature 1: AI Complaint-to-Action (Worker View with translated summary & checklist) */}
                        <button
                          type="button"
                          onClick={() => setSelectedComplaintJob(job)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-850 bg-indigo-50/70 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer shadow-2xs transition-colors"
                          title="View structured complaint summary, translated action items, and customer facts"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Complaint-to-Action</span>
                        </button>

                        {/* Gemma 4 Feature 3: AI Repair Report Generator (Worker review, edit, approve & PDF) */}
                        <button
                          type="button"
                          onClick={() => setSelectedReportJob(job)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/40 text-xs font-semibold text-teal-900 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/40 cursor-pointer shadow-2xs transition-colors"
                          title="Generate or view verified service report with Gemma 4 and download PDF"
                        >
                          <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <span>{t.repairReportTitle || 'Repair Report (AI / PDF)'}</span>
                        </button>

                        {/* Feature 4: Worker Dispute Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setDisputeModalJob(job);
                            setDisputeDescription('');
                            setDisputeEvidence('');
                          }}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
                          title="Report issue regarding payment, scope, or behavior"
                        >
                          <Scale className="w-3.5 h-3.5 text-slate-500" />
                          <span>Report Issue</span>
                        </button>

                        {/* Gemma 4 Feature 2: Fair Dispute Dossier */}
                        <button
                          type="button"
                          onClick={() => setWorkerDisputeBooking(job)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                          title="Generate unbiased dispute breakdown and cooperative remedies with Google Gemma 4 E4B"
                        >
                          <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Dispute Dossier (AI)</span>
                        </button>

                        {/* Job Notes & Local Offline Log Button */}
                        {(() => {
                          const jobNotes = workerJobNotes.filter((n) => n.bookingId === job.id);
                          const hasPending = jobNotes.some((n) => !n.synced);
                          return (
                            <button
                              type="button"
                              onClick={() => setJobNotesModalBooking(job)}
                              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 text-xs font-semibold hover:bg-teal-100/70 dark:hover:bg-teal-900/60 cursor-pointer shadow-2xs transition-colors"
                              title="Open job notes and local field log"
                            >
                              <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                              <span>{t.jobNotesBtn || 'Job Notes'}</span>
                              {jobNotes.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-200 dark:bg-teal-800 text-teal-900 dark:text-teal-100 font-bold tabular-nums">
                                  {jobNotes.length}
                                </span>
                              )}
                              {hasPending && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500 text-white font-bold animate-pulse">
                                  Offline
                                </span>
                              )}
                            </button>
                          );
                        })()}

                        {job.status === 'ACCEPTED' && (
                          <motion.button
                            key={`start-${job.id}`}
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={updatingId !== null}
                            onClick={() => handleJobStatusChange(job.id, 'IN_PROGRESS')}
                            className="min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-slate-900 dark:bg-teal-700 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-teal-600 disabled:opacity-50 cursor-pointer shadow-2xs active:scale-95"
                          >
                            <Play className="w-4 h-4" />
                            <span>
                              {updatingId === job.id ? t.updatingStatus : t.startWorkBtn}
                            </span>
                          </motion.button>
                        )}

                        {job.status === 'IN_PROGRESS' && (
                          <motion.button
                            key={`complete-${job.id}`}
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={updatingId !== null}
                            onClick={() => handleJobStatusChange(job.id, 'COMPLETED')}
                            className="min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50 cursor-pointer shadow-2xs active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {updatingId === job.id ? t.updatingStatus : t.completeWorkBtn}
                            </span>
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Feature 3: Community Bulk Service Requests */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Community Bulk Booking Requests ({communityBulkList.length})
                </h2>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                Group Service Requests
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bulk maintenance requests submitted by residential society representatives for multiple households in one batch.
            </p>

            {communityBulkList.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                No active community bulk requests at this time.
              </p>
            ) : (
              <div className="space-y-4">
                {communityBulkList.map((bulk) => (
                  <div
                    key={bulk.id}
                    className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/20 dark:bg-teal-950/20 p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-teal-100 dark:border-teal-900/60">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-teal-800 text-white px-2.5 py-0.5 rounded">
                            {bulk.bulkReference}
                          </span>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {bulk.societyName}
                          </span>
                          {bulk.isSampleDemo && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              DEMO SAMPLE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Representative: {bulk.representativeName} ({bulk.representativePhone}) · {bulk.preferredDate} ({translateSlot(bulk.preferredTimeSlot, lang)})
                        </p>
                      </div>

                      <div className="text-right font-mono tabular-nums">
                        <span className="text-xs text-slate-500 block">Total Group Fee</span>
                        <strong className="text-base text-teal-800 dark:text-teal-400">₹{bulk.totalPriceInr}</strong>
                        <span className="text-[11px] text-slate-500 block">
                          (₹{bulk.perHouseholdPriceInr}/household · {bulk.householdCount} flats)
                        </span>
                      </div>
                    </div>

                    {/* Households List Breakdown */}
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                        Included Household Units ({bulk.households.length}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        {bulk.households.map((h) => (
                          <div key={h.unitId} className="p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{h.flatNumber}</div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400">{h.residentName}</div>
                            {h.notes && <div className="text-[10px] text-teal-700 dark:text-teal-400 italic">{h.notes}</div>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Status: <strong className="text-teal-800 dark:text-teal-300">{bulk.status}</strong>
                        {bulk.assignedWorkerName && ` · Assigned to ${bulk.assignedWorkerName}`}
                      </span>

                      {!bulk.assignedWorkerId && bulk.status === 'PENDING' && (
                        <button
                          type="button"
                          disabled={acceptingBulkId === bulk.id}
                          onClick={() => handleAcceptCommunityBulk(bulk.id)}
                          className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                        >
                          {acceptingBulkId === bulk.id ? 'Accepting...' : 'Accept Group Request'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Completed Booking History (Preserved on Worker Dashboard with disabled status actions) */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t.totalCompletedJobs} — {lang === 'bn' ? 'বুকিং ইতিহাস' : lang === 'hi' ? 'बुकिंग इतिहास' : 'Booking History'} ({completedJobs.length})
            </h2>

            {completedJobs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                {lang === 'bn' ? 'এখনো কোনো সম্পন্ন কাজের ইতিহাস নেই।' : lang === 'hi' ? 'इतिहास में अभी कोई पूर्ण कार्य नहीं है।' : 'No completed jobs in history yet.'}
              </p>
            ) : (
              <div className="space-y-4">
                {completedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {job.bookingReference} · {job.preferredDate} ({translateSlot(job.preferredTimeSlot, lang)})
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                          {job.customerName} — {job.customerPhone}
                        </h3>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {t.status_COMPLETED || 'WORK COMPLETED'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-slate-100">{t.customerRequirement}:</strong> {job.problemDescription}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                        <span>{t.estimatedEarnings}: <strong className="text-slate-900 dark:text-slate-100">₹{job.workerShareInr}</strong> (90%)</span>
                        <span>·</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          job.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                        }`}>
                          {job.paymentStatus === 'PAID'
                            ? (job.paymentMethod === 'CASH' ? 'Paid by Cash' : 'Paid via UPI')
                            : 'Payment Pending'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Defect Problem Report & Gemma 4 AI Diagnosis */}
                        <button
                          type="button"
                          onClick={() => setProblemModalJob(job)}
                          className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                            job.hasProblemReport || problemReports.some((r) => r.bookingId === job.id)
                              ? 'border-teal-400 dark:border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 shadow-2xs hover:bg-teal-100'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                          }`}
                          title="Review defect photo and Gemma 4 AI technical analysis"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <span>
                            {job.hasProblemReport || problemReports.some((r) => r.bookingId === job.id)
                              ? 'Defect Report & AI Diagnosis'
                              : (t.reportProblemBtn || 'Report Defect / AI Diagnose')}
                          </span>
                        </button>

                        {/* Gemma 4 Feature 1: AI Complaint-to-Action Converter */}
                        <button
                          type="button"
                          onClick={() => setSelectedComplaintJob(job)}
                          className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-850 bg-indigo-50/70 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer shadow-2xs transition-colors"
                          title="View structured complaint summary, worker action plan, and customer-stated facts"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Complaint-to-Action</span>
                        </button>

                        {/* Gemma 4 Feature 3: AI Repair Report Generator (Review, edit, sign & download PDF) */}
                        <button
                          type="button"
                          onClick={() => setSelectedReportJob(job)}
                          className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/40 text-xs font-semibold text-teal-900 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/40 cursor-pointer shadow-2xs transition-colors"
                          title="Generate or view verified service report with Gemma 4 and download PDF"
                        >
                          <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <span>{t.repairReportTitle || 'Repair Report (AI / PDF)'}</span>
                        </button>

                        {/* Job Notes & Local Offline Log Button */}
                        {(() => {
                          const jobNotes = workerJobNotes.filter((n) => n.bookingId === job.id);
                          const hasPending = jobNotes.some((n) => !n.synced);
                          return (
                            <button
                              type="button"
                              onClick={() => setJobNotesModalBooking(job)}
                              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 text-xs font-semibold hover:bg-teal-100/70 dark:hover:bg-teal-900/60 cursor-pointer shadow-2xs transition-colors"
                              title="Open job notes and field log"
                            >
                              <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                              <span>{t.jobNotesBtn || 'Job Notes'}</span>
                              {jobNotes.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-200 dark:bg-teal-800 text-teal-900 dark:text-teal-100 font-bold tabular-nums">
                                  {jobNotes.length}
                                </span>
                              )}
                              {hasPending && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500 text-white font-bold animate-pulse">
                                  Offline
                                </span>
                              )}
                            </button>
                          );
                        })()}

                        <button
                          type="button"
                          disabled
                          className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <span>{t.status_COMPLETED || 'WORK COMPLETED'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: WORKER EARNINGS & 90:10 SETTLEMENT LEDGER */}
      {activeTab === 'earnings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.totalCompletedJobs}</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {worker.completedJobsTotal}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.grossBookingAmount}</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                ₹{worker.grossEarningsInr.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{t.estimatedEarnings}</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-300 mt-1">
                ₹{worker.netEarningsInr.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <span className="text-xs text-teal-700 dark:text-teal-400 font-medium">{t.welfareContribution}</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-teal-800 dark:text-teal-300 mt-1">
                ₹{worker.welfareContributionInr.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Requirement 4: Transparent Charts and Earnings */}
          <EarningsChart
            bookings={bookings}
            workerId={worker.id}
            role="WORKER"
            lang={lang}
            title={`${worker.name} — ${t.earningsHistoryTitle || 'Earnings Analytics & 90:10 Welfare Split'}`}
          />

          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.settlementHistoryTitle}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">90:10 Cooperative Split</span>
            </div>

            {completedJobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'এখনো কোনো সম্পন্ন বুকিং নেই।' : lang === 'hi' ? 'अभी तक कोई पूर्ण बुकिंग नहीं है।' : 'No completed bookings yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-4 font-semibold">{t.thBookingRef || 'Reference'}</th>
                      <th className="py-3 px-4 font-semibold">{t.thCustomer || 'Customer'}</th>
                      <th className="py-3 px-4 font-semibold">{t.preferredDateLabel || 'Date'}</th>
                      <th className="py-3 px-4 font-semibold text-right">{t.grossBookingAmount || 'Gross'}</th>
                      <th className="py-3 px-4 font-semibold text-right">{t.workerNet || 'Net (90%)'}</th>
                      <th className="py-3 px-4 font-semibold text-right">{t.welfareContribution || 'Welfare (10%)'}</th>
                      <th className="py-3 px-4 font-semibold">{t.thStatus || 'Payment Status'}</th>
                      <th className="py-3 px-4 font-semibold text-right">{lang === 'bn' ? 'রসিদ' : lang === 'hi' ? 'रसीद' : 'Invoice'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {completedJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">{job.bookingReference}</td>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                          {job.customerName}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{job.preferredDate}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          ₹{job.amountInr}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-800 dark:text-emerald-300">
                          ₹{job.workerShareInr}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-teal-800 dark:text-teal-300">
                          ₹{job.welfareShareInr}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {translateStatus(job.paymentStatus, lang)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoice(job)}
                            className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 hover:underline font-medium cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: COOPERATIVE PROFIT-SHARING LEDGER & FUND (Requirement 1) */}
      {activeTab === 'cooperativeFund' && (
        <div className="space-y-6">
          {/* Section Header & Transparent Demo Disclaimer */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    <span>{t.coopFundTitle || 'Cooperative Profit-Sharing Ledger'}</span>
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    DEMO SIMULATION
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t.coopFundSubtitle || 'Transparent profit-sharing ledger and configurable cooperative welfare fund contribution per completed job.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  Current Ratio: {splitSetting.workerSharePercent}% Worker / {splitSetting.coopFundPercent}% Cooperative Fund
                </span>
              </div>
            </div>

            {/* Prominent Legal/Demo Disclaimer Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/80 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="block font-semibold">Simulated Demo Transparency Notice</strong>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  {t.demoNotice || 'All financial calculations, accumulated earnings, and cooperative welfare fund contributions are simulated demonstration records. No real currency, bank accounts, or actual funds are collected or transferred.'}
                </p>
              </div>
            </div>
          </div>

          {/* 4 Summary Metric Cards */}
          <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.totalWorkerNet || "Worker's Net Earnings"}</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-300 mt-1">
                ₹{worker.netEarningsInr.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 mt-1 block">
                Direct worker livelihood share
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <span className="text-xs text-teal-700 dark:text-teal-400 font-medium">Worker's Coop Contribution</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-teal-800 dark:text-teal-300 mt-1">
                ₹{worker.welfareContributionInr.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-teal-700/80 dark:text-teal-400 mt-1 block">
                Accumulated contribution by {worker.name}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.totalCoopFund || 'Total Society Fund Pool'}</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                ₹{(totalSocietyFund || 28400).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                Community emergency & equipment pool
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total Settled Jobs</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {coopTransactions.length > 0 ? coopTransactions.length : worker.completedJobsTotal}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                De-duplicated transaction records
              </span>
            </div>
          </div>

          {/* Configurable Contribution Percentage in Application Settings */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>{t.splitConfigTitle || 'Profit-Sharing Configuration (Application Settings)'}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure the cooperative allocation percentage dynamically instead of hardcoded rules.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                {splitSetting.workerSharePercent}% Worker : {splitSetting.coopFundPercent}% Fund
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Demo Profit-Sharing Presets:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { w: 90, label: '90:10 (Demo Default)' },
                    { w: 85, label: '85:15 (Welfare Boost)' },
                    { w: 80, label: '80:20 (Capital Fund)' },
                    { w: 95, label: '95:5 (High Worker Share)' },
                  ].map((preset) => (
                    <button
                      key={preset.w}
                      type="button"
                      onClick={() => handleSaveSplitSettingsToServer(preset.w)}
                      className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        splitSetting.workerSharePercent === preset.w
                          ? 'bg-slate-900 dark:bg-teal-700 text-white border-slate-900 dark:border-teal-700 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-755'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>{t.workerShareLabel || "Worker's Share"}: {splitSetting.workerSharePercent}%</span>
                    <span>{t.cooperativeContributionLabel || 'Coop Fund'}: {splitSetting.coopFundPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="99"
                    step="1"
                    value={splitSetting.workerSharePercent}
                    onChange={(e) => handleSaveSplitSettingsToServer(Number(e.target.value))}
                    className="w-full accent-teal-700 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>50% Minimum</span>
                    <span>90% Standard</span>
                    <span>99% Maximum</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Projection Box */}
              <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/30 p-4 space-y-2.5">
                <strong className="text-xs font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-teal-600" />
                  Live Settlement Projection (Sample ₹500 Job)
                </strong>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 text-[10px] block">WORKER SHARE ({splitSetting.workerSharePercent}%)</span>
                    <strong className="text-base text-emerald-700 dark:text-emerald-400">
                      ₹{Math.round(500 * (splitSetting.workerSharePercent / 100))}
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 text-[10px] block">COOPERATIVE FUND ({splitSetting.coopFundPercent}%)</span>
                    <strong className="text-base text-teal-700 dark:text-teal-400">
                      ₹{500 - Math.round(500 * (splitSetting.workerSharePercent / 100))}
                    </strong>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Settings are automatically persisted to backend storage and applied whenever a completed job is settled.
                </p>
              </div>
            </div>
          </section>

          {/* Pending Demo Settlement Actions for Unpaid Completed Jobs */}
          {unSettledCompletedJobs.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-600" />
                <span>Simulate Demo Payment Settlement ({unSettledCompletedJobs.length} Job)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                These completed jobs have not been finalized yet. Click below to simulate instant payment verification and generate the cooperative profit-sharing ledger record.
              </p>
              <div className="space-y-3">
                {unSettledCompletedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                          {job.bookingReference}
                        </span>
                        <span className="text-xs text-slate-500">· {job.customerName}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {job.problemDescription} · Gross: ₹{job.amountInr}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentModalJob(job)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>UPI QR / Cash Settle</span>
                      </button>
                      <button
                        type="button"
                        disabled={updatingId === job.id}
                        onClick={() => handleSettleDemoJob(job)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer active:scale-95"
                      >
                        {updatingId === job.id ? 'Settling...' : `Quick Settle (${splitSetting.workerSharePercent}:${splitSetting.coopFundPercent})`}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Transparent Transaction History */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Transparent Transaction History
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  De-duplicated ledger records with transparent worker and welfare contributions
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
                {coopTransactions.length} Record(s)
              </span>
            </div>

            {coopTransactions.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Coins className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {t.noTransactionsYet || 'No completed & paid transactions recorded yet. Complete a booking job and confirm demo payment to generate ledger entries.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-4 font-semibold">Booking ID</th>
                      <th className="py-3 px-4 font-semibold">Customer</th>
                      <th className="py-3 px-4 font-semibold">Transaction Date</th>
                      <th className="py-3 px-4 font-semibold text-right">Gross Amount</th>
                      <th className="py-3 px-4 font-semibold text-right">Worker Share</th>
                      <th className="py-3 px-4 font-semibold text-right">Cooperative Fund</th>
                      <th className="py-3 px-4 font-semibold text-center">Type</th>
                      <th className="py-3 px-4 font-semibold text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {coopTransactions.map((tx) => (
                      <tr key={tx.id || tx.bookingReference} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {tx.bookingReference}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {tx.customerName}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">
                          {tx.date}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 font-semibold">
                          ₹{tx.grossAmountInr}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-800 dark:text-emerald-300">
                          ₹{tx.workerShareInr}{' '}
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                            ({tx.workerSharePercent}%)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-teal-800 dark:text-teal-300">
                          ₹{tx.welfareContributionInr}{' '}
                          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal">
                            ({100 - tx.workerSharePercent}%)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            DEMO
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const b = completedJobs.find((j) => j.bookingReference === tx.bookingReference || j.id === tx.id);
                              if (b) handleDownloadInvoice(b);
                            }}
                            className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 hover:underline font-medium cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Feature 5: Worker Welfare Benefits Showcase */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Cooperative Worker Welfare Benefits
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                DEMO SIMULATION
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cooperative welfare benefits supported by 10% fund reserves accumulated across completed jobs. Simulated for hackathon demo.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-950/20 space-y-2">
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">
                  Benefit Category 1
                </span>
                <strong className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
                  Trade Skills & Safety Training
                </strong>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Up to ₹3,000 subsidy for certified vocational workshops, BIS electrical safety certifications, and plumbing code compliance.
                </p>
                <div className="text-xs font-mono font-bold text-teal-800 dark:text-teal-400 pt-1">
                  Cap: ₹3,000 / year
                </div>
              </div>

              <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-950/20 space-y-2">
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">
                  Benefit Category 2
                </span>
                <strong className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
                  Emergency Medical Assistance
                </strong>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Grant up to ₹10,000 for on-duty workplace injuries, acute illness, or outpatient diagnostic tests.
                </p>
                <div className="text-xs font-mono font-bold text-teal-800 dark:text-teal-400 pt-1">
                  Cap: ₹10,000 / claim
                </div>
              </div>

              <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-950/20 space-y-2">
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">
                  Benefit Category 3
                </span>
                <strong className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
                  Tool & Safety Gear Support
                </strong>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Subsidy up to ₹2,500 towards multi-meter testers, safety harnesses, power drill bits, or water pressure testing kits.
                </p>
                <div className="text-xs font-mono font-bold text-teal-800 dark:text-teal-400 pt-1">
                  Cap: ₹2,500 / year
                </div>
              </div>
            </div>

            {/* Clear Simulation Disclosure */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <strong className="block font-bold">Important Welfare Disclosure:</strong>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                All cooperative fund balances and assistance disbursements shown on this platform are simulated for demo and prototype evaluation. Real-world financial disbursements, insurance underwriting, and statutory welfare compliance require formal cooperative society bylaws and authorized banking partners.
              </p>
            </div>
          </section>

          {/* Feature 5: Apply for Welfare Assistance Form */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-teal-600" />
              <span>Apply for Demo Welfare Assistance</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Submit an assistance request to the cooperative administration for review against fund reserves.
            </p>

            <form onSubmit={handleSubmitWelfareRequest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Benefit Category:
                  </label>
                  <select
                    value={welfareBenefitCategory}
                    onChange={(e) => setWelfareBenefitCategory(e.target.value as WelfareBenefitCategory)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  >
                    <option value="TRAINING_SUPPORT">Trade Skills & Safety Training (Up to ₹3,000)</option>
                    <option value="EMERGENCY_ASSISTANCE">Emergency Medical Assistance (Up to ₹10,000)</option>
                    <option value="EQUIPMENT_SUPPORT">Tool & Safety Equipment Support (Up to ₹2,500)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Requested Amount (₹):
                  </label>
                  <input
                    type="number"
                    min={500}
                    max={10000}
                    step={250}
                    value={welfareAmountInr}
                    onChange={(e) => setWelfareAmountInr(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reason & Purpose for Assistance:
                  </label>
                  <textarea
                    rows={2}
                    value={welfareReason}
                    onChange={(e) => setWelfareReason(e.target.value)}
                    placeholder="Provide context (e.g. Purchase of digital insulation tester for electrical diagnostics; or reimbursement for outpatient wrist sprain treatment)."
                    required
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingWelfare || !welfareReason.trim()}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                >
                  {submittingWelfare ? 'Submitting...' : 'Submit Assistance Application'}
                </button>
              </div>
            </form>
          </section>

          {/* Feature 5: Track Welfare Assistance Claims Table */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  My Welfare Assistance Claims Tracker
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time status of your submitted benefit requests
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
                {welfareRequests.filter((r) => r.workerId === worker.id).length} Request(s)
              </span>
            </div>

            {welfareRequests.filter((r) => r.workerId === worker.id).length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                You have not submitted any welfare claims yet. Use the application form above to apply.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-4 font-semibold">Request ID</th>
                      <th className="py-3 px-4 font-semibold">Benefit Category</th>
                      <th className="py-3 px-4 font-semibold text-right">Requested ₹</th>
                      <th className="py-3 px-4 font-semibold">Reason</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Admin Review Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {welfareRequests
                      .filter((r) => r.workerId === worker.id)
                      .map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                            {req.id}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                            <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[11px] font-bold">
                              {req.benefitCategory.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                            ₹{req.requestedAmountInr}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                req.status === 'APPROVED' || req.status === 'DISBURSED_DEMO'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : req.status === 'REJECTED'
                                  ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {req.reviewNote || 'Pending Committee Review'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 4: WORKER PROFILE, SKILLS & KYC SUBMISSION */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveWorkerProfile}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs"
          >
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {lang === 'bn' ? 'কাজের প্রোফাইল, শিফট ও সেবা এলাকা' : lang === 'hi' ? 'कार्य प्रोफ़ाइल, शिफ्ट और सेवा क्षेत्र' : 'Trade Profile, Shift & Service Area'}
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.serviceZoneLabel}
              </label>
              <select
                value={serviceZone}
                onChange={(e) => setServiceZone(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
              >
                <option value="Central Area">{translateArea('Central Area', lang)}</option>
                <option value="North Area">{translateArea('North Area', lang)}</option>
                <option value="East Area">{translateArea('East Area', lang)}</option>
                <option value="IT Tech Area">{translateArea('IT Tech Area', lang)}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.preferredTimeSlotLabel}
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as ShiftPreference)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
              >
                <option value="Full Day (08:00 - 20:00)">{translateSlot('Full Day (08:00 - 20:00)', lang)}</option>
                <option value="Morning (08:00 - 12:00)">{translateSlot('Morning (08:00 - 12:00)', lang)}</option>
                <option value="Afternoon (12:00 - 16:00)">{translateSlot('Afternoon (12:00 - 16:00)', lang)}</option>
                <option value="Evening (16:00 - 20:00)">{translateSlot('Evening (16:00 - 20:00)', lang)}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.requiredSkillsLabel} ({lang === 'bn' ? 'কমা দ্বারা আলাদা করুন' : lang === 'hi' ? 'अल्पविराम से अलग करें' : 'comma separated'})
              </label>
              <input
                type="text"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'bn' ? 'বেস ভিজিট রেট (₹ INR)' : lang === 'hi' ? 'मूल दर (₹ INR)' : 'Base Visit Rate (₹ INR)'}
              </label>
              <input
                type="number"
                min={150}
                max={2500}
                value={baseRateInr}
                onChange={(e) => setBaseRateInr(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-teal-700 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-teal-600 cursor-pointer shadow-2xs active:scale-95"
            >
              {t.saveProfileBtn}
            </button>
          </form>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.kycSectionTitle}</h2>
              <span
                className={`text-xs font-semibold ${
                  worker.kycStatus === 'VERIFIED'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : worker.kycStatus === 'REJECTED'
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {t.thStatus || 'Status'}: {translateStatus(worker.kycStatus, lang)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>{lang === 'bn' ? 'যাচাইকৃত সমবায় দক্ষতা ব্যাজ:' : lang === 'hi' ? 'सत्यापित सहकारी कौशल बैज:' : 'Verified Cooperative Trade Badges:'}</span>
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                {worker.skillBadges.length > 0
                  ? worker.skillBadges.join(' · ')
                  : (lang === 'bn' ? 'সমিতি পর্যালোচনার অপেক্ষায়' : lang === 'hi' ? 'समिति समीक्षा लंबित' : 'Pending Society Administrator Verification')}
              </div>
              {worker.kycReviewerNote && (
                <p className="text-slate-500 dark:text-slate-400 pt-1">
                  {lang === 'bn' ? 'সমিতি কমিটির নোট: ' : lang === 'hi' ? 'समिति समीक्षा टिप्पणी: ' : 'Society Committee Note: '} {worker.kycReviewerNote}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmitKyc} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.kycDocType}
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                >
                  <option value="Aadhaar + ITI Trade Certificate">
                    Aadhaar + ITI Trade Certificate
                  </option>
                  <option value="Voter ID + Municipal Trade License">
                    Voter ID + Municipal Trade License
                  </option>
                  <option value="Cooperative Society Artisan Card">
                    Cooperative Society Artisan Card
                  </option>
                  <option value="Police Verification + Red Cross First-Aid ID">
                    Police Verification + Red Cross First-Aid ID
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.kycDocNumber}
                </label>
                <input
                  type="text"
                  required
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="e.g. WB-COOP-2026-8841"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer shadow-2xs active:scale-95"
              >
                {t.submitKycBtn}
              </button>
            </form>

            {/* Requirement 2: Worker Ratings & Written Customer Reviews */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>{lang === 'bn' ? 'গ্রাহক রেটিং ও রিভিউ' : lang === 'hi' ? 'ग्राहक रेटिंग और समीक्षाएं' : 'Verified Ratings & Reviews'}</span>
                </div>
                <div className="flex items-center gap-1 font-mono font-bold text-amber-800 dark:text-amber-300 text-xs">
                  <span>★ {(worker.rating ?? 5.0).toFixed(1)} / 5.0</span>
                  <span className="text-slate-500 dark:text-slate-400 font-normal">
                    ({worker.reviewCount ?? 0} {lang === 'bn' ? 'রিভিউ' : lang === 'hi' ? 'समीक्षाएं' : 'reviews'})
                  </span>
                </div>
              </div>

              {Array.isArray((worker as any).reviews) && (worker as any).reviews.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(worker as any).reviews.map((rev: any) => (
                    <div
                      key={rev.id || Math.random()}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900 dark:text-slate-100 font-semibold">
                          {rev.customerName || 'Cooperative Resident'}
                        </strong>
                        <span className="text-amber-500 font-mono font-bold">★ {rev.rating}/5</span>
                      </div>
                      {rev.review ? (
                        <p className="text-slate-600 dark:text-slate-300 italic">"{rev.review}"</p>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">5-star rating recorded</span>
                      )}
                      {rev.createdAt && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 dark:text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {lang === 'bn'
                    ? 'সম্পন্ন কাজের পর গ্রাহক দ্বারা প্রদত্ত রেটিং ও লিখিত মন্তব্য স্বয়ংক্রিয়ভাবে এখানে প্রদর্শিত হবে।'
                    : lang === 'hi'
                    ? 'पूर्ण किए गए कार्यों के बाद ग्राहकों द्वारा दी गई रेटिंग और समीक्षाएं यहां दिखाई देंगी।'
                    : 'Customer ratings and optional reviews submitted after completed bookings will automatically appear here.'}
                </p>
              )}
            </div>

            {/* Gemma 4 E4B Feature 1 & 5: Verified Passport & Rating Insights Cards */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-teal-200 dark:border-teal-850 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                    <FileBadge2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      Worker Digital Passport
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700">
                        Gemma 4
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Summarise verified trade skills, KYC seal & {worker.completedJobsTotal} completed jobs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Authoritative cooperative credential verified by AI.
                </span>
                <button
                  type="button"
                  onClick={() => setShowWorkerPassportModal(true)}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
                >
                  <FileBadge2 className="w-3.5 h-3.5" />
                  <span>Open Digital Passport</span>
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-850 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      Customer Rating Insights
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-700">
                        Gemma 4
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Analyse genuine ratings ({worker.rating}★ avg) to suggest worker improvements.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Trade coaching, praised strengths & pre-departure checklist.
                </span>
                <button
                  type="button"
                  onClick={() => setShowRatingInsightsModal(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>View Rating Insights</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GEMMA 4 FEATURE 5: AI COOPERATIVE RULE EXPLAINER PANEL */}
      {activeTab === 'rules' && (
        <AiCoopRuleExplainer
          token={token}
          lang={lang}
          t={t}
          workerName={worker.name}
          workerTrade={worker.category}
        />
      )}

      {/* REQUIREMENT 3: FUNCTIONAL LEARN & SKILLS SECTION */}
      {activeTab === 'learn' && (
        <WorkerLearnSection
          token={token}
          lang={lang}
          t={t}
          workerId={worker.id}
          workerName={worker.name}
        />
      )}

      {/* Requirement 1, 3, 4: Local Storage Modal for offline customer details and history clearance */}
      {showLocalStorageModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-850">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>Local Storage — Saved Customer Bookings</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Key: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-teal-700 dark:text-teal-400 font-semibold">helpnest_worker_offline_bookings</code> · {savedOfflineBookings.length} booking(s) saved
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {/* Clear History Button (Requirement 4) */}
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={savedOfflineBookings.length === 0}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Clear all locally saved customer booking records from this browser"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear History</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowLocalStorageModal(false);
                    setShowClearConfirm(false);
                  }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Close Local Storage Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Clear History Confirmation Banner (Requirement 4) */}
            {showClearConfirm && (
              <div className="m-4 p-4 rounded-xl border border-red-300 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-red-900 dark:text-red-200">
                      Are you sure you want to clear all locally saved booking history?
                    </h4>
                    <p className="text-xs text-red-800 dark:text-red-300">
                      This will remove all {savedOfflineBookings.length} locally saved customer records from browser storage (<code className="font-mono font-semibold">helpnest_worker_offline_bookings</code>). The original booking records on the shared cooperative server database will NOT be deleted.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearOfflineHistory}
                    className="min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer shadow-2xs"
                  >
                    Yes, Clear History
                  </button>
                </div>
              </div>
            )}

            {/* Offline & Synchronization Status Banner (Requirement 3 & 5) */}
            <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                {!effectiveOnline ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Offline — Saved Bookings Available (cached in browser storage)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Online — {syncStatus}
                  </span>
                )}
              </div>

              {effectiveOnline && (
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleReconnectionSync}
                  className="inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-400 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync with Server Now</span>
                </button>
              )}
            </div>

            {/* Search & Status Filter Toolbar */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Booking ID, customer name, phone, or service..."
                    className="w-full pl-9 pr-14 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-700"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {(['ALL', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        statusFilter === st
                          ? 'bg-teal-700 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {st === 'ALL'
                        ? `All (${savedOfflineBookings.length})`
                        : st === 'PENDING'
                        ? 'Pending'
                        : st === 'ACCEPTED'
                        ? 'Accepted'
                        : st === 'IN_PROGRESS'
                        ? 'In Progress'
                        : 'Completed'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bookings List (Requirement 1 & 2: Show booking ID, customer name, contact details, service name, location, booking date, time, amount, latest booking status) */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[55vh] space-y-4">
              {filteredOfflineBookings.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Database className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {savedOfflineBookings.length === 0
                      ? 'No locally saved booking history found'
                      : 'No bookings match your search or filter'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {savedOfflineBookings.length === 0
                      ? 'When customer booking requests reach your worker dashboard, their details are automatically saved here in browser localStorage. You can view them even when offline.'
                      : 'Try adjusting your search query or selecting a different status filter.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOfflineBookings.map((job) => (
                    <div
                      key={job.id || job.bookingReference}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      {/* Top Bar: Booking ID & Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-slate-900 dark:bg-slate-800 text-white px-2.5 py-1 rounded-md">
                            {job.bookingReference}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-bold text-xs">
                            {translateCategory(job.workerCategory, lang)}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            job.status === 'ACCEPTED'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : job.status === 'IN_PROGRESS'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : job.status === 'COMPLETED'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : job.status === 'REJECTED'
                              ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                              : 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                          }`}
                        >
                          {translateStatus(job.status, lang)}
                        </span>
                      </div>

                      {/* Required Customer Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-300">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Customer Name</span>
                          <strong className="text-slate-900 dark:text-slate-100 text-sm">
                            {job.customerName || 'Customer'}
                          </strong>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Contact Details</span>
                          <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                            <Phone className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                            <span>{job.customerPhone || 'Contact not available'}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Date & Time</span>
                          <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                            <Calendar className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                            <span>{job.preferredDate} · {translateSlot(job.preferredTimeSlot, lang)}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Booking Amount</span>
                          <div className="font-mono">
                            <strong className="text-slate-900 dark:text-slate-100 text-sm">₹{job.amountInr}</strong>
                            <span className="text-[11px] text-teal-700 dark:text-teal-400 ml-1.5 font-medium">
                              (Worker Share: ₹{job.workerShareInr})
                            </span>
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Service Location</span>
                          <div className="flex items-start gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                            <MapPin className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                            <span>
                              {job.customerLocation?.addressLabel ||
                                (job.customerLocation?.lat && job.customerLocation?.lng
                                  ? `${job.customerLocation.lat}, ${job.customerLocation.lng}`
                                  : 'Location specified')}
                            </span>
                          </div>
                        </div>

                        {job.problemDescription && (
                          <div className="sm:col-span-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px]">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-0.5">
                              Customer Requirement:
                            </span>
                            <span className="text-slate-800 dark:text-slate-200">{job.problemDescription}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Unique Booking ID & Storage Confirmation */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                        <span>Unique Booking ID: <code className="font-mono text-slate-600 dark:text-slate-300 font-semibold">{job.id}</code></span>
                        <span>Saved in browser localStorage</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing <strong>{filteredOfflineBookings.length}</strong> of {savedOfflineBookings.length} saved booking(s)
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowLocalStorageModal(false);
                  setShowClearConfirm(false);
                }}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-teal-700 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-teal-600 transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Thumb-Zone Navigation Bar (Module 6 Mobile PWA) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-6 h-16">
        <button
          type="button"
          onClick={() => setActiveTab('jobs')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
            activeTab === 'jobs' ? 'text-teal-700 dark:text-teal-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{t.navWorkerJobs}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('earnings')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
            activeTab === 'earnings' ? 'text-teal-700 dark:text-teal-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>{t.navWorkerEarnings}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cooperativeFund')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
            activeTab === 'cooperativeFund' ? 'text-teal-700 dark:text-teal-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Coins className="w-4 h-4 text-teal-500" />
          <span>{t.navCooperativeFund || 'Coop Fund'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
            activeTab === 'profile' ? 'text-teal-700 dark:text-teal-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{t.navWorkerProfile}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
            activeTab === 'rules' ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BookOpen className="w-4 h-4 text-amber-500" />
          <span>{lang === 'bn' ? 'নিয়ম' : lang === 'hi' ? 'नियम' : 'Rules'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('learn')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
            activeTab === 'learn' ? 'text-teal-700 dark:text-teal-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span>{lang === 'bn' ? 'শিক্ষা' : lang === 'hi' ? 'सीखें' : 'Learn'}</span>
        </button>
      </nav>

      {/* MODAL 1: WORKER EMERGENCY SOS CONFIRMATION DIALOG (Feature 2) */}
      {showSosConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-red-200 dark:border-red-800 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Siren className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Trigger Emergency SOS Alert?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSosConfirmModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                Pressing confirm will immediately send an emergency signal to the Cooperative Society Safety Dispatch linked to your Worker ID (<code className="font-mono">{worker.id}</code>).
              </p>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1 text-amber-900 dark:text-amber-200">
                <strong className="block font-bold">Hackathon Prototype Notice:</strong>
                <p className="text-[11px] text-amber-850 dark:text-amber-300">
                  This demo alert is simulated (&quot;DEMO ALERT SENT&quot;). Police and municipal emergency services are NOT contacted without verified emergency integration.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareLocationWithSos}
                    onChange={(e) => setShareLocationWithSos(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                  />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      Share GPS location with Cooperative Dispatch
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Coordinates: {worker.coordinates ? `${worker.coordinates.lat.toFixed(4)}, ${worker.coordinates.lng.toFixed(4)}` : 'Current service zone'}. Your precise location is never exposed without permission.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSosConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingSos}
                onClick={handleSendSosAlert}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
              >
                {sendingSos ? 'Sending Alert...' : 'Yes, Trigger Demo SOS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: WORKER PROPOSE PRICE REVISION (Feature 1) */}
      {adjustingPriceJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Propose Price Revision for {adjustingPriceJob.bookingReference}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingPriceJob(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProposePriceRevision} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex justify-between font-mono">
                <span className="text-slate-600 dark:text-slate-400">Current Booking Amount:</span>
                <strong className="text-slate-900 dark:text-slate-100">₹{adjustingPriceJob.amountInr}.00</strong>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Labor Charge (₹):
                  </label>
                  <input
                    type="number"
                    min={150}
                    max={5000}
                    value={proposedLaborInr}
                    onChange={(e) => setProposedLaborInr(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Materials & Spare Parts (₹):
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={proposedMaterialsInr}
                    onChange={(e) => setProposedMaterialsInr(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Materials / Parts Description (Optional):
                  </label>
                  <input
                    type="text"
                    value={proposedMaterialsNote}
                    onChange={(e) => setProposedMaterialsNote(e.target.value)}
                    placeholder="e.g. 1-inch brass ball valve and 2 teflon tapes"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Revision (Required):
                  </label>
                  <textarea
                    rows={2}
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    placeholder="Explain why the price needs adjustment (e.g. Discovered concealed water pipe crack requiring specialized sealing coupling)."
                    required
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </div>

              {/* Proposed Total Calculation */}
              <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex justify-between items-center font-mono">
                <span className="font-semibold text-teal-950 dark:text-teal-200">Proposed New Total:</span>
                <strong className="text-base text-teal-800 dark:text-teal-300 font-bold">
                  ₹{proposedLaborInr + proposedMaterialsInr}.00
                </strong>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * Note: The customer must explicitly review and approve this revision in their Customer Portal before the booking amount changes.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingPriceJob(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRevision || !revisionReason.trim()}
                  className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                >
                  {submittingRevision ? 'Submitting...' : 'Submit Revision Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: WORKER DISPUTE REPORTING DIALOG (Feature 4) */}
      {disputeModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Report Problem on Booking {disputeModalJob.bookingReference}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDisputeModalJob(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleWorkerSubmitDispute} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Issue Category:
                </label>
                <select
                  value={disputeCategory}
                  onChange={(e) => setDisputeCategory(e.target.value as DisputeCategory)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                >
                  <option value="PAYMENT_ISSUE">Payment Problem / Customer refused to pay</option>
                  <option value="PRICING_DISAGREEMENT">Pricing Disagreement / Extra work demanded</option>
                  <option value="INCOMPLETE_WORK">Scope Dispute / Materials unavailable</option>
                  <option value="BEHAVIOR_ISSUE">Inappropriate Behavior / Safety concern</option>
                  <option value="OTHER">Other Dispute</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Short Description:
                </label>
                <textarea
                  rows={3}
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Detail the issue encountered during service delivery..."
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Optional Supporting Evidence Note:
                </label>
                <input
                  type="text"
                  value={disputeEvidence}
                  onChange={(e) => setDisputeEvidence(e.target.value)}
                  placeholder="e.g. Customer requested extra AC rewiring not in initial request."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 space-y-1 text-[11px]">
                <strong className="block text-slate-800 dark:text-slate-200 font-semibold">Neutral Resolution:</strong>
                <p>
                  A unique Complaint ID will be generated and reviewed by Cooperative Society Administration without automatic blame. Records are permanently logged.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeModalJob(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute || !disputeDescription.trim()}
                  className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                >
                  {submittingDispute ? 'Submitting...' : 'Submit Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Defect Problem Reporting & Gemma 4 AI Analysis Modal for Worker */}
      {problemModalJob && (
        <ProblemReportingModal
          isOpen={Boolean(problemModalJob)}
          onClose={() => setProblemModalJob(null)}
          booking={problemModalJob}
          existingReport={
            problemReports.find((r) => r.bookingId === problemModalJob.id) || null
          }
          userRole="WORKER"
          token={token}
          onReportCreated={(newRep) => {
            setProblemReports((prev) => [newRep, ...prev.filter((r) => r.id !== newRep.id)]);
            onRefreshData();
          }}
          onReportUpdated={(updatedRep) => {
            setProblemReports((prev) =>
              prev.map((r) => (r.id === updatedRep.id ? updatedRep : r))
            );
            onRefreshData();
          }}
          t={t}
          lang={lang}
          isOnline={effectiveOnline}
        />
      )}

      {/* Worker Offline Job Notes & Field Log Modal */}
      {jobNotesModalBooking && (
        <JobNotesModal
          isOpen={Boolean(jobNotesModalBooking)}
          onClose={() => setJobNotesModalBooking(null)}
          booking={jobNotesModalBooking}
          worker={worker}
          token={token}
          isOnline={effectiveOnline}
          lang={lang}
          t={t}
          onNotesUpdated={() => {
            refreshWorkerNotesState();
            onRefreshData();
          }}
        />
      )}

      {/* Demo UPI QR & Cash Settlement Modal for Worker */}
      {paymentModalJob && (
        <DemoPaymentModal
          isOpen={Boolean(paymentModalJob)}
          onClose={() => setPaymentModalJob(null)}
          booking={paymentModalJob}
          userRole="WORKER"
          token={token}
          lang={lang}
          onPaymentSuccess={async () => {
            setPaymentModalJob(null);
            await onRefreshData();
          }}
        />
      )}

      {/* Gemma 4 Feature 1: AI Complaint-to-Action Modal for Worker */}
      {selectedComplaintJob && (
        <AiComplaintToActionModal
          isOpen={Boolean(selectedComplaintJob)}
          onClose={() => setSelectedComplaintJob(null)}
          bookingId={selectedComplaintJob.id}
          bookingReference={selectedComplaintJob.bookingReference}
          complaintText={selectedComplaintJob.problemDescription}
          userRole="WORKER"
          workerPreferredLanguage={lang === 'bn' ? 'bn' : lang === 'hi' ? 'hi' : 'en'}
          token={token}
          lang={lang}
          t={t}
          onRecordUpdated={() => {
            onRefreshData();
          }}
        />
      )}

      {/* Gemma 4 Feature 3: AI Repair Report Generator / Editor Modal for Worker */}
      {selectedReportJob && (
        <AiRepairReportModal
          isOpen={Boolean(selectedReportJob)}
          onClose={() => setSelectedReportJob(null)}
          booking={selectedReportJob}
          userRole="WORKER"
          workerName={worker.name}
          token={token}
          lang={lang}
          t={t}
          onReportSaved={() => {
            onRefreshData();
          }}
        />
      )}

      {/* Requirement 4: Dedicated "New Job Received" Modal */}
      {newJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 my-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/80 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wide">
                      New Job Received
                    </span>
                    <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400">
                      {newJobModal.bookingReference}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {translateCategory(newJobModal.workerCategory, lang)} Service
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewJobModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              {/* Customer Contact */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Authorized Customer
                </span>
                <div className="flex items-center justify-between">
                  <strong className="text-sm text-slate-900 dark:text-slate-100 font-bold">
                    {newJobModal.customerName}
                  </strong>
                  <a
                    href={`tel:${newJobModal.customerPhone}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-mono font-semibold border border-teal-200 dark:border-teal-800 hover:bg-teal-100"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{newJobModal.customerPhone}</span>
                  </a>
                </div>
              </div>

              {/* Service Address & Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-0.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Service Address
                  </span>
                  <div className="flex items-start gap-1.5 pt-0.5 text-slate-900 dark:text-slate-100">
                    <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                    <span className="font-medium">
                      {newJobModal.customerLocation.addressLabel ||
                        `${newJobModal.customerLocation.lat}, ${newJobModal.customerLocation.lng}`}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-0.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Scheduled Appointment
                  </span>
                  <div className="flex items-start gap-1.5 pt-0.5 text-slate-900 dark:text-slate-100">
                    <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                    <span className="font-medium">
                      {newJobModal.preferredDate} · {translateSlot(newJobModal.preferredTimeSlot, lang)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Problem Description */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Task & Problem Description
                </span>
                <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 leading-relaxed">
                  {newJobModal.problemDescription}
                </p>
              </div>

              {/* Attached Problem Media */}
              {newJobModal.problemMediaUrls && newJobModal.problemMediaUrls.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Customer Attached Media ({newJobModal.problemMediaUrls.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {newJobModal.problemMediaUrls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-medium hover:underline text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Attachment {idx + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Estimated Earnings */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 block font-medium">
                    Your Cooperative Earnings (90% Share)
                  </span>
                  <strong className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    ₹{newJobModal.workerShareInr}
                  </strong>
                </div>
                <div className="text-right text-[11px] text-emerald-800 dark:text-emerald-300">
                  <span>Gross Booking: <strong>₹{newJobModal.amountInr}</strong></span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">10% to Coop Welfare</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={updatingId === newJobModal.id}
                onClick={async () => {
                  const id = newJobModal.id;
                  setNewJobModal(null);
                  await handleJobStatusChange(id, 'REJECTED');
                }}
                className="px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer active:scale-95"
              >
                Reject Job
              </button>
              <button
                type="button"
                disabled={updatingId === newJobModal.id}
                onClick={async () => {
                  const id = newJobModal.id;
                  setNewJobModal(null);
                  await handleJobStatusChange(id, 'ACCEPTED');
                }}
                className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Accept Job</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemma 4 Feature 1: Worker Digital Passport Modal */}
      {showWorkerPassportModal && worker && (
        <WorkerDigitalPassportModal
          isOpen={showWorkerPassportModal}
          onClose={() => setShowWorkerPassportModal(false)}
          worker={worker}
          workerId={worker.id}
          token={token}
          lang={lang}
        />
      )}

      {/* Gemma 4 Feature 5: Customer Rating Insights Modal */}
      {showRatingInsightsModal && worker && (
        <CustomerRatingInsightsModal
          isOpen={showRatingInsightsModal}
          onClose={() => setShowRatingInsightsModal(false)}
          workerId={worker.id}
          workerName={worker.name}
          token={token}
          lang={lang}
        />
      )}

      {/* Gemma 4 Feature 2: Fair Dispute Organizer Modal */}
      {workerDisputeBooking && (
        <FairDisputeOrganizerModal
          isOpen={Boolean(workerDisputeBooking)}
          onClose={() => setWorkerDisputeBooking(null)}
          bookingId={workerDisputeBooking.id}
          bookingReference={workerDisputeBooking.bookingReference}
          token={token}
          lang={lang}
        />
      )}
    </div>
  );
};
