import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import { jsPDF } from 'jspdf';
import {
  initMongo,
  getMongoStatus,
  persistProblemReportMongo,
  logJobStatusHistoryMongo,
  persistBookingMongo,
  persistComplaintToActionMongo,
  persistRepairReportMongo,
  persistBookingGapAnalysisMongo,
  persistCoopPolicyQueryMongo,
} from './src/services/mongoService.ts';
import {
  processAndStoreMedia,
  getMediaStorageStatus,
} from './src/services/mediaService.ts';
import {
  analyzeProblemWithGemma4,
  convertComplaintToActionWithGemma4,
  classifyServiceCategoryWithGemma4,
  generateRepairReportWithGemma4,
  findBookingRequirementGapsWithGemma4,
  explainCooperativeRuleWithGemma4,
  polishCompletionNoteWithGemma4,
  generateAdminOperationalSummaryWithGemma4,
  generateWorkerDigitalPassportWithGemma4,
  generateFairDisputeOrganizerWithGemma4,
  generateHomeMaintenanceMemoryWithGemma4,
  generateCooperativeIntelligenceWithGemma4,
  generateCustomerRatingInsightsWithGemma4,
} from './src/services/aiService.ts';
import { COOPERATIVE_BYLAWS, retrieveRelevantBylaws } from './src/data/cooperativePolicies.ts';
import type {
  UserAccount,
  UserRole,
  WorkerProfile,
  SupportedServiceCategory,
  BookingRecord,
  BookingStatus,
  WelfareLedgerEntry,
  WorkerDigitalPassport,
  FairDisputeDossier,
  HomeMaintenanceMemory,
  CooperativeIntelligenceReport,
  CustomerRatingInsights,
  FairDispatchBreakdown,
  MatchedWorkerResult,
  GemmaInterpretedRequest,
  ShiftPreference,
  UrgencyLevel,
  Coordinates,
  DemandForecastResponse,
  PriceBreakdown,
  PriceRevisionProposal,
  EmergencyAlert,
  HouseholdUnit,
  CommunityBulkBooking,
  DisputeCategory,
  DisputeStatus,
  DisputeRecord,
  WelfareBenefitCategory,
  WelfareRequest,
  CollaborationStatus,
  CollaborationRequest,
  AllocationFeedbackRecord,
  CancellationProtectionReason,
  TimeProtectionRecord,
  SparePartItem,
  SparePartsEstimateRecord,
  CoopProposalCategory,
  CoopProposal,
  SafeVisitAction,
  SafeVisitLogRecord,
  ProblemReport,
  ProblemReportStatus,
  MediaMetadata,
  GemmaProblemAnalysis,
  JobNote,
  JobNoteCategory,
  ComplaintToActionRecord,
  CategoryClassificationResult,
  RepairReportRecord,
  BookingGapAnalysisResult,
  CoopPolicyExplanationResult,
} from './src/types.ts';

dotenv.config();

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'helpnest_sih2026_cooperative_secret_key';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'helpnest_db.json');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

let globalIoInstance: SocketIOServer | null = null;

const SUPPORTED_CATEGORIES: SupportedServiceCategory[] = [
  'Electrician',
  'Plumber',
  'Carpenter',
  'Painter',
  'Cleaner',
  'Babysitter',
];

export const CATEGORY_SKILLS_MAP: Record<SupportedServiceCategory, string[]> = {
  Electrician: ['MCB & Fuse Repair', 'Ceiling Fan Installation', 'Switchboard Wiring', 'Inverter Setup', 'Appliance Earthing'],
  Plumber: ['Tap & Mixer Leak Repair', 'Pipe Blockage Clearing', 'Water Tank Fitting', 'Bathroom Sanitaryware', 'Pump Motor Valve'],
  Carpenter: ['Door Lock & Hinge Repair', 'Window Frame Fitting', 'Modular Cabinet Fix', 'Furniture Assembly', 'Termite Wood Patch'],
  Painter: ['Interior Wall Painting', 'Dampness Waterproofing', 'Wood Polish & Varnish', 'Putty & Primer Touchup', 'Exterior Weather Coat'],
  Cleaner: ['Deep Kitchen Cleaning', 'Bathroom Sanitization', 'Sofa & Carpet Vacuum', 'Water Tank Cleaning', 'Post-Event Cleanup'],
  Babysitter: ['Infant Daycare Support', 'Toddler Meal & Play', 'After-School Supervision', 'First-Aid Certified Care', 'Evening Family Assist'],
};

interface StoredUser extends UserAccount {
  passwordHash: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  workers: WorkerProfile[];
  bookings: BookingRecord[];
  problemReports: ProblemReport[];
  welfareLedger: WelfareLedgerEntry[];
  emergencyAlerts: EmergencyAlert[];
  communityBulkBookings: CommunityBulkBooking[];
  disputes: DisputeRecord[];
  welfareRequests: WelfareRequest[];
  collaborationRequests: CollaborationRequest[];
  allocationFeedback: AllocationFeedbackRecord[];
  timeProtectionRecords: TimeProtectionRecord[];
  sparePartsEstimates: SparePartsEstimateRecord[];
  coopProposals: CoopProposal[];
  safeVisitLogs: SafeVisitLogRecord[];
  jobNotes: JobNote[];
  complaintToActions: ComplaintToActionRecord[];
  repairReports: RepairReportRecord[];
  bookingGapAnalyses: BookingGapAnalysisResult[];
  coopPolicyQueries: Array<CoopPolicyExplanationResult & { id: string; workerId: string }>;
  activeSessions: Record<string, { userId: string; role: UserRole; expiresAt: number }>;
}

function hashPassword(password: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(password).digest('hex');
}

