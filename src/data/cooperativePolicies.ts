/**
 * Help Nest Cooperative Society — Verified Approved Rules & Policies
 * Source of Truth for the Cooperative Rule Explainer Engine
 *
 * All figures, percentages, split formulas, and procedures are legally binding
 * bylaws approved by the Cooperative Society General Body (2026 Edition).
 */

export interface CooperativeBylaw {
  id: string;
  sectionCode: string;
  title: string;
  category: 'REVENUE_SPLIT' | 'TIME_PROTECTION' | 'DISPUTES' | 'WELFARE_FUND' | 'AVAILABILITY_SHIFTS' | 'BULK_SERVICES' | 'KYC_ONBOARDING' | 'COLLABORATION';
  summary: string;
  fullText: string;
  keyFigures: Record<string, string | number>;
  applicableRoles: Array<'WORKER' | 'CUSTOMER' | 'ADMIN'>;
}

export const COOPERATIVE_BYLAWS: CooperativeBylaw[] = [
  {
    id: 'bylaw-01',
    sectionCode: 'Help Nest Bylaw Sec 4.1: Revenue Settlement & Split',
    title: 'Fair 90:10 Revenue Settlement Split',
    category: 'REVENUE_SPLIT',
    summary: '90% of every customer booking payment goes directly to the servicing worker. 10% is allocated to the Cooperative Welfare & Emergency Reserve Fund. 0% platform middlemen commissions.',
    fullText: 'All gross booking revenues received through the Help Nest Cooperative Platform are settled under an immutable 90:10 cooperative ratio. Exactly 90% is credited directly to the primary servicing worker\'s net earnings account within 24 hours of job completion. The remaining 10% is contributed to the democratically managed Cooperative Welfare Fund. No external venture capital take-rates or platform brokerage fees are ever deducted.',
    keyFigures: {
      workerSharePercent: 90,
      welfareContributionPercent: 10,
      platformCommissionPercent: 0,
      settlementTurnaroundHours: 24,
    },
    applicableRoles: ['WORKER', 'CUSTOMER', 'ADMIN'],
  },
  {
    id: 'bylaw-02',
    sectionCode: 'Help Nest Bylaw Sec 4.2: Approved Standard Base Rates',
    title: 'Approved Standard Trade Base Rates',
    category: 'REVENUE_SPLIT',
    summary: 'Standard minimum base labor rates: Plumber ₹450, Electrician ₹450, Carpenter ₹500, Painter ₹500, Cleaner ₹400, Babysitter ₹550.',
    fullText: 'The Cooperative Committee sets minimum baseline service rates to protect members against wage deflation: Plumber (₹450 base), Electrician (₹450 base), Carpenter (₹500 base), Painter (₹500 base), Cleaner (₹400 base), and Babysitter (₹550 base). Urgent bookings carry a standard ₹50 priority supplement, and Emergency bookings carry a ₹150 rapid dispatch supplement (both 90% worker-allocated).',
    keyFigures: {
      plumberBaseRateInr: 450,
      electricianBaseRateInr: 450,
      carpenterBaseRateInr: 500,
      painterBaseRateInr: 500,
      cleanerBaseRateInr: 400,
      babysitterBaseRateInr: 550,
      urgentSupplementInr: 50,
      emergencySupplementInr: 150,
    },
    applicableRoles: ['WORKER', 'CUSTOMER', 'ADMIN'],
  },
  {
    id: 'bylaw-03',
    sectionCode: 'Help Nest Bylaw Sec 5.1: Worker Time Protection & Late Cancellation',
    title: 'Worker Time Protection & Cancellation Compensation',
    category: 'TIME_PROTECTION',
    summary: 'If a customer cancels within 30 minutes of scheduled start time or after worker arrival, worker is guaranteed ₹150 base compensation plus travel allowance from the cooperative reserve.',
    fullText: 'To safeguard worker livelihoods against no-shows and sudden customer cancellations: If a customer cancels within 30 minutes of the agreed job window or after the worker has checked in at the site, the worker is automatically credited ₹150 late-cancellation compensation plus ₹15 per kilometer of documented transit distance. This compensation is disbursed directly from the Cooperative Time Protection Fund.',
    keyFigures: {
      cancellationNoticeBufferMinutes: 30,
      baseCompensationInr: 150,
      travelRatePerKmInr: 15,
      fundingSource: 'Cooperative Time Protection Reserve',
    },
    applicableRoles: ['WORKER', 'ADMIN'],
  },
  {
    id: 'bylaw-04',
    sectionCode: 'Help Nest Bylaw Sec 6.1: Welfare Fund & Member Grants',
    title: 'Cooperative Welfare Fund Disbursements & Benefits',
    category: 'WELFARE_FUND',
    summary: 'The 10% welfare pool funds: Emergency Medical Assistance (up to ₹5,000), Annual Tool & Equipment Subsidies (up to ₹2,500), and Trade Upskilling Certification grants (up to ₹3,000).',
    fullText: 'The 10% collective welfare reserve provides non-repayable grants to eligible cooperative members: 1. Emergency Medical Assistance: up to ₹5,000 per incident for acute health issues or accidents during work. 2. Tool & Safety Equipment Subsidy: up to ₹2,500 annually for trade gear, multimeters, PPR cutters, or PPE. 3. Skill & Certification Grants: up to ₹3,000 for government Skill India or ITI certifications. Requests are submitted via the Worker Console and reviewed by the Secretary within 48 hours.',
    keyFigures: {
      maxMedicalGrantInr: 5000,
      maxToolSubsidyInr: 2500,
      maxTrainingGrantInr: 3000,
      approvalTurnaroundHours: 48,
    },
    applicableRoles: ['WORKER', 'ADMIN'],
  },
  {
    id: 'bylaw-05',
    sectionCode: 'Help Nest Bylaw Sec 7.1: Fair Dispute Resolution Process',
    title: 'Customer & Worker Dispute Resolution Procedure',
    category: 'DISPUTES',
    summary: 'Disputes filed via the portal are reviewed within 24 hours. The Secretary initiates a joint review with evidence notes. In cases of partial completion, payment is apportioned fairly by mutual sign-off.',
    fullText: 'Either customer or worker may file a formal dispute under categories: PAYMENT_ISSUE, INCOMPLETE_WORK, PRICING_DISAGREEMENT, or BEHAVIOR_ISSUE. The Secretary or assigned Committee member investigates within 24 hours. For material disputes, evidence photos and work notes from the job history are reviewed. If work was partially done, labor is prorated fairly and spare parts verified before closing the ticket. Neither AI nor automated algorithms can modify dispute resolutions or deduct worker earnings without human committee approval.',
    keyFigures: {
      initialReviewTimeHours: 24,
      disputeCategoriesCount: 5,
      appealWindowDays: 7,
    },
    applicableRoles: ['WORKER', 'CUSTOMER', 'ADMIN'],
  },
  {
    id: 'bylaw-06',
    sectionCode: 'Help Nest Bylaw Sec 8.1: Work Availability & Shift Rules',
    title: 'Worker Shift Scheduling & Leave Notification',
    category: 'AVAILABILITY_SHIFTS',
    summary: 'Workers choose their shifts (Morning 08:00-12:00, Afternoon 12:00-16:00, Evening 16:00-20:00, Full Day 08:00-20:00). Toggle availability anytime; giving 2 hours notice for scheduled society bulk assignments is requested.',
    fullText: 'Help Nest is a true worker cooperative where members maintain full autonomy over their working hours. Supported shifts are: Morning (08:00 - 12:00), Afternoon (12:00 - 16:00), Evening (16:00 - 20:00), and Full Day (08:00 - 20:00). Workers can toggle between Available and Offline at will from their mobile PWA. If scheduled for a community bulk maintenance job, members are requested to notify the society coordinator at least 2 hours in advance if unable to attend.',
    keyFigures: {
      supportedShiftsCount: 4,
      bulkNoticeBufferHours: 2,
      penaltyForOffline: 0,
    },
    applicableRoles: ['WORKER'],
  },
  {
    id: 'bylaw-07',
    sectionCode: 'Help Nest Bylaw Sec 9.1: Community Bulk Service Policy',
    title: 'Housing Society & Community Bulk Booking Discount',
    category: 'BULK_SERVICES',
    summary: 'Residential housing societies booking 4 or more household units receive a 15% cooperative bulk discount. Workers receive guaranteed clustered jobs in the same compound.',
    fullText: 'Apartment complexes and cooperative housing societies ordering maintenance for 4 or more units receive an approved 15% discount on standard trade rates. The assigned worker benefits from zero transit time between consecutive jobs in the same society block. Each household unit retains an individual service card and tracking status.',
    keyFigures: {
      minimumHouseholdsForBulk: 4,
      bulkDiscountPercent: 15,
      workerClusterGuarantee: 'Guaranteed',
    },
    applicableRoles: ['WORKER', 'CUSTOMER', 'ADMIN'],
  },
  {
    id: 'bylaw-08',
    sectionCode: 'Help Nest Bylaw Sec 10.1: Peer-to-Peer Worker Collaboration',
    title: 'Worker-to-Worker Help & Collaboration Network',
    category: 'COLLABORATION',
    summary: 'When a job requires heavy assistance or multi-trade skills (e.g., pipe welding or high ceiling work), workers can invite a peer. The labor payout is split 50:50 or proportionally by agreed hours.',
    fullText: 'Members encountering hazardous or two-person jobs (such as main water tank hoisting, heavy furniture moving, or dual-switchboard rewiring) may broadcast an in-network Collaboration Request from their Job Queue. Both workers log check-in at the site. The 90% labor share is divided equally (50:50) or by mutually logged hours upon customer completion sign-off.',
    keyFigures: {
      standardLaborSplitPercent: '50:50',
      safetyEscalationSupported: 'Supported',
    },
    applicableRoles: ['WORKER'],
  },
];

