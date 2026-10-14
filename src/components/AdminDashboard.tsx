import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  TrendingUp,
  Landmark,
  ClipboardList,
  RefreshCw,
  AlertTriangle,
  Scale,
  Siren,
  ShieldAlert,
  Check,
  HeartHandshake,
  Sparkles,
  BookOpen,
  Info,
  Compass,
  FileBadge2,
  Star,
  Cpu,
  Users,
  Settings as SettingsIcon,
  Edit2,
  Save,
  Phone,
  Mail,
  MapPin,
  Trash2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type {
  WorkerProfile,
  BookingRecord,
  WelfareLedgerEntry,
  DemandForecastResponse,
  DisputeRecord,
  EmergencyAlert,
  WelfareRequest,
  DisputeStatus,
  ProblemReport,
  AdminOperationalSummary,
  CustomerRecord,
  CooperativeSettings,
} from '../types';
import {
  type LanguageCode,
  translateCategory,
  translateStatus,
} from '../i18n/translations';
import { ProblemReportingModal } from './ProblemReportingModal';
import { AiCoopRuleExplainer } from './AiCoopRuleExplainer';
import { EarningsChart } from './EarningsChart';
import { WorkerDigitalPassportModal } from './WorkerDigitalPassportModal';
import { FairDisputeOrganizerModal } from './FairDisputeOrganizerModal';
import { CooperativeIntelligenceModal } from './CooperativeIntelligenceModal';
import { CustomerRatingInsightsModal } from './CustomerRatingInsightsModal';

