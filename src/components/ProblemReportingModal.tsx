import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Wrench,
  ShieldAlert,
  Clock,
  Eye,
  CheckSquare,
  Play,
  FileText,
  Info,
} from 'lucide-react';
import type {
  BookingRecord,
  ProblemReport,
  SupportedServiceCategory,
  UrgencyLevel,
} from '../types.ts';
import {
  type LanguageCode,
  translateProblemStatus,
  translateCategory,
} from '../i18n/translations.ts';

interface ProblemReportingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingRecord;
  existingReport?: ProblemReport | null;
  userRole: 'CUSTOMER' | 'WORKER' | 'ADMIN';
  token: string;
  onReportCreated?: (report: ProblemReport) => void;
  onReportUpdated?: (report: ProblemReport) => void;
  t: Record<string, string>;
  lang?: LanguageCode;
  isOnline: boolean;
}

export const ProblemReportingModal: React.FC<ProblemReportingModalProps> = ({
  isOpen,
  onClose,
  booking,
  existingReport: initialReport,
  userRole,
  token,
  onReportCreated,
  onReportUpdated,
  t,
  lang = 'en',
  isOnline,
}) => {
  const [report, setReport] = useState<ProblemReport | null>(initialReport || null);
  const [activeTab, setActiveTab] = useState<'details' | 'ai' | 'timeline'>('details');

  // Form states for creating a new report
  const [problemDescription, setProblemDescription] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('STANDARD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);
  const [compressing, setCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryingAi, setRetryingAi] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer counter for background AI inference progress
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (submitting || retryingAi || report?.aiAnalysisStatus === 'IN_PROGRESS') {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [submitting, retryingAi, report?.aiAnalysisStatus]);

  // Sync report when initialReport changes or when fetching
  useEffect(() => {
    if (initialReport) {
      setReport(initialReport);
      if (initialReport.aiAnalysis) {
        setActiveTab('ai');
      }
    } else {
      setReport(null);
      setProblemDescription(booking.problemDescription || '');
      setActiveTab('details');
    }
  }, [initialReport, booking]);

  // Clean up preview object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  // Compress image client-side to max 1280x1280 and <= 2 MB
  const handleCompressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }
        ctx.drawImage(img, 0, 0, width, height);

        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const compressedFile = new File([blob], file.name, {
              type: mime,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          mime,
          0.85
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormError(null);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setFormError(t.unsupportedMediaType || 'Unsupported format. Supported images: JPG, PNG, WebP. Supported videos: MP4, WebM.');
      return;
    }

    if (isImage) {
      setCompressing(true);
      try {
        let finalFile = file;
        // Compress if greater than 1 MB
        if (file.size > 1024 * 1024) {
          finalFile = await handleCompressImage(file);
        }
        if (finalFile.size > 2 * 1024 * 1024) {
          setFormError(t.mediaTooLargeImage || 'Image file exceeds the strict 2 MB limit. Please select a smaller photo.');
          setCompressing(false);
          return;
        }
        if (previewUrl && previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
        const objUrl = URL.createObjectURL(finalFile);
        setSelectedFile(finalFile);
        setPreviewUrl(objUrl);
        setMediaType('image');
        setVideoDuration(undefined);
      } catch (err) {
        console.warn('Image compression error:', err);
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setMediaType('image');
      } finally {
        setCompressing(false);
      }
    } else if (isVideo) {
      if (file.size > 5 * 1024 * 1024) {
        setFormError(t.mediaTooLargeVideo || 'Video file exceeds the strict 5 MB limit. Please record a shorter clip.');
        return;
      }
      // Inspect video duration via temporary video element
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      const objUrl = URL.createObjectURL(file);
      tempVideo.onloadedmetadata = () => {
        const duration = tempVideo.duration;
        if (duration > 10.5) {
          URL.revokeObjectURL(objUrl);
          setFormError(t.videoTooLong || `Video duration (${duration.toFixed(1)}s) exceeds the maximum 10 seconds limit.`);
          setSelectedFile(null);
          setPreviewUrl(null);
          setMediaType(null);
          return;
        }
        setSelectedFile(file);
        setPreviewUrl(objUrl);
        setMediaType('video');
        setVideoDuration(duration);
      };
      tempVideo.onerror = () => {
        // Fallback if browser can't inspect metadata
        setSelectedFile(file);
        setPreviewUrl(objUrl);
        setMediaType('video');
      };
      tempVideo.src = objUrl;
    }
  };

  const handleRemoveMedia = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setMediaType(null);
    setVideoDuration(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemDescription.trim() || problemDescription.trim().length < 5) {
      setFormError('Please enter a clear problem description of at least 5 characters.');
      return;
    }
    if (!isOnline) {
      setFormError('Network is offline. Submissions are paused until internet connection returns.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setUploadProgress('Compressing media & dispatching to server...');

    try {
      const formData = new FormData();
      formData.append('bookingId', booking.id);
      formData.append('problemDescription', problemDescription.trim());
      formData.append('serviceCategory', booking.workerCategory);
      formData.append('urgency', urgency);
      if (videoDuration) {
        formData.append('videoDuration', String(videoDuration));
      }
      if (selectedFile) {
        formData.append('media', selectedFile);
      }

      const res = await fetch('/api/problem-reports', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit problem report.');
      }

      setReport(data.report);
      setActiveTab('ai');
      onReportCreated?.(data.report);
      handleRemoveMedia();
    } catch (err: any) {
      setFormError(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleRetryAi = async () => {
    if (!report || retryingAi) return;
    setRetryingAi(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/problem-reports/${report.id}/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI analysis retry failed.');
      }
      setReport(data.report);
      onReportUpdated?.(data.report);
    } catch (err: any) {
      setFormError(err.message || 'AI retry failed.');
    } finally {
      setRetryingAi(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!report || statusUpdating) return;
    setStatusUpdating(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/problem-reports/${report.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          note: `Status updated by ${userRole}.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update report status.');
      }
      setReport(data.report);
      onReportUpdated?.(data.report);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t.problemReportingTitle || 'Defect & Problem Reporting'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                  {booking.bookingReference}
                </span>
                <span>•</span>
                <span>{translateCategory(booking.workerCategory, lang)}</span>
                <span>•</span>
                <span>{booking.workerName}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (if report already exists) */}
        {report && (
          <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex gap-2 bg-slate-50/40 dark:bg-slate-900/40">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'details'
                  ? 'border-teal-700 text-teal-800 dark:text-teal-300'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Report Details & Media
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 cursor-pointer flex items-center gap-1.5 transition-colors ${
                activeTab === 'ai'
                  ? 'border-teal-700 text-teal-800 dark:text-teal-300'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span>Gemma 4 AI Diagnosis</span>
              {report.aiAnalysis && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'timeline'
                  ? 'border-teal-700 text-teal-800 dark:text-teal-300'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Status History ({report.statusHistory?.length || 1})
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {formError && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* VIEW 1: NEW REPORT CREATION FORM (when customer hasn't submitted yet) */}
          {!report ? (
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.problemReportSubtitle ||
                  'Upload defect photo (max 2 MB) or short video (max 5 MB / 10s) for Gemma 4 AI analysis and worker dispatch.'}
              </p>

              {/* Service Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Service Category
                </label>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200">
                  {translateCategory(booking.workerCategory, lang)} ({booking.workerName})
                </div>
              </div>

              {/* Problem Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.problemDescLabel || 'Problem Description & Visible Symptoms'} *
                </label>
                <textarea
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  rows={3}
                  required
                  placeholder={
                    t.problemDescPlaceholder ||
                    'Describe what broke, leaks, makes noise, or requires repair...'
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:border-teal-700 placeholder-slate-400"
                />
              </div>

              {/* Urgency Level */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t.urgencyLevelLabel || 'Urgency Level'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUrgency('STANDARD')}
                    className={`p-2.5 rounded-xl border text-xs text-left cursor-pointer transition-all ${
                      urgency === 'STANDARD'
                        ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="block font-bold">Standard</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Regular visit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrgency('PRIORITY')}
                    className={`p-2.5 rounded-xl border text-xs text-left cursor-pointer transition-all ${
                      urgency === 'PRIORITY'
                        ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="block font-bold">Priority (+₹50)</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Expedite dispatch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrgency('EMERGENCY')}
                    className={`p-2.5 rounded-xl border text-xs text-left cursor-pointer transition-all ${
                      urgency === 'EMERGENCY'
                        ? 'border-red-600 bg-red-50 dark:bg-red-950/40 text-red-950 dark:text-red-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="block font-bold">Emergency (+₹150)</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Rapid response</span>
                  </button>
                </div>
              </div>

              {/* Media Upload (Images <= 2MB, Videos <= 5MB max 10s) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t.uploadMediaLabel || 'Attach Defect Photo or Short Video'}
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                  {t.uploadMediaHelp ||
                    'Images: JPG/PNG/WebP (max 2 MB, auto-compressed to 1280x1280). Videos: MP4/WebM (max 5 MB, max 10s duration).'}
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!previewUrl ? (
                  <button
                    type="button"
                    disabled={compressing}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-600 dark:hover:border-teal-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {compressing ? (
                      <>
                        <RefreshCw className="w-6 h-6 animate-spin text-teal-700 dark:text-teal-400" />
                        <span className="text-xs font-medium">
                          {t.compressingImageMsg || 'Compressing image for fast upload...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center text-teal-800 dark:text-teal-300">
                          <Upload className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                        </div>
                        <span className="text-xs font-semibold">
                          {t.selectFileBtn || 'Choose Photo / Video'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Photos ≤ 2 MB • Videos ≤ 5 MB (10s max)
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {mediaType === 'image' ? (
                          <ImageIcon className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                        ) : (
                          <VideoIcon className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                          {selectedFile?.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {selectedFile && `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`}
                          {videoDuration ? ` • ${videoDuration.toFixed(1)}s` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveMedia}
                        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-medium cursor-pointer"
                      >
                        {t.removeMediaBtn || 'Remove'}
                      </button>
                    </div>

                    <div className="rounded-xl overflow-hidden bg-black/5 dark:bg-black/30 max-h-56 flex items-center justify-center">
                      {mediaType === 'image' ? (
                        <img
                          src={previewUrl}
                          alt="Defect preview"
                          className="max-h-56 object-contain rounded-lg"
                        />
                      ) : (
                        <video
                          src={previewUrl}
                          controls
                          className="max-h-56 rounded-lg w-full"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Progress notice */}
              {uploadProgress && (
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-800 dark:text-teal-300 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-700 dark:text-teal-400 shrink-0" />
                  <span>{uploadProgress}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || compressing || !problemDescription.trim()}
                  className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer shadow-2xs active:scale-98 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{t.submittingReportBtn || 'Uploading & Submitting...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t.submitProblemReportBtn || 'Submit Problem Report'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* VIEW 2: EXISTING REPORT DETAILS, GEMMA 4 ANALYSIS & WORKER WORKFLOW */
            <div className="space-y-5">
              {/* Status Header Banner */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block">
                    CURRENT REPORT STATUS
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-teal-100 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200">
                      {translateProblemStatus(report.status, lang)}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(report.createdAt).toLocaleDateString()} at{' '}
                      {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Worker Progression Actions */}
                {userRole === 'WORKER' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {['Submitted', 'Analysis Ready', 'Worker Notified'].includes(report.status) && (
                      <button
                        type="button"
                        disabled={statusUpdating}
                        onClick={() => handleUpdateStatus('Problem Viewed')}
                        className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                      >
                        {statusUpdating ? 'Updating...' : t.workerAcknowledgeBtn || 'Acknowledge & View'}
                      </button>
                    )}
                    {report.status === 'Problem Viewed' && (
                      <button
                        type="button"
                        disabled={statusUpdating}
                        onClick={() => handleUpdateStatus('Preparation Complete')}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                      >
                        {statusUpdating ? 'Updating...' : t.workerPrepCompleteBtn || 'Mark Preparation Complete'}
                      </button>
                    )}
                    {report.status === 'Preparation Complete' && (
                      <button
                        type="button"
                        disabled={statusUpdating}
                        onClick={() => handleUpdateStatus('Work Started')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                      >
                        {statusUpdating ? 'Updating...' : t.workerStartWorkBtn || 'Start Work on Site'}
                      </button>
                    )}
                    {['Work Started', 'Work In Progress'].includes(report.status) && (
                      <button
                        type="button"
                        disabled={statusUpdating}
                        onClick={() => handleUpdateStatus('Work Completed')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                      >
                        {statusUpdating ? 'Updating...' : t.workerFinishWorkBtn || 'Mark Work Completed'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* TAB 1: DETAILS & MEDIA */}
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Customer Problem Description
                    </span>
                    <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                      {report.problemDescription}
                    </p>
                    <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Urgency: <strong className="text-slate-700 dark:text-slate-300">{report.urgency}</strong></span>
                      <span>Category: <strong className="text-slate-700 dark:text-slate-300">{report.serviceCategory}</strong></span>
                      <span>Assigned: <strong className="text-slate-700 dark:text-slate-300">{report.assignedWorkerName}</strong></span>
                    </div>
                  </div>

                  {/* Attached Media */}
                  {report.media ? (
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          {report.media.resourceType === 'image' ? (
                            <ImageIcon className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                          ) : (
                            <VideoIcon className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                          )}
                          Attached {report.media.resourceType === 'image' ? 'Defect Image' : 'Video Clip'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {(report.media.bytes / (1024 * 1024)).toFixed(2)} MB • {report.media.storageProvider}
                        </span>
                      </div>

                      <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center max-h-72">
                        {report.media.resourceType === 'image' ? (
                          <div className="relative group cursor-pointer w-full flex justify-center" onClick={() => setZoomedImage(report.media!.secureUrl)}>
                            <img
                              src={report.media.secureUrl}
                              alt="Defect proof"
                              className="max-h-72 object-contain rounded-lg transition-transform group-hover:scale-101"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs font-semibold flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" /> Click to Zoom
                              </span>
                            </div>
                          </div>
                        ) : (
                          <video
                            src={report.media.secureUrl}
                            controls
                            className="max-h-72 w-full rounded-lg"
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500">
                      No photo or video was attached with this report.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: GEMMA 4 AI DIAGNOSIS */}
              {activeTab === 'ai' && (
                <div className="space-y-4">
                  {(report.aiAnalysisStatus === 'IN_PROGRESS' || retryingAi) && (
                    <div className="p-6 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-center space-y-3">
                      <RefreshCw className="w-7 h-7 animate-spin text-teal-700 dark:text-teal-400 mx-auto" />
                      <div>
                        <p className="text-sm font-bold text-teal-950 dark:text-teal-100">
                          {t.aiAnalysisPending || 'Gemma 4 Technical AI Diagnosis Running...'}
                        </p>
                        <p className="text-xs text-teal-800 dark:text-teal-300 mt-1">
                          Analyzing defect characteristics, electrical/plumbing safety, and tooling ({elapsedSeconds}s elapsed).
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono bg-teal-100 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200">
                        <span className="w-2 h-2 rounded-full bg-teal-600 animate-ping inline-block" />
                        <span>Extended 45s Timeout Active • Structured JSON Schema</span>
                      </div>
                    </div>
                  )}

                  {report.aiAnalysisStatus === 'FAILED' && !retryingAi && (
                    <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-sm font-bold text-amber-950 dark:text-amber-100">
                            AI Diagnosis Request Not Completed
                          </strong>
                          <p className="text-xs text-amber-900 dark:text-amber-200 mt-0.5">
                            {report.aiAnalysisError ||
                              'Inference could not complete within the allotted time. All reported details and photos are saved securely on the server.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={retryingAi || submitting}
                          onClick={handleRetryAi}
                          className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${retryingAi ? 'animate-spin' : ''}`} />
                          <span>{retryingAi ? 'Retrying Diagnosis...' : 'Retry Gemma 4 Diagnosis'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {report.aiAnalysis && (
                    <div className="space-y-4">
                      {/* Model & Header Banner */}
                      <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                          <span>{t.gemmaAiAnalysisTitle || 'Gemma 4 Technical AI Diagnosis'}</span>
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                          <span className="text-slate-400">Model:</span>
                          <span className="px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 font-bold">
                            {report.aiAnalysis.modelUsed}
                          </span>
                        </div>
                      </div>

                      {/* Photo & "Gemma saw" — Displayed strictly ONCE beside the photo */}
                      <div className="p-4 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                          {/* Left: Defect Photo thumbnail with click-to-zoom */}
                          {report.media && report.media.resourceType === 'image' ? (
                            <div
                              className="relative group cursor-pointer rounded-xl overflow-hidden bg-black/5 dark:bg-black/30 max-h-56 flex items-center justify-center border border-slate-200 dark:border-slate-700"
                              onClick={() => setZoomedImage(report.media!.secureUrl)}
                            >
                              <img
                                src={report.media.secureUrl}
                                alt="Inspected Defect"
                                className="max-h-56 object-contain rounded-lg transition-transform group-hover:scale-101"
                              />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="px-2.5 py-1 rounded-lg bg-black/70 text-white text-[11px] font-semibold flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" /> Click to Zoom
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs text-slate-500 flex flex-col items-center justify-center min-h-[140px]">
                              <FileText className="w-6 h-6 text-slate-400 mb-1" />
                              <span>Text-Guided Technical Inspection</span>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5">{booking.bookingReference}</span>
                            </div>
                          )}

                          {/* Right: "Gemma saw" (Displayed strictly ONCE) */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-teal-950 dark:text-teal-100 font-bold text-xs">
                              <Eye className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                              <span>{t.gemmaSawTitle || 'Gemma saw'}</span>
                            </div>
                            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                              {report.aiAnalysis.gemmaSaw || report.aiAnalysis.summary}
                            </p>
                            {report.aiAnalysis.gemmaSawRegional && lang !== 'en' && (
                              <p className="text-xs text-teal-800 dark:text-teal-300 font-sans border-t border-teal-200/50 dark:border-teal-900/50 pt-1.5">
                                {report.aiAnalysis.gemmaSawRegional}
                              </p>
                            )}
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 pt-1 font-mono">
                              <span>Engine: {report.aiAnalysis.modelUsed}</span>
                              <span>•</span>
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Verified Analysis</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Clarification Questions (if ambiguous or incomplete — no fabrication) */}
                      {report.aiAnalysis.clarificationQuestions && report.aiAnalysis.clarificationQuestions.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-amber-950 dark:text-amber-100 font-bold text-xs">
                            <Info className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                            <span>Clarification Needed Before On-Site Work (No Guessing)</span>
                          </div>
                          <p className="text-[11px] text-amber-900 dark:text-amber-200 italic">
                            To ensure factual accuracy without fabricating damages, Gemma 4 requests confirmation of these points:
                          </p>
                          <ul className="space-y-1 text-xs text-slate-800 dark:text-slate-200 list-disc pl-5">
                            {report.aiAnalysis.clarificationQuestions.map((q, idx) => (
                              <li key={idx} className="font-medium">{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 1. Visible Problem Summary (Bilingual) */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                        <strong className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                          {t.aiSummaryHeading || 'Visible Problem Summary'}
                        </strong>
                        <p className="text-xs text-slate-800 dark:text-slate-200">
                          {report.aiAnalysis.summary}
                        </p>
                        {report.aiAnalysis.summaryRegional && lang !== 'en' && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-1 mt-1 font-sans">
                            {report.aiAnalysis.summaryRegional}
                          </p>
                        )}
                      </div>

                      {/* 2. Calculated Repair Estimate & Validated Parts from ~60 Catalogue */}
                      {report.aiAnalysis.repairEstimate && (
                        <div className="p-4 rounded-xl border border-teal-300 dark:border-teal-800 bg-linear-to-r from-teal-50/90 to-emerald-50/60 dark:from-slate-850 dark:to-teal-950/30 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200 dark:border-teal-800/60 pb-2">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-teal-950 dark:text-teal-100">
                              <Wrench className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                              <span>Estimated Repair Cost Range & Labour Breakdown</span>
                            </div>
                            <div className="font-mono text-sm font-extrabold text-teal-800 dark:text-teal-300">
                              ₹{report.aiAnalysis.repairEstimate.minEstimatedTotalInr} – ₹{report.aiAnalysis.repairEstimate.maxEstimatedTotalInr}
                            </div>
                          </div>

                          {/* Validated Parts from Local Catalogue */}
                          {report.aiAnalysis.validatedParts && report.aiAnalysis.validatedParts.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                Validated Catalogue Parts (Fixed Standard Rates)
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {report.aiAnalysis.validatedParts.map((p) => (
                                  <div key={p.id} className="p-2 rounded-lg bg-white/80 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div className="truncate pr-2">
                                      <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">{p.name}</span>
                                      <span className="text-[10px] text-slate-400">{p.category} · {p.quantity} {p.unit}</span>
                                    </div>
                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 shrink-0">
                                      ₹{p.totalPriceInr}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Pricing Breakdown Rows */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs border-t border-teal-200/60 dark:border-teal-800/40">
                            <div>
                              <span className="text-slate-500 text-[10px] block">Base Labour:</span>
                              <strong className="text-slate-800 dark:text-slate-200 font-mono">₹{report.aiAnalysis.repairEstimate.baseLaborInr}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block">Materials Total:</span>
                              <strong className="text-slate-800 dark:text-slate-200 font-mono">₹{report.aiAnalysis.repairEstimate.materialsTotalInr}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block">Urgency Surcharge:</span>
                              <strong className="text-slate-800 dark:text-slate-200 font-mono">+₹{report.aiAnalysis.repairEstimate.urgencySurchargeInr}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block">90:10 Worker Share:</span>
                              <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                                ₹{report.aiAnalysis.repairEstimate.workerShareMinInr}–₹{report.aiAnalysis.repairEstimate.workerShareMaxInr}
                              </strong>
                            </div>
                          </div>

                          <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                            * {report.aiAnalysis.repairEstimate.pricingRuleExplanation}
                          </p>
                        </div>
                      )}

                      {/* 3. Possible Causes (Clearly labelled as possibilities) */}
                      <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <strong className="text-xs font-bold text-amber-950 dark:text-amber-100">
                            {t.aiCausesHeading || 'Possible Causes (Possibilities Only)'}
                          </strong>
                        </div>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 italic">
                          * Note: These are technical possibilities only. Component damage is never confirmed without on-site testing.
                        </p>
                        <ul className="space-y-1.5 text-xs text-slate-800 dark:text-slate-200 list-disc pl-5">
                          {report.aiAnalysis.possibleCauses.map((cause, i) => (
                            <li key={i}>{cause}</li>
                          ))}
                        </ul>
                      </div>

                      {/* 4. Recommended Inspection Steps for Worker */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                        <strong className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                          {t.aiInspectionHeading || 'Recommended Inspection Steps for Worker'}
                        </strong>
                        <ol className="space-y-1.5 text-xs text-slate-800 dark:text-slate-200 list-decimal pl-5">
                          {report.aiAnalysis.recommendedInspectionSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      {/* 5. Diagnostic Tools */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                          <Wrench className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                          <span>Suggested Diagnostic Tools</span>
                        </div>
                        <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                          {report.aiAnalysis.suggestedTools.map((tool, i) => (
                            <li key={i}>{tool}</li>
                          ))}
                        </ul>
                      </div>

                      {/* 6. Safety Precautions (Bilingual, high visibility) */}
                      <div className="p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/40 border border-red-300 dark:border-red-800 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-red-900 dark:text-red-200 font-bold text-xs">
                          <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                          <span>{t.aiSafetyHeading || 'Safety Precautions'}</span>
                        </div>
                        <ul className="space-y-1 text-xs text-red-950 dark:text-red-200 list-disc pl-5">
                          {report.aiAnalysis.safetyPrecautions.map((safe, i) => (
                            <li key={i} className="font-medium">{safe}</li>
                          ))}
                        </ul>
                        {report.aiAnalysis.safetyPrecautionsRegional && lang !== 'en' && (
                          <div className="pt-1.5 border-t border-red-200/60 dark:border-red-900/60 space-y-0.5">
                            {report.aiAnalysis.safetyPrecautionsRegional.map((safeReg, i) => (
                              <p key={i} className="text-xs text-red-900 dark:text-red-200 font-sans">• {safeReg}</p>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 7. Pre-Repair Customer Verification */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                        <strong className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          {t.aiPreVerifyHeading || 'Pre-Repair Customer Verification'}
                        </strong>
                        <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                          {report.aiAnalysis.workerPreVerification.map((ver, i) => (
                            <li key={i}>{ver}</li>
                          ))}
                        </ul>
                      </div>

                      {/* 8. Uncertainty Note */}
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                        <strong className="text-slate-700 dark:text-slate-300 block">
                          {t.aiUncertaintyHeading || 'Diagnosis Uncertainty Note'}
                        </strong>
                        <p>{report.aiAnalysis.uncertaintyNote}</p>
                      </div>

                      {/* Retry Analysis Button */}
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={retryingAi}
                          onClick={handleRetryAi}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${retryingAi ? 'animate-spin' : ''}`} />
                          <span>{retryingAi ? 'Refreshing Analysis...' : 'Re-run Gemma 4 Analysis'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: TIMELINE HISTORY */}
              {activeTab === 'timeline' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Status Audit Trail
                  </span>
                  <div className="space-y-2">
                    {report.statusHistory?.map((h, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3 text-xs"
                      >
                        <div className="w-2 h-2 rounded-full bg-teal-600 dark:bg-teal-400 shrink-0 mt-1.5" />
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <strong className="text-slate-900 dark:text-slate-100 font-bold">
                              {translateProblemStatus(h.status, lang)}
                            </strong>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            By {h.updatedBy} ({h.updatedByRole})
                          </p>
                          {h.note && (
                            <p className="text-xs text-slate-700 dark:text-slate-300 pt-0.5">
                              {h.note}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-500">
          <span>{isOnline ? 'Online • Real-Time Synchronization Active' : 'Offline • Local Cache'}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* High-res Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={zoomedImage}
              alt="Zoomed Defect"
              className="max-h-[88vh] object-contain rounded-xl shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
