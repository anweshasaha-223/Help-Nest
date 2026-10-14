import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Zap,
  Wrench,
  Hammer,
  Paintbrush,
  Sparkles,
  Baby,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
  Banknote,
  QrCode,
  ShieldCheck,
  Navigation,
  X,
  Scale,
  Users,
  Building,
  Tag,
  AlertCircle,
  HelpCircle,
  Check,
  Plus,
  Trash2,
  Star,
  History,
} from 'lucide-react';
import type {
  UserAccount,
  WorkerProfile,
  SupportedServiceCategory,
  ShiftPreference,
  UrgencyLevel,
  Coordinates,
  GemmaInterpretedRequest,
  MatchedWorkerResult,
  BookingRecord,
  PriceBreakdown,
  PriceRevisionProposal,
  CommunityBulkBooking,
  HouseholdUnit,
  DisputeRecord,
  DisputeCategory,
  DisputeStatus,
  ProblemReport,
} from '../types';
import {
  type LanguageCode,
  translateCategory,
  translateStatus,
  translateSlot,
  translateUrgency,
  translateArea,
} from '../i18n/translations';
import { LiveTrackingMap } from './LiveTrackingMap';
import { ProblemReportingModal } from './ProblemReportingModal';
import { DemoPaymentModal } from './DemoPaymentModal';
import { AiCategoryClassifier } from './AiCategoryClassifier';
import { AiBookingGapFinderModal } from './AiBookingGapFinderModal';
import { AiComplaintToActionModal } from './AiComplaintToActionModal';
import { AiRepairReportModal } from './AiRepairReportModal';
import { HomeMaintenanceMemoryModal } from './HomeMaintenanceMemoryModal';
import { FairDisputeOrganizerModal } from './FairDisputeOrganizerModal';

const SKILL_TRANSLATIONS: Record<string, { bn: string; hi: string }> = {
  // Electrician
  'MCB & Fuse Repair': { bn: 'এমসিবি ও ফিউজ মেরামত', hi: 'एमसीबी और फ्यूज मरम्मत' },
  'Ceiling Fan Installation': { bn: 'সিলিং ফ্যান ইনস্টলেশন ও মেরামত', hi: 'सीलिंग फैन इंस्टॉलेशन' },
  'Switchboard Wiring': { bn: 'সুইচবোর্ড ওয়্যারিং', hi: 'स्विचबोर्ड वायरिंग' },
  'Inverter Setup': { bn: 'ইনভার্টার সেটআপ', hi: 'इनवर्टर सेटअप' },
  'Appliance Earthing': { bn: 'আর্থিং ও শক প্রতিরোধ', hi: 'अर्थिंग और शॉक सुरक्षा' },
  // Plumber
  'Tap & Mixer Leak Repair': { bn: 'কল ও মিক্সার লিক মেরামত', hi: 'नल व मिक्सर रिपेयर' },
  'Pipe Blockage Clearing': { bn: 'পাইপ ব্লকেজ পরিষ্কার', hi: 'पाइप ब्लॉकेज सफाई' },
  'Water Tank Fitting': { bn: 'জলের ট্যাঙ্ক ফিটিং', hi: 'पानी की टंकी फिटिंग' },
  'Bathroom Sanitaryware': { bn: 'বাথরুম স্যানিটারি ফিটিংস', hi: 'बाथरूम सेनेटरी फिटिंग' },
  'Pump Motor Valve': { bn: 'পাম্প মোটর ও ভালভ মেরামত', hi: 'पंप मोटर और वाल्व' },
  // Carpenter
  'Door Lock & Hinge Repair': { bn: 'দরজার লক ও কব্জা মেরামত', hi: 'दरवाजे का ताला व कब्जा' },
  'Window Frame Fitting': { bn: 'জানালার ফ্রেম ফিটিং', hi: 'खिड़की फ्रेम फिटिंग' },
  'Modular Cabinet Fix': { bn: 'মডুলার ক্যাবিনেট মেরামত', hi: 'मॉड्यूलर कैबिनेट रिपेयर' },
  'Furniture Assembly': { bn: 'আসবাবপত্র সংযোজন ও মেরামত', hi: 'फर्नीचर असेंबली' },
  'Termite Wood Patch': { bn: 'উইপোকা প্রতিরোধ ও কাঠের কাজ', hi: 'दीमक रोधी लकड़ी काम' },
  // Painter
  'Interior Wall Painting': { bn: 'ঘরের ভেতরের দেওয়াল রং', hi: 'आंतरिक दीवार पेंटिंग' },
  'Dampness Waterproofing': { bn: 'ড্যাম্প ওয়াটারপ্রুফিং', hi: 'सीलन वॉटरप्रूफिंग' },
  'Wood Polish & Varnish': { bn: 'কাঠের পলিশ ও বার্নিশ', hi: 'लकड़ी पॉलिश व वार्निश' },
  'Putty & Primer Touchup': { bn: 'পুটি ও প্রাইমার টাচআপ', hi: 'पुट्टी और प्राइमर' },
  'Exterior Weather Coat': { bn: 'বাইরের দেওয়ালের ওয়েদার কোট', hi: 'बाहरी दीवार वेदर कोट' },
  // Cleaner
  'Deep Kitchen Cleaning': { bn: 'রান্নাঘর গভীর পরিচ্ছন্নতা', hi: 'किचन डीप क्लीनिंग' },
  'Bathroom Sanitization': { bn: 'বাথরুম জীবাণুমুক্তকরণ ও সাফাই', hi: 'बाथरूम सैनिटाइजेशन' },
  'Sofa & Carpet Vacuum': { bn: 'সোফা ও কার্পেট ভ্যাকুয়াম', hi: 'सोफा व कालीन सफाई' },
  'Water Tank Cleaning': { bn: 'জলের ট্যাঙ্ক পরিষ্কার', hi: 'पानी की टंकी सफाई' },
  'Post-Event Cleanup': { bn: 'অনুষ্ঠান পরবর্তী পরিচ্ছন্নতা', hi: 'इवेंट के बाद की सफाई' },
  // Babysitter
  'Infant Daycare Support': { bn: 'শিশু দিবাযত্ন সহায়তা', hi: 'शिशु डेकेयर सहायता' },
  'Toddler Meal & Play': { bn: 'শিশুর খাবার ও খেলাধুলো', hi: 'बच्चों का भोजन व खेल' },
  'After-School Supervision': { bn: 'স্কুল পরবর্তী দেখাশোনা', hi: 'स्कूल के बाद देखभाल' },
  'First-Aid Certified Care': { bn: 'প্রাথমিক চিকিৎসা সনদপ্রাপ্ত সেবা', hi: 'प्राथमिक उपचार देखभाल' },
  'Evening Family Assist': { bn: 'সান্ধ্যকালীন পারিবারিক সহায়তা', hi: 'शाम की पारिवारिक देखभाल' },
};

function getSkillLabel(skill: string, lang?: LanguageCode): string {
  if (lang === 'bn') return SKILL_TRANSLATIONS[skill]?.bn || skill;
  if (lang === 'hi') return SKILL_TRANSLATIONS[skill]?.hi || skill;
  return skill;
}

function getCategoryTitle(cat: (typeof CATEGORY_METADATA)[0], lang?: LanguageCode): string {
  if (lang === 'bn') return cat.bnLabel;
  if (lang === 'hi') return cat.hiLabel;
  return cat.label;
}

function getCategorySubtitle(cat: (typeof CATEGORY_METADATA)[0], lang?: LanguageCode): string {
  if (lang === 'bn') return `${cat.label} · ${cat.hiLabel}`;
  if (lang === 'hi') return `${cat.label} · ${cat.bnLabel}`;
  return `${cat.bnLabel} · ${cat.hiLabel}`;
}

const CATEGORY_METADATA: Array<{
  id: SupportedServiceCategory;
  label: string;
  bnLabel: string;
  hiLabel: string;
  icon: React.FC<{ className?: string }>;
  skills: string[];
}> = [
  {
    id: 'Electrician',
    label: 'Electrician',
    bnLabel: 'ইলেকট্রিশিয়ান',
    hiLabel: 'इलेक्ट्रीशियन',
    icon: Zap,
    skills: [
      'MCB & Fuse Repair',
      'Ceiling Fan Installation',
      'Switchboard Wiring',
      'Inverter Setup',
      'Appliance Earthing',
    ],
  },
  {
    id: 'Plumber',
    label: 'Plumber',
    bnLabel: 'প্লাম্বার',
    hiLabel: 'प्लंबर',
    icon: Wrench,
    skills: [
      'Tap & Mixer Leak Repair',
      'Pipe Blockage Clearing',
      'Water Tank Fitting',
      'Bathroom Sanitaryware',
      'Pump Motor Valve',
    ],
  },
  {
    id: 'Carpenter',
    label: 'Carpenter',
    bnLabel: 'ছুতোর / কাঠমিস্ত্রি',
    hiLabel: 'बढ़ई (कारपेंटर)',
    icon: Hammer,
    skills: [
      'Door Lock & Hinge Repair',
      'Window Frame Fitting',
      'Modular Cabinet Fix',
      'Furniture Assembly',
      'Termite Wood Patch',
    ],
  },
  {
    id: 'Painter',
    label: 'Painter',
    bnLabel: 'রঙমিস্ত্রি',
    hiLabel: 'पेंटर',
    icon: Paintbrush,
    skills: [
      'Interior Wall Painting',
      'Dampness Waterproofing',
      'Wood Polish & Varnish',
      'Putty & Primer Touchup',
      'Exterior Weather Coat',
    ],
  },
  {
    id: 'Cleaner',
    label: 'Cleaner',
    bnLabel: 'পরিচ্ছন্নতা কর্মী',
    hiLabel: 'सफाई कर्मी',
    icon: Sparkles,
    skills: [
      'Deep Kitchen Cleaning',
      'Bathroom Sanitization',
      'Sofa & Carpet Vacuum',
      'Water Tank Cleaning',
      'Post-Event Cleanup',
    ],
  },
  {
    id: 'Babysitter',
    label: 'Babysitter',
    bnLabel: 'শিশু পরিচর্যা',
    hiLabel: 'बेबीसिटर',
    icon: Baby,
    skills: [
      'Infant Daycare Support',
      'Toddler Meal & Play',
      'After-School Supervision',
      'First-Aid Certified Care',
      'Evening Family Assist',
    ],
  },
];

