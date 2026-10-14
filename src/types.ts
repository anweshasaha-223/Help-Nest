export type UserRole = 'CUSTOMER' | 'WORKER' | 'ADMIN';

export type SupportedServiceCategory =
  | 'Electrician'
  | 'Plumber'
  | 'Carpenter'
  | 'Painter'
  | 'Cleaner'
  | 'Babysitter';

export type BookingStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type UrgencyLevel = 'STANDARD' | 'URGENT' | 'PRIORITY' | 'EMERGENCY';

export type ShiftPreference =
  | 'Morning (08:00 - 12:00)'
  | 'Afternoon (12:00 - 16:00)'
  | 'Evening (16:00 - 20:00)'
  | 'Full Day (08:00 - 20:00)';

export interface Coordinates {
  lat: number;
  lng: number;
  addressLabel?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  preferredLanguage: 'en' | 'bn' | 'hi';
  location?: Coordinates;
  workerId?: string;
  societyName?: string;
  category?: SupportedServiceCategory;
  serviceZone?: string;
}

export interface WorkerProfile {
  id: string;
  userId: string;
  name: string;
  phone: string;
  avatarInitials: string;
  category: SupportedServiceCategory;
  skills: string[];
  verified: boolean;
  kycStatus: 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
  kycDocumentType?: string;
  kycDocumentNumber?: string;
  kycSubmittedAt?: string;
  kycReviewerNote?: string;
  skillBadges: string[];
  isAvailable: boolean;
  shift: ShiftPreference;
  serviceZone: string;
  coordinates: Coordinates;
  rating: number;
  reviewCount: number;
  baseRateInr: number;
  completedJobsTotal: number;
  completedJobsThisWeek: number;
  grossEarningsInr: number;
  netEarningsInr: number;
  welfareContributionInr: number;
  reviews?: Array<{
    id: string;
    bookingId: string;
    customerId: string;
    customerName: string;
    rating: number;
    review?: string;
    createdAt: string;
  }>;
}

export interface FairDispatchBreakdown {
  proximityScore: number; // 0 - 100
  skillScore: number; // 0 - 100
  fairnessScore: number; // 0 - 100
  weightedTotal: number; // (Proximity * 0.45) + (Skill * 0.30) + (Fairness * 0.25)
  distanceKm: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  explanation: string;
}

export interface MatchedWorkerResult {
  worker: WorkerProfile;
  dispatch: FairDispatchBreakdown;
  isRecommended: boolean;
  isNearest?: boolean;
  aiExplanation?: string;
  isLiveConnectedWorker?: boolean;
}

export interface GemmaInterpretedRequest {
  detectedLanguage: string;
  serviceCategory: SupportedServiceCategory | null;
  extractedSkills: string[];
  taskSummary: string;
  urgency: UrgencyLevel | null;
  preferredTimeSlot: ShiftPreference | null;
  missingFieldsToConfirm: string[];
  confidenceNote: string;
  safetyGuidance?: string[];
  isHazardAlert?: boolean;
  preliminaryNotice?: string;
  suggestedDetailsToProvide?: string[];
  modelUsed: string;
  isLiveModel: boolean;
}

export interface PriceBreakdown {
  baseLaborInr: number;
  materialsInr: number;
  materialsDescription?: string;
  urgencySurchargeInr: number;
  additionalChargesInr: number;
  totalInr: number;
  isEstimate: boolean;
  notes?: string;
}

export type LanguageCode = 'en' | 'bn' | 'hi';

export interface PriceRevisionProposal {
  proposedTotalInr: number;
  materialsInr: number;
  laborInr: number;
  reason: string;
  proposedAt: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  customerReviewedAt?: string;
  approved?: boolean;
  materialsDescription?: string;
  additionalMaterialsInr?: number;
}