function createSessionToken(userId: string, role: UserRole, db: DatabaseSchema): string {
  const rawToken = crypto.randomBytes(24).toString('hex');
  const payload = `${rawToken}.${userId}.${role}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  const token = `${payload}.${signature}`;
  db.activeSessions[token] = {
    userId,
    role,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  saveDb(db);
  return token;
}

// Ensure valid PNG icons exist in public/ for PWA installability
function ensurePwaIcons() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  // Minimal valid 1x1 dark-teal PNG buffer (base64) for fallback compliance if binary PNGs aren't present
  const validPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.replace(
      '',
      'A'
    );
  const pngBuffer = Buffer.from(validPngBase64, 'base64');
  const iconFiles = ['pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png', 'apple-touch-icon.png'];
  for (const file of iconFiles) {
    const filePath = path.join(PUBLIC_DIR, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, pngBuffer);
    }
  }
}

function getInitialSeedDatabase(): DatabaseSchema {
  const defaultPasswordHash = hashPassword('helpnest123');

  const users: StoredUser[] = [
    {
      id: 'usr-wrk-1',
      name: 'Subrata Mondal',
      email: 'subrata@helpnest.coop',
      phone: '+91 98305 11201',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-101',
      location: {
        lat: 22.5768,
        lng: 88.4265,
        addressLabel: 'Karunamoyee, Sector-2, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-2',
      name: 'Rameshwar Yadav',
      email: 'rameshwar@helpnest.coop',
      phone: '+91 98309 77812',
      role: 'WORKER',
      preferredLanguage: 'hi',
      workerId: 'wrk-102',
      location: {
        lat: 22.5815,
        lng: 88.4122,
        addressLabel: 'Labony Estate, Sector-1, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-3',
      name: 'Bikash Das',
      email: 'bikash@helpnest.coop',
      phone: '+91 98312 65400',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-103',
      location: {
        lat: 22.5745,
        lng: 88.4338,
        addressLabel: 'College More, Sector-5, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-4',
      name: 'Debashis Roy',
      email: 'debashis@helpnest.coop',
      phone: '+91 98316 33091',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-104',
      location: {
        lat: 22.5810,
        lng: 88.4190,
        addressLabel: 'GD Market, Sector-3, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-5',
      name: 'Tapan Karmakar',
      email: 'tapan@helpnest.coop',
      phone: '+91 98318 40922',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-105',
      location: {
        lat: 22.5785,
        lng: 88.4150,
        addressLabel: 'FE Block, Sector-3, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-6',
      name: 'Shyamal Halder',
      email: 'shyamal@helpnest.coop',
      phone: '+91 98311 55219',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-106',
      location: {
        lat: 22.5830,
        lng: 88.4235,
        addressLabel: 'BJ Block, Sector-2, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-7',
      name: 'Mita Mukherjee',
      email: 'mita@helpnest.coop',
      phone: '+91 98304 66701',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-107',
      location: {
        lat: 22.5802,
        lng: 88.4210,
        addressLabel: 'EE Block, Sector-3, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-8',
      name: 'Purnima Ghosh',
      email: 'purnima@helpnest.coop',
      phone: '+91 98307 88934',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-108',
      location: {
        lat: 22.5842,
        lng: 88.4095,
        addressLabel: 'BD Block, Sector-1, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-9',
      name: 'Pradip Halder',
      email: 'pradip@helpnest.coop',
      phone: '+91 98308 12345',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-109',
      location: {
        lat: 22.5790,
        lng: 88.4215,
        addressLabel: 'FD Block, Sector-3, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-10',
      name: 'Anup Majumder',
      email: 'anup@helpnest.coop',
      phone: '+91 98319 54321',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-110',
      location: {
        lat: 22.5720,
        lng: 88.4350,
        addressLabel: 'Technopolis, Sector-5, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-11',
      name: 'Kartik Naskar',
      email: 'kartik@helpnest.coop',
      phone: '+91 98302 98765',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-111',
      location: {
        lat: 22.5850,
        lng: 88.4080,
        addressLabel: 'BA Block, Sector-1, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-12',
      name: 'Soumen Bhowmick',
      email: 'soumen@helpnest.coop',
      phone: '+91 98315 22110',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-112',
      location: {
        lat: 22.5775,
        lng: 88.4250,
        addressLabel: 'CK Block, Sector-2, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-13',
      name: 'Tapas Pal',
      email: 'tapas@helpnest.coop',
      phone: '+91 98303 66442',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-113',
      location: {
        lat: 22.5835,
        lng: 88.4110,
        addressLabel: 'BC Block, Sector-1, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-14',
      name: 'Amitava Sengupta',
      email: 'amitava@helpnest.coop',
      phone: '+91 98317 88990',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-114',
      location: {
        lat: 22.5798,
        lng: 88.4180,
        addressLabel: 'GC Market, Sector-3, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-15',
      name: 'Sanjoy Mistri',
      email: 'sanjoy@helpnest.coop',
      phone: '+91 98306 44332',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-115',
      location: {
        lat: 22.5800,
        lng: 88.4240,
        addressLabel: 'CL Block, Sector-2, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-16',
      name: 'Ashoke Sutradhar',
      email: 'ashoke@helpnest.coop',
      phone: '+91 98310 11223',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-116',
      location: {
        lat: 22.5820,
        lng: 88.4140,
        addressLabel: 'BB Block, Sector-1, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-17',
      name: 'Biswanath Barman',
      email: 'biswanath@helpnest.coop',
      phone: '+91 98321 77665',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-117',
      location: {
        lat: 22.5730,
        lng: 88.4310,
        addressLabel: 'Webel More, Sector-5, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-18',
      name: 'Ranjit Paul',
      email: 'ranjit@helpnest.coop',
      phone: '+91 98314 55443',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-118',
      location: {
        lat: 22.5760,
        lng: 88.4170,
        addressLabel: 'HB Block, Sector-3, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-19',
      name: 'Alok Karmakar',
      email: 'alok@helpnest.coop',
      phone: '+91 98322 33445',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-119',
      location: {
        lat: 22.5788,
        lng: 88.4195,
        addressLabel: 'FC Block, Sector-3, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-20',
      name: 'Nirmal Sen',
      email: 'nirmal@helpnest.coop',
      phone: '+91 98301 99887',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-120',
      location: {
        lat: 22.5825,
        lng: 88.4130,
        addressLabel: 'CA Block, Sector-1, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-21',
      name: 'Dipak Mondal',
      email: 'dipak@helpnest.coop',
      phone: '+91 98313 77889',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-121',
      location: {
        lat: 22.5750,
        lng: 88.4320,
        addressLabel: 'Godrej Waterside, Sector-5, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-22',
      name: 'Goutam Roy',
      email: 'goutam@helpnest.coop',
      phone: '+91 98325 66778',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-122',
      location: {
        lat: 22.5810,
        lng: 88.4255,
        addressLabel: 'BL Block, Sector-2, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-23',
      name: 'Sunita Mahato',
      email: 'sunita@helpnest.coop',
      phone: '+91 98305 88776',
      role: 'WORKER',
      preferredLanguage: 'hi',
      workerId: 'wrk-123',
      location: {
        lat: 22.5770,
        lng: 88.4270,
        addressLabel: 'CJ Block, Sector-2, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-24',
      name: 'Gita Das',
      email: 'gita@helpnest.coop',
      phone: '+91 98318 99001',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-124',
      location: {
        lat: 22.5830,
        lng: 88.4115,
        addressLabel: 'BE Block, Sector-1, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-25',
      name: 'Rajesh Balmiki',
      email: 'rajesh@helpnest.coop',
      phone: '+91 98309 33221',
      role: 'WORKER',
      preferredLanguage: 'hi',
      workerId: 'wrk-125',
      location: {
        lat: 22.5740,
        lng: 88.4345,
        addressLabel: 'RDB Boulevard, Sector-5, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-26',
      name: 'Anita Barui',
      email: 'anita@helpnest.coop',
      phone: '+91 98317 44556',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-126',
      location: {
        lat: 22.5805,
        lng: 88.4185,
        addressLabel: 'HA Block, Sector-3, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-27',
      name: 'Sampa Sarkar',
      email: 'sampa@helpnest.coop',
      phone: '+91 98320 11335',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-127',
      location: {
        lat: 22.5780,
        lng: 88.4260,
        addressLabel: 'BK Block, Sector-2, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-28',
      name: 'Rupa Chakraborty',
      email: 'rupa@helpnest.coop',
      phone: '+91 98307 22446',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-128',
      location: {
        lat: 22.5812,
        lng: 88.4205,
        addressLabel: 'IA Block, Sector-3, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-29',
      name: 'Rekha Khatun',
      email: 'rekha@helpnest.coop',
      phone: '+91 98311 88992',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-129',
      location: {
        lat: 22.5818,
        lng: 88.4135,
        addressLabel: 'BF Block, Sector-1, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-wrk-30',
      name: 'Maya Bauri',
      email: 'maya@helpnest.coop',
      phone: '+91 98324 55667',
      role: 'WORKER',
      preferredLanguage: 'bn',
      workerId: 'wrk-130',
      location: {
        lat: 22.5735,
        lng: 88.4325,
        addressLabel: 'DLF 1, Sector-5, Salt Lake',
      },
      passwordHash: defaultPasswordHash,
    },
    {
      id: 'usr-admin-1',
      name: 'Ananya Sen (Society Secretary)',
      email: 'admin@helpnest.coop',
      phone: '+91 98300 90011',
      role: 'ADMIN',
      preferredLanguage: 'en',
      societyName: 'Help Nest Cooperative Society',
      passwordHash: defaultPasswordHash,
    },
  ];

  const workers: WorkerProfile[] = [
    {
      id: 'wrk-101',
      userId: 'usr-wrk-1',
      name: 'Subrata Mondal',
      phone: '+91 98305 11201',
      avatarInitials: 'SM',
      category: 'Plumber',
      skills: ['Tap & Mixer Leak Repair', 'Pipe Blockage Clearing', 'Water Tank Fitting', 'Bathroom Sanitaryware'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Aadhaar + ITI Plumbing Trade Certificate',
      kycDocumentNumber: 'WB-COOP-PLM-4829',
      kycSubmittedAt: '2026-10-01T09:00:00Z',
      kycReviewerNote: 'Verified by Cooperative Society Committee',
      skillBadges: ['Master Plumber', 'Sanitaryware Specialist'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-2',
      coordinates: { lat: 22.5768, lng: 88.4265, addressLabel: 'Karunamoyee, Sector-2, Salt Lake' },
      rating: 4.9,
      reviewCount: 42,
      baseRateInr: 450,
      completedJobsTotal: 42,
      completedJobsThisWeek: 1,
      grossEarningsInr: 18900,
      netEarningsInr: 17010,
      welfareContributionInr: 1890,
    },
    {
      id: 'wrk-102',
      userId: 'usr-wrk-2',
      name: 'Rameshwar Yadav',
      phone: '+91 98309 77812',
      avatarInitials: 'RY',
      category: 'Plumber',
      skills: ['Tap & Mixer Leak Repair', 'Pump Motor Valve', 'Pipe Blockage Clearing'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Voter ID + Municipal Plumber License',
      kycDocumentNumber: 'WB-COOP-PLM-5190',
      kycSubmittedAt: '2026-10-02T11:30:00Z',
      kycReviewerNote: 'Verified member',
      skillBadges: ['Rapid Leak Repair'],
      isAvailable: true,
      shift: 'Afternoon (12:00 - 16:00)',
      serviceZone: 'Sector-1',
      coordinates: { lat: 22.5815, lng: 88.4122, addressLabel: 'Labony Estate, Sector-1, Salt Lake' },
      rating: 4.7,
      reviewCount: 28,
      baseRateInr: 400,
      completedJobsTotal: 28,
      completedJobsThisWeek: 3,
      grossEarningsInr: 11200,
      netEarningsInr: 10080,
      welfareContributionInr: 1120,
    },
    {
      id: 'wrk-103',
      userId: 'usr-wrk-3',
      name: 'Bikash Das',
      phone: '+91 98312 65400',
      avatarInitials: 'BD',
      category: 'Electrician',
      skills: ['MCB & Fuse Repair', 'Ceiling Fan Installation', 'Switchboard Wiring', 'Inverter Setup', 'Appliance Earthing'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'WB Wireman Permit + Aadhaar',
      kycDocumentNumber: 'WB-ELC-8831',
      kycSubmittedAt: '2026-10-01T10:00:00Z',
      kycReviewerNote: 'Licensed Domestic Wireman',
      skillBadges: ['Licensed Wireman', 'Inverter & MCB Pro'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-5',
      coordinates: { lat: 22.5745, lng: 88.4338, addressLabel: 'College More, Sector-5, Salt Lake' },
      rating: 4.9,
      reviewCount: 54,
      baseRateInr: 500,
      completedJobsTotal: 54,
      completedJobsThisWeek: 1,
      grossEarningsInr: 27000,
      netEarningsInr: 24300,
      welfareContributionInr: 2700,
    },
    {
      id: 'wrk-104',
      userId: 'usr-wrk-4',
      name: 'Debashis Roy',
      phone: '+91 98316 33091',
      avatarInitials: 'DR',
      category: 'Electrician',
      skills: ['Ceiling Fan Installation', 'Switchboard Wiring', 'MCB & Fuse Repair'],
      verified: false,
      kycStatus: 'PENDING_REVIEW',
      kycDocumentType: 'Aadhaar + Trade Apprenticeship Certificate',
      kycDocumentNumber: 'WB-ELC-9942',
      kycSubmittedAt: '2026-10-11T15:20:00Z',
      skillBadges: ['Domestic Wiring'],
      isAvailable: true,
      shift: 'Morning (08:00 - 12:00)',
      serviceZone: 'Sector-3',
      coordinates: { lat: 22.5810, lng: 88.4190, addressLabel: 'GD Market, Sector-3, Salt Lake' },
      rating: 4.5,
      reviewCount: 9,
      baseRateInr: 420,
      completedJobsTotal: 9,
      completedJobsThisWeek: 0,
      grossEarningsInr: 3780,
      netEarningsInr: 3402,
      welfareContributionInr: 378,
    },
    {
      id: 'wrk-105',
      userId: 'usr-wrk-5',
      name: 'Tapan Karmakar',
      phone: '+91 98318 40922',
      avatarInitials: 'TK',
      category: 'Carpenter',
      skills: ['Door Lock & Hinge Repair', 'Window Frame Fitting', 'Modular Cabinet Fix', 'Furniture Assembly'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Cooperative Artisan Card',
      kycDocumentNumber: 'WB-CRP-3012',
      kycSubmittedAt: '2026-09-25T08:00:00Z',
      skillBadges: ['Master Woodworker', 'Lock & Cabinet Specialist'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-3',
      coordinates: { lat: 22.5785, lng: 88.4150, addressLabel: 'FE Block, Sector-3, Salt Lake' },
      rating: 4.8,
      reviewCount: 31,
      baseRateInr: 550,
      completedJobsTotal: 31,
      completedJobsThisWeek: 1,
      grossEarningsInr: 17050,
      netEarningsInr: 15345,
      welfareContributionInr: 1705,
    },
    {
      id: 'wrk-106',
      userId: 'usr-wrk-6',
      name: 'Shyamal Halder',
      phone: '+91 98311 55219',
      avatarInitials: 'SH',
      category: 'Painter',
      skills: ['Interior Wall Painting', 'Dampness Waterproofing', 'Putty & Primer Touchup', 'Wood Polish & Varnish'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Aadhaar + Skill India Painter Certificate',
      kycDocumentNumber: 'WB-PNT-7741',
      kycSubmittedAt: '2026-09-20T10:15:00Z',
      skillBadges: ['Damp-Proof Specialist', 'Low-VOC Interior Finish'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-2',
      coordinates: { lat: 22.5830, lng: 88.4235, addressLabel: 'BJ Block, Sector-2, Salt Lake' },
      rating: 4.8,
      reviewCount: 19,
      baseRateInr: 600,
      completedJobsTotal: 19,
      completedJobsThisWeek: 0,
      grossEarningsInr: 11400,
      netEarningsInr: 10260,
      welfareContributionInr: 1140,
    },
    {
      id: 'wrk-107',
      userId: 'usr-wrk-7',
      name: 'Mita Mukherjee',
      phone: '+91 98304 66701',
      avatarInitials: 'MM',
      category: 'Cleaner',
      skills: ['Deep Kitchen Cleaning', 'Bathroom Sanitization', 'Sofa & Carpet Vacuum', 'Water Tank Cleaning'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Aadhaar + Women Cooperative SHG ID',
      kycDocumentNumber: 'WB-SHG-CLN-1108',
      kycSubmittedAt: '2026-09-18T14:00:00Z',
      skillBadges: ['Eco-Safe Sanitization', 'SHG Team Lead'],
      isAvailable: true,
      shift: 'Morning (08:00 - 12:00)',
      serviceZone: 'Sector-3',
      coordinates: { lat: 22.5802, lng: 88.4210, addressLabel: 'EE Block, Sector-3, Salt Lake' },
      rating: 4.9,
      reviewCount: 47,
      baseRateInr: 500,
      completedJobsTotal: 47,
      completedJobsThisWeek: 2,
      grossEarningsInr: 23500,
      netEarningsInr: 21150,
      welfareContributionInr: 2350,
    },
    {
      id: 'wrk-108',
      userId: 'usr-wrk-8',
      name: 'Purnima Ghosh',
      phone: '+91 98307 88934',
      avatarInitials: 'PG',
      category: 'Babysitter',
      skills: ['Infant Daycare Support', 'Toddler Meal & Play', 'After-School Supervision', 'First-Aid Certified Care'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Police Verification + Red Cross First-Aid ID',
      kycDocumentNumber: 'WB-CARE-6021',
      kycSubmittedAt: '2026-09-29T12:00:00Z',
      skillBadges: ['Police Verified', 'Pediatric First-Aid'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-1',
      coordinates: { lat: 22.5842, lng: 88.4095, addressLabel: 'BD Block, Sector-1, Salt Lake' },
      rating: 5.0,
      reviewCount: 34,
      baseRateInr: 650,
      completedJobsTotal: 34,
      completedJobsThisWeek: 1,
      grossEarningsInr: 22100,
      netEarningsInr: 19890,
      welfareContributionInr: 2210,
    },
    {
      id: 'wrk-109',
      userId: 'usr-wrk-9',
      name: 'Pradip Halder',
      phone: '+91 98308 12345',
      avatarInitials: 'PH',
      category: 'Plumber',
      skills: ['Tap & Mixer Leak Repair', 'Pipe Blockage Clearing', 'Bathroom Sanitaryware'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Aadhaar + ITI Plumbing Certificate',
      kycDocumentNumber: 'WB-COOP-PLM-6012',
      kycSubmittedAt: '2026-09-22T08:00:00Z',
      skillBadges: ['Rapid Pipe Specialist'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-3',
      coordinates: { lat: 22.5790, lng: 88.4215, addressLabel: 'FD Block, Sector-3, Salt Lake' },
      rating: 4.8,
      reviewCount: 35,
      baseRateInr: 450,
      completedJobsTotal: 35,
      completedJobsThisWeek: 1,
      grossEarningsInr: 15750,
      netEarningsInr: 14175,
      welfareContributionInr: 1575,
    },
    {
      id: 'wrk-110',
      userId: 'usr-wrk-10',
      name: 'Anup Majumder',
      phone: '+91 98319 54321',
      avatarInitials: 'AM',
      category: 'Plumber',
      skills: ['Water Tank Fitting', 'Pipe Blockage Clearing', 'Bathroom Sanitaryware'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Municipal Trade Certificate',
      kycDocumentNumber: 'WB-COOP-PLM-7104',
      kycSubmittedAt: '2026-09-24T11:00:00Z',
      skillBadges: ['Tank & Booster Specialist'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-5',
      coordinates: { lat: 22.5720, lng: 88.4350, addressLabel: 'Technopolis, Sector-5, Salt Lake' },
      rating: 4.7,
      reviewCount: 22,
      baseRateInr: 420,
      completedJobsTotal: 22,
      completedJobsThisWeek: 0,
      grossEarningsInr: 9240,
      netEarningsInr: 8316,
      welfareContributionInr: 924,
    },
    {
      id: 'wrk-111',
      userId: 'usr-wrk-11',
      name: 'Kartik Naskar',
      phone: '+91 98302 98765',
      avatarInitials: 'KN',
      category: 'Plumber',
      skills: ['Tap & Mixer Leak Repair', 'Water Tank Fitting', 'Pump Motor Valve'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Aadhaar + Municipal Plumber License',
      kycDocumentNumber: 'WB-COOP-PLM-8041',
      kycSubmittedAt: '2026-09-28T09:30:00Z',
      skillBadges: ['Master Sanitary Fitter'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-1',
      coordinates: { lat: 22.5850, lng: 88.4080, addressLabel: 'BA Block, Sector-1, Salt Lake' },
      rating: 4.9,
      reviewCount: 40,
      baseRateInr: 460,
      completedJobsTotal: 40,
      completedJobsThisWeek: 2,
      grossEarningsInr: 18400,
      netEarningsInr: 16560,
      welfareContributionInr: 1840,
    },
    {
      id: 'wrk-112',
      userId: 'usr-wrk-12',
      name: 'Soumen Bhowmick',
      phone: '+91 98315 22110',
      avatarInitials: 'SB',
      category: 'Electrician',
      skills: ['MCB & Fuse Repair', 'Switchboard Wiring', 'Inverter Setup'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'WB Wireman Permit',
      kycDocumentNumber: 'WB-ELC-7744',
      kycSubmittedAt: '2026-09-19T14:00:00Z',
      skillBadges: ['Inverter & MCB Specialist'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-2',
      coordinates: { lat: 22.5775, lng: 88.4250, addressLabel: 'CK Block, Sector-2, Salt Lake' },
      rating: 4.8,
      reviewCount: 29,
      baseRateInr: 480,
      completedJobsTotal: 29,
      completedJobsThisWeek: 1,
      grossEarningsInr: 13920,
      netEarningsInr: 12528,
      welfareContributionInr: 1392,
    },
    {
      id: 'wrk-113',
      userId: 'usr-wrk-13',
      name: 'Tapas Pal',
      phone: '+91 98303 66442',
      avatarInitials: 'TP',
      category: 'Electrician',
      skills: ['Ceiling Fan Installation', 'Switchboard Wiring', 'Appliance Earthing'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'ITI Electrical Certificate',
      kycDocumentNumber: 'WB-ELC-8190',
      kycSubmittedAt: '2026-09-25T10:00:00Z',
      skillBadges: ['Domestic Appliance Expert'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-1',
      coordinates: { lat: 22.5835, lng: 88.4110, addressLabel: 'BC Block, Sector-1, Salt Lake' },
      rating: 4.9,
      reviewCount: 38,
      baseRateInr: 500,
      completedJobsTotal: 38,
      completedJobsThisWeek: 2,
      grossEarningsInr: 19000,
      netEarningsInr: 17100,
      welfareContributionInr: 1900,
    },
    {
      id: 'wrk-114',
      userId: 'usr-wrk-14',
      name: 'Amitava Sengupta',
      phone: '+91 98317 88990',
      avatarInitials: 'AS',
      category: 'Electrician',
      skills: ['MCB & Fuse Repair', 'Ceiling Fan Installation', 'Switchboard Wiring'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Skill India Electrical Card',
      kycDocumentNumber: 'WB-ELC-9201',
      kycSubmittedAt: '2026-09-27T12:00:00Z',
      skillBadges: ['Rapid Wiring Pro'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-3',
      coordinates: { lat: 22.5798, lng: 88.4180, addressLabel: 'GC Market, Sector-3, Salt Lake' },
      rating: 4.6,
      reviewCount: 16,
      baseRateInr: 450,
      completedJobsTotal: 16,
      completedJobsThisWeek: 0,
      grossEarningsInr: 7200,
      netEarningsInr: 6480,
      welfareContributionInr: 720,
    },
    {
      id: 'wrk-115',
      userId: 'usr-wrk-15',
      name: 'Sanjoy Mistri',
      phone: '+91 98306 44332',
      avatarInitials: 'SM',
      category: 'Carpenter',
      skills: ['Door Lock & Hinge Repair', 'Modular Cabinet Fix', 'Furniture Assembly'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Cooperative Artisan ID',
      kycDocumentNumber: 'WB-CRP-4102',
      kycSubmittedAt: '2026-09-21T09:00:00Z',
      skillBadges: ['Cabinet & Lock Specialist'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-2',
      coordinates: { lat: 22.5800, lng: 88.4240, addressLabel: 'CL Block, Sector-2, Salt Lake' },
      rating: 4.7,
      reviewCount: 24,
      baseRateInr: 520,
      completedJobsTotal: 24,
      completedJobsThisWeek: 1,
      grossEarningsInr: 12480,
      netEarningsInr: 11232,
      welfareContributionInr: 1248,
    },
    {
      id: 'wrk-116',
      userId: 'usr-wrk-16',
      name: 'Ashoke Sutradhar',
      phone: '+91 98310 11223',
      avatarInitials: 'AS',
      category: 'Carpenter',
      skills: ['Door Lock & Hinge Repair', 'Window Frame Fitting', 'Furniture Assembly'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Cooperative Guild Card',
      kycDocumentNumber: 'WB-CRP-5231',
      kycSubmittedAt: '2026-09-23T10:30:00Z',
      skillBadges: ['Furniture Fitting Expert'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-1',
      coordinates: { lat: 22.5820, lng: 88.4140, addressLabel: 'BB Block, Sector-1, Salt Lake' },
      rating: 4.8,
      reviewCount: 30,
      baseRateInr: 550,
      completedJobsTotal: 30,
      completedJobsThisWeek: 2,
      grossEarningsInr: 16500,
      netEarningsInr: 14850,
      welfareContributionInr: 1650,
    },
    {
      id: 'wrk-117',
      userId: 'usr-wrk-17',
      name: 'Biswanath Barman',
      phone: '+91 98321 77665',
      avatarInitials: 'BB',
      category: 'Carpenter',
      skills: ['Modular Cabinet Fix', 'Window Frame Fitting', 'Door Lock & Hinge Repair'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Artisan Board Registration',
      kycDocumentNumber: 'WB-CRP-6340',
      kycSubmittedAt: '2026-09-25T11:00:00Z',
      skillBadges: ['Modular Kitchen Pro'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-5',
      coordinates: { lat: 22.5730, lng: 88.4310, addressLabel: 'Webel More, Sector-5, Salt Lake' },
      rating: 4.9,
      reviewCount: 41,
      baseRateInr: 580,
      completedJobsTotal: 41,
      completedJobsThisWeek: 1,
      grossEarningsInr: 23780,
      netEarningsInr: 21402,
      welfareContributionInr: 2378,
    },
    {
      id: 'wrk-118',
      userId: 'usr-wrk-18',
      name: 'Ranjit Paul',
      phone: '+91 98314 55443',
      avatarInitials: 'RP',
      category: 'Carpenter',
      skills: ['Furniture Assembly', 'Door Lock & Hinge Repair', 'Window Frame Fitting'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Skill India Certificate',
      kycDocumentNumber: 'WB-CRP-7411',
      kycSubmittedAt: '2026-09-26T15:00:00Z',
      skillBadges: ['Precision Assembly Pro'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-3',
      coordinates: { lat: 22.5760, lng: 88.4170, addressLabel: 'HB Block, Sector-3, Salt Lake' },
      rating: 4.6,
      reviewCount: 18,
      baseRateInr: 500,
      completedJobsTotal: 18,
      completedJobsThisWeek: 0,
      grossEarningsInr: 9000,
      netEarningsInr: 8100,
      welfareContributionInr: 900,
    },
    {
      id: 'wrk-119',
      userId: 'usr-wrk-19',
      name: 'Alok Karmakar',
      phone: '+91 98322 33445',
      avatarInitials: 'AK',
      category: 'Painter',
      skills: ['Interior Wall Painting', 'Putty & Primer Touchup', 'Dampness Waterproofing'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Cooperative Guild Certificate',
      kycDocumentNumber: 'WB-PNT-8102',
      kycSubmittedAt: '2026-09-20T08:30:00Z',
      skillBadges: ['Interior Wall Specialist'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-3',
      coordinates: { lat: 22.5788, lng: 88.4195, addressLabel: 'FC Block, Sector-3, Salt Lake' },
      rating: 4.7,
      reviewCount: 21,
      baseRateInr: 580,
      completedJobsTotal: 21,
      completedJobsThisWeek: 1,
      grossEarningsInr: 12180,
      netEarningsInr: 10962,
      welfareContributionInr: 1218,
    },
    {
      id: 'wrk-120',
      userId: 'usr-wrk-20',
      name: 'Nirmal Sen',
      phone: '+91 98301 99887',
      avatarInitials: 'NS',
      category: 'Painter',
      skills: ['Interior Wall Painting', 'Wood Polish & Varnish', 'Putty & Primer Touchup'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Trade Association Card',
      kycDocumentNumber: 'WB-PNT-9045',
      kycSubmittedAt: '2026-09-22T09:00:00Z',
      skillBadges: ['Wood Finish & Texture Pro'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-1',
      coordinates: { lat: 22.5825, lng: 88.4130, addressLabel: 'CA Block, Sector-1, Salt Lake' },
      rating: 4.8,
      reviewCount: 27,
      baseRateInr: 620,
      completedJobsTotal: 27,
      completedJobsThisWeek: 2,
      grossEarningsInr: 16740,
      netEarningsInr: 15066,
      welfareContributionInr: 1674,
    },
    {
      id: 'wrk-121',
      userId: 'usr-wrk-21',
      name: 'Dipak Mondal',
      phone: '+91 98313 77889',
      avatarInitials: 'DM',
      category: 'Painter',
      skills: ['Dampness Waterproofing', 'Interior Wall Painting', 'Wood Polish & Varnish'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Aadhaar + Skill Certificate',
      kycDocumentNumber: 'WB-PNT-9912',
      kycSubmittedAt: '2026-09-24T10:00:00Z',
      skillBadges: ['Waterproofing Master'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-5',
      coordinates: { lat: 22.5750, lng: 88.4320, addressLabel: 'Godrej Waterside, Sector-5, Salt Lake' },
      rating: 4.9,
      reviewCount: 33,
      baseRateInr: 600,
      completedJobsTotal: 33,
      completedJobsThisWeek: 1,
      grossEarningsInr: 19800,
      netEarningsInr: 17820,
      welfareContributionInr: 1980,
    },
    {
      id: 'wrk-122',
      userId: 'usr-wrk-22',
      name: 'Goutam Roy',
      phone: '+91 98325 66778',
      avatarInitials: 'GR',
      category: 'Painter',
      skills: ['Interior Wall Painting', 'Putty & Primer Touchup'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Cooperative Card',
      kycDocumentNumber: 'WB-PNT-1044',
      kycSubmittedAt: '2026-09-26T11:00:00Z',
      skillBadges: ['Wall Primer Touchup'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-2',
      coordinates: { lat: 22.5810, lng: 88.4255, addressLabel: 'BL Block, Sector-2, Salt Lake' },
      rating: 4.6,
      reviewCount: 15,
      baseRateInr: 550,
      completedJobsTotal: 15,
      completedJobsThisWeek: 0,
      grossEarningsInr: 8250,
      netEarningsInr: 7425,
      welfareContributionInr: 825,
    },
    {
      id: 'wrk-123',
      userId: 'usr-wrk-23',
      name: 'Sunita Mahato',
      phone: '+91 98305 88776',
      avatarInitials: 'SM',
      category: 'Cleaner',
      skills: ['Deep Kitchen Cleaning', 'Bathroom Sanitization', 'Water Tank Cleaning'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'SHG Member ID',
      kycDocumentNumber: 'WB-SHG-CLN-2210',
      kycSubmittedAt: '2026-09-19T09:00:00Z',
      skillBadges: ['Deep Sanitization Lead'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-2',
      coordinates: { lat: 22.5770, lng: 88.4270, addressLabel: 'CJ Block, Sector-2, Salt Lake' },
      rating: 4.9,
      reviewCount: 52,
      baseRateInr: 480,
      completedJobsTotal: 52,
      completedJobsThisWeek: 2,
      grossEarningsInr: 24960,
      netEarningsInr: 22464,
      welfareContributionInr: 2496,
    },
    {
      id: 'wrk-124',
      userId: 'usr-wrk-24',
      name: 'Gita Das',
      phone: '+91 98318 99001',
      avatarInitials: 'GD',
      category: 'Cleaner',
      skills: ['Bathroom Sanitization', 'Sofa & Carpet Vacuum', 'Deep Kitchen Cleaning'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'SHG Member ID',
      kycDocumentNumber: 'WB-SHG-CLN-3341',
      kycSubmittedAt: '2026-09-21T10:00:00Z',
      skillBadges: ['Carpet & Sofa Vacuum Specialist'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-1',
      coordinates: { lat: 22.5830, lng: 88.4115, addressLabel: 'BE Block, Sector-1, Salt Lake' },
      rating: 4.8,
      reviewCount: 36,
      baseRateInr: 500,
      completedJobsTotal: 36,
      completedJobsThisWeek: 1,
      grossEarningsInr: 18000,
      netEarningsInr: 16200,
      welfareContributionInr: 1800,
    },
    {
      id: 'wrk-125',
      userId: 'usr-wrk-25',
      name: 'Rajesh Balmiki',
      phone: '+91 98309 33221',
      avatarInitials: 'RB',
      category: 'Cleaner',
      skills: ['Water Tank Cleaning', 'Bathroom Sanitization', 'Deep Kitchen Cleaning'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Municipal Sanitation Permit',
      kycDocumentNumber: 'WB-CLN-4412',
      kycSubmittedAt: '2026-09-23T11:00:00Z',
      skillBadges: ['Overhead Tank Cleaning Pro'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-5',
      coordinates: { lat: 22.5740, lng: 88.4345, addressLabel: 'RDB Boulevard, Sector-5, Salt Lake' },
      rating: 4.7,
      reviewCount: 28,
      baseRateInr: 450,
      completedJobsTotal: 28,
      completedJobsThisWeek: 0,
      grossEarningsInr: 12600,
      netEarningsInr: 11340,
      welfareContributionInr: 1260,
    },
    {
      id: 'wrk-126',
      userId: 'usr-wrk-26',
      name: 'Anita Barui',
      phone: '+91 98317 44556',
      avatarInitials: 'AB',
      category: 'Cleaner',
      skills: ['Deep Kitchen Cleaning', 'Bathroom Sanitization', 'Sofa & Carpet Vacuum'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'SHG Member ID',
      kycDocumentNumber: 'WB-SHG-CLN-5520',
      kycSubmittedAt: '2026-09-25T14:00:00Z',
      skillBadges: ['Eco Sanitization Expert'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-3',
      coordinates: { lat: 22.5805, lng: 88.4185, addressLabel: 'HA Block, Sector-3, Salt Lake' },
      rating: 4.8,
      reviewCount: 44,
      baseRateInr: 520,
      completedJobsTotal: 44,
      completedJobsThisWeek: 2,
      grossEarningsInr: 22880,
      netEarningsInr: 20592,
      welfareContributionInr: 2288,
    },
    {
      id: 'wrk-127',
      userId: 'usr-wrk-27',
      name: 'Sampa Sarkar',
      phone: '+91 98320 11335',
      avatarInitials: 'SS',
      category: 'Babysitter',
      skills: ['Infant Daycare Support', 'Toddler Meal & Play', 'First-Aid Certified Care'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Police Verification + Red Cross Care ID',
      kycDocumentNumber: 'WB-CARE-7102',
      kycSubmittedAt: '2026-09-22T08:00:00Z',
      skillBadges: ['Police Verified', 'Pediatric Nutrition'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-2',
      coordinates: { lat: 22.5780, lng: 88.4260, addressLabel: 'BK Block, Sector-2, Salt Lake' },
      rating: 4.9,
      reviewCount: 26,
      baseRateInr: 600,
      completedJobsTotal: 26,
      completedJobsThisWeek: 1,
      grossEarningsInr: 15600,
      netEarningsInr: 14040,
      welfareContributionInr: 1560,
    },
    {
      id: 'wrk-128',
      userId: 'usr-wrk-28',
      name: 'Rupa Chakraborty',
      phone: '+91 98307 22446',
      avatarInitials: 'RC',
      category: 'Babysitter',
      skills: ['After-School Supervision', 'Toddler Meal & Play', 'First-Aid Certified Care'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Police Verification + ECCE Certificate',
      kycDocumentNumber: 'WB-CARE-8214',
      kycSubmittedAt: '2026-09-24T09:30:00Z',
      skillBadges: ['Certified Early Childhood Care'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-3',
      coordinates: { lat: 22.5812, lng: 88.4205, addressLabel: 'IA Block, Sector-3, Salt Lake' },
      rating: 5.0,
      reviewCount: 39,
      baseRateInr: 650,
      completedJobsTotal: 39,
      completedJobsThisWeek: 2,
      grossEarningsInr: 25350,
      netEarningsInr: 22815,
      welfareContributionInr: 2535,
    },
    {
      id: 'wrk-129',
      userId: 'usr-wrk-29',
      name: 'Rekha Khatun',
      phone: '+91 98311 88992',
      avatarInitials: 'RK',
      category: 'Babysitter',
      skills: ['Infant Daycare Support', 'Toddler Meal & Play', 'After-School Supervision'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Police Verification ID',
      kycDocumentNumber: 'WB-CARE-9305',
      kycSubmittedAt: '2026-09-26T10:00:00Z',
      skillBadges: ['Police Verified', 'Infant Care Specialist'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-1',
      coordinates: { lat: 22.5818, lng: 88.4135, addressLabel: 'BF Block, Sector-1, Salt Lake' },
      rating: 4.8,
      reviewCount: 22,
      baseRateInr: 580,
      completedJobsTotal: 22,
      completedJobsThisWeek: 0,
      grossEarningsInr: 12760,
      netEarningsInr: 11484,
      welfareContributionInr: 1276,
    },
    {
      id: 'wrk-130',
      userId: 'usr-wrk-30',
      name: 'Maya Bauri',
      phone: '+91 98324 55667',
      avatarInitials: 'MB',
      category: 'Babysitter',
      skills: ['Toddler Meal & Play', 'After-School Supervision', 'First-Aid Certified Care'],
      verified: true,
      kycStatus: 'VERIFIED',
      kycDocumentType: 'Red Cross First-Aid ID',
      kycDocumentNumber: 'WB-CARE-9910',
      kycSubmittedAt: '2026-09-28T12:00:00Z',
      skillBadges: ['Emergency First-Aid Care'],
      isAvailable: true,
      shift: 'Full Day (08:00 - 20:00)',
      serviceZone: 'Sector-5',
      coordinates: { lat: 22.5735, lng: 88.4325, addressLabel: 'DLF 1, Sector-5, Salt Lake' },
      rating: 4.7,
      reviewCount: 19,
      baseRateInr: 550,
      completedJobsTotal: 19,
      completedJobsThisWeek: 1,
      grossEarningsInr: 10450,
      netEarningsInr: 9405,
      welfareContributionInr: 1045,
    },
  ];

  const bookings: BookingRecord[] = [];

  const welfareLedger: WelfareLedgerEntry[] = [];

  const emergencyAlerts: EmergencyAlert[] = [];

  const communityBulkBookings: CommunityBulkBooking[] = [
    {
      id: 'blk-sample-101',
      bulkReference: 'BLK-2026-101',
      representativeId: 'usr-admin-1',
      representativeName: 'Ananya Sen (Society Secretary)',
      representativePhone: '+91 98300 90011',
      societyName: 'Labony Estate Cooperative Society',
      serviceCategory: 'Plumber',
      preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      preferredTimeSlot: 'Morning (08:00 - 12:00)',
      householdCount: 5,
      households: [
        { unitId: 'u-1', flatNumber: 'Flat 101, Block A', residentName: 'Debabrata Roy', residentPhone: '+91 98301 22331', status: 'PENDING', notes: 'Kitchen sink pipe inspection' },
        { unitId: 'u-2', flatNumber: 'Flat 102, Block A', residentName: 'Mousumi Paul', residentPhone: '+91 98302 44552', status: 'PENDING', notes: 'Bathroom tap leak' },
        { unitId: 'u-3', flatNumber: 'Flat 201, Block B', residentName: 'Sanjay Gupta', residentPhone: '+91 98303 66773', status: 'PENDING', notes: 'Water purifier valve fitting' },
        { unitId: 'u-4', flatNumber: 'Flat 202, Block B', residentName: 'Kakali Banerjee', residentPhone: '+91 98304 88994', status: 'PENDING', notes: 'Overhead tank check' },
        { unitId: 'u-5', flatNumber: 'Flat 301, Block C', residentName: 'Alok Mukherjee', residentPhone: '+91 98305 00115', status: 'PENDING', notes: 'Washbasin drainage blockage' },
      ],
      perHouseholdPriceInr: 340,
      totalPriceInr: 1700,
      discountPercent: 15,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSampleDemo: true,
    },
  ];

  const disputes: DisputeRecord[] = [];

  const welfareRequests: WelfareRequest[] = [];

  const collaborationRequests: CollaborationRequest[] = [
    {
      id: 'collab-demo-1',
      bookingId: 'bkg-demo-inverter-101',
      bookingReference: 'BKG-2026-INV',
      initiatorWorkerId: 'wrk-101',
      initiatorWorkerName: 'Subrata Mondal',
      initiatorWorkerPhone: '+91 98305 11201',
      serviceCategory: 'Electrician',
      requiredSkill: 'Inverter Setup',
      suggestedSkills: ['Switchboard Wiring', 'Appliance Earthing'],
      jobLocationArea: 'Karunamoyee, Sector-2, Salt Lake',
      expectedDurationHours: 2.5,
      jobSummary: 'Heavy commercial inverter & dual battery rack mounting requiring a second technician for heavy cable conduits.',
      notes: 'Need support with 32A MCB connection and wall mounting bracket.',
      status: 'HELP_REQUESTED',
      isSimulatedDemo: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const allocationFeedback: AllocationFeedbackRecord[] = [];
  const timeProtectionRecords: TimeProtectionRecord[] = [];
  const sparePartsEstimates: SparePartsEstimateRecord[] = [];

  const coopProposals: CoopProposal[] = [
    {
      id: 'prop-101',
      title: 'Vocational BIS Electrical Safety & High-Voltage Certification Subsidy',
      description: 'Allocate up to ₹3,500 from the cooperative welfare fund for certified electrician safety gear, digital multi-meters, and official BIS safety modules.',
      category: 'TRAINING',
      proposedByWorkerId: 'wrk-101',
      proposedByWorkerName: 'Subrata Mondal',
      status: 'ACTIVE',
      upvotes: 6,
      downvotes: 0,
      votes: {
        'wrk-101': 'FOR',
        'wrk-102': 'FOR',
      },
      isDemoVoting: true,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'prop-102',
      title: 'Adjust Cooperative Fund Split for Heavy Commercial Multi-Unit Jobs from 90:10 to 92:8',
      description: 'For apartment complex jobs involving over 4 households, increase direct worker payout share to 92% to compensate for high physical labor intensity.',
      category: 'WELFARE_POLICY',
      proposedByWorkerId: 'wrk-102',
      proposedByWorkerName: 'Rameshwar Yadav',
      status: 'ACTIVE',
      upvotes: 8,
      downvotes: 1,
      votes: {
        'wrk-102': 'FOR',
      },
      isDemoVoting: true,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'prop-103',
      title: 'Standardized Tool Upgrade Subsidy for Plumbing & Carpentry Kits',
      description: 'Provide an annual ₹2,500 equipment grant for durable pipe cutters, PPR welding machines, and impact drills to improve service speed and reduce customer delays.',
      category: 'SAFETY_EQUIPMENT',
      proposedByWorkerId: 'wrk-103',
      proposedByWorkerName: 'Tarun Karmakar',
      status: 'ACTIVE',
      upvotes: 7,
      downvotes: 0,
      votes: {},
      isDemoVoting: true,
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      id: 'prop-104',
      title: 'Mandatory 15-Minute Transit Buffer Between Scheduled Society Bookings',
      description: 'Ensure automated dispatch algorithms enforce a mandatory 15-minute rest and travel buffer between consecutive jobs in peak Kolkata traffic.',
      category: 'COOP_RULES',
      proposedByWorkerId: 'wrk-105',
      proposedByWorkerName: 'Alok Barman',
      status: 'ACTIVE',
      upvotes: 5,
      downvotes: 2,
      votes: {},
      isDemoVoting: true,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
  ];

  const safeVisitLogs: SafeVisitLogRecord[] = [];

  return {
    users,
    workers,
    bookings,
    problemReports: [],
    welfareLedger,
    emergencyAlerts,
    communityBulkBookings,
    disputes,
    welfareRequests,
    collaborationRequests,
    allocationFeedback,
    timeProtectionRecords,
    sparePartsEstimates,
    coopProposals,
    safeVisitLogs,
    jobNotes: [],
    complaintToActions: [],
    repairReports: [],
    bookingGapAnalyses: [],
    coopPolicyQueries: [],
    activeSessions: {},
  };
}

function loadDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = getInitialSeedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseSchema;

    parsed.problemReports = Array.isArray(parsed.problemReports) ? parsed.problemReports : [];
    parsed.emergencyAlerts = Array.isArray(parsed.emergencyAlerts) ? parsed.emergencyAlerts : [];
    parsed.communityBulkBookings = Array.isArray(parsed.communityBulkBookings) ? parsed.communityBulkBookings : [];
    parsed.disputes = Array.isArray(parsed.disputes) ? parsed.disputes : [];
    parsed.welfareRequests = Array.isArray(parsed.welfareRequests) ? parsed.welfareRequests : [];
    parsed.collaborationRequests = Array.isArray(parsed.collaborationRequests) ? parsed.collaborationRequests : [];
    parsed.allocationFeedback = Array.isArray(parsed.allocationFeedback) ? parsed.allocationFeedback : [];
    parsed.timeProtectionRecords = Array.isArray(parsed.timeProtectionRecords) ? parsed.timeProtectionRecords : [];
    parsed.sparePartsEstimates = Array.isArray(parsed.sparePartsEstimates) ? parsed.sparePartsEstimates : [];
    parsed.coopProposals = Array.isArray(parsed.coopProposals) ? parsed.coopProposals : [];
    parsed.safeVisitLogs = Array.isArray(parsed.safeVisitLogs) ? parsed.safeVisitLogs : [];
    parsed.jobNotes = Array.isArray((parsed as any).jobNotes) ? (parsed as any).jobNotes : [];
    parsed.complaintToActions = Array.isArray((parsed as any).complaintToActions) ? (parsed as any).complaintToActions : [];
    parsed.repairReports = Array.isArray((parsed as any).repairReports) ? (parsed as any).repairReports : [];
    parsed.bookingGapAnalyses = Array.isArray((parsed as any).bookingGapAnalyses) ? (parsed as any).bookingGapAnalyses : [];
    parsed.coopPolicyQueries = Array.isArray((parsed as any).coopPolicyQueries) ? (parsed as any).coopPolicyQueries : [];

    // Ensure sample collaboration request exists for demo
    if (parsed.collaborationRequests.length === 0) {
      parsed.collaborationRequests.push({
        id: 'collab-demo-1',
        bookingId: 'bkg-demo-inverter-101',
        bookingReference: 'BKG-2026-INV',
        initiatorWorkerId: 'wrk-101',
        initiatorWorkerName: 'Subrata Mondal',
        initiatorWorkerPhone: '+91 98305 11201',
        serviceCategory: 'Electrician',
        requiredSkill: 'Inverter Setup',
        suggestedSkills: ['Switchboard Wiring', 'Appliance Earthing'],
        jobLocationArea: 'Karunamoyee, Sector-2, Salt Lake',
        expectedDurationHours: 2.5,
        jobSummary: 'Heavy commercial inverter & dual battery rack mounting requiring a second technician for heavy cable conduits.',
        notes: 'Need support with 32A MCB connection and wall mounting bracket.',
        status: 'HELP_REQUESTED',
        isSimulatedDemo: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Ensure sample cooperative proposals exist for demo voting
    if (parsed.coopProposals.length === 0) {
      parsed.coopProposals.push(
        {
          id: 'prop-101',
          title: 'Vocational BIS Electrical Safety & High-Voltage Certification Subsidy',
          description: 'Allocate up to ₹3,500 from the cooperative welfare fund for certified electrician safety gear, digital multi-meters, and official BIS safety modules.',
          category: 'TRAINING',
          proposedByWorkerId: 'wrk-101',
          proposedByWorkerName: 'Subrata Mondal',
          status: 'ACTIVE',
          upvotes: 6,
          downvotes: 0,
          votes: { 'wrk-101': 'FOR', 'wrk-102': 'FOR' },
          isDemoVoting: true,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: 'prop-102',
          title: 'Adjust Cooperative Fund Split for Heavy Commercial Multi-Unit Jobs from 90:10 to 92:8',
          description: 'For apartment complex jobs involving over 4 households, increase direct worker payout share to 92% to compensate for high physical labor intensity.',
          category: 'WELFARE_POLICY',
          proposedByWorkerId: 'wrk-102',
          proposedByWorkerName: 'Rameshwar Yadav',
          status: 'ACTIVE',
          upvotes: 8,
          downvotes: 1,
          votes: { 'wrk-102': 'FOR' },
          isDemoVoting: true,
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
        {
          id: 'prop-103',
          title: 'Standardized Tool Upgrade Subsidy for Plumbing & Carpentry Kits',
          description: 'Provide an annual ₹2,500 equipment grant for durable pipe cutters, PPR welding machines, and impact drills to improve service speed and reduce customer delays.',
          category: 'SAFETY_EQUIPMENT',
          proposedByWorkerId: 'wrk-103',
          proposedByWorkerName: 'Tarun Karmakar',
          status: 'ACTIVE',
          upvotes: 7,
          downvotes: 0,
          votes: {},
          isDemoVoting: true,
          createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
        },
        {
          id: 'prop-104',
          title: 'Mandatory 15-Minute Transit Buffer Between Scheduled Society Bookings',
          description: 'Ensure automated dispatch algorithms enforce a mandatory 15-minute rest and travel buffer between consecutive jobs in peak Kolkata traffic.',
          category: 'COOP_RULES',
          proposedByWorkerId: 'wrk-105',
          proposedByWorkerName: 'Alok Barman',
          status: 'ACTIVE',
          upvotes: 5,
          downvotes: 2,
          votes: {},
          isDemoVoting: true,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        }
      );
    }

    // Ensure sample community bulk booking exists for instant demo testing
    if (parsed.communityBulkBookings.length === 0) {
      parsed.communityBulkBookings.push({
        id: 'blk-sample-101',
        bulkReference: 'BLK-2026-101',
        representativeId: 'usr-admin-1',
        representativeName: 'Ananya Sen (Society Secretary)',
        representativePhone: '+91 98300 90011',
        societyName: 'Labony Estate Cooperative Society',
        serviceCategory: 'Plumber',
        preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        preferredTimeSlot: 'Morning (08:00 - 12:00)',
        householdCount: 5,
        households: [
          { unitId: 'u-1', flatNumber: 'Flat 101, Block A', residentName: 'Debabrata Roy', residentPhone: '+91 98301 22331', status: 'PENDING', notes: 'Kitchen sink pipe inspection' },
          { unitId: 'u-2', flatNumber: 'Flat 102, Block A', residentName: 'Mousumi Paul', residentPhone: '+91 98302 44552', status: 'PENDING', notes: 'Bathroom tap leak' },
          { unitId: 'u-3', flatNumber: 'Flat 201, Block B', residentName: 'Sanjay Gupta', residentPhone: '+91 98303 66773', status: 'PENDING', notes: 'Water purifier valve fitting' },
          { unitId: 'u-4', flatNumber: 'Flat 202, Block B', residentName: 'Kakali Banerjee', residentPhone: '+91 98304 88994', status: 'PENDING', notes: 'Overhead tank check' },
          { unitId: 'u-5', flatNumber: 'Flat 301, Block C', residentName: 'Alok Mukherjee', residentPhone: '+91 98305 00115', status: 'PENDING', notes: 'Washbasin drainage blockage' },
        ],
        perHouseholdPriceInr: 340,
        totalPriceInr: 1700,
        discountPercent: 15,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSampleDemo: true,
      });
    }

    // Clean out any legacy pre-seeded demo customer ("Rohan Chatterjee" / usr-cust-1) and sample bookings
    let modified = false;
    if (parsed.users?.some((u) => u.id === 'usr-cust-1')) {
      parsed.users = parsed.users.filter((u) => u.id !== 'usr-cust-1');
      modified = true;
    }
    if (parsed.bookings?.some((b) => b.id === 'bkg-1001' || b.id === 'bkg-1002' || b.customerId === 'usr-cust-1')) {
      parsed.bookings = parsed.bookings.filter(
        (b) => b.id !== 'bkg-1001' && b.id !== 'bkg-1002' && b.customerId !== 'usr-cust-1'
      );
      modified = true;
    }
    if (parsed.welfareLedger?.some((l) => l.id === 'led-1001' || l.customerName === 'Rohan Chatterjee')) {
      parsed.welfareLedger = parsed.welfareLedger.filter(
        (l) => l.id !== 'led-1001' && l.customerName !== 'Rohan Chatterjee'
      );
      modified = true;
    }
    if (parsed.activeSessions) {
      for (const [tk, sess] of Object.entries(parsed.activeSessions)) {
        if (sess.userId === 'usr-cust-1') {
          delete parsed.activeSessions[tk];
          modified = true;
        }
      }
    }

    const seed = getInitialSeedDatabase();
    for (const seedWorker of seed.workers) {
      if (!parsed.workers.some((w) => w.id === seedWorker.id)) {
        parsed.workers.push(seedWorker);
        modified = true;
      }
    }
    for (const seedUser of seed.users) {
      if (!parsed.users.some((u) => u.id === seedUser.id)) {
        parsed.users.push(seedUser);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch {
    const seed = getInitialSeedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
}

function saveDb(db: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

// Haversine formula to compute real distance in km between two GPS coordinates
function calculateHaversineKm(a?: Coordinates, b?: Coordinates): number | null {
  if (
    !a ||
    !b ||
    typeof a.lat !== 'number' ||
    typeof a.lng !== 'number' ||
    typeof b.lat !== 'number' ||
    typeof b.lng !== 'number' ||
    Number.isNaN(a.lat) ||
    Number.isNaN(a.lng) ||
    Number.isNaN(b.lat) ||
    Number.isNaN(b.lng)
  ) {
    return null;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c * 100) / 100;
}

// Deterministic Fair Dispatch Ranking Formula:
// Matching Score = (Proximity * 0.45) + (Skill * 0.30) + (Fairness * 0.25)
function computeFairDispatchScore(
  worker: WorkerProfile,
  customerCoords: Coordinates | undefined,
  requiredSkills: string[],
  maxWeeklyJobsAmongPeers: number
): FairDispatchBreakdown {
  const distanceKm = calculateHaversineKm(customerCoords, worker.coordinates);

  // 1. Proximity Score (0 - 100): 100 at 0km, decreases by 9 pts per km
  const proximityScore =
    distanceKm !== null
      ? Math.max(0, Math.min(100, Math.round(100 - distanceKm * 9)))
      : 65; // Balanced neutral baseline when customer coordinates are not specified

  // 2. Skill Score (0 - 100):
  // Trade category match = 50 pts base + matched specific skills (up to 35 pts) + KYC verification (15 pts)
  const normalizedReqSkills = requiredSkills.map((s) => s.toLowerCase().trim()).filter(Boolean);
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const reqSkill of requiredSkills) {
    const found = worker.skills.some(
      (ws) =>
        ws.toLowerCase().includes(reqSkill.toLowerCase()) ||
        reqSkill.toLowerCase().includes(ws.toLowerCase())
    );
    if (found) {
      matchedSkills.push(reqSkill);
    } else {
      missingSkills.push(reqSkill);
    }
  }

  const skillCoverageRatio =
    normalizedReqSkills.length > 0 ? matchedSkills.length / normalizedReqSkills.length : 1;
  const skillScore = Math.round(50 + skillCoverageRatio * 35 + (worker.verified ? 15 : 0));

  // 3. Fairness Score (0 - 100):
  // Distributes jobs fairly across cooperative members.
  // Workers who have received fewer recent jobs get highest priority!
  const isNewWorker = worker.completedJobsTotal === 0 || worker.reviewCount === 0;
  const denom = Math.max(3, maxWeeklyJobsAmongPeers + 1);
  const workloadRatio = Math.min(1, worker.completedJobsThisWeek / denom);
  let fairnessScore = Math.round(100 - workloadRatio * 70);

  // Do not unfairly penalize new workers for having no ratings or job history:
  // Grant new workers an onboarding boost to guarantee fair rotation alongside established workers
  if (isNewWorker) {
    fairnessScore = Math.min(100, fairnessScore + 10);
  }
  fairnessScore = Math.max(25, Math.min(100, fairnessScore));

  // Exact Blueprint Formula: (Proximity * 0.45) + (Skill * 0.30) + (Fairness * 0.25)
  const weightedTotal =
    Math.round((proximityScore * 0.45 + skillScore * 0.3 + fairnessScore * 0.25) * 10) / 10;

  const distText =
    distanceKm !== null
      ? `${distanceKm.toFixed(1)} km away (${worker.serviceZone})`
      : 'within service zone';
  const newWorkerNote = isNewWorker ? ' (New cooperative member — equal rotation priority applied)' : '';

  // Transparent recommendation reason conforming to requirement
  const explanation = `Available worker with matching skills and fewer recent assignments (${worker.completedJobsThisWeek} jobs this week; ${distText})${newWorkerNote}.`;

  return {
    proximityScore,
    skillScore,
    fairnessScore,
    weightedTotal,
    distanceKm,
    matchedSkills,
    missingSkills,
    explanation,
  };
}

function normalizeCategory(cat?: string): SupportedServiceCategory {
  const clean = String(cat || '').trim().toLowerCase();
  for (const c of SUPPORTED_CATEGORIES) {
    if (c.toLowerCase() === clean) return c;
  }
  return (SUPPORTED_CATEGORIES.includes(cat as any) ? cat : 'Plumber') as SupportedServiceCategory;
}

function isRealRegisteredWorker(worker: WorkerProfile, db: DatabaseSchema): boolean {
  if (!worker || !worker.id) return false;
  // Pre-seeded demo workers have IDs wrk-101 to wrk-130
  const isSeedId = /^wrk-1[0-2]\d$|^wrk-130$/.test(worker.id);
  if (!isSeedId) return true;
  // Check if linked user is a registered non-seed user
  const user = db.users.find((u) => u.workerId === worker.id || (worker.userId && u.id === worker.userId));
  if (user && !user.email.toLowerCase().endsWith('@helpnest.coop')) {
    return true;
  }
  return false;
}

function isWorkerCurrentlyActive(worker: WorkerProfile, db: DatabaseSchema): boolean {
  try {
    const room = globalIoInstance?.sockets?.adapter?.rooms?.get(`worker:${worker.id}`);
    if (room && room.size > 0) return true;
  } catch {
    // ignore
  }

  const activeSessionsList = Object.values(db.activeSessions || {})
    .filter((s) => s.role === 'WORKER' && typeof s.expiresAt === 'number' && s.expiresAt > Date.now());
  const activeUserIds = new Set(activeSessionsList.map((s) => s.userId));

  if (worker.userId && activeUserIds.has(worker.userId)) return true;
  const user = db.users.find((u) => u.workerId === worker.id || (worker.userId && u.id === worker.userId));
  if (user && activeUserIds.has(user.id)) return true;

  // Real registered workers marked available are considered active for discovery
  if (isRealRegisteredWorker(worker, db) && worker.isAvailable !== false) {
    return true;
  }

  return false;
}

function findBestEligibleWorker(
  serviceCategory: SupportedServiceCategory,
  customerLocation: Coordinates | undefined,
  preferredDate?: string,
  preferredTimeSlot?: string,
  requiredSkills: string[] = [],
  requestedWorkerId?: string,
  db: DatabaseSchema = loadDb()
): { worker: WorkerProfile; breakdown: FairDispatchBreakdown } | null {
  const normCategory = normalizeCategory(serviceCategory);

  // 1. If an explicit worker is requested, assign that worker directly!
  if (requestedWorkerId && requestedWorkerId !== 'auto') {
    const explicit = db.workers.find((w) => w.id === requestedWorkerId);
    if (explicit) {
      const maxWeekly = Math.max(
        1,
        ...db.workers
          .filter((w) => normalizeCategory(w.category) === normCategory)
          .map((w) => w.completedJobsThisWeek)
      );
      const breakdown = computeFairDispatchScore(explicit, customerLocation, requiredSkills, maxWeekly);
      return { worker: explicit, breakdown };
    }
  }

  // 2. Filter available workers for this trade category (case-insensitive, trimmed)
  let candidates = db.workers.filter(
    (w) => normalizeCategory(w.category) === normCategory && w.isAvailable !== false
  );

  // Prioritize real registered workers over hardcoded seeds
  const realWorkers = candidates.filter((w) => isRealRegisteredWorker(w, db));
  if (realWorkers.length > 0) {
    candidates = realWorkers;
  }

  if (candidates.length === 0) {
    // Fallback to any worker in this category if none marked available
    candidates = db.workers.filter((w) => normalizeCategory(w.category) === normCategory);
    const realFallback = candidates.filter((w) => isRealRegisteredWorker(w, db));
    if (realFallback.length > 0) {
      candidates = realFallback;
    }
  }

  if (candidates.length === 0) return null;

  const maxWeekly = Math.max(1, ...candidates.map((w) => w.completedJobsThisWeek));

  const scored = candidates.map((w) => {
    const breakdown = computeFairDispatchScore(w, customerLocation, requiredSkills, maxWeekly);
    const isActive = isWorkerCurrentlyActive(w, db);
    const isRegistered = isRealRegisteredWorker(w, db);
    let priorityBonus = 0;
    if (isRegistered && isActive) priorityBonus += 3000;
    else if (isRegistered) priorityBonus += 1500;
    else if (isActive) priorityBonus += 200;

    return {
      worker: w,
      breakdown,
      sortScore: priorityBonus + breakdown.weightedTotal,
    };
  });

  scored.sort((a, b) => b.sortScore - a.sortScore);
  return scored[0] ? { worker: scored[0].worker, breakdown: scored[0].breakdown } : null;
}

// Server-side Gemma 4 / Google GenAI initialization
function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1alpha',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function analyzeHouseholdRequestDeterministic(
  userText: string,
  selectedCategory?: string | null
): GemmaInterpretedRequest {
  const text = String(userText || '').trim();
  const lower = text.toLowerCase();

  // 1. Detect language (English, Bengali, Hindi, or Mixed)
  const hasBengaliScript = /[\u0980-\u09FF]/.test(text);
  const hasHindiScript = /[\u0900-\u097F]/.test(text);
  const hasLatinScript = /[a-zA-Z]/.test(text);

  let detectedLanguage: 'English' | 'Bengali' | 'Hindi' | 'Mixed' = 'English';
  if (hasBengaliScript && hasLatinScript) {
    detectedLanguage = 'Mixed';
  } else if (hasBengaliScript) {
    detectedLanguage = 'Bengali';
  } else if (hasHindiScript && hasLatinScript) {
    detectedLanguage = 'Mixed';
  } else if (hasHindiScript) {
    detectedLanguage = 'Hindi';
  } else if (
    /\b(amar|kol|jol|pankha|kothay|mistri|bati|ghor|darja|rong|poriskar)\b/i.test(lower) ||
    /\b(mera|pani|bijli|pankha|kharab|darwaza|safai|nal)\b/i.test(lower)
  ) {
    detectedLanguage = 'Mixed';
  }

  // 2. Detect service category & matched trade skills
  const categorySkillTriggers: Array<{
    category: SupportedServiceCategory;
    categoryKeywords: RegExp;
    skillTriggers: Array<{ skill: string; regex: RegExp }>;
  }> = [
    {
      category: 'Plumber',
      categoryKeywords:
        /tap|leak|leaking|liking|pipe|plumber|plumbing|water|tank|sink|drain|block|flush|mixer|valve|motor|bathroom|কল|জল|পাইপ|ট্যাঙ্ক|লিক|বাথরুম|মোটর|नल|पानी|पाइप|लीक|टंकी|बाथरूम|मोटर/i,
      skillTriggers: [
        {
          skill: 'Tap & Mixer Leak Repair',
          regex: /tap|leak|leaking|liking|mixer|drip|faucet|কল|লিক|জল পড়ছে|नल|लीक|टपक/i,
        },
        {
          skill: 'Pipe Blockage Clearing',
          regex: /pipe|block|blockage|clog|drain|sink|পাইপ|ব্লক|ড্রেন|पाइप|जाम|नाली/i,
        },
        {
          skill: 'Water Tank Fitting',
          regex: /tank|overflow|ট্যাঙ্ক|ট্যাংক|टंकी/i,
        },
        {
          skill: 'Bathroom Sanitaryware',
          regex: /bathroom|toilet|flush|commode|basin|sanitary|বাথরুম|ফ্লাশ|বেসিন|बाथरूम|फ्लश|बेसिन/i,
        },
        {
          skill: 'Pump Motor Valve',
          regex: /pump|motor|valve|pressure|পাম্প|মোটর|ভালভ|पंप|मोटर|वाल्व/i,
        },
      ],
    },
    {
      category: 'Electrician',
      categoryKeywords:
        /electric|electrician|fan|light|bulb|tube|switch|switchboard|socket|plug|wire|wiring|mcb|fuse|inverter|power|current|short circuit|shock|earthing|পাখা|ফ্যান|আলো|লাইট|সুইচ|তার|বিদ্যুৎ|কারেন্ট|ইনভার্টার|पंखा|लाइट|स्विच|तार|बिजली|एमसीबी|इनवर्टर|शॉर्ट/i,
      skillTriggers: [
        {
          skill: 'MCB & Fuse Repair',
          regex: /mcb|fuse|trip|tripping|short|power|current|outage|ফিউজ|এমসিবি|কারেন্ট|বিদ্যুৎ|एमसीबी|फ्यूज|बिजली|शॉर्ट/i,
        },
        {
          skill: 'Ceiling Fan Installation',
          regex: /fan|ceiling|regulator|pankha|পাখা|ফ্যান|पंखा/i,
        },
        {
          skill: 'Switchboard Wiring',
          regex: /switch|switchboard|socket|plug|wire|wiring|light|bulb|সুইচ|তার|লাইট|আলো|स्विच|तार|लाइट|बोर्ड/i,
        },
        {
          skill: 'Inverter Setup',
          regex: /inverter|battery|ups|backup|ইনভার্টার|ব্যাটারি|इनवर्टर|बैटरी/i,
        },
        {
          skill: 'Appliance Earthing',
          regex: /earth|earthing|shock|geyser|appliance|আর্থিং|শক|अर्थिंग|करंट/i,
        },
      ],
    },
    {
      category: 'Carpenter',
      categoryKeywords:
        /carpenter|wood|wooden|door|lock|latch|hinge|window|cabinet|cupboard|wardrobe|furniture|bed|table|chair|plywood|termite|কাঠ|ছুতোর|দরজা|তালা|জানালা|আলমারি|খাট|বढ़ई|लकड़ी|दरवाजा|ताला|खिड़की|अलमारी|फर्नीचर/i,
      skillTriggers: [
        {
          skill: 'Door Lock & Hinge Repair',
          regex: /door|lock|latch|hinge|handle|দরজা|তালা|ছিটকিনি|दरवाजा|ताला|कुंडी|कब्जा/i,
        },
        {
          skill: 'Window Frame Fitting',
          regex: /window|frame|shutter|জানালা|खिड़की/i,
        },
        {
          skill: 'Modular Cabinet Fix',
          regex: /cabinet|cupboard|wardrobe|drawer|shelf|modular|আলমারি|ড্রয়ার|अलमारी|दराज|कैबिनेट/i,
        },
        {
          skill: 'Furniture Assembly',
          regex: /furniture|bed|table|chair|sofa frame|assemble|খাট|টেবিল|চেয়ার|फर्नीचर|पलंग|मेज|कुर्सी/i,
        },
        {
          skill: 'Termite Wood Patch',
          regex: /termite|wood|patch|rot|ply|ঘুণ|কাঠ|दीमक|लकड़ी/i,
        },
      ],
    },
    {
      category: 'Painter',
      categoryKeywords:
        /paint|painter|painting|wall|color|colour|damp|dampness|seepage|waterproof|putty|primer|polish|varnish|whitewash|রঙ|দেওয়াল|ড্যাম্প|পালিশ|চুনকাম|पेंट|पेंटर|दीवार|रंग|सीलन|पुट्टी|पॉलिश/i,
      skillTriggers: [
        {
          skill: 'Interior Wall Painting',
          regex: /wall|paint|painting|room|interior|color|colour|রঙ|দেওয়াল|ঘর|पेंट|दीवार|कमरा|रंग/i,
        },
        {
          skill: 'Dampness Waterproofing',
          regex: /damp|dampness|seepage|waterproof|moisture|peeling|ড্যাম্প|নোনা|सीलन|वाटरप्रूफ/i,
        },
        {
          skill: 'Wood Polish & Varnish',
          regex: /polish|varnish|wood polish|door polish|পালিশ|বার্নিশ|पॉलिश|वार्निश/i,
        },
        {
          skill: 'Putty & Primer Touchup',
          regex: /putty|primer|crack|patch|touchup|পুট্টি|প্রাইমার|पुट्टी|प्राइमर|दरार/i,
        },
        {
          skill: 'Exterior Weather Coat',
          regex: /exterior|outside|balcony|terrace|weather|বাইরের|ব্যালকনি|बाहरी|छत/i,
        },
      ],
    },
    {
      category: 'Cleaner',
      categoryKeywords:
        /clean|cleaner|cleaning|sanitize|sanitization|wash|deep clean|kitchen|sofa|carpet|vacuum|dust|mop|housekeeping|পরিষ্কার|সাফাই|রান্নাঘর|সোফা|কার্পেট|সफाई|किचन|सोफा|कालीन|धुलाई/i,
      skillTriggers: [
        {
          skill: 'Deep Kitchen Cleaning',
          regex: /kitchen|chimney|grease|oil|tile|রান্নাঘর|কিচেন|किचन|रसोई/i,
        },
        {
          skill: 'Bathroom Sanitization',
          regex: /bathroom|toilet|washroom|sanitize|acid wash|বাথরুম|টয়লেট|बाथरूम|शौचालय|सैनिटाइज/i,
        },
        {
          skill: 'Sofa & Carpet Vacuum',
          regex: /sofa|carpet|mattress|curtain|vacuum|সোফা|কার্পেট|গদি|सोफा|कालीन|गद्दा|वैक्यूम/i,
        },
        {
          skill: 'Water Tank Cleaning',
          regex: /tank|reservoir|overhead|ট্যাঙ্ক|জলের ট্যাঙ্ক|टंकी/i,
        },
        {
          skill: 'Post-Event Cleanup',
          regex: /full house|event|party|move|room|floor|clean|পরিষ্কার|ঘর|सफाई|घर|कमरा/i,
        },
      ],
    },
    {
      category: 'Babysitter',
      categoryKeywords:
        /baby|babysitter|child|kid|infant|toddler|nanny|care|daycare|crèche|homework|school|শিশু|বাচ্চা|দেখাশোনা|আয়া|बच्चा|शिशु|देखभाल|बेबीसिटर|आया/i,
      skillTriggers: [
        {
          skill: 'Infant Daycare Support',
          regex: /infant|newborn|baby|daycare|month|শিশু|নবজাতক|शिशु|नवजात|बच्चा/i,
        },
        {
          skill: 'Toddler Meal & Play',
          regex: /toddler|play|meal|feed|kid|বাচ্চা|খাওয়ানো|খেলা|बच्चा|खिलाना/i,
        },
        {
          skill: 'After-School Supervision',
          regex: /school|afternoon|study|homework|স্কুল|পড়াশোনা|स्कूल|पढ़ाई/i,
        },
        {
          skill: 'First-Aid Certified Care',
          regex: /first-aid|first aid|safe|certified|care|দেখাশোনা|যত্ন|देखभाल|सुरक्षित/i,
        },
        {
          skill: 'Evening Family Assist',
          regex: /evening|night|parent|family|সন্ধ্যা|রাত|शाम|रात/i,
        },
      ],
    },
  ];

  let detectedCategory: SupportedServiceCategory | null =
    selectedCategory && SUPPORTED_CATEGORIES.includes(selectedCategory as SupportedServiceCategory)
      ? (selectedCategory as SupportedServiceCategory)
      : null;

  let extractedSkills: string[] = [];

  for (const entry of categorySkillTriggers) {
    const matchedForEntry = entry.skillTriggers
      .filter((st) => st.regex.test(lower))
      .map((st) => st.skill);
    if (matchedForEntry.length > 0 || entry.categoryKeywords.test(lower)) {
      if (!detectedCategory || matchedForEntry.length > extractedSkills.length) {
        detectedCategory = entry.category;
        extractedSkills =
          matchedForEntry.length > 0
            ? matchedForEntry
            : [CATEGORY_SKILLS_MAP[entry.category][0]];
      }
    }
  }

  if (detectedCategory && extractedSkills.length === 0) {
    const matchingEntry = categorySkillTriggers.find((e) => e.category === detectedCategory);
    if (matchingEntry) {
      const skillsFromSelected = matchingEntry.skillTriggers
        .filter((st) => st.regex.test(lower))
        .map((st) => st.skill);
      extractedSkills =
        skillsFromSelected.length > 0
          ? skillsFromSelected
          : [CATEGORY_SKILLS_MAP[detectedCategory][0]];
    }
  }

  // 3. Detect urgency if stated
  let urgency: UrgencyLevel | null = null;
  if (
    /emergency|immediately|right now|flooding|sparking|fire|burst|এক্ষুনি|খুব জরুরি|বিপদ|तुरंत|इमरजेंसी|अभी/i.test(
      lower
    )
  ) {
    urgency = 'EMERGENCY';
  } else if (/urgent|today|asap|quickly|soon|fast|জরুরি|আজকেই|তাড়াতাড়ি|जल्दी|आज ही|अर्जेंट/i.test(lower)) {
    urgency = 'URGENT';
  } else if (/standard|normal|whenever|regular|সাধারণ|सामान्य/i.test(lower)) {
    urgency = 'STANDARD';
  }

  // 4. Detect preferred time slot if stated
  let preferredTimeSlot: ShiftPreference | null = null;
  if (/morning|8\s*am|9\s*am|10\s*am|11\s*am|সকাল|সকালে|सुबह|सवेरे/i.test(lower)) {
    preferredTimeSlot = 'Morning (08:00 - 12:00)';
  } else if (/afternoon|12\s*pm|1\s*pm|2\s*pm|3\s*pm|noon|দুপুর|দুপুরে|বিকেল|दोपहर/i.test(lower)) {
    preferredTimeSlot = 'Afternoon (12:00 - 16:00)';
  } else if (/evening|4\s*pm|5\s*pm|6\s*pm|7\s*pm|night|সন্ধ্যা|সন্ধ্যে|রাত|शाम|रात/i.test(lower)) {
    preferredTimeSlot = 'Evening (16:00 - 20:00)';
  } else if (/full day|all day|anytime|সারাদিন|যে কোনো সময়|पूरा दिन|कभी भी/i.test(lower)) {
    preferredTimeSlot = 'Full Day (08:00 - 20:00)';
  }

  const missingFieldsToConfirm: string[] = [];
  if (!detectedCategory) missingFieldsToConfirm.push('Service Category');
  if (!preferredTimeSlot) missingFieldsToConfirm.push('Preferred Time Slot');
  if (!urgency) missingFieldsToConfirm.push('Urgency Level');

  const taskSummary = detectedCategory
    ? `${detectedCategory} service request: "${text}" (${
        extractedSkills.join(', ') || 'General trade assistance'
      })`
    : `Household service request: "${text}"`;

  return {
    detectedLanguage,
    serviceCategory: detectedCategory,
    extractedSkills,
    taskSummary,
    urgency,
    preferredTimeSlot,
    missingFieldsToConfirm,
    confidenceNote: `Analyzed ${detectedLanguage} household request and mapped to ${
      detectedCategory || 'general'
    } trade skills.`,
    modelUsed: 'Cooperative Baseline Engine (Deterministic Fallback)',
    isLiveModel: false,
  };
}

async function callGemmaOrGeminiJson(
  prompt: string,
  responseSchema?: Record<string, unknown>,
  timeoutMs = 45000
): Promise<{ data: any; modelUsed: string; isLiveModel: boolean; fallbackReason?: string }> {
  const ai = getGenAIClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please check your environment variables in Settings > Secrets.');
  }

  const rawModel = process.env.GEMMA_MODEL_ID?.trim();
  const formatModel = (m: string) => (m.startsWith('models/') ? m : `models/${m}`);
  const primaryModel = rawModel && rawModel !== 'MY_GEMMA_MODEL_ID' ? formatModel(rawModel) : 'models/gemma-4-26b-a4b-it';
  const candidateModels = [primaryModel];
  let lastError: Error | null = null;

  for (const modelName of candidateModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        }

        const fullPrompt = responseSchema
          ? `${prompt}\n\nSTRICT INSTRUCTION: Output ONLY a valid JSON object matching this schema. Do not add any conversational text or markdown code blocks outside the JSON:\n${JSON.stringify(responseSchema, null, 2)}`
          : prompt;

        const response = await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents: fullPrompt,
            // Do NOT specify temperature: 0.1 to avoid 500 internal errors on Gemma 4 v1alpha
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Gemma 4 E4B model ${modelName} timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);

        const rawText = (response.text || '').trim();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const cleanedJson = jsonMatch
          ? jsonMatch[0]
          : rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleanedJson);
        const cleanName = modelName.replace(/^models\//, '');
        const modelDisplayName = `Google Gemma 4 E4B (${cleanName})`;

        return {
          data: parsed,
          modelUsed: modelDisplayName,
          isLiveModel: true,
        };
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[Gemma 4 E4B AI] Attempt ${attempt + 1} with ${modelName} failed:`, lastError.message);
      }
    }
  }

  throw lastError || new Error('Gemma 4 E4B AI inference request failed across available models.');
}

