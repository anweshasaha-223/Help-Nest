import type { JobNote, JobNoteCategory } from '../types';

export const WORKER_OFFLINE_NOTES_KEY = 'helpnest_worker_offline_job_notes';
export const WORKER_NOTES_QUEUE_KEY = 'helpnest_worker_notes_sync_queue';

/**
 * Loads all locally cached job notes from localStorage
 */
export function loadLocalJobNotes(workerId?: string, bookingId?: string): JobNote[] {
  try {
    const raw = localStorage.getItem(WORKER_OFFLINE_NOTES_KEY);
    if (!raw) return [];
    const parsed: JobNote[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    let filtered = parsed;
    if (workerId) {
      filtered = filtered.filter((n) => n.workerId === workerId);
    }
    if (bookingId) {
      filtered = filtered.filter((n) => n.bookingId === bookingId);
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn('Failed to load local job notes from localStorage:', err);
    return [];
  }
}

/**
 * Persists all local job notes to localStorage
 */
export function saveLocalJobNotes(notes: JobNote[]): void {
  try {
    localStorage.setItem(WORKER_OFFLINE_NOTES_KEY, JSON.stringify(notes));
  } catch (err) {
    console.warn('Failed to save local job notes to localStorage:', err);
  }
}

/**
 * Loads the queue of pending unsynced notes created while offline
 */
export function loadPendingNotesQueue(): JobNote[] {
  try {
    const raw = localStorage.getItem(WORKER_NOTES_QUEUE_KEY);
    if (!raw) return [];
    const parsed: JobNote[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load pending notes queue:', err);
    return [];
  }
}

/**
 * Saves the pending unsynced notes queue to localStorage
 */
export function savePendingNotesQueue(queue: JobNote[]): void {
  try {
    localStorage.setItem(WORKER_NOTES_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('Failed to save pending notes queue:', err);
  }
}

/**
 * Adds an offline note to the sync queue and local store
 */
export function enqueueNoteForSync(note: JobNote): void {
  // 1. Add to pending queue (deduplicated by note.id)
  const queue = loadPendingNotesQueue();
  const existingIdx = queue.findIndex((q) => q.id === note.id);
  if (existingIdx >= 0) {
    queue[existingIdx] = note;
  } else {
    queue.push(note);
  }
  savePendingNotesQueue(queue);

  // 2. Also upsert in local storage so UI displays immediately
  const allNotes = loadLocalJobNotes();
  const noteIdx = allNotes.findIndex((n) => n.id === note.id);
  if (noteIdx >= 0) {
    allNotes[noteIdx] = note;
  } else {
    allNotes.unshift(note);
  }
  saveLocalJobNotes(allNotes);
}

/**
 * Merges server notes with local notes preserving offline pending notes
 */
export function mergeServerAndLocalNotes(serverNotes: JobNote[], workerId?: string): JobNote[] {
  const localNotes = loadLocalJobNotes();
  const noteMap = new Map<string, JobNote>();

  // Put server notes first
  for (const sn of serverNotes) {
    if (sn && sn.id) {
      noteMap.set(sn.id, { ...sn, synced: true, isOfflineCreated: sn.isOfflineCreated || false });
    }
  }

  // Overlay local notes; if note in pending queue, maintain its pending sync status
  const pendingQueue = loadPendingNotesQueue();
  const pendingIds = new Set(pendingQueue.map((p) => p.id));

  for (const ln of localNotes) {
    if (ln && ln.id) {
      if (pendingIds.has(ln.id)) {
        // Keep pending offline state
        noteMap.set(ln.id, { ...ln, synced: false, isOfflineCreated: true });
      } else if (!noteMap.has(ln.id)) {
        // Saved locally, keep it
        noteMap.set(ln.id, ln);
      }
    }
  }

  const merged = Array.from(noteMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  saveLocalJobNotes(merged);

  if (workerId) {
    return merged.filter((n) => n.workerId === workerId);
  }
  return merged;
}

/**
 * Creates or updates a job note:
 * - If online and token provided: sends to server directly, caches locally as synced.
 * - If offline or network error: stores locally, marks as offline/unsynced, enqueues for auto-sync.
 */
export async function saveJobNoteLocallyAndRemote(params: {
  id?: string;
  bookingId: string;
  bookingReference: string;
  workerId: string;
  workerName: string;
  noteText: string;
  category: JobNoteCategory;
  isOnline: boolean;
  token?: string;
}): Promise<{ note: JobNote; isOffline: boolean; synced: boolean }> {
  const noteId = params.id || `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  // If online, attempt server post first
  if (params.isOnline && params.token) {
    try {
      const res = await fetch('/api/worker/job-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.token}`,
        },
        body: JSON.stringify({
          id: noteId,
          bookingId: params.bookingId,
          bookingReference: params.bookingReference,
          noteText: params.noteText,
          category: params.category,
          isOfflineCreated: false,
          createdAt: now,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const savedNote: JobNote = data.note || {
          id: noteId,
          bookingId: params.bookingId,
          bookingReference: params.bookingReference,
          workerId: params.workerId,
          workerName: params.workerName,
          noteText: params.noteText,
          category: params.category,
          isOfflineCreated: false,
          synced: true,
          syncedAt: now,
          createdAt: now,
          updatedAt: now,
        };

        // Update local storage
        const allNotes = loadLocalJobNotes();
        const existingIdx = allNotes.findIndex((n) => n.id === noteId);
        if (existingIdx >= 0) {
          allNotes[existingIdx] = savedNote;
        } else {
          allNotes.unshift(savedNote);
        }
        saveLocalJobNotes(allNotes);

        return { note: savedNote, isOffline: false, synced: true };
      }
    } catch (err) {
      console.warn('Network error posting job note, falling back to offline storage:', err);
    }
  }

  // OFFLINE PATH: Save strictly locally and queue for background sync
  const offlineNote: JobNote = {
    id: noteId,
    bookingId: params.bookingId,
    bookingReference: params.bookingReference,
    workerId: params.workerId,
    workerName: params.workerName,
    noteText: params.noteText,
    category: params.category,
    isOfflineCreated: true,
    synced: false,
    createdAt: now,
    updatedAt: now,
  };

  enqueueNoteForSync(offlineNote);

  return { note: offlineNote, isOffline: true, synced: false };
}

/**
 * Synchronizes all pending queued offline notes to the server
 */
export async function syncPendingNotesToServer(token: string): Promise<{
  success: boolean;
  syncedCount: number;
  syncedNotes: JobNote[];
  message: string;
}> {
  const queue = loadPendingNotesQueue();
  if (queue.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      syncedNotes: [],
      message: 'All notes are already synchronized.',
    };
  }

  try {
    const res = await fetch('/api/worker/job-notes/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notes: queue }),
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const syncedNotes: JobNote[] = data.notes || [];

    // Clear synchronized items from queue
    const syncedIds = new Set(syncedNotes.map((n) => n.id));
    const remainingQueue = queue.filter((item) => !syncedIds.has(item.id));
    savePendingNotesQueue(remainingQueue);

    // Update local cache to mark them as synced
    const localNotes = loadLocalJobNotes();
    const updatedLocal = localNotes.map((item) => {
      const match = syncedNotes.find((sn) => sn.id === item.id);
      if (match) {
        return { ...match, synced: true, syncedAt: match.syncedAt || new Date().toISOString() };
      }
      return item;
    });
    saveLocalJobNotes(updatedLocal);

    return {
      success: true,
      syncedCount: syncedNotes.length,
      syncedNotes,
      message: data.message || `Successfully synchronized ${syncedNotes.length} offline job notes.`,
    };
  } catch (err: any) {
    console.warn('Failed to sync offline notes to server:', err);
    return {
      success: false,
      syncedCount: 0,
      syncedNotes: [],
      message: err?.message || 'Failed to sync offline notes. Will retry automatically upon connection.',
    };
  }
}

/**
 * Deletes a note locally and on server
 */
export async function deleteJobNoteItem(
  noteId: string,
  isOnline: boolean,
  token?: string
): Promise<boolean> {
  // 1. Remove from local store
  const allNotes = loadLocalJobNotes();
  saveLocalJobNotes(allNotes.filter((n) => n.id !== noteId));

  // 2. Remove from pending queue
  const queue = loadPendingNotesQueue();
  savePendingNotesQueue(queue.filter((q) => q.id !== noteId));

  // 3. If online, notify server
  if (isOnline && token) {
    try {
      await fetch(`/api/worker/job-notes/${noteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // offline silent failure
    }
  }

  return true;
}

/**
 * Returns number of unsynced notes in queue
 */
export function getPendingOfflineNotesCount(workerId?: string): number {
  const queue = loadPendingNotesQueue();
  if (!workerId) return queue.length;
  return queue.filter((q) => q.workerId === workerId).length;
}