interface AdminDashboardProps {
  token: string;
  activeTab: 'kyc' | 'bookings' | 'welfare' | 'forecast' | 'disputes' | 'rules' | 'intelligence' | 'customers' | 'settings';
  setActiveTab: (tab: 'kyc' | 'bookings' | 'welfare' | 'forecast' | 'disputes' | 'rules' | 'intelligence' | 'customers' | 'settings') => void;
  workers: WorkerProfile[];
  bookings: BookingRecord[];
  onRefreshAll: () => Promise<void>;
  t: Record<string, string>;
  lang?: LanguageCode;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  token,
  activeTab,
  setActiveTab,
  workers,
  bookings,
  onRefreshAll,
  t,
  lang = 'en',
}) => {
  const [ledger, setLedger] = useState<WelfareLedgerEntry[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState({
    totalTransactions: 0,
    totalGrossInr: 0,
    totalWorkerNetInr: 0,
    totalWelfareFundInr: 0,
  });

  const [selectedZone, setSelectedZone] = useState('Central Area');
  const [forecastData, setForecastData] = useState<DemandForecastResponse | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);

  // Gemma 4 Executive Operational Summary State
  const [operationalSummary, setOperationalSummary] = useState<AdminOperationalSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [badgeEditMap, setBadgeEditMap] = useState<Record<string, string>>({});
  const [adminMessage, setAdminMessage] = useState<string | null>(null);

  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlert[]>([]);
  const [welfareRequests, setWelfareRequests] = useState<WelfareRequest[]>([]);
  const [resolvingDisputeId, setResolvingDisputeId] = useState<string | null>(null);
  const [resolutionNoteMap, setResolutionNoteMap] = useState<Record<string, string>>({});
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);
  const [updatingWelfareId, setUpdatingWelfareId] = useState<string | null>(null);

  const [problemModalBooking, setProblemModalBooking] = useState<BookingRecord | null>(null);
  const [problemReports, setProblemReports] = useState<ProblemReport[]>([]);

  const [showResetPaymentModal, setShowResetPaymentModal] = useState(false);
  const [isResettingPayments, setIsResettingPayments] = useState(false);

  // Google Gemma 4 E4B Modal States
  const [passportWorker, setPassportWorker] = useState<WorkerProfile | null>(null);
  const [disputeBooking, setDisputeBooking] = useState<BookingRecord | null>(null);
  const [activeDisputeId, setActiveDisputeId] = useState<string | null>(null);
  const [ratingInsightsWorker, setRatingInsightsWorker] = useState<WorkerProfile | null>(null);
  const [showCoopIntelModal, setShowCoopIntelModal] = useState(false);

  // Customer Records Management
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [customerEditForm, setCustomerEditForm] = useState({
    name: '',
    phone: '',
    addressLabel: '',
    societyName: '',
  });

  // Cooperative Settings Management
  const [coopSettings, setCoopSettings] = useState<CooperativeSettings>({
    cooperativeName: 'Help Nest Cooperative Society',
    workerSplitPercent: 90,
    welfareSplitPercent: 10,
    emergencyHotline: '+91 98300 11222',
    minimumBaseRateInr: 300,
    activeServiceZones: [
      'Central Area',
      'North Area',
      'East Area',
      'IT Tech Area',
      'Sector-1',
      'Sector-2',
      'Sector-3',
      'Sector-5',
    ],
    governanceMeetingSchedule: 'First Saturday of every month',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Admin Worker & Booking Edit Modals/Forms
  const [editingWorker, setEditingWorker] = useState<WorkerProfile | null>(null);
  const [workerEditForm, setWorkerEditForm] = useState({
    name: '',
    phone: '',
    category: 'Plumber' as any,
    serviceZone: 'Sector-3',
    baseRateInr: 450,
    isAvailable: true,
  });

  const [ratingModalBooking, setRatingModalBooking] = useState<BookingRecord | null>(null);
  const [ratingEditForm, setRatingEditForm] = useState({ rating: 5, review: '' });

  const safeJson = async (res: Response) => {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        return await res.json();
      } catch {
        return {};
      }
    }
    return {};
  };

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const res = await fetch('/api/admin/customers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await safeJson(res);
        setCustomers(data.customers || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    try {
      const res = await fetch(`/api/admin/customers/${editingCustomer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(customerEditForm),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || 'Customer record updated successfully.');
        setEditingCustomer(null);
        await fetchCustomers();
        await onRefreshAll();
      } else {
        setAdminMessage(data.error || 'Failed to update customer record.');
      }
    } catch {
      setAdminMessage('Network error updating customer.');
    }
  };

  const handleDeleteCustomer = async (c: CustomerRecord) => {
    if (!window.confirm(`Permanently remove customer account for "${c.name}" (${c.email})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/customers/${c.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || `Customer account for ${c.name} removed successfully.`);
        await fetchCustomers();
        await onRefreshAll();
      } else {
        setAdminMessage(data.error || 'Failed to remove customer account.');
      }
    } catch {
      setAdminMessage('Network error removing customer account.');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await safeJson(res);
        if (data.settings) setCoopSettings(data.settings);
      }
    } catch {
      // Ignore
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(coopSettings),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || 'Cooperative settings saved successfully.');
        if (data.settings) setCoopSettings(data.settings);
      } else {
        setAdminMessage(data.error || 'Failed to save cooperative settings.');
      }
    } catch {
      setAdminMessage('Network error saving settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAdminUpdateBookingStatus = async (bookingId: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || `Booking status updated to ${status}.`);
        await onRefreshAll();
      } else {
        setAdminMessage(data.error || 'Failed to update booking status.');
      }
    } catch {
      setAdminMessage('Network error updating booking.');
    }
  };

  const handleAdminUpdateBookingPayment = async (
    bookingId: string,
    paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED'
  ) => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentStatus }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || `Booking payment status updated to ${paymentStatus}.`);
        await onRefreshAll();
      } else {
        setAdminMessage(data.error || 'Failed to update booking payment status.');
      }
    } catch {
      setAdminMessage('Network error updating booking payment status.');
    }
  };

  const handleAdminDeleteBooking = async (b: BookingRecord) => {
    if (!window.confirm(`Permanently remove booking record "${b.bookingReference}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/bookings/${b.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || `Booking ${b.bookingReference} removed.`);
        await onRefreshAll();
      } else {
        setAdminMessage(data.error || 'Failed to delete booking.');
      }
    } catch {
      setAdminMessage('Network error deleting booking.');
    }
  };

  const handleAdminModerateRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingModalBooking) return;
    try {
      const res = await fetch(`/api/admin/bookings/${ratingModalBooking.id}/rating`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: Number(ratingEditForm.rating),
          review: ratingEditForm.review,
        }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || 'Rating record moderated successfully.');
        setRatingModalBooking(null);
        await onRefreshAll();
      } else {
        setAdminMessage(data.error || 'Failed to moderate rating.');
      }
    } catch {
      setAdminMessage('Network error updating rating.');
    }
  };

  const handleAdminUpdateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;
    try {
      const res = await fetch(`/api/admin/workers/${editingWorker.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(workerEditForm),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || 'Worker profile updated successfully.');
        setEditingWorker(null);
        await onRefreshAll();
      } else {
        setAdminMessage(data.error || 'Failed to update worker.');
      }
    } catch {
      setAdminMessage('Network error updating worker.');
    }
  };

  const handleResetDemoPayments = async () => {
    setIsResettingPayments(true);
    try {
      const res = await fetch('/api/demo/reset-payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || 'Demo payment records cleared successfully.');
        setShowResetPaymentModal(false);
        await fetchLedger();
        await onRefreshAll();
      } else {
        setAdminMessage(data.error || 'Failed to reset demo payment records.');
      }
    } catch {
      setAdminMessage('Network error resetting demo payment data.');
    } finally {
      setIsResettingPayments(false);
    }
  };

  const fetchProblemReports = async () => {
    try {
      const res = await fetch('/api/problem-reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await safeJson(res);
        setProblemReports(data.reports || []);
      }
    } catch {
      // Ignore
    }
  };

  const fetchLedger = async () => {
    try {
      const res = await fetch('/api/admin/ledger', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await safeJson(res);
        setLedger(data.ledger || []);
        if (data.summary) setLedgerSummary(data.summary);
      }
    } catch {
      // Ignore
    }
  };

  const fetchDisputes = async () => {
    try {
      const res = await fetch('/api/disputes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await safeJson(res);
        setDisputes(data.disputes || []);
      }
    } catch {
      // Ignore
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/emergency/alerts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await safeJson(res);
        setEmergencyAlerts(data.alerts || []);
      }
    } catch {
      // Ignore
    }
  };

  const fetchWelfareRequests = async () => {
    try {
      const res = await fetch('/api/welfare/requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await safeJson(res);
        setWelfareRequests(data.requests || []);
      }
    } catch {
      // Ignore
    }
  };

  const handleUpdateDisputeStatus = async (
    disputeId: string,
    status: DisputeStatus
  ) => {
    setResolvingDisputeId(disputeId);
    try {
      const note = resolutionNoteMap[disputeId] || `Resolution marked as ${status} by Society Admin.`;
      const res = await fetch(`/api/disputes/${disputeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, resolutionNote: note }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || `Dispute updated to ${status}.`);
        await fetchDisputes();
        await onRefreshAll();
      } else {
        setAdminMessage(data.error || 'Failed to update dispute status.');
      }
    } catch {
      setAdminMessage('Network error updating dispute.');
    } finally {
      setResolvingDisputeId(null);
    }
  };

  const handleUpdateAlertStatus = async (
    alertId: string,
    status: 'RESOLVED' | 'CANCELLED_FALSE_ALARM'
  ) => {
    setUpdatingAlertId(alertId);
    try {
      const res = await fetch(`/api/emergency/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          cancellationReason:
            status === 'CANCELLED_FALSE_ALARM'
              ? 'Marked as false alarm by Society Admin'
              : 'Assistance verified and situation resolved',
        }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || `Emergency alert marked as ${status}.`);
        await fetchAlerts();
      } else {
        setAdminMessage(data.error || 'Failed to update alert.');
      }
    } catch {
      setAdminMessage('Network error updating alert.');
    } finally {
      setUpdatingAlertId(null);
    }
  };

  const handleUpdateWelfareStatus = async (
    requestId: string,
    status: 'APPROVED' | 'DISBURSED_DEMO' | 'REJECTED'
  ) => {
    setUpdatingWelfareId(requestId);
    try {
      const res = await fetch(`/api/welfare/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          reviewNote:
            status === 'APPROVED'
              ? 'Approved per Cooperative Society Welfare Guidelines.'
              : status === 'DISBURSED_DEMO'
              ? 'Disbursed via Cooperative Fund demo settlement account.'
              : 'Rejected: Incomplete supporting information or ineligible category.',
        }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAdminMessage(data.message || `Welfare request marked as ${status}.`);
        await fetchWelfareRequests();
      } else {
        setAdminMessage(data.error || 'Failed to update welfare request.');
      }
    } catch {
      setAdminMessage('Network error updating welfare request.');
    } finally {
      setUpdatingWelfareId(null);
    }
  };

  const fetchForecast = async (zoneName: string) => {
    setLoadingForecast(true);
    try {
      const res = await fetch(
        `/api/ai/demand-forecast?zone=${encodeURIComponent(zoneName)}&days=7`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = (await safeJson(res)) as DemandForecastResponse;
        setForecastData(data);
      }
    } finally {
      setLoadingForecast(false);
    }
  };

  const fetchOperationalSummary = async () => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const res = await fetch(`/api/ai/admin-operational-summary?lang=${lang}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await safeJson(res)) as AdminOperationalSummary;
        setOperationalSummary(data);
      } else {
        const err = await safeJson(res);
        setSummaryError(err.error || 'Failed to load operational briefing.');
      }
    } catch {
      setSummaryError('Network error retrieving operational briefing.');
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchLedger();
    fetchDisputes();
    fetchAlerts();
    fetchWelfareRequests();
    fetchProblemReports();
    fetchCustomers();
    fetchSettings();
  }, [bookings.length]);

  useEffect(() => {
    if (activeTab === 'disputes') {
      fetchDisputes();
      fetchAlerts();
      fetchWelfareRequests();
    } else if (activeTab === 'customers') {
      fetchCustomers();
    } else if (activeTab === 'settings') {
      fetchSettings();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'forecast') {
      fetchForecast(selectedZone);
      fetchOperationalSummary();
    }
  }, [activeTab, selectedZone, lang]);

  const handleKycDecision = async (
    worker: WorkerProfile,
    decision: 'VERIFIED' | 'REJECTED'
  ) => {
    const customBadgesStr = badgeEditMap[worker.id] ?? worker.skillBadges.join(', ');
    const parsedBadges = customBadgesStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch(`/api/admin/kyc/${worker.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        decision,
        reviewerNote:
          decision === 'VERIFIED'
            ? 'Approved by Society Federation Committee'
            : 'Requires clearer document reference number',
        skillBadges: parsedBadges,
      }),
    });
    if (res.ok) {
      const data = await safeJson(res);
      setAdminMessage(data.message);
      await onRefreshAll();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Federation Admin Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t.adminPortalTitle || 'Cooperative Society Administration'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl self-start lg:self-center border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveTab('kyc')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'kyc'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.navAdminKyc} ({workers.filter((w) => w.kycStatus === 'PENDING_REVIEW').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'bookings'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.navAdminBookings} ({bookings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('welfare')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'welfare'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.navAdminWelfare}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('forecast')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'forecast'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.navAdminForecast}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('disputes')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'disputes'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Disputes & SOS Alerts</span>
            {(disputes.filter((d) => d.status === 'SUBMITTED' || d.status === 'UNDER_REVIEW').length +
              emergencyAlerts.filter((a) => a.status === 'ACTIVE_DEMO').length) > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-600 text-white font-bold">
                {disputes.filter((d) => d.status === 'SUBMITTED' || d.status === 'UNDER_REVIEW').length +
                  emergencyAlerts.filter((a) => a.status === 'ACTIVE_DEMO').length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Coop Rules (AI)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('intelligence')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'intelligence'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                : 'text-teal-700 dark:text-teal-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            <span>Coop Intelligence</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'customers'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Customers ({customers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {adminMessage && (
        <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs font-medium text-teal-900 dark:text-teal-200 flex items-center justify-between">
          <span>{adminMessage}</span>
          <button
            type="button"
            onClick={() => setAdminMessage(null)}
            className="underline cursor-pointer"
          >
            {t.dismissBtn || 'Dismiss'}
          </button>
        </div>
      )}

      {/* TAB 1: WORKER KYC VERIFICATION & TRADE BADGES */}
      {activeTab === 'kyc' && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t.adminKycTitle || 'Cooperative Worker KYC Verification & Trade Skill Badges'}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {workers.length} {t.registeredWorkersCount || 'registered workers'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4 font-semibold">{t.thWorker || 'Worker'}</th>
                  <th className="py-3 px-4 font-semibold">{t.thTradeZone || 'Trade'}</th>
                  <th className="py-3 px-4 font-semibold">{t.thKycDoc || 'KYC Document'}</th>
                  <th className="py-3 px-4 font-semibold">{t.thStatus || 'Status'}</th>
                  <th className="py-3 px-4 font-semibold">{t.thSkillBadges || 'Trade Skill Badges'}</th>
                  <th className="py-3 px-4 font-semibold text-right">{t.thSocietyAction || 'Society Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{worker.name}</div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{worker.phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {translateCategory(worker.category, lang)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-700 dark:text-slate-300">{worker.kycDocumentType || '—'}</div>
                      <div className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                        {worker.kycDocumentNumber || '—'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          worker.kycStatus === 'VERIFIED'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : worker.kycStatus === 'PENDING_REVIEW'
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {translateStatus(worker.kycStatus, lang)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <input
                        type="text"
                        value={badgeEditMap[worker.id] ?? worker.skillBadges.join(', ')}
                        onChange={(e) =>
                          setBadgeEditMap({
                            ...badgeEditMap,
                            [worker.id]: e.target.value,
                          })
                        }
                        className="w-52 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-700"
                        placeholder="Comma-separated badges"
                      />
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWorker(worker);
                          setWorkerEditForm({
                            name: worker.name,
                            phone: worker.phone,
                            category: worker.category,
                            serviceZone: worker.serviceZone,
                            baseRateInr: worker.baseRateInr,
                            isAvailable: worker.isAvailable,
                          });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-medium cursor-pointer shadow-2xs transition-all active:scale-95"
                        title="Edit Worker Profile & Rates"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPassportWorker(worker)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-300 hover:bg-teal-100 text-xs font-medium cursor-pointer shadow-2xs transition-all active:scale-95"
                        title="View Worker Digital Passport (Gemma 4)"
                      >
                        <FileBadge2 className="w-3.5 h-3.5" />
                        <span>Passport</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRatingInsightsWorker(worker)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 text-xs font-medium cursor-pointer shadow-2xs transition-all active:scale-95"
                        title="View Customer Rating Insights (Gemma 4)"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>Insights</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKycDecision(worker, 'VERIFIED')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium cursor-pointer shadow-2xs transition-all active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t.approveKycBtn || 'Approve KYC'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKycDecision(worker, 'REJECTED')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium cursor-pointer shadow-2xs transition-all active:scale-95"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{t.rejectBtn || 'Reject'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: ALL COOPERATIVE BOOKINGS MONITOR */}
      {activeTab === 'bookings' && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t.allBookingsTitle || 'All Cooperative Service Bookings'}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {bookings.length} {lang === 'bn' ? 'টি মোট বুকিং' : lang === 'hi' ? 'कुल बुकिंग' : 'total bookings'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4 font-semibold">{t.thBookingRef || 'Ref'}</th>
                  <th className="py-3 px-4 font-semibold">{t.thCustomer || 'Customer'}</th>
                  <th className="py-3 px-4 font-semibold">{t.thTradeWorker || 'Trade & Worker'}</th>
                  <th className="py-3 px-4 font-semibold">{t.scheduledSlot || 'Scheduled Slot'}</th>
                  <th className="py-3 px-4 font-semibold text-right">{t.matchScoreLabel || 'Match Score'}</th>
                  <th className="py-3 px-4 font-semibold">{t.thStatus || 'Status'}</th>
                  <th className="py-3 px-4 font-semibold">{t.thAmount || 'Amount'}</th>
                  <th className="py-3 px-4 font-semibold">Rating</th>
                  <th className="py-3 px-4 font-semibold text-right">Defect & AI</th>
                  <th className="py-3 px-4 font-semibold text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">{b.bookingReference}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{b.customerName}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-xs">{b.customerLocation.addressLabel}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{b.workerName}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{translateCategory(b.workerCategory, lang)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-slate-200">{b.preferredDate}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{b.preferredTimeSlot}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-teal-800 dark:text-teal-400">
                      {b.matchingScore}/100
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        {translateStatus(b.status, lang)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      ₹{b.amountInr}{' '}
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        ({translateStatus(b.paymentStatus, lang)})
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {b.rating ? (
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-amber-500 flex items-center">
                            ★ {b.rating}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setRatingModalBooking(b);
                              setRatingEditForm({ rating: b.rating || 5, review: b.review || '' });
                            }}
                            className="ml-1 text-[10px] text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                            title="Moderate rating and review"
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRatingModalBooking(b);
                            setRatingEditForm({ rating: 5, review: '' });
                          }}
                          className="text-[10px] text-slate-500 hover:text-teal-700 dark:hover:text-teal-400 underline cursor-pointer"
                        >
                          + Set Rating
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setProblemModalBooking(b)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                          b.hasProblemReport || problemReports.some((r) => r.bookingId === b.id)
                            ? 'border-teal-400 dark:border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 shadow-2xs hover:bg-teal-100'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                        }`}
                        title="View defect report and Gemma 4 AI diagnosis"
                      >
                        <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                        <span>
                          {b.hasProblemReport || problemReports.some((r) => r.bookingId === b.id)
                            ? 'Report & AI'
                            : 'Inspect'}
                        </span>
                        {(b.hasProblemReport || problemReports.some((r) => r.bookingId === b.id)) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDisputeBooking(b);
                          setActiveDisputeId(b.disputeId || null);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100 transition"
                        title="Generate Fair Dispute Dossier with Google Gemma 4 E4B"
                      >
                        <Scale className="w-3 h-3 text-amber-600" />
                        <span>Dispute AI</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => handleAdminUpdateBookingStatus(b.id, 'CANCELLED')}
                          className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[11px] font-semibold transition cursor-pointer"
                          title="Admin cancel booking"
                        >
                          Cancel
                        </button>
                      )}
                      {b.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => handleAdminUpdateBookingStatus(b.id, 'ACCEPTED')}
                          className="px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 text-[11px] font-semibold transition cursor-pointer"
                          title="Admin accept job"
                        >
                          Accept
                        </button>
                      )}
                      {(b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS') && (
                        <button
                          type="button"
                          onClick={() => handleAdminUpdateBookingStatus(b.id, 'COMPLETED')}
                          className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-semibold transition cursor-pointer"
                          title="Admin mark completed"
                        >
                          Complete
                        </button>
                      )}
                      {b.paymentStatus !== 'PAID' ? (
                        <button
                          type="button"
                          onClick={() => handleAdminUpdateBookingPayment(b.id, 'PAID')}
                          className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[11px] font-semibold transition cursor-pointer"
                          title="Admin record payment received"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAdminUpdateBookingPayment(b.id, 'REFUNDED')}
                          className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] font-semibold transition cursor-pointer"
                          title="Admin mark payment refunded"
                        >
                          Refund
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAdminDeleteBooking(b)}
                        className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 dark:hover:bg-red-950/30 transition cursor-pointer"
                        title="Remove booking record"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: COOPERATIVE WELFARE FUND LEDGER */}
      {activeTab === 'welfare' && (
        <div className="space-y-6">
          {/* Demo Simulation Notice Banner */}
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shrink-0 mt-0.5">
                DEMO MODE
              </span>
              <div>
                <strong className="block font-bold">Simulated Cooperative Welfare Fund Ledger</strong>
                <span>
                  All payments, worker shares (90%), and cooperative fund contributions (10%) are simulated for hackathon evaluation. They never represent real bank deposits or funds available for withdrawal.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowResetPaymentModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0 shadow-2xs active:scale-95 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
              <span>Reset Demo Payment Data</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t.totalGrossLabel || 'Total Settled Gross Volume'}
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                ₹{ledgerSummary.totalGrossInr.toLocaleString('en-IN')}.00
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Simulated gross volume</span>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                {t.workerNetLabel || 'Disbursed to Workers (90% Share)'}
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-300 mt-1">
                ₹{ledgerSummary.totalWorkerNetInr.toLocaleString('en-IN')}.00
              </div>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 block">Worker member net earnings</span>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <span className="text-xs text-teal-700 dark:text-teal-400 font-medium">
                {t.welfareFundLabel || 'Cooperative Welfare Reserve (10% Fund)'}
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-teal-800 dark:text-teal-300 mt-1">
                ₹{ledgerSummary.totalWelfareFundInr.toLocaleString('en-IN')}.00
              </div>
              <span className="text-[10px] text-teal-600/80 dark:text-teal-400/80 mt-0.5 block">Community social security pool</span>
            </div>
          </div>

          {/* Transparent Charts and Earnings (Requirement 4) */}
          <EarningsChart
            bookings={bookings}
            ledgerEntries={ledger}
            role="ADMIN"
            lang={lang}
            title="Transparent Cooperative Financial Analytics (90% Worker Share · 10% Welfare Fund)"
          />

          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{t.welfareLedgerTitle || 'Welfare Fund Transaction Ledger (90:10 Cooperative Split)'}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                    DEMO
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time record of all confirmed simulated cash and UPI transactions
                </p>
              </div>
              <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                {ledger.length} {ledger.length === 1 ? 'record' : 'records'}
              </span>
            </div>

            {ledger.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Landmark className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Demo Payments Recorded Yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Complete a booking in the Worker Dashboard and confirm a demo payment in the Customer Dashboard (via UPI QR scan or Cash) to view the automatic 90:10 cooperative allocation here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-4 font-semibold">Transaction Ref</th>
                      <th className="py-3 px-4 font-semibold">{t.thBookingRef || 'Booking Ref'}</th>
                      <th className="py-3 px-4 font-semibold">{t.thWorker || 'Worker'}</th>
                      <th className="py-3 px-4 font-semibold text-right">Gross (100%)</th>
                      <th className="py-3 px-4 font-semibold text-right">{t.workerNetLabel || 'Worker (90%)'}</th>
                      <th className="py-3 px-4 font-semibold text-right">{t.welfareFundLabel || 'Welfare (10%)'}</th>
                      <th className="py-3 px-4 font-semibold">Payment Method</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {ledger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-teal-800 dark:text-teal-400 font-semibold">{entry.paymentId}</td>
                        <td className="py-3 px-4 font-mono text-[11px]">{entry.bookingReference}</td>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                          {entry.workerName}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 font-semibold">
                          ₹{entry.grossAmountInr}.00
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-800 dark:text-emerald-300 font-semibold">
                          ₹{entry.workerNetInr}.00
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-teal-800 dark:text-teal-300 font-semibold">
                          ₹{entry.welfareContributionInr}.00
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {entry.paymentMode?.includes('CASH') ? 'Cash (Demo)' : 'UPI (Demo)'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Confirmed (Demo)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {new Date(entry.timestamp).toLocaleString(lang === 'bn' ? 'bn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Reset Demo Payment Records Modal */}
          {showResetPaymentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
              <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 my-auto">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Reset Demo Payment Records?
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      This will reset all demo transaction references, clear simulated welfare ledger records, and return completed bookings to the unpaid state.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  <strong className="block text-slate-900 dark:text-slate-100">Preservation Guarantee:</strong>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <li>Customer and worker accounts are strictly preserved.</li>
                    <li>Bookings and schedule assignments remain in place.</li>
                    <li>Problem reports and Gemma 4 AI diagnoses are preserved.</li>
                  </ul>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isResettingPayments}
                    onClick={() => setShowResetPaymentModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isResettingPayments}
                    onClick={handleResetDemoPayments}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isResettingPayments ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Resetting...</span>
                      </>
                    ) : (
                      <span>Confirm Reset Demo Data</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feature 5: Worker Welfare Assistance Claims & Approvals */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  <span>Worker Welfare Assistance Claims (Demo Review & Approvals)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Simulated cooperative benefit claims submitted by registered workers
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
                {welfareRequests.length} Claim(s)
              </span>
            </div>

            {welfareRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No welfare assistance claims submitted yet. Workers can apply from their Worker Welfare Tracker.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-4 font-semibold">Claim ID</th>
                      <th className="py-3 px-4 font-semibold">Worker</th>
                      <th className="py-3 px-4 font-semibold">Benefit Category</th>
                      <th className="py-3 px-4 font-semibold text-right">Requested ₹</th>
                      <th className="py-3 px-4 font-semibold">Reason</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {welfareRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">
                          {req.id}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                          {req.workerName}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                          <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[11px] font-bold">
                            {req.benefitCategory.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          ₹{req.requestedAmountInr.toLocaleString('en-IN')}
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
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {req.status === 'SUBMITTED' || req.status === 'UNDER_REVIEW' ? (
                            <>
                              <button
                                type="button"
                                disabled={updatingWelfareId === req.id}
                                onClick={() => handleUpdateWelfareStatus(req.id, 'APPROVED')}
                                className="px-2.5 py-1 rounded bg-teal-700 text-white text-[11px] font-semibold hover:bg-teal-800 cursor-pointer disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={updatingWelfareId === req.id}
                                onClick={() => handleUpdateWelfareStatus(req.id, 'REJECTED')}
                                className="px-2.5 py-1 rounded border border-red-300 text-red-700 text-[11px] font-semibold hover:bg-red-50 cursor-pointer disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : req.status === 'APPROVED' ? (
                            <button
                              type="button"
                              disabled={updatingWelfareId === req.id}
                              onClick={() => handleUpdateWelfareStatus(req.id, 'DISBURSED_DEMO')}
                              className="px-2.5 py-1 rounded bg-emerald-700 text-white text-[11px] font-semibold hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
                            >
                              Disburse Demo
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">Completed</span>
                          )}
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

      {/* TAB 4: 7-DAY DEMAND FORECAST & ZONE ANALYTICS (GET /api/ai/demand-forecast) */}
      {activeTab === 'forecast' && (
        <div className="space-y-6">
          {/* FEATURE G & H: Gemma 4 Executive Operational Briefing & Service Insights */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-teal-200/90 dark:border-teal-800/80 p-6 space-y-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {lang === 'bn'
                        ? 'গেমা ৪ সমবায় প্রশাসনিক পর্যবেক্ষণ ও গোয়েন্দা সারাংশ'
                        : lang === 'hi'
                        ? 'जेम्मा 4 सहकारी प्रशासनिक अवलोकन व बुद्धिमत्ता सारांश'
                        : 'Gemma 4 Cooperative Operational Intelligence Briefing'}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      {operationalSummary?.modelUsed || 'Gemma 4 AI'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'বাস্তব ডাটাবেস বুকিং ও কর্মী রেকর্ড থেকে সংগৃহীত নির্বাহী অন্তর্দৃষ্টি'
                      : lang === 'hi'
                      ? 'वास्तविक डेटाबेस बुकिंग और कार्यकर्ता रिकॉर्ड से कार्यकारी अंतर्दृष्टि'
                      : 'Authorized executive summary and service demand patterns generated from verified database records'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchOperationalSummary}
                disabled={loadingSummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-2xs transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
                <span>
                  {loadingSummary
                    ? (lang === 'bn' ? 'বিশ্লেষণ চলছে...' : lang === 'hi' ? 'विश्लेषण जारी...' : 'Analyzing...')
                    : (lang === 'bn' ? 'সারাংশ রিফ্রেশ করুন' : lang === 'hi' ? 'सारांश रीफ्रेश करें' : 'Refresh AI Briefing')}
                </span>
              </button>
            </div>

            {loadingSummary && !operationalSummary ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 text-teal-600 animate-spin" />
                <span>
                  {lang === 'bn'
                    ? 'গেমা ৪ ডাটাবেস বুকিং পরিসংখ্যান বিশ্লেষণ করছে...'
                    : lang === 'hi'
                    ? 'जेम्मा 4 डेटाबेस बुकिंग आंकड़ों का विश्लेषण कर रहा है...'
                    : 'Gemma 4 is analyzing verified cooperative records...'}
                </span>
              </div>
            ) : summaryError && !operationalSummary ? (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{summaryError}</span>
              </div>
            ) : operationalSummary ? (
              <div className="space-y-4">
                {/* 1. Executive Summary Paragraph */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                    {lang === 'bn' ? 'নির্বাহী সারাংশ' : lang === 'hi' ? 'कार्यकारी सारांश' : 'Executive Summary'}
                  </span>
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    {operationalSummary.executiveSummary}
                  </p>
                </div>

                {/* 2. Key Database Statistics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                      {lang === 'bn' ? 'মোট বুকিং' : lang === 'hi' ? 'कुल बुकिंग' : 'Total Bookings'}
                    </span>
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                      {operationalSummary.totalBookings}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      {operationalSummary.completedBookings} {lang === 'bn' ? 'সম্পন্ন' : lang === 'hi' ? 'पूर्ण' : 'completed'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                      {lang === 'bn' ? 'সক্রিয় যাচাইকৃত কর্মী' : lang === 'hi' ? 'सक्रिय सत्यापित कार्यकर्ता' : 'Active Verified Workers'}
                    </span>
                    <span className="text-lg font-bold font-mono text-teal-700 dark:text-teal-300">
                      {operationalSummary.activeWorkers}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {workers.length} {lang === 'bn' ? 'মোট নিবন্ধিত' : lang === 'hi' ? 'कुल पंजीकृत' : 'total registered'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                      {lang === 'bn' ? 'শীর্ষ চাহিদার কাজ' : lang === 'hi' ? 'शीर्ष मांग श्रेणी' : 'Top Service Trade'}
                    </span>
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100 truncate block">
                      {translateCategory(operationalSummary.topRequestedCategory as any, lang)}
                    </span>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 block mt-0.5">
                      {lang === 'bn' ? 'সর্বাধিক বুকিং' : lang === 'hi' ? 'सर्वाधिक मांग' : 'Highest demand'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                      {lang === 'bn' ? 'অমীমাংসিত বিরোধ' : lang === 'hi' ? 'लंबित विवाद' : 'Pending Disputes'}
                    </span>
                    <span className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400">
                      {operationalSummary.pendingDisputesCount}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {disputes.length} {lang === 'bn' ? 'মোট বিরোধ' : lang === 'hi' ? 'कुल मामले' : 'total logged'}
                    </span>
                  </div>
                </div>

                {/* 3. Operational Insights: Issues & Recommendations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>{lang === 'bn' ? 'পুনরাবৃত্তিমূলক পরিচালন সমস্যা ও চাহিদা' : lang === 'hi' ? 'आवर्ती परिचालन मुद्दे और मांग एकाग्रता' : 'Recurring Operational Issues & Demand Concentrations'}</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 pl-4 list-disc">
                      {operationalSummary.recurringIssues.map((issue, idx) => (
                        <li key={idx} className="leading-snug">{issue}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-800/60 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 dark:text-teal-300">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      <span>{lang === 'bn' ? 'সমবায় সমিতির জন্য পদক্ষেপযোগ্য সুপারিশ' : lang === 'hi' ? 'सहकारी समिति हेतु कार्रवाई योग्य सुझाव' : 'Actionable Cooperative Recommendations'}</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 pl-4 list-disc">
                      {operationalSummary.actionableRecommendations.map((rec, idx) => (
                        <li key={idx} className="leading-snug">{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 4. Demand Observations & Data Limitations Notice */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-teal-600" />
                    <span>{lang === 'bn' ? 'তথ্য সীমাবদ্ধতা ও পর্যবেক্ষণ বিজ্ঞপ্তি' : lang === 'hi' ? 'डेटा सीमाएं और अवलोकन नोटिस' : 'Data Limitations & Demand Observations'}</span>
                  </div>
                  {operationalSummary.demandObservations.map((obs, idx) => (
                    <p key={idx} className="text-[11px] leading-relaxed">• {obs}</p>
                  ))}
                  <p className="text-[10px] text-slate-500 dark:text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    {operationalSummary.dataLimitationsNotice}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {t.forecastTitle || '7-Day Service Demand Forecast'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'bn' ? 'AI ভিত্তিক সাপ্তাহিক কাজের চাহিদা বিশ্লেষণ' : lang === 'hi' ? 'AI आधारित साप्ताहिक कार्य मांग विश्लेषण' : 'AI-driven weekly household demand analytics'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-700"
                >
                  <option value="Central Area">{lang === 'bn' ? 'সেন্ট্রাল এলাকা' : lang === 'hi' ? 'सेंट्रल क्षेत्र' : 'Central Area'}</option>
                  <option value="North Area">{lang === 'bn' ? 'উত্তর এলাকা' : lang === 'hi' ? 'उत्तर क्षेत्र' : 'North Area'}</option>
                  <option value="East Area">{lang === 'bn' ? 'পূর্ব এলাকা' : lang === 'hi' ? 'পূর্ব क्षेत्र' : 'East Area'}</option>
                  <option value="IT Tech Area">{lang === 'bn' ? 'আইটি টেক এলাকা' : lang === 'hi' ? 'आईटी टेक क्षेत्र' : 'IT Tech Area'}</option>
                </select>
                <button
                  type="button"
                  onClick={() => fetchForecast(selectedZone)}
                  disabled={loadingForecast}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-teal-700 text-white text-xs font-medium cursor-pointer shadow-2xs hover:bg-slate-800 dark:hover:bg-teal-600 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingForecast ? 'animate-spin' : ''}`} />
                  <span>{t.refreshBtn || 'Refresh'}</span>
                </button>
              </div>
            </div>

            {forecastData && (
              <>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
                  <span>{forecastData.dataNotice}</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                    Source: {forecastData.modelUsed}
                  </span>
                </div>

                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastData.dailyForecast}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.3} />
                      <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                      <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#FFF' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Area
                        type="monotone"
                        dataKey="baselineSampleBookings"
                        name={lang === 'bn' ? 'নমুনা বেসলাইন' : lang === 'hi' ? 'नमूना बेसलाइन' : 'Baseline Sample'}
                        stroke="#64748B"
                        fill="#94A3B8"
                        fillOpacity={0.2}
                      />
                      <Area
                        type="monotone"
                        dataKey="predictedDemand"
                        name={lang === 'bn' ? 'পূর্বাভাস চাহিদা' : lang === 'hi' ? 'पूर्वानुमान मांग' : 'Forecast Demand'}
                        stroke="#0F766E"
                        fill="#0D9488"
                        fillOpacity={0.4}
                      />
                      <Area
                        type="monotone"
                        dataKey="actualHistoricalBookings"
                        name={lang === 'bn' ? 'রেকর্ডকৃত বুকিং' : lang === 'hi' ? 'वास्तविक बुकिंग' : 'Actual Bookings'}
                        stroke="#D97706"
                        fill="#F59E0B"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {forecastData && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t.zoneDistributionTitle || 'Area Demand Distribution'}
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastData.zoneBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.3} />
                    <XAxis dataKey="zone" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#FFF' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="electrician" name={translateCategory('Electrician', lang)} fill="#0F766E" />
                    <Bar dataKey="plumber" name={translateCategory('Plumber', lang)} fill="#0284C7" />
                    <Bar dataKey="cleaner" name={translateCategory('Cleaner', lang)} fill="#D97706" />
                    <Bar dataKey="carpenter" name={translateCategory('Carpenter', lang)} fill="#475569" />
                    <Bar dataKey="babysitter" name={translateCategory('Babysitter', lang)} fill="#7C3AED" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DISPUTE RESOLUTION & WORKER EMERGENCY SOS MONITORING */}
      {activeTab === 'disputes' && (
        <div className="space-y-6">
          {/* Section 1: Worker Emergency SOS Alerts */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400">
                  <Siren className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Worker Emergency SOS Alerts Monitor
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                      Demo Simulation
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live emergency triggers sent by workers during fieldwork. Simulation only; police/emergency services are not contacted without certified integration.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800">
                {emergencyAlerts.length} Total Alert(s)
              </span>
            </div>

            {emergencyAlerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No worker emergency SOS alerts triggered. When workers press the SOS button in their dashboard, alerts appear here immediately.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-4 font-semibold">Alert ID</th>
                      <th className="py-3 px-4 font-semibold">Worker</th>
                      <th className="py-3 px-4 font-semibold">Booking Reference</th>
                      <th className="py-3 px-4 font-semibold">Timestamp</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Society Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {emergencyAlerts.map((alt) => (
                      <tr key={alt.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">
                          {alt.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{alt.workerName}</div>
                          <div className="text-slate-500 text-[11px] font-mono">{alt.workerPhone}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {alt.bookingReference || 'Field Patrol / Standby'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {new Date(alt.timestamp).toLocaleString(lang === 'bn' ? 'bn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              alt.status === 'ACTIVE_DEMO'
                                ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 animate-pulse'
                                : alt.status === 'RESOLVED'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {alt.status === 'ACTIVE_DEMO' ? 'DEMO ALERT SENT' : alt.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {alt.status === 'ACTIVE_DEMO' ? (
                            <>
                              <button
                                type="button"
                                disabled={updatingAlertId === alt.id}
                                onClick={() => handleUpdateAlertStatus(alt.id, 'RESOLVED')}
                                className="px-2.5 py-1 rounded bg-teal-700 text-white text-[11px] font-semibold hover:bg-teal-800 cursor-pointer disabled:opacity-50"
                              >
                                Mark Resolved
                              </button>
                              <button
                                type="button"
                                disabled={updatingAlertId === alt.id}
                                onClick={() => handleUpdateAlertStatus(alt.id, 'CANCELLED_FALSE_ALARM')}
                                className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 text-[11px] font-semibold hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                              >
                                False Alarm
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">
                              {alt.cancellationReason || 'Closed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 2: Dispute Resolution Panel */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Dispute & Grievance Resolution Panel
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Review and resolve complaints from customers and workers regarding payments, pricing, or incomplete work.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                {disputes.length} Complaint(s)
              </span>
            </div>

            {disputes.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No active complaints filed. Both customers and workers can file disputes against any booking from their dashboard.
                </p>
                {bookings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDisputeBooking(bookings[0]);
                      setActiveDisputeId(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Scale className="w-4 h-4" />
                    <span>Run Fair Dispute AI on Recent Booking ({bookings[0].bookingReference})</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {disputes.map((disp) => (
                  <div
                    key={disp.id}
                    className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold bg-slate-900 dark:bg-slate-800 text-white px-2.5 py-1 rounded-md">
                          {disp.complaintReference}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-xs">
                          {disp.category.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Booking: <code className="font-mono font-semibold">{disp.bookingReference}</code>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const bkg = bookings.find((b) => b.id === disp.bookingId || b.bookingReference === disp.bookingReference) || bookings[0];
                            setDisputeBooking(bkg || null);
                            setActiveDisputeId(disp.id);
                          }}
                          className="px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                          title="Generate unbiased dispute resolution dossier with Google Gemma 4 E4B"
                        >
                          <Scale className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                          <span>Fair Dispute AI Dossier</span>
                        </button>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            disp.status === 'RESOLVED'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : disp.status === 'UNDER_REVIEW'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : disp.status === 'REJECTED'
                              ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          Status: {disp.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Complainant</span>
                        <strong className="text-slate-900 dark:text-slate-100">
                          {disp.filedByName} ({disp.filedByRole})
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Date Filed</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {new Date(disp.createdAt).toLocaleString(lang === 'bn' ? 'bn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN')}
                        </span>
                      </div>
                      <div className="md:col-span-2 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-0.5">
                          Problem Description:
                        </span>
                        <p className="text-slate-800 dark:text-slate-200">{disp.description}</p>
                        {disp.evidenceNote && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                            Evidence note: {disp.evidenceNote}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Resolution Note & Actions */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={resolutionNoteMap[disp.id] ?? (disp.resolutionNote || '')}
                          onChange={(e) =>
                            setResolutionNoteMap((prev) => ({ ...prev, [disp.id]: e.target.value }))
                          }
                          placeholder="Resolution details or notes..."
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-700"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        {disp.status !== 'UNDER_REVIEW' && disp.status !== 'RESOLVED' && (
                          <button
                            type="button"
                            disabled={resolvingDisputeId === disp.id}
                            onClick={() => handleUpdateDisputeStatus(disp.id, 'UNDER_REVIEW')}
                            className="px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 text-xs font-semibold hover:bg-blue-50 cursor-pointer disabled:opacity-50"
                          >
                            Mark Under Review
                          </button>
                        )}
                        {disp.status !== 'RESOLVED' && (
                          <button
                            type="button"
                            disabled={resolvingDisputeId === disp.id}
                            onClick={() => handleUpdateDisputeStatus(disp.id, 'RESOLVED')}
                            className="px-3.5 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer disabled:opacity-50 shadow-2xs"
                          >
                            Resolve Dispute
                          </button>
                        )}
                        {disp.status !== 'REJECTED' && disp.status !== 'RESOLVED' && (
                          <button
                            type="button"
                            disabled={resolvingDisputeId === disp.id}
                            onClick={() => handleUpdateDisputeStatus(disp.id, 'REJECTED')}
                            className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 cursor-pointer disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* GEMMA 4 FEATURE 5: AI COOPERATIVE RULE EXPLAINER PANEL FOR ADMIN */}
      {activeTab === 'rules' && (
        <AiCoopRuleExplainer
          token={token}
          lang={lang}
          t={t}
          workerName="Cooperative Federation Admin"
          workerTrade="Administration & Governance"
        />
      )}

      {/* GEMMA 4 E4B FEATURE 4: COOPERATIVE INTELLIGENCE VIEW */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 rounded-xl">
                  <Compass className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Cooperative Intelligence Command
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> Google Gemma 4 E4B
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Live booking trends, popular services ranking, and fair 90:10 welfare mutual aid health.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCoopIntelModal(true)}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open Full Intelligence Command</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">Total Bookings</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono mt-1">
                  {bookings.length}
                </div>
                <div className="text-[11px] text-teal-700 dark:text-teal-400 mt-1 font-medium">
                  Verified in database
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">Active Verified Workers</div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-1">
                  {workers.filter((w) => w.verified).length}
                </div>
                <div className="text-[11px] text-emerald-600 mt-1 font-medium">
                  Dispatch-Ready
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">Completed Volume</div>
                <div className="text-2xl font-bold text-teal-700 dark:text-teal-400 font-mono mt-1">
                  {bookings.filter((b) => b.status === 'COMPLETED').length}
                </div>
                <div className="text-[11px] text-teal-600 mt-1 font-medium">
                  90:10 Disbursed
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">Welfare Fund Pool</div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">
                  ₹{ledgerSummary.totalWelfareFundInr.toLocaleString()}
                </div>
                <div className="text-[11px] text-amber-600 mt-1 font-medium">
                  Mutual Aid Safe
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Click below to run Google Gemma 4 E4B intelligence across active Salt Lake sectors.
              </span>
              <button
                type="button"
                onClick={() => setShowCoopIntelModal(true)}
                className="px-4 py-2 bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-600 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Compass className="w-4 h-4 text-amber-400" />
                <span>Launch Gemma 4 Deep Analysis</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TAB: CUSTOMER MANAGEMENT */}
      {activeTab === 'customers' && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs space-y-4 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-700" />
                <span>Cooperative Customer Records Management</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage registered household accounts, verify locality service records, and inspect household booking volume.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search by customer name, phone, or area..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
              <button
                type="button"
                onClick={fetchCustomers}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
                title="Refresh Customers"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl text-xs text-teal-900 dark:text-teal-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
            <span>
              <strong>Credential Protection Enforced:</strong> In accordance with cooperative bylaws, user passwords, hashes, and authentication tokens are strictly protected and withheld from dashboard views.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4 font-semibold">Customer Account</th>
                  <th className="py-3 px-4 font-semibold">Contact Phone</th>
                  <th className="py-3 px-4 font-semibold">Service Address / Area</th>
                  <th className="py-3 px-4 font-semibold">Coop Society</th>
                  <th className="py-3 px-4 font-semibold text-center">Bookings</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Spent</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers
                  .filter((c) => {
                    if (!customerSearch) return true;
                    const query = customerSearch.toLowerCase();
                    return (
                      c.name.toLowerCase().includes(query) ||
                      c.email.toLowerCase().includes(query) ||
                      c.phone.includes(query) ||
                      (c.location?.addressLabel || '').toLowerCase().includes(query) ||
                      (c.societyName || '').toLowerCase().includes(query)
                    );
                  })
                  .map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">{c.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 dark:text-slate-200 font-mono text-[11px]">{c.phone || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-700 dark:text-slate-300 truncate max-w-xs">
                          {c.location?.addressLabel || '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-600 dark:text-slate-400">{c.societyName || 'Help Nest Cooperative'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                          {c.totalBookings || 0}
                        </span>{' '}
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          ({c.completedBookings || 0} completed)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-teal-800 dark:text-teal-400">
                        ₹{(c.totalSpentInr || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCustomer(c);
                            setCustomerEditForm({
                              name: c.name,
                              phone: c.phone,
                              addressLabel: c.location?.addressLabel || '',
                              societyName: c.societyName || '',
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-medium cursor-pointer shadow-2xs transition-all active:scale-95"
                          title="Edit Customer Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 text-xs font-medium cursor-pointer shadow-2xs transition-all active:scale-95"
                          title="Remove Customer Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-xs text-slate-500">
                      {loadingCustomers ? 'Loading customer accounts...' : 'No customer accounts registered yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB: COOPERATIVE SETTINGS & BYLAWS */}
      {activeTab === 'settings' && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs p-5 sm:p-6 space-y-6">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-teal-700" />
                <span>Cooperative Platform Governance & Settlement Settings</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure cooperative financial rules, emergency helpline, minimum base rates, and active operational zones.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchSettings}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              title="Reload settings"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5 max-w-2xl text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cooperative Society Name
                </label>
                <input
                  type="text"
                  required
                  value={coopSettings.cooperativeName}
                  onChange={(e) => setCoopSettings({ ...coopSettings, cooperativeName: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Emergency SOS Hotline Number
                </label>
                <input
                  type="text"
                  required
                  value={coopSettings.emergencyHotline}
                  onChange={(e) => setCoopSettings({ ...coopSettings, emergencyHotline: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 font-mono"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-teal-700" />
                <span>Financial Settlement Split (90 : 10 Rule)</span>
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                In strict adherence to Cooperative Society bylaws, workers receive 90% direct payout and 10% is allocated to the Community Mutual Aid & Welfare Pool.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Worker Direct Share (%)
                  </label>
                  <input
                    type="number"
                    min="70"
                    max="95"
                    value={coopSettings.workerSplitPercent}
                    onChange={(e) =>
                      setCoopSettings({
                        ...coopSettings,
                        workerSplitPercent: Number(e.target.value),
                        welfareSplitPercent: 100 - Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Welfare Fund Mutual Aid Share (%)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="30"
                    value={coopSettings.welfareSplitPercent}
                    onChange={(e) =>
                      setCoopSettings({
                        ...coopSettings,
                        welfareSplitPercent: Number(e.target.value),
                        workerSplitPercent: 100 - Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Minimum Standard Service Rate (INR ₹)
                </label>
                <input
                  type="number"
                  min="100"
                  max="1000"
                  value={coopSettings.minimumBaseRateInr}
                  onChange={(e) => setCoopSettings({ ...coopSettings, minimumBaseRateInr: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Governance Assembly Schedule
                </label>
                <input
                  type="text"
                  value={coopSettings.governanceMeetingSchedule}
                  onChange={(e) => setCoopSettings({ ...coopSettings, governanceMeetingSchedule: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Saving Settings...' : 'Save Cooperative Settings'}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Problem Report & Gemma 4 AI Diagnosis Modal for Admin Monitor */}
      {problemModalBooking && (
        <ProblemReportingModal
          isOpen={Boolean(problemModalBooking)}
          onClose={() => setProblemModalBooking(null)}
          booking={problemModalBooking}
          existingReport={
            problemReports.find((r) => r.bookingId === problemModalBooking.id) || null
          }
          userRole="ADMIN"
          token={token}
          onReportCreated={(newRep) => {
            setProblemReports((prev) => [newRep, ...prev.filter((r) => r.id !== newRep.id)]);
            onRefreshAll();
          }}
          onReportUpdated={(updatedRep) => {
            setProblemReports((prev) =>
              prev.map((r) => (r.id === updatedRep.id ? updatedRep : r))
            );
            onRefreshAll();
          }}
          t={t}
          lang={lang}
          isOnline={true}
        />
      )}

      {/* Gemma 4 Feature 1: Worker Digital Passport Modal */}
      {passportWorker && (
        <WorkerDigitalPassportModal
          isOpen={Boolean(passportWorker)}
          onClose={() => setPassportWorker(null)}
          worker={passportWorker}
          workerId={passportWorker.id}
          token={token}
          lang={lang}
        />
      )}

      {/* Gemma 4 Feature 2: Fair Dispute Organizer Modal */}
      {disputeBooking && (
        <FairDisputeOrganizerModal
          isOpen={Boolean(disputeBooking)}
          onClose={() => {
            setDisputeBooking(null);
            setActiveDisputeId(null);
          }}
          bookingId={disputeBooking.id}
          disputeId={activeDisputeId || undefined}
          bookingReference={disputeBooking.bookingReference}
          token={token}
          lang={lang}
        />
      )}

      {/* Gemma 4 Feature 4: Cooperative Intelligence Modal */}
      {showCoopIntelModal && (
        <CooperativeIntelligenceModal
          isOpen={showCoopIntelModal}
          onClose={() => setShowCoopIntelModal(false)}
          token={token}
          lang={lang}
        />
      )}

      {/* Gemma 4 Feature 5: Customer Rating Insights Modal */}
      {ratingInsightsWorker && (
        <CustomerRatingInsightsModal
          isOpen={Boolean(ratingInsightsWorker)}
          onClose={() => setRatingInsightsWorker(null)}
          workerId={ratingInsightsWorker.id}
          workerName={ratingInsightsWorker.name}
          token={token}
          lang={lang}
        />
      )}

      {/* Admin Customer Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-700" />
                <span>Edit Customer Record</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={customerEditForm.name}
                  onChange={(e) => setCustomerEditForm({ ...customerEditForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={customerEditForm.phone}
                  onChange={(e) => setCustomerEditForm({ ...customerEditForm, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Service Address / Locality</label>
                <input
                  type="text"
                  required
                  value={customerEditForm.addressLabel}
                  onChange={(e) => setCustomerEditForm({ ...customerEditForm, addressLabel: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Coop Society Name</label>
                <input
                  type="text"
                  value={customerEditForm.societyName}
                  onChange={(e) => setCustomerEditForm({ ...customerEditForm, societyName: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Save Customer Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Worker Edit Modal */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-teal-700" />
                <span>Edit Worker Profile & Rates</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingWorker(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminUpdateWorker} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={workerEditForm.name}
                  onChange={(e) => setWorkerEditForm({ ...workerEditForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={workerEditForm.phone}
                    onChange={(e) => setWorkerEditForm({ ...workerEditForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Base Rate (₹)</label>
                  <input
                    type="number"
                    min="100"
                    step="25"
                    required
                    value={workerEditForm.baseRateInr}
                    onChange={(e) => setWorkerEditForm({ ...workerEditForm, baseRateInr: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Trade Category</label>
                  <select
                    value={workerEditForm.category}
                    onChange={(e) => setWorkerEditForm({ ...workerEditForm, category: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="Electrician">Electrician</option>
                    <option value="Plumber">Plumber</option>
                    <option value="Carpenter">Carpenter</option>
                    <option value="Painter">Painter</option>
                    <option value="Cleaner">Cleaner</option>
                    <option value="Babysitter">Babysitter</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Service Zone</label>
                  <select
                    value={workerEditForm.serviceZone}
                    onChange={(e) => setWorkerEditForm({ ...workerEditForm, serviceZone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="Central Area">Central Area</option>
                    <option value="North Area">North Area</option>
                    <option value="East Area">East Area</option>
                    <option value="IT Tech Area">IT Tech Area</option>
                    <option value="Sector-1">Sector-1</option>
                    <option value="Sector-2">Sector-2</option>
                    <option value="Sector-3">Sector-3</option>
                    <option value="Sector-5">Sector-5</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="workerAvailable"
                  checked={workerEditForm.isAvailable}
                  onChange={(e) => setWorkerEditForm({ ...workerEditForm, isAvailable: e.target.checked })}
                  className="rounded text-teal-700 focus:ring-teal-700"
                />
                <label htmlFor="workerAvailable" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Available for dispatch right now
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingWorker(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Moderate Rating & Review Modal */}
      {ratingModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                <span>Moderate Rating & Review</span>
              </h3>
              <button
                type="button"
                onClick={() => setRatingModalBooking(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminModerateRating} className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Booking Reference</span>
                <strong className="text-slate-900 dark:text-slate-100 font-mono">
                  {ratingModalBooking.bookingReference} — {ratingModalBooking.workerName} ({ratingModalBooking.workerCategory})
                </strong>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingEditForm({ ...ratingEditForm, rating: star })}
                      className={`text-2xl cursor-pointer ${
                        star <= ratingEditForm.rating ? 'text-amber-500' : 'text-slate-300 dark:text-slate-700'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 ml-2 font-mono">
                    {ratingEditForm.rating} / 5
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Review Feedback
                </label>
                <textarea
                  rows={3}
                  value={ratingEditForm.review}
                  onChange={(e) => setRatingEditForm({ ...ratingEditForm, review: e.target.value })}
                  placeholder="Enter or moderate customer review comments..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRatingModalBooking(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Save Rating
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