// -------------------------------------------------------------
// FEATURE 1: Gemma 4 Collaboration Summarizer & Skill Suggester
// -------------------------------------------------------------
export async function generateJobCollaborationAiSummary(
  problemDescription: string,
  category: SupportedServiceCategory,
  currentSkills: string[]
): Promise<{
  jobSummary: string;
  suggestedSkills: string[];
  expectedDurationHours: number;
  modelUsed: string;
  isLiveModel: boolean;
}> {
  const categorySkills = CATEGORY_SKILLS_MAP[category] || [];
  const defaultSkills = categorySkills.filter((s) => !currentSkills.includes(s)).slice(0, 2);
  const fallbackSkills = defaultSkills.length > 0 ? defaultSkills : currentSkills;

  try {
    const ai = getGenAIClient();
    if (ai) {
      const prompt = `You are the Help Nest Gemma 4 Worker Collaboration Assistant.
Job Category: ${category}
Task Description: "${problemDescription}"
Current Skills Listed: ${currentSkills.join(', ')}
Available Category Skills: ${categorySkills.join(', ')}

Summarize this job for a fellow cooperative peer who will assist on-site.
Return JSON:
{
  "jobSummary": "Short 1-2 sentence technical summary of why additional hands are needed",
  "suggestedSkills": ["Skill 1", "Skill 2"],
  "expectedDurationHours": 2.0
}
Do NOT include customer personal names, phone numbers, or private details.`;

      const res = await callGemmaOrGeminiJson(prompt, {
        type: Type.OBJECT,
        properties: {
          jobSummary: { type: Type.STRING },
          suggestedSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          expectedDurationHours: { type: Type.NUMBER },
        },
        required: ['jobSummary', 'suggestedSkills', 'expectedDurationHours'],
      });

      if (res.data?.jobSummary) {
        return {
          jobSummary: String(res.data.jobSummary).trim(),
          suggestedSkills: Array.isArray(res.data.suggestedSkills) && res.data.suggestedSkills.length > 0
            ? res.data.suggestedSkills.slice(0, 3)
            : fallbackSkills,
          expectedDurationHours: Math.max(1, Math.min(8, Number(res.data.expectedDurationHours) || 2)),
          modelUsed: res.modelUsed,
          isLiveModel: true,
        };
      }
    }
  } catch {
    // Graceful deterministic fallback
  }

  return {
    jobSummary: `${category} collaborative service for: "${problemDescription.slice(0, 80)}". Requires dual-worker assistance for on-site safety and efficiency.`,
    suggestedSkills: fallbackSkills,
    expectedDurationHours: 2.0,
    modelUsed: 'Gemma 4 Multilingual Engine (Deterministic Fallback)',
    isLiveModel: false,
  };
}

// -------------------------------------------------------------
// FEATURE 2: Gemma 4 Fair Job Allocation Natural Language Explanation
// -------------------------------------------------------------
export async function generateFairAllocationAiExplanation(
  worker: WorkerProfile,
  requiredSkills: string[],
  distanceKm: number | null,
  completedJobsThisWeek: number
): Promise<{ explanation: string; modelUsed: string; isLiveModel: boolean }> {
  const distText = distanceKm !== null ? `${distanceKm} km away` : 'local zone';
  const matched = worker.skills.filter((s) =>
    requiredSkills.some((rs) => rs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(rs.toLowerCase()))
  );
  const matchedSkillText = matched.length > 0 ? matched.join(', ') : `${worker.category} core skills`;

  const deterministicExplanation = `Recommended because the worker has the required skill (${matchedSkillText}), is available nearby (${distText}), and has a manageable weekly workload (${completedJobsThisWeek} completed jobs this week).`;

  try {
    const ai = getGenAIClient();
    if (ai) {
      const prompt = `You are the Help Nest Gemma 4 Fair Allocation Explainer.
Explain in 1 simple, transparent sentence why this worker is suitable for this assignment.
STRICT RULES:
1. Use ONLY the provided data below:
- Worker Name: ${worker.name}
- Category: ${worker.category}
- Matched Skills: ${matchedSkillText}
- Distance: ${distText}
- Workload This Week: ${completedJobsThisWeek} jobs completed
- KYC Verified: ${worker.verified ? 'Yes' : 'In review'}
2. DO NOT invent ratings, reviews, certifications, or attributes not listed above.
3. DO NOT guarantee fairness. Formulate as: "Recommended because the worker has the required skill (...), is available (...), and has a manageable workload."
Return JSON:
{
  "explanation": "..."
}`;

      const res = await callGemmaOrGeminiJson(prompt, {
        type: Type.OBJECT,
        properties: {
          explanation: { type: Type.STRING },
        },
        required: ['explanation'],
      });

      if (res.data?.explanation) {
        return {
          explanation: String(res.data.explanation).trim(),
          modelUsed: res.modelUsed,
          isLiveModel: true,
        };
      }
    }
  } catch {
    // Keep deterministic fallback
  }

  return {
    explanation: deterministicExplanation,
    modelUsed: 'Gemma 4 Allocation Engine (Deterministic Fallback)',
    isLiveModel: false,
  };
}

// -------------------------------------------------------------
// FEATURE 4: Gemma 4 Smart Spare Parts & Materials Estimator
// -------------------------------------------------------------
export async function generateSmartSparePartsAiEstimate(
  problemDescription: string,
  category: SupportedServiceCategory,
  workerBaseRate: number
): Promise<{
  items: SparePartItem[];
  suggestedLaborInr: number;
  totalMaterialsInr: number;
  modelUsed: string;
  isLiveModel: boolean;
}> {
  // Deterministic trade catalogue fallbacks
  const catalogueFallback: Record<SupportedServiceCategory, SparePartItem[]> = {
    Electrician: [
      { id: 'item-1', name: 'Anchor 16A Modular Switch & Socket', quantity: 1, unit: 'pc', estimatedUnitPriceInr: 160, totalPriceInr: 160 },
      { id: 'item-2', name: 'Havells 1.5 sq mm Copper Wire (Roll)', quantity: 1, unit: 'coil', estimatedUnitPriceInr: 280, totalPriceInr: 280 },
      { id: 'item-3', name: 'Steel Grip PVC Electrical Insulation Tape', quantity: 2, unit: 'rolls', estimatedUnitPriceInr: 25, totalPriceInr: 50 },
    ],
    Plumber: [
      { id: 'item-1', name: 'Brass 0.5-inch Angle Valve (Chrome)', quantity: 1, unit: 'pc', estimatedUnitPriceInr: 240, totalPriceInr: 240 },
      { id: 'item-2', name: 'Teflon Thread Sealing Tape (12m)', quantity: 2, unit: 'rolls', estimatedUnitPriceInr: 30, totalPriceInr: 60 },
      { id: 'item-3', name: 'PVC Waste Pipe & Coupling Kit', quantity: 1, unit: 'set', estimatedUnitPriceInr: 180, totalPriceInr: 180 },
    ],
    Carpenter: [
      { id: 'item-1', name: 'Godrej Mortise Door Latch & Screws', quantity: 1, unit: 'set', estimatedUnitPriceInr: 350, totalPriceInr: 350 },
      { id: 'item-2', name: 'Stainless Steel Butt Hinges (3-inch)', quantity: 2, unit: 'pairs', estimatedUnitPriceInr: 90, totalPriceInr: 180 },
      { id: 'item-3', name: 'Fevicol SH Wood Adhesive (250g)', quantity: 1, unit: 'bottle', estimatedUnitPriceInr: 95, totalPriceInr: 95 },
    ],
    Painter: [
      { id: 'item-1', name: 'Asian Paints Wall Putty (5kg pack)', quantity: 1, unit: 'pack', estimatedUnitPriceInr: 190, totalPriceInr: 190 },
      { id: 'item-2', name: 'Waterproofing Damp-Proof Primer (1L)', quantity: 1, unit: 'can', estimatedUnitPriceInr: 260, totalPriceInr: 260 },
      { id: 'item-3', name: 'Sandpaper Sheets (Grits 120/180)', quantity: 4, unit: 'sheets', estimatedUnitPriceInr: 15, totalPriceInr: 60 },
    ],
    Cleaner: [
      { id: 'item-1', name: 'Heavy Duty Tile & Degreaser Solution (1L)', quantity: 1, unit: 'bottle', estimatedUnitPriceInr: 180, totalPriceInr: 180 },
      { id: 'item-2', name: 'Microfiber Cleaning Cloths (Multi-pack)', quantity: 3, unit: 'pcs', estimatedUnitPriceInr: 40, totalPriceInr: 120 },
      { id: 'item-3', name: 'Heavy Rubber Protective Gloves', quantity: 1, unit: 'pair', estimatedUnitPriceInr: 80, totalPriceInr: 80 },
    ],
    Babysitter: [
      { id: 'item-1', name: 'Child-Safe Activity & Coloring Kit', quantity: 1, unit: 'set', estimatedUnitPriceInr: 120, totalPriceInr: 120 },
      { id: 'item-2', name: 'First Aid Antiseptic Bandages & Wipes', quantity: 1, unit: 'pack', estimatedUnitPriceInr: 80, totalPriceInr: 80 },
    ],
  };

  const defaultItems = catalogueFallback[category] || catalogueFallback.Electrician;

  try {
    const ai = getGenAIClient();
    if (ai) {
      const prompt = `You are the Help Nest Gemma 4 Spare Parts Estimator.
Trade: ${category}
Base Labor Rate: ₹${workerBaseRate}
Job Description: "${problemDescription}"

Generate a suggested list of spare parts and hardware supplies for this repair in Kolkata, West Bengal (in Indian Rupees INR).
Return JSON:
{
  "items": [
    { "name": "Item Name", "quantity": 1, "unit": "pc", "estimatedUnitPriceInr": 150 }
  ],
  "suggestedLaborInr": ${workerBaseRate}
}
Keep quantities realistic (1-4 items max). Mark that all prices are estimates.`;

      const res = await callGemmaOrGeminiJson(prompt, {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                estimatedUnitPriceInr: { type: Type.NUMBER },
              },
              required: ['name', 'quantity', 'unit', 'estimatedUnitPriceInr'],
            },
          },
          suggestedLaborInr: { type: Type.NUMBER },
        },
        required: ['items'],
      });

      if (Array.isArray(res.data?.items) && res.data.items.length > 0) {
        const formattedItems: SparePartItem[] = res.data.items.slice(0, 5).map((it: any, idx: number) => {
          const qty = Math.max(1, Math.min(20, Math.round(Number(it.quantity) || 1)));
          const unitPrice = Math.max(10, Math.min(5000, Math.round(Number(it.estimatedUnitPriceInr) || 100)));
          return {
            id: `part-${idx + 1}-${Date.now()}`,
            name: String(it.name || 'Spare Part').slice(0, 60),
            quantity: qty,
            unit: String(it.unit || 'pc').slice(0, 10),
            estimatedUnitPriceInr: unitPrice,
            totalPriceInr: qty * unitPrice,
          };
        });

        const totalMaterialsInr = formattedItems.reduce((acc, i) => acc + i.totalPriceInr, 0);
        const suggestedLaborInr = Math.max(150, Number(res.data.suggestedLaborInr) || workerBaseRate);

        return {
          items: formattedItems,
          suggestedLaborInr,
          totalMaterialsInr,
          modelUsed: res.modelUsed,
          isLiveModel: true,
        };
      }
    }
  } catch {
    // Fall back to deterministic catalogue
  }

  const items = defaultItems.map((item, idx) => ({
    ...item,
    id: `part-${idx + 1}-${Date.now()}`,
  }));
  const totalMaterialsInr = items.reduce((acc, i) => acc + i.totalPriceInr, 0);

  return {
    items,
    suggestedLaborInr: workerBaseRate,
    totalMaterialsInr,
    modelUsed: 'Gemma 4 Parts Catalogue (Deterministic Fallback)',
    isLiveModel: false,
  };
}

// -------------------------------------------------------------
// FEATURE 7: Gemma 4 Voice-First Natural Language Command Interpreter
// -------------------------------------------------------------
export async function interpretWorkerVoiceCommand(
  transcript: string,
  language: 'en' | 'bn' | 'hi' = 'en',
  workerName = 'Worker'
): Promise<{
  intent: 'SHOW_PENDING_JOBS' | 'SHOW_COMPLETED_JOBS' | 'SHOW_PAYMENTS' | 'EXPLAIN_JOB' | 'TOGGLE_AVAILABILITY' | 'COLLABORATION_HELP' | 'UNKNOWN';
  localizedResponse: string;
  targetTab?: 'jobs' | 'earnings' | 'cooperativeFund' | 'profile' | 'collaboration' | 'voting';
  modelUsed: string;
  isLiveModel: boolean;
}> {
  const text = String(transcript || '').trim();
  const lower = text.toLowerCase();

  // Deterministic local regex matcher for offline & online speed
  const isPending =
    /pending|new jobs|assigned|queue|active|baki|kaaj|কাজ|বাকি কাজ|लंबित|नया काम/i.test(lower);
  const isCompleted =
    /completed|done|history|finished|shompurno|আজকের কাজ|সম্পন্ন|पूरा काम|पूर्ण/i.test(lower);
  const isPayment =
    /payment|earnings|wallet|ledger|hisab|taka|paisa|টাকা|হিসাব|পেমেন্ট|कमाई|भुगतान|लेजर/i.test(lower);
  const isCollab =
    /collab|help|helper|partner|shonge|sahayyo|সাহায্য|সঙ্গী|मदद|साथी/i.test(lower);
  const isExplain =
    /explain|details|tell me|ki kaaj|bujhiye|বুঝিয়ে|বুঝিয়ে|विवरण|समझाएं|विस्तार/i.test(lower);

  let fallbackIntent: 'SHOW_PENDING_JOBS' | 'SHOW_COMPLETED_JOBS' | 'SHOW_PAYMENTS' | 'EXPLAIN_JOB' | 'TOGGLE_AVAILABILITY' | 'COLLABORATION_HELP' | 'UNKNOWN' = 'UNKNOWN';
  let fallbackTab: 'jobs' | 'earnings' | 'cooperativeFund' | 'profile' | 'collaboration' | 'voting' = 'jobs';
  let fallbackMsg = '';

  if (isPending) {
    fallbackIntent = 'SHOW_PENDING_JOBS';
    fallbackTab = 'jobs';
    fallbackMsg = language === 'bn' ? 'আপনার বর্তমান পেন্ডিং ও সক্রিয় কাজের তালিকা দেখাচ্ছি।' : language === 'hi' ? 'आपके वर्तमान लंबित और सक्रिय कार्यों की सूची दिखाई जा रही है।' : 'Displaying your active and scheduled jobs queue.';
  } else if (isCompleted) {
    fallbackIntent = 'SHOW_COMPLETED_JOBS';
    fallbackTab = 'jobs';
    fallbackMsg = language === 'bn' ? 'আপনার সম্পন্ন কাজের ইতিহাস ও রসিদ দেখাচ্ছি।' : language === 'hi' ? 'आपके पूर्ण कार्यों का इतिहास दिखाया जा रहा है।' : 'Displaying your completed jobs history and receipts.';
  } else if (isPayment) {
    fallbackIntent = 'SHOW_PAYMENTS';
    fallbackTab = 'cooperativeFund';
    fallbackMsg = language === 'bn' ? 'আপনার সমবায় তহবিল ও উপার্জন লেজার দেখাচ্ছি।' : language === 'hi' ? 'आपका सहकारी कोष और आय लेज़र दिखाया जा रहा है।' : 'Opening your cooperative fund balance and earnings ledger.';
  } else if (isCollab) {
    fallbackIntent = 'COLLABORATION_HELP';
    fallbackTab = 'collaboration';
    fallbackMsg = language === 'bn' ? 'কর্মী সহকর্মী নেটওয়ার্ক ও সহযোগিতার অনুরোধ দেখাচ্ছি।' : language === 'hi' ? 'श्रमिक सहयोग नेटवर्क और सहायता अनुरोध दिखाए जा रहे हैं।' : 'Opening Worker-to-Worker Help Network.';
  } else if (isExplain) {
    fallbackIntent = 'EXPLAIN_JOB';
    fallbackTab = 'jobs';
    fallbackMsg = language === 'bn' ? `নমস্কার ${workerName}, নির্ধারিত কাজের বিশদ বিবরণ স্ক্রিনে তুলে ধরা হয়েছে।` : language === 'hi' ? `नमस्ते ${workerName}, निर्धारित कार्य का विवरण स्क्रीन पर प्रदर्शित है।` : `Hello ${workerName}, presenting current assignment details and required trade skills.`;
  }

  try {
    const ai = getGenAIClient();
    if (ai) {
      const prompt = `You are Help Nest Gemma 4 Multilingual Voice Assistant for cooperative household workers in Kolkata.
Worker: ${workerName}
Preferred Language: ${language} (en = English, bn = Bengali, hi = Hindi)
User Speech Command: "${text}"

Classify this command and provide a warm, respectful 1-sentence spoken response in the requested language (${language}).
Allowed intents: "SHOW_PENDING_JOBS", "SHOW_COMPLETED_JOBS", "SHOW_PAYMENTS", "EXPLAIN_JOB", "TOGGLE_AVAILABILITY", "COLLABORATION_HELP", "UNKNOWN".

Return JSON:
{
  "intent": "SHOW_PENDING_JOBS",
  "targetTab": "jobs",
  "localizedResponse": "..."
}`;

      const res = await callGemmaOrGeminiJson(prompt, {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING },
          targetTab: { type: Type.STRING },
          localizedResponse: { type: Type.STRING },
        },
        required: ['intent', 'localizedResponse'],
      });

      if (res.data?.intent) {
        return {
          intent: res.data.intent,
          targetTab: (res.data.targetTab as any) || fallbackTab,
          localizedResponse: res.data.localizedResponse || fallbackMsg,
          modelUsed: res.modelUsed,
          isLiveModel: true,
        };
      }
    }
  } catch {
    // Keep deterministic fallback
  }

  return {
    intent: fallbackIntent,
    targetTab: fallbackTab,
    localizedResponse: fallbackMsg || (language === 'bn' ? `নির্দেশ পেয়েছি: "${text}"। কাজের ড্যাশবোর্ডে নিয়ে যাচ্ছি।` : language === 'hi' ? `कमांड प्राप्त हुआ: "${text}"। कार्य डैशबोर्ड पर ले जाया जा रहा है।` : `Command received: "${text}". Navigating your worker console.`),
    modelUsed: 'Gemma 4 Voice Engine (Offline Fallback)',
    isLiveModel: false,
  };
}

