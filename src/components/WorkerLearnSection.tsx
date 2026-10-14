import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  ShieldAlert,
  MessageSquare,
  CreditCard,
  Briefcase,
  CheckCircle2,
  Clock,
  BookOpen,
  Search,
  ChevronRight,
  Award,
  Sparkles,
  ExternalLink,
  RotateCcw,
  X,
  FileCheck2,
} from 'lucide-react';
import type { LanguageCode } from '../types';

export type LearnCategory =
  | 'ALL'
  | 'SKILL_DEVELOPMENT'
  | 'SAFETY'
  | 'CUSTOMER_COMMUNICATION'
  | 'DIGITAL_PAYMENTS'
  | 'PROFESSIONAL_DEVELOPMENT';

export interface LearningResource {
  id: string;
  title: string;
  titleBn: string;
  titleHi: string;
  category: LearnCategory;
  estimatedMinutes: number;
  badge: string;
  summary: string;
  summaryBn: string;
  summaryHi: string;
  takeaways: string[];
  takeawaysBn?: string[];
  takeawaysHi?: string[];
  practicalSteps: string[];
  practicalStepsBn?: string[];
  practicalStepsHi?: string[];
  quizPrompt?: {
    question: string;
    options: string[];
    correctIndex: number;
  };
}

const LEARNING_RESOURCES: LearningResource[] = [
  // 1. Worker Skill Development
  {
    id: 'mod-skill-1',
    title: 'Precision Domestic Fault Isolation & Multi-Meter Diagnostics',
    titleBn: 'সঠিক গার্হস্থ্য ফল্ট নির্ণয় ও মাল্টি-মিটার ব্যবহার',
    titleHi: 'सटीक घरेलू दोष पहचान और मल्टी-मीटर निदान',
    category: 'SKILL_DEVELOPMENT',
    estimatedMinutes: 6,
    badge: 'Core Technical Skill',
    summary:
      'Learn how to systematically test household wiring, circuit continuity, and voltage drop across switchboards using calibrated digital multi-meters without unnecessary wall chiseling.',
    summaryBn:
      'দেয়াল না ভেঙে ডিজিটাল মাল্টি-মিটার দিয়ে তারের সংযোগ ও ভোল্টেজ পরীক্ষা করার সঠিক পদ্ধতি জানুন।',
    summaryHi:
      'दीवारों को नुकसान पहुंचाए बिना मल्टी-मीटर से घरेलू वायरिंग और वोल्टेज जांचने का सही तरीका सीखें।',
    takeaways: [
      'Always test voltage with a calibrated meter before touching bare copper terminals.',
      'Check resistance across earthing points (should be under 5 Ohms for domestic units).',
      'Explain the measured reading to the household resident to build technical trust.',
    ],
    practicalSteps: [
      'Turn off the main Double Pole (DP) isolator at the entrance.',
      'Verify zero voltage using both probe contacts on neutral and live lines.',
      'Measure circuit impedance to detect internal wire degradation before replacing MCBs.',
    ],
    quizPrompt: {
      question: 'What is the recommended maximum domestic earthing resistance value?',
      options: ['Under 5 Ohms', 'Over 50 Ohms', '100 Ohms', 'Resistance does not matter'],
      correctIndex: 0,
    },
  },
  {
    id: 'mod-skill-2',
    title: 'High-Pressure Pipe Joint Integrity & Water Proofing Standards',
    titleBn: 'উচ্চ-চাপ পাইপ জয়েন্ট ও ওয়াটারপ্রুফিং মানদণ্ড',
    titleHi: 'उच्च-दबाव पाइप जोड़ अखंडता और वॉटरप्रूफिंग मानक',
    category: 'SKILL_DEVELOPMENT',
    estimatedMinutes: 7,
    badge: 'Plumbing Mastery',
    summary:
      'Step-by-step best practices for CPVC/PPR heat-welded joints, Teflon tape winding counts, and zero-drip compression fittings for overhead tanks and concealed bathroom mixers.',
    summaryBn:
      'CPVC/PPR পাইপ হিট-ওয়েল্ডিং এবং টেফলন টেপ সঠিকভাবে ব্যবহারের প্রমাণিত নিয়মাবলি।',
    summaryHi:
      'CPVC/PPR पाइप जोड़ों और टेफ्लॉन टेप के सही उपयोग से रिसाव रोकने की तकनीक।',
    takeaways: [
      'Wind Teflon tape clockwise 14-16 turns in the thread direction.',
      'Allow solvent cement to cure for 15 minutes minimum before applying mains water pressure.',
      'Perform a 10-minute dry-paper towel leak test before packing tile cement.',
    ],
    practicalSteps: [
      'Deburr pipe cuts cleanly with a 45-degree bevel chamfering tool.',
      'Clean both socket and pipe ends with acetone or pipe cleaner before applying adhesive.',
      'Insert pipe firmly with a quarter turn and hold for 30 seconds.',
    ],
    quizPrompt: {
      question: 'How should Teflon tape be wound on male pipe threads?',
      options: ['Clockwise in thread direction', 'Counter-clockwise against threads', 'Randomly', 'Only on the first thread'],
      correctIndex: 0,
    },
  },
  {
    id: 'mod-skill-3',
    title: 'Furniture Joinery, Concealed Hinges & Termite Mitigation',
    titleBn: 'আসবাবপত্রের কব্জা মেরামত ও উইপোকা প্রতিরোধ',
    titleHi: 'फर्नीचर जोड़, छुपा हुआ काज और दीमक रोकथाम',
    category: 'SKILL_DEVELOPMENT',
    estimatedMinutes: 5,
    badge: 'Carpentry Standards',
    summary:
      'Master European 35mm concealed hinge alignment, modular cabinet door leveling, and safe eco-friendly borate wood treatment.',
    summaryBn:
      'ইউরোপিয়ান ৩৫ মিমি কব্জা সমন্বয় এবং কাঠ সুরক্ষা রাসায়নিক প্রয়োগের সঠিক নিয়ম।',
    summaryHi:
      'मॉड्यूलर कैबिनेट के 35mm हिंज एडजस्टमेंट और लकड़ी की सुरक्षा के उपाय।',
    takeaways: [
      'Use 3-way adjustment screws to correct cabinet door sagging.',
      'Apply non-toxic borate spray for wood protection in food preparation zones.',
      'Check floor-to-ceiling plumb lines before tightening anchor expansion bolts.',
    ],
    practicalSteps: [
      'Align doors with horizontal and vertical level indicators.',
      'Pre-drill pilot screw holes to avoid splitting seasoned hardwood or MDF veneer.',
      'Clean wood dust with vacuum nozzle rather than shaking into customer room.',
    ],
  },

  // 2. Safety at Work
  {
    id: 'mod-safety-1',
    title: 'Electrical Isolation, Lockout & Safe Discharge Protocol',
    titleBn: 'বৈদ্যুতিক আইসোলেশন ও নিরাপদ ডিসচার্জ প্রটোকল',
    titleHi: 'विद्युत अलगाव और सुरक्षित डिस्चार्ज प्रोटोकॉल',
    category: 'SAFETY',
    estimatedMinutes: 6,
    badge: 'Mandatory Safety',
    summary:
      'Crucial life-safety rules for working around live inverters, heavy condenser units, and high-ampere domestic switchgear.',
    summaryBn:
      'ইনভার্টার ও উচ্চ-ক্ষমতার সুইচে কাজ করার সময় জীবন-রক্ষাকারী সুরক্ষা নিয়মাবলি।',
    summaryHi:
      'इनवर्टर और घरेलू मेन स्विच पर काम करते समय आवश्यक जीवन सुरक्षा नियम।',
    takeaways: [
      'Never rely solely on a wall switch; always cut the main fuse or DP breaker.',
      'Wear 1000V rated insulated footwear and rubber-palmed safety gloves.',
      'Discharge inverter capacitor banks safely through a resistor before touching terminals.',
    ],
    practicalSteps: [
      'Inform the customer that power will be shut down for safety.',
      'Hang a warning tag on the meter box while working.',
      'Use an insulated non-contact voltage detector as a secondary check.',
    ],
    quizPrompt: {
      question: 'Before working on ceiling wiring, what must be done first?',
      options: ['Turn off main breaker and test for zero voltage', 'Turn off only the wall switch', 'Touch wire quickly to test', 'Nothing'],
      correctIndex: 0,
    },
  },
  {
    id: 'mod-safety-2',
    title: 'Cooperative Emergency SOS & On-Site Threat Response',
    titleBn: 'জরুরি এসওএস (SOS) ও অন-সাইট নিরাপত্তা ব্যবস্থা',
    titleHi: 'आपातकालीन एसओएस (SOS) और सुरक्षा प्रतिक्रिया',
    category: 'SAFETY',
    estimatedMinutes: 5,
    badge: 'Worker Protection',
    summary:
      'How to use the Help Nest Emergency SOS button in the Worker PWA if you face personal safety threats, medical emergencies, or hazardous electrical flashovers.',
    summaryBn:
      'বিপদ বা জরুরি অবস্থায় কীভাবে হেল্প নেস্ট জরুরি এসওএস বোতাম ব্যবহার করবেন।',
    summaryHi:
      'कार्यस्थल पर किसी खतरे या चिकित्सा आपातकाल में इमरजेंसी एसओएस का उपयोग कैसे करें।',
    takeaways: [
      'The SOS button instantly alerts cooperative society administrators and peer workers nearby.',
      'Optional GPS sharing can be toggled on to transmit your location to responders.',
      'Your physical safety is always more important than completing a job.',
    ],
    practicalSteps: [
      'If you feel unsafe, step out of the household immediately to a public area.',
      'Tap the red Emergency SOS button in your Worker Portal header.',
      'Wait for cooperative emergency support confirmation.',
    ],
  },
  {
    id: 'mod-safety-3',
    title: 'PPE & Hazardous Chemical Handling in Sanitization',
    titleBn: 'পিপিই ও পরিচ্ছন্নতায় বিপজ্জনক রাসায়নিক পরিচালনা',
    titleHi: 'पीपीई और सफाई में खतरनाक रसायनों का सुरक्षित उपयोग',
    category: 'SAFETY',
    estimatedMinutes: 5,
    badge: 'Hygiene & Health',
    summary:
      'Proper respiratory masks, protective goggles, and dilution ratios when working with drain-clearing acids and deep cleaning biocides.',
    summaryBn:
      'ড্রেন পরিষ্কারক এসিড ও রাসায়নিক ব্যবহারে মাস্ক ও চশমা ব্যবহারের নিয়ম।',
    summaryHi:
      'नाली सफाई और ब्लीचिंग रसायनों के उपयोग में सुरक्षा उपकरण (PPE) के नियम।',
    takeaways: [
      'Never mix bleach and acid-based toilet cleaners — this produces toxic chlorine gas.',
      'Ensure adequate bathroom cross-ventilation before opening degreaser solutions.',
      'Wear nitrile chemical-resistant gloves instead of bare hands.',
    ],
    practicalSteps: [
      'Open bathroom windows or turn on exhaust fans before applying solutions.',
      'Rinse contaminated surfaces thoroughly with cold clean water.',
      'Dispose of chemical bottles responsibly in marked plastic disposal bins.',
    ],
  },

  // 3. Customer Communication
  {
    id: 'mod-comm-1',
    title: 'Professional Household Etiquette & Scope Explanation',
    titleBn: 'পেশাদার আচরণ ও কাজের পরিধি সুস্পষ্টভাবে ব্যাখ্যা',
    titleHi: 'पेशेवर आचार-व्यवहार और कार्य विवरण स्पष्टीकरण',
    category: 'CUSTOMER_COMMUNICATION',
    estimatedMinutes: 5,
    badge: 'Customer Trust',
    summary:
      'How to greet customers politely, introduce yourself as a verified Help Nest cooperative member, and explain diagnostic findings in simple clear terms.',
    summaryBn:
      'গ্রাহকের সাথে মার্জিত আচরণ এবং কাজের খরচ ও সময় আগে থেকেই স্পষ্টভাবে বোঝানো।',
    summaryHi:
      'ग्राहक से सम्मानजनक बातचीत और काम की जांच के बाद स्पष्ट अनुमान बताना।',
    takeaways: [
      'Always greet the resident by name and present your Help Nest trade badge.',
      'Never quote hidden extra charges; always agree on price before touching the tools.',
      'Use the In-App Price Revision proposal feature if additional parts are required.',
    ],
    practicalSteps: [
      'Remove outdoor footwear or wear shoe-covers before stepping onto household carpets.',
      'Show the customer the defective part (e.g., worn-out washer, burnt MCB) before replacing it.',
      'Ask the customer to test the repair (e.g., test water flow, turn on switch) before marking completed.',
    ],
  },
  {
    id: 'mod-comm-2',
    title: 'Handling Price Adjustments & Customer Objections with Care',
    titleBn: 'মূল্য পরিবর্তন ও গ্রাহক আপত্তি সমাধান পদ্ধতি',
    titleHi: 'मूल्य संशोधन और ग्राहक आपत्तियों का शांतिपूर्ण समाधान',
    category: 'CUSTOMER_COMMUNICATION',
    estimatedMinutes: 6,
    badge: 'Conflict Prevention',
    summary:
      'Transparent cooperative bylaws for handling scope creep when a customer asks for extra repairs not included in the original booking.',
    summaryBn:
      'গ্রাহক অতিরিক্ত কাজ চাইলে কীভাবে সমিতির নিয়মানুযায়ী স্বচ্ছভাবে নতুন মূল্য নির্ধারণ করবেন।',
    summaryHi:
      'अतिरिक्त काम मांगे जाने पर ऐप में नया अनुमान भेजने और शांति से बात करने का तरीका।',
    takeaways: [
      'Submit an official Price Revision proposal in the Worker Portal rather than verbal bargaining.',
      'The customer receives an instant prompt on their phone to approve or decline.',
      'If the customer declines, complete only the originally agreed scope politely.',
    ],
    practicalSteps: [
      'Explain the exact cost of the required hardware component with an estimate breakdown.',
      'Click "Propose Revised Price" in the job card and enter the materials and labor cost.',
      'Proceed with additional work only after the customer taps "Approve" in their portal.',
    ],
  },

  // 4. Digital Payments
  {
    id: 'mod-pay-1',
    title: 'Mastering UPI QR Scanning & Cash Settlement Receipts',
    titleBn: 'ইউপিআই কিউআর কোড ও নগদ পেমেন্ট নিষ্পত্তি',
    titleHi: 'यूपीआई क्यूआर कोड और नकद भुगतान रसीद प्रक्रिया',
    category: 'DIGITAL_PAYMENTS',
    estimatedMinutes: 6,
    badge: 'Digital Finance',
    summary:
      'Complete guide on collecting payments smoothly via the Help Nest Demo QR generator or cash confirmation, ensuring zero payment disputes.',
    summaryBn:
      'গ্রাহকের থেকে ইউপিআই কিউআর অথবা নগদ পেমেন্ট নিশ্চিতকরণ ও ডিজিটাল রসিদ প্রদানের নিয়ম।',
    summaryHi:
      'ग्राहक से यूपीआई क्यूआर कोड स्कैन या नकद भुगतान प्राप्त करने और रसीद देने की प्रक्रिया।',
    takeaways: [
      'Customer can scan the dynamic UPI QR directly from the screen.',
      'If customer pays in cash, tap "Confirm Cash Settle" to instantly issue a digital invoice.',
      'Every settled payment updates the transparent cooperative ledger automatically.',
    ],
    practicalSteps: [
      'After completing work, guide the customer to tap "Pay Now" on their booking card.',
      'Check that the green "Paid (Verified)" checkmark appears on the screen.',
      'Both you and the customer can download an official PDF receipt immediately.',
    ],
  },
  {
    id: 'mod-pay-2',
    title: 'Understanding the 90:10 Cooperative Split & Welfare Fund',
    titleBn: '৯০:১০ সমবায় লাভ বিভাজন ও কল্যাণ তহবিল',
    titleHi: '90:10 सहकारी आय विभाजन और कल्याण कोष को समझना',
    category: 'DIGITAL_PAYMENTS',
    estimatedMinutes: 5,
    badge: 'Coop Economics',
    summary:
      'How the Help Nest 90:10 model works: exactly 90% goes straight to you with zero middleman deductions, and 10% builds your collective social security fund.',
    summaryBn:
      'কীভাবে ৯০% টাকা সরাসরি আপনার অ্যাকাউন্টে থাকে এবং ১০% আপনার সামাজিক কল্যাণ তহবিলে জমা হয়।',
    summaryHi:
      'जानें कि कैसे 90% राशि सीधे आपकी है और 10% आपके सामाजिक सुरक्षा कल्याण कोष में सुरक्षित रहती है।',
    takeaways: [
      'Example: For a ₹1,000 job, your direct share is ₹900 (90%) and ₹100 (10%) goes to welfare.',
      'The 10% fund finances member health subsidies, tool replacement grants, and children education.',
      'All transactions are viewable in real-time in the Cooperative Fund ledger.',
    ],
    practicalSteps: [
      'View your cumulative 90% earnings under the Earnings tab.',
      'Check the collective Welfare Reserve under the Cooperative Fund tab.',
      'Vote on welfare proposals to decide how the 10% fund is utilized annually.',
    ],
  },

  // 5. Professional Development
  {
    id: 'mod-prof-1',
    title: 'Earning Trade Badges, Advancing KYC & Building 5-Star Reviews',
    titleBn: 'ট্রেড ব্যাজ অর্জন, কেওয়াইসি বৃদ্ধি ও ৫-স্টার রিভিউ',
    titleHi: 'ट्रेड बैज प्राप्त करना, केवाईसी स्तर और 5-स्टार रेटिंग बनाना',
    category: 'PROFESSIONAL_DEVELOPMENT',
    estimatedMinutes: 6,
    badge: 'Career Growth',
    summary:
      'How cooperative dispatch rewards high-rated workers with higher booking allocations, verified trade badges, and priority dispatch bonuses.',
    summaryBn:
      'উচ্চ রেটিং ও দক্ষতা ব্যাজ পেলে কীভাবে বেশি কাজ ও আয়ের সুযোগ বৃদ্ধি পায়।',
    summaryHi:
      'अच्छी रेटिंग और सत्यापित कौशल बैज से काम पाने में प्राथमिकता कैसे प्राप्त करें।',
    takeaways: [
      'Maintaining 4.8+ rating with zero complaints boosts your Fair Dispatch matching score.',
      'Upload verified trade certificates (ITI, wireman permit) for Admin KYC badge approval.',
      'Customers can leave 1-5 star reviews right after job completion.',
    ],
    practicalSteps: [
      'Ask satisfied customers: "If you are happy with the repair, please rate the service in your app!"',
      'Never pressurize customers for ratings — let your clean workmanship earn the 5 stars.',
      'Keep your availability shift updated in Profile to receive jobs at your preferred times.',
    ],
  },
  {
    id: 'mod-prof-2',
    title: 'Cooperative Democracy: Proposals, Voting & Bylaw Evolution',
    titleBn: 'সমবায় গণতন্ত্র: প্রস্তাব তৈরি, ভোটিং ও নিয়মনীতি',
    titleHi: 'सहकारी लोकतंत्र: प्रस्ताव बनाना, मतदान और नियम',
    category: 'PROFESSIONAL_DEVELOPMENT',
    estimatedMinutes: 5,
    badge: 'Member Governance',
    summary:
      'You are not just a gig-worker; you are a cooperative co-owner. Learn how to draft policy proposals and vote on minimum rates and welfare grants.',
    summaryBn:
      'সমবায়ের একজন সম-অংশীদার হিসেবে কীভাবে ভোটাধিকার প্রয়োগ করবেন ও নতুন নীতিমালা প্রস্তাব করবেন।',
    summaryHi:
      'सहकारी सदस्य के रूप में अपने अधिकारों, मतदान और न्यूनतम दर तय करने की प्रक्रिया को जानें।',
    takeaways: [
      'Every member worker gets exactly 1 democratic vote regardless of seniority.',
      'Proposals receiving majority votes are forwarded to the Society Executive Committee.',
      'Use the AI Cooperative Rule Explainer anytime to query official bylaws.',
    ],
    practicalSteps: [
      'Open the "Coop Democracy" tab to review open member proposals.',
      'Tap "Vote FOR" or "Vote AGAINST" on active welfare and tool upgrade motions.',
      'Submit your own proposal if you identify an area needing collective cooperative support.',
    ],
  },
];