export interface BookingRecord {
  id: string;
  bookingReference: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerLocation: Coordinates;
  workerId: string;
  assignedWorkerId?: string;
  workerName: string;
  workerPhone: string;
  workerCategory: SupportedServiceCategory;
  workerCoordinates: Coordinates;
  requiredSkills: string[];
  problemDescription: string;
  problemMediaUrls?: string[];
  realTimeDelivered?: boolean;
  deliveryStatus?: 'REALTIME_DELIVERED' | 'STORED_PENDING_RECONNECT';
  preferredDate: string;
  preferredTimeSlot: ShiftPreference;
  urgency: UrgencyLevel;
  additionalInstructions: string;
  status: BookingStatus;
  matchingScore: number;
  dispatchBreakdown: FairDispatchBreakdown;
  amountInr: number;
  workerShareInr: number; // 90%
  welfareShareInr: number; // 10%
  priceBreakdown?: PriceBreakdown;
  isPriceEstimate?: boolean;
  priceRevision?: PriceRevisionProposal;
  disputeId?: string;
  disputeStatus?: DisputeStatus;
  bulkBookingId?: string;
  bulkUnitNumber?: string;
  // Feature 1: Collaboration Request
  hasCollaboration?: boolean;
  collaborationId?: string;
  // Feature 3: Worker Time Protection
  cancellationProtected?: boolean;
  timeProtectionId?: string;
  arrivalConfirmedAt?: string;
  cancellationReasonNote?: string;
  // Feature 4: Spare Parts Estimate
  hasSparePartsEstimate?: boolean;
  sparePartsEstimateId?: string;
  // Feature: Problem Report, Media & Gemma 4 AI Analysis
  hasProblemReport?: boolean;
  problemReportId?: string;
  // New Gemma 4 Feature: AI Complaint-to-Action
  hasComplaintToAction?: boolean;
  complaintToActionId?: string;
  // New Gemma 4 Feature: AI Repair Report
  hasRepairReport?: boolean;
  repairReportId?: string;
  // New Gemma 4 Feature: AI Booking Requirement Gap Answers
  bookingGapAnalysisId?: string;
  requirementAnswers?: Record<string, string>;
  // Feature: Worker Offline Job Notes & Auto-Sync
  hasJobNotes?: boolean;
  jobNotesCount?: number;
  // Feature 6: Safe Visit Status
  safeVisitStatus?: 'NOT_CHECKED_IN' | 'ARRIVAL_CHECKIN' | 'WORK_STARTED' | 'WORK_COMPLETED' | 'REQUEST_ASSISTANCE';
  safeVisitLastUpdated?: string;
  paymentStatus: 'UNPAID' | 'PAYMENT_PENDING' | 'ORDER_CREATED' | 'PAYMENT_PROCESSING' | 'PAID' | 'PAID_BY_CASH' | 'PAID_VIA_UPI' | 'PAYMENT_FAILED' | 'FAILED';
  paymentMethod?: 'UPI' | 'CASH' | string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  settledAt?: string;
  finalSettlementAmountInr?: number;
  estimatedAmountInr?: number;
  // Worker Rating & Review
  rating?: number;
  review?: string;
  isRated?: boolean;
  ratedAt?: string;
  // Real-time worker GPS tracking
  liveWorkerLocation?: Coordinates & {
    updatedAt: string;
    isLive: boolean;
    accuracy?: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// FEATURE 1: WORKER-TO-WORKER HELP NETWORK
// ==========================================
export type CollaborationStatus =
  | 'HELP_REQUESTED'
  | 'WORKER_FOUND'
  | 'COLLABORATION_STARTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CollaborationRequest {
  id: string;
  bookingId: string;
  bookingReference: string;
  initiatorWorkerId: string;
  initiatorWorkerName: string;
  initiatorWorkerPhone: string;
  serviceCategory: SupportedServiceCategory;
  requiredSkill: string;
  suggestedSkills: string[];
  jobLocationArea: string; // Neighborhood or service zone only (privacy protected)
  expectedDurationHours: number;
  jobSummary: string;
  notes?: string;
  status: CollaborationStatus;
  partnerWorkerId?: string;
  partnerWorkerName?: string;
  partnerWorkerPhone?: string;
  partnerWorkerCategory?: SupportedServiceCategory;
  isSimulatedDemo: true;
  createdAt: string;
  updatedAt: string;
}

// ========================================================
// FEATURE 2: FAIR JOB ALLOCATION ASSISTANT (GEMMA 4)
// ========================================================
export interface AllocationFeedbackRecord {
  id: string;
  workerId: string;
  workerName: string;
  bookingId?: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: 'ADMIN' | 'WORKER';
  ratingHelpful: boolean;
  comment?: string;
  createdAt: string;
}

// ==========================================
// FEATURE 3: WORKER TIME PROTECTION
// ==========================================
export type CancellationProtectionReason =
  | 'CUSTOMER_NO_SHOW'
  | 'CANCELLED_AFTER_ARRIVAL'
  | 'JOB_MISMATCH_SITE_UNREADY'
  | 'CUSTOMER_CANCELLED_LATE'
  | 'OTHER';

export interface TimeProtectionRecord {
  id: string;
  bookingId: string;
  bookingReference: string;
  workerId: string;
  workerName: string;
  arrivalConfirmedAt?: string;
  cancellationRecordedAt: string;
  reason: CancellationProtectionReason;
  reasonDetails?: string;
  travelDistanceKm: number;
  travelCostInr: number;
  wastedTimeMinutes: number;
  timeCostInr: number;
  estimatedDemoCompensationInr: number;
  ruleBreakdown: string;
  isDemoEstimate: true;
  status: 'RECORDED' | 'REVIEWED';
  createdAt: string;
}

// =====================================================
// FEATURE 4: SMART SPARE PARTS ESTIMATOR (GEMMA 4)
// =====================================================
export interface SparePartItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedUnitPriceInr: number;
  totalPriceInr: number;
  isCustomAdded?: boolean;
}