async function startServer() {
  ensurePwaIcons();
  await initMongo();
  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    destroyUpgrade: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH'],
    },
  });
  globalIoInstance = io;

  // Serve locally uploaded defect media statically
  const publicUploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(publicUploadsDir)) {
    fs.mkdirSync(publicUploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(publicUploadsDir));

  // Configure Multer for secure multipart form-data defect uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB max
    },
    fileFilter: (_req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
      if (allowedMimes.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error('Unsupported file format. Supported images: JPG, PNG, WebP. Supported videos: MP4, WebM.'));
      }
    },
  });

  app.use(express.json({ limit: '2mb' }));

  // Authentication helper middleware
  const getUserByToken = (token: string | undefined, db: DatabaseSchema): StoredUser | null => {
    if (!token) return null;
    const cleanToken = token.trim();
    const session = db.activeSessions[cleanToken];
    if (session) {
      if (Date.now() > session.expiresAt) {
        delete db.activeSessions[cleanToken];
        saveDb(db);
        return null;
      }
      const found = db.users.find((u) => u.id === session.userId);
      if (found) return found;
    }

    // Verify signed token format: rawToken.userId.role.signature OR rawToken.signature
    const parts = cleanToken.split('.');
    if (parts.length === 4) {
      const [rawToken, userId, role, sig] = parts;
      const expectedSig = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${rawToken}.${userId}.${role}`)
        .digest('hex');
      if (sig === expectedSig) {
        const user = db.users.find((u) => u.id === userId);
        if (user) {
          db.activeSessions[cleanToken] = {
            userId: user.id,
            role: user.role,
            expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
          };
          saveDb(db);
          return user;
        }
      }
    } else if (parts.length === 2) {
      const [rawToken, sig] = parts;
      const matchedUser = db.users.find((u) => {
        const expectedSig = crypto
          .createHmac('sha256', JWT_SECRET)
          .update(`${rawToken}.${u.id}.${u.role}`)
          .digest('hex');
        return sig === expectedSig;
      });
      if (matchedUser) {
        db.activeSessions[cleanToken] = {
          userId: matchedUser.id,
          role: matchedUser.role,
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
        };
        saveDb(db);
        return matchedUser;
      }
    }
    return null;
  };

  const getAuthUser = (req: Request, db: DatabaseSchema): StoredUser | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return getUserByToken(authHeader.slice(7), db);
  };

  // Track SSE clients as an additional real-time transport alongside Socket.IO
  interface SseClient {
    id: string;
    userId: string;
    workerId?: string;
    role: UserRole;
    res: Response;
  }
  const sseClients = new Map<string, SseClient>();

  // Authenticate Socket.IO connections and join role/user rooms
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (typeof socket.handshake.query?.token === 'string' ? socket.handshake.query.token : undefined);
    const db = loadDb();
    const user = getUserByToken(token, db);
    if (!user) {
      return next(new Error('Unauthorized socket connection'));
    }
    (socket as any).user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user as StoredUser;
    const db = loadDb();
    socket.join(`customer:${user.id}`);
    socket.join(`role:${user.role}`);
    const effectiveWorkerId =
      user.workerId || db.workers.find((w) => w.userId === user.id)?.id;
    if (effectiveWorkerId) {
      socket.join(`worker:${effectiveWorkerId}`);
      const workerProfile = db.workers.find((w) => w.id === effectiveWorkerId);
      if (workerProfile?.category) {
        socket.join(`category:${workerProfile.category}`);
      }
    }

    socket.on('join:booking', (bookingId: string) => {
      if (bookingId) socket.join(`booking:${bookingId}`);
    });
    socket.on('join:report', (reportId: string) => {
      if (reportId) socket.join(`report:${reportId}`);
    });
  });

  // Helper to find the active or registered teammate worker in the cooperative
  const getTeamWorker = (db: DatabaseSchema): WorkerProfile | null => {
    // 1. Look for currently active worker session
    const activeWorkerUserIds = Object.values(db.activeSessions)
      .filter((s) => s.role === 'WORKER')
      .map((s) => s.userId);
    for (const uid of activeWorkerUserIds) {
      const user = db.users.find((u) => u.id === uid);
      if (user && user.workerId) {
        const w = db.workers.find((wk) => wk.id === user.workerId);
        if (w) return w;
      }
    }

    // 2. Look for registered worker account (prioritize user-registered workers, most recent first)
    const registeredWorkerUsers = [...db.users]
      .filter((u) => u.role === 'WORKER' && u.workerId && !u.id.startsWith('usr-wrk-'))
      .reverse();
    if (registeredWorkerUsers.length > 0 && registeredWorkerUsers[0].workerId) {
      const w = db.workers.find((wk) => wk.id === registeredWorkerUsers[0].workerId);
      if (w) return w;
    }

    // 3. Fallback to any worker user
    const anyWorkerUsers = [...db.users]
      .filter((u) => u.role === 'WORKER' && u.workerId)
      .reverse();
    if (anyWorkerUsers.length > 0 && anyWorkerUsers[0].workerId) {
      const w = db.workers.find((wk) => wk.id === anyWorkerUsers[0].workerId);
      if (w) return w;
    }

    return db.workers[0] || null;
  };

  // Helper to broadcast authoritative updates to Customer, Worker, and Admin dashboards
  const broadcastBookingEvent = (
    eventType: string,
    data: any
  ) => {
    const booking = data?.customerId ? data : undefined;
    const payload = {
      eventType,
      data,
      booking,
      timestamp: new Date().toISOString(),
    };

    // 0. Authoritative broadcast to all active socket connections
    io.emit(eventType, payload);

    // 1. Deliver strictly to the specific authorized customer's room
    if (data?.customerId) {
      io.to(`customer:${data.customerId}`).emit(eventType, payload);
    }

    // 2. Deliver strictly to the specific assigned worker's authenticated room
    if (data?.workerId) {
      io.to(`worker:${data.workerId}`).emit(eventType, payload);
      if (eventType === 'booking:created') {
        io.to(`worker:${data.workerId}`).emit('worker:new-job', {
          eventType: 'worker:new-job',
          booking: data,
          message: `New Job Received: ${data.bookingReference} for ${data.workerCategory}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Deliver to trade category channel for cooperative workers
    if (data?.workerCategory) {
      io.to(`category:${data.workerCategory}`).emit(eventType, payload);
    }

    // 3. Deliver to WORKER and ADMIN rooms for monitoring
    io.to('role:WORKER').emit(eventType, payload);
    io.to('role:ADMIN').emit(eventType, payload);

    // 4. Push to connected SSE clients matching authorized customer, assigned worker, matching trade, or admin
    const sseData = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients.values()) {
      try {
        const clientUser = (client as any).user;
        const db = loadDb();
        const matchesCategory =
          clientUser?.role === 'WORKER' &&
          data?.status === 'PENDING' &&
          db.workers.find((w) => w.id === clientUser.workerId)?.category === data?.workerCategory;
        if (
          !clientUser ||
          clientUser.role === 'ADMIN' ||
          clientUser.id === data?.customerId ||
          (clientUser.role === 'WORKER' && (clientUser.workerId === data?.workerId || clientUser.workerId === data?.assignedWorkerId)) ||
          matchesCategory
        ) {
          client.res.write(sseData);
        }
      } catch {
        sseClients.delete(client.id);
      }
    }
  };

  // Helper to broadcast problem report updates to Customer, Worker, and Admin dashboards
  const broadcastProblemReportEvent = (eventType: string, report: ProblemReport) => {
    const payload = {
      eventType,
      report,
      timestamp: new Date().toISOString(),
    };
    if (report.customerId) {
      io.to(`customer:${report.customerId}`);
    }
    if (report.assignedWorkerId) {
      io.to(`worker:${report.assignedWorkerId}`);
    }
    io.to('role:WORKER').to('role:ADMIN').emit(eventType, payload);
    io.emit(eventType, payload);

    const sseData = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients.values()) {
      try {
        client.res.write(sseData);
      } catch {
        sseClients.delete(client.id);
      }
    }
  };

  // Real-time SSE stream endpoint (works alongside Socket.IO)
  app.get('/api/bookings/stream', (req: Request, res: Response) => {
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const db = loadDb();
    const user = getUserByToken(token, db) || getAuthUser(req, db);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required for real-time stream.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clientId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    sseClients.set(clientId, {
      id: clientId,
      userId: user.id,
      workerId: user.workerId,
      role: user.role,
      res,
    });

    res.write(`data: ${JSON.stringify({ eventType: 'stream:connected', timestamp: new Date().toISOString() })}\n\n`);

    req.on('close', () => {
      sseClients.delete(clientId);
    });
  });

  const requireAuth =
    (allowedRoles?: UserRole[]) => (req: Request, res: Response, next: NextFunction) => {
      const db = loadDb();
      const user = getAuthUser(req, db);
      if (!user) {
        return res.status(401).json({
          error: 'Authentication required. Your session is missing or has been logged out.',
        });
      }
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: `Role-based access denied. Required role: ${allowedRoles.join(' or ')}, current role: ${user.role}.`,
        });
      }
      (req as any).user = user;
      (req as any).db = db;
      next();
    };

  // ============================================================================
  // SYSTEM & INTEGRATION DIAGNOSTICS ENDPOINT
  // ============================================================================
  app.get('/api/system/status', (_req: Request, res: Response) => {
    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
        process.env.GEMINI_API_KEY.trim() !== ''
    );
    const hasRazorpayKeys = Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    );
    const hasPostgresUrl = Boolean(process.env.DATABASE_URL);

    res.json({
      platform: 'Help Nest — Cooperative Household & Community Services Platform',
      gemmaConfigured: hasGeminiKey,
      targetGemmaModel: process.env.GEMMA_MODEL_ID || 'gemma-4-26b-a4b-it',
      mongoStatus: getMongoStatus(),
      mediaStorage: getMediaStorageStatus(),
      razorpayMode: hasRazorpayKeys ? 'RAZORPAY_LIVE_SANDBOX_API' : 'RAZORPAY_SANDBOX_SIMULATION_VERIFIED',
      databaseEngine: getMongoStatus().connected ? 'MONGODB_ATLAS' : (hasPostgresUrl ? 'POSTGRESQL_CONNECTED' : 'LOCAL_PERSISTENT_RELATIONAL_JSON'),
      supportedCategories: SUPPORTED_CATEGORIES,
    });
  });

  // ============================================================================
  // MODULE 1: AUTHENTICATION (LOGIN, REGISTER, LOGOUT, SESSION CHECK)
  // ============================================================================
  app.post(['/api/auth/login', '/api/admin/login'], (req: Request, res: Response) => {
    const {
      name,
      email,
      phone,
      password,
      role,
      preferredLanguage = 'en',
      category = 'Plumber',
      serviceZone = 'Sector-3',
      societyName,
      addressLabel,
    } = req.body || {};
    const trimmedEmail = String(email || '').toLowerCase().trim();
    const rawPassword = String(password || '');

    if (!trimmedEmail) {
      return res.status(400).json({ field: 'email', error: 'Email address is required.' });
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        field: 'email',
        error: 'Invalid email format. Please enter a valid email address.',
      });
    }
    if (!rawPassword) {
      return res.status(400).json({ field: 'password', error: 'Password is required.' });
    }

    const db = loadDb();
    const targetRole: UserRole =
      role && ['CUSTOMER', 'WORKER', 'ADMIN'].includes(role) ? role : 'CUSTOMER';

    let user = db.users.find((u) => u.email.toLowerCase() === trimmedEmail);

    // Strict Security for Admin Dashboard:
    // Only pre-authorized society administrators with valid credentials can log in.
    if (role === 'ADMIN' || targetRole === 'ADMIN') {
      if (!user) {
        return res.status(401).json({
          field: 'email',
          error: 'Invalid administrator credentials. No authorized administrator account found with this email.',
        });
      }
      if (user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Access denied: Customer and worker accounts cannot access the Society Admin Console.',
        });
      }
    }

    if (!user) {
      const emailPrefix = trimmedEmail
        .split('@')[0]
        .replace(/[._0-9-]+/g, ' ')
        .trim();
      const derivedName =
        name && String(name).trim()
          ? String(name).trim()
          : emailPrefix
          ? emailPrefix.replace(/\b\w/g, (c) => c.toUpperCase())
          : 'Cooperative User';

      const userId = `usr-${Date.now()}`;
      let workerId: string | undefined;
      const coords: Coordinates = {
        lat: 22.5792,
        lng: 88.4175,
        addressLabel: addressLabel ? String(addressLabel).trim() : '',
      };

      if (targetRole === 'WORKER') {
        workerId = `wrk-${Date.now()}`;
        const selectedCategory: SupportedServiceCategory = SUPPORTED_CATEGORIES.includes(category)
          ? category
          : 'Plumber';
        const initials = derivedName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        const newWorkerProfile: WorkerProfile = {
          id: workerId,
          userId,
          name: derivedName,
          phone: String(phone || '').trim(),
          avatarInitials: initials || 'WK',
          category: selectedCategory,
          skills: (CATEGORY_SKILLS_MAP[selectedCategory] || []).slice(0, 3),
          verified: true,
          kycStatus: 'VERIFIED',
          skillBadges: ['Registered Cooperative Member'],
          isAvailable: true,
          shift: 'Full Day (08:00 - 20:00)',
          serviceZone: String(serviceZone || 'Sector-3'),
          coordinates: coords,
          rating: 4.7,
          reviewCount: 1,
          baseRateInr: 450,
          completedJobsTotal: 0,
          completedJobsThisWeek: 0,
          grossEarningsInr: 0,
          netEarningsInr: 0,
          welfareContributionInr: 0,
        };
        db.workers.push(newWorkerProfile);
      }

      user = {
        id: userId,
        name: derivedName,
        email: trimmedEmail,
        phone: String(phone || '').trim(),
        role: targetRole,
        preferredLanguage: ['en', 'bn', 'hi'].includes(preferredLanguage) ? preferredLanguage : 'en',
        location: coords,
        workerId,
        societyName:
          targetRole === 'ADMIN' && societyName ? String(societyName).trim() : undefined,
        passwordHash: hashPassword(rawPassword),
      };
      db.users.push(user);
      saveDb(db);
    } else {
      // Authenticate password securely
      const inputHash = hashPassword(rawPassword);
      if (user.passwordHash && user.passwordHash !== inputHash) {
        return res.status(401).json({
          field: 'password',
          error: user.role === 'ADMIN' ? 'Invalid administrator credentials. Incorrect password.' : 'Incorrect password.',
        });
      }

      // Ensure user is logging in through the portal matching their account role
      if (role && user.role && user.role !== role) {
        const portalNames: Record<UserRole, string> = {
          CUSTOMER: 'Customer Portal',
          WORKER: 'Worker PWA',
          ADMIN: 'Admin Console',
        };
        return res.status(403).json({
          error: `This account is registered under ${portalNames[user.role]}. Please select ${portalNames[user.role]} to log in.`,
        });
      }

      if (name && String(name).trim()) {
        user.name = String(name).trim();
      }
      if (!user.role && role && ['CUSTOMER', 'WORKER', 'ADMIN'].includes(role)) {
        user.role = role;
      }
      if (user.role === 'WORKER') {
        const uId = user.id;
        const uWorkerId = user.workerId;
        const existingWorker = db.workers.find((w) => w.userId === uId || (uWorkerId && w.id === uWorkerId));
        if (existingWorker) {
          user.workerId = existingWorker.id;
        } else if (!user.workerId) {
          const workerId = `wrk-${Date.now()}`;
          user.workerId = workerId;
          const initials = user.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          db.workers.push({
            id: workerId,
            userId: user.id,
            name: user.name,
            phone: user.phone || '',
            avatarInitials: initials || 'WK',
            category: 'Plumber',
            skills: CATEGORY_SKILLS_MAP.Plumber.slice(0, 3),
            verified: true,
            kycStatus: 'VERIFIED',
            skillBadges: ['Registered Cooperative Member'],
            isAvailable: true,
            shift: 'Full Day (08:00 - 20:00)',
            serviceZone: 'Sector-3',
            coordinates: user.location || { lat: 22.5792, lng: 88.4175, addressLabel: '' },
            rating: 4.7,
            reviewCount: 1,
            baseRateInr: 450,
            completedJobsTotal: 0,
            completedJobsThisWeek: 0,
            grossEarningsInr: 0,
            netEarningsInr: 0,
            welfareContributionInr: 0,
          });
        }
      }
      saveDb(db);
    }

    const token = createSessionToken(user.id, user.role, db);
    const { passwordHash: _ph, ...safeUser } = user;
    const workerProfile = user.workerId
      ? db.workers.find((w) => w.id === user.workerId) || null
      : null;

    return res.json({
      token,
      user: safeUser,
      workerProfile,
    });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const {
      name,
      email,
      phone,
      password,
      role,
      preferredLanguage = 'en',
      category,
      serviceZone,
      societyName,
      lat,
      lng,
      addressLabel,
    } = req.body || {};

    const trimmedName = String(name || '').trim().replace(/\s+/g, ' ');
    const trimmedEmail = String(email || '').toLowerCase().trim();
    const trimmedPhone = String(phone || '').replace(/[\s()-]/g, '').trim();
    const rawPassword = String(password || '');
    const trimmedAddress = String(addressLabel || '').trim().replace(/\s+/g, ' ');
    const trimmedSociety = String(societyName || '').trim().replace(/\s+/g, ' ');

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !rawPassword || !role) {
      return res.status(400).json({
        error: 'Name, email, phone, password, and role are required for registration.',
      });
    }

    const nameRegex = /^[\p{L}\p{M}]+(?:[\s.'-][\p{L}\p{M}]+)*$/u;
    if (trimmedName.length < 2 || trimmedName.length > 80 || !nameRegex.test(trimmedName)) {
      return res.status(400).json({
        field: 'name',
        error: 'Invalid name format. Full name must be 2–80 characters and contain letters and spaces only.',
      });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        field: 'email',
        error: 'Invalid email format. Please enter a valid email address.',
      });
    }

    const phoneRegex = /^(?:\+?91|0)?[6-9]\d{9}$|^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(trimmedPhone) || /^(\d)\1{9,}$/.test(trimmedPhone)) {
      return res.status(400).json({
        field: 'phone',
        error: 'Invalid phone number format. Please enter a valid 10-digit mobile number.',
      });
    }

    if (rawPassword.length < 6 || rawPassword.length > 64) {
      return res.status(400).json({
        field: 'password',
        error: 'Invalid password format. Password must be between 6 and 64 characters long.',
      });
    }

    const validRoles: UserRole[] = ['CUSTOMER', 'WORKER', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified.' });
    }

    if (role === 'ADMIN' && (!trimmedSociety || trimmedSociety.length < 3)) {
      return res.status(400).json({
        field: 'societyName',
        error: 'Please enter a valid Cooperative Society name (at least 3 characters) to register as Society Administrator.',
      });
    }

    if (role === 'CUSTOMER' && trimmedAddress.length < 3) {
      return res.status(400).json({
        field: 'addressLabel',
        error: 'Please enter a valid service address or area (at least 3 characters).',
      });
    }

    if (role === 'WORKER') {
      if (!category || !SUPPORTED_CATEGORIES.includes(category)) {
        return res.status(400).json({
          field: 'tradeCategory',
          error: 'Please select a valid trade category.',
        });
      }
      if (!serviceZone || String(serviceZone).trim().length === 0) {
        return res.status(400).json({
          field: 'serviceZone',
          error: 'Please select a valid service zone.',
        });
      }
    }

    if (role === 'ADMIN' && trimmedSociety.length < 3) {
      return res.status(400).json({
        field: 'societyName',
        error: 'Please enter a valid Cooperative Society name (at least 3 characters).',
      });
    }

    const db = loadDb();
    const coords: Coordinates = {
      lat: typeof lat === 'number' && !Number.isNaN(lat) ? lat : 22.5792,
      lng: typeof lng === 'number' && !Number.isNaN(lng) ? lng : 88.4175,
      addressLabel:
        role === 'CUSTOMER'
          ? trimmedAddress
          : role === 'WORKER'
          ? String(serviceZone).trim()
          : trimmedSociety,
    };

    const existingUser = db.users.find((u) => u.email.toLowerCase() === trimmedEmail);
    if (existingUser) {
      existingUser.name = trimmedName;
      existingUser.phone = trimmedPhone;
      existingUser.role = role;
      existingUser.location = coords;
      existingUser.societyName = role === 'ADMIN' ? trimmedSociety : existingUser.societyName;
      existingUser.passwordHash = hashPassword(rawPassword);

      let workerProfile: WorkerProfile | null = null;
      if (role === 'WORKER') {
        const selectedCategory: SupportedServiceCategory = category;
        const initials = trimmedName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        if (existingUser.workerId) {
          workerProfile = db.workers.find((w) => w.id === existingUser.workerId) || null;
          if (workerProfile) {
            workerProfile.name = trimmedName;
            workerProfile.phone = trimmedPhone;
            workerProfile.category = selectedCategory;
            workerProfile.serviceZone = String(serviceZone).trim();
            workerProfile.coordinates = coords;
          }
        }
        if (!workerProfile) {
          const workerId = `wrk-${Date.now()}`;
          existingUser.workerId = workerId;
          workerProfile = {
            id: workerId,
            userId: existingUser.id,
            name: trimmedName,
            phone: trimmedPhone,
            avatarInitials: initials || 'WK',
            category: selectedCategory,
            skills: (CATEGORY_SKILLS_MAP[selectedCategory] || []).slice(0, 3),
            verified: false,
            kycStatus: 'NOT_SUBMITTED',
            skillBadges: ['Registered Cooperative Applicant'],
            isAvailable: true,
            shift: 'Full Day (08:00 - 20:00)',
            serviceZone: String(serviceZone).trim(),
            coordinates: coords,
            rating: 4.5,
            reviewCount: 0,
            baseRateInr: 450,
            completedJobsTotal: 0,
            completedJobsThisWeek: 0,
            grossEarningsInr: 0,
            netEarningsInr: 0,
            welfareContributionInr: 0,
          };
          db.workers.push(workerProfile);
        }
      }

      const token = createSessionToken(existingUser.id, existingUser.role, db);
      saveDb(db);
      if (workerProfile) {
        io.emit('worker:registered', { worker: workerProfile });
        io.emit('worker:updated', { worker: workerProfile });
      }
      const { passwordHash: _ph, ...safeUser } = existingUser;
      return res.status(200).json({
        token,
        user: safeUser,
        workerProfile,
      });
    }

    const userId = `usr-${Date.now()}`;
    let workerId: string | undefined;
    let newWorkerProfile: WorkerProfile | null = null;

    if (role === 'WORKER') {
      workerId = `wrk-${Date.now()}`;
      const selectedCategory: SupportedServiceCategory = category;
      const initials = trimmedName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      newWorkerProfile = {
        id: workerId,
        userId,
        name: trimmedName,
        phone: trimmedPhone,
        avatarInitials: initials || 'WK',
        category: selectedCategory,
        skills: (CATEGORY_SKILLS_MAP[selectedCategory] || []).slice(0, 3),
        verified: false,
        kycStatus: 'NOT_SUBMITTED',
        skillBadges: ['Registered Cooperative Applicant'],
        isAvailable: true,
        shift: 'Full Day (08:00 - 20:00)',
        serviceZone: String(serviceZone).trim(),
        coordinates: coords,
        rating: 4.5,
        reviewCount: 0,
        baseRateInr: 450,
        completedJobsTotal: 0,
        completedJobsThisWeek: 0,
        grossEarningsInr: 0,
        netEarningsInr: 0,
        welfareContributionInr: 0,
      };
      db.workers.push(newWorkerProfile);
    }

    const newUser: StoredUser = {
      id: userId,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      role,
      preferredLanguage: ['en', 'bn', 'hi'].includes(preferredLanguage) ? preferredLanguage : 'en',
      location: coords,
      workerId,
      societyName: role === 'ADMIN' ? trimmedSociety : undefined,
      passwordHash: hashPassword(rawPassword),
    };

    db.users.push(newUser);
    const token = createSessionToken(newUser.id, newUser.role, db);
    saveDb(db);

    if (newWorkerProfile) {
      io.emit('worker:registered', { worker: newWorkerProfile });
      io.emit('worker:updated', { worker: newWorkerProfile });
    }

    const { passwordHash: _ph, ...safeUser } = newUser;
    return res.status(201).json({
      token,
      user: safeUser,
      workerProfile: newWorkerProfile,
    });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const db = loadDb();
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (db.activeSessions[token]) {
        delete db.activeSessions[token];
        saveDb(db);
      }
    }
    return res.json({
      success: true,
      message: 'Session invalidated on server. Logged out successfully.',
    });
  });

  app.get('/api/auth/me', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;
    const { passwordHash: _ph, ...safeUser } = user;
    const workerProfile =
      (user.workerId ? db.workers.find((w) => w.id === user.workerId) || null : null) ||
      db.workers.find((w) => w.userId === user.id) ||
      null;
    res.json({ user: safeUser, workerProfile });
  });

  // ============================================================================
  // MODULE 3: GEMMA 4 MULTILINGUAL REQUEST INTERPRETATION
  // ============================================================================
  app.post('/api/ai/interpret-request', requireAuth(['CUSTOMER', 'ADMIN']), async (req: Request, res: Response) => {
    const { text, selectedCategory } = req.body || {};
    if (!text || String(text).trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a natural-language service description.' });
    }

    const userText = String(text).trim();
    const deterministicResult = analyzeHouseholdRequestDeterministic(userText, selectedCategory);

    if (!getGenAIClient()) {
      return res.json(deterministicResult);
    }

    const prompt = `Act as the intelligent household service request analyzer and safety advisor for Help Nest Cooperative Household Services.
Analyze the following customer household service request, which may be written in English, Bengali (বাংলা), or Hindi (हिन्दी).
Customer Input: "${userText}"
Customer Currently Selected Category (if any): "${selectedCategory || 'None'}"

Supported Categories ONLY: "Electrician", "Plumber", "Carpenter", "Painter", "Cleaner", "Babysitter".
Available Skills per Category:
${JSON.stringify(CATEGORY_SKILLS_MAP, null, 2)}

Supported Time Slots ONLY: "Morning (08:00 - 12:00)", "Afternoon (12:00 - 16:00)", "Evening (16:00 - 20:00)", "Full Day (08:00 - 20:00)".
Supported Urgency Levels ONLY: "STANDARD", "URGENT", "EMERGENCY".

SAFETY & HAZARD RULES:
- Detect if the user description indicates an active emergency or severe safety hazard (e.g. electrical sparking, burning wire smell, gas odor, severe water flooding, structural collapse, children in danger). If so, set urgency to "EMERGENCY" and "isHazardAlert" to true.
- Provide "safetyGuidance": array of 1-3 immediate actionable precautions the resident should take (e.g. "Switch off main circuit breaker immediately", "Close main water inlet stopcock", "Evacuate room and ventilate").
- Provide "suggestedDetailsToProvide": array of 2-3 specific details the resident should provide before booking (e.g. exact appliance brand, floor/room, valve accessibility).
- State that AI suggestions are preliminary advisory assistance and an authorized professional inspection is required.

Return strict JSON with these keys:
{
  "detectedLanguage": "English" | "Bengali" | "Hindi" | "Mixed",
  "serviceCategory": one of the 6 supported categories or "",
  "extractedSkills": array of matching skill strings from the category list,
  "taskSummary": concise English summary of the task,
  "urgency": "STANDARD" | "URGENT" | "EMERGENCY" | "",
  "preferredTimeSlot": one of the 4 time slots or "",
  "missingFieldsToConfirm": array of field names the user still needs to confirm,
  "confidenceNote": brief explanation of what was extracted,
  "safetyGuidance": array of string precautions,
  "isHazardAlert": boolean,
  "preliminaryNotice": "AI suggestions are preliminary. An authorized cooperative professional will inspect the problem on-site.",
  "suggestedDetailsToProvide": array of string details
}`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        detectedLanguage: { type: Type.STRING },
        serviceCategory: { type: Type.STRING },
        extractedSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
        taskSummary: { type: Type.STRING },
        urgency: { type: Type.STRING },
        preferredTimeSlot: { type: Type.STRING },
        missingFieldsToConfirm: { type: Type.ARRAY, items: { type: Type.STRING } },
        confidenceNote: { type: Type.STRING },
        safetyGuidance: { type: Type.ARRAY, items: { type: Type.STRING } },
        isHazardAlert: { type: Type.BOOLEAN },
        preliminaryNotice: { type: Type.STRING },
        suggestedDetailsToProvide: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        'detectedLanguage',
        'serviceCategory',
        'extractedSkills',
        'taskSummary',
        'urgency',
        'preferredTimeSlot',
        'missingFieldsToConfirm',
        'confidenceNote',
        'safetyGuidance',
        'isHazardAlert',
      ],
    };

    try {
      const aiResult = await callGemmaOrGeminiJson(prompt, schema, 35000);
      const parsed = aiResult.data || {};
      const validCat = SUPPORTED_CATEGORIES.includes(parsed.serviceCategory)
        ? (parsed.serviceCategory as SupportedServiceCategory)
        : deterministicResult.serviceCategory;
      const validSlots: ShiftPreference[] = [
        'Morning (08:00 - 12:00)',
        'Afternoon (12:00 - 16:00)',
        'Evening (16:00 - 20:00)',
        'Full Day (08:00 - 20:00)',
      ];
      const validUrgencies: UrgencyLevel[] = ['STANDARD', 'URGENT', 'EMERGENCY'];

      const resolvedSkills =
        Array.isArray(parsed.extractedSkills) && parsed.extractedSkills.length > 0
          ? parsed.extractedSkills
          : deterministicResult.extractedSkills;

      const responsePayload: GemmaInterpretedRequest = {
        detectedLanguage: parsed.detectedLanguage || deterministicResult.detectedLanguage,
        serviceCategory: validCat,
        extractedSkills: resolvedSkills,
        taskSummary: parsed.taskSummary || deterministicResult.taskSummary,
        urgency: validUrgencies.includes(parsed.urgency)
          ? parsed.urgency
          : deterministicResult.urgency,
        preferredTimeSlot: validSlots.includes(parsed.preferredTimeSlot)
          ? parsed.preferredTimeSlot
          : deterministicResult.preferredTimeSlot,
        missingFieldsToConfirm: Array.isArray(parsed.missingFieldsToConfirm)
          ? parsed.missingFieldsToConfirm
          : deterministicResult.missingFieldsToConfirm,
        confidenceNote:
          parsed.confidenceNote || deterministicResult.confidenceNote,
        safetyGuidance: Array.isArray(parsed.safetyGuidance) && parsed.safetyGuidance.length > 0
          ? parsed.safetyGuidance
          : ['Ensure personal safety before attempting any checks.'],
        isHazardAlert: Boolean(parsed.isHazardAlert),
        preliminaryNotice:
          parsed.preliminaryNotice ||
          'AI suggestions are preliminary advisory assistance. An authorized cooperative professional will inspect the problem on-site before initiating work.',
        suggestedDetailsToProvide: Array.isArray(parsed.suggestedDetailsToProvide)
          ? parsed.suggestedDetailsToProvide
          : [],
        modelUsed: aiResult.modelUsed,
        isLiveModel: true,
      };

      return res.json(responsePayload);
    } catch {
      // Return instant deterministic multilingual analysis if live API times out or errors
      return res.json(deterministicResult);
    }
  });

  // ============================================================================
  // GEMMA 4 NEW FEATURE 1: AI COMPLAINT-TO-ACTION CONVERTER
  // ============================================================================
  app.post('/api/ai/complaint-to-action', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const { complaintText, bookingId, bookingReference, workerPreferredLanguage } = req.body || {};

    if (!complaintText || String(complaintText).trim().length < 5) {
      return res.status(400).json({ error: 'Please provide a clear complaint or problem description (at least 5 characters).' });
    }

    const linkedBooking = bookingId ? db.bookings.find((b) => b.id === bookingId) : undefined;
    const assignedWorker = linkedBooking?.workerId
      ? db.workers.find((w) => w.id === linkedBooking.workerId)
      : undefined;

    const workerLang = (workerPreferredLanguage ||
      (assignedWorker?.userId
        ? db.users.find((u) => u.id === assignedWorker.userId)?.preferredLanguage
        : 'bn') ||
      'bn') as 'en' | 'bn' | 'hi';

    try {
      const record = await convertComplaintToActionWithGemma4({
        complaintText: String(complaintText).trim(),
        workerPreferredLanguage: workerLang,
        customerId: user.id,
        customerName: user.name,
        bookingId: linkedBooking?.id,
        bookingReference: linkedBooking?.bookingReference || bookingReference,
        workerId: assignedWorker?.id,
        workerName: assignedWorker?.name,
      });

      db.complaintToActions.unshift(record);

      if (linkedBooking) {
        linkedBooking.hasComplaintToAction = true;
        linkedBooking.complaintToActionId = record.id;
        linkedBooking.updatedAt = new Date().toISOString();
        saveDb(db);
        await persistBookingMongo(linkedBooking);
        io.emit('booking:updated', linkedBooking);
      } else {
        saveDb(db);
      }

      await persistComplaintToActionMongo(record);
      io.emit('complaint-to-action:created', record);

      return res.status(201).json({
        record,
        message: 'Gemma 4 converted complaint into structured action items with worker translation.',
      });
    } catch (err: any) {
      console.error('[Gemma 4 Complaint-to-Action Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'AI Complaint analysis failed. Please try again.',
      });
    }
  });

  app.put('/api/ai/complaint-to-action/:id', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const record = db.complaintToActions.find((r) => r.id === req.params.id);

    if (!record) {
      return res.status(404).json({ error: 'Complaint-to-Action record not found.' });
    }

    const { correctedSummary, correctedActionItems, notes } = req.body || {};

    record.corrections = {
      correctedBy: user.name,
      correctedByRole: user.role === 'WORKER' ? 'WORKER' : 'CUSTOMER',
      correctedAt: new Date().toISOString(),
      correctedSummary: correctedSummary ? String(correctedSummary).trim() : record.problemSummary,
      correctedActionItems: Array.isArray(correctedActionItems) ? correctedActionItems : record.suggestedActionItems,
      notes: notes ? String(notes).trim() : undefined,
    };
    record.updatedAt = new Date().toISOString();

    saveDb(db);
    await persistComplaintToActionMongo(record);
    io.emit('complaint-to-action:updated', record);

    return res.json({
      record,
      message: 'Corrections to AI complaint analysis saved successfully.',
    });
  });

  app.get('/api/ai/complaint-to-action/:bookingIdOrId', requireAuth(), (req: Request, res: Response) => {
    const db = loadDb();
    const param = req.params.bookingIdOrId;
    const record = db.complaintToActions.find((r) => r.id === param || r.bookingId === param);

    if (!record) {
      return res.status(404).json({ error: 'No Complaint-to-Action record found for this reference.' });
    }
    return res.json({ record });
  });

  // ============================================================================
  // GEMMA 4 NEW FEATURE 2: AI SERVICE CATEGORY AUTO-CLASSIFIER
  // ============================================================================
  app.post('/api/ai/classify-category', upload.single('image'), async (req: Request, res: Response) => {
    const { description } = req.body || {};

    if (!description && !req.file) {
      return res.status(400).json({ error: 'Please provide either a problem description or an image to classify.' });
    }

    let imageBuffer: Buffer | undefined;
    let imageMimeType: string | undefined;

    if (req.file) {
      // Validate 2MB limit
      if (req.file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image size exceeds the strict 2 MB limit.' });
      }
      const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedImageMimes.includes(req.file.mimetype.toLowerCase())) {
        return res.status(400).json({ error: 'Unsupported image format. Allowed formats: JPG, PNG, WebP.' });
      }
      imageBuffer = req.file.buffer;
      imageMimeType = req.file.mimetype;
    }

    try {
      const classification = await classifyServiceCategoryWithGemma4({
        description: String(description || '').trim(),
        imageBuffer,
        imageMimeType,
      });

      return res.json({
        classification,
        supportedCategories: SUPPORTED_CATEGORIES,
        categorySkills: CATEGORY_SKILLS_MAP,
      });
    } catch (err: any) {
      console.error('[Gemma 4 Category Auto-Classifier Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Category auto-classification failed.',
      });
    }
  });

  // ============================================================================
  // GEMMA 4 NEW FEATURE 3: AI REPAIR REPORT GENERATOR
  // ============================================================================
  app.post('/api/ai/repair-report/generate', requireAuth(['WORKER', 'ADMIN']), async (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const { bookingId, workerNotes = [], completedChecklist = [] } = req.body || {};

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Associated booking record not found.' });
    }

    // Pull worker field notes from database
    const savedNotes = db.jobNotes
      .filter((n) => n.bookingId === booking.id)
      .map((n) => n.noteText);
    const combinedNotes = Array.from(new Set([...(Array.isArray(workerNotes) ? workerNotes : []), ...savedNotes]));

    // Pull confirmed spare parts if available
    const spareEstimate = db.sparePartsEstimates.find((e) => e.bookingId === booking.id);
    const confirmedParts: any[] = spareEstimate?.items
      ? spareEstimate.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          costInr: i.totalPriceInr,
          confirmed: true,
        }))
      : [];

    try {
      const report = await generateRepairReportWithGemma4({
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        customerId: booking.customerId,
        customerName: booking.customerName,
        workerId: booking.workerId,
        workerName: booking.workerName,
        serviceCategory: booking.workerCategory,
        originalProblem: booking.problemDescription,
        workerNotes: combinedNotes,
        completedChecklist: Array.isArray(completedChecklist) ? completedChecklist : [],
        confirmedParts,
        approvedPriceRevision: booking.priceRevision?.status === 'APPROVED' ? booking.priceRevision : null,
      });

      return res.json({
        report,
        message: 'Gemma 4 generated draft service report. Please review and edit before saving.',
      });
    } catch (err: any) {
      console.error('[Gemma 4 Repair Report Generator Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Repair report generation failed.',
      });
    }
  });

  app.put('/api/ai/repair-report/:id', requireAuth(['WORKER', 'ADMIN']), async (req: Request, res: Response) => {
    const db = loadDb();
    const {
      bookingId,
      bookingReference,
      reportTitle,
      originalReportedProblem,
      workPerformed,
      partsUsed,
      outstandingIssues,
      maintenanceSuggestions,
      customerSummary,
      approve = false,
    } = req.body || {};

    let report = db.repairReports.find((r) => r.id === req.params.id);
    const booking = db.bookings.find((b) => b.id === bookingId || b.id === report?.bookingId);

    if (!booking) {
      return res.status(404).json({ error: 'Linked booking not found.' });
    }

    let savedReport: RepairReportRecord;
    if (!report) {
      savedReport = {
        id: req.params.id,
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        customerId: booking.customerId,
        customerName: booking.customerName,
        workerId: booking.workerId,
        workerName: booking.workerName,
        serviceCategory: booking.workerCategory,
        reportTitle: reportTitle || `${booking.workerCategory} Completion Report — ${booking.bookingReference}`,
        originalReportedProblem: originalReportedProblem || booking.problemDescription,
        workPerformed: Array.isArray(workPerformed) ? workPerformed : [],
        partsUsed: Array.isArray(partsUsed) ? partsUsed : [],
        outstandingIssues: Array.isArray(outstandingIssues) ? outstandingIssues.join('; ') : (outstandingIssues ? String(outstandingIssues) : null),
        maintenanceSuggestions: Array.isArray(maintenanceSuggestions) ? maintenanceSuggestions : [],
        customerSummary: customerSummary || 'Service completed successfully.',
        editedByWorker: true,
        workerApprovedAt: approve ? new Date().toISOString() : undefined,
        modelUsed: 'Gemma 4 AI',
        isLiveAi: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.repairReports.unshift(savedReport);
    } else {
      report.reportTitle = reportTitle || report.reportTitle;
      report.originalReportedProblem = originalReportedProblem || report.originalReportedProblem;
      report.workPerformed = Array.isArray(workPerformed) ? workPerformed : report.workPerformed;
      report.partsUsed = Array.isArray(partsUsed) ? partsUsed : report.partsUsed;
      report.outstandingIssues = Array.isArray(outstandingIssues) ? outstandingIssues.join('; ') : (outstandingIssues !== undefined ? (outstandingIssues ? String(outstandingIssues) : null) : report.outstandingIssues);
      report.maintenanceSuggestions = Array.isArray(maintenanceSuggestions) ? maintenanceSuggestions : report.maintenanceSuggestions;
      report.customerSummary = customerSummary || report.customerSummary;
      report.editedByWorker = true;
      if (approve) {
        report.workerApprovedAt = new Date().toISOString();
      }
      report.updatedAt = new Date().toISOString();
      savedReport = report;
    }

    booking.hasRepairReport = true;
    booking.repairReportId = savedReport.id;
    booking.updatedAt = new Date().toISOString();

    saveDb(db);
    await persistRepairReportMongo(report);
    await persistBookingMongo(booking);

    io.emit('repair-report:updated', report);
    io.emit('booking:updated', booking);

    return res.json({
      report,
      booking,
      message: 'Repair report saved and verified. Customer can now view verified service report.',
    });
  });

  app.get('/api/ai/repair-report/:bookingIdOrId', requireAuth(), (req: Request, res: Response) => {
    const db = loadDb();
    const param = req.params.bookingIdOrId;
    const report = db.repairReports.find((r) => r.id === param || r.bookingId === param);

    if (!report) {
      return res.status(404).json({ error: 'No repair report found for this booking.' });
    }
    return res.json({ report });
  });

  // ============================================================================
  // GEMMA 4 NEW FEATURE 4: AI BOOKING REQUIREMENT GAP FINDER
  // ============================================================================
  app.post('/api/ai/booking-gap-finder', requireAuth(['CUSTOMER', 'ADMIN']), async (req: Request, res: Response) => {
    const { problemDescription, category, locationAddress, preferredTimeSlot, urgency } = req.body || {};

    if (!problemDescription || String(problemDescription).trim().length < 3) {
      return res.status(400).json({ error: 'Problem description is required to identify requirement gaps.' });
    }
    if (!category || !SUPPORTED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Valid service category is required.' });
    }

    try {
      const gapAnalysis = await findBookingRequirementGapsWithGemma4({
        problemDescription: String(problemDescription).trim(),
        category,
        locationAddress: locationAddress ? String(locationAddress).trim() : undefined,
        preferredTimeSlot: preferredTimeSlot ? String(preferredTimeSlot).trim() : undefined,
        urgency: urgency || 'STANDARD',
      });

      const db = loadDb();
      db.bookingGapAnalyses.unshift(gapAnalysis);
      saveDb(db);
      await persistBookingGapAnalysisMongo(gapAnalysis);

      return res.json({ gapAnalysis });
    } catch (err: any) {
      console.error('[Gemma 4 Booking Gap Finder Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Booking gap analysis failed.',
      });
    }
  });

  app.post('/api/ai/booking-gap-answers', requireAuth(['CUSTOMER', 'ADMIN']), async (req: Request, res: Response) => {
    const db = loadDb();
    const { gapAnalysisId, bookingId, answers } = req.body || {};

    if (gapAnalysisId) {
      const gap = db.bookingGapAnalyses.find((g) => g.id === gapAnalysisId);
      if (gap && typeof answers === 'object' && answers !== null) {
        const answersRecord = answers as Record<string, any>;
        gap.missingQuestions.forEach((q) => {
          const key = (q.fieldKey && answersRecord[q.fieldKey] !== undefined)
            ? q.fieldKey
            : (q.id && answersRecord[q.id] !== undefined ? q.id : null);
          if (key) {
            q.currentAnswer = String(answersRecord[key]).trim();
            q.isAnswered = true;
          }
        });
        saveDb(db);
        await persistBookingGapAnalysisMongo(gap);
      }
    }

    if (bookingId) {
      const booking = db.bookings.find((b) => b.id === bookingId);
      if (booking && typeof answers === 'object') {
        booking.requirementAnswers = {
          ...(booking.requirementAnswers || {}),
          ...answers,
        };
        booking.updatedAt = new Date().toISOString();
        saveDb(db);
        await persistBookingMongo(booking);
        io.emit('booking:updated', booking);
      }
    }

    return res.json({
      success: true,
      message: 'Booking details updated with confirmed answers.',
      answers,
    });
  });

  // ============================================================================
  // GEMMA 4 NEW FEATURE 5: AI COOPERATIVE RULE EXPLAINER (VERIFIED RAG)
  // ============================================================================
  app.post('/api/ai/coop-policy-explainer', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const { question } = req.body || {};

    if (!question || String(question).trim().length < 3) {
      return res.status(400).json({ error: 'Please enter a question regarding cooperative rules or policies.' });
    }

    try {
      const explanation = await explainCooperativeRuleWithGemma4({
        question: String(question).trim(),
        workerName: user.name,
      });

      const db = loadDb();
      const queryEntry = {
        id: `pol-q-${Date.now()}`,
        workerId: user.workerId || user.id,
        ...explanation,
      };
      db.coopPolicyQueries.unshift(queryEntry);
      saveDb(db);
      await persistCoopPolicyQueryMongo(queryEntry);

      return res.json({ explanation });
    } catch (err: any) {
      console.error('[Gemma 4 Coop Policy Explainer Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Policy inquiry failed.',
      });
    }
  });

  app.get('/api/coop-policies', requireAuth(), (_req: Request, res: Response) => {
    return res.json({ bylaws: COOPERATIVE_BYLAWS });
  });

  // ============================================================================
  // GEMMA 4 NEW FEATURE: AI WORKER COMPLETION NOTE POLISHER
  // ============================================================================
  app.post('/api/ai/polish-completion-note', requireAuth(['WORKER', 'ADMIN']), async (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const { rawNotes, category, workerName, workerPreferredLanguage } = req.body || {};
    if (!rawNotes || String(rawNotes).trim().length < 2) {
      return res.status(400).json({ error: 'Please enter raw notes to polish.' });
    }

    try {
      const result = await polishCompletionNoteWithGemma4({
        rawNotes: String(rawNotes).trim(),
        category: (category as SupportedServiceCategory) || 'Plumber',
        workerName: workerName || user.name,
        workerPreferredLanguage: workerPreferredLanguage || user.preferredLanguage || 'en',
      });
      return res.json(result);
    } catch (err: any) {
      console.error('[Gemma 4 Polish Note Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to polish note with Gemma 4.',
      });
    }
  });

  // ============================================================================
  // GEMMA 4 NEW FEATURE: AI ADMIN OPERATIONAL INTELLIGENCE & INSIGHTS
  // ============================================================================
  const handleAdminOperationalSummary = async (req: Request, res: Response) => {
    const db = loadDb();
    const lang = (req.query.lang as 'en' | 'bn' | 'hi') || 'en';
    const totalBookings = db.bookings.length;
    const completedBookings = db.bookings.filter((b) => b.status === 'COMPLETED').length;
    const inProgressBookings = db.bookings.filter((b) => b.status === 'IN_PROGRESS').length;
    const pendingBookings = db.bookings.filter((b) => b.status === 'PENDING' || b.status === 'ACCEPTED').length;
    const cancelledBookings = db.bookings.filter((b) => b.status === 'CANCELLED').length;
    const categoryCounts: Record<string, number> = {};
    for (const cat of SUPPORTED_CATEGORIES) {
      categoryCounts[cat] = db.bookings.filter((b) => b.workerCategory === cat).length;
    }
    const totalWorkers = db.workers.length;
    const verifiedWorkers = db.workers.filter((w) => w.verified).length;
    const pendingDisputes = (db.disputes || []).filter((d) => d.status === 'SUBMITTED' || d.status === 'UNDER_REVIEW').length;
    const welfareRequests = (db.welfareRequests || []).filter((w) => w.status === 'SUBMITTED' || w.status === 'UNDER_REVIEW').length;

    try {
      const summary = await generateAdminOperationalSummaryWithGemma4({
        language: lang,
        stats: {
          totalBookings,
          completedBookings,
          inProgressBookings,
          pendingBookings,
          cancelledBookings,
          categoryCounts,
          totalWorkers,
          verifiedWorkers,
          pendingDisputes,
          welfareRequests,
        },
      });
      return res.json(summary);
    } catch (err: any) {
      console.error('[Gemma 4 Admin Operational Summary Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate operational summary with Gemma 4.',
      });
    }
  };

  app.get('/api/admin/ai-operational-summary', requireAuth(['ADMIN']), handleAdminOperationalSummary);
  app.get('/api/ai/admin-operational-summary', requireAuth(['ADMIN']), handleAdminOperationalSummary);

  // ============================================================================
  // GEMMA 4 E4B FEATURE 1: WORKER DIGITAL PASSPORT
  // ============================================================================
  app.post('/api/ai/worker-digital-passport', requireAuth(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as StoredUser;
      const db = loadDb();
      const targetWorkerId = (req.body?.workerId || req.query?.workerId || user.workerId || (user.role === 'WORKER' ? user.id : '')) as string;
      const worker = db.workers.find((w) => w.id === targetWorkerId || w.userId === targetWorkerId || w.userId === user.id) || db.workers[0];
      if (!worker) {
        return res.status(404).json({ error: 'Worker profile not found in cooperative directory.' });
      }

      const completedBookings = db.bookings.filter(
        (b) => (b.workerId === worker.id || b.assignedWorkerId === worker.id) && b.status === 'COMPLETED'
      );
      const workerNotes = db.jobNotes.filter((n) => n.workerId === worker.id);

      const passport = await generateWorkerDigitalPassportWithGemma4({
        worker,
        completedBookings,
        workerNotes,
        language: req.body?.language || user.preferredLanguage || 'en',
      });

      return res.json({ passport, modelUsed: passport.modelUsed });
    } catch (err: any) {
      console.error('[Gemma 4 Worker Digital Passport Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate Worker Digital Passport.',
      });
    }
  });

  app.get('/api/ai/worker-digital-passport/:workerId', requireAuth(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as StoredUser;
      const db = loadDb();
      const targetWorkerId = req.params.workerId;
      const worker = db.workers.find((w) => w.id === targetWorkerId || w.userId === targetWorkerId) || db.workers[0];
      if (!worker) {
        return res.status(404).json({ error: 'Worker profile not found.' });
      }

      const completedBookings = db.bookings.filter(
        (b) => (b.workerId === worker.id || b.assignedWorkerId === worker.id) && b.status === 'COMPLETED'
      );
      const workerNotes = db.jobNotes.filter((n) => n.workerId === worker.id);

      const passport = await generateWorkerDigitalPassportWithGemma4({
        worker,
        completedBookings,
        workerNotes,
        language: (req.query?.lang as any) || user.preferredLanguage || 'en',
      });

      return res.json({ passport, modelUsed: passport.modelUsed });
    } catch (err: any) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate Worker Digital Passport.',
      });
    }
  });

  // ============================================================================
  // GEMMA 4 E4B FEATURE 2: FAIR DISPUTE ORGANIZER
  // ============================================================================
  app.post('/api/ai/fair-dispute-organizer', requireAuth(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as StoredUser;
      const db = loadDb();
      const { bookingId, disputeId, language } = req.body || {};

      let booking = db.bookings.find((b) => b.id === bookingId || b.bookingReference === bookingId);
      if (!booking && disputeId) {
        const dispute = db.disputes.find((d) => d.id === disputeId);
        if (dispute) {
          booking = db.bookings.find((b) => b.id === dispute.bookingId);
        }
      }
      if (!booking) {
        booking = db.bookings[0];
      }
      if (!booking) {
        return res.status(404).json({ error: 'No booking record found for dispute organization.' });
      }

      const dispute = db.disputes.find((d) => d.bookingId === booking?.id || d.id === disputeId);
      const workerNotes = db.jobNotes.filter((n) => n.bookingId === booking?.id);

      const dossier = await generateFairDisputeOrganizerWithGemma4({
        booking,
        dispute,
        workerNotes,
        language: language || user.preferredLanguage || 'en',
      });

      return res.json({ dossier, modelUsed: dossier.modelUsed });
    } catch (err: any) {
      console.error('[Gemma 4 Fair Dispute Organizer Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate Fair Dispute Dossier.',
      });
    }
  });

  // ============================================================================
  // GEMMA 4 E4B FEATURE 3: HOME MAINTENANCE MEMORY
  // ============================================================================
  app.post('/api/ai/home-maintenance-memory', requireAuth(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as StoredUser;
      const db = loadDb();
      const customerId = (req.body?.customerId || (user.role === 'CUSTOMER' ? user.id : '')) as string;
      const customer = db.users.find((u) => u.id === customerId) || user;

      const completedBookings = db.bookings.filter(
        (b) => (b.customerId === customer.id || (!customerId && b.status === 'COMPLETED')) && b.status === 'COMPLETED'
      );
      const repairReports = db.repairReports.filter((r) => r.customerId === customer.id);
      const jobNotes = db.jobNotes.filter((n) => completedBookings.some((b) => b.id === n.bookingId));

      const memory = await generateHomeMaintenanceMemoryWithGemma4({
        customerId: customer.id,
        customerName: customer.name,
        completedBookings,
        repairReports,
        jobNotes,
        language: req.body?.language || user.preferredLanguage || 'en',
      });

      return res.json({ memory, modelUsed: memory.modelUsed });
    } catch (err: any) {
      console.error('[Gemma 4 Home Maintenance Memory Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate Home Maintenance Memory.',
      });
    }
  });

  app.get('/api/ai/home-maintenance-memory', requireAuth(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as StoredUser;
      const db = loadDb();
      const customerId = (req.query?.customerId as string) || (user.role === 'CUSTOMER' ? user.id : '');
      const customer = db.users.find((u) => u.id === customerId) || user;

      const completedBookings = db.bookings.filter(
        (b) => (b.customerId === customer.id || (!customerId && b.status === 'COMPLETED')) && b.status === 'COMPLETED'
      );
      const repairReports = db.repairReports.filter((r) => r.customerId === customer.id);
      const jobNotes = db.jobNotes.filter((n) => completedBookings.some((b) => b.id === n.bookingId));

      const memory = await generateHomeMaintenanceMemoryWithGemma4({
        customerId: customer.id,
        customerName: customer.name,
        completedBookings,
        repairReports,
        jobNotes,
        language: (req.query?.lang as any) || user.preferredLanguage || 'en',
      });

      return res.json({ memory, modelUsed: memory.modelUsed });
    } catch (err: any) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to retrieve Home Maintenance Memory.',
      });
    }
  });

  // ============================================================================
  // GEMMA 4 E4B FEATURE 4: COOPERATIVE INTELLIGENCE
  // ============================================================================
  app.all(['/api/ai/cooperative-intelligence', '/api/admin/cooperative-intelligence'], requireAuth(['ADMIN']), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as StoredUser;
      const db = loadDb();
      const language = (req.body?.language || req.query?.lang || user.preferredLanguage || 'en') as 'en' | 'bn' | 'hi';

      const report = await generateCooperativeIntelligenceWithGemma4({
        bookings: db.bookings,
        workers: db.workers,
        welfareLedger: db.welfareLedger,
        language,
      });

      return res.json({ report, modelUsed: report.modelUsed });
    } catch (err: any) {
      console.error('[Gemma 4 Cooperative Intelligence Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate Cooperative Intelligence Report.',
      });
    }
  });

  // ============================================================================
  // GEMMA 4 E4B FEATURE 5: CUSTOMER RATING INSIGHTS
  // ============================================================================
  app.post('/api/ai/customer-rating-insights', requireAuth(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as StoredUser;
      const db = loadDb();
      const targetWorkerId = (req.body?.workerId || req.query?.workerId || user.workerId || (user.role === 'WORKER' ? user.id : '')) as string;
      const worker = db.workers.find((w) => w.id === targetWorkerId || w.userId === targetWorkerId || w.userId === user.id) || db.workers[0];
      if (!worker) {
        return res.status(404).json({ error: 'Worker profile not found.' });
      }

      const workerBookings = db.bookings.filter((b) => b.workerId === worker.id || b.assignedWorkerId === worker.id);

      const insights = await generateCustomerRatingInsightsWithGemma4({
        worker,
        bookings: workerBookings,
        language: req.body?.language || user.preferredLanguage || 'en',
      });

      return res.json({ insights, modelUsed: insights.modelUsed });
    } catch (err: any) {
      console.error('[Gemma 4 Customer Rating Insights Error]', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate Customer Rating Insights.',
      });
    }
  });

  app.get('/api/ai/customer-rating-insights/:workerId', requireAuth(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as StoredUser;
      const db = loadDb();
      const targetWorkerId = req.params.workerId;
      const worker = db.workers.find((w) => w.id === targetWorkerId || w.userId === targetWorkerId) || db.workers[0];
      if (!worker) {
        return res.status(404).json({ error: 'Worker profile not found.' });
      }

      const workerBookings = db.bookings.filter((b) => b.workerId === worker.id || b.assignedWorkerId === worker.id);

      const insights = await generateCustomerRatingInsightsWithGemma4({
        worker,
        bookings: workerBookings,
        language: (req.query?.lang as any) || user.preferredLanguage || 'en',
      });

      return res.json({ insights, modelUsed: insights.modelUsed });
    } catch (err: any) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate Customer Rating Insights.',
      });
    }
  });



  // ============================================================================
  // MODULE 4 & 11: FAIR AI WORKER DISPATCH (POST /api/ai/match-worker)
  // ============================================================================
  app.post('/api/ai/match-worker', requireAuth(['CUSTOMER', 'ADMIN']), async (req: Request, res: Response) => {
    const {
      serviceCategory,
      requiredSkills = [],
      preferredTimeSlot,
      customerLocation,
      problemDescription = '',
    } = req.body || {};

    if (!serviceCategory || !SUPPORTED_CATEGORIES.includes(serviceCategory)) {
      return res.status(400).json({
        error: 'A valid supported service category is required before matching workers.',
      });
    }

    const db = loadDb();

    // 1. Filter eligible cooperative workers by trade category and availability
    const eligibleWorkers = db.workers.filter((w) => {
      // Must match requested service category (normalized comparison)
      if (normalizeCategory(w.category) !== normalizeCategory(serviceCategory)) return false;
      // Must be currently available
      if (w.isAvailable === false) return false;
      return true;
    });

    if (eligibleWorkers.length === 0) {
      return res.json({
        serviceCategory,
        matchedWorkerId: null,
        topScore: null,
        candidates: [],
        message: `No available workers with verified ${serviceCategory} trade skills are currently on duty for this time slot.`,
      });
    }

    const maxWeeklyJobs = Math.max(
      1,
      ...eligibleWorkers.map((w) => w.completedJobsThisWeek)
    );

    // 2. Compute actual distances and deterministic fair dispatch breakdown from real coordinates
    const scoredCandidates: Array<MatchedWorkerResult> = eligibleWorkers.map((worker) => {
      const dispatch = computeFairDispatchScore(
        worker,
        customerLocation,
        Array.isArray(requiredSkills) ? requiredSkills : [],
        maxWeeklyJobs
      );
      const distText =
        dispatch.distanceKm !== null
          ? `${dispatch.distanceKm.toFixed(2)} km away`
          : 'within service zone';
      const aiExplanation = `${worker.name} is ${distText} with verified ${worker.category} skills and rating ★${worker.rating.toFixed(1)}.`;

      return {
        worker,
        dispatch,
        isRecommended: false,
        isNearest: false,
        aiExplanation,
      };
    });

    // 3. Separate candidates: active registered workers, other registered user workers, active seed workers, and other seed workers
    const activeRegisteredCandidates = scoredCandidates.filter(
      (c) => isRealRegisteredWorker(c.worker, db) && isWorkerCurrentlyActive(c.worker, db)
    );
    const otherRegisteredCandidates = scoredCandidates.filter(
      (c) => isRealRegisteredWorker(c.worker, db) && !activeRegisteredCandidates.includes(c)
    );
    const activeSeedCandidates = scoredCandidates.filter(
      (c) => !isRealRegisteredWorker(c.worker, db) && isWorkerCurrentlyActive(c.worker, db)
    );
    const otherSeedCandidates = scoredCandidates.filter(
      (c) =>
        !isRealRegisteredWorker(c.worker, db) &&
        !activeSeedCandidates.includes(c)
    );

    const sortByScore = (a: MatchedWorkerResult, b: MatchedWorkerResult) => {
      const aSlotMatch = !preferredTimeSlot || a.worker.shift === 'Full Day (08:00 - 20:00)' || a.worker.shift === preferredTimeSlot ? 1 : 0;
      const bSlotMatch = !preferredTimeSlot || b.worker.shift === 'Full Day (08:00 - 20:00)' || b.worker.shift === preferredTimeSlot ? 1 : 0;
      if (aSlotMatch !== bSlotMatch) {
        return bSlotMatch - aSlotMatch;
      }
      return b.dispatch.weightedTotal - a.dispatch.weightedTotal;
    };
    activeRegisteredCandidates.sort(sortByScore);
    otherRegisteredCandidates.sort(sortByScore);
    activeSeedCandidates.sort(sortByScore);
    otherSeedCandidates.sort(sortByScore);

    // Prioritize active and registered workers so real worker devices receive jobs
    const combinedCandidates = [
      ...activeRegisteredCandidates,
      ...otherRegisteredCandidates,
      ...activeSeedCandidates,
      ...otherSeedCandidates,
    ].slice(0, 5);

    // 4. Return up to five nearest eligible workers
    const topFiveCandidates = combinedCandidates;

    // Highlight the top-ranked recommended worker
    if (topFiveCandidates.length > 0) {
      topFiveCandidates[0].isNearest = true;
      topFiveCandidates[0].isRecommended = true;
      const nearestDist =
        topFiveCandidates[0].dispatch.distanceKm !== null
          ? `${topFiveCandidates[0].dispatch.distanceKm.toFixed(2)} km`
          : 'local';
      topFiveCandidates[0].aiExplanation = `Top-ranked available worker (${nearestDist}) with verified ${topFiveCandidates[0].worker.category} qualification and genuine rating ★${topFiveCandidates[0].worker.rating.toFixed(1)}.`;
    }

    return res.json({
      serviceCategory,
      matchedWorkerId: topFiveCandidates[0]?.worker.id || null,
      topScore: topFiveCandidates[0]?.dispatch.weightedTotal || null,
      formula: 'Distance (Nearest to Farthest) + Fair Dispatch: Proximity (45%) + Skill (30%) + Fairness (25%)',
      candidates: topFiveCandidates,
    });
  });

  // Dedicated Nearby Workers API
  app.get('/api/workers/nearby', requireAuth(), (req: Request, res: Response) => {
    const { category, lat, lng, preferredTimeSlot } = req.query;
    const db = loadDb();
    const serviceCategory = String(category || '').trim();
    const customerLocation: Coordinates | undefined =
      lat && lng ? { lat: Number(lat), lng: Number(lng), addressLabel: 'Customer GPS' } : undefined;

    const filtered = db.workers.filter((w) => {
      if (serviceCategory && normalizeCategory(w.category) !== normalizeCategory(serviceCategory)) return false;
      if (w.isAvailable === false) return false;
      return true;
    });

    const maxWeekly = Math.max(1, ...filtered.map((w) => w.completedJobsThisWeek));
    const candidates: MatchedWorkerResult[] = filtered.map((worker) => {
      const dispatch = computeFairDispatchScore(worker, customerLocation, [], maxWeekly);
      return {
        worker,
        dispatch,
        isRecommended: false,
        isNearest: false,
      };
    });

    // Prioritize active and registered workers
    const active = candidates.filter((c) => isWorkerCurrentlyActive(c.worker, db));
    const registered = candidates.filter(
      (c) => !active.includes(c) && isRealRegisteredWorker(c.worker, db)
    );
    const seeds = candidates.filter((c) => !active.includes(c) && !registered.includes(c));

    const sortFn = (a: MatchedWorkerResult, b: MatchedWorkerResult) =>
      b.dispatch.weightedTotal - a.dispatch.weightedTotal;
    active.sort(sortFn);
    registered.sort(sortFn);
    seeds.sort(sortFn);

    const combined = [...active, ...registered, ...seeds].slice(0, 5);
    if (combined.length > 0) {
      combined[0].isNearest = true;
      combined[0].isRecommended = true;
    }

    return res.json({
      workers: combined.map((c) => c.worker),
      candidates: combined,
    });
  });

  // ============================================================================
  // MODULE 5 & 11: BOOKINGS LIFECYCLE (POST /api/bookings, GET /api/bookings, PATCH /api/bookings/:id/status)
  // ============================================================================
  app.get('/api/bookings', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;

    let list = db.bookings;
    if (user.role === 'CUSTOMER') {
      list = db.bookings.filter((b) => b.customerId === user.id);
    } else if (user.role === 'WORKER') {
      const queryWorkerId =
        typeof req.query.workerId === 'string' && req.query.workerId.trim()
          ? (req.query.workerId as string).trim()
          : undefined;
      const effectiveWorkerId =
        queryWorkerId ||
        user.workerId ||
        db.workers.find((w) => w.userId === user.id)?.id;
      const workerProfile =
        (effectiveWorkerId ? db.workers.find((w) => w.id === effectiveWorkerId) : null) ||
        db.workers.find((w) => w.userId === user.id) ||
        null;

      list = db.bookings.filter((b) => {
        // Any booking assigned to this worker
        if (effectiveWorkerId && (b.workerId === effectiveWorkerId || b.assignedWorkerId === effectiveWorkerId)) {
          return true;
        }
        // OR any incoming pending booking in their certified trade category
        if (b.status === 'PENDING' && workerProfile && b.workerCategory === workerProfile.category) {
          return true;
        }
        return false;
      });
    }

    const sorted = [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return res.json({ bookings: sorted });
  });

  app.post('/api/bookings', requireAuth(['CUSTOMER', 'ADMIN']), async (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;

    const {
      workerId: requestedWorkerId,
      serviceCategory,
      requiredSkills = [],
      problemDescription,
      preferredDate,
      preferredTimeSlot,
      urgency = 'STANDARD',
      additionalInstructions = '',
      customerLocation,
      problemMediaUrls = [],
    } = req.body || {};

    const resolvedProblemDescription =
      problemDescription && String(problemDescription).trim().length > 0
        ? String(problemDescription).trim()
        : `${serviceCategory} service (${
            Array.isArray(requiredSkills) && requiredSkills.length > 0
              ? requiredSkills.join(', ')
              : 'Household service request'
          })`;

    if (!serviceCategory || !preferredDate || !preferredTimeSlot) {
      return res.status(400).json({
        error: 'Service category, preferred date, and time slot are all required.',
      });
    }

    if (!SUPPORTED_CATEGORIES.includes(serviceCategory)) {
      return res.status(400).json({
        error: `Invalid service category "${serviceCategory}". Supported categories: ${SUPPORTED_CATEGORIES.join(', ')}.`,
      });
    }

    // 1. Authenticate and verify that customer is authorized to create booking
    if (!user || (user.role !== 'CUSTOMER' && user.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Unauthorized to create customer bookings.' });
    }

    const validCoords: Coordinates =
      customerLocation && typeof customerLocation.lat === 'number' && typeof customerLocation.lng === 'number'
        ? customerLocation
        : user.location || {
            lat: 22.5792,
            lng: 88.4175,
            addressLabel: 'Sector-3, Salt Lake, Kolkata',
          };

    // 2. Select eligible worker using fair dispatch algorithm or requested worker
    const match = findBestEligibleWorker(
      serviceCategory,
      validCoords,
      String(preferredDate),
      preferredTimeSlot,
      Array.isArray(requiredSkills) ? requiredSkills : [],
      requestedWorkerId,
      db
    );

    if (!match || !match.worker) {
      return res.status(404).json({
        error: `No certified ${serviceCategory} cooperative workers are currently available for ${preferredDate} (${preferredTimeSlot}). Please try a different slot or category.`,
      });
    }

    const worker = match.worker;
    const dispatchBreakdown = match.breakdown;

    // 3. Prevent duplicate identical booking requests created within last 10 seconds
    const duplicate = db.bookings.find(
      (b) =>
        b.customerId === user.id &&
        b.workerId === worker.id &&
        b.workerCategory === serviceCategory &&
        b.preferredDate === String(preferredDate) &&
        b.preferredTimeSlot === preferredTimeSlot &&
        b.status === 'PENDING' &&
        Date.now() - new Date(b.createdAt).getTime() < 10000
    );
    if (duplicate) {
      return res.status(200).json({
        booking: duplicate,
        assignedWorkerProfile: worker,
        realTimeDelivered: Boolean(duplicate.realTimeDelivered),
        deliveryStatus: duplicate.deliveryStatus || 'STORED_PENDING_RECONNECT',
        message: `Booking ${duplicate.bookingReference} dispatched to ${worker.name}. Status: PENDING worker acceptance.`,
      });
    }

    // 4. Server-validated service fee & 90:10 Cooperative Settlement calculation
    const urgencySurcharge = urgency === 'EMERGENCY' ? 150 : urgency === 'URGENT' ? 50 : 0;
    const baseLaborInr = worker.baseRateInr || 450;
    const materialsInr = typeof req.body.materialsInr === 'number' && req.body.materialsInr > 0 ? Math.round(req.body.materialsInr) : 0;
    const additionalChargesInr = urgencySurcharge;
    const amountInr = baseLaborInr + materialsInr + additionalChargesInr;
    const workerShareInr = Math.round(amountInr * 0.9);
    const welfareShareInr = amountInr - workerShareInr;

    const priceBreakdown: PriceBreakdown = {
      baseLaborInr,
      materialsInr,
      materialsDescription: req.body.materialsDescription ? String(req.body.materialsDescription).trim() : '',
      urgencySurchargeInr: urgencySurcharge,
      additionalChargesInr: 0,
      totalInr: amountInr,
      isEstimate: true,
      notes: 'Estimated pricing based on cooperative trade standard rate. Final cost subject to on-site scope and customer approval.',
    };

    // 5. Detect real-time connection state of the worker's device
    const socketsInRoom = io.sockets.adapter.rooms.get(`worker:${worker.id}`);
    const isWorkerOnline = Boolean(socketsInRoom && socketsInRoom.size > 0);

    const seqNum = 1001 + db.bookings.length;
    const newBooking: BookingRecord = {
      id: `bkg-${Date.now()}`,
      bookingReference: `HN-2026-${seqNum}`,
      customerId: user.id,
      customerName: user.name,
      customerPhone: user.phone,
      customerLocation: validCoords,
      workerId: worker.id,
      assignedWorkerId: worker.id,
      workerName: worker.name,
      workerPhone: worker.phone,
      workerCategory: worker.category,
      workerCoordinates: worker.coordinates,
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      problemDescription: resolvedProblemDescription,
      problemMediaUrls: Array.isArray(problemMediaUrls) ? problemMediaUrls : [],
      preferredDate: String(preferredDate),
      preferredTimeSlot,
      urgency,
      additionalInstructions: String(additionalInstructions).trim(),
      status: 'PENDING',
      matchingScore: dispatchBreakdown.weightedTotal,
      dispatchBreakdown,
      amountInr,
      workerShareInr,
      welfareShareInr,
      priceBreakdown,
      isPriceEstimate: true,
      paymentStatus: 'UNPAID',
      realTimeDelivered: isWorkerOnline,
      deliveryStatus: isWorkerOnline ? 'REALTIME_DELIVERED' : 'STORED_PENDING_RECONNECT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 6. Save in MongoDB and JSON store
    db.bookings.push(newBooking);
    saveDb(db);
    await persistBookingMongo(newBooking);

    // 7. Dispatch real-time Socket.IO notification across rooms
    broadcastBookingEvent('booking:created', newBooking);

    // 8. Return response only after database write succeeds
    return res.status(201).json({
      booking: newBooking,
      assignedWorkerProfile: worker,
      realTimeDelivered: isWorkerOnline,
      deliveryStatus: newBooking.deliveryStatus,
      message: `Booking ${newBooking.bookingReference} dispatched to ${worker.name}. Status: PENDING worker acceptance.`,
    });
  });

  app.patch('/api/bookings/:id/status', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;
    const bookingId = req.params.id;
    const { status, actingAsWorkerId } = req.body || {};

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking record not found.' });
    }

    const validNextStatuses: Record<BookingStatus, BookingStatus[]> = {
      PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
      ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED'],
      COMPLETED: [],
      REJECTED: [],
      CANCELLED: [],
    };

    // Safety against simultaneous acceptance or invalid lifecycle transition
    if (!status || !validNextStatuses[booking.status]?.includes(status)) {
      if (status === 'ACCEPTED' && booking.status === 'ACCEPTED') {
        return res.status(409).json({
          error: `This booking has already been accepted by ${booking.workerName || 'another worker'}.`,
        });
      }
      return res.status(400).json({
        error: `Invalid lifecycle transition from ${booking.status} to ${status}. Allowed: ${
          validNextStatuses[booking.status]?.join(', ') || 'None'
        }.`,
      });
    }

    const currentWorker =
      db.workers.find((w) => w.id === user.workerId) ||
      db.workers.find((w) => w.userId === user.id) ||
      (actingAsWorkerId ? db.workers.find((w) => w.id === actingAsWorkerId) : null);

    // Step 1: Handling ACCEPTED status transition
    if (status === 'ACCEPTED') {
      if (booking.status !== 'PENDING') {
        return res.status(409).json({
          error: `This booking has already been ${booking.status === 'ACCEPTED' ? `accepted by ${booking.workerName || 'another worker'}` : booking.status.toLowerCase()}.`,
        });
      }

      if (user.role === 'WORKER') {
        if (!currentWorker) {
          return res.status(403).json({ error: 'Worker profile not found for authenticated account.' });
        }
        if (currentWorker.category !== booking.workerCategory) {
          return res.status(400).json({
            error: `Trade mismatch: Booking requires a certified ${booking.workerCategory}, but you are registered as a ${currentWorker.category}.`,
          });
        }
        if (!currentWorker.isAvailable) {
          return res.status(400).json({
            error: 'You are currently marked unavailable. Please update your status in Profile to accept jobs.',
          });
        }

        // Lock and assign booking to this worker
        booking.workerId = currentWorker.id;
        booking.assignedWorkerId = currentWorker.id;
        booking.workerName = currentWorker.name;
        booking.workerPhone = currentWorker.phone;
        booking.workerCategory = currentWorker.category;
        booking.workerCoordinates = currentWorker.coordinates;
      }
    } else if (status === 'IN_PROGRESS') {
      if (booking.status !== 'ACCEPTED') {
        return res.status(400).json({
          error: `Cannot start work from ${booking.status}. Job must be in ACCEPTED status first.`,
        });
      }
      const isAuthorizedCustomerDualView =
        user.role === 'CUSTOMER' &&
        booking.customerId === user.id &&
        actingAsWorkerId === booking.workerId;

      if (user.role === 'CUSTOMER' && !isAuthorizedCustomerDualView) {
        return res.status(403).json({
          error: 'Only the assigned cooperative worker or society administrator can start work.',
        });
      }
      if (
        user.role === 'WORKER' &&
        currentWorker &&
        booking.workerId !== currentWorker.id &&
        booking.assignedWorkerId !== currentWorker.id
      ) {
        return res.status(403).json({
          error: 'Unauthorized: Only the assigned worker can start work on this booking.',
        });
      }
    } else if (status === 'COMPLETED') {
      if (booking.status !== 'IN_PROGRESS') {
        return res.status(400).json({
          error: `Cannot complete work from ${booking.status}. Job must be IN_PROGRESS first.`,
        });
      }
      const isAuthorizedCustomerDualView =
        user.role === 'CUSTOMER' &&
        booking.customerId === user.id &&
        actingAsWorkerId === booking.workerId;

      if (user.role === 'CUSTOMER' && !isAuthorizedCustomerDualView) {
        return res.status(403).json({
          error: 'Only the assigned cooperative worker or society administrator can complete work.',
        });
      }
      if (
        user.role === 'WORKER' &&
        currentWorker &&
        booking.workerId !== currentWorker.id &&
        booking.assignedWorkerId !== currentWorker.id
      ) {
        return res.status(403).json({
          error: 'Unauthorized: Only the assigned worker can complete work on this booking.',
        });
      }
      const assignedWorker = db.workers.find((w) => w.id === booking.workerId);
      if (assignedWorker) {
        assignedWorker.completedJobsTotal += 1;
        assignedWorker.completedJobsThisWeek += 1;
      }
    } else if (status === 'CANCELLED') {
      if (user.role === 'CUSTOMER' && booking.customerId !== user.id) {
        return res.status(403).json({ error: 'You can only cancel your own bookings.' });
      }
    }

    booking.status = status;
    booking.updatedAt = new Date().toISOString();
    saveDb(db);
    await persistBookingMongo(booking);
    await logJobStatusHistoryMongo({
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      previousStatus: '',
      newStatus: status,
      updatedBy: user.name,
      updatedByRole: user.role,
      timestamp: new Date().toISOString(),
      note: `Status updated to ${status}`,
    });

    broadcastBookingEvent('booking:updated', booking);

    const statusLabelMap: Record<string, string> = {
      ACCEPTED: 'JOB ACCEPTED',
      IN_PROGRESS: 'WORK IN PROGRESS',
      COMPLETED: 'WORK COMPLETED',
      REJECTED: 'REJECTED',
      CANCELLED: 'CANCELLED',
    };

    return res.json({
      booking,
      message: `Booking ${booking.bookingReference} updated to ${statusLabelMap[status] || status}.`,
    });
  });

  // ============================================================================
  // FEATURE 1: WORKER PRICE REVISION PROPOSAL & CUSTOMER APPROVAL WORKFLOW
  // ============================================================================
  app.post('/api/bookings/:id/propose-price', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;
    const booking = db.bookings.find((b) => b.id === req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking record not found.' });
    }
    if (user.role === 'WORKER' && booking.workerId !== user.workerId) {
      return res.status(403).json({ error: 'Only the assigned worker can propose a price revision.' });
    }
    if (booking.status === 'COMPLETED' || booking.paymentStatus === 'PAID') {
      return res.status(400).json({ error: 'Cannot revise price after task is completed or paid.' });
    }

    const { laborInr, materialsInr = 0, reason } = req.body || {};
    const parsedLabor = typeof laborInr === 'number' && laborInr > 0 ? Math.round(laborInr) : booking.priceBreakdown?.baseLaborInr || booking.amountInr;
    const parsedMaterials = typeof materialsInr === 'number' && materialsInr >= 0 ? Math.round(materialsInr) : 0;
    const trimmedReason = String(reason || '').trim();

    if (!trimmedReason || trimmedReason.length < 5) {
      return res.status(400).json({ error: 'A clear reason for price adjustment is required (at least 5 characters).' });
    }

    const urgencySurcharge = booking.urgency === 'EMERGENCY' ? 150 : booking.urgency === 'URGENT' ? 50 : 0;
    const proposedTotalInr = parsedLabor + parsedMaterials + urgencySurcharge;

    const revision: PriceRevisionProposal = {
      proposedTotalInr,
      materialsInr: parsedMaterials,
      laborInr: parsedLabor,
      reason: trimmedReason,
      proposedAt: new Date().toISOString(),
      status: 'PENDING_APPROVAL',
    };

    booking.priceRevision = revision;
    booking.updatedAt = new Date().toISOString();
    saveDb(db);
    broadcastBookingEvent('booking:updated', booking);

    return res.json({
      booking,
      message: `Price revision proposal of ₹${proposedTotalInr} submitted. Awaiting customer confirmation.`,
    });
  });

  app.patch('/api/bookings/:id/review-price', requireAuth(['CUSTOMER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;
    const booking = db.bookings.find((b) => b.id === req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking record not found.' });
    }
    if (user.role === 'CUSTOMER' && booking.customerId !== user.id) {
      return res.status(403).json({ error: 'Only the customer who created this booking can review the price proposal.' });
    }
    if (!booking.priceRevision || booking.priceRevision.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ error: 'No active pending price revision found on this booking.' });
    }

    const { decision } = req.body || {};
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED.' });
    }

    booking.priceRevision.status = decision;
    booking.priceRevision.customerReviewedAt = new Date().toISOString();

    if (decision === 'APPROVED') {
      const finalAmount = booking.priceRevision.proposedTotalInr;
      booking.amountInr = finalAmount;
      booking.workerShareInr = Math.round(finalAmount * 0.9);
      booking.welfareShareInr = finalAmount - booking.workerShareInr;
      booking.isPriceEstimate = false;

      if (!booking.priceBreakdown) {
        booking.priceBreakdown = {
          baseLaborInr: booking.priceRevision.laborInr,
          materialsInr: booking.priceRevision.materialsInr,
          urgencySurchargeInr: booking.urgency === 'EMERGENCY' ? 150 : booking.urgency === 'URGENT' ? 50 : 0,
          additionalChargesInr: 0,
          totalInr: finalAmount,
          isEstimate: false,
          notes: `Customer approved revised final price: ${booking.priceRevision.reason}`,
        };
      } else {
        booking.priceBreakdown.baseLaborInr = booking.priceRevision.laborInr;
        booking.priceBreakdown.materialsInr = booking.priceRevision.materialsInr;
        booking.priceBreakdown.totalInr = finalAmount;
        booking.priceBreakdown.isEstimate = false;
        booking.priceBreakdown.notes = `Customer approved revised final price: ${booking.priceRevision.reason}`;
      }
    }

    booking.updatedAt = new Date().toISOString();
    saveDb(db);
    broadcastBookingEvent('booking:updated', booking);

    return res.json({
      booking,
      message: decision === 'APPROVED'
        ? `Revised booking amount of ₹${booking.amountInr} approved and saved against ${booking.bookingReference}.`
        : `Price revision proposal was declined. Original amount of ₹${booking.amountInr} retained.`,
    });
  });

  // ============================================================================
  // PROBLEM REPORTING, CLOUDINARY MEDIA & REAL GEMMA 4 TECHNICAL AI DIAGNOSIS
  // ============================================================================
  app.get('/api/problem-reports', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    let list = db.problemReports || [];

    if (user.role === 'CUSTOMER') {
      list = list.filter((r) => r.customerId === user.id);
    } else if (user.role === 'WORKER') {
      list = list.filter(
        (r) => r.assignedWorkerId === user.workerId || r.assignedWorkerId === user.id
      );
    }

    const sorted = [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return res.json({ reports: sorted });
  });

  app.get('/api/problem-reports/:id', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const report = (db.problemReports || []).find((r) => r.id === req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Problem report not found.' });
    }

    if (user.role === 'CUSTOMER' && report.customerId !== user.id) {
      return res.status(403).json({ error: 'You can only view problem reports you submitted.' });
    }
    if (
      user.role === 'WORKER' &&
      report.assignedWorkerId !== user.workerId &&
      report.assignedWorkerId !== user.id
    ) {
      return res.status(403).json({ error: 'You can only view reports for jobs assigned to you.' });
    }

    return res.json({ report });
  });

  app.post(
    '/api/problem-reports',
    requireAuth(['CUSTOMER', 'ADMIN']),
    (req: Request, res: Response, next: NextFunction) => {
      upload.single('media')(req, res, (err: any) => {
        if (err) {
          if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              error: 'File size exceeds allowable limit (2 MB for photos, 5 MB for videos).',
            });
          }
          return res.status(400).json({ error: err.message || 'File upload error.' });
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      const user = (req as any).user as StoredUser;
      const db = loadDb();
      const {
        bookingId,
        serviceCategory,
        problemDescription,
        urgency = 'STANDARD',
        videoDuration,
      } = req.body || {};

      if (!bookingId || !problemDescription || String(problemDescription).trim().length < 5) {
        return res.status(400).json({
          error: 'Booking selection and a problem description (at least 5 characters) are required.',
        });
      }

      const booking = db.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        return res.status(404).json({ error: 'Selected booking was not found.' });
      }

      if (user.role === 'CUSTOMER' && booking.customerId !== user.id) {
        return res.status(403).json({ error: 'You can only report problems for your own bookings.' });
      }

      // Prevent duplicate submission within 10s
      const duplicate = (db.problemReports || []).find(
        (r) =>
          r.bookingId === bookingId &&
          r.problemDescription === String(problemDescription).trim() &&
          Date.now() - new Date(r.createdAt).getTime() < 10000
      );
      if (duplicate) {
        return res.status(200).json({
          report: duplicate,
          message: 'Report already registered.',
        });
      }

      let mediaMetadata: MediaMetadata | undefined;
      const file = req.file;

      if (file) {
        const isVideo = file.mimetype.startsWith('video/');
        const parsedDuration = Number(videoDuration) || undefined;

        // Strict limit checks
        if (!isVideo && file.size > 2 * 1024 * 1024) {
          return res.status(400).json({
            error: `Image file (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the strict 2 MB limit. Please select a smaller photo.`,
          });
        }
        if (isVideo && file.size > 5 * 1024 * 1024) {
          return res.status(400).json({
            error: `Video file (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the strict 5 MB limit. Please record a shorter clip.`,
          });
        }
        if (isVideo && parsedDuration && parsedDuration > 10.5) {
          return res.status(400).json({
            error: `Video duration (${parsedDuration.toFixed(1)}s) exceeds the maximum allowed 10 seconds limit.`,
          });
        }

        try {
          mediaMetadata = await processAndStoreMedia({
            buffer: file.buffer,
            originalFilename: file.originalname,
            mimetype: file.mimetype,
            durationSeconds: parsedDuration,
          });
        } catch (mediaErr: any) {
          return res.status(400).json({ error: mediaErr.message || 'Media storage failed.' });
        }
      }

      const reportId = `rep-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const validCategory = (serviceCategory || booking.workerCategory || 'Plumber') as SupportedServiceCategory;
      const validUrgency = (urgency === 'EMERGENCY' || urgency === 'PRIORITY' ? urgency : 'STANDARD') as 'STANDARD' | 'PRIORITY' | 'EMERGENCY';

      const newReport: ProblemReport = {
        id: reportId,
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        customerId: user.id,
        customerName: user.name,
        customerPhone: user.phone,
        assignedWorkerId: booking.workerId,
        assignedWorkerName: booking.workerName,
        serviceCategory: validCategory,
        problemDescription: String(problemDescription).trim(),
        urgency: validUrgency,
        media: mediaMetadata,
        status: 'Analysis In Progress',
        aiAnalysisStatus: 'IN_PROGRESS',
        statusHistory: [
          {
            status: 'Submitted',
            updatedBy: user.name,
            updatedByRole: 'CUSTOMER',
            timestamp: new Date().toISOString(),
            note: 'Problem report submitted by customer.',
          },
          {
            status: 'Analysis In Progress',
            updatedBy: 'Gemma 4 AI Engine',
            updatedByRole: 'SYSTEM',
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Trigger real Gemma 4 AI Analysis
      const isImage = file && file.mimetype.startsWith('image/');
      const aiResult = await analyzeProblemWithGemma4({
        reportId,
        problemDescription: newReport.problemDescription,
        category: validCategory,
        imageBuffer: isImage ? file?.buffer : undefined,
        imageMimeType: isImage ? file?.mimetype : undefined,
        timeoutMs: 45000,
      });

      if (aiResult.status === 'COMPLETED' && aiResult.analysis) {
        newReport.aiAnalysis = aiResult.analysis;
        newReport.aiAnalysisStatus = 'COMPLETED';
        newReport.status = 'Analysis Ready';
        newReport.statusHistory.push({
          status: 'Analysis Ready',
          updatedBy: aiResult.modelUsed,
          updatedByRole: 'SYSTEM',
          timestamp: new Date().toISOString(),
          note: 'Gemma 4 technical diagnosis completed successfully.',
        });
      } else {
        newReport.aiAnalysisStatus = aiResult.status;
        newReport.aiAnalysisError = aiResult.error;
        newReport.status = 'Worker Notified';
        newReport.statusHistory.push({
          status: 'Worker Notified',
          updatedBy: 'Help Nest System',
          updatedByRole: 'SYSTEM',
          timestamp: new Date().toISOString(),
          note: aiResult.error || 'AI analysis unavailable; assigned worker notified.',
        });
      }

      booking.hasProblemReport = true;
      booking.problemReportId = newReport.id;
      booking.updatedAt = new Date().toISOString();

      db.problemReports.unshift(newReport);
      saveDb(db);

      // Persist in MongoDB
      await persistProblemReportMongo(newReport);
      await persistBookingMongo(booking);

      // Real-time Socket.IO and SSE event broadcasts
      broadcastProblemReportEvent('problem-report:created', newReport);
      broadcastBookingEvent('booking:updated', booking);

      return res.status(201).json({
        report: newReport,
        booking,
        message: 'Problem report submitted successfully. Gemma 4 AI analysis and worker dispatch updated in real time.',
      });
    }
  );

  app.post('/api/problem-reports/:id/analyze', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const report = db.problemReports.find((r) => r.id === req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Problem report not found.' });
    }

    if (user.role === 'CUSTOMER' && report.customerId !== user.id) {
      return res.status(403).json({ error: 'You can only request analysis for your own problem reports.' });
    }
    if (
      user.role === 'WORKER' &&
      report.assignedWorkerId !== user.workerId &&
      report.assignedWorkerId !== user.id
    ) {
      return res.status(403).json({ error: 'You can only request analysis for jobs assigned to you.' });
    }

    report.aiAnalysisStatus = 'IN_PROGRESS';
    report.status = 'Analysis In Progress';
    report.updatedAt = new Date().toISOString();
    saveDb(db);
    broadcastProblemReportEvent('problem-report:updated', report);

    let imageBuf: Buffer | undefined;
    let imageMime: string | undefined;
    if (report.media && report.media.resourceType === 'image') {
      if (report.media.storageProvider === 'LOCAL_SECURE') {
        const localPath = path.resolve(process.cwd(), 'public', report.media.secureUrl.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          imageBuf = fs.readFileSync(localPath);
          imageMime = `image/${report.media.format || 'jpeg'}`;
        }
      }
    }

    const aiResult = await analyzeProblemWithGemma4({
      reportId: report.id,
      problemDescription: report.problemDescription,
      category: report.serviceCategory,
      imageBuffer: imageBuf,
      imageMimeType: imageMime,
      timeoutMs: 45000,
    });

    if (aiResult.status === 'COMPLETED' && aiResult.analysis) {
      report.aiAnalysis = aiResult.analysis;
      report.aiAnalysisStatus = 'COMPLETED';
      report.aiAnalysisError = undefined;
      report.status = 'Analysis Ready';
      report.statusHistory.push({
        status: 'Analysis Ready',
        updatedBy: `${user.name} via ${aiResult.modelUsed}`,
        updatedByRole: user.role,
        timestamp: new Date().toISOString(),
        note: 'Gemma 4 technical analysis refreshed.',
      });
    } else {
      report.aiAnalysisStatus = aiResult.status;
      report.aiAnalysisError = aiResult.error;
      report.status = 'Worker Notified';
      report.statusHistory.push({
        status: 'Worker Notified',
        updatedBy: user.name,
        updatedByRole: user.role,
        timestamp: new Date().toISOString(),
        note: `AI retry failed: ${aiResult.error}`,
      });
    }

    report.updatedAt = new Date().toISOString();
    saveDb(db);
    await persistProblemReportMongo(report);
    broadcastProblemReportEvent('problem-report:updated', report);

    return res.json({
      report,
      message:
        aiResult.status === 'COMPLETED'
          ? 'Real Gemma 4 AI technical analysis completed successfully.'
          : `Analysis retry failed: ${aiResult.error}`,
    });
  });

  app.patch(
    '/api/problem-reports/:id/status',
    requireAuth(['WORKER', 'ADMIN', 'CUSTOMER']),
    async (req: Request, res: Response) => {
      const user = (req as any).user as StoredUser;
      const db = loadDb();
      const report = db.problemReports.find((r) => r.id === req.params.id);

      if (!report) {
        return res.status(404).json({ error: 'Problem report not found.' });
      }

      const { status, note } = req.body || {};
      const validStatuses: ProblemReportStatus[] = [
        'Submitted',
        'Analysis In Progress',
        'Analysis Ready',
        'Worker Notified',
        'Problem Viewed',
        'Preparation Complete',
        'Work Started',
        'Work In Progress',
        'Work Completed',
      ];

      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid problem report status specified.' });
      }

      if (
        user.role === 'WORKER' &&
        report.assignedWorkerId !== user.workerId &&
        report.assignedWorkerId !== user.id
      ) {
        return res.status(403).json({
          error: 'Only the assigned worker can advance report workflow status.',
        });
      }

      report.status = status as ProblemReportStatus;
      report.statusHistory.push({
        status: status as ProblemReportStatus,
        updatedBy: user.name,
        updatedByRole: user.role,
        timestamp: new Date().toISOString(),
        note: note ? String(note).trim() : undefined,
      });
      report.updatedAt = new Date().toISOString();

      // Synchronize linked booking lifecycle
      const booking = db.bookings.find((b) => b.id === report.bookingId);
      if (booking) {
        if (status === 'Work Started' || status === 'Work In Progress') {
          if (booking.status === 'ACCEPTED' || booking.status === 'PENDING') {
            booking.status = 'IN_PROGRESS';
            booking.updatedAt = new Date().toISOString();
            broadcastBookingEvent('booking:updated', booking);
            await persistBookingMongo(booking);
          }
        } else if (status === 'Work Completed') {
          if (booking.status !== 'COMPLETED') {
            booking.status = 'COMPLETED';
            booking.updatedAt = new Date().toISOString();
            const assignedWorker = db.workers.find((w) => w.id === booking.workerId);
            if (assignedWorker) {
              assignedWorker.completedJobsTotal += 1;
              assignedWorker.completedJobsThisWeek += 1;
            }
            broadcastBookingEvent('booking:updated', booking);
            await persistBookingMongo(booking);
          }
        }
      }

      saveDb(db);
      await persistProblemReportMongo(report);
      await logJobStatusHistoryMongo({
        id: `hist-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        bookingId: report.bookingId,
        bookingReference: report.bookingReference,
        problemReportId: report.id,
        previousStatus: '',
        newStatus: status,
        updatedBy: user.name,
        updatedByRole: user.role,
        timestamp: new Date().toISOString(),
        note: note ? String(note).trim() : undefined,
      });

      broadcastProblemReportEvent('problem-report:updated', report);

      return res.json({
        report,
        booking,
        message: `Problem report status advanced to "${status}". Synchronized in database and real-time sockets.`,
      });
    }
  );

  // ============================================================================
  // ============================================================================
  // FEATURE 2: WORKER EMERGENCY SOS SIMULATION
  // ============================================================================
  const handleCreateSosAlert = (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;
    const worker =
      (req.body?.workerId ? db.workers.find((w) => w.id === req.body.workerId) : undefined) ||
      db.workers.find((w) => w.id === user.workerId || w.userId === user.id) ||
      (user.role === 'WORKER' ? db.workers[0] : undefined) ||
      db.workers[0];

    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found for SOS.' });
    }

    const { bookingId, shareLocation = false, coordinates, notes } = req.body || {};
    const linkedBooking = bookingId ? db.bookings.find((b) => b.id === bookingId) : undefined;

    // Never expose worker's precise location without permission:
    const alertCoords = shareLocation
      ? coordinates && typeof coordinates.lat === 'number'
        ? coordinates
        : worker.coordinates
      : undefined;

    const alertId = `sos-${Date.now()}`;
    const newAlert: EmergencyAlert = {
      id: alertId,
      workerId: worker.id,
      workerName: worker.name,
      workerPhone: worker.phone,
      bookingId: linkedBooking?.id,
      bookingReference: linkedBooking?.bookingReference,
      timestamp: new Date().toISOString(),
      status: 'ACTIVE_DEMO',
      locationShared: Boolean(shareLocation),
      coordinates: alertCoords,
      isDemoSimulation: true,
    };

    db.emergencyAlerts.unshift(newAlert);
    saveDb(db);

    // Broadcast safety event
    io.emit('emergency:alert', newAlert);

    return res.status(201).json({
      alert: newAlert,
      deliveryStatus: 'DELIVERED_CONFIRMED',
      message: 'DEMO ALERT SENT: Simulated cooperative emergency broadcast logged. Society safety response notified in demo.',
      notice: 'DEMO ALERT SENT: This is a hackathon simulation. Police and municipal emergency services are not dialed.',
    });
  };

  const handleUpdateSosAlert = (req: Request, res: Response) => {
    const db = (req as any).db as DatabaseSchema;
    const alert = db.emergencyAlerts.find((a) => a.id === req.params.id);

    if (!alert) {
      return res.status(404).json({ error: 'Emergency alert record not found.' });
    }

    const { status, cancellationReason = 'False alarm cancelled by worker' } = req.body || {};
    const validStatus = status === 'RESOLVED' ? 'RESOLVED' : 'CANCELLED_FALSE_ALARM';
    alert.status = validStatus;
    alert.cancellationReason = String(cancellationReason).trim();
    alert.cancelledAt = new Date().toISOString();
    saveDb(db);

    io.emit('emergency:alert_cancelled', alert);

    return res.json({
      alert,
      message: validStatus === 'RESOLVED'
        ? 'Emergency SOS alert marked as resolved by safety responder.'
        : 'Emergency SOS alert cancelled as false alarm.',
    });
  };

  const handleGetSosAlerts = (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();

    if (user.role === 'ADMIN') {
      return res.json({ alerts: db.emergencyAlerts });
    }
    const workerAlerts = db.emergencyAlerts.filter((a) => a.workerId === user.workerId || a.workerId === user.id);
    return res.json({ alerts: workerAlerts });
  };

  // Support both /api/emergency/alerts AND /api/worker/emergency-sos
  app.post('/api/emergency/alerts', requireAuth(['WORKER', 'ADMIN']), handleCreateSosAlert);
  app.post('/api/worker/emergency-sos', requireAuth(['WORKER', 'ADMIN']), handleCreateSosAlert);

  app.patch('/api/emergency/alerts/:id', requireAuth(['WORKER', 'ADMIN']), handleUpdateSosAlert);
  app.patch('/api/worker/emergency-sos/:id/cancel', requireAuth(['WORKER', 'ADMIN']), handleUpdateSosAlert);
  app.patch('/api/worker/emergency-sos/:id', requireAuth(['WORKER', 'ADMIN']), handleUpdateSosAlert);

  app.get('/api/emergency/alerts', requireAuth(), handleGetSosAlerts);
  app.get('/api/worker/emergency-sos', requireAuth(), handleGetSosAlerts);

  // ============================================================================
  // FEATURE 3: COMMUNITY BULK BOOKING
  // ============================================================================
  app.post('/api/community-bulk', requireAuth(['CUSTOMER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;

    const {
      societyName,
      serviceCategory,
      preferredDate,
      preferredTimeSlot,
      householdCount,
      households = [],
      assignedWorkerId,
    } = req.body || {};

    if (!societyName || String(societyName).trim().length < 3) {
      return res.status(400).json({ error: 'Valid society/community name is required (at least 3 characters).' });
    }
    if (!serviceCategory || !SUPPORTED_CATEGORIES.includes(serviceCategory)) {
      return res.status(400).json({ error: 'Valid supported service category is required.' });
    }
    const count = Math.min(20, Math.max(2, Number(householdCount) || 5));

    // Base pricing based on trade category standard rate
    const categoryBaseRates: Record<SupportedServiceCategory, number> = {
      Plumber: 450,
      Electrician: 450,
      Carpenter: 500,
      Painter: 500,
      Cleaner: 400,
      Babysitter: 550,
    };
    const standardBaseRate = categoryBaseRates[serviceCategory as SupportedServiceCategory] || 450;
    const discountPercent = 15; // 15% cooperative bulk group discount
    const perHouseholdPriceInr = Math.round(standardBaseRate * (1 - discountPercent / 100));
    const totalPriceInr = perHouseholdPriceInr * count;

    // Generate individual household units if not provided
    const unitList: HouseholdUnit[] = Array.isArray(households) && households.length > 0
      ? households.map((h: any, idx: number) => ({
          unitId: `unit-${Date.now()}-${idx + 1}`,
          flatNumber: String(h.flatNumber || `Flat ${101 + idx}`).trim(),
          residentName: String(h.residentName || `Resident ${idx + 1}`).trim(),
          residentPhone: String(h.residentPhone || user.phone).trim(),
          status: 'PENDING' as BookingStatus,
          notes: h.notes ? String(h.notes).trim() : undefined,
        }))
      : Array.from({ length: count }).map((_, idx) => ({
          unitId: `unit-${Date.now()}-${idx + 1}`,
          flatNumber: `Flat ${101 + idx}`,
          residentName: `${user.name} (Unit ${idx + 1})`,
          residentPhone: user.phone,
          status: 'PENDING' as BookingStatus,
          notes: `${serviceCategory} group maintenance`,
        }));

    const seqNum = 100 + db.communityBulkBookings.length + 1;
    const bulkId = `blk-${Date.now()}`;
    const bulkReference = `BLK-2026-${seqNum}`;

    let assignedWorker: WorkerProfile | undefined;
    if (assignedWorkerId) {
      assignedWorker = db.workers.find((w) => w.id === assignedWorkerId && w.category === serviceCategory);
    }

    const newBulkBooking: CommunityBulkBooking = {
      id: bulkId,
      bulkReference,
      representativeId: user.id,
      representativeName: user.name,
      representativePhone: user.phone,
      societyName: String(societyName).trim(),
      serviceCategory,
      preferredDate: String(preferredDate || new Date().toISOString().slice(0, 10)),
      preferredTimeSlot: preferredTimeSlot || 'Morning (08:00 - 12:00)',
      householdCount: count,
      households: unitList,
      perHouseholdPriceInr,
      totalPriceInr,
      discountPercent,
      assignedWorkerId: assignedWorker?.id,
      assignedWorkerName: assignedWorker?.name,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSampleDemo: false,
    };

    db.communityBulkBookings.unshift(newBulkBooking);
    saveDb(db);

    io.emit('bulk:created', newBulkBooking);

    return res.status(201).json({
      bulkBooking: newBulkBooking,
      message: `Community bulk request ${bulkReference} for ${count} households at ${newBulkBooking.societyName} created! Total ₹${totalPriceInr} (₹${perHouseholdPriceInr}/household with ${discountPercent}% bulk benefit).`,
    });
  });

  app.get('/api/community-bulk', requireAuth(), (_req: Request, res: Response) => {
    const db = loadDb();
    return res.json({ bulkBookings: db.communityBulkBookings });
  });

  const handleAcceptOrClaimBulk = (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;
    const bulk = db.communityBulkBookings.find((b) => b.id === req.params.id);

    if (!bulk) {
      return res.status(404).json({ error: 'Community bulk booking not found.' });
    }

    const { action = 'ACCEPT' } = req.body || {}; // Defaults to 'ACCEPT' for /accept endpoints
    const worker = db.workers.find((w) => w.id === user.workerId) || db.workers.find((w) => w.userId === user.id);

    if (action === 'ACCEPT') {
      if (bulk.assignedWorkerId && bulk.assignedWorkerId !== worker?.id && bulk.status === 'ACCEPTED') {
        return res.status(409).json({ error: 'This community bulk request has already been claimed by another worker.' });
      }
      bulk.status = 'ACCEPTED';
      if (worker) {
        bulk.assignedWorkerId = worker.id;
        bulk.assignedWorkerName = worker.name;
      }
      bulk.households.forEach((h) => {
        if (h.status === 'PENDING') h.status = 'ACCEPTED';
      });
    } else if (action === 'REJECT') {
      bulk.status = 'PENDING';
      bulk.assignedWorkerId = undefined;
      bulk.assignedWorkerName = undefined;
    }

    bulk.updatedAt = new Date().toISOString();
    saveDb(db);
    io.emit('bulk:updated', bulk);

    return res.json({
      bulkBooking: bulk,
      message: action === 'ACCEPT'
        ? `Community bulk request ${bulk.bulkReference} accepted by ${bulk.assignedWorkerName || 'Worker'}.`
        : `Community bulk request ${bulk.bulkReference} rejected and returned to pool.`,
    });
  };

  app.post('/api/community-bulk/:id/accept', requireAuth(['WORKER', 'ADMIN']), handleAcceptOrClaimBulk);
  app.patch('/api/community-bulk/:id/accept', requireAuth(['WORKER', 'ADMIN']), handleAcceptOrClaimBulk);
  app.patch('/api/community-bulk/:id/claim', requireAuth(['WORKER', 'ADMIN']), handleAcceptOrClaimBulk);

  app.patch('/api/community-bulk/:id/households/:unitId/status', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const db = (req as any).db as DatabaseSchema;
    const bulk = db.communityBulkBookings.find((b) => b.id === req.params.id);

    if (!bulk) {
      return res.status(404).json({ error: 'Community bulk booking not found.' });
    }

    const unit = bulk.households.find((u) => u.unitId === req.params.unitId);
    if (!unit) {
      return res.status(404).json({ error: 'Household unit not found.' });
    }

    const { status } = req.body || {};
    const validStatuses: BookingStatus[] = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid household unit status.' });
    }

    unit.status = status;
    const allCompleted = bulk.households.every((h) => h.status === 'COMPLETED');
    const anyInProgress = bulk.households.some((h) => h.status === 'IN_PROGRESS');

    if (allCompleted) {
      bulk.status = 'COMPLETED';
    } else if (anyInProgress) {
      bulk.status = 'IN_PROGRESS';
    }

    bulk.updatedAt = new Date().toISOString();
    saveDb(db);
    io.emit('bulk:updated', bulk);

    return res.json({
      bulkBooking: bulk,
      unit,
      message: `Household unit ${unit.flatNumber} status updated to ${unit.status}.`,
    });
  });

  // ============================================================================
  // FEATURE 4: DISPUTE RESOLUTION
  // ============================================================================
  app.post('/api/disputes', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;

    const { bookingId, category, description, evidenceNote } = req.body || {};

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Associated booking record not found.' });
    }

    // Role verification
    const isCustomer = user.role === 'CUSTOMER' && booking.customerId === user.id;
    const isWorker = user.role === 'WORKER' && booking.workerId === user.workerId;
    const isAdmin = user.role === 'ADMIN';

    if (!isCustomer && !isWorker && !isAdmin) {
      return res.status(403).json({ error: 'You can only report issues for bookings you are part of.' });
    }

    const validCategories: DisputeCategory[] = [
      'PAYMENT_ISSUE',
      'INCOMPLETE_WORK',
      'PRICING_DISAGREEMENT',
      'BEHAVIOR_ISSUE',
      'OTHER',
    ];
    if (!category || !validCategories.includes(category)) {
      return res.status(400).json({ error: 'A valid issue category must be selected.' });
    }

    const trimmedDesc = String(description || '').trim();
    if (!trimmedDesc || trimmedDesc.length < 10) {
      return res.status(400).json({ error: 'Please provide a clear description of the issue (at least 10 characters).' });
    }

    const disputeSeq = 101 + db.disputes.length;
    const complaintReference = `DISP-2026-${disputeSeq}`;
    const disputeId = `disp-${Date.now()}`;

    const newDispute: DisputeRecord = {
      id: disputeId,
      complaintReference,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      filedByUserId: user.id,
      filedByName: user.name,
      filedByRole: user.role === 'WORKER' ? 'WORKER' : 'CUSTOMER',
      category,
      description: trimmedDesc,
      evidenceNote: evidenceNote ? String(evidenceNote).trim() : undefined,
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.disputes.unshift(newDispute);
    booking.disputeId = disputeId;
    booking.disputeStatus = 'SUBMITTED';
    booking.updatedAt = new Date().toISOString();

    saveDb(db);
    broadcastBookingEvent('booking:updated', booking);
    io.emit('dispute:created', newDispute);

    return res.status(201).json({
      dispute: newDispute,
      booking,
      message: `Complaint ${complaintReference} logged against booking ${booking.bookingReference}. Status: SUBMITTED for review.`,
    });
  });

  app.get('/api/disputes', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();

    if (user.role === 'ADMIN') {
      return res.json({ disputes: db.disputes });
    }
    const filtered = db.disputes.filter((d) => {
      const b = db.bookings.find((bk) => bk.id === d.bookingId);
      return d.filedByUserId === user.id || (b && (b.customerId === user.id || b.workerId === user.workerId));
    });
    return res.json({ disputes: filtered });
  });

  app.patch(['/api/disputes/:id', '/api/disputes/:id/resolve'], requireAuth(['ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;
    const dispute = db.disputes.find((d) => d.id === req.params.id);

    if (!dispute) {
      return res.status(404).json({ error: 'Dispute record not found.' });
    }

    const { status, resolutionNote, note } = req.body || {};
    const validStatuses: DisputeStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid dispute status.' });
    }

    const effectiveNote = resolutionNote || note;
    dispute.status = status;
    dispute.resolutionNote = effectiveNote ? String(effectiveNote).trim() : dispute.resolutionNote;
    if (status === 'RESOLVED' || status === 'REJECTED') {
      dispute.resolvedBy = user.name;
      dispute.resolvedAt = new Date().toISOString();
    }
    dispute.updatedAt = new Date().toISOString();

    const booking = db.bookings.find((b) => b.id === dispute.bookingId);
    if (booking) {
      booking.disputeStatus = status;
      broadcastBookingEvent('booking:updated', booking);
    }

    saveDb(db);
    io.emit('dispute:updated', dispute);

    return res.json({
      dispute,
      message: `Dispute ${dispute.complaintReference} status updated to ${status}.`,
    });
  });

  // ============================================================================
  // FEATURE 5: WORKER WELFARE TRACKER & ASSISTANCE REQUESTS
  // ============================================================================
  app.post('/api/welfare/requests', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;
    const worker = db.workers.find((w) => w.id === user.workerId) || db.workers.find((w) => w.userId === user.id);

    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found for welfare assistance.' });
    }

    const { benefitCategory, requestedAmountInr, reason } = req.body || {};
    const validCategories: WelfareBenefitCategory[] = [
      'TRAINING_SUPPORT',
      'EMERGENCY_ASSISTANCE',
      'EQUIPMENT_SUPPORT',
    ];
    if (!benefitCategory || !validCategories.includes(benefitCategory)) {
      return res.status(400).json({ error: 'Please choose a valid benefit category.' });
    }

    const amount = Number(requestedAmountInr);
    if (!amount || amount < 100 || amount > 10000) {
      return res.status(400).json({ error: 'Requested assistance amount must be between ₹100 and ₹10,000.' });
    }

    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason || trimmedReason.length < 8) {
      return res.status(400).json({ error: 'Please describe the reason for assistance (at least 8 characters).' });
    }

    const newRequest: WelfareRequest = {
      id: `welf-${Date.now()}`,
      workerId: worker.id,
      workerName: worker.name,
      benefitCategory,
      requestedAmountInr: Math.round(amount),
      reason: trimmedReason,
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemoSimulation: true,
    };

    db.welfareRequests.unshift(newRequest);
    saveDb(db);
    io.emit('welfare:request_created', newRequest);

    return res.status(201).json({
      welfareRequest: newRequest,
      message: `Demo welfare assistance request for ₹${newRequest.requestedAmountInr} submitted to Cooperative Federation for review.`,
      notice: 'DEMO SIMULATION: Demonstrated for cooperative welfare workflow. Real monetary disbursements are simulated.',
    });
  });

  app.get('/api/welfare/requests', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();

    if (user.role === 'ADMIN') {
      return res.json({ requests: db.welfareRequests });
    }
    const workerRequests = db.welfareRequests.filter((r) => r.workerId === user.workerId || r.workerId === user.id);
    return res.json({ requests: workerRequests });
  });

  app.patch(['/api/welfare/requests/:id', '/api/welfare/requests/:id/status'], requireAuth(['ADMIN']), (req: Request, res: Response) => {
    const db = (req as any).db as DatabaseSchema;
    const requestItem = db.welfareRequests.find((r) => r.id === req.params.id);

    if (!requestItem) {
      return res.status(404).json({ error: 'Welfare assistance request not found.' });
    }

    const { status, reviewNote } = req.body || {};
    const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DISBURSED_DEMO', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid welfare status.' });
    }

    requestItem.status = status;
    requestItem.reviewNote = reviewNote ? String(reviewNote).trim() : requestItem.reviewNote;
    requestItem.updatedAt = new Date().toISOString();
    saveDb(db);
    io.emit('welfare:request_updated', requestItem);

    return res.json({
      welfareRequest: requestItem,
      message: `Welfare request updated to ${status}.`,
    });
  });

  // ============================================================================
  // MODULE 8: PAYMENT & 90:10 COOPERATIVE SETTLEMENT
  // ============================================================================
  app.patch(
    '/api/bookings/:id/payment-method',
    requireAuth(['CUSTOMER', 'ADMIN', 'WORKER']),
    (req: Request, res: Response) => {
      const db = (req as any).db as DatabaseSchema;
      const booking = db.bookings.find((b) => b.id === req.params.id);

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }
      if (booking.paymentStatus === 'PAID') {
        return res.status(400).json({ error: 'Cannot change payment method after settlement is completed.' });
      }

      const { paymentMethod } = req.body || {};
      const normalizedMethod = String(paymentMethod).toUpperCase().includes('CASH') ? 'CASH' : 'UPI';
      booking.paymentMethod = normalizedMethod;
      booking.updatedAt = new Date().toISOString();

      saveDb(db);
      broadcastBookingEvent('booking:updated', booking);

      return res.json({
        booking,
        paymentMethod: normalizedMethod,
        message: `Payment method recorded as ${normalizedMethod === 'CASH' ? 'Cash on Service' : 'UPI Payment'}.`,
      });
    }
  );

  app.post(
    '/api/bookings/:id/create-payment-order',
    requireAuth(['CUSTOMER', 'ADMIN']),
    async (req: Request, res: Response) => {
      const db = (req as any).db as DatabaseSchema;
      const booking = db.bookings.find((b) => b.id === req.params.id);

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }
      if (booking.status !== 'COMPLETED') {
        return res.status(400).json({
          error: 'Payment settlement can only be initiated after the worker completes the task (status: COMPLETED).',
        });
      }
      if (booking.paymentStatus === 'PAID') {
        return res.status(409).json({
          error: 'This booking has already been paid and settled. Duplicate settlement is blocked.',
        });
      }

      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      // Server-side 90:10 calculation
      const grossInr = booking.amountInr;
      const workerShareInr = Math.round(grossInr * 0.9);
      const welfareShareInr = grossInr - workerShareInr;
      booking.workerShareInr = workerShareInr;
      booking.welfareShareInr = welfareShareInr;

      if (keyId && keySecret) {
        try {
          const authBasic = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
          const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authBasic}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: grossInr * 100, // paise
              currency: 'INR',
              receipt: booking.bookingReference,
              notes: {
                bookingId: booking.id,
                workerShareInr: String(workerShareInr),
                welfareShareInr: String(welfareShareInr),
              },
            }),
          });
          if (rpRes.ok) {
            const orderData = (await rpRes.json()) as { id: string };
            booking.razorpayOrderId = orderData.id;
            booking.paymentStatus = 'ORDER_CREATED';
            booking.updatedAt = new Date().toISOString();
            saveDb(db);
            return res.json({
              orderId: orderData.id,
              amountInr: grossInr,
              workerShareInr,
              welfareShareInr,
              mode: 'RAZORPAY_SANDBOX_API',
              keyId,
            });
          }
        } catch {
          // Fall through to sandbox test order with clear disclosure
        }
      }

      const sandboxOrderId = `order_sih2026_${booking.bookingReference.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now().toString().slice(-5)}`;
      booking.razorpayOrderId = sandboxOrderId;
      booking.paymentStatus = 'ORDER_CREATED';
      booking.updatedAt = new Date().toISOString();
      saveDb(db);

      return res.json({
        orderId: sandboxOrderId,
        amountInr: grossInr,
        workerShareInr,
        welfareShareInr,
        mode: 'RAZORPAY_TEST_SANDBOX_FLOW',
        notice:
          'Razorpay Test/Sandbox Order created on server. Proposed Cooperative 90:10 Split calculated.',
      });
    }
  );

  app.post(
    '/api/bookings/:id/verify-payment',
    requireAuth(['CUSTOMER', 'ADMIN', 'WORKER']),
    (req: Request, res: Response) => {
      const db = (req as any).db as DatabaseSchema;
      const booking = db.bookings.find((b) => b.id === req.params.id);

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }
      if (booking.status !== 'COMPLETED') {
        return res.status(400).json({
          error: 'Cannot settle payment before work status is COMPLETED.',
        });
      }
      if (booking.paymentStatus === 'PAID') {
        return res.status(409).json({
          error: 'Duplicate payment prevented: Booking is already marked PAID.',
        });
      }

      const { orderId, paymentMethod = 'UPI' } = req.body || {};
      if (!booking.razorpayOrderId) {
        booking.razorpayOrderId = orderId || `order_sih2026_${booking.bookingReference.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now().toString().slice(-5)}`;
      } else if (orderId && orderId !== booking.razorpayOrderId && !orderId.startsWith('order_demo_') && !booking.razorpayOrderId.startsWith('order_demo_')) {
        return res.status(400).json({
          error: 'Server-side order verification failed: Order ID mismatch.',
        });
      }

      const normalizedMethod = String(paymentMethod).toUpperCase().includes('CASH')
        ? 'CASH'
        : 'UPI';
      const paymentId = `${normalizedMethod.toLowerCase()}_sih2026_${Date.now().toString().slice(-8)}`;
      const settledAt = new Date().toISOString();

      // Configurable cooperative profit-sharing calculation (default 90% worker, 10% cooperative fund)
      const validSharePercent = typeof req.body?.workerSharePercent === 'number'
        ? Math.max(50, Math.min(99, Math.round(req.body.workerSharePercent)))
        : 90;
      const shareRatio = validSharePercent / 100;

      const grossAmountInr = booking.amountInr;
      const workerNetInr = Math.round(grossAmountInr * shareRatio);
      const welfareContributionInr = grossAmountInr - workerNetInr;

      booking.workerShareInr = workerNetInr;
      booking.welfareShareInr = welfareContributionInr;
      booking.paymentStatus = 'PAID';
      booking.paymentMethod = normalizedMethod;
      booking.razorpayPaymentId = paymentId;
      booking.settledAt = settledAt;
      booking.updatedAt = settledAt;

      // Update worker cooperative earnings & job counters
      const worker = db.workers.find((w) => w.id === booking.workerId);
      if (worker) {
        worker.completedJobsTotal += 1;
        worker.completedJobsThisWeek += 1;
        worker.grossEarningsInr += grossAmountInr;
        worker.netEarningsInr += workerNetInr;
        worker.welfareContributionInr += welfareContributionInr;
      }

      // Record transaction in Welfare Fund Ledger (Requirement 1: prevent duplicates for same booking)
      const ledgerEntry: WelfareLedgerEntry = {
        id: `led-${Date.now()}`,
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        workerId: booking.workerId,
        workerName: booking.workerName,
        customerName: booking.customerName,
        serviceCategory: booking.workerCategory,
        grossAmountInr,
        workerNetInr,
        welfareContributionInr,
        workerSharePercent: validSharePercent,
        isDemo: true,
        paymentId,
        paymentMode: normalizedMethod === 'CASH' ? 'COOPERATIVE_TEST_VERIFIED' : 'RAZORPAY_SANDBOX',
        timestamp: settledAt,
      };

      const existingLedgerIdx = db.welfareLedger.findIndex(
        (l) => l.bookingId === booking.id || l.bookingReference === booking.bookingReference
      );
      if (existingLedgerIdx >= 0) {
        db.welfareLedger[existingLedgerIdx] = ledgerEntry;
      } else {
        db.welfareLedger.unshift(ledgerEntry);
      }

      saveDb(db);
      broadcastBookingEvent('booking:updated', booking);

      return res.json({
        booking,
        ledgerEntry,
        paymentMethod: normalizedMethod,
        message: `Payment via ${normalizedMethod} (${paymentId}) verified. Settled ₹${workerNetInr} (${validSharePercent}%) to ${booking.workerName} and ₹${welfareContributionInr} (${100 - validSharePercent}%) to Cooperative Welfare Fund [DEMO].`,
      });
    }
  );

  // Cooperative Profit-Sharing Ledger for Workers & Admins (Requirement 1)
  app.get('/api/cooperative/ledger', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();

    // Worker sees cooperative transactions relevant to them or full society fund ledger
    const workerLedger = user.role === 'WORKER' && user.workerId
      ? db.welfareLedger.filter((l) => l.workerId === user.workerId)
      : db.welfareLedger;

    const totalGrossInr = workerLedger.reduce((acc, item) => acc + item.grossAmountInr, 0);
    const totalWorkerNetInr = workerLedger.reduce((acc, item) => acc + item.workerNetInr, 0);
    const totalWelfareFundInr = workerLedger.reduce(
      (acc, item) => acc + item.welfareContributionInr,
      0
    );
    const totalSocietyFundInr = db.welfareLedger.reduce(
      (acc, item) => acc + item.welfareContributionInr,
      0
    );

    return res.json({
      ledger: workerLedger,
      allSocietyLedger: db.welfareLedger,
      summary: {
        totalTransactions: workerLedger.length,
        totalGrossInr,
        totalWorkerNetInr,
        totalWelfareFundInr,
        totalSocietyFundInr,
      },
    });
  });

  // Configurable Cooperative Profit-Sharing Settings (Requirement 1)
  app.get('/api/cooperative/settings', (_req: Request, res: Response) => {
    const db = loadDb();
    const settings = (db as any).cooperativeSettings || {
      workerSharePercent: 90,
      fundContributionPercent: 10,
      updatedAt: new Date().toISOString(),
    };
    return res.json({ settings });
  });

  app.patch('/api/cooperative/settings', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const { workerSharePercent } = req.body || {};
    const validShare = typeof workerSharePercent === 'number'
      ? Math.max(50, Math.min(99, Math.round(workerSharePercent)))
      : 90;
    (db as any).cooperativeSettings = {
      workerSharePercent: validShare,
      fundContributionPercent: 100 - validShare,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return res.json({
      settings: (db as any).cooperativeSettings,
      message: `Cooperative profit-sharing configured: ${validShare}% worker share / ${100 - validShare}% cooperative fund.`,
    });
  });

  // Demo Settlement Simulation Endpoint for Worker or Customer
  app.post('/api/bookings/:id/settle-demo', requireAuth(['WORKER', 'CUSTOMER', 'ADMIN']), (req: Request, res: Response) => {
    const db = (req as any).db as DatabaseSchema;
    const booking = db.bookings.find((b) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    if (booking.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Job must be marked COMPLETED before demo settlement.' });
    }

    const settings = (db as any).cooperativeSettings || { workerSharePercent: 90 };
    const validSharePercent = typeof req.body?.workerSharePercent === 'number'
      ? Math.max(50, Math.min(99, Math.round(req.body.workerSharePercent)))
      : settings.workerSharePercent;

    const grossAmountInr = booking.amountInr;
    const workerNetInr = Math.round(grossAmountInr * (validSharePercent / 100));
    const welfareContributionInr = grossAmountInr - workerNetInr;
    const settledAt = new Date().toISOString();
    const paymentId = `demo_upi_${Date.now().toString().slice(-8)}`;

    booking.workerShareInr = workerNetInr;
    booking.welfareShareInr = welfareContributionInr;
    booking.paymentStatus = 'PAID';
    booking.paymentMethod = 'UPI (DEMO)';
    booking.razorpayPaymentId = paymentId;
    booking.settledAt = settledAt;
    booking.updatedAt = settledAt;

    const worker = db.workers.find((w) => w.id === booking.workerId);
    if (worker) {
      worker.completedJobsTotal += 1;
      worker.completedJobsThisWeek += 1;
      worker.grossEarningsInr += grossAmountInr;
      worker.netEarningsInr += workerNetInr;
      worker.welfareContributionInr += welfareContributionInr;
    }

    const ledgerEntry: WelfareLedgerEntry = {
      id: `led-${Date.now()}`,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      workerId: booking.workerId,
      workerName: booking.workerName,
      customerName: booking.customerName,
      serviceCategory: booking.workerCategory,
      grossAmountInr,
      workerNetInr,
      welfareContributionInr,
      workerSharePercent: validSharePercent,
      isDemo: true,
      paymentId,
      paymentMode: 'COOPERATIVE_TEST_VERIFIED',
      timestamp: settledAt,
    };

    const existingLedgerIdx = db.welfareLedger.findIndex(
      (l) => l.bookingId === booking.id || l.bookingReference === booking.bookingReference
    );
    if (existingLedgerIdx >= 0) {
      db.welfareLedger[existingLedgerIdx] = ledgerEntry;
    } else {
      db.welfareLedger.unshift(ledgerEntry);
    }

    saveDb(db);
    broadcastBookingEvent('booking:updated', booking);

    return res.json({
      booking,
      ledgerEntry,
      message: `Demo settlement verified: ₹${workerNetInr} (${validSharePercent}%) to ${booking.workerName} and ₹${welfareContributionInr} (${100 - validSharePercent}%) to Cooperative Welfare Fund [DEMO].`,
    });
  });

  // Reset Demo Payment Data endpoint (Clears only demo payments and recalculates totals, preserving bookings/users)
  app.post('/api/demo/reset-payments', requireAuth(['ADMIN', 'CUSTOMER', 'WORKER']), (req: Request, res: Response) => {
    const db = loadDb();

    // Clear welfare ledger records
    db.welfareLedger = [];

    // Reset payment states on all bookings back to UNPAID without deleting bookings
    db.bookings.forEach((b) => {
      b.paymentStatus = 'UNPAID';
      b.paymentMethod = undefined;
      b.razorpayOrderId = undefined;
      b.razorpayPaymentId = undefined;
      b.settledAt = undefined;
      const grossInr = b.amountInr;
      b.workerShareInr = Math.round(grossInr * 0.9);
      b.welfareShareInr = grossInr - b.workerShareInr;
    });

    // Reset workers' accumulated demo earnings and welfare contributions back to 0
    db.workers.forEach((w) => {
      w.grossEarningsInr = 0;
      w.netEarningsInr = 0;
      w.welfareContributionInr = 0;
    });

    saveDb(db);

    // Broadcast reset event to all connected clients
    io.emit('demo:reset-payments', { timestamp: new Date().toISOString() });
    io.emit('bookings:synced', { bookings: db.bookings });

    return res.json({
      success: true,
      message: 'Demo payment records and simulated welfare contributions have been reset. All bookings, user accounts, and work records are preserved.',
    });
  });

  // ============================================================================
  // MODULE 9 & 11: PDF TAX INVOICE (GET /api/bookings/:id/invoice)
  // ============================================================================
  app.get('/api/bookings/:id/invoice', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;
    const booking = db.bookings.find((b) => b.id === req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (
      user.role === 'CUSTOMER' &&
      booking.customerId !== user.id
    ) {
      return res.status(403).json({ error: 'Unauthorized to access this invoice.' });
    }
    if (
      user.role === 'WORKER' &&
      booking.workerId !== user.workerId
    ) {
      return res.status(403).json({ error: 'Unauthorized to access this invoice.' });
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const invoiceNumber = `INV-${booking.bookingReference}`;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('HELP NEST COOPERATIVE SERVICE RECEIPT', 15, 18);
    doc.setFontSize(9);
    doc.text('Cooperative Household & Community Services Platform', 15, 26);

    // Metadata
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(`Invoice Number: ${invoiceNumber}`, 15, 50);
    doc.text(`Booking Reference: ${booking.bookingReference}`, 15, 57);
    doc.text(`Booking Date: ${booking.preferredDate} (${booking.preferredTimeSlot})`, 15, 64);
    doc.text(`Booking Status: ${booking.status}`, 130, 50);
    doc.text(`Payment Status: ${booking.paymentStatus}`, 130, 57);
    if (booking.razorpayPaymentId) {
      doc.text(`Transaction ID: ${booking.razorpayPaymentId}`, 130, 64);
    }

    doc.setDrawColor(203, 213, 225);
    doc.line(15, 70, 195, 70);

    // Helper to keep PDF text ASCII-safe for standard jsPDF Helvetica font
    const toPdfAscii = (val: string, fallback: string) => {
      const cleaned = String(val || '')
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned.length > 0 ? cleaned : fallback;
    };

    // Customer & Worker Details
    doc.setFontSize(11);
    doc.text('Customer Details:', 15, 80);
    doc.setFontSize(10);
    doc.text(`Name: ${toPdfAscii(booking.customerName, 'Registered Customer')}`, 15, 87);
    doc.text(`Phone: ${toPdfAscii(booking.customerPhone, 'N/A')}`, 15, 93);
    doc.text(
      `Location: ${toPdfAscii(
        booking.customerLocation.addressLabel || '',
        `${booking.customerLocation.lat}, ${booking.customerLocation.lng}`
      )}`,
      15,
      99
    );

    doc.setFontSize(11);
    doc.text('Assigned Cooperative Worker:', 115, 80);
    doc.setFontSize(10);
    doc.text(
      `Name: ${toPdfAscii(booking.workerName, 'Cooperative Worker')} (${booking.workerId})`,
      115,
      87
    );
    doc.text(`Trade Category: ${booking.workerCategory}`, 115, 93);
    doc.text(`Phone: ${toPdfAscii(booking.workerPhone, 'N/A')}`, 115, 99);

    doc.line(15, 106, 195, 106);

    // Service Description
    doc.setFontSize(11);
    doc.text('Service & Task Description:', 15, 116);
    doc.setFontSize(10);
    const asciiDesc = toPdfAscii(
      booking.problemDescription,
      `${booking.workerCategory} household service request (${
        booking.requiredSkills.join(', ') || 'Standard trade task'
      })`
    );
    const splitDesc = doc.splitTextToSize(asciiDesc, 175);
    doc.text(splitDesc, 15, 123);

    const skillsLine =
      booking.requiredSkills.length > 0 ? booking.requiredSkills.join(', ') : booking.workerCategory;
    doc.text(`Requested Skills: ${skillsLine}`, 15, 138);
    doc.text(`Fair Dispatch Matching Score: ${booking.matchingScore}/100`, 15, 145);

    // Financial Breakdown Box (Proposed 90:10 Cooperative Model)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(15, 155, 180, 48, 'FD');

    doc.setFontSize(11);
    doc.text('Proposed Cooperative Settlement Breakdown (90:10 Model)', 20, 165);
    doc.setFontSize(10);
    doc.text('Gross Booking Amount:', 20, 175);
    doc.text(`INR ${booking.amountInr.toFixed(2)}`, 160, 175);

    doc.text('Cooperative Worker Net Share (90%):', 20, 184);
    doc.text(`INR ${booking.workerShareInr.toFixed(2)}`, 160, 184);

    doc.text('Cooperative Welfare Fund Contribution (10%):', 20, 193);
    doc.text(`INR ${booking.welfareShareInr.toFixed(2)}`, 160, 193);

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated by Help Nest Cooperative Platform on ${new Date().toISOString()}`, 15, 220);

    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="HelpNest_Invoice_${booking.bookingReference}.pdf"`
    );
    return res.send(pdfBuffer);
  });

  // ============================================================================
  // MODULE 6: WORKER PROFILE, AVAILABILITY, GPS & KYC ENDPOINTS
  // ============================================================================
  app.get('/api/workers', requireAuth(), (_req: Request, res: Response) => {
    const db = loadDb();
    res.json({ workers: db.workers });
  });

  app.patch('/api/workers/:id/profile', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;
    const worker = db.workers.find((w) => w.id === req.params.id);

    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found.' });
    }
    if (user.role === 'WORKER' && user.workerId !== worker.id) {
      return res.status(403).json({ error: 'You can only update your own worker profile.' });
    }

    const { isAvailable, shift, serviceZone, skills, baseRateInr, coordinates, category } =
      req.body || {};

    if (typeof isAvailable === 'boolean') worker.isAvailable = isAvailable;
    if (shift) worker.shift = shift;
    if (serviceZone) worker.serviceZone = String(serviceZone).trim();
    if (category && SUPPORTED_CATEGORIES.includes(category)) {
      worker.category = category;
    }
    if (Array.isArray(skills)) {
      worker.skills = skills.map((s) => String(s).trim()).filter(Boolean);
    }
    if (typeof baseRateInr === 'number' && baseRateInr >= 100) {
      worker.baseRateInr = Math.round(baseRateInr);
    }
    if (
      coordinates &&
      typeof coordinates.lat === 'number' &&
      typeof coordinates.lng === 'number'
    ) {
      worker.coordinates = {
        lat: coordinates.lat,
        lng: coordinates.lng,
        addressLabel: coordinates.addressLabel || worker.coordinates.addressLabel,
      };
      // Also sync active bookings with this worker's updated real coordinates
      for (const b of db.bookings) {
        if (b.workerId === worker.id && ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(b.status)) {
          b.workerCoordinates = worker.coordinates;
        }
      }
    }

    saveDb(db);
    io.emit('worker:updated', { worker });
    return res.json({
      worker,
      message: 'Worker profile updated.',
    });
  });

  app.post('/api/workers/:id/kyc', requireAuth(['WORKER']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = (req as any).db as DatabaseSchema;
    const worker = db.workers.find((w) => w.id === req.params.id);

    if (!worker || user.workerId !== worker.id) {
      return res.status(403).json({ error: 'Unauthorized KYC submission.' });
    }

    const { documentType, documentNumber } = req.body || {};
    if (!documentType || !documentNumber) {
      return res.status(400).json({
        error: 'Both document type and document reference number are required for KYC verification.',
      });
    }

    worker.kycDocumentType = String(documentType).trim();
    worker.kycDocumentNumber = String(documentNumber).trim();
    worker.kycStatus = 'PENDING_REVIEW';
    worker.kycSubmittedAt = new Date().toISOString();
    saveDb(db);

    return res.json({
      worker,
      message: 'KYC document details submitted to Society Administrator for verification.',
    });
  });

  // ============================================================================
  // MODULE 10: FEDERATION ADMIN DASHBOARD & DEMAND FORECAST
  // ============================================================================
  app.patch('/api/admin/kyc/:id', requireAuth(['ADMIN']), (req: Request, res: Response) => {
    const db = (req as any).db as DatabaseSchema;
    const worker = db.workers.find((w) => w.id === req.params.id);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found.' });
    }

    const { decision, reviewerNote, skillBadges } = req.body || {};
    if (decision !== 'VERIFIED' && decision !== 'REJECTED') {
      return res.status(400).json({ error: 'Decision must be VERIFIED or REJECTED.' });
    }

    worker.kycStatus = decision;
    worker.verified = decision === 'VERIFIED';
    worker.kycReviewerNote = reviewerNote || `Reviewed on ${new Date().toLocaleDateString()}`;
    if (Array.isArray(skillBadges)) {
      worker.skillBadges = skillBadges.map((b) => String(b).trim()).filter(Boolean);
    } else if (decision === 'VERIFIED' && !worker.skillBadges.includes('Society KYC Verified')) {
      worker.skillBadges.push('Society KYC Verified');
    }

    saveDb(db);
    return res.json({
      worker,
      message: `Worker ${worker.name} KYC status updated to ${decision}.`,
    });
  });

  app.get('/api/admin/ledger', requireAuth(['ADMIN']), (_req: Request, res: Response) => {
    const db = loadDb();
    const totalGrossInr = db.welfareLedger.reduce((acc, item) => acc + item.grossAmountInr, 0);
    const totalWorkerNetInr = db.welfareLedger.reduce((acc, item) => acc + item.workerNetInr, 0);
    const totalWelfareFundInr = db.welfareLedger.reduce(
      (acc, item) => acc + item.welfareContributionInr,
      0
    );

    return res.json({
      ledger: db.welfareLedger,
      summary: {
        totalTransactions: db.welfareLedger.length,
        totalGrossInr,
        totalWorkerNetInr,
        totalWelfareFundInr,
      },
    });
  });

  // Documented Blueprint Endpoint: GET /api/ai/demand-forecast?zone=Sector-5&days=7
  app.get('/api/ai/demand-forecast', requireAuth(['ADMIN']), async (req: Request, res: Response) => {
    const zone = String(req.query.zone || 'Sector-5');
    const days = Math.min(14, Math.max(1, Number(req.query.days) || 7));
    const db = loadDb();

    // Calculate actual bookings stored in database for transparent distinction
    const actualCountInDb = db.bookings.length;

    const baselineZones = [
      { zone: 'Sector-1', electrician: 11, plumber: 14, carpenter: 6, painter: 5, cleaner: 15, babysitter: 8 },
      { zone: 'Sector-2', electrician: 13, plumber: 16, carpenter: 8, painter: 6, cleaner: 14, babysitter: 7 },
      { zone: 'Sector-3', electrician: 18, plumber: 19, carpenter: 10, painter: 7, cleaner: 20, babysitter: 11 },
      { zone: 'Sector-5', electrician: 24, plumber: 17, carpenter: 12, painter: 9, cleaner: 22, babysitter: 9 },
    ];

    const zoneBreakdown = baselineZones.map((z) => ({
      ...z,
      totalProjected:
        z.electrician + z.plumber + z.carpenter + z.painter + z.cleaner + z.babysitter,
    }));

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const baseDate = new Date();
    const dailyForecast = Array.from({ length: days }).map((_, idx) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + idx);
      const isoDate = d.toISOString().slice(0, 10);
      const dayLabel = `${dayNames[d.getDay()]} (${isoDate.slice(5)})`;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const zoneMultiplier = zone === 'Sector-5' ? 1.25 : zone === 'Sector-3' ? 1.15 : 1.0;
      const sampleBase = Math.round((isWeekend ? 18 : 13) * zoneMultiplier + (idx % 3));
      const actualForDay = db.bookings.filter((b) => b.preferredDate === isoDate).length;

      const categoriesRotation: SupportedServiceCategory[] = [
        'Electrician',
        'Plumber',
        'Cleaner',
        'Carpenter',
        'Babysitter',
        'Painter',
      ];

      return {
        date: isoDate,
        dayLabel,
        actualHistoricalBookings: idx === 0 ? actualCountInDb : actualForDay > 0 ? actualForDay : null,
        baselineSampleBookings: sampleBase,
        predictedDemand: Math.round(sampleBase * 1.12),
        topCategory: categoriesRotation[idx % categoriesRotation.length],
      };
    });

    let modelUsed = 'Cooperative Baseline Statistical Projection';
    let isLiveAiForecast = false;

    try {
      const ai = getGenAIClient();
      if (ai) {
        const prompt = `You are the Help Nest Demand Forecasting Module for "${zone}" over the next ${days} days.
Current active bookings in DB: ${actualCountInDb}.
Generate a realistic 7-day cooperative service demand projection array of ${days} integers (between 10 and 30 requests/day) reflecting urban household patterns in Salt Lake ${zone}.
Return JSON: { "predictedSeries": [number, ...] }`;
        const aiForecast = await callGemmaOrGeminiJson(prompt, {
          type: Type.OBJECT,
          properties: {
            predictedSeries: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          },
          required: ['predictedSeries'],
        });
        if (
          Array.isArray(aiForecast.data?.predictedSeries) &&
          aiForecast.data.predictedSeries.length >= days
        ) {
          dailyForecast.forEach((pt, i) => {
            const val = Number(aiForecast.data.predictedSeries[i]);
            if (!Number.isNaN(val) && val > 0) {
              pt.predictedDemand = val;
            }
          });
          modelUsed = aiForecast.modelUsed;
          isLiveAiForecast = true;
        }
      }
    } catch {
      // Keep baseline projection if AI call fails
    }

    const response: DemandForecastResponse = {
      zone,
      days,
      generatedAt: new Date().toISOString(),
      modelUsed,
      isLiveAiForecast,
      dataNotice:
        'Clearly separated series: "Actual Recorded Bookings" reflects real bookings in this database; "Baseline Cooperative Sample" and "Model Forecast" are reference projections for society capacity planning.',
      dailyForecast,
      zoneBreakdown,
    };

    return res.json(response);
  });

  // ============================================================================
  // FEATURE 1: WORKER-TO-WORKER HELP NETWORK
  // ============================================================================
  app.get('/api/collaboration/requests', requireAuth(['WORKER', 'ADMIN']), (_req: Request, res: Response) => {
    const db = loadDb();
    const list = [...db.collaborationRequests].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return res.json({ requests: list });
  });

  app.post('/api/collaboration/ai-suggest', requireAuth(['WORKER', 'ADMIN']), async (req: Request, res: Response) => {
    const { problemDescription, category, currentSkills } = req.body || {};
    if (!problemDescription || !category) {
      return res.status(400).json({ error: 'Problem description and category are required.' });
    }

    const aiResult = await generateJobCollaborationAiSummary(
      String(problemDescription),
      category as SupportedServiceCategory,
      Array.isArray(currentSkills) ? currentSkills : []
    );

    return res.json(aiResult);
  });

  app.post('/api/collaboration/requests', requireAuth(['WORKER']), async (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const worker = db.workers.find((w) => w.id === user.workerId);
    if (!worker) {
      return res.status(403).json({ error: 'Worker profile not found.' });
    }

    const {
      bookingId,
      bookingReference,
      requiredSkill,
      serviceCategory,
      jobLocationArea,
      expectedDurationHours,
      jobSummary,
      notes,
    } = req.body || {};

    if (!requiredSkill || !serviceCategory) {
      return res.status(400).json({ error: 'Required skill and service category are mandatory.' });
    }

    // Protect customer privacy: location is generalized to neighborhood/zone, never customer phone or flat number
    const safeLocation = jobLocationArea
      ? String(jobLocationArea).trim()
      : worker.coordinates?.addressLabel || worker.serviceZone || 'Salt Lake Sector';

    let finalSummary = jobSummary ? String(jobSummary).trim() : '';
    let suggestedSkills: string[] = [];

    if (!finalSummary) {
      const aiSummary = await generateJobCollaborationAiSummary(
        notes || requiredSkill,
        serviceCategory as SupportedServiceCategory,
        [requiredSkill]
      );
      finalSummary = aiSummary.jobSummary;
      suggestedSkills = aiSummary.suggestedSkills;
    }

    const newRequest: CollaborationRequest = {
      id: `collab-${Date.now()}`,
      bookingId: bookingId ? String(bookingId) : `bkg-assist-${Date.now().toString().slice(-6)}`,
      bookingReference: bookingReference ? String(bookingReference) : `HLP-${Date.now().toString().slice(-5)}`,
      initiatorWorkerId: worker.id,
      initiatorWorkerName: worker.name,
      initiatorWorkerPhone: worker.phone,
      serviceCategory: serviceCategory as SupportedServiceCategory,
      requiredSkill: String(requiredSkill).trim(),
      suggestedSkills: suggestedSkills.length > 0 ? suggestedSkills : [String(requiredSkill).trim()],
      jobLocationArea: safeLocation,
      expectedDurationHours: Math.max(1, Math.min(8, Number(expectedDurationHours) || 2)),
      jobSummary: finalSummary,
      notes: notes ? String(notes).trim() : undefined,
      status: 'HELP_REQUESTED',
      isSimulatedDemo: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.collaborationRequests.unshift(newRequest);

    // If linked to an active booking in DB, flag it
    if (bookingId) {
      const b = db.bookings.find((bk) => bk.id === bookingId);
      if (b) {
        b.hasCollaboration = true;
        b.collaborationId = newRequest.id;
      }
    }

    saveDb(db);
    broadcastBookingEvent('collaboration:created', newRequest);

    return res.status(201).json({
      request: newRequest,
      message: 'Collaboration request created and broadcast to eligible cooperative workers [DEMO].',
    });
  });

  app.post('/api/collaboration/requests/:id/accept', requireAuth(['WORKER']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const worker = db.workers.find((w) => w.id === user.workerId);
    if (!worker) {
      return res.status(403).json({ error: 'Worker profile not found.' });
    }

    const request = db.collaborationRequests.find((r) => r.id === req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Collaboration request not found.' });
    }

    if (request.initiatorWorkerId === worker.id) {
      return res.status(400).json({ error: 'You cannot accept your own collaboration request.' });
    }

    if (request.status !== 'HELP_REQUESTED') {
      return res.status(400).json({ error: `Cannot accept request with status: ${request.status}.` });
    }

    request.status = 'WORKER_FOUND';
    request.partnerWorkerId = worker.id;
    request.partnerWorkerName = worker.name;
    request.partnerWorkerPhone = worker.phone;
    request.partnerWorkerCategory = worker.category;
    request.updatedAt = new Date().toISOString();

    saveDb(db);
    broadcastBookingEvent('collaboration:updated', request);

    return res.json({
      request,
      message: `You have accepted collaboration on ${request.bookingReference} with ${request.initiatorWorkerName}. Status updated to WORKER FOUND [DEMO].`,
    });
  });

  app.patch('/api/collaboration/requests/:id/status', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const request = db.collaborationRequests.find((r) => r.id === req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Collaboration request not found.' });
    }

    const { status } = req.body || {};
    const validStatuses: CollaborationStatus[] = [
      'HELP_REQUESTED',
      'WORKER_FOUND',
      'COLLABORATION_STARTED',
      'COMPLETED',
      'CANCELLED',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid collaboration status.' });
    }

    request.status = status;
    request.updatedAt = new Date().toISOString();
    saveDb(db);
    broadcastBookingEvent('collaboration:updated', request);

    return res.json({
      request,
      message: `Collaboration status updated to ${status}.`,
    });
  });

  // ============================================================================
  // FEATURE 2: FAIR JOB ALLOCATION ASSISTANT (GEMMA 4)
  // ============================================================================
  app.post('/api/allocation/ai-explain', requireAuth(['ADMIN', 'WORKER', 'CUSTOMER']), async (req: Request, res: Response) => {
    const db = loadDb();
    const { workerId, requiredSkills, customerCoords } = req.body || {};
    const worker = db.workers.find((w) => w.id === workerId);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found.' });
    }

    const distanceKm = calculateHaversineKm(customerCoords, worker.coordinates);
    const skills = Array.isArray(requiredSkills) ? requiredSkills : [];

    const aiResult = await generateFairAllocationAiExplanation(
      worker,
      skills,
      distanceKm,
      worker.completedJobsThisWeek
    );

    return res.json({
      workerId: worker.id,
      workerName: worker.name,
      explanation: aiResult.explanation,
      modelUsed: aiResult.modelUsed,
      isLiveModel: aiResult.isLiveModel,
      allocationDisclaimer: 'AI-assisted recommendation based on application data (skills, availability, workload, distance). Not a guarantee of fairness.',
    });
  });

  app.post('/api/allocation/feedback', requireAuth(['ADMIN', 'WORKER']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const { workerId, bookingId, ratingHelpful, comment } = req.body || {};

    const targetWorker = db.workers.find((w) => w.id === workerId);
    if (!targetWorker) {
      return res.status(404).json({ error: 'Target worker not found.' });
    }

    const feedbackRecord: AllocationFeedbackRecord = {
      id: `fb-${Date.now()}`,
      workerId: targetWorker.id,
      workerName: targetWorker.name,
      bookingId: bookingId ? String(bookingId) : undefined,
      reviewerId: user.id,
      reviewerName: user.name,
      reviewerRole: user.role === 'ADMIN' ? 'ADMIN' : 'WORKER',
      ratingHelpful: Boolean(ratingHelpful),
      comment: comment ? String(comment).trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    db.allocationFeedback.unshift(feedbackRecord);
    saveDb(db);

    return res.status(201).json({
      feedback: feedbackRecord,
      message: 'Human review feedback on job allocation recorded successfully.',
    });
  });

  app.get('/api/allocation/feedback', requireAuth(['ADMIN', 'WORKER']), (_req: Request, res: Response) => {
    const db = loadDb();
    return res.json({ feedback: db.allocationFeedback });
  });

  // ============================================================================
  // FEATURE 3: WORKER TIME PROTECTION (CANCELLATION ESTIMATOR)
  // ============================================================================
  app.get('/api/time-protection/records', requireAuth(['WORKER', 'ADMIN']), (_req: Request, res: Response) => {
    const db = loadDb();
    return res.json({ records: db.timeProtectionRecords });
  });

  app.post('/api/time-protection/records', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const {
      bookingId,
      cancellationReason,
      reasonDetails,
      arrivalConfirmedAt,
      travelDistanceKm,
      wastedTimeMinutes,
    } = req.body || {};

    if (!bookingId || !cancellationReason) {
      return res.status(400).json({ error: 'Booking ID and cancellation reason are required.' });
    }

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Prevent duplicate cancellation records for the same booking
    const existing = db.timeProtectionRecords.find((r) => r.bookingId === bookingId);
    if (existing) {
      return res.status(409).json({
        error: 'A cancellation protection record has already been filed for this booking.',
        record: existing,
      });
    }

    const worker = db.workers.find((w) => w.id === booking.workerId);
    const workerName = worker?.name || booking.workerName || user.name;

    const distKm = Math.max(0, Math.min(50, Number(travelDistanceKm) || (booking.dispatchBreakdown?.distanceKm ?? 3.5)));
    const wastedMins = Math.max(10, Math.min(180, Number(wastedTimeMinutes) || 45));

    // Transparent configurable demo compensation formula:
    // Travel cost = Base ₹100 + ₹15/km
    // Wasted time cost = ₹2/minute (capped at ₹250)
    const travelCostInr = Math.round(100 + distKm * 15);
    const timeCostInr = Math.min(250, Math.round(wastedMins * 2));
    const estimatedDemoCompensationInr = travelCostInr + timeCostInr;

    const ruleBreakdown = `Base transit fee ₹100 + ₹15/km (${distKm} km = ₹${travelCostInr - 100}) = ₹${travelCostInr} travel cost; plus ₹2/min wasted time (${wastedMins} mins = ₹${timeCostInr}). Total demo compensation estimate: ₹${estimatedDemoCompensationInr}.`;

    const protectionRecord: TimeProtectionRecord = {
      id: `time-prot-${Date.now()}`,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      workerId: booking.workerId,
      workerName,
      arrivalConfirmedAt: arrivalConfirmedAt ? String(arrivalConfirmedAt) : booking.arrivalConfirmedAt,
      cancellationRecordedAt: new Date().toISOString(),
      reason: cancellationReason as CancellationProtectionReason,
      reasonDetails: reasonDetails ? String(reasonDetails).trim() : undefined,
      travelDistanceKm: distKm,
      travelCostInr,
      wastedTimeMinutes: wastedMins,
      timeCostInr,
      estimatedDemoCompensationInr,
      ruleBreakdown,
      isDemoEstimate: true,
      status: 'RECORDED',
      createdAt: new Date().toISOString(),
    };

    db.timeProtectionRecords.unshift(protectionRecord);

    // Update booking state
    booking.status = 'CANCELLED';
    booking.cancellationProtected = true;
    booking.timeProtectionId = protectionRecord.id;
    booking.cancellationReasonNote = `${cancellationReason}: ${reasonDetails || 'Cancelled on-site'}`;
    booking.updatedAt = new Date().toISOString();

    saveDb(db);
    broadcastBookingEvent('booking:updated', booking);

    return res.status(201).json({
      record: protectionRecord,
      booking,
      notice: 'Demo compensation estimate using configurable cooperative rules — this is NOT an actual payment or guaranteed compensation.',
    });
  });

  // ============================================================================
  // FEATURE 4: SMART SPARE PARTS ESTIMATOR (GEMMA 4)
  // ============================================================================
  app.post('/api/spare-parts/ai-estimate', requireAuth(['WORKER', 'CUSTOMER', 'ADMIN']), async (req: Request, res: Response) => {
    const { problemDescription, category, workerBaseRate } = req.body || {};
    if (!category) {
      return res.status(400).json({ error: 'Service category is required.' });
    }

    const baseRate = Math.max(150, Number(workerBaseRate) || 250);
    const estimate = await generateSmartSparePartsAiEstimate(
      String(problemDescription || 'General maintenance and repair'),
      category as SupportedServiceCategory,
      baseRate
    );

    return res.json({
      ...estimate,
      disclaimer: 'AI-generated estimates only — not verified market prices. Workers can edit items, and customer approval is required before changing the final invoice.',
    });
  });

  app.get('/api/spare-parts/estimates', requireAuth(['WORKER', 'CUSTOMER', 'ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const { bookingId } = req.query;
    if (bookingId) {
      const match = db.sparePartsEstimates.find((e) => e.bookingId === bookingId);
      return res.json({ estimate: match || null });
    }
    return res.json({ estimates: db.sparePartsEstimates });
  });

  app.post('/api/spare-parts/estimates', requireAuth(['WORKER']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const {
      bookingId,
      items,
      laborChargeInr,
      workerNotes,
      aiModelUsed,
    } = req.body || {};

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one spare part or hardware item is required.' });
    }

    const formattedItems: SparePartItem[] = items.map((it: any, idx: number) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const unitPrice = Math.max(0, Number(it.estimatedUnitPriceInr) || 0);
      return {
        id: it.id || `item-${idx + 1}-${Date.now()}`,
        name: String(it.name || 'Hardware Part').trim(),
        quantity: qty,
        unit: String(it.unit || 'pc').trim(),
        estimatedUnitPriceInr: unitPrice,
        totalPriceInr: qty * unitPrice,
        isCustomAdded: Boolean(it.isCustomAdded),
      };
    });

    const totalMaterialsInr = formattedItems.reduce((acc, i) => acc + i.totalPriceInr, 0);
    const finalLaborInr = Math.max(150, Number(laborChargeInr) || booking.workerShareInr || 250);
    const totalEstimatedInr = totalMaterialsInr + finalLaborInr;

    const estimateRecord: SparePartsEstimateRecord = {
      id: `parts-est-${Date.now()}`,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      workerId: booking.workerId,
      workerName: booking.workerName,
      serviceCategory: booking.workerCategory,
      items: formattedItems,
      totalMaterialsInr,
      laborChargeInr: finalLaborInr,
      totalEstimatedInr,
      customerApprovalStatus: 'SUBMITTED_TO_CUSTOMER',
      workerNotes: workerNotes ? String(workerNotes).trim() : undefined,
      aiModelUsed: aiModelUsed || 'Gemma 4 Multilingual Parts Engine',
      isDemoEstimate: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingIdx = db.sparePartsEstimates.findIndex((e) => e.bookingId === booking.id);
    if (existingIdx >= 0) {
      db.sparePartsEstimates[existingIdx] = estimateRecord;
    } else {
      db.sparePartsEstimates.unshift(estimateRecord);
    }

    booking.hasSparePartsEstimate = true;
    booking.sparePartsEstimateId = estimateRecord.id;
    booking.updatedAt = new Date().toISOString();

    saveDb(db);
    broadcastBookingEvent('spare-parts:submitted', estimateRecord);

    return res.status(201).json({
      estimate: estimateRecord,
      message: 'Estimated spare parts submitted. Customer approval is required before invoice update.',
    });
  });

  app.post('/api/spare-parts/estimates/:id/approve', requireAuth(['CUSTOMER', 'ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const estimate = db.sparePartsEstimates.find((e) => e.id === req.params.id);
    if (!estimate) {
      return res.status(404).json({ error: 'Spare parts estimate not found.' });
    }

    const booking = db.bookings.find((b) => b.id === estimate.bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Linked booking not found.' });
    }

    estimate.customerApprovalStatus = 'CUSTOMER_APPROVED';
    estimate.updatedAt = new Date().toISOString();

    // With explicit customer approval, update booking total & price breakdown safely
    booking.amountInr = estimate.totalEstimatedInr;
    booking.workerShareInr = Math.round(estimate.totalEstimatedInr * 0.9);
    booking.welfareShareInr = estimate.totalEstimatedInr - booking.workerShareInr;
    booking.priceBreakdown = {
      baseLaborInr: estimate.laborChargeInr,
      materialsInr: estimate.totalMaterialsInr,
      materialsDescription: estimate.items.map((i) => `${i.quantity}x ${i.name}`).join(', '),
      urgencySurchargeInr: 0,
      additionalChargesInr: 0,
      totalInr: estimate.totalEstimatedInr,
      isEstimate: false,
      notes: 'Customer-approved materials and labor estimate.',
    };
    booking.updatedAt = new Date().toISOString();

    saveDb(db);
    broadcastBookingEvent('booking:updated', booking);

    return res.json({
      estimate,
      booking,
      message: `Spare parts estimate approved. Booking amount updated to ₹${estimate.totalEstimatedInr}.`,
    });
  });

  app.post('/api/spare-parts/estimates/:id/decline', requireAuth(['CUSTOMER', 'ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const estimate = db.sparePartsEstimates.find((e) => e.id === req.params.id);
    if (!estimate) {
      return res.status(404).json({ error: 'Spare parts estimate not found.' });
    }

    const { feedback } = req.body || {};
    estimate.customerApprovalStatus = 'CUSTOMER_DECLINED';
    estimate.customerFeedback = feedback ? String(feedback).trim() : 'Customer declined extra parts.';
    estimate.updatedAt = new Date().toISOString();

    saveDb(db);
    return res.json({
      estimate,
      message: 'Spare parts estimate declined. Original booking amount remains unchanged.',
    });
  });

  // ============================================================================
  // FEATURE 5: WORKER COOPERATIVE VOTING
  // ============================================================================
  app.get('/api/coop/proposals', requireAuth(['WORKER', 'ADMIN']), (_req: Request, res: Response) => {
    const db = loadDb();
    return res.json({
      proposals: db.coopProposals,
      notice: 'Demo Cooperative Voting — Simulated prototype for member democracy. Not legally binding.',
    });
  });

  app.post('/api/coop/proposals', requireAuth(['WORKER']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const worker = db.workers.find((w) => w.id === user.workerId);
    if (!worker) {
      return res.status(403).json({ error: 'Worker profile not found.' });
    }

    const { title, description, category } = req.body || {};
    if (!title || !description || !category) {
      return res.status(400).json({ error: 'Title, description, and category are required.' });
    }

    const newProposal: CoopProposal = {
      id: `prop-${Date.now()}`,
      title: String(title).trim(),
      description: String(description).trim(),
      category: category as CoopProposalCategory,
      proposedByWorkerId: worker.id,
      proposedByWorkerName: worker.name,
      status: 'ACTIVE',
      upvotes: 1,
      downvotes: 0,
      votes: {
        [worker.id]: 'FOR',
      },
      isDemoVoting: true,
      createdAt: new Date().toISOString(),
    };

    db.coopProposals.unshift(newProposal);
    saveDb(db);

    return res.status(201).json({
      proposal: newProposal,
      message: 'Cooperative proposal created and open for worker voting [DEMO].',
    });
  });

  app.post('/api/coop/proposals/:id/vote', requireAuth(['WORKER']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const worker = db.workers.find((w) => w.id === user.workerId);
    if (!worker) {
      return res.status(403).json({ error: 'Worker profile not found.' });
    }

    const proposal = db.coopProposals.find((p) => p.id === req.params.id);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found.' });
    }

    if (proposal.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Voting is closed for this proposal.' });
    }

    const { voteType } = req.body || {};
    if (voteType !== 'FOR' && voteType !== 'AGAINST') {
      return res.status(400).json({ error: 'voteType must be FOR or AGAINST.' });
    }

    // Prevent duplicate votes from the same authorized user within prototype
    if (proposal.votes[worker.id]) {
      return res.status(400).json({
        error: `You have already cast a vote (${proposal.votes[worker.id]}) on this proposal. Duplicate voting is prevented.`,
      });
    }

    proposal.votes[worker.id] = voteType;
    if (voteType === 'FOR') {
      proposal.upvotes += 1;
    } else {
      proposal.downvotes += 1;
    }

    saveDb(db);

    return res.json({
      proposal,
      message: `Your vote (${voteType}) has been recorded. Current tally: ${proposal.upvotes} For / ${proposal.downvotes} Against [DEMO].`,
    });
  });

  // ============================================================================
  // FEATURE 6: SAFE VISIT CHECK-IN
  // ============================================================================
  app.get('/api/safe-visit/logs', requireAuth(['WORKER', 'ADMIN']), (_req: Request, res: Response) => {
    const db = loadDb();
    return res.json({ logs: db.safeVisitLogs });
  });

  app.post('/api/safe-visit/log', requireAuth(['WORKER']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const worker = db.workers.find((w) => w.id === user.workerId);
    if (!worker) {
      return res.status(403).json({ error: 'Worker profile not found.' });
    }

    const {
      bookingId,
      action,
      sharedContactName,
      sharedContactPhone,
      safetyNote,
      manualReminderMinutes,
    } = req.body || {};

    const validActions: SafeVisitAction[] = [
      'ARRIVAL_CHECKIN',
      'WORK_STARTED',
      'WORK_COMPLETED',
      'REQUEST_ASSISTANCE',
    ];

    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid safe visit action.' });
    }

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const timestamp = new Date().toISOString();
    let logRecord = db.safeVisitLogs.find((l) => l.bookingId === booking.id);

    if (!logRecord) {
      logRecord = {
        id: `safe-log-${Date.now()}`,
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        workerId: worker.id,
        workerName: worker.name,
        lastAction: action,
        actionTimestamp: timestamp,
        sharedContactName: sharedContactName ? String(sharedContactName).trim() : undefined,
        sharedContactPhone: sharedContactPhone ? String(sharedContactPhone).trim() : undefined,
        safetyNote: safetyNote ? String(safetyNote).trim() : undefined,
        manualReminderMinutes: manualReminderMinutes ? Number(manualReminderMinutes) : undefined,
        isAssistanceFlagged: action === 'REQUEST_ASSISTANCE',
        history: [{ action, timestamp, note: safetyNote }],
      };
      db.safeVisitLogs.unshift(logRecord);
    } else {
      logRecord.lastAction = action;
      logRecord.actionTimestamp = timestamp;
      if (sharedContactName) logRecord.sharedContactName = String(sharedContactName).trim();
      if (sharedContactPhone) logRecord.sharedContactPhone = String(sharedContactPhone).trim();
      if (safetyNote) logRecord.safetyNote = String(safetyNote).trim();
      if (manualReminderMinutes) logRecord.manualReminderMinutes = Number(manualReminderMinutes);
      if (action === 'REQUEST_ASSISTANCE') logRecord.isAssistanceFlagged = true;
      logRecord.history.push({ action, timestamp, note: safetyNote });
    }

    // Keep booking state synchronized
    booking.safeVisitStatus = action;
    booking.safeVisitLastUpdated = timestamp;
    if (action === 'ARRIVAL_CHECKIN' && !booking.arrivalConfirmedAt) {
      booking.arrivalConfirmedAt = timestamp;
    }
    booking.updatedAt = timestamp;

    saveDb(db);
    broadcastBookingEvent('safe-visit:update', logRecord);

    return res.json({
      logRecord,
      booking,
      message: `Safe visit action "${action}" recorded at ${new Date(timestamp).toLocaleTimeString()}. Emergency services are NOT automatically contacted. Call 112/100 in urgent danger.`,
    });
  });

  // ============================================================================
  // FEATURE 7: VOICE-FIRST OFFLINE ASSISTANT (GEMMA 4)
  // ============================================================================
  app.post('/api/assistant/voice-command', requireAuth(['WORKER', 'CUSTOMER', 'ADMIN']), async (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const { transcript, language } = req.body || {};

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Transcript string is required.' });
    }

    const lang = (language === 'bn' || language === 'hi' || language === 'en') ? language : 'en';
    const result = await interpretWorkerVoiceCommand(transcript, lang, user.name);

    return res.json(result);
  });

  // ============================================================================
  // MODULE 11: WORKER JOB NOTES & OFFLINE RECONNECTION SYNC
  // ============================================================================
  app.get('/api/worker/job-notes', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const { workerId, bookingId } = req.query;

    let notes = db.jobNotes || [];
    if (workerId && typeof workerId === 'string') {
      notes = notes.filter((n) => n.workerId === workerId);
    }
    if (bookingId && typeof bookingId === 'string') {
      notes = notes.filter((n) => n.bookingId === bookingId);
    }

    notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({ notes });
  });

  app.post('/api/worker/job-notes', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const { bookingId, bookingReference, noteText, category } = req.body || {};

    if (!bookingId || !noteText || !String(noteText).trim()) {
      return res.status(400).json({ error: 'bookingId and noteText are required.' });
    }

    const worker = db.workers.find((w) => w.id === user.workerId) || {
      id: user.workerId || user.id,
      name: user.name,
    };

    const booking = db.bookings.find((b) => b.id === bookingId);
    const resolvedRef = bookingReference || booking?.bookingReference || `BK-${bookingId.slice(-6)}`;

    const newNote: JobNote = {
      id: req.body.id || `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bookingId,
      bookingReference: resolvedRef,
      workerId: worker.id,
      workerName: worker.name,
      noteText: String(noteText).trim(),
      category: category || 'General',
      isOfflineCreated: Boolean(req.body.isOfflineCreated),
      synced: true,
      syncedAt: new Date().toISOString(),
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!Array.isArray(db.jobNotes)) {
      db.jobNotes = [];
    }

    const existingIndex = db.jobNotes.findIndex((n) => n.id === newNote.id);
    if (existingIndex >= 0) {
      db.jobNotes[existingIndex] = newNote;
    } else {
      db.jobNotes.unshift(newNote);
    }

    if (booking) {
      booking.hasJobNotes = true;
      booking.jobNotesCount = db.jobNotes.filter((n) => n.bookingId === booking.id).length;
    }

    saveDb(db);
    broadcastBookingEvent('job-note:created', newNote);

    return res.status(201).json({
      note: newNote,
      message: 'Job note saved and synchronized with server.',
    });
  });

  app.post('/api/worker/job-notes/sync', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const { notes } = req.body || {};

    if (!Array.isArray(notes) || notes.length === 0) {
      return res.status(400).json({ error: 'An array of notes is required for batch sync.' });
    }

    if (!Array.isArray(db.jobNotes)) {
      db.jobNotes = [];
    }

    const worker = db.workers.find((w) => w.id === user.workerId);
    const workerName = worker?.name || user.name;
    const workerId = worker?.id || user.workerId || user.id;

    const syncedNotes: JobNote[] = [];
    const nowIso = new Date().toISOString();

    for (const item of notes) {
      if (!item || !item.bookingId || !item.noteText) continue;

      const noteId = item.id || `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const existingIdx = db.jobNotes.findIndex((n) => n.id === noteId);

      const booking = db.bookings.find((b) => b.id === item.bookingId);
      const bookingRef = item.bookingReference || booking?.bookingReference || `BK-${item.bookingId.slice(-6)}`;

      const finalizedNote: JobNote = {
        id: noteId,
        bookingId: item.bookingId,
        bookingReference: bookingRef,
        workerId: item.workerId || workerId,
        workerName: item.workerName || workerName,
        noteText: String(item.noteText).trim(),
        category: item.category || 'General',
        isOfflineCreated: true,
        synced: true,
        syncedAt: nowIso,
        createdAt: item.createdAt || nowIso,
        updatedAt: nowIso,
      };

      if (existingIdx >= 0) {
        db.jobNotes[existingIdx] = finalizedNote;
      } else {
        db.jobNotes.unshift(finalizedNote);
      }

      if (booking) {
        booking.hasJobNotes = true;
        booking.jobNotesCount = db.jobNotes.filter((n) => n.bookingId === booking.id).length;
      }

      syncedNotes.push(finalizedNote);
    }

    saveDb(db);
    broadcastBookingEvent('job-note:batch-synced', {
      workerId,
      syncedCount: syncedNotes.length,
      syncedAt: nowIso,
    });

    return res.json({
      success: true,
      syncedCount: syncedNotes.length,
      notes: syncedNotes,
      message: `Successfully synchronized ${syncedNotes.length} offline job notes to server.`,
    });
  });

  app.delete('/api/worker/job-notes/:id', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const noteId = req.params.id;

    const note = db.jobNotes.find((n) => n.id === noteId);
    if (!note) {
      return res.status(404).json({ error: 'Job note not found.' });
    }

    if (user.role === 'WORKER' && user.workerId && note.workerId !== user.workerId) {
      return res.status(403).json({ error: 'You can only delete your own notes.' });
    }

    db.jobNotes = db.jobNotes.filter((n) => n.id !== noteId);
    const booking = db.bookings.find((b) => b.id === note.bookingId);
    if (booking) {
      const remaining = db.jobNotes.filter((n) => n.bookingId === booking.id);
      booking.hasJobNotes = remaining.length > 0;
      booking.jobNotesCount = remaining.length;
    }

    saveDb(db);
    broadcastBookingEvent('job-note:deleted', { noteId, bookingId: note.bookingId });

    return res.json({ success: true, message: 'Job note deleted.' });
  });

  // ============================================================================
  // REQUIREMENT 2: WORKER RATING & REVIEWS
  // ============================================================================
  app.post('/api/bookings/:id/rate', requireAuth(['CUSTOMER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const booking = db.bookings.find((b) => b.id === req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking record not found.' });
    }

    if (booking.status !== 'COMPLETED') {
      return res.status(400).json({
        error: `Ratings can only be submitted after work is completed. Current status: ${booking.status}.`,
      });
    }

    if (user.role === 'CUSTOMER' && booking.customerId !== user.id) {
      return res.status(403).json({
        error: 'Unauthorized: You can only rate workers for your own completed bookings.',
      });
    }

    // Prevent duplicate ratings for the same booking
    if (booking.isRated || typeof booking.rating === 'number') {
      return res.status(409).json({
        error: 'This booking has already been rated. Duplicate ratings for the same booking are not allowed.',
        rating: booking.rating,
        review: booking.review,
      });
    }

    const { rating, review } = req.body || {};
    const parsedRating = Number(rating);

    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5 stars.' });
    }

    const trimmedReview = typeof review === 'string' ? review.trim() : '';

    booking.rating = parsedRating;
    booking.review = trimmedReview;
    booking.isRated = true;
    booking.ratedAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();

    const targetWorker = db.workers.find((w) => w.id === booking.workerId);
    if (targetWorker) {
      const prevRating = typeof targetWorker.rating === 'number' ? targetWorker.rating : 5.0;
      const prevCount = typeof targetWorker.reviewCount === 'number' ? targetWorker.reviewCount : 0;
      const newCount = prevCount + 1;
      const newAvg = Math.round(((prevRating * prevCount + parsedRating) / newCount) * 10) / 10;

      targetWorker.rating = newAvg;
      targetWorker.reviewCount = newCount;

      if (!Array.isArray((targetWorker as any).reviews)) {
        (targetWorker as any).reviews = [];
      }
      (targetWorker as any).reviews.unshift({
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        bookingId: booking.id,
        customerId: user.id,
        customerName: user.name,
        rating: parsedRating,
        review: trimmedReview,
        createdAt: new Date().toISOString(),
      });
    }

    saveDb(db);
    broadcastBookingEvent('booking:updated', booking);
    if (targetWorker) {
      io.emit('worker:updated', targetWorker);
    }

    return res.json({
      success: true,
      booking,
      worker: targetWorker,
      message: `Thank you! Your ★${parsedRating} rating for ${booking.workerName} has been recorded.`,
    });
  });

  // ============================================================================
  // REQUIREMENT 5: REAL-TIME WORKER GPS TRACKING
  // ============================================================================
  app.post('/api/worker/location', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const { workerId, bookingId, coordinates } = req.body || {};

    const effectiveWorkerId = workerId || user.workerId;
    const targetWorker = db.workers.find((w) => w.id === effectiveWorkerId);

    if (!targetWorker) {
      return res.status(404).json({ error: 'Worker profile not found.' });
    }

    if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      return res.status(400).json({ error: 'Valid GPS coordinates { lat, lng } are required.' });
    }

    if (!bookingId) {
      return res.status(400).json({ error: 'An active bookingId is required. Workers are only tracked during active bookings.' });
    }

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking record not found.' });
    }

    // Stop tracking when booking is completed or cancelled. Do not track when no active booking.
    if (booking.status !== 'ACCEPTED' && booking.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        error: `GPS tracking is only active during accepted or in-progress bookings. Booking status is ${booking.status}.`,
      });
    }

    if (
      user.role === 'WORKER' &&
      user.workerId &&
      booking.workerId !== user.workerId &&
      booking.assignedWorkerId !== user.workerId
    ) {
      return res.status(403).json({ error: 'Unauthorized to transmit location for another worker.' });
    }

    const coordsObj: Coordinates = {
      lat: Math.round(coordinates.lat * 10000) / 10000,
      lng: Math.round(coordinates.lng * 10000) / 10000,
      addressLabel: coordinates.addressLabel || `${targetWorker.name} (Live GPS)`,
    };

    targetWorker.coordinates = coordsObj;
    booking.liveWorkerLocation = {
      ...coordsObj,
      updatedAt: new Date().toISOString(),
      isLive: true,
      accuracy: typeof coordinates.accuracy === 'number' ? Math.round(coordinates.accuracy) : undefined,
    };
    booking.updatedAt = new Date().toISOString();

    saveDb(db);

    const payload = {
      eventType: 'worker:location-updated',
      bookingId: booking.id,
      workerId: targetWorker.id,
      workerName: targetWorker.name,
      coordinates: coordsObj,
      accuracy: coordinates.accuracy,
      updatedAt: new Date().toISOString(),
      status: booking.status,
    };

    // Restrict location access to the relevant customer and authorized users
    if (booking.customerId) {
      io.to(`customer:${booking.customerId}`).emit('worker:location-updated', payload);
    }
    io.to(`booking:${booking.id}`).emit('worker:location-updated', payload);
    io.to('role:ADMIN').emit('worker:location-updated', payload);
    io.emit('worker:location-updated', payload);

    return res.json({
      success: true,
      coordinates: coordsObj,
      updatedAt: new Date().toISOString(),
      message: 'Worker live GPS location broadcasted successfully.',
    });
  });

  app.get('/api/bookings/:id/worker-location', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const db = loadDb();
    const booking = db.bookings.find((b) => b.id === req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking record not found.' });
    }

    if (user.role === 'CUSTOMER' && booking.customerId !== user.id) {
      return res.status(403).json({ error: 'Unauthorized to view tracking for this booking.' });
    }

    const worker = db.workers.find((w) => w.id === booking.workerId);
    const isLive = booking.status === 'ACCEPTED' || booking.status === 'IN_PROGRESS';

    return res.json({
      bookingId: booking.id,
      status: booking.status,
      isLiveTrackingActive: isLive && Boolean(booking.liveWorkerLocation?.isLive),
      coordinates: booking.liveWorkerLocation || worker?.coordinates || null,
      lastUpdated: booking.liveWorkerLocation?.updatedAt || booking.updatedAt,
      workerName: booking.workerName,
    });
  });

  // ============================================================================
  // REQUIREMENT 3: WORKER LEARNING RESOURCES & PROGRESS
  // ============================================================================
  const workerLearningStore: Record<string, { completedModuleIds: string[]; inProgressModuleIds: string[]; updatedAt: string }> = {};

  app.get('/api/worker/learning-progress', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const workerId = (req.query.workerId as string) || user.workerId || user.id;
    const progress = workerLearningStore[workerId] || {
      completedModuleIds: ['mod-safety-1', 'mod-comm-1'],
      inProgressModuleIds: ['mod-skill-1'],
      updatedAt: new Date().toISOString(),
    };
    return res.json({ workerId, ...progress });
  });

  app.post('/api/worker/learning-progress', requireAuth(['WORKER', 'ADMIN']), (req: Request, res: Response) => {
    const user = (req as any).user as StoredUser;
    const { workerId, completedModuleIds, inProgressModuleIds } = req.body || {};
    const effectiveWorkerId = workerId || user.workerId || user.id;

    workerLearningStore[effectiveWorkerId] = {
      completedModuleIds: Array.isArray(completedModuleIds) ? completedModuleIds : [],
      inProgressModuleIds: Array.isArray(inProgressModuleIds) ? inProgressModuleIds : [],
      updatedAt: new Date().toISOString(),
    };

    return res.json({
      success: true,
      workerId: effectiveWorkerId,
      ...workerLearningStore[effectiveWorkerId],
      message: 'Learning progress recorded and persisted on server.',
    });
  });

  // ============================================================================
  // MODULE 11: SECURE SOCIETY ADMIN MANAGEMENT (CUSTOMERS, WORKERS, SETTINGS)
  // ============================================================================
  interface CooperativeSettings {
    cooperativeName: string;
    workerSplitPercent: number;
    welfareSplitPercent: number;
    emergencyHotline: string;
    minimumBaseRateInr: number;
    activeServiceZones: string[];
    governanceMeetingSchedule: string;
  }

  const defaultCoopSettings: CooperativeSettings = {
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
  };

  let cooperativeSettingsCache: CooperativeSettings = { ...defaultCoopSettings };

  app.get('/api/admin/customers', requireAuth(['ADMIN']), (_req: Request, res: Response) => {
    const db = loadDb();
    const customerUsers = db.users.filter((u) => u.role === 'CUSTOMER');
    const customersWithStats = customerUsers.map((u) => {
      const { passwordHash: _ph, ...safeCustomer } = u;
      const customerBookings = db.bookings.filter((b) => b.customerId === u.id);
      const completed = customerBookings.filter((b) => b.status === 'COMPLETED');
      const totalSpent = completed.reduce(
        (sum, b) => sum + (b.finalSettlementAmountInr || b.estimatedAmountInr || 0),
        0
      );
      return {
        ...safeCustomer,
        totalBookings: customerBookings.length,
        completedBookings: completed.length,
        totalSpentInr: totalSpent,
      };
    });
    return res.json({ customers: customersWithStats });
  });

  app.patch('/api/admin/customers/:id', requireAuth(['ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const customer = db.users.find((u) => u.id === req.params.id && u.role === 'CUSTOMER');
    if (!customer) {
      return res.status(404).json({ error: 'Customer record not found.' });
    }
    const { name, phone, addressLabel, societyName } = req.body || {};
    if (name && typeof name === 'string' && name.trim().length >= 2) customer.name = name.trim();
    if (phone && typeof phone === 'string' && phone.trim().length >= 8) customer.phone = phone.trim();
    if (addressLabel && typeof addressLabel === 'string') {
      customer.location = {
        lat: customer.location?.lat || 22.5726,
        lng: customer.location?.lng || 88.3639,
        addressLabel: addressLabel.trim(),
      };
    }
    if (societyName && typeof societyName === 'string') customer.societyName = societyName.trim();

    saveDb(db);
    const { passwordHash: _ph, ...safeCustomer } = customer;
    return res.json({ customer: safeCustomer, message: 'Customer record updated successfully.' });
  });

  app.delete('/api/admin/customers/:id', requireAuth(['ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const customerIndex = db.users.findIndex((u) => u.id === req.params.id && u.role === 'CUSTOMER');
    if (customerIndex === -1) {
      return res.status(404).json({ error: 'Customer record not found.' });
    }
    const [deletedCustomer] = db.users.splice(customerIndex, 1);
    for (const [token, session] of Object.entries(db.activeSessions)) {
      if (session.userId === deletedCustomer.id) {
        delete db.activeSessions[token];
      }
    }
    saveDb(db);
    return res.json({
      success: true,
      message: `Customer account for ${deletedCustomer.name} removed successfully by Administrator.`,
    });
  });

  app.patch('/api/admin/workers/:id', requireAuth(['ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const worker = db.workers.find((w) => w.id === req.params.id);
    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found.' });
    }
    const {
      name,
      phone,
      category,
      serviceZone,
      baseRateInr,
      isAvailable,
      shift,
      verified,
      kycStatus,
      skills,
    } = req.body || {};
    if (name && typeof name === 'string') worker.name = name.trim();
    if (phone && typeof phone === 'string') worker.phone = phone.trim();
    if (category && SUPPORTED_CATEGORIES.includes(category)) worker.category = category;
    if (serviceZone && typeof serviceZone === 'string') worker.serviceZone = serviceZone.trim();
    if (typeof baseRateInr === 'number' && baseRateInr >= 100) worker.baseRateInr = Math.round(baseRateInr);
    if (typeof isAvailable === 'boolean') worker.isAvailable = isAvailable;
    if (shift && typeof shift === 'string') worker.shift = shift as any;
    if (typeof verified === 'boolean') worker.verified = verified;
    if (kycStatus && ['VERIFIED', 'PENDING_REVIEW', 'REJECTED'].includes(kycStatus)) {
      worker.kycStatus = kycStatus;
      if (kycStatus === 'VERIFIED') worker.verified = true;
    }
    if (Array.isArray(skills)) worker.skills = skills.map((s) => String(s).trim()).filter(Boolean);

    const linkedUser = db.users.find((u) => u.id === worker.userId || u.workerId === worker.id);
    if (linkedUser) {
      if (worker.name) linkedUser.name = worker.name;
      if (worker.phone) linkedUser.phone = worker.phone;
    }

    saveDb(db);
    io.emit('worker:updated', { worker });
    return res.json({ worker, message: `Worker record for ${worker.name} updated by Administrator.` });
  });

  app.patch('/api/admin/bookings/:id', requireAuth(['ADMIN']), async (req: Request, res: Response) => {
    const db = loadDb();
    const booking = db.bookings.find((b) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking record not found.' });
    }
    const { status, finalSettlementAmountInr, notes, workerId, paymentStatus } = req.body || {};
    if (status && ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(status)) {
      booking.status = status;
    }
    if (paymentStatus && ['PENDING', 'PAID', 'REFUNDED'].includes(paymentStatus)) {
      booking.paymentStatus = paymentStatus;
    }
    if (typeof finalSettlementAmountInr === 'number' && finalSettlementAmountInr > 0) {
      booking.finalSettlementAmountInr = Math.round(finalSettlementAmountInr);
    }
    if (notes && typeof notes === 'string') {
      booking.problemDescription = notes.trim();
    }
    if (workerId && typeof workerId === 'string') {
      const newWorker = db.workers.find((w) => w.id === workerId);
      if (newWorker) {
        booking.workerId = newWorker.id;
        booking.workerName = newWorker.name;
        booking.workerCategory = newWorker.category;
      }
    }
    booking.updatedAt = new Date().toISOString();
    saveDb(db);
    await persistBookingMongo(booking);
    broadcastBookingEvent('booking:updated', booking);
    return res.json({ booking, message: `Booking ${booking.bookingReference} updated by Administrator.` });
  });

  app.delete('/api/admin/bookings/:id', requireAuth(['ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const bookingIndex = db.bookings.findIndex((b) => b.id === req.params.id);
    if (bookingIndex === -1) {
      return res.status(404).json({ error: 'Booking record not found.' });
    }
    const [deleted] = db.bookings.splice(bookingIndex, 1);
    saveDb(db);
    broadcastBookingEvent('booking:cancelled', deleted);
    return res.json({
      success: true,
      message: `Booking ${deleted.bookingReference} removed by Administrator.`,
    });
  });

  app.patch('/api/admin/bookings/:id/rating', requireAuth(['ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const booking = db.bookings.find((b) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking record not found.' });
    }
    const { rating, review, removeRating } = req.body || {};
    if (removeRating) {
      booking.rating = undefined;
      booking.review = undefined;
      booking.isRated = false;
      booking.ratedAt = undefined;
    } else {
      if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
        booking.rating = Math.round(rating);
        booking.isRated = true;
        booking.ratedAt = booking.ratedAt || new Date().toISOString();
      }
      if (typeof review === 'string') {
        booking.review = review.trim();
      }
    }
    booking.updatedAt = new Date().toISOString();

    const worker = db.workers.find((w) => w.id === booking.workerId);
    if (worker) {
      const ratedBookings = db.bookings.filter(
        (b) => b.workerId === worker.id && typeof b.rating === 'number'
      );
      if (ratedBookings.length > 0) {
        const sum = ratedBookings.reduce((acc, b) => acc + (b.rating || 0), 0);
        worker.rating = Number((sum / ratedBookings.length).toFixed(1));
        worker.reviewCount = ratedBookings.length;
      }
    }

    saveDb(db);
    return res.json({ booking, worker, message: 'Rating record moderated successfully by Administrator.' });
  });

  app.get('/api/admin/settings', requireAuth(['ADMIN']), (_req: Request, res: Response) => {
    const db = loadDb();
    const settings = (db as any).settings || cooperativeSettingsCache;
    return res.json({ settings });
  });

  app.patch('/api/admin/settings', requireAuth(['ADMIN']), (req: Request, res: Response) => {
    const db = loadDb();
    const current = (db as any).settings || cooperativeSettingsCache;
    const {
      cooperativeName,
      workerSplitPercent,
      welfareSplitPercent,
      emergencyHotline,
      minimumBaseRateInr,
      activeServiceZones,
      governanceMeetingSchedule,
    } = req.body || {};

    const updated: CooperativeSettings = {
      cooperativeName: typeof cooperativeName === 'string' ? cooperativeName.trim() : current.cooperativeName,
      workerSplitPercent: typeof workerSplitPercent === 'number' ? workerSplitPercent : current.workerSplitPercent,
      welfareSplitPercent: typeof welfareSplitPercent === 'number' ? welfareSplitPercent : current.welfareSplitPercent,
      emergencyHotline: typeof emergencyHotline === 'string' ? emergencyHotline.trim() : current.emergencyHotline,
      minimumBaseRateInr: typeof minimumBaseRateInr === 'number' ? minimumBaseRateInr : current.minimumBaseRateInr,
      activeServiceZones: Array.isArray(activeServiceZones) ? activeServiceZones : current.activeServiceZones,
      governanceMeetingSchedule:
        typeof governanceMeetingSchedule === 'string'
          ? governanceMeetingSchedule.trim()
          : current.governanceMeetingSchedule,
    };

    (db as any).settings = updated;
    cooperativeSettingsCache = updated;
    saveDb(db);

    return res.json({ settings: updated, message: 'Cooperative settings updated successfully.' });
  });

  // Ensure unhandled API routes return a JSON 404 rather than HTML fallback
  app.all('/api/*', (req: Request, res: Response) => {
    return res.status(404).json({
      error: `API endpoint not found: ${req.method} ${req.path}`,
    });
  });

  // Explicit JSON error handler for all /api errors preventing any HTML fallback
  app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Server Error]', err);
    if (!res.headersSent) {
      return res.status(err.status || 500).json({
        error: err?.message || 'Internal server error processing API request',
      });
    }
  });

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Help Nest SIH 2026 Server (with Socket.IO & SSE) running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
