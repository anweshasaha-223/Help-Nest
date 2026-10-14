import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  X,
  Wifi,
  WifiOff,
  CloudUpload,
  CheckCircle2,
  Clock,
  Trash2,
  Mic,
  MicOff,
  Tag,
  AlertCircle,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import type { BookingRecord, JobNote, JobNoteCategory, WorkerProfile, PolishCompletionNoteResult } from '../types';
import type { LanguageCode } from '../i18n/translations';
import {
  loadLocalJobNotes,
  saveJobNoteLocallyAndRemote,
  deleteJobNoteItem,
  syncPendingNotesToServer,
  getPendingOfflineNotesCount,
} from '../services/jobNotesService';

interface JobNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingRecord;
  worker: WorkerProfile;
  token?: string;
  isOnline: boolean;
  lang?: LanguageCode;
  t?: Record<string, string>;
  onNotesUpdated?: () => void;
}

const CATEGORIES: { label: JobNoteCategory; icon: string; color: string }[] = [
  { label: 'General', icon: '📝', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700' },
  { label: 'Site Inspection', icon: '🔍', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  { label: 'Parts & Materials', icon: '🔧', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { label: 'Customer Instruction', icon: '👤', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  { label: 'Work Progress', icon: '⚡', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { label: 'Follow-up Required', icon: '⚠️', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
];

const PRESET_SNIPPETS: Record<LanguageCode, string[]> = {
  en: [
    'Main power shutoff inspected and safe',
    'Customer requested 1/2 inch PVC pipe replacement',
    'Dimensions measured: 24cm clearance verified',
    'Safety grounding test completed',
    'Site left clean and customer satisfied',
  ],
  bn: [
    'মূল বিদ্যুৎ সংযোগ পরীক্ষা করা হয়েছে এবং নিরাপদ',
    'গ্রাহক ১/২ ইঞ্চি পিভিসি পাইপ পরিবর্তনের অনুরোধ করেছেন',
    'মাপ নেওয়া হয়েছে ও প্রস্তুত',
    'নিরাপত্তা আর্থিং টেস্ট সম্পন্ন হয়েছে',
    'কাজের স্থান পরিষ্কার করে গ্রাহককে দেখানো হয়েছে',
  ],
  hi: [
    'मुख्य पावर कनेक्शन जांचा गया और सुरक्षित है',
    'ग्राहक ने 1/2 इंच पीवीसी पाइप बदलने का अनुरोध किया',
    'माप लिया गया और सत्यापित किया गया',
    'सुरक्षा अर्थिंग परीक्षण पूरा हुआ',
    'कार्य स्थल साफ कर ग्राहक को दिखाया गया',
  ],
};

export const JobNotesModal: React.FC<JobNotesModalProps> = ({
  isOpen,
  onClose,
  booking,
  worker,
  token,
  isOnline,
  lang = 'en',
  t = {},
  onNotesUpdated,
}) => {
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<JobNoteCategory>('General');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // Voice speech-to-text dictation state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  // Gemma 4 E4B AI completion note drafting state
  const [isPolishing, setIsPolishing] = useState(false);
  const [aiDraft, setAiDraft] = useState<PolishCompletionNoteResult | null>(null);

  const handleGenerateAiDraft = async () => {
    if (!token) {
      setFeedback({ type: 'error', message: 'Authentication required to draft note with AI.' });
      return;
    }
    if (!isOnline) {
      setFeedback({
        type: 'error',
        message:
          lang === 'bn'
            ? 'এআই ড্রাফট তৈরির জন্য সক্রিয় ইন্টারনেট সংযোগ প্রয়োজন।'
            : lang === 'hi'
            ? 'एआई ड्राफ्ट बनाने के लिए सक्रिय इंटरनेट कनेक्शन आवश्यक है।'
            : 'Active internet connection required to generate AI completion note draft.',
      });
      return;
    }

    const noteToPolish =
      newNoteText.trim() ||
      booking.problemDescription ||
      `Service visit completed for ${booking.workerCategory}. Customer verified trade repair.`;

    setIsPolishing(true);
    setFeedback({
      type: 'info',
      message:
        lang === 'bn'
          ? 'গুগল গেমা ৪ ই৪বি এআই সমাপ্তি নোট ড্রাফট তৈরি করছে...'
          : lang === 'hi'
          ? 'गूगल जेम्मा 4 ई4बी एआई समाप्ति नोट ड्राफ्ट तैयार कर रहा है...'
          : 'Google Gemma 4 E4B is drafting professional completion note...',
    });

    try {
      const res = await fetch('/api/ai/polish-completion-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rawNotes: noteToPolish,
          category: booking.workerCategory,
          workerName: worker.name,
          workerPreferredLanguage: lang,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate AI completion note draft.');
      }

      const data = (await res.json()) as PolishCompletionNoteResult;
      setAiDraft(data);
      setFeedback({
        type: 'success',
        message:
          lang === 'bn'
            ? 'গেমা ৪ এআই সমাপ্তি নোট ড্রাফট সফলভাবে তৈরি হয়েছে!'
            : lang === 'hi'
            ? 'जेम्मा 4 एआई समाप्ति नोट ड्राफ्ट सफलतापूर्वक तैयार!'
            : 'Gemma 4 E4B completion note draft generated successfully!',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'AI note drafting failed.',
      });
    } finally {
      setIsPolishing(false);
    }
  };

  // Refresh notes for this specific booking
  const refreshNotes = useCallback(() => {
    const all = loadLocalJobNotes(worker.id, booking.id);
    setNotes(all);
  }, [worker.id, booking.id]);

  useEffect(() => {
    if (isOpen) {
      refreshNotes();
    }
  }, [isOpen, refreshNotes]);

  // Handle Speech Recognition dictation
  const handleToggleVoiceDictation = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setFeedback({
        type: 'error',
        message: 'Speech recognition is not supported in this browser. Please type your note.',
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang === 'bn' ? 'bn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setNewNoteText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechSupported(false);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setIsSaving(true);
    try {
      const result = await saveJobNoteLocallyAndRemote({
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        workerId: worker.id,
        workerName: worker.name,
        noteText: newNoteText.trim(),
        category: selectedCategory,
        isOnline,
        token,
      });

      setNewNoteText('');
      refreshNotes();
      onNotesUpdated?.();

      if (result.isOffline) {
        setFeedback({
          type: 'info',
          message:
            lang === 'bn'
              ? 'নোট ডিভাইসে নিরাপদে সংরক্ষিত হয়েছে (অফলাইন)। ইন্টারনেট আসলে স্বয়ংক্রিয়ভাবে সার্ভারে সিঙ্ক হবে।'
              : lang === 'hi'
              ? 'नोट डिवाइस पर सुरक्षित रूप से सहेजा गया (ऑफ़लाइन)। इंटरनेट जुड़ने पर स्वचालित रूप से सिंक हो जाएगा।'
              : 'Note safely stored locally in offline storage. Will automatically sync to server upon reconnection.',
        });
      } else {
        setFeedback({
          type: 'success',
          message:
            lang === 'bn'
              ? 'নোট সফলভাবে সার্ভারে সংরক্ষিত ও সিঙ্ক হয়েছে।'
              : lang === 'hi'
              ? 'नोट सर्वर पर सफलतापूर्वक सहेजा और सिंक किया गया।'
              : 'Note successfully saved and synced with cooperative server.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to record note.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger manual sync for pending notes
  const handleManualSync = async () => {
    if (!token || !isOnline || isSyncing) return;
    setIsSyncing(true);
    setFeedback({
      type: 'info',
      message:
        lang === 'bn'
          ? 'সার্ভারের সাথে সিঙ্ক হচ্ছে...'
          : lang === 'hi'
          ? 'सर्वर के साथ सिंक हो रहा है...'
          : 'Synchronizing offline notes to server...',
    });

    try {
      const res = await syncPendingNotesToServer(token);
      refreshNotes();
      onNotesUpdated?.();
      if (res.success) {
        setFeedback({
          type: 'success',
          message:
            lang === 'bn'
              ? `সফলভাবে ${res.syncedCount}টি অফলাইন নোট সার্ভারে সিঙ্ক করা হয়েছে!`
              : lang === 'hi'
              ? `सफलतापूर्वक ${res.syncedCount} ऑफ़लाइन नोट सर्वर से सिंक किए गए!`
              : `Successfully synced ${res.syncedCount} offline job notes to server!`,
        });
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Sync failed. Will retry automatically.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!window.confirm(lang === 'bn' ? 'আপনি কি এই নোটটি মুছে ফেলতে চান?' : lang === 'hi' ? 'क्या आप इस नोट को हटाना चाहते हैं?' : 'Are you sure you want to delete this note?')) return;
    await deleteJobNoteItem(id, isOnline, token);
    refreshNotes();
    onNotesUpdated?.();
  };

  const pendingCount = getPendingOfflineNotesCount(worker.id);
  const bookingPendingCount = notes.filter((n) => !n.synced).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 flex items-center justify-center shadow-sm">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'কাজের নোট ও ফিল্ড লগ' : lang === 'hi' ? 'कार्य नोट्स और फ़ील्ड लॉग' : 'Job Notes & Field Log'}
                  </h3>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {booking.bookingReference}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {booking.customerName} • {booking.workerCategory} • {booking.preferredDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Online/Offline Status Indicator */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
              >
                {isOnline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{lang === 'bn' ? 'অনলাইন' : lang === 'hi' ? 'ऑनलाइन' : 'Online'}</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{lang === 'bn' ? 'অফলাইন মোড' : lang === 'hi' ? 'ऑफ़लाइन मोड' : 'Offline Mode'}</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {/* Feedback Message */}
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                    : feedback.type === 'info'
                    ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200 border-blue-200 dark:border-blue-800'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{feedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            {/* Offline Auto-Sync Notification Banner */}
            {!isOnline ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-start gap-3">
                <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  <p className="font-semibold mb-0.5">
                    {lang === 'bn'
                      ? 'অফলাইন মোড সক্রিয় — স্থানীয় স্টোরেজ সুরক্ষা'
                      : lang === 'hi'
                      ? 'ऑफ़लाइन मोड सक्रिय — स्थानीय संग्रहण सुरक्षा'
                      : 'Offline Mode Active — Local Device Storage Safety'}
                  </p>
                  <p>
                    {lang === 'bn'
                      ? 'আপনার লেখা সকল নোট এই ডিভাইসে নিরাপদে সংরক্ষিত থাকবে। ইন্টারনেট সংযোগ ফিরে আসার সাথে সাথে সেগুলি সার্ভারে স্বয়ংক্রিয়ভাবে সিঙ্ক হয়ে যাবে।'
                      : lang === 'hi'
                      ? 'आपके द्वारा लिखे गए सभी नोट्स इस डिवाइस पर सुरक्षित रहेंगे। इंटरनेट कनेक्शन बहाल होते ही वे सर्वर पर स्वचालित रूप से सिंक हो जाएंगे।'
                      : 'All notes written offline are safely stored on your device and will sync automatically to the cooperative server the moment connection is restored.'}
                  </p>
                </div>
              </div>
            ) : bookingPendingCount > 0 ? (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-200 font-medium">
                  <CloudUpload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>
                    {lang === 'bn'
                      ? `${bookingPendingCount}টি অফলাইন নোট সার্ভারে সিঙ্ক করার জন্য প্রস্তুত`
                      : lang === 'hi'
                      ? `${bookingPendingCount} ऑफ़लाइन नोट सर्वर से सिंक के लिए तैयार`
                      : `${bookingPendingCount} offline note(s) ready to sync to server`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                >
                  <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                  <span>{isSyncing ? (lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : lang === 'hi' ? 'सिंक हो रहा...' : 'Syncing...') : (lang === 'bn' ? 'এখনই সিঙ্ক করুন' : lang === 'hi' ? 'अभी सिंक करें' : 'Sync Now')}</span>
                </button>
              </div>
            ) : null}

            {/* Note Creation Form */}
            <form onSubmit={handleSaveNote} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  {lang === 'bn' ? 'ক্যাটাগরি বেছে নিন' : lang === 'hi' ? 'श्रेणी चुनें' : 'Note Category'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.label;
                    return (
                      <button
                        type="button"
                        key={cat.label}
                        onClick={() => setSelectedCategory(cat.label)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : `${cat.color} hover:opacity-90`
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Snippets / Templates */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  {lang === 'bn' ? 'নমুনা দ্রুত টেক্সট:' : lang === 'hi' ? 'त्वरित टेम्पलेट:' : 'Quick Presets:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(PRESET_SNIPPETS[lang] || PRESET_SNIPPETS.en).map((snippet, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() =>
                        setNewNoteText((prev) => (prev ? `${prev} • ${snippet}` : snippet))
                      }
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition text-left"
                    >
                      + {snippet}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note Textarea with Voice Dictation */}
              <div className="relative">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'কাজের বিবরণ, প্রয়োজনীয় যন্ত্রাংশ, পরিমাপ বা গ্রাহকের বিশেষ নির্দেশনা লিখুন... (অফলাইনেও কাজ করবে)'
                      : lang === 'hi'
                      ? 'कार्य विवरण, आवश्यक स्पेयर पार्ट्स, माप या ग्राहक के विशेष निर्देश लिखें... (ऑफ़लाइन भी काम करता है)'
                      : 'Record site inspection observations, measurements, spare parts needed, or customer requests... (works offline)'
                  }
                  rows={3}
                  className="w-full text-sm p-3 pr-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition resize-none"
                />

                {/* Voice speech-to-text dictation button */}
                <button
                  type="button"
                  onClick={handleToggleVoiceDictation}
                  title={
                    isListening
                      ? 'Listening... Click to stop'
                      : 'Speak note in English, Bengali, or Hindi'
                  }
                  className={`absolute right-3 bottom-3 w-8 h-8 rounded-lg flex items-center justify-center transition shadow-sm ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-slate-600'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] text-slate-400">
                  {newNoteText.length} {lang === 'bn' ? 'অক্ষর' : lang === 'hi' ? 'अक्षर' : 'characters'}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateAiDraft}
                    disabled={isPolishing || !isOnline}
                    className="px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
                    title="Generate professional completion note draft with Google Gemma 4 E4B"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${isPolishing ? 'animate-spin' : ''}`} />
                    <span>
                      {isPolishing
                        ? (lang === 'bn' ? 'এআই ড্রাফট হচ্ছে...' : lang === 'hi' ? 'एआई ड्राफ्ट हो रहा...' : 'Drafting...')
                        : (lang === 'bn' ? 'গেমা ৪ এআই ড্রাফট' : lang === 'hi' ? 'जेम्मा 4 एআই ड्राफ्ट' : 'AI Draft Completion Note')}
                    </span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving || !newNoteText.trim()}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl text-white flex items-center gap-2 shadow-md transition disabled:opacity-50 ${
                      !isOnline
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-teal-600 hover:bg-teal-700'
                    }`}
                  >
                    {!isOnline ? (
                      <>
                        <WifiOff className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'স্থানীয়ভাবে সংরক্ষণ করুন (অফলাইন)' : lang === 'hi' ? 'स्थानीय रूप से सहेजें (ऑफ़लाइन)' : 'Save Locally (Offline)'}</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'সংরক্ষণ ও সিঙ্ক করুন' : lang === 'hi' ? 'सहेजें और सिंक करें' : 'Save & Sync Note'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* AI Draft Result Panel */}
              {aiDraft && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/60 dark:bg-indigo-950/40 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                        {lang === 'bn' ? 'গেমা ৪ এআই সমাপ্তি নোট ড্রাফট' : lang === 'hi' ? 'जेम्मा 4 एआई समाप्ति नोट ड्राफ्ट' : 'Gemma 4 E4B Completion Note Draft'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                        {aiDraft.modelUsed}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAiDraft(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/60 leading-relaxed font-sans">
                    {aiDraft.polishedNote}
                  </p>

                  {aiDraft.safetyCheckCompleted && aiDraft.safetyCheckCompleted.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
                      <span className="font-semibold">{lang === 'bn' ? 'নিরাপত্তা যাচাই:' : lang === 'hi' ? 'सुरक्षा जांच:' : 'Safety checks:'}</span>
                      {aiDraft.safetyCheckCompleted.map((sc, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{sc}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setNewNoteText(aiDraft.polishedNote);
                        setSelectedCategory('Work Progress');
                      }}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'এই ড্রাফটটি ব্যবহার করুন' : lang === 'hi' ? 'इस ड्राफ्ट का उपयोग करें' : 'Use This Draft in Note'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </form>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Notes List for this Booking */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'bn' ? 'সংরক্ষিত নোটের ইতিহাস' : lang === 'hi' ? 'सहेजे गए नोट्स इतिहास' : 'Saved Notes for this Job'}
                  </span>
                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {notes.length}
                  </span>
                </h4>

                {notes.length > 0 && isOnline && bookingPendingCount > 0 && (
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                  >
                    <CloudUpload className="w-3 h-3" />
                    <span>{lang === 'bn' ? 'সিঙ্ক করুন' : lang === 'hi' ? 'सिंक करें' : 'Sync pending'}</span>
                  </button>
                )}
              </div>

              {notes.length === 0 ? (
                <div className="py-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {lang === 'bn'
                      ? 'এই কাজের জন্য এখনো কোনো নোট তৈরি করা হয়নি।'
                      : lang === 'hi'
                      ? 'इस कार्य के लिए अभी तक कोई नोट नहीं बनाया गया है।'
                      : 'No notes recorded for this job yet.'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    {lang === 'bn'
                      ? 'সাইট পরিদর্শন, পরিমাপ বা খুচরা যন্ত্রাংশের তথ্য উপরে লিখুন। অফলাইনেও তা সংরক্ষিত থাকবে।'
                      : lang === 'hi'
                      ? 'साइट निरीक्षण, माप या स्पेयर पार्ट्स की जानकारी ऊपर लिखें। यह ऑफ़लाइन भी सुरक्षित रहेगा।'
                      : 'Record site observations or parts above. Saved notes remain preserved on this device even without internet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notes.map((note) => {
                    const catObj = CATEGORIES.find((c) => c.label === note.category) || CATEGORIES[0];
                    return (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-md border font-medium flex items-center gap-1 ${catObj.color}`}
                            >
                              <span>{catObj.icon}</span>
                              <span>{note.category}</span>
                            </span>

                            {/* Sync Status Badge */}
                            {note.synced ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                <span>{lang === 'bn' ? 'সার্ভারে সিঙ্ক হয়েছে' : lang === 'hi' ? 'सर्वर से सिंक' : 'Synced to Server'}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                                <span>{lang === 'bn' ? 'অফলাইনে সংরক্ষিত (সিঙ্ক বাকি)' : lang === 'hi' ? 'ऑफ़लाइन सहेजा गया (सिंक लंबित)' : 'Saved Locally (Pending Sync)'}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-slate-400">
                            <span className="text-[10px]">
                              {new Date(note.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id)}
                              title="Delete note"
                              className="text-slate-400 hover:text-rose-500 p-1 rounded transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Note Body */}
                        <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                          {note.noteText}
                        </p>

                        {/* Worker and timestamp stamp */}
                        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <span>
                            {note.workerName} • {new Date(note.createdAt).toLocaleDateString()}
                          </span>
                          {note.syncedAt && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Synced: {new Date(note.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>
                {lang === 'bn'
                  ? 'অফলাইন ও অনলাইন উভয় মোডেই স্বয়ংক্রিয় ব্যাকআপ সক্ষম'
                  : lang === 'hi'
                  ? 'ऑफ़लाइन और ऑनलाइन दोनों मोड में स्वचालित बैकअप सक्षम'
                  : 'Automatic local storage & reconnection synchronization active'}
              </span>
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : lang === 'hi' ? 'बंद करें' : 'Close'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