interface CustomerPortalProps {
  user: UserAccount;
  token: string;
  activeSubTab: 'request' | 'bookings' | 'bulk';
  setActiveSubTab: (tab: 'request' | 'bookings' | 'bulk') => void;
  bookings: BookingRecord[];
  onRefreshBookings: () => Promise<void>;
  onBookingDispatched?: (booking: BookingRecord, assignedWorker?: WorkerProfile) => void;
  t: Record<string, string>;
  lang?: LanguageCode;
  isOnline: boolean;
  liveSyncNotice?: string | null;
  onDismissSyncNotice?: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  user,
  token,
  activeSubTab,
  setActiveSubTab,
  bookings,
  onRefreshBookings,
  onBookingDispatched,
  t,
  lang = 'en',
  isOnline,
  liveSyncNotice,
  onDismissSyncNotice,
}) => {
  // Step 1: Category Selection
  const [selectedCategory, setSelectedCategory] = useState<SupportedServiceCategory | null>(null);

  // Step 2: Requirements
  const [problemDescription, setProblemDescription] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [preferredDate, setPreferredDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<ShiftPreference>(
    'Afternoon (12:00 - 16:00)'
  );
  const [urgency, setUrgency] = useState<UrgencyLevel>('STANDARD');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [problemMediaUrls, setProblemMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState<string>('');
  const [customerCoords, setCustomerCoords] = useState<Coordinates>(
    user.location || {
      lat: 22.5792,
      lng: 88.4175,
      addressLabel: '',
    }
  );
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  // Step 3: Gemma 4 Interpretation
  const [interpreting, setInterpreting] = useState(false);
  const [gemmaResult, setGemmaResult] = useState<GemmaInterpretedRequest | null>(null);
  const [gemmaError, setGemmaError] = useState<string | null>(null);

  // Transparent Price Estimator: Materials/Spares input
  const [estimatedMaterialsInr, setEstimatedMaterialsInr] = useState<number>(0);
  const [materialsDescription, setMaterialsDescription] = useState<string>('');
  const [reviewingRevisionId, setReviewingRevisionId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  // Dispute Resolution state
  const [disputeModalBooking, setDisputeModalBooking] = useState<BookingRecord | null>(null);
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategory>('PRICING_DISAGREEMENT');
  const [disputeDescription, setDisputeDescription] = useState<string>('');
  const [disputeEvidence, setDisputeEvidence] = useState<string>('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [disputeFeedback, setDisputeFeedback] = useState<string | null>(null);
  const [existingDisputes, setExistingDisputes] = useState<DisputeRecord[]>([]);
  const [viewingDispute, setViewingDispute] = useState<DisputeRecord | null>(null);

  // Community Bulk Booking state
  const [bulkSocietyName, setBulkSocietyName] = useState(user.societyName || 'Labony Estate Cooperative Society');
  const [bulkCategory, setBulkCategory] = useState<SupportedServiceCategory>('Plumber');
  const [bulkDate, setBulkDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [bulkTimeSlot, setBulkTimeSlot] = useState<ShiftPreference>('Morning (08:00 - 12:00)');
  const [bulkHouseholdCount, setBulkHouseholdCount] = useState<number>(5);
  const [bulkHouseholds, setBulkHouseholds] = useState<Array<{ flatNumber: string; residentName: string; residentPhone: string; notes?: string }>>([
    { flatNumber: 'Flat 101, Block A', residentName: 'Debabrata Roy', residentPhone: '+91 98301 22331', notes: 'Kitchen sink pipe inspection' },
    { flatNumber: 'Flat 102, Block A', residentName: 'Mousumi Paul', residentPhone: '+91 98302 44552', notes: 'Bathroom tap leak' },
    { flatNumber: 'Flat 201, Block B', residentName: 'Sanjay Gupta', residentPhone: '+91 98303 66773', notes: 'Water purifier valve fitting' },
    { flatNumber: 'Flat 202, Block B', residentName: 'Kakali Banerjee', residentPhone: '+91 98304 88994', notes: 'Overhead tank check' },
    { flatNumber: 'Flat 301, Block C', residentName: 'Alok Mukherjee', residentPhone: '+91 98305 00115', notes: 'Washbasin drainage blockage' },
  ]);
  const [bulkBookingsList, setBulkBookingsList] = useState<CommunityBulkBooking[]>([]);
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  // Step 4: Worker Matching & Selection
  const [matching, setMatching] = useState(false);
  const [matchedCandidates, setMatchedCandidates] = useState<MatchedWorkerResult[]>([]);
  const [matchChecked, setMatchChecked] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [workerToConfirm, setWorkerToConfirm] = useState<MatchedWorkerResult | null>(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState<string | null>(null);
  const [bookingModalError, setBookingModalError] = useState<string | null>(null);

  // Payment & Settlement Modal State
  const [settlingBookingId, setSettlingBookingId] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'UPI' | 'CASH'>('UPI');
  const [upiIdInput, setUpiIdInput] = useState('');
  const [activePaymentOrder, setActivePaymentOrder] = useState<{
    booking: BookingRecord;
    orderId: string;
    amountInr: number;
    workerShareInr: number;
    welfareShareInr: number;
    mode: string;
  } | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [expandedMapBookingId, setExpandedMapBookingId] = useState<string | null>(null);
  const [paymentModalBooking, setPaymentModalBooking] = useState<BookingRecord | null>(null);
  // Gemma 4 Modal states
  const [selectedComplaintBooking, setSelectedComplaintBooking] = useState<BookingRecord | null>(null);
  const [selectedReportBooking, setSelectedReportBooking] = useState<BookingRecord | null>(null);
  const [isGapFinderOpen, setIsGapFinderOpen] = useState(false);
  const [confirmedGapAnswers, setConfirmedGapAnswers] = useState<Record<string, string>>({});
  // Gemma 4 Feature 3: Home Maintenance Memory & Feature 2: Fair Dispute Organizer
  const [showHomeMemoryModal, setShowHomeMemoryModal] = useState(false);
  const [disputeOrganizerBooking, setDisputeOrganizerBooking] = useState<BookingRecord | null>(null);

  // Worker Rating & Review state (Requirement 2)
  const [ratingInputMap, setRatingInputMap] = useState<Record<string, number>>({});
  const [reviewInputMap, setReviewInputMap] = useState<Record<string, string>>({});
  const [submittingRatingId, setSubmittingRatingId] = useState<string | null>(null);
  const [ratingSuccessMap, setRatingSuccessMap] = useState<Record<string, string>>({});
  const [ratingErrorMap, setRatingErrorMap] = useState<Record<string, string>>({});

  const handleRateWorker = async (bookingId: string) => {
    const stars = ratingInputMap[bookingId] || 5;
    const review = reviewInputMap[bookingId] || '';
    setSubmittingRatingId(bookingId);
    setRatingErrorMap((prev) => ({ ...prev, [bookingId]: '' }));

    try {
      const res = await fetch(`/api/bookings/${bookingId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: stars, review }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRatingErrorMap((prev) => ({
          ...prev,
          [bookingId]: data.error || 'Failed to submit rating.',
        }));
      } else {
        setRatingSuccessMap((prev) => ({
          ...prev,
          [bookingId]: data.message || 'Rating submitted successfully!',
        }));
        await onRefreshBookings();
      }
    } catch (err: any) {
      setRatingErrorMap((prev) => ({
        ...prev,
        [bookingId]: err?.message || 'Error submitting rating.',
      }));
    } finally {
      setSubmittingRatingId(null);
    }
  };

  const handleUpdatePaymentMethod = async (bookingId: string, method: 'CASH' | 'UPI') => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payment-method`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentMethod: method }),
      });
      if (res.ok) {
        await onRefreshBookings();
      }
    } catch {
      // non-blocking
    }
  };

  // Problem Reporting & Gemma 4 AI Analysis Modal state
  const [problemModalBooking, setProblemModalBooking] = useState<BookingRecord | null>(null);
  const [problemReportsList, setProblemReportsList] = useState<ProblemReport[]>([]);

  const fetchProblemReports = async () => {
    try {
      const res = await fetch('/api/problem-reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProblemReportsList(data.reports || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchCommunityBulk = async () => {
    try {
      const res = await fetch('/api/community-bulk', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBulkBookingsList(data.bulkBookings || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchDisputes = async () => {
    try {
      const res = await fetch('/api/disputes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setExistingDisputes(data.disputes || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCommunityBulk();
    fetchDisputes();
    fetchProblemReports();
  }, [token]);

  const handleSelectCategory = (cat: SupportedServiceCategory) => {
    setSelectedCategory(cat);
    setSelectedSkills([]);
    setMatchChecked(false);
    setMatchedCandidates([]);
    setMatchError(null);
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const [detectingGps, setDetectingGps] = useState(false);

  const handleDetectCustomerGps = () => {
    if (!navigator.geolocation) {
      setGpsNotice(
        lang === 'bn'
          ? 'ব্রাউজারে অবস্থান শনাক্তকরণ সমর্থিত নয়। সল্টলেক সমন্বয় ব্যবহার করা হচ্ছে।'
          : lang === 'hi'
          ? 'ब्राउज़र में स्थान पहचान समर्थित नहीं है। साल्ट लेक निर्देशांक का उपयोग किया जा रहा है।'
          : 'Browser Geolocation is not supported. Using Salt Lake coordinates.'
      );
      return;
    }

    setDetectingGps(true);
    setGpsNotice(
      lang === 'bn'
        ? 'আপনার বর্তমান অবস্থান অনুসন্ধান করা হচ্ছে...'
        : lang === 'hi'
        ? 'वर्तमान स्थान का पता लगाया जा रहा है...'
        : 'Detecting your current location...'
    );

    const onCoordsResolved = async (pos: GeolocationPosition) => {
      const lat = Math.round(pos.coords.latitude * 10000) / 10000;
      const lng = Math.round(pos.coords.longitude * 10000) / 10000;

      let resolvedAddress = `Current Location (${lat}, ${lng})`;
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 2500);
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
          { signal: ctrl.signal }
        );
        clearTimeout(tid);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData?.display_name) {
            const parts = geoData.display_name.split(',');
            resolvedAddress = parts.slice(0, 3).join(',').trim();
          }
        }
      } catch {
        // Fallback default format
      }

      setCustomerCoords({
        lat,
        lng,
        addressLabel: resolvedAddress,
      });
      setDetectingGps(false);
      setGpsNotice(
        lang === 'bn'
          ? `বর্তমান অবস্থান সফলভাবে শনাক্ত হয়েছে: ${resolvedAddress} (${lat}, ${lng})`
          : lang === 'hi'
          ? `वर्तमान स्थान सफलतापूर्वक मिल गया: ${resolvedAddress} (${lat}, ${lng})`
          : `Current location updated: ${resolvedAddress} (${lat}, ${lng})`
      );
    };

    navigator.geolocation.getCurrentPosition(
      onCoordsResolved,
      (highAccErr) => {
        // Fallback without high accuracy
        navigator.geolocation.getCurrentPosition(
          onCoordsResolved,
          (lowAccErr) => {
            setDetectingGps(false);
            const defaultSaltLake = {
              lat: 22.5805,
              lng: 88.4215,
              addressLabel: 'Central Area, Kolkata',
            };
            setCustomerCoords(defaultSaltLake);
            setGpsNotice(
              lang === 'bn'
                ? `লাইভ জিপিএস পাওয়া যায়নি (${lowAccErr.message || highAccErr.message})। ডিফল্ট সেন্ট্রাল এলাকা নির্ধারণ করা হয়েছে।`
                : lang === 'hi'
                ? `लाइव जीपीएस नहीं मिल सका (${lowAccErr.message || highAccErr.message})। सेंट्रल क्षेत्र निर्धारित किया गया।`
                : `Could not access live GPS (${lowAccErr.message || highAccErr.message}). Defaulted to Central Area, Kolkata.`
            );
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
    );
  };

  // Module 3: Understand the Request with Gemma 4
  const handleAnalyzeWithGemma = async () => {
    if (!problemDescription.trim()) {
      setGemmaError('Please enter a problem description first.');
      return;
    }
    if (!isOnline) {
      setGemmaError('Cannot reach Gemma 4 AI while in Offline Mode.');
      return;
    }
    setInterpreting(true);
    setGemmaError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch('/api/ai/interpret-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: problemDescription,
          selectedCategory,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) {
        setGemmaError(data.error || 'Failed to analyze request.');
      } else {
        const result = data as GemmaInterpretedRequest;
        setGemmaResult(result);

        const resolvedCat = result.serviceCategory || selectedCategory;
        const resolvedSkills =
          result.extractedSkills && result.extractedSkills.length > 0
            ? result.extractedSkills
            : selectedSkills;
        const resolvedSlot = result.preferredTimeSlot || preferredTimeSlot;

        if (result.serviceCategory) {
          setSelectedCategory(result.serviceCategory);
        }
        if (result.extractedSkills && result.extractedSkills.length > 0) {
          setSelectedSkills(result.extractedSkills);
        }
        if (result.urgency) {
          setUrgency(result.urgency);
        }
        if (result.preferredTimeSlot) {
          setPreferredTimeSlot(result.preferredTimeSlot);
        }

        // Automatically compute matching workers for the analyzed category & skills
        if (resolvedCat) {
          setMatching(true);
          setMatchError(null);
          try {
            const matchRes = await fetch('/api/ai/match-worker', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                serviceCategory: resolvedCat,
                requiredSkills: resolvedSkills,
                preferredTimeSlot: resolvedSlot,
                customerLocation: customerCoords,
                problemDescription,
              }),
            });
            const matchData = await matchRes.json();
            if (matchRes.ok) {
              setMatchedCandidates(matchData.candidates || []);
              setMatchChecked(true);
            }
          } catch {
            // Ignore secondary match error
          } finally {
            setMatching(false);
          }
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setGemmaError(
        err?.name === 'AbortError'
          ? 'Analysis timed out. Please try again.'
          : err?.message || 'Network error calling Gemma 4 endpoint.'
      );
    } finally {
      setInterpreting(false);
    }
  };

  // Auto-fetch eligible workers whenever service category or location changes so registered workers appear immediately
  useEffect(() => {
    if (!selectedCategory || !token) return;
    let cancelled = false;

    const fetchEligible = async () => {
      try {
        const res = await fetch('/api/ai/match-worker', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            serviceCategory: selectedCategory,
            requiredSkills: selectedSkills,
            preferredTimeSlot,
            customerLocation: customerCoords,
            problemDescription: problemDescription.trim() || `General ${selectedCategory} service request`,
          }),
        });
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data.candidates)) {
          setMatchedCandidates(data.candidates);
          setMatchChecked(true);
        }
      } catch {
        // ignore background match error
      }
    };

    fetchEligible();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, selectedSkills, preferredTimeSlot, customerCoords, token]);

  // Module 4: Retrieve Eligible Workers & Run Fair Dispatch Algorithm
  const handleFindMatchingWorkers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) {
      setMatchError('Please select a service category in Step 1 first.');
      return;
    }
    const resolvedDesc =
      problemDescription.trim() ||
      `General ${selectedCategory} service request (${
        selectedSkills.length > 0 ? selectedSkills.join(', ') : 'Standard maintenance'
      })`;
    setMatching(true);
    setMatchError(null);
    setMatchChecked(false);

    try {
      const res = await fetch('/api/ai/match-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          serviceCategory: selectedCategory,
          requiredSkills: selectedSkills,
          preferredTimeSlot,
          customerLocation: customerCoords,
          problemDescription: resolvedDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMatchError(data.error || 'Could not compute worker matches.');
      } else {
        setMatchedCandidates(data.candidates || []);
        setMatchChecked(true);
      }
    } catch (err: any) {
      setMatchError(err?.message || 'Network error while matching workers.');
    } finally {
      setMatching(false);
    }
  };

  // Module 5: Submit Validated Booking
  const handleConfirmBooking = async () => {
    if (!workerToConfirm || !selectedCategory) return;
    if (!isOnline) {
      setBookingModalError(
        'Offline Mode Active: Booking cannot be submitted while offline. Please reconnect first.'
      );
      return;
    }

    const finalDescription =
      problemDescription.trim() ||
      `${selectedCategory} service (${
        selectedSkills.length > 0 ? selectedSkills.join(', ') : 'Standard household service'
      })`;

    setSubmittingBooking(true);
    setBookingModalError(null);
    setMatchError(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workerId: workerToConfirm.worker.id,
          serviceCategory: selectedCategory,
          requiredSkills: selectedSkills,
          problemDescription: finalDescription,
          preferredDate,
          preferredTimeSlot,
          urgency,
          additionalInstructions,
          customerLocation: customerCoords,
          materialsInr: estimatedMaterialsInr,
          materialsDescription: materialsDescription.trim(),
          problemMediaUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || 'Failed to create booking.';
        setBookingModalError(errMsg);
        setMatchError(errMsg);
      } else {
        const createdBooking = data.booking as BookingRecord;
        const assignedWorker =
          (data.assignedWorkerProfile as WorkerProfile | undefined) || workerToConfirm.worker;
        setBookingFeedback(data.message);
        setBookingModalError(null);
        setWorkerToConfirm(null);
        setEstimatedMaterialsInr(0);
        setMaterialsDescription('');
        setProblemMediaUrls([]);
        setMediaInput('');
        await onRefreshBookings();
        setActiveSubTab('bookings');
        if (onBookingDispatched && createdBooking) {
          onBookingDispatched(createdBooking, assignedWorker);
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Error submitting booking.';
      setBookingModalError(errMsg);
      setMatchError(errMsg);
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Direct Book Now handler from Step 2
  const handleDirectBookNow = async () => {
    if (!selectedCategory) {
      setMatchError('Please select a service category in Step 1 first.');
      return;
    }
    if (!isOnline) {
      setMatchError('Offline Mode Active: Booking cannot be submitted while offline.');
      return;
    }

    const finalDescription =
      problemDescription.trim() ||
      `${selectedCategory} service (${
        selectedSkills.length > 0 ? selectedSkills.join(', ') : 'Standard household service'
      })`;

    setSubmittingBooking(true);
    setMatchError(null);
    try {
      // 1. Get best eligible worker
      const matchRes = await fetch('/api/ai/match-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          serviceCategory: selectedCategory,
          requiredSkills: selectedSkills,
          preferredTimeSlot,
          customerLocation: customerCoords,
          problemDescription: finalDescription,
        }),
      });
      const matchData = await matchRes.json();
      const topCandidate = matchData?.candidates?.[0]?.worker;
      const targetWorkerId = matchData?.matchedWorkerId || topCandidate?.id;

      if (!targetWorkerId) {
        setMatchError('No eligible worker found for this trade category.');
        setSubmittingBooking(false);
        return;
      }

      // 2. Submit booking directly
      const bkgRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workerId: targetWorkerId,
          serviceCategory: selectedCategory,
          requiredSkills: selectedSkills,
          problemDescription: finalDescription,
          preferredDate,
          preferredTimeSlot,
          urgency,
          additionalInstructions,
          customerLocation: customerCoords,
          materialsInr: estimatedMaterialsInr,
          materialsDescription: materialsDescription.trim(),
          problemMediaUrls,
        }),
      });
      const bkgData = await bkgRes.json();
      if (!bkgRes.ok) {
        setMatchError(bkgData.error || 'Failed to submit booking.');
      } else {
        const createdBooking = bkgData.booking as BookingRecord;
        const assignedWorker = bkgData.assignedWorkerProfile || topCandidate;
        setBookingFeedback(bkgData.message || `Booking ${createdBooking.bookingReference} dispatched! Status: Booking Pending.`);
        setEstimatedMaterialsInr(0);
        setMaterialsDescription('');
        setProblemMediaUrls([]);
        setMediaInput('');
        await onRefreshBookings();
        setActiveSubTab('bookings');
        if (onBookingDispatched && createdBooking) {
          onBookingDispatched(createdBooking, assignedWorker);
        }
      }
    } catch (err: any) {
      setMatchError(err?.message || 'Error submitting booking.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Review Worker Price Revision (Approve or Reject)
  const handleReviewPriceRevision = async (bookingId: string, decision: 'APPROVED' | 'REJECTED') => {
    setReviewingRevisionId(bookingId);
    setReviewMessage(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/review-price`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewMessage(data.error || 'Failed to review price revision.');
      } else {
        setReviewMessage(data.message);
        await onRefreshBookings();
      }
    } catch {
      setReviewMessage('Network error updating price decision.');
    } finally {
      setReviewingRevisionId(null);
    }
  };

  // Submit Complaint / Dispute
  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModalBooking) return;
    setSubmittingDispute(true);
    setDisputeFeedback(null);
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: disputeModalBooking.id,
          category: disputeCategory,
          description: disputeDescription,
          evidenceNote: disputeEvidence,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDisputeFeedback(data.error || 'Failed to submit dispute.');
      } else {
        setDisputeFeedback(data.message);
        setDisputeModalBooking(null);
        setDisputeDescription('');
        setDisputeEvidence('');
        await onRefreshBookings();
        await fetchDisputes();
      }
    } catch {
      setDisputeFeedback('Network error submitting dispute.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  // Create Community Bulk Booking
  const handleCreateBulkBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBulk(true);
    setBulkFeedback(null);
    try {
      const res = await fetch('/api/community-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          societyName: bulkSocietyName,
          serviceCategory: bulkCategory,
          preferredDate: bulkDate,
          preferredTimeSlot: bulkTimeSlot,
          householdCount: bulkHouseholdCount,
          households: bulkHouseholds.slice(0, bulkHouseholdCount),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkFeedback(data.error || 'Failed to create bulk booking.');
      } else {
        setBulkFeedback(data.message);
        await fetchCommunityBulk();
      }
    } catch {
      setBulkFeedback('Network error submitting bulk booking.');
    } finally {
      setSubmittingBulk(false);
    }
  };

  // Quick Demo sample loader
  const handleLoadSampleBulkBooking = () => {
    setBulkSocietyName('Labony Estate Cooperative Society');
    setBulkCategory('Plumber');
    setBulkHouseholdCount(5);
    setBulkHouseholds([
      { flatNumber: 'Flat 101, Block A', residentName: 'Debabrata Roy', residentPhone: '+91 98301 22331', notes: 'Kitchen sink pipe inspection' },
      { flatNumber: 'Flat 102, Block A', residentName: 'Mousumi Paul', residentPhone: '+91 98302 44552', notes: 'Bathroom tap leak' },
      { flatNumber: 'Flat 201, Block B', residentName: 'Sanjay Gupta', residentPhone: '+91 98303 66773', notes: 'Water purifier valve fitting' },
      { flatNumber: 'Flat 202, Block B', residentName: 'Kakali Banerjee', residentPhone: '+91 98304 88994', notes: 'Overhead tank check' },
      { flatNumber: 'Flat 301, Block C', residentName: 'Alok Mukherjee', residentPhone: '+91 98305 00115', notes: 'Washbasin drainage blockage' },
    ]);
    setBulkFeedback('Sample community bulk booking details for Labony Estate (5 flats) loaded.');
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (res.ok) {
        await onRefreshBookings();
      }
    } catch {
      // Ignore
    }
  };

  // Module 8: Initiate Payment Order (with UPI or Cash choice)
  const handleInitiatePayment = async (
    booking: BookingRecord,
    preferredMethod: 'UPI' | 'CASH' = 'UPI'
  ) => {
    setSelectedPaymentMethod(preferredMethod);
    setSettlingBookingId(booking.id);
    setPaymentMessage(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/create-payment-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setPaymentMessage(data.error || 'Could not create payment order.');
      } else {
        setActivePaymentOrder({
          booking,
          orderId: data.orderId,
          amountInr: data.amountInr,
          workerShareInr: data.workerShareInr,
          welfareShareInr: data.welfareShareInr,
          mode: data.mode,
        });
      }
    } catch (err: any) {
      setPaymentMessage(err?.message || 'Error initiating payment.');
    } finally {
      setSettlingBookingId(null);
    }
  };

  // Module 8: Server-Side Payment Verification & 90:10 Settlement (UPI or Cash)
  const handleVerifySandboxPayment = async () => {
    if (!activePaymentOrder) return;
    setSettlingBookingId(activePaymentOrder.booking.id);
    try {
      const res = await fetch(`/api/bookings/${activePaymentOrder.booking.id}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: activePaymentOrder.orderId,
          paymentMethod: selectedPaymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaymentMessage(data.error || 'Payment verification failed.');
      } else {
        setPaymentMessage(data.message);
        setActivePaymentOrder(null);
        await onRefreshBookings();
      }
    } catch (err: any) {
      setPaymentMessage(err?.message || 'Payment verification network error.');
    } finally {
      setSettlingBookingId(null);
    }
  };

  // Module 9: Download PDF Tax Invoice
  const handleDownloadInvoice = async (booking: BookingRecord) => {
    try {
      const res = await fetch(`/api/bookings/${booking.id}/invoice`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HelpNest_Invoice_${booking.bookingReference}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    }
  };

  const activeCategoryMeta = CATEGORY_METADATA.find((c) => c.id === selectedCategory);

  return (
    <div className="@container space-y-6">
      {/* Ultra-Minimalist Sub-Navigation Bar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-1.5 sm:p-2 shadow-2xs">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg sm:rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('request')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-md sm:rounded-lg text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
              activeSubTab === 'request'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.navCustomerPortal}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('bulk')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-md sm:rounded-lg text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap flex items-center justify-center gap-1.5 ${
              activeSubTab === 'bulk'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Community Bulk Booking</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('bookings')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-md sm:rounded-lg text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
              activeSubTab === 'bookings'
                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.navMyBookings} ({bookings.length})
          </button>
        </div>
      </div>

      {bookingFeedback && (
        <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-sm text-teal-900 dark:text-teal-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
            <span>{bookingFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setBookingFeedback(null)}
            className="text-xs font-medium text-teal-800 dark:text-teal-300 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {liveSyncNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>{liveSyncNotice}</span>
          </div>
          {onDismissSyncNotice && (
            <button
              type="button"
              onClick={onDismissSyncNotice}
              className="text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {activeSubTab === 'request' ? (
        <div className="space-y-8">
          {/* STEP 1: SELECT SERVICE CATEGORY */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.step1Title}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t.categorySubtitle}
              </span>
            </div>

            {/* GEMMA 4 FEATURE 2: AI SERVICE CATEGORY AUTO-CLASSIFIER */}
            <AiCategoryClassifier
              problemDescription={problemDescription}
              currentSelectedCategory={selectedCategory}
              onSelectCategory={(cat, suggestedSkill) => {
                handleSelectCategory(cat);
                if (suggestedSkill) {
                  setSelectedSkills([suggestedSkill]);
                }
              }}
              token={token}
              lang={lang}
              t={t}
            />

            <div className="grid grid-cols-2 @sm:grid-cols-3 @3xl:grid-cols-6 gap-3.5">
              {CATEGORY_METADATA.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-700 dark:border-teal-500 bg-teal-50/60 dark:bg-teal-950/40 ring-2 ring-teal-700/20 dark:ring-teal-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-850'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                        isSelected ? 'bg-teal-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{getCategoryTitle(cat, lang)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {getCategorySubtitle(cat, lang)}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* STEP 2 & 3: ENTER REQUIREMENTS & GEMMA 4 INTERPRETATION */}
          {!selectedCategory ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-600 dark:text-slate-400 shadow-2xs">
              {t.selectCategoryPrompt}
            </div>
          ) : (
            <form
              onSubmit={handleFindMatchingWorkers}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.step2Title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t.selectedCategoryLabel}: <strong className="text-slate-800 dark:text-slate-200">{activeCategoryMeta ? getCategoryTitle(activeCategoryMeta, lang) : selectedCategory}</strong>
                  </p>
                </div>
              </div>

              {/* Natural language request + Gemma 4 Analyzer */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {t.naturalLanguageLabel} *
                  </label>
                  <button
                    type="button"
                    onClick={handleAnalyzeWithGemma}
                    disabled={interpreting || !problemDescription.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{interpreting ? t.analyzingBtn : t.analyzeWithGemmaBtn}</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  required
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder={t.describeRequirementPlaceholder}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-700 dark:focus:border-teal-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                />

                {/* Defect Photo & Video Attachments (Optional) */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {lang === 'bn' ? 'সমস্যার ছবি বা ভিডিও যুক্ত করুন (ঐচ্ছিক)' : lang === 'hi' ? 'समस्या की फोटो या वीडियो जोड़ें (वैकल्पिक)' : 'Attach Defect Photos or Videos (Optional)'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {problemMediaUrls.length} {lang === 'bn' ? 'সংযুক্ত' : lang === 'hi' ? 'संलग्न' : 'attached'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={mediaInput}
                      onChange={(e) => setMediaInput(e.target.value)}
                      placeholder="https://example.com/defect-photo.jpg or video link"
                      className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (mediaInput.trim()) {
                          setProblemMediaUrls((prev) => [...prev, mediaInput.trim()]);
                          setMediaInput('');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      {lang === 'bn' ? '+ যোগ করুন' : lang === 'hi' ? '+ जोड़ें' : '+ Add Link'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Quick Attach:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const url = 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800';
                        if (!problemMediaUrls.includes(url)) setProblemMediaUrls((prev) => [...prev, url]);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-700 dark:text-slate-300 cursor-pointer text-[10px]"
                    >
                      + Pipe Leak Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800';
                        if (!problemMediaUrls.includes(url)) setProblemMediaUrls((prev) => [...prev, url]);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-700 dark:text-slate-300 cursor-pointer text-[10px]"
                    >
                      + Wiring Defect Photo
                    </button>
                  </div>
                  {problemMediaUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {problemMediaUrls.map((url, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-[11px] text-teal-800 dark:text-teal-200"
                        >
                          <span className="truncate max-w-[150px]">Attachment {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => setProblemMediaUrls((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-800 font-bold ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {gemmaError && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{gemmaError}</span>
                  </div>
                )}

                {gemmaResult && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {t.step3Title} — {lang === 'bn' ? 'মডেল' : lang === 'hi' ? 'मॉडल' : 'Model'}: <span className="font-mono text-teal-700 dark:text-teal-400 font-bold">{gemmaResult.modelUsed}</span>
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t.languageDetectedLabel || (lang === 'bn' ? 'শনাক্ত ভাষা' : lang === 'hi' ? 'पहचानी गई भाषा' : 'Language')}: {gemmaResult.detectedLanguage}
                      </span>
                    </div>

                    {/* Urgent Safety Guidance Box (if hazard detected) */}
                    {gemmaResult.safetyGuidance && gemmaResult.safetyGuidance.length > 0 && (
                      <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        gemmaResult.isHazardAlert
                          ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                      }`}>
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className={`w-4 h-4 ${gemmaResult.isHazardAlert ? 'text-red-600' : 'text-amber-600'}`} />
                          <span>
                            {gemmaResult.isHazardAlert
                              ? (lang === 'bn' ? 'জরুরি নিরাপত্তা সতর্কতা ও নির্দেশিকা' : lang === 'hi' ? 'आपातकालीन सुरक्षा मार्गदर्शन' : 'Urgent Safety Guidance (Hazard Advisory)')
                              : (lang === 'bn' ? 'প্রাথমিক নিরাপত্তা সতর্কতা' : lang === 'hi' ? 'सुरक्षा मार्गदर्शन' : 'Immediate Safety Guidance')}
                          </span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                          {gemmaResult.safetyGuidance.map((guide, idx) => (
                            <li key={idx}>{guide}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      <strong>{t.taskSummaryLabel || (lang === 'bn' ? 'সারাংশ' : lang === 'hi' ? 'सारांश' : 'Summary')}:</strong> {gemmaResult.taskSummary}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <span>
                        {t.selectedCategoryLabel}: <strong className="text-slate-800 dark:text-slate-200">{translateCategory(gemmaResult.serviceCategory, lang) || (lang === 'bn' ? 'নিশ্চিতকরণ আবশ্যক' : lang === 'hi' ? 'पुष्टि आवश्यक' : 'Needs confirmation')}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        {t.requiredSkillsLabel}:{' '}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {gemmaResult.extractedSkills.length > 0
                            ? gemmaResult.extractedSkills.map((s) => getSkillLabel(s, lang)).join(', ')
                            : (lang === 'bn' ? 'সাধারণ কাজের দক্ষতা' : lang === 'hi' ? 'सामान्य कार्य कौशल' : 'General trade skill')}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        {t.urgencyLabel}: <strong className="text-slate-800 dark:text-slate-200">{translateUrgency(gemmaResult.urgency, lang)}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        {t.preferredTimeSlotLabel}:{' '}
                        <strong className="text-slate-800 dark:text-slate-200">{translateSlot(gemmaResult.preferredTimeSlot, lang) || (lang === 'bn' ? 'উল্লেখ্য নেই' : lang === 'hi' ? 'उल्लिखित नहीं' : 'Not stated')}</strong>
                      </span>
                    </div>

                    {/* Preliminary Inspection Advisory */}
                    <div className="p-2.5 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 text-[11px] text-teal-900 dark:text-teal-200 flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                      <span>
                        {gemmaResult.preliminaryNotice ||
                          'Notice: AI suggestions are preliminary advisory assistance. An authorized cooperative professional will inspect the problem on-site before initiating work.'}
                      </span>
                    </div>

                    {gemmaResult.suggestedDetailsToProvide && gemmaResult.suggestedDetailsToProvide.length > 0 && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-750 space-y-1">
                        <strong className="text-slate-800 dark:text-slate-200">
                          {lang === 'bn' ? 'কাজে সহায়ক অতিরিক্ত তথ্য যা আপনি উল্লেখ করতে পারেন:' : lang === 'hi' ? 'मददगार विवरण जो आप जोड़ सकते हैं:' : 'Helpful details to provide before visit:'}
                        </strong>
                        <ul className="list-disc list-inside space-y-0.5">
                          {gemmaResult.suggestedDetailsToProvide.map((det, idx) => (
                            <li key={idx}>{det}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {gemmaResult.missingFieldsToConfirm.length > 0 && (
                      <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
                        {lang === 'bn' ? 'বুকিং করার আগে নিচের তথ্যগুলো নিশ্চিত করুন: ' : lang === 'hi' ? 'बुकिंग से पहले कृपया नीचे दिए गए विवरण की जांच करें: ' : 'Please confirm or complete fields before booking: '}
                        <strong>{gemmaResult.missingFieldsToConfirm.join(', ')}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Trade skills selection */}
              {activeCategoryMeta && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {t.requiredSkillsLabel} ({getCategoryTitle(activeCategoryMeta, lang)})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activeCategoryMeta.skills.map((skill) => {
                      const active = selectedSkills.includes(skill);
                      const displaySkill = getSkillLabel(skill, lang);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            active
                              ? 'bg-slate-900 dark:bg-teal-700 text-white border-slate-900 dark:border-teal-700 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                          }`}
                        >
                          {active ? `✓ ${displaySkill}` : displaySkill}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Date, Time Slot, Urgency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                    <Calendar className="inline w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" />
                    {t.preferredDateLabel} *
                  </label>
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                    <Clock className="inline w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" />
                    {t.preferredTimeSlotLabel} *
                  </label>
                  <select
                    value={preferredTimeSlot}
                    onChange={(e) => setPreferredTimeSlot(e.target.value as ShiftPreference)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:border-teal-700"
                  >
                    <option value="Morning (08:00 - 12:00)">{t.slotMorning}</option>
                    <option value="Afternoon (12:00 - 16:00)">{t.slotAfternoon}</option>
                    <option value="Evening (16:00 - 20:00)">{t.slotEvening}</option>
                    <option value="Full Day (08:00 - 20:00)">{t.slotFullDay}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                    {t.urgencyLabel}
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:border-teal-700"
                  >
                    <option value="STANDARD">{t.urgencyStandard}</option>
                    <option value="URGENT">{t.urgencyUrgent}</option>
                    <option value="EMERGENCY">{t.urgencyEmergency}</option>
                  </select>
                </div>
              </div>

              {/* TRANSPARENT PRICE ESTIMATOR (Feature 1) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Transparent Price Estimator
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Estimated Breakdown
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Optional Materials / Spares Estimate (₹):
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={estimatedMaterialsInr || ''}
                      placeholder="0 (Enter ₹ if worker should buy parts)"
                      onChange={(e) => setEstimatedMaterialsInr(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-teal-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Materials Description (Optional):
                    </label>
                    <input
                      type="text"
                      value={materialsDescription}
                      placeholder="e.g. 15A switch, tap mixer valve, sealant"
                      onChange={(e) => setMaterialsDescription(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                {/* Clear Estimated Calculation Box */}
                {selectedCategory && (
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-xs tabular-nums">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 font-sans">
                      <span>Standard Labor Charge ({selectedCategory}):</span>
                      <strong className="text-slate-900 dark:text-slate-100 font-mono">
                        ₹{selectedCategory === 'Carpenter' || selectedCategory === 'Painter' ? 500 : selectedCategory === 'Babysitter' ? 550 : selectedCategory === 'Cleaner' ? 400 : 450}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 font-sans">
                      <span>Optional Materials / Parts:</span>
                      <strong className="text-slate-900 dark:text-slate-100 font-mono">
                        ₹{estimatedMaterialsInr}
                      </strong>
                    </div>
                    {urgency !== 'STANDARD' && (
                      <div className="flex justify-between text-amber-800 dark:text-amber-300 font-sans">
                        <span>Urgency Surcharge ({translateUrgency(urgency, lang)}):</span>
                        <strong className="font-mono">+₹{urgency === 'EMERGENCY' ? 150 : 50}</strong>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100 dark:border-slate-800 font-sans">
                      <span className="font-bold text-slate-900 dark:text-slate-100">Estimated Total Amount:</span>
                      <strong className="font-mono text-base text-teal-800 dark:text-teal-400 font-bold">
                        ₹{(selectedCategory === 'Carpenter' || selectedCategory === 'Painter' ? 500 : selectedCategory === 'Babysitter' ? 550 : selectedCategory === 'Cleaner' ? 400 : 450) + estimatedMaterialsInr + (urgency === 'EMERGENCY' ? 150 : urgency === 'URGENT' ? 50 : 0)}
                      </strong>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 font-sans">
                      * Clearly labeled estimate. Final cost is confirmed on site; if worker adjusts price, your explicit approval is required before the booking amount changes.
                    </p>
                  </div>
                )}
              </div>

              {/* Customer Location */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5 max-w-xl">
                <button
                  type="button"
                  onClick={handleDetectCustomerGps}
                  disabled={detectingGps}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/40 text-teal-800 dark:text-teal-300 text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-98 disabled:opacity-50"
                  title="Use my current location"
                >
                  <Navigation className={`w-3.5 h-3.5 text-teal-700 dark:text-teal-400 ${detectingGps ? 'animate-spin' : ''}`} />
                  <span>
                    {detectingGps
                      ? (lang === 'bn' ? 'শনাক্ত হচ্ছে...' : lang === 'hi' ? 'पहचान हो रही है...' : 'Detecting...')
                      : (t.detectGpsBtn || 'Use my current location')}
                  </span>
                </button>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={customerCoords.addressLabel || ''}
                    onChange={(e) =>
                      setCustomerCoords({ ...customerCoords, addressLabel: e.target.value })
                    }
                    placeholder={t.addressPlaceholder}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 pl-8 pr-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-700 bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>

                {gpsNotice && (
                  <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 inline-block"></span>
                    {gpsNotice}
                  </p>
                )}
              </div>

              {matchError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
                  {matchError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGapFinderOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-teal-300 dark:border-teal-750 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 text-teal-800 dark:text-teal-300 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-98"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{t.gapFinderTitle || 'Check Booking Gaps (Gemma 4)'}</span>
                  {Object.keys(confirmedGapAnswers).length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-teal-700 text-white font-bold">
                      ✓ {Object.keys(confirmedGapAnswers).length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDirectBookNow}
                  disabled={submittingBooking || !selectedCategory}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer text-center shadow-2xs active:scale-98"
                >
                  {submittingBooking
                    ? (lang === 'bn' ? 'বুকিং হচ্ছে...' : lang === 'hi' ? 'बुकिंग हो रही है...' : 'Booking...')
                    : (t.bookThisWorkerBtn || 'Book Now')}
                </button>
                <button
                  type="submit"
                  disabled={matching}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer text-center shadow-2xs active:scale-98"
                >
                  {matching ? (lang === 'bn' ? 'উপযুক্ত কর্মী খোঁজা হচ্ছে...' : lang === 'hi' ? 'योग्य कर्मी खोजे जा रहे हैं...' : 'Computing Fair Dispatch Scores...') : t.findMatchingWorkersBtn}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: DISPLAY MATCHING WORKERS */}
          {matchChecked && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {lang === 'bn'
                      ? 'নিকটতম ৫ জন যোগ্য কর্মী (দূরত্ব অনুসারে সাজানো)'
                      : lang === 'hi'
                      ? 'निकटतम ५ योग्य कार्यकर्ता (दूरी के अनुसार क्रमबद्ध)'
                      : '5 Nearest Eligible Workers (Sorted Nearest to Farthest)'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'যেকোনো একজন কর্মীকে নির্বাচন করুন। নির্বাচিত কর্মীর ড্যাশবোর্ডেই সরাসরি বুকিং পৌঁছাবে।'
                      : lang === 'hi'
                      ? 'किसी भी कार्यकर्ता को चुनें। आपके द्वारा चुने गए कार्यकर्ता के डैशबोर्ड पर ही बुकिंग जाएगी।'
                      : 'Select any worker below. Your booking is dispatched directly to the exact worker selected.'}
                  </p>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                  {matchedCandidates.length} {t.eligibleWorkersCount}
                </span>
              </div>

              {matchedCandidates.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{t.noWorkersFound}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-5">
                  {matchedCandidates.map((item, idx) => {
                    const { worker, dispatch, isRecommended, isNearest, aiExplanation } = item;
                    const isTopNearest = isNearest || idx === 0;
                    const urgencyExtra =
                      urgency === 'EMERGENCY' ? 150 : urgency === 'URGENT' ? 50 : 0;
                    const estTotalInr = worker.baseRateInr + urgencyExtra;

                    return (
                      <div
                        key={worker.id}
                        className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all shadow-2xs ${
                          isTopNearest
                            ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30'
                            : isRecommended
                            ? 'border-teal-700 dark:border-teal-500 bg-teal-50/30 dark:bg-teal-950/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Top row: Avatar, Name, Nearest & KYC status */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-sm flex items-center justify-center shrink-0 border border-slate-700">
                                {worker.avatarInitials}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                    {worker.name}
                                  </h3>
                                  {isTopNearest && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 shadow-2xs">
                                      ★ {lang === 'bn' ? 'নিকটতম কর্মী' : lang === 'hi' ? 'निकटतम कार्यकर्ता' : 'Nearest Worker'} ({dispatch.distanceKm !== null ? `${dispatch.distanceKm.toFixed(2)} km` : 'local'})
                                    </span>
                                  )}
                                  {!isTopNearest && isRecommended && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 border border-teal-200/80 dark:border-teal-700/80 shadow-2xs">
                                      ★ {t.recommendedMatchLabel}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{translateCategory(worker.category, lang)}</span>
                                  <span>·</span>
                                  <span>
                                    {worker.verified ? (
                                      <strong className="text-emerald-700 dark:text-emerald-400">
                                        ✓ {t.verifiedMemberLabel}
                                      </strong>
                                    ) : (
                                      <span className="text-amber-700 dark:text-amber-400">
                                        {t.unverifiedMemberLabel}
                                      </span>
                                    )}
                                  </span>
                                  <span>·</span>
                                  <span className="font-mono tabular-nums">
                                    ★ {worker.rating.toFixed(1)} ({worker.reviewCount} {lang === 'bn' ? 'রিভিউ' : lang === 'hi' ? 'समीक्षाएं' : 'reviews'})
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-xs text-slate-500 dark:text-slate-400">{t.matchScoreLabel}</div>
                              <div className="text-xl font-bold font-mono tabular-nums text-teal-800 dark:text-teal-400">
                                {dispatch.weightedTotal}/100
                              </div>
                            </div>
                          </div>

                          {/* Distance, Shift, Cost */}
                          <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block">{t.distanceLabel}</span>
                              <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                                {dispatch.distanceKm !== null
                                  ? `${dispatch.distanceKm.toFixed(2)} km`
                                  : 'N/A'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block">{t.shiftLabel}</span>
                              <strong className="text-slate-900 dark:text-slate-100 truncate block">
                                {translateSlot(worker.shift, lang)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block">{t.estCostLabel}</span>
                              <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                                ₹{estTotalInr}
                              </strong>
                            </div>
                          </div>

                          {/* Transparent Numerical Score Breakdown */}
                          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums text-[11px]">
                              <span>{lang === 'bn' ? 'দূরত্ব' : lang === 'hi' ? 'दूरी' : 'Proximity'} (45%): {dispatch.proximityScore}/100</span>
                              <span>{lang === 'bn' ? 'দক্ষতা' : lang === 'hi' ? 'कौशल' : 'Skill'} (30%): {dispatch.skillScore}/100</span>
                              <span>{lang === 'bn' ? 'ন্যায্য বণ্টন' : lang === 'hi' ? 'निष्पक्षता' : 'Fairness'} (25%): {dispatch.fairnessScore}/100</span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 pt-1">
                              <strong>{t.whyMatchedLabel}</strong> {aiExplanation || dispatch.explanation}
                            </p>
                          </div>

                          {/* Skills */}
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {t.requiredSkillsLabel}: {worker.skills.map((s) => getSkillLabel(s, lang)).join(' · ')}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                            {t.statusAvailable || 'Available for Dispatch'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setBookingModalError(null);
                              setWorkerToConfirm(item);
                            }}
                            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-600 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
                          >
                            {t.bookThisWorkerBtn}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        /* MY BOOKINGS & LIFECYCLE TRACKING VIEW */
        <div className="space-y-5">
          {/* Gemma 4 Feature 3: Home Maintenance Memory Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-teal-200 dark:border-teal-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  <History className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Home Maintenance Memory</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 font-semibold border border-teal-200 dark:border-teal-700">
                    Google Gemma 4 E4B
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
                Review verified household repair logs, approved parts replacements, warranty coverage, and predictive preventive maintenance suggestions tailored to your home.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHomeMemoryModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 active:scale-95"
            >
              <History className="w-3.5 h-3.5" />
              <span>Open Maintenance Memory</span>
            </button>
          </div>

          {paymentMessage && (
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs font-medium text-teal-900 flex items-center justify-between">
              <span>{paymentMessage}</span>
              <button
                type="button"
                onClick={() => setPaymentMessage(null)}
                className="text-teal-800 hover:underline"
              >
                {t.closeBtn}
              </button>
            </div>
          )}

          {bookings.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3 shadow-2xs">
              <p className="text-sm text-slate-600 dark:text-slate-400">{t.noBookingsYet}</p>
              <button
                type="button"
                onClick={() => setActiveSubTab('request')}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-600 text-white text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                {t.bookAServiceBtn}
              </button>
            </div>
          ) : (
            bookings.map((booking) => {
              const showMap = expandedMapBookingId === booking.id;
              return (
                <div
                  key={booking.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        <span>{booking.bookingReference}</span>
                        <span>·</span>
                        <span>{booking.preferredDate}</span>
                        <span>·</span>
                        <span>{translateSlot(booking.preferredTimeSlot, lang)}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {translateCategory(booking.workerCategory, lang)} — {t.assignedTo} {booking.workerName}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {t.statusLabel} {translateStatus(booking.status, lang)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="text-xs font-semibold text-teal-800 dark:text-teal-400">
                        {booking.paymentStatus === 'PAID'
                          ? `${t.payment_PAID || 'Settled'} (${booking.paymentMethod || 'UPI'})`
                          : translateStatus(booking.paymentStatus, lang)}
                      </span>
                    </div>
                  </div>

                  {/* Booking Pending Alert */}
                  {booking.status === 'PENDING' && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 font-bold text-amber-950 dark:text-amber-200">
                        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                        <span className="text-sm">
                          {lang === 'bn'
                            ? `বুকিং অপেক্ষমাণ (Booking Pending) — কর্মীর কাছে অনুরোধ পাঠানো হয়েছে (${booking.workerName})`
                            : lang === 'hi'
                            ? `बुकिंग लंबित (Booking Pending) — कर्मी को अनुरोध भेजा गया (${booking.workerName})`
                            : `Booking Pending — Request dispatched to worker (${booking.workerName})`}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-1 rounded-md shrink-0">
                        {booking.bookingReference}
                      </span>
                    </div>
                  )}

                  {/* Worker Acceptance Confirmation Alert */}
                  {booking.status === 'ACCEPTED' && (
                    <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 font-bold text-teal-950 dark:text-teal-200">
                        <CheckCircle2 className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
                        <span className="text-sm">
                          {lang === 'bn'
                            ? `আপনার বুকিং গ্রহণ করা হয়েছে (Your Booking Accepted) — কর্মী: ${booking.workerName}`
                            : lang === 'hi'
                            ? `आपकी बुकिंग स्वीकार कर ली गई है (Your Booking Accepted) — कर्मी: ${booking.workerName}`
                            : `Your Booking Accepted by ${booking.workerName}`}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-teal-800 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 px-2.5 py-1 rounded-md shrink-0">
                        {booking.bookingReference}
                      </span>
                    </div>
                  )}

                  {/* Work in Progress Alert */}
                  {booking.status === 'IN_PROGRESS' && (
                    <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 font-bold text-blue-950 dark:text-blue-200">
                        <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-sm">
                          {lang === 'bn'
                            ? `কাজ চলছে (Work in Progress) — কর্মী: ${booking.workerName}`
                            : lang === 'hi'
                            ? `कार्य प्रगति पर है (Work in Progress) — कर्मी: ${booking.workerName}`
                            : `Work in Progress by ${booking.workerName}`}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2.5 py-1 rounded-md shrink-0">
                        {booking.bookingReference}
                      </span>
                    </div>
                  )}

                  {/* Live 3-Step Workflow Tracker: Start -> Work In Progress -> Work Completed */}
                  {['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status) && (
                    <div className="grid grid-cols-1 @md:grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded-lg border border-teal-700 bg-teal-50/70 dark:bg-teal-950/40 text-xs">
                        <span className="font-mono text-[10px] text-teal-800 dark:text-teal-400 block">STEP 1</span>
                        <strong className="text-teal-900 dark:text-teal-200">{t.step1Workflow}</strong>
                      </div>
                      <div
                        className={`p-2.5 rounded-lg border text-xs ${
                          booking.status === 'IN_PROGRESS'
                            ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold'
                            : booking.status === 'COMPLETED'
                            ? 'border-teal-700 bg-teal-50/70 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="font-mono text-[10px] block">STEP 2</span>
                        <strong>
                          {booking.status === 'COMPLETED'
                            ? `✓ ${t.step2Workflow.replace(/^●\s*/, '')}`
                            : booking.status === 'IN_PROGRESS'
                            ? t.step2Workflow
                            : t.step2Workflow.replace(/^●\s*/, '')}
                        </strong>
                      </div>
                      <div
                        className={`p-2.5 rounded-lg border text-xs ${
                          booking.status === 'COMPLETED'
                            ? 'border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="font-mono text-[10px] block">STEP 3</span>
                        <strong>
                          {booking.status === 'COMPLETED' ? t.step3Workflow : t.step3Workflow.replace(/^★\s*/, '')}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* WORKER PRICE REVISION PROPOSAL BANNER (Feature 1: Requires Customer Approval) */}
                  {booking.priceRevision && booking.priceRevision.status === 'PENDING_APPROVAL' && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <strong className="block text-sm font-bold text-amber-950 dark:text-amber-100">
                            Worker Price Adjustment Proposal — Approval Required
                          </strong>
                          <p className="text-xs text-amber-900 dark:text-amber-200">
                            {booking.workerName} has proposed adjusting the booking amount to{' '}
                            <span className="font-mono font-bold text-amber-950 dark:text-white">
                              ₹{booking.priceRevision.proposedTotalInr}
                            </span>{' '}
                            (Labor: ₹{booking.priceRevision.laborInr}, Materials/Spares: ₹{booking.priceRevision.materialsInr}).
                          </p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                            <strong>Reason given:</strong> "{booking.priceRevision.reason}"
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={reviewingRevisionId === booking.id}
                          onClick={() => handleReviewPriceRevision(booking.id, 'REJECTED')}
                          className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                        >
                          Decline Revision
                        </button>
                        <button
                          type="button"
                          disabled={reviewingRevisionId === booking.id}
                          onClick={() => handleReviewPriceRevision(booking.id, 'APPROVED')}
                          className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                        >
                          {reviewingRevisionId === booking.id ? 'Updating...' : `Approve Revised Price (₹${booking.priceRevision.proposedTotalInr})`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PRICE REVISION STATUS BADGE (If already approved or rejected) */}
                  {booking.priceRevision && booking.priceRevision.status === 'APPROVED' && (
                    <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                        <span>Revised final cost approved by customer: ₹{booking.amountInr}</span>
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {booking.priceRevision.reason}
                      </span>
                    </div>
                  )}

                  {/* Job Completion Alert & Payment Selection Banner for Customer */}
                  {booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID' && (
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/80 dark:border-emerald-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs animate-in fade-in">
                      <div className="flex items-start gap-2.5 text-xs text-emerald-950 dark:text-emerald-200">
                        <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-sm font-bold text-emerald-900 dark:text-emerald-100">
                            {lang === 'bn' ? `কাজ সম্পন্ন করেছেন ${booking.workerName}!` : lang === 'hi' ? `${booking.workerName} द्वारा कार्य पूर्ण किया गया!` : `Job Completed by ${booking.workerName}!`}
                          </strong>
                          <span>
                            {lang === 'bn' ? `আপনার সেবা সম্পন্ন হয়েছে। অনুগ্রহ করে ₹${booking.amountInr} পেমেন্ট করুন:` : lang === 'hi' ? `आपकी सेवा पूर्ण हो चुकी है। कृपया ₹${booking.amountInr} का भुगतान करें:` : `Your service task is marked WORK COMPLETED. Click Pay Now to scan UPI QR or settle via cash:`}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPaymentModalBooking(booking)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 cursor-pointer shadow-md active:scale-95 transition-all"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>Pay Now — UPI QR / Cash (₹{booking.amountInr})</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-4 text-xs text-slate-700 dark:text-slate-300 items-start">
                    <div className="@2xl:col-span-2 space-y-1.5">
                      <p>
                        <strong className="text-slate-900 dark:text-slate-100">{t.taskDescriptionLabel}</strong> {booking.problemDescription}
                      </p>
                      {booking.requiredSkills.length > 0 && (
                        <p className="text-slate-500 dark:text-slate-400">
                          {t.requiredSkillsLabel}: {booking.requiredSkills.map((s) => getSkillLabel(s, lang)).join(' · ')}
                        </p>
                      )}
                      <p className="text-slate-500 dark:text-slate-400">
                        {t.fairDispatchScoreLabel}{' '}
                        <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                          {booking.matchingScore}/100
                        </span>{' '}
                        ({booking.dispatchBreakdown.explanation})
                      </p>
                    </div>

                    {/* Price Breakdown with Transparent Status */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2 font-mono tabular-nums text-xs">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
                        <span className="font-sans font-bold text-slate-900 dark:text-slate-100">
                          {booking.isPriceEstimate ? 'Price Estimate' : 'Approved Final Price'}
                        </span>
                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                          booking.isPriceEstimate
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        }`}>
                          {booking.isPriceEstimate ? 'Estimate' : 'Final Approved'}
                        </span>
                      </div>
                      {booking.priceBreakdown && (
                        <>
                          <div className="flex justify-between text-slate-500 dark:text-slate-400">
                            <span>Labor:</span>
                            <span>₹{booking.priceBreakdown.baseLaborInr}</span>
                          </div>
                          {booking.priceBreakdown.materialsInr > 0 && (
                            <div className="flex justify-between text-slate-500 dark:text-slate-400">
                              <span>Materials:</span>
                              <span>₹{booking.priceBreakdown.materialsInr}</span>
                            </div>
                          )}
                          {booking.priceBreakdown.urgencySurchargeInr > 0 && (
                            <div className="flex justify-between text-amber-700 dark:text-amber-400">
                              <span>Urgency:</span>
                              <span>+₹{booking.priceBreakdown.urgencySurchargeInr}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
                        <span>{t.amountToPay}</span>
                        <strong className="text-slate-900 dark:text-slate-100 text-sm">₹{booking.amountInr}</strong>
                      </div>
                      <div className="flex justify-between text-emerald-800 dark:text-emerald-400">
                        <span>{t.workerNet}</span>
                        <span>₹{booking.workerShareInr}</span>
                      </div>
                      <div className="flex justify-between text-teal-800 dark:text-teal-400">
                        <span>{t.welfareContributionLabel}</span>
                        <span>₹{booking.welfareShareInr}</span>
                      </div>

                      {/* Payment Status & Action in Price Breakdown */}
                      {booking.paymentStatus === 'PAID' ? (
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] font-sans">
                          <span className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Paid (Demo Mode)</span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {booking.paymentMethod || 'UPI'}
                          </span>
                        </div>
                      ) : booking.status === 'COMPLETED' ? (
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1 font-sans">
                          <button
                            type="button"
                            onClick={() => setPaymentModalBooking(booking)}
                            className="w-full py-2 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Pay Now (UPI QR / Cash)</span>
                          </button>
                        </div>
                      ) : (
                        /* Requirement 10: Helpful message explaining payment becomes available after service completion */
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1 font-sans text-[11px]">
                          <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 font-semibold">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>Payment Pending Completion</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                            Pay Now becomes available after worker completes service on-site (Step 3: Work Completed).
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* REQUIREMENT: CHOOSE PAYMENT METHOD SECTION                                 */}
                  {/* ========================================================================= */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                          Choose Payment Method
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          Payment Status:{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {booking.paymentStatus === 'PAID'
                              ? booking.paymentMethod === 'CASH'
                                ? 'Paid by Cash'
                                : 'Paid via UPI'
                              : booking.paymentStatus === 'ORDER_CREATED'
                              ? 'Payment Processing'
                              : booking.paymentStatus === 'FAILED'
                              ? 'Payment Failed'
                              : 'Payment Pending'}
                          </strong>
                        </span>
                        {booking.paymentStatus === 'PAID' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{booking.paymentMethod === 'CASH' ? 'Paid by Cash' : 'Paid via UPI'}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Payment Pending</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Radio Options: Cash on Service vs UPI Payment */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1. Cash on Service */}
                      <div
                        onClick={() => {
                          if (booking.paymentStatus !== 'PAID') {
                            handleUpdatePaymentMethod(booking.id, 'CASH');
                          }
                        }}
                        className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                          (booking.paymentMethod || 'UPI') === 'CASH'
                            ? 'border-teal-600 bg-white dark:bg-slate-900 shadow-2xs ring-2 ring-teal-500/10'
                            : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                        } ${booking.paymentStatus === 'PAID' ? 'cursor-default opacity-90' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`p-2 rounded-xl shrink-0 ${
                                (booking.paymentMethod || 'UPI') === 'CASH'
                                  ? 'bg-teal-700 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              <Banknote className="w-4 h-4" />
                            </div>
                            <div>
                              <strong className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                                Cash on Service
                              </strong>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                                Customer pays the worker in cash after the work is completed.
                              </span>
                            </div>
                          </div>
                          <input
                            type="radio"
                            name={`payment-method-${booking.id}`}
                            checked={(booking.paymentMethod || 'UPI') === 'CASH'}
                            onChange={() => handleUpdatePaymentMethod(booking.id, 'CASH')}
                            disabled={booking.paymentStatus === 'PAID'}
                            className="mt-1 w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500 cursor-pointer"
                          />
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                          {(booking.paymentMethod || 'UPI') === 'CASH' ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                                <span className="font-semibold text-teal-800 dark:text-teal-300">Pay Cash After Service</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">₹{booking.amountInr}</span>
                              </div>
                              {booking.paymentStatus === 'PAID' ? (
                                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold text-center flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Paid by Cash (Confirmed)</span>
                                </div>
                              ) : booking.status === 'COMPLETED' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPaymentModalBooking(booking);
                                  }}
                                  className="w-full py-2 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-98"
                                >
                                  <Banknote className="w-3.5 h-3.5" />
                                  <span>Confirm Cash Paid (₹{booking.amountInr})</span>
                                </button>
                              ) : (
                                <div className="p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-900 dark:text-amber-200">
                                  <span className="font-semibold block">Payment Pending</span>
                                  Pay cash to worker directly once the job status reaches "Work Completed".
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">Click to select cash payment</span>
                          )}
                        </div>
                      </div>

                      {/* 2. UPI Payment */}
                      <div
                        onClick={() => {
                          if (booking.paymentStatus !== 'PAID') {
                            handleUpdatePaymentMethod(booking.id, 'UPI');
                          }
                        }}
                        className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                          (booking.paymentMethod || 'UPI') === 'UPI'
                            ? 'border-teal-600 bg-white dark:bg-slate-900 shadow-2xs ring-2 ring-teal-500/10'
                            : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                        } ${booking.paymentStatus === 'PAID' ? 'cursor-default opacity-90' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`p-2 rounded-xl shrink-0 ${
                                (booking.paymentMethod || 'UPI') === 'UPI'
                                  ? 'bg-teal-700 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              <QrCode className="w-4 h-4" />
                            </div>
                            <div>
                              <strong className="block text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                <span>UPI Payment</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Demo Mode
                                </span>
                              </strong>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                                Customer pays through interactive UPI QR scan or demo simulation.
                              </span>
                            </div>
                          </div>
                          <input
                            type="radio"
                            name={`payment-method-${booking.id}`}
                            checked={(booking.paymentMethod || 'UPI') === 'UPI'}
                            onChange={() => handleUpdatePaymentMethod(booking.id, 'UPI')}
                            disabled={booking.paymentStatus === 'PAID'}
                            className="mt-1 w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500 cursor-pointer"
                          />
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                          {(booking.paymentMethod || 'UPI') === 'UPI' ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                                <span className="font-semibold text-teal-800 dark:text-teal-300">Pay via UPI</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">₹{booking.amountInr}</span>
                              </div>
                              {booking.paymentStatus === 'PAID' ? (
                                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold text-center flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Paid via UPI (Verified)</span>
                                </div>
                              ) : booking.status === 'COMPLETED' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPaymentModalBooking(booking);
                                  }}
                                  className="w-full py-2 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-98"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>Pay via UPI — Show QR & Scanner</span>
                                </button>
                              ) : (
                                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[10px] space-y-1">
                                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 font-semibold">
                                    <Clock className="w-3 h-3" />
                                    <span>Payment Pending Completion</span>
                                  </div>
                                  <p className="text-slate-500 dark:text-slate-400">
                                    "Pay via UPI" button and QR scanner become available after worker completes service on-site.
                                  </p>
                                  <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">
                                    Demo Mode — No real money will be transferred.
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">Click to select UPI payment</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Worker Rating & Review Section (Requirement 2) */}
                  {booking.status === 'COMPLETED' && (
                    <div className="p-4 rounded-xl border border-amber-200/90 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                            {lang === 'bn' ? 'কর্মী রেটিং ও মূল্যায়ন' : lang === 'hi' ? 'श्रमिक रेटिंग और समीक्षा' : 'Worker Rating & Customer Review'}
                          </h4>
                        </div>
                        {(booking.isRated || typeof booking.rating === 'number') && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{lang === 'bn' ? 'রিভিউ জমা হয়েছে ✓' : lang === 'hi' ? 'समीक्षा सबमिट हो गई ✓' : 'Review Submitted ✓'}</span>
                          </span>
                        )}
                      </div>

                      {booking.isRated || typeof booking.rating === 'number' ? (
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center text-amber-500">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= (booking.rating || 5)
                                      ? 'text-amber-500 fill-amber-500'
                                      : 'text-slate-300 dark:text-slate-700'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                              ★ {booking.rating} / 5
                            </span>
                            {booking.ratedAt && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                · {new Date(booking.ratedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {booking.review ? (
                            <p className="text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                              "{booking.review}"
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                              Rated without written comments.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                              {lang === 'bn'
                                ? `${booking.workerName}-এর সেবার মান রেটিং দিন (১ থেকে ৫ স্টার):`
                                : lang === 'hi'
                                ? `${booking.workerName} की सेवा का मूल्यांकन करें (1 से 5 स्टार):`
                                : `Rate your service experience with ${booking.workerName} (1 to 5 stars):`}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {[1, 2, 3, 4, 5].map((starVal) => {
                                const currentVal = ratingInputMap[booking.id] || 5;
                                return (
                                  <button
                                    key={starVal}
                                    type="button"
                                    onClick={() =>
                                      setRatingInputMap((prev) => ({ ...prev, [booking.id]: starVal }))
                                    }
                                    className="p-1 rounded-md hover:scale-115 transition-transform cursor-pointer"
                                    title={`${starVal} Star${starVal > 1 ? 's' : ''}`}
                                  >
                                    <Star
                                      className={`w-5 h-5 ${
                                        starVal <= currentVal
                                          ? 'text-amber-500 fill-amber-500'
                                          : 'text-slate-300 dark:text-slate-700'
                                      }`}
                                    />
                                  </button>
                                );
                              })}
                              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono ml-2">
                                {[
                                  '1 - Poor',
                                  '2 - Fair',
                                  '3 - Good',
                                  '4 - Very Good',
                                  '5 - Excellent',
                                ][(ratingInputMap[booking.id] || 5) - 1]}
                              </span>
                            </div>
                          </div>

                          <div>
                            <textarea
                              rows={2}
                              value={reviewInputMap[booking.id] ?? ''}
                              onChange={(e) =>
                                setReviewInputMap((prev) => ({
                                  ...prev,
                                  [booking.id]: e.target.value,
                                }))
                              }
                              placeholder={
                                lang === 'bn'
                                  ? `${booking.workerName}-এর কাজের সময়ানুবর্তিতা ও দক্ষতা সম্পর্কে মন্তব্য লিখুন (ঐচ্ছিক)...`
                                  : lang === 'hi'
                                  ? `${booking.workerName} के कार्य, समयपालन और कौशल पर समीक्षा लिखें (वैकल्पिक)...`
                                  : `Optional review: How was ${booking.workerName}'s punctuality, technical skill, and cooperative conduct?`
                              }
                              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>

                          {ratingErrorMap[booking.id] && (
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                              {ratingErrorMap[booking.id]}
                            </p>
                          )}

                          {ratingSuccessMap[booking.id] && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              {ratingSuccessMap[booking.id]}
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRateWorker(booking.id)}
                            disabled={submittingRatingId === booking.id}
                            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            {submittingRatingId === booking.id ? (
                              <span>Submitting Rating...</span>
                            ) : (
                              <>
                                <Star className="w-3.5 h-3.5 fill-white" />
                                <span>
                                  {lang === 'bn'
                                    ? 'রেটিং ও রিভিউ জমা দিন'
                                    : lang === 'hi'
                                    ? 'रेटिंग व समीक्षा सबमिट करें'
                                    : 'Submit Rating & Review'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMapBookingId(showMap ? null : booking.id)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                        <span>{showMap ? (lang === 'bn' ? 'ম্যাপ লুকান' : lang === 'hi' ? 'मानचित्र छुपाएं' : 'Hide Live Map') : (lang === 'bn' ? 'লাইভ ম্যাপ দেখুন' : lang === 'hi' ? 'लाइव मैप देखें' : 'View OpenStreetMap Location')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(booking)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                        <span>{t.downloadInvoiceBtn}</span>
                      </button>

                      {/* Defect Problem Reporting & Gemma 4 AI Analysis Button */}
                      <button
                        type="button"
                        onClick={() => setProblemModalBooking(booking)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                          booking.hasProblemReport || problemReportsList.some((r) => r.bookingId === booking.id)
                            ? 'border-teal-400 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 shadow-2xs hover:bg-teal-100 dark:hover:bg-teal-900/40'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}
                        title="Report a defect or view Gemma 4 AI diagnosis"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>
                          {booking.hasProblemReport || problemReportsList.some((r) => r.bookingId === booking.id)
                            ? 'Defect Report & AI Diagnosis'
                            : (t.reportProblemBtn || 'Report Defect / AI Diagnose')}
                        </span>
                        {(booking.hasProblemReport || problemReportsList.some((r) => r.bookingId === booking.id)) && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </button>

                      {/* Gemma 4 Feature 1: AI Complaint-to-Action Converter Button */}
                      <button
                        type="button"
                        onClick={() => setSelectedComplaintBooking(booking)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-850 bg-indigo-50/70 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer shadow-2xs transition-colors"
                        title="View structured complaint summary, worker action plan, and verified facts"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>{t.complaintToActionTitle ? 'Complaint-to-Action' : 'Complaint-to-Action'}</span>
                      </button>

                      {/* Gemma 4 Feature 3: AI Repair Report (Customer View & PDF Download) */}
                      {(booking.status === 'COMPLETED' || booking.status === 'IN_PROGRESS') && (
                        <button
                          type="button"
                          onClick={() => setSelectedReportBooking(booking)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/40 text-xs font-semibold text-teal-900 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/40 cursor-pointer shadow-2xs transition-colors"
                          title="View verified repair report, confirmed parts, and download PDF"
                        >
                          <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <span>{t.repairReportTitle || 'Verified Repair Report (PDF)'}</span>
                        </button>
                      )}

                      {/* Dispute Resolution Button (Feature 4) */}
                      {booking.disputeStatus ? (
                        <button
                          type="button"
                          onClick={() => {
                            const d = existingDisputes.find((item) => item.bookingId === booking.id || item.id === booking.disputeId);
                            if (d) setViewingDispute(d);
                            else setDisputeModalBooking(booking);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                            booking.disputeStatus === 'RESOLVED'
                              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                              : booking.disputeStatus === 'UNDER_REVIEW'
                              ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300'
                              : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span>Dispute: {booking.disputeStatus}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDisputeFeedback(null);
                            setDisputeModalBooking(booking);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                          title="Report an issue or pricing disagreement"
                        >
                          <Scale className="w-3.5 h-3.5 text-slate-500" />
                          <span>Report Issue / Dispute</span>
                        </button>
                      )}

                      {/* Gemma 4 Feature 2: Fair Dispute Dossier */}
                      <button
                        type="button"
                        onClick={() => setDisputeOrganizerBooking(booking)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer shadow-2xs transition-colors"
                        title="View unbiased dispute dossier and cooperative remedies formulated with Google Gemma 4 E4B"
                      >
                        <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Dispute Dossier (AI)</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID' && (
                        <button
                          type="button"
                          onClick={() => setPaymentModalBooking(booking)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer shadow-xs active:scale-95 transition-all"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Pay Now (UPI QR / Cash)</span>
                        </button>
                      )}
                      {booking.paymentStatus === 'PAID' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs border border-emerald-300 dark:border-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Paid (Demo)</span>
                        </span>
                      )}
                      {['PENDING', 'ACCEPTED'].includes(booking.status) && (
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(booking.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        >
                          {t.cancelBtn}
                        </button>
                      )}
                    </div>
                  </div>

                  {showMap && (
                    <div className="pt-2">
                      <LiveTrackingMap
                        customerLocation={booking.customerLocation}
                        workerLocation={booking.liveWorkerLocation || booking.workerCoordinates}
                        customerName={booking.customerName}
                        workerName={`${booking.workerName} (${translateCategory(booking.workerCategory, lang)})`}
                        title={`${t.liveMapTitle} — ${booking.bookingReference}`}
                        isLiveTracking={
                          ['ACCEPTED', 'IN_PROGRESS'].includes(booking.status) &&
                          Boolean(booking.liveWorkerLocation?.isLive)
                        }
                        lastUpdateTimestamp={booking.liveWorkerLocation?.updatedAt}
                        trackingStatusText={
                          ['ACCEPTED', 'IN_PROGRESS'].includes(booking.status)
                            ? booking.liveWorkerLocation?.isLive
                              ? 'Live Worker GPS'
                              : 'Waiting for worker GPS'
                            : 'Tracking ended (Job completed)'
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* BOOKING CONFIRMATION MODAL (Step 7 of Lifecycle) */}
      {workerToConfirm &&
        selectedCategory &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4 my-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.confirmBookingTitle}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setBookingModalError(null);
                    setWorkerToConfirm(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">{t.selectedWorkerLabel || 'Selected Worker'}:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {workerToConfirm.worker.name} ({translateCategory(workerToConfirm.worker.category, lang)})
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">{t.fairDispatchScoreLabel || 'Fair Dispatch Score'}:</span>
                  <strong className="font-mono text-teal-800 dark:text-teal-400">{workerToConfirm.dispatch.weightedTotal}/100</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">{t.dateAndSlotLabel || 'Date & Slot'}:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {preferredDate} · {translateSlot(preferredTimeSlot, lang)}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Worker Distance:</span>
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {workerToConfirm.dispatch.distanceKm !== null
                      ? `${workerToConfirm.dispatch.distanceKm.toFixed(2)} km away`
                      : 'Local service zone'}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Customer Location:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {customerCoords.addressLabel || `${customerCoords.lat.toFixed(4)}, ${customerCoords.lng.toFixed(4)}`}
                  </span>
                </div>
                <div className="py-1">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">{t.taskDescriptionLabel || 'Task Description'}:</span>
                  <p className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                    {problemDescription.trim() ||
                      `${translateCategory(selectedCategory, lang)} (${
                        selectedSkills.length > 0 ? selectedSkills.map(s => getSkillLabel(s, lang)).join(', ') : (lang === 'bn' ? 'সাধারণ সেবা' : lang === 'hi' ? 'सामान्य सेवा' : 'General service')
                      })`}
                  </p>
                </div>
                {problemMediaUrls.length > 0 && (
                  <div className="py-1">
                    <span className="text-slate-500 dark:text-slate-400 block mb-1">
                      Problem Photos / Videos Attached ({problemMediaUrls.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {problemMediaUrls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-[11px] text-teal-800 dark:text-teal-200 hover:underline"
                        >
                          Attachment {idx + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-2.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-[11px] text-teal-900 dark:text-teal-200 flex items-start gap-2">
                  <span className="text-teal-700 dark:text-teal-400 font-bold shrink-0">✓</span>
                  <span>
                    <strong>Direct Worker Delivery Guarantee:</strong> This job will be saved in the database and dispatched exclusively to <strong>{workerToConfirm.worker.name}</strong>. It will never be automatically assigned or substituted to any other worker.
                  </span>
                </div>
              </div>

              {bookingModalError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>{bookingModalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setBookingModalError(null);
                    setWorkerToConfirm(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="button"
                  disabled={submittingBooking}
                  onClick={handleConfirmBooking}
                  className="px-5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-50 cursor-pointer shadow-2xs active:scale-95"
                >
                  {submittingBooking ? (lang === 'bn' ? 'জমা দেওয়া হচ্ছে...' : lang === 'hi' ? 'जमा किया जा रहा है...' : 'Submitting...') : t.submitBookingBtn}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* UPI OR CASH PAYMENT SETTLEMENT MODAL (Module 8) */}
      {activePaymentOrder &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4 my-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {lang === 'bn' ? 'কাজের পেমেন্ট সম্পন্ন করুন (UPI বা ক্যাশ)' : lang === 'hi' ? 'कार्य भुगतान पूर्ण करें (UPI या नकद)' : 'Complete Job Payment (UPI or Cash)'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePaymentOrder(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Select Payment Method: UPI or Cash */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {lang === 'bn' ? 'পেমেন্ট মাধ্যম বেছে নিন:' : lang === 'hi' ? 'भुगतान विकल्प चुनें:' : 'Choose Payment Option:'}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('UPI')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      selectedPaymentMethod === 'UPI'
                        ? 'border-teal-700 dark:border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 font-semibold ring-2 ring-teal-700/20 dark:ring-teal-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-sm">{t.upiPayment || 'UPI Payment'}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      GPay / PhonePe / Paytm / UPI ID
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('CASH')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      selectedPaymentMethod === 'CASH'
                        ? 'border-teal-700 dark:border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 font-semibold ring-2 ring-teal-700/20 dark:ring-teal-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-sm">{t.cashPayment || 'Cash Payment'}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {lang === 'bn' ? 'সমবায় কর্মীকে সরাসরি নগদ প্রদান' : lang === 'hi' ? 'सहकारी कर्मी को सीधा नकद' : 'Direct Cash to Cooperative Worker'}
                    </div>
                  </button>
                </div>
              </div>

              {selectedPaymentMethod === 'UPI' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? 'সমবায় ইউপিআই আইডি / VPA' : lang === 'hi' ? 'सहकारी यूपीआई आईडी / VPA' : 'Cooperative UPI ID / VPA'}
                  </label>
                  <input
                    type="text"
                    value={upiIdInput}
                    onChange={(e) => setUpiIdInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:border-teal-700"
                  />
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2 text-xs font-mono tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{lang === 'bn' ? 'অর্ডার নম্বর:' : lang === 'hi' ? 'ऑर्डर संदर्भ:' : 'Order Reference:'}</span>
                  <strong className="text-slate-900 dark:text-slate-100">{activePaymentOrder.orderId}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{lang === 'bn' ? 'বুকিং নম্বর:' : lang === 'hi' ? 'बुकिंग संदर्भ:' : 'Booking Ref:'}</span>
                  <strong className="text-slate-900 dark:text-slate-100">{activePaymentOrder.booking.bookingReference}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{lang === 'bn' ? 'নির্বাচিত মাধ্যম:' : lang === 'hi' ? 'चुना गया तरीका:' : 'Selected Mode:'}</span>
                  <strong className="text-slate-900 dark:text-slate-100">{selectedPaymentMethod}</strong>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-sans font-semibold text-slate-900 dark:text-slate-100">{t.amountToPay || 'Gross Payable'}:</span>
                  <strong className="text-slate-900 dark:text-slate-100">₹{activePaymentOrder.amountInr}.00</strong>
                </div>
                <div className="flex justify-between text-emerald-800 dark:text-emerald-400">
                  <span className="font-sans">{t.workerNet || 'Worker Net Share (90%)'}:</span>
                  <span>₹{activePaymentOrder.workerShareInr}.00</span>
                </div>
                <div className="flex justify-between text-teal-800 dark:text-teal-400">
                  <span className="font-sans">{t.welfareContributionLabel || 'Cooperative Welfare Fund (10%)'}:</span>
                  <span>₹{activePaymentOrder.welfareShareInr}.00</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActivePaymentOrder(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="button"
                  onClick={handleVerifySandboxPayment}
                  className="px-5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer shadow-2xs active:scale-95"
                >
                  {lang === 'bn' ? `${selectedPaymentMethod} পেমেন্ট নিশ্চিত করুন (₹${activePaymentOrder.amountInr})` : lang === 'hi' ? `${selectedPaymentMethod} भुगतान की पुष्टि करें (₹${activePaymentOrder.amountInr})` : `Confirm ${selectedPaymentMethod} Payment (₹${activePaymentOrder.amountInr})`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Problem Reporting & Real Gemma 4 AI Analysis Modal */}
      {problemModalBooking && (
        <ProblemReportingModal
          isOpen={Boolean(problemModalBooking)}
          onClose={() => setProblemModalBooking(null)}
          booking={problemModalBooking}
          existingReport={
            problemReportsList.find((r) => r.bookingId === problemModalBooking.id) || null
          }
          userRole="CUSTOMER"
          token={token}
          onReportCreated={(newRep) => {
            setProblemReportsList((prev) => [newRep, ...prev.filter((r) => r.id !== newRep.id)]);
            onRefreshBookings();
          }}
          onReportUpdated={(updatedRep) => {
            setProblemReportsList((prev) =>
              prev.map((r) => (r.id === updatedRep.id ? updatedRep : r))
            );
            onRefreshBookings();
          }}
          t={t}
          lang={lang}
          isOnline={isOnline}
        />
      )}

      {/* Complete UPI QR Code, Camera Scanner & Cash Demo Payment Modal */}
      {paymentModalBooking && (
        <DemoPaymentModal
          isOpen={Boolean(paymentModalBooking)}
          onClose={() => setPaymentModalBooking(null)}
          booking={paymentModalBooking}
          userRole="CUSTOMER"
          token={token}
          lang={lang}
          onPaymentSuccess={async (_updatedBooking, message) => {
            setPaymentModalBooking(null);
            setBookingFeedback(message);
            await onRefreshBookings();
          }}
        />
      )}
      {/* Gemma 4 Feature 4: AI Booking Requirement Gap Finder Modal */}
      {isGapFinderOpen && (
        <AiBookingGapFinderModal
          isOpen={isGapFinderOpen}
          onClose={() => setIsGapFinderOpen(false)}
          bookingDraft={{
            serviceCategory: selectedCategory || 'Plumber',
            problemDescription: problemDescription || 'General maintenance service',
            preferredDate,
            preferredTimeSlot,
            urgency,
            customerCoords,
            customerAddress: customerCoords.addressLabel,
            additionalInstructions,
          }}
          token={token}
          lang={lang}
          t={t}
          onGapsResolved={(answers) => {
            setConfirmedGapAnswers(answers);
          }}
        />
      )}

      {/* Gemma 4 Feature 1: AI Complaint-to-Action Converter Modal */}
      {selectedComplaintBooking && (
        <AiComplaintToActionModal
          isOpen={Boolean(selectedComplaintBooking)}
          onClose={() => setSelectedComplaintBooking(null)}
          bookingId={selectedComplaintBooking.id}
          bookingReference={selectedComplaintBooking.bookingReference}
          complaintText={selectedComplaintBooking.problemDescription}
          userRole="CUSTOMER"
          token={token}
          lang={lang}
          t={t}
          onRecordUpdated={() => {
            onRefreshBookings();
          }}
        />
      )}

      {/* Gemma 4 Feature 3: AI Repair Report Generator / Viewer Modal */}
      {selectedReportBooking && (
        <AiRepairReportModal
          isOpen={Boolean(selectedReportBooking)}
          onClose={() => setSelectedReportBooking(null)}
          booking={selectedReportBooking}
          userRole="CUSTOMER"
          token={token}
          lang={lang}
          t={t}
          onReportSaved={() => {
            onRefreshBookings();
          }}
        />
      )}

      {/* Gemma 4 Feature 3: Home Maintenance Memory Modal */}
      {showHomeMemoryModal && (
        <HomeMaintenanceMemoryModal
          isOpen={showHomeMemoryModal}
          onClose={() => setShowHomeMemoryModal(false)}
          customerId={user.id}
          customerName={user.name}
          token={token}
          lang={lang}
        />
      )}

      {/* Gemma 4 Feature 2: Fair Dispute Organizer Modal */}
      {disputeOrganizerBooking && (
        <FairDisputeOrganizerModal
          isOpen={Boolean(disputeOrganizerBooking)}
          onClose={() => setDisputeOrganizerBooking(null)}
          bookingId={disputeOrganizerBooking.id}
          bookingReference={disputeOrganizerBooking.bookingReference}
          token={token}
          lang={lang}
        />
      )}
    </div>
  );
};