export interface SparePartsEstimateRecord {
  id: string;
  bookingId: string;
  bookingReference: string;
  workerId: string;
  workerName: string;
  serviceCategory: SupportedServiceCategory;
  items: SparePartItem[];
  totalMaterialsInr: number;
  laborChargeInr: number;
  totalEstimatedInr: number;
  customerApprovalStatus: 'DRAFT_ESTIMATE' | 'SUBMITTED_TO_CUSTOMER' | 'CUSTOMER_APPROVED' | 'CUSTOMER_DECLINED';
  workerNotes?: string;
  customerFeedback?: string;
  aiModelUsed: string;
  isDemoEstimate: true;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// FEATURE 5: WORKER COOPERATIVE VOTING
// ==========================================
export type CoopProposalCategory =
  | 'TRAINING'
  | 'WELFARE_POLICY'
  | 'COOP_RULES'
  | 'SAFETY_EQUIPMENT';

export interface CoopProposal {
  id: string;
  title: string;
  description: string;
  category: CoopProposalCategory;
  proposedByWorkerId: string;
  proposedByWorkerName: string;
  status: 'ACTIVE' | 'CLOSED';
  upvotes: number;
  downvotes: number;
  votes: Record<string, 'FOR' | 'AGAINST'>; // workerId -> vote
  isDemoVoting: true;
  createdAt: string;
}

// ==========================================
// FEATURE 6: SAFE VISIT CHECK-IN
// ==========================================
export type SafeVisitAction =
  | 'ARRIVAL_CHECKIN'
  | 'WORK_STARTED'
  | 'WORK_COMPLETED'
  | 'REQUEST_ASSISTANCE';

export interface SafeVisitLogRecord {
  id: string;
  bookingId: string;
  bookingReference: string;
  workerId: string;
  workerName: string;
  lastAction: SafeVisitAction;
  actionTimestamp: string;
  sharedContactName?: string;
  sharedContactPhone?: string;
  safetyNote?: string;
  manualReminderMinutes?: number;
  isAssistanceFlagged: boolean;
  history: Array<{
    action: SafeVisitAction;
    timestamp: string;
    note?: string;
  }>;
}


export interface EmergencyAlert {
  id: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  bookingId?: string;
  bookingReference?: string;
  timestamp: string;
  status: 'ACTIVE_DEMO' | 'CANCELLED_FALSE_ALARM' | 'RESOLVED';
  locationShared: boolean;
  coordinates?: Coordinates;
  cancellationReason?: string;
  cancelledAt?: string;
  isDemoSimulation: true;
}

export interface HouseholdUnit {
  unitId: string;
  flatNumber: string;
  residentName: string;
  residentPhone: string;
  status: BookingStatus;
  notes?: string;
}

export interface CommunityBulkBooking {
  id: string;
  bulkReference: string;
  representativeId: string;
  representativeName: string;
  representativePhone: string;
  societyName: string;
  serviceCategory: SupportedServiceCategory;
  preferredDate: string;
  preferredTimeSlot: ShiftPreference;
  householdCount: number;
  households: HouseholdUnit[];
  perHouseholdPriceInr: number;
  totalPriceInr: number;
  discountPercent: number;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  status: 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  isSampleDemo?: boolean;
}

export type DisputeCategory =
  | 'PAYMENT_ISSUE'
  | 'INCOMPLETE_WORK'
  | 'PRICING_DISAGREEMENT'
  | 'BEHAVIOR_ISSUE'
  | 'OTHER';

export type DisputeStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface DisputeRecord {
  id: string;
  complaintReference: string;
  bookingId: string;
  bookingReference: string;
  filedByUserId: string;
  filedByName: string;
  filedByRole: 'CUSTOMER' | 'WORKER';
  category: DisputeCategory;
  description: string;
  evidenceNote?: string;
  status: DisputeStatus;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type WelfareBenefitCategory =
  | 'TRAINING_SUPPORT'
  | 'EMERGENCY_ASSISTANCE'
  | 'EQUIPMENT_SUPPORT';

export interface WelfareRequest {
  id: string;
  workerId: string;
  workerName: string;
  benefitCategory: WelfareBenefitCategory;
  requestedAmountInr: number;
  reason: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DISBURSED_DEMO' | 'REJECTED';
  reviewNote?: string;
  submittedAt: string;
  updatedAt: string;
  isDemoSimulation: true;
}

export interface WelfareLedgerEntry {
  id: string;
  bookingId: string;
  bookingReference: string;
  workerId: string;
  workerName: string;
  customerName: string;
  grossAmountInr: number;
  workerNetInr: number; // Configurable worker share
  welfareContributionInr: number; // Configurable cooperative fund contribution
  workerSharePercent?: number;
  isDemo?: boolean;
  serviceCategory?: SupportedServiceCategory;
  paymentId: string;
  paymentMode: 'RAZORPAY_SANDBOX' | 'COOPERATIVE_TEST_VERIFIED' | string;
  timestamp: string;
}

export interface DemandForecastPoint {
  date: string;
  dayLabel: string;
  actualHistoricalBookings: number | null;
  baselineSampleBookings: number;
  predictedDemand: number;
  topCategory: SupportedServiceCategory;
}

export interface ZoneDemandSummary {
  zone: string;
  electrician: number;
  plumber: number;
  carpenter: number;
  painter: number;
  cleaner: number;
  babysitter: number;
  totalProjected: number;
}

export interface DemandForecastResponse {
  zone: string;
  days: number;
  generatedAt: string;
  modelUsed: string;
  isLiveAiForecast: boolean;
  dataNotice: string;
  dailyForecast: DemandForecastPoint[];
  zoneBreakdown: ZoneDemandSummary[];
}

// ========================================================
// REAL PROBLEM REPORTING, CLOUDINARY MEDIA & GEMMA 4 AI ANALYSIS
// ========================================================
export type ProblemReportStatus =
  | 'Submitted'
  | 'Analysis In Progress'
  | 'Analysis Ready'
  | 'Worker Notified'
  | 'Problem Viewed'
  | 'Preparation Complete'
  | 'Work Started'
  | 'Work In Progress'
  | 'Work Completed';

export interface MediaMetadata {
  id: string;
  publicId: string;
  secureUrl: string;
  resourceType: 'image' | 'video';
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  originalFilename: string;
  storageProvider: 'CLOUDINARY' | 'LOCAL_SECURE';
  uploadedAt: string;
}

export interface ValidatedRepairPart {
  id: string;
  name: string;
  category: SupportedServiceCategory;
  fixedPriceInr: number;
  unit: string;
  quantity: number;
  totalPriceInr: number;
}

export interface RepairPriceEstimate {
  baseLaborInr: number;
  materialsTotalInr: number;
  urgencySurchargeInr: number;
  minEstimatedTotalInr: number;
  maxEstimatedTotalInr: number;
  workerShareMinInr: number;
  workerShareMaxInr: number;
  welfareShareMinInr: number;
  welfareShareMaxInr: number;
  pricingRuleExplanation: string;
}

export interface GemmaProblemAnalysis {
  id: string;
  reportId: string;
  modelUsed: string;
  generatedAt: string;
  isRealAi: boolean;
  summary: string;
  summaryRegional?: string;
  gemmaSaw?: string;
  gemmaSawRegional?: string;
  clarificationQuestions?: string[];
  possibleCauses: string[];
  recommendedInspectionSteps: string[];
  suggestedTools: string[];
  suggestedSpareParts: string[];
  validatedParts?: ValidatedRepairPart[];
  repairEstimate?: RepairPriceEstimate;
  safetyPrecautions: string[];
  safetyPrecautionsRegional?: string[];
  workerPreVerification: string[];
  uncertaintyNote: string;
}

export interface ProblemReport {
  id: string;
  bookingId: string;
  bookingReference: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  assignedWorkerId: string;
  assignedWorkerName: string;
  serviceCategory: SupportedServiceCategory;
  problemDescription: string;
  urgency: 'STANDARD' | 'PRIORITY' | 'EMERGENCY';
  media?: MediaMetadata;
  aiAnalysis?: GemmaProblemAnalysis;
  aiAnalysisStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE';
  aiAnalysisError?: string;
  status: ProblemReportStatus;
  statusHistory: {
    status: ProblemReportStatus;
    updatedBy: string;
    updatedByRole: 'CUSTOMER' | 'WORKER' | 'SYSTEM' | 'ADMIN';
    timestamp: string;
    note?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

// ========================================================
// WORKER OFFLINE JOB NOTES & AUTOMATIC RECONNECTION SYNC
// ========================================================
export type JobNoteCategory =
  | 'General'
  | 'Site Inspection'
  | 'Parts & Materials'
  | 'Customer Instruction'
  | 'Work Progress'
  | 'Follow-up Required';

export interface JobNote {
  id: string;
  bookingId: string;
  bookingReference: string;
  workerId: string;
  workerName: string;
  noteText: string;
  category: JobNoteCategory;
  isOfflineCreated: boolean;
  synced: boolean;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// GEMMA 4 NEW FEATURE 1: AI COMPLAINT-TO-ACTION CONVERTER
// ============================================================================
// GEMMA 4 NEW FEATURE 1: AI COMPLAINT-TO-ACTION CONVERTER
// ============================================================================
export interface ComplaintCorrection {
  correctedBy: string;
  correctedByRole: 'CUSTOMER' | 'WORKER';
  correctedAt: string;
  correctedSummary?: string;
  correctedActionItems?: string[];
  notes?: string;
}

export interface ComplaintToActionRecord {
  id: string;
  bookingId?: string;
  bookingReference?: string;
  customerId?: string;
  customerName?: string;
  workerId?: string;
  workerName?: string;
  workerPreferredLanguage: 'en' | 'bn' | 'hi';
  originalComplaint: string;
  complaintLanguage?: string;
  problemSummary: string;
  structuredProblemSummary?: string;
  translatedSummaryForWorker: string;
  translatedProblemSummary?: string;
  suggestedActionItems: string[];
  suggestedActionItemsForWorker?: string[];
  missingInformation: string[];
  missingInformationBeforeStart?: string[];
  customerFollowUpQuestions: string[];
  followUpQuestionsForCustomer?: string[];
  customerFacts: string[];
  customerStatedFacts?: string[];
  aiSuggestions: string[];
  aiTechnicalSuggestions?: string[];
  // Intelligent Worker Assistance features
  safetyReminders?: string[];
  preparationChecklist?: string[];
  unfamiliarTermsGlossary?: Array<{ term: string; explanation: string }>;
  clarifyingQuestionsBeforeAccepting?: string[];
  corrections?: ComplaintCorrection;
  isCorrected?: boolean;
  correctedByRole?: string;
  modelUsed: string;
  isLiveAi: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PolishCompletionNoteResult {
  polishedNote: string;
  translatedNoteForCustomer?: string;
  safetyCheckCompleted: string[];
  partsMentioned: string[];
  modelUsed: string;
  isLiveAi: boolean;
}

export interface AdminOperationalSummary {
  generatedAt: string;
  totalBookings: number;
  completedBookings: number;
  activeWorkers: number;
  topRequestedCategory: string;
  pendingDisputesCount: number;
  executiveSummary: string;
  recurringIssues: string[];
  demandObservations: string[];
  actionableRecommendations: string[];
  dataLimitationsNotice: string;
  modelUsed: string;
  isLiveAi: boolean;
}

// ============================================================================
// GEMMA 4 NEW FEATURE 2: AI SERVICE CATEGORY AUTO-CLASSIFIER
// ============================================================================
export interface CategoryClassificationResult {
  suggestedCategory: SupportedServiceCategory;
  suggestedSubcategory: string;
  confidenceScore: number; // 0 - 1 or 0 - 100
  reason: string;
  reasoning?: string;
  uncertaintyNote: string;
  physicalUncertaintyNote?: string;
  isConfident: boolean;
  modelUsed: string;
  isLiveAi: boolean;
}

// ============================================================================
// GEMMA 4 NEW FEATURE 3: AI REPAIR REPORT GENERATOR
// ============================================================================
export interface RepairReportPart {
  name?: string;
  partName?: string;
  quantity: number;
  costInr?: number;
  confirmed?: boolean;
  confirmedByCustomer?: boolean;
}

export interface RepairReportRecord {
  id: string;
  bookingId: string;
  bookingReference: string;
  customerId?: string;
  customerName?: string;
  workerId?: string;
  workerName?: string;
  serviceCategory?: SupportedServiceCategory;
  reportTitle: string;
  originalReportedProblem: string;
  workPerformed: string[];
  partsUsed: RepairReportPart[];
  outstandingIssues: string | null;
  maintenanceSuggestions?: string[];
  preventiveMaintenanceSuggestions?: string[];
  customerSummary: string;
  editedByWorker?: boolean;
  workerApproved?: boolean;
  workerApprovedAt?: string;
  modelUsed: string;
  isLiveAi: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// GEMMA 4 NEW FEATURE 4: AI BOOKING REQUIREMENT GAP FINDER
// ============================================================================
export interface BookingRequirementQuestion {
  id: string;
  fieldKey?: string;
  question: string;
  category: 'MANDATORY' | 'OPTIONAL' | string;
  reason: string;
  placeholder?: string;
  isMandatory?: boolean;
  customerAnswer?: string;
  currentAnswer?: string;
  isAnswered?: boolean;
}

export interface BookingGapAnalysisResult {
  id: string;
  bookingId?: string;
  serviceCategory: SupportedServiceCategory | string;
  isEmergency: boolean;
  missingQuestions: BookingRequirementQuestion[];
  recommendedQuestions?: BookingRequirementQuestion[];
  confirmedInformation?: string[];
  completenessScore: number; // 0 - 100
  modelUsed: string;
  isLiveAi: boolean;
  createdAt: string;
}

// ============================================================================
// GEMMA 4 NEW FEATURE 5: AI COOPERATIVE RULE EXPLAINER
// ============================================================================
export interface CoopPolicyExplanationResult {
  question: string;
  answer: string;
  explanation?: string;
  policyReferences?: string[];
  relevantPolicyCitations?: string[];
  verifiedFigures: string[] | Record<string, string | number>;
  isPolicyFound: boolean;
  adminContactNote?: string;
  contactAdminRecommendation?: string;
  modelUsed: string;
  isLiveAi: boolean;
  timestamp: string;
}

// ============================================================================
// GEMMA 4 E4B FEATURE 1: WORKER DIGITAL PASSPORT
// ============================================================================
export interface VerifiedSkillItem {
  skill: string;
  level: 'CERTIFIED' | 'PROFICIENT' | 'MASTER';
  verifiedByCoop: boolean;
  evidenceNote?: string;
}

export interface WorkerDigitalPassport {
  id: string;
  workerId: string;
  workerName: string;
  category: SupportedServiceCategory;
  verified: boolean;
  kycStatus: string;
  totalCompletedJobs: number;
  averageRating: number;
  reviewCount: number;
  executiveSummary: string;
  verifiedSkillsBreakdown: VerifiedSkillItem[];
  completedJobsSummary: {
    totalVolume: number;
    specializedTasksCount: number;
    punctualityRate: string;
    topServiceTypes: string[];
  };
  cooperativeStanding: {
    membershipStatus: string;
    welfareContributionInr: number;
    fairSettlementRatio: string;
  };
  careerMilestoneAdvice: string[];
  dataIntegrityNotice: string;
  modelUsed: string;
  generatedAt: string;
}

// ============================================================================
// GEMMA 4 E4B FEATURE 2: FAIR DISPUTE ORGANIZER
// ============================================================================
export interface FairDisputeTimelineEvent {
  timestamp: string;
  stage: string;
  recordedFact: string;
}

export interface FairDisputeRemedy {
  remedyTitle: string;
  description: string;
  groundedInBylaws: string;
}

export interface FairDisputeDossier {
  id: string;
  bookingId: string;
  bookingReference: string;
  category: SupportedServiceCategory;
  impartialSummary: string;
  timeline: FairDisputeTimelineEvent[];
  customerPerspective: {
    reportedIssue: string;
    feedbackRating?: number;
    reviewComment?: string;
  };
  workerPerspective: {
    workerName: string;
    recordedNotesCount: number;
    onSiteObservations: string[];
  };
  commonGroundFacts: string[];
  proposedCooperativeRemedies: FairDisputeRemedy[];
  dataAuditNotice: string;
  modelUsed: string;
  generatedAt: string;
}

// ============================================================================
// GEMMA 4 E4B FEATURE 3: HOME MAINTENANCE MEMORY
// ============================================================================
export interface PastRepairRecord {
  bookingReference: string;
  date: string;
  category: SupportedServiceCategory;
  technicianName: string;
  resolvedProblem: string;
  partsUsedOrEstimated?: string[];
}

export interface MaintenanceFollowUp {
  componentOrFixture: string;
  suggestedInspectionDate: string;
  urgencyReason: string;
  recommendedTrade: SupportedServiceCategory;
}

export interface HomeMaintenanceMemory {
  id: string;
  customerId: string;
  customerName: string;
  totalCompletedRepairs: number;
  householdHealthAssessment: string;
  serviceHistorySummary: string;
  completedRepairs: PastRepairRecord[];
  proactiveFollowUps: MaintenanceFollowUp[];
  seasonalHomeCareTips: string[];
  dataIntegrityNotice: string;
  modelUsed: string;
  generatedAt: string;
}

// ============================================================================
// GEMMA 4 E4B FEATURE 4: COOPERATIVE INTELLIGENCE
// ============================================================================
export interface PopularServiceRankItem {
  rank: number;
  category: SupportedServiceCategory;
  bookingCount: number;
  percentage: number;
  trendCommentary: string;
}

export interface GeographicDemandHotspot {
  zoneOrSector: string;
  demandVolume: number;
  topCategoryNeeded: string;
  comment: string;
}

export interface CooperativeIntelligenceReport {
  id: string;
  generatedAt: string;
  totalBookingsAnalyzed: number;
  totalActiveWorkers: number;
  popularServicesRanking: PopularServiceRankItem[];
  geographicDemandHotspots: GeographicDemandHotspot[];
  fairDispatchHealth: {
    fairnessStatus: string;
    workerPayoutTotalInr: number;
    welfareFundContributionInr: number;
    utilizationBalanceComment: string;
  };
  strategicCooperativeActionItems: string[];
  dataIntegrityNotice: string;
  modelUsed: string;
}

// ============================================================================
// GEMMA 4 E4B FEATURE 5: CUSTOMER RATING INSIGHTS
// ============================================================================
export interface CustomerRatingInsights {
  id: string;
  workerId: string;
  workerName: string;
  category: SupportedServiceCategory;
  averageRating: number;
  totalReviewsAnalyzed: number;
  customerSentimentSummary: string;
  highlightedStrengths: string[];
  actionableImprovementSuggestions: string[];
  tradeExcellenceChecklist: string[];
  sampleSizeLimitationNote?: string;
  dataIntegrityNotice: string;
  modelUsed?: string;
  generatedAt: string;
}

export interface CustomerRecord extends UserAccount {
  totalBookings: number;
  completedBookings: number;
  totalSpentInr: number;
}

export interface CooperativeSettings {
  cooperativeName: string;
  workerSplitPercent: number;
  welfareSplitPercent: number;
  emergencyHotline: string;
  minimumBaseRateInr: number;
  activeServiceZones: string[];
  governanceMeetingSchedule: string;
}