/**
 * Verified retrieval function to find relevant bylaws for a given worker inquiry.
 */
export function retrieveRelevantBylaws(query: string): {
  matchedBylaws: CooperativeBylaw[];
  relevantSummary: string;
} {
  const q = String(query || '').toLowerCase().trim();

  const scores = COOPERATIVE_BYLAWS.map((bylaw) => {
    let score = 0;
    const textToMatch = `${bylaw.title} ${bylaw.sectionCode} ${bylaw.summary} ${bylaw.fullText} ${bylaw.category}`.toLowerCase();

    // Exact category and keywords triggers
    if (/split|share|percentage|90|10|commission|middleman|earning|payment|कटौती|ভাগ|টাকা/i.test(q)) {
      if (bylaw.category === 'REVENUE_SPLIT') score += 10;
    }
    if (/cancel|late|protection|arrive|compensation|no-show|বাতিল|रद्द/i.test(q)) {
      if (bylaw.category === 'TIME_PROTECTION') score += 10;
    }
    if (/welfare|medical|equipment|tool|grant|subsidy|health|চিকিৎসা|ভাতা|अनुदान/i.test(q)) {
      if (bylaw.category === 'WELFARE_FUND') score += 10;
    }
    if (/dispute|complaint|fight|disagree|issue|problem|অভিযোগ|विवाद/i.test(q)) {
      if (bylaw.category === 'DISPUTES') score += 10;
    }
    if (/shift|time|leave|available|offline|schedule|ছুটি|সময়|शिफ्ट/i.test(q)) {
      if (bylaw.category === 'AVAILABILITY_SHIFTS') score += 10;
    }
    if (/bulk|society|community|apartment|discount|ফ্ল্যাট|সোসাইটি/i.test(q)) {
      if (bylaw.category === 'BULK_SERVICES') score += 10;
    }
    if (/help|partner|collaborate|peer|second worker|সহায়তা|मदद/i.test(q)) {
      if (bylaw.category === 'COLLABORATION') score += 10;
    }

    // Word token matching
    const tokens = q.split(/\s+/).filter((w) => w.length > 2);
    for (const token of tokens) {
      if (textToMatch.includes(token)) score += 2;
    }

    return { bylaw, score };
  });

  scores.sort((a, b) => b.score - a.score);

  // Return top matched bylaws with score > 0, or default to top 2 general bylaws
  const matched = scores.filter((s) => s.score > 0).slice(0, 3).map((s) => s.bylaw);
  const finalBylaws = matched.length > 0 ? matched : COOPERATIVE_BYLAWS.slice(0, 2);

  const relevantSummary = finalBylaws
    .map(
      (b) =>
        `[${b.sectionCode}]\nTitle: ${b.title}\nPolicy Content: ${b.fullText}\nKey Figures: ${JSON.stringify(b.keyFigures)}`
    )
    .join('\n\n');

  return {
    matchedBylaws: finalBylaws,
    relevantSummary,
  };
}