const STORAGE_LEARN_PROGRESS_KEY = 'helpnest_worker_learning_progress';

interface WorkerLearnSectionProps {
  token?: string | null;
  workerId?: string;
  workerName?: string;
  lang?: LanguageCode;
  t?: Record<string, string>;
}

export const WorkerLearnSection: React.FC<WorkerLearnSectionProps> = ({
  token,
  workerId,
  lang = 'en',
  t = {},
}) => {
  const [selectedCategory, setSelectedCategory] = useState<LearnCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModule, setActiveModule] = useState<LearningResource | null>(null);

  // Learning progress: completed module IDs
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LEARN_PROGRESS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.completedModuleIds)) {
          return parsed.completedModuleIds;
        }
      }
    } catch {
      // Fallback
    }
    return ['mod-safety-1', 'mod-comm-1']; // Default initial completed modules
  });

  const [inProgressIds, setInProgressIds] = useState<string[]>(['mod-skill-1']);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);

  // Sync progress with backend on mount
  useEffect(() => {
    if (!token) return;
    fetch(`/api/worker/learning-progress${workerId ? `?workerId=${encodeURIComponent(workerId)}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.completedModuleIds)) {
          setCompletedIds((prev) => Array.from(new Set([...prev, ...data.completedModuleIds])));
          if (Array.isArray(data.inProgressModuleIds)) {
            setInProgressIds(data.inProgressModuleIds);
          }
        }
      })
      .catch(() => {});
  }, [token, workerId]);

  // Save progress locally and sync with backend
  const persistProgress = (newCompleted: string[], newInProgress: string[]) => {
    setCompletedIds(newCompleted);
    setInProgressIds(newInProgress);

    try {
      localStorage.setItem(
        STORAGE_LEARN_PROGRESS_KEY,
        JSON.stringify({
          completedModuleIds: newCompleted,
          inProgressModuleIds: newInProgress,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore localStorage write error
    }

    if (token) {
      fetch('/api/worker/learning-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workerId,
          completedModuleIds: newCompleted,
          inProgressModuleIds: newInProgress,
        }),
      })
        .then(() => setSyncStatus('Progress synchronized with cooperative server ✓'))
        .catch(() => setSyncStatus('Saved locally (will sync when online)'));

      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const handleToggleComplete = (moduleId: string) => {
    let nextCompleted: string[];
    let nextInProgress: string[];

    if (completedIds.includes(moduleId)) {
      nextCompleted = completedIds.filter((id) => id !== moduleId);
      nextInProgress = inProgressIds.includes(moduleId)
        ? inProgressIds
        : [...inProgressIds, moduleId];
    } else {
      nextCompleted = [...completedIds, moduleId];
      nextInProgress = inProgressIds.filter((id) => id !== moduleId);
    }

    persistProgress(nextCompleted, nextInProgress);
  };

  const handleStartModule = (mod: LearningResource) => {
    setActiveModule(mod);
    setSelectedQuizAnswer(null);
    setQuizSubmitted(false);

    if (!completedIds.includes(mod.id) && !inProgressIds.includes(mod.id)) {
      const nextInProgress = [...inProgressIds, mod.id];
      persistProgress(completedIds, nextInProgress);
    }
  };

  // Filter modules
  const filteredModules = LEARNING_RESOURCES.filter((mod) => {
    const matchesCategory =
      selectedCategory === 'ALL' || mod.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      mod.title.toLowerCase().includes(q) ||
      mod.titleBn.toLowerCase().includes(q) ||
      mod.titleHi.toLowerCase().includes(q) ||
      mod.summary.toLowerCase().includes(q) ||
      mod.badge.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const completionPercent = Math.round(
    (completedIds.length / LEARNING_RESOURCES.length) * 100
  );

  const getLocalizedTitle = (mod: LearningResource) => {
    if (lang === 'bn' && mod.titleBn) return mod.titleBn;
    if (lang === 'hi' && mod.titleHi) return mod.titleHi;
    return mod.title;
  };

  const getLocalizedSummary = (mod: LearningResource) => {
    if (lang === 'bn' && mod.summaryBn) return mod.summaryBn;
    if (lang === 'hi' && mod.summaryHi) return mod.summaryHi;
    return mod.summary;
  };

  const categoryLabels: Record<LearnCategory, { en: string; bn: string; hi: string; icon: React.FC<{ className?: string }> }> = {
    ALL: { en: 'All Modules', bn: 'সকল মডিউল', hi: 'सभी मॉड्यूल', icon: GraduationCap },
    SKILL_DEVELOPMENT: { en: 'Skill Development', bn: 'দক্ষতা উন্নয়ন', hi: 'कौशल विकास', icon: Briefcase },
    SAFETY: { en: 'Safety at Work', bn: 'কাজের নিরাপত্তা', hi: 'कार्य सुरक्षा', icon: ShieldAlert },
    CUSTOMER_COMMUNICATION: { en: 'Customer Communication', bn: 'গ্রাহক যোগাযোগ', hi: 'ग्राहक संचार', icon: MessageSquare },
    DIGITAL_PAYMENTS: { en: 'Digital Payments', bn: 'ডিজিটাল পেমেন্ট', hi: 'डिजिटल भुगतान', icon: CreditCard },
    PROFESSIONAL_DEVELOPMENT: { en: 'Professional Development', bn: 'পেশাদার অগ্রগতি', hi: 'व्यावसायिक विकास', icon: Award },
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Card */}
      <div className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {lang === 'bn'
                  ? 'সমবায় দক্ষতা একাডেমি'
                  : lang === 'hi'
                  ? 'सहकारी कौशल अकादमी'
                  : 'Cooperative Skill & Safety Academy'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight">
              {lang === 'bn'
                ? 'পেশাগত দক্ষতা বৃদ্ধি ও নিরাপদ সেবা প্রদান'
                : lang === 'hi'
                ? 'व्यावसायिक कौशल और सुरक्षित सेवा मानक'
                : 'Worker Skill Development & Safety Standards'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {lang === 'bn'
                ? 'অন-সাইট নিরাপত্তা, গ্রাহকের সাথে শালীন যোগাযোগ, ৯:১ ডিজিটাল পেমেন্ট বিভাজন এবং উচ্চতর কেওয়াইসি ট্রেড ব্যাজ অর্জনের সম্পূর্ণ নির্দেশিকা।'
                : lang === 'hi'
                ? 'कार्य सुरक्षा, ग्राहक संचार, 90:10 डिजिटल भुगतान और ट्रेड बैज प्राप्त करने के आधिकारिक दिशानिर्देश।'
                : 'Comprehensive practical resources in safety, trade excellence, polite customer communication, digital payments, and democratic governance.'}
            </p>
          </div>

          {/* Progress Card */}
          <div className="bg-white/10 border border-white/15 backdrop-blur-md rounded-2xl p-5 min-w-[240px] space-y-3 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">
                {lang === 'bn' ? 'শেখার অগ্রগতি' : lang === 'hi' ? 'सीखने की प्रगति' : 'Learning Progress'}
              </span>
              <span className="font-mono font-bold text-emerald-300 text-sm tabular-nums">
                {completionPercent}%
              </span>
            </div>

            <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono">
              <span>
                {completedIds.length} / {LEARNING_RESOURCES.length}{' '}
                {lang === 'bn' ? 'সম্পন্ন' : lang === 'hi' ? 'पूर्ण' : 'Completed'}
              </span>
              {completionPercent >= 80 && (
                <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                  <Award className="w-3 h-3" />
                  <span>Mastery Tier</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {syncStatus && (
          <div className="mt-4 pt-3 border-t border-white/15 text-[11px] text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{syncStatus}</span>
          </div>
        )}
      </div>

      {/* Category Pills Filter & Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'মডিউল বা বিষয়বস্তু খুঁজুন...'
                  : lang === 'hi'
                  ? 'मॉड्यूल खोजें...'
                  : 'Search learning resources, topics, or skills...'
              }
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 dark:focus:ring-teal-500"
            />
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {filteredModules.length}{' '}
            {lang === 'bn' ? 'টি মডিউল প্রাপ্ত' : lang === 'hi' ? 'मॉड्यूल मिले' : 'learning modules available'}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 pt-1">
          {(
            [
              'ALL',
              'SKILL_DEVELOPMENT',
              'SAFETY',
              'CUSTOMER_COMMUNICATION',
              'DIGITAL_PAYMENTS',
              'PROFESSIONAL_DEVELOPMENT',
            ] as LearnCategory[]
          ).map((cat) => {
            const info = categoryLabels[cat];
            const Icon = info.icon;
            const label = lang === 'bn' ? info.bn : lang === 'hi' ? info.hi : info.en;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Learning Resource Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredModules.map((mod) => {
          const isCompleted = completedIds.includes(mod.id);
          const isInProgress = inProgressIds.includes(mod.id);
          const title = getLocalizedTitle(mod);
          const summary = getLocalizedSummary(mod);

          return (
            <div
              key={mod.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all p-5 flex flex-col justify-between shadow-2xs hover:shadow-md ${
                isCompleted
                  ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/20 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="space-y-3">
                {/* Header tags */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                    {mod.badge}
                  </span>

                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{mod.estimatedMinutes} mins</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                    {title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-3 leading-relaxed">
                    {summary}
                  </p>
                </div>
              </div>

              {/* Action Buttons & Status */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleStartModule(mod)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400 hover:text-teal-800 hover:underline cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    {isCompleted
                      ? (lang === 'bn' ? 'পুনর্বিবেচনা করুন' : lang === 'hi' ? 'पुनरावलोकन' : 'Review Guide')
                      : isInProgress
                      ? (lang === 'bn' ? 'চালিয়ে যান' : lang === 'hi' ? 'जारी रखें' : 'Continue Reading')
                      : (lang === 'bn' ? 'শুরু করুন' : lang === 'hi' ? 'शुरू करें' : 'Start Module')}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleComplete(mod.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    isCompleted
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={isCompleted ? 'Mark as Incomplete' : 'Mark as Completed'}
                >
                  <CheckCircle2 className={`w-3 h-3 ${isCompleted ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>{isCompleted ? 'Completed ✓' : 'Mark Done'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAIL MODAL: Learning Resource Interactive Lesson */}
      {activeModule && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-850">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold border border-teal-200 dark:border-teal-800">
                    {activeModule.badge}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ~{activeModule.estimatedMinutes} mins
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {getLocalizedTitle(activeModule)}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveModule(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {/* Summary box */}
              <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 text-teal-950 dark:text-teal-200 space-y-1">
                <strong className="block text-xs font-bold text-teal-900 dark:text-teal-100 uppercase tracking-wider">
                  Overview & Objective
                </strong>
                <p className="text-xs sm:text-sm">{getLocalizedSummary(activeModule)}</p>
              </div>

              {/* Key Takeaways */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  <span>Key Technical & Operational Rules</span>
                </h4>
                <ul className="space-y-2 pl-2">
                  {activeModule.takeaways.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 mt-2 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Step-by-Step Procedure */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  <span>Step-by-Step On-Site Action Checklist</span>
                </h4>
                <div className="space-y-2 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700">
                  {activeModule.practicalSteps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs">
                      <span className="font-mono font-bold text-teal-700 dark:text-teal-400 shrink-0">
                        0{idx + 1}.
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Knowledge Check (Quiz) if available */}
              {activeModule.quizPrompt && (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/30 space-y-3">
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" />
                    <span>Quick Knowledge Check</span>
                  </h4>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {activeModule.quizPrompt.question}
                  </p>
                  <div className="space-y-1.5">
                    {activeModule.quizPrompt.options.map((opt, optIdx) => {
                      const isSelected = selectedQuizAnswer === optIdx;
                      const isCorrect = optIdx === activeModule.quizPrompt?.correctIndex;
                      let optionClasses =
                        'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200';

                      if (quizSubmitted) {
                        if (isCorrect) {
                          optionClasses =
                            'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold';
                        } else if (isSelected && !isCorrect) {
                          optionClasses =
                            'border-red-400 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200';
                        }
                      } else if (isSelected) {
                        optionClasses =
                          'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-100 font-medium';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => {
                            if (!quizSubmitted) {
                              setSelectedQuizAnswer(optIdx);
                            }
                          }}
                          className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors cursor-pointer flex items-center justify-between ${optionClasses}`}
                        >
                          <span>{opt}</span>
                          {quizSubmitted && isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {!quizSubmitted && selectedQuizAnswer !== null && (
                    <button
                      type="button"
                      onClick={() => setQuizSubmitted(true)}
                      className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Check Answer
                    </button>
                  )}

                  {quizSubmitted && (
                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      {selectedQuizAnswer === activeModule.quizPrompt.correctIndex
                        ? 'Correct! You understood the key principle.'
                        : 'Review the correct answer highlighted above.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-850">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {completedIds.includes(activeModule.id)
                  ? 'Completed on record ✓'
                  : 'Reading in progress'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModule(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleToggleComplete(activeModule.id);
                    setActiveModule(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    completedIds.includes(activeModule.id)
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  {completedIds.includes(activeModule.id)
                    ? 'Mark Incomplete'
                    : 'Mark Module as Completed ✓'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
