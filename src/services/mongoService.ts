import { MongoClient, Db, Collection } from 'mongodb';
import type {
  UserAccount,
  BookingRecord,
  ProblemReport,
  MediaMetadata,
  GemmaProblemAnalysis,
  ProblemReportStatus,
} from '../types.ts';

export interface JobStatusHistoryEntry {
  id: string;
  bookingId: string;
  bookingReference: string;
  problemReportId?: string;
  previousStatus: string;
  newStatus: string;
  updatedBy: string;
  updatedByRole: string;
  timestamp: string;
  note?: string;
}

export interface PaymentRecordEntry {
  id: string;
  bookingId: string;
  bookingReference: string;
  customerId: string;
  workerId: string;
  amountInr: number;
  workerShareInr: number;
  welfareShareInr: number;
  paymentMethod: string;
  paymentStatus: 'UNPAID' | 'ORDER_CREATED' | 'PAID';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  settledAt?: string;
  timestamp: string;
}

let client: MongoClient | null = null;
let dbInstance: Db | null = null;
let isConnected = false;
let connectionError: string | null = null;

export async function initMongo(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim() === '' || uri.includes('SAMPLE_PASSWORD')) {
    connectionError = 'MONGODB_URI not provided or contains placeholder credentials.';
    return false;
  }

  try {
    client = new MongoClient(uri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    dbInstance = client.db('helpnest_coop');
    isConnected = true;
    connectionError = null;
    console.log('[MongoDB Atlas] Connected successfully to helpnest_coop database.');

    // Ensure collections and indexes
    const collections = await dbInstance.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    if (!collectionNames.includes('problem_reports')) {
      await dbInstance.createCollection('problem_reports');
    }
    await dbInstance.collection('problem_reports').createIndex({ bookingId: 1 });
    await dbInstance.collection('problem_reports').createIndex({ customerId: 1 });
    await dbInstance.collection('problem_reports').createIndex({ assignedWorkerId: 1 });

    return true;
  } catch (err: any) {
    isConnected = false;
    connectionError = err instanceof Error ? err.message : String(err);
    console.warn('[MongoDB Atlas] Connection attempt failed (using resilient local JSON store):', connectionError);
    return false;
  }
}

export function getMongoDb(): Db | null {
  return isConnected ? dbInstance : null;
}

export function getMongoStatus(): {
  configured: boolean;
  connected: boolean;
  database: string;
  error: string | null;
} {
  const uri = process.env.MONGODB_URI;
  return {
    configured: Boolean(uri && !uri.includes('SAMPLE_PASSWORD')),
    connected: isConnected,
    database: isConnected ? 'helpnest_coop (MongoDB Atlas)' : 'Local Persistent JSON Store',
    error: connectionError,
  };
}

// Persist or mirror Problem Report in MongoDB
export async function persistProblemReportMongo(report: ProblemReport): Promise<void> {
  if (!isConnected || !dbInstance) return;
  try {
    const col = dbInstance.collection<ProblemReport>('problem_reports');
    await col.updateOne({ id: report.id }, { $set: report }, { upsert: true });

    // Store separate MediaMetadata collection entry if media attached
    if (report.media) {
      const mediaCol = dbInstance.collection<MediaMetadata & { reportId: string; bookingId: string }>(
        'media_metadata'
      );
      await mediaCol.updateOne(
        { id: report.media.id },
        { $set: { ...report.media, reportId: report.id, bookingId: report.bookingId } },
        { upsert: true }
      );
    }

    // Store separate AIAnalysis collection entry if analysis exists
    if (report.aiAnalysis) {
      const aiCol = dbInstance.collection<GemmaProblemAnalysis>('ai_analyses');
      await aiCol.updateOne(
        { id: report.aiAnalysis.id },
        { $set: report.aiAnalysis },
        { upsert: true }
      );
    }

    // Log status history in job_status_history
    const historyCol = dbInstance.collection<JobStatusHistoryEntry>('job_status_history');
    await historyCol.insertOne({
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      bookingId: report.bookingId,
      bookingReference: report.bookingReference,
      problemReportId: report.id,
      previousStatus: '',
      newStatus: report.status,
      updatedBy: report.customerName,
      updatedByRole: 'CUSTOMER',
      timestamp: new Date().toISOString(),
      note: report.problemDescription,
    });
  } catch (err) {
    console.warn('[MongoDB Atlas] Error writing problem report:', err);
  }
}

// Log status transition in MongoDB JobStatusHistory
export async function logJobStatusHistoryMongo(entry: JobStatusHistoryEntry): Promise<void> {
  if (!isConnected || !dbInstance) return;
  try {
    const col = dbInstance.collection<JobStatusHistoryEntry>('job_status_history');
    await col.insertOne(entry);
  } catch (err) {
    console.warn('[MongoDB Atlas] Error writing job status history:', err);
  }
}

// Mirror Bookings in MongoDB
export async function persistBookingMongo(booking: BookingRecord): Promise<void> {
  if (!isConnected || !dbInstance) return;
  try {
    const col = dbInstance.collection<BookingRecord>('bookings');
    await col.updateOne({ id: booking.id }, { $set: booking }, { upsert: true });
  } catch (err) {
    console.warn('[MongoDB Atlas] Error writing booking:', err);
  }
}

// Mirror Payment Records in MongoDB
export async function persistPaymentRecordMongo(payment: PaymentRecordEntry): Promise<void> {
  if (!isConnected || !dbInstance) return;
  try {
    const col = dbInstance.collection<PaymentRecordEntry>('payment_records');
    await col.updateOne({ id: payment.id }, { $set: payment }, { upsert: true });
  } catch (err) {
    console.warn('[MongoDB Atlas] Error writing payment record:', err);
  }
}

// Mirror Complaint-to-Action in MongoDB
export async function persistComplaintToActionMongo(record: any): Promise<void> {
  if (!isConnected || !dbInstance) return;
  try {
    const col = dbInstance.collection('complaint_to_actions');
    await col.updateOne({ id: record.id }, { $set: record }, { upsert: true });
  } catch (err) {
    console.warn('[MongoDB Atlas] Error writing complaint-to-action:', err);
  }
}

// Mirror Repair Reports in MongoDB
export async function persistRepairReportMongo(report: any): Promise<void> {
  if (!isConnected || !dbInstance) return;
  try {
    const col = dbInstance.collection('repair_reports');
    await col.updateOne({ id: report.id }, { $set: report }, { upsert: true });
  } catch (err) {
    console.warn('[MongoDB Atlas] Error writing repair report:', err);
  }
}

// Mirror Booking Gap Analyses in MongoDB
export async function persistBookingGapAnalysisMongo(gap: any): Promise<void> {
  if (!isConnected || !dbInstance) return;
  try {
    const col = dbInstance.collection('booking_gap_analyses');
    await col.updateOne({ id: gap.id }, { $set: gap }, { upsert: true });
  } catch (err) {
    console.warn('[MongoDB Atlas] Error writing booking gap analysis:', err);
  }
}

// Mirror Cooperative Policy Queries in MongoDB
export async function persistCoopPolicyQueryMongo(entry: any): Promise<void> {
  if (!isConnected || !dbInstance) return;
  try {
    const col = dbInstance.collection('coop_policy_queries');
    await col.insertOne(entry);
  } catch (err) {
    console.warn('[MongoDB Atlas] Error writing cooperative policy query:', err);
  }
}

