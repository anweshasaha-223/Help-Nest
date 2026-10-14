import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  QrCode,
  Banknote,
  Camera,
  CameraOff,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Copy,
  Info,
  Clock,
  Sparkles,
  Download,
  Smartphone,
  ScanLine,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import type { BookingRecord } from '../types';
import { type LanguageCode, translateCategory } from '../i18n/translations';

interface DemoPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingRecord;
  userRole: 'CUSTOMER' | 'WORKER' | 'ADMIN';
  token: string;
  onPaymentSuccess: (updatedBooking: BookingRecord, message: string) => void;
  lang?: LanguageCode;
}

interface ParsedUpiData {
  pa?: string; // Payee address
  pn?: string; // Payee name
  am?: string; // Amount
  tr?: string; // Transaction reference
  cu?: string; // Currency
}

export const DemoPaymentModal: React.FC<DemoPaymentModalProps> = ({
  isOpen,
  onClose,
  booking,
  userRole,
  token,
  onPaymentSuccess,
  lang = 'en',
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH'>('UPI');
  const [upiSubTab, setUpiSubTab] = useState<'display_qr' | 'scan_camera' | 'manual_id'>('display_qr');
  const [upiIdInput, setUpiIdInput] = useState<string>('helpnest.cooperative@oksbi');
  const [parsedUpiData, setParsedUpiData] = useState<ParsedUpiData | null>(null);

  // Generated Demo QR code Data URL
  const [demoQrDataUrl, setDemoQrDataUrl] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState<boolean>(false);

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [cameraPermissionState, setCameraPermissionState] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'
  >('idle');
  const [hasScannedOnce, setHasScannedOnce] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successTxnRef, setSuccessTxnRef] = useState<string | null>(null);
  const [copiedTxn, setCopiedTxn] = useState(false);
  const [copiedUpiUri, setCopiedUpiUri] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'helpnest-qr-reader-container';

  // 90:10 precise integer-safe calculation
  const totalAmountInr = booking.amountInr;
  const workerEarningsInr = Math.round(totalAmountInr * 0.9);
  const welfareContributionInr = totalAmountInr - workerEarningsInr;

  // Canonical standard UPI URI format for Demo QR code
  const demoUpiUri = `upi://pay?pa=helpnest.cooperative@demo&pn=${encodeURIComponent(
    booking.workerName || 'HelpNest Cooperative'
  )}&am=${totalAmountInr}&cu=INR&tn=${encodeURIComponent(
    `Demo Service Payment ${booking.bookingReference}`
  )}`;

  // Generate demo QR code whenever modal opens with booking
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setGeneratingQr(true);

    QRCode.toDataURL(
      demoUpiUri,
      {
        width: 260,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      },
      (err, url) => {
        if (!isMounted) return;
        setGeneratingQr(false);
        if (err) {
          console.warn('Failed to generate demo QR code:', err);
        } else {
          setDemoQrDataUrl(url);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [isOpen, demoUpiUri]);

  // Cleanup scanner on unmount or close
  const stopScanner = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Failed to stop scanner cleanly:', err);
      } finally {
        html5QrCodeRef.current = null;
        setIsScanning(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            html5QrCodeRef.current?.clear();
            html5QrCodeRef.current = null;
          });
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannerError(null);
      setErrorMessage(null);
      setSuccessTxnRef(null);
      setHasScannedOnce(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Parse UPI URI (e.g. upi://pay?pa=worker@okaxis&pn=WorkerName&am=500&cu=INR)
  const parseUpiUri = (text: string): ParsedUpiData | null => {
    const trimmed = text.trim();
    if (trimmed.startsWith('upi://pay')) {
      try {
        const url = new URL(trimmed);
        const pa = url.searchParams.get('pa') || undefined;
        const pn = url.searchParams.get('pn') || undefined;
        const am = url.searchParams.get('am') || undefined;
        const tr = url.searchParams.get('tr') || undefined;
        const cu = url.searchParams.get('cu') || undefined;
        return { pa, pn, am, tr, cu };
      } catch {
        const params: Record<string, string> = {};
        const query = trimmed.split('?')[1] || '';
        query.split('&').forEach((pair) => {
          const [k, v] = pair.split('=');
          if (k && v) params[k.toLowerCase()] = decodeURIComponent(v);
        });
        return {
          pa: params.pa,
          pn: params.pn,
          am: params.am,
          tr: params.tr,
          cu: params.cu,
        };
      }
    }

    // Direct UPI ID format: username@bank
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (upiRegex.test(trimmed)) {
      return { pa: trimmed, pn: booking.workerName };
    }

    return null;
  };

  const handleStartScanner = async () => {
    setScannerError(null);
    setCameraPermissionState('requesting');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraPermissionState('unsupported');
        setScannerError(
          'Camera access is not supported by your browser or environment. You can view the Demo QR Code or enter UPI ID manually.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        stream.getTracks().forEach((t) => t.stop());
        setCameraPermissionState('granted');
      } catch (permErr: any) {
        if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
          setCameraPermissionState('denied');
          setScannerError(
            'Camera permission was not granted. You can still scan the Demo QR Code from another device, or enter UPI ID manually.'
          );
          return;
        }
      }

      const qrScanner = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrCodeRef.current = qrScanner;

      await qrScanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          const parsed = parseUpiUri(decodedText);
          if (parsed && parsed.pa) {
            setParsedUpiData(parsed);
            setUpiIdInput(parsed.pa);
            setHasScannedOnce(true);
            setScannerError(null);
            stopScanner();
          } else {
            setScannerError(
              `Scanned QR is not recognized as a valid UPI address ("${decodedText.slice(
                0,
                30
              )}..."). Validated format requires upi://pay or name@bank.`
            );
          }
        },
        () => {
          // Frame parse failure - silent per html5-qrcode standard
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      setCameraPermissionState('denied');
      setScannerError(
        err?.message ||
          'Could not initialize camera scanner. You can display the Demo QR Code or enter the UPI ID manually.'
      );
      setIsScanning(false);
    }
  };

  const handleConfirmDemoPayment = async () => {
    if (isSubmitting) return;

    if (booking.paymentStatus === 'PAID') {
      setErrorMessage('This booking has already been settled. Duplicate payments are blocked.');
      return;
    }

    if (paymentMethod === 'UPI') {
      const trimmedUpi = upiIdInput.trim();
      if (!trimmedUpi || !trimmedUpi.includes('@')) {
        setErrorMessage('Please provide or scan a valid UPI ID (e.g. worker@bank or helpnest.cooperative@demo).');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const generatedTxnRef =
      paymentMethod === 'UPI'
        ? `DEMO_UPI_TXN_${Date.now().toString().slice(-8)}_${booking.bookingReference.replace(/[^a-zA-Z0-9]/g, '')}`
        : `DEMO_CASH_TXN_${Date.now().toString().slice(-8)}_${booking.bookingReference.replace(/[^a-zA-Z0-9]/g, '')}`;

    try {
      const res = await fetch(`/api/bookings/${booking.id}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: booking.razorpayOrderId || `order_demo_${Date.now()}`,
          paymentMethod: paymentMethod === 'CASH' ? 'CASH (DEMO)' : 'UPI (DEMO)',
          transactionRef: generatedTxnRef,
          upiId: paymentMethod === 'UPI' ? upiIdInput : undefined,
          workerSharePercent: 90,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Payment confirmation failed.');
      }

      setSuccessTxnRef(generatedTxnRef);
      onPaymentSuccess(
        data.booking || {
          ...booking,
          paymentStatus: 'PAID',
          paymentMethod: paymentMethod === 'CASH' ? 'CASH (DEMO)' : 'UPI (DEMO)',
          razorpayPaymentId: generatedTxnRef,
          workerShareInr: workerEarningsInr,
          welfareShareInr: welfareContributionInr,
        },
        data.message || `Demo payment of ₹${totalAmountInr} confirmed via ${paymentMethod}.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error confirming demo payment. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTxnRef = () => {
    if (!successTxnRef) return;
    navigator.clipboard?.writeText(successTxnRef);
    setCopiedTxn(true);
    setTimeout(() => setCopiedTxn(false), 2000);
  };

  const copyUpiUri = () => {
    navigator.clipboard?.writeText(demoUpiUri);
    setCopiedUpiUri(true);
    setTimeout(() => setCopiedUpiUri(false), 2000);
  };

  const handleDownloadInvoice = async () => {
    try {
      const res = await fetch(`/api/bookings/${booking.id}/invoice`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 flex items-center justify-center font-bold shrink-0">
              {paymentMethod === 'UPI' ? (
                <QrCode className="w-5 h-5 text-teal-700 dark:text-teal-300" />
              ) : (
                <Banknote className="w-5 h-5 text-teal-700 dark:text-teal-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {successTxnRef ? 'Payment Receipt — Verified' : 'Complete Job Payment'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  DEMO MODE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cooperative Fair 90:10 Settlement Simulation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Mode Notice Banner */}
        <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Demonstration Simulation:</span>
            <p className="text-[11px] text-amber-850 dark:text-amber-300">
              No real money is charged or transferred. All QR codes and cash transactions are simulated for testing the cooperative ledger. UPI PIN is never requested.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* SUCCESS RECEIPT VIEW */}
        {successTxnRef ? (
          <div className="space-y-4 py-2">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Demo Payment Successfully Confirmed!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Settled on cooperative ledger for booking{' '}
                <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                  {booking.bookingReference}
                </span>
                .
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Demo Transaction Ref:</span>
                <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                  <span>{successTxnRef}</span>
                  <button
                    type="button"
                    onClick={copyTxnRef}
                    title="Copy reference"
                    className="p-1 hover:text-teal-700 cursor-pointer"
                  >
                    {copiedTxn ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Worker & Category:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {booking.workerName} ({translateCategory(booking.workerCategory, lang)})
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Payment Mode:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {paymentMethod === 'UPI' ? 'UPI (Demo Simulation)' : 'Cash (Demo Hand-off)'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 text-sm font-bold border-b border-slate-200 dark:border-slate-700">
                <span>Total Amount Settled:</span>
                <span className="font-mono text-slate-900 dark:text-slate-100">₹{totalAmountInr}.00</span>
              </div>

              <div className="flex justify-between py-1 text-emerald-800 dark:text-emerald-400 font-medium">
                <span>Worker Share (90% Net):</span>
                <span className="font-mono font-bold">₹{workerEarningsInr}.00</span>
              </div>

              <div className="flex justify-between py-1 text-teal-800 dark:text-teal-400 font-medium">
                <span>Cooperative Welfare Fund (10%):</span>
                <span className="font-mono font-bold">₹{welfareContributionInr}.00</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadInvoice}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Tax Invoice (PDF)</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer shadow-xs transition-colors"
              >
                Done & Return to Bookings
              </button>
            </div>
          </div>
        ) : (
          /* PAYMENT ENTRY & INTERACTIVE FLOW */
          <div className="space-y-4">
            {/* Primary Mode Selector: UPI vs Cash */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                Choose Payment Option:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('UPI');
                    setErrorMessage(null);
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer flex flex-col justify-between ${
                    paymentMethod === 'UPI'
                      ? 'border-teal-700 dark:border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 font-semibold ring-2 ring-teal-700/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <QrCode className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    <span>UPI Payment — Demo</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Display Demo QR Code or Scan with Camera
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('CASH');
                    stopScanner();
                    setErrorMessage(null);
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer flex flex-col justify-between ${
                    paymentMethod === 'CASH'
                      ? 'border-teal-700 dark:border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 font-semibold ring-2 ring-teal-700/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <Banknote className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    <span>Cash Payment — Demo</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Direct cash to worker on service delivery
                  </div>
                </button>
              </div>
            </div>

            {/* UPI SECTION: CLEAR SEPARATION OF (A) DISPLAY DEMO QR CODE vs (B) SCAN CAMERA */}
            {paymentMethod === 'UPI' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-3.5">
                {/* Clear Sub-Tabs distinguishing the QR Display from the QR Scanner */}
                <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      stopScanner();
                      setUpiSubTab('display_qr');
                      setErrorMessage(null);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      upiSubTab === 'display_qr'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                    <span>Display Demo QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUpiSubTab('scan_camera');
                      setErrorMessage(null);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      upiSubTab === 'scan_camera'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <ScanLine className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                    <span>Scan with Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopScanner();
                      setUpiSubTab('manual_id');
                      setErrorMessage(null);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      upiSubTab === 'manual_id'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>UPI ID Input</span>
                  </button>
                </div>

                {/* FEATURE 5.B: DISPLAY DEMO QR CODE (Can be scanned by another phone or camera) */}
                {upiSubTab === 'display_qr' && (
                  <div className="space-y-3 pt-1 text-center">
                    <div className="relative inline-block mx-auto p-4 bg-white rounded-2xl border-2 border-dashed border-teal-500/70 shadow-sm">
                      {generatingQr ? (
                        <div className="w-[220px] h-[220px] flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                          <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
                          <span>Generating Demo QR...</span>
                        </div>
                      ) : demoQrDataUrl ? (
                        <div className="relative">
                          <img
                            src={demoQrDataUrl}
                            alt="HelpNest Demo UPI QR Code"
                            className="w-[220px] h-[220px] object-contain rounded-lg mx-auto"
                          />
                          {/* Centered Watermark Badge */}
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 border border-amber-400 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold text-amber-900 shadow-xs pointer-events-none">
                            DEMO QR
                          </div>
                        </div>
                      ) : (
                        <div className="w-[220px] h-[220px] flex items-center justify-center text-slate-400 text-xs">
                          QR generation unavailable
                        </div>
                      )}

                      <div className="mt-2 text-[11px] font-mono font-bold text-slate-800 bg-slate-100 py-1 px-2 rounded-lg">
                        ₹{totalAmountInr}.00 · {booking.workerName}
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        Scan from another device with any UPI or Camera App
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Target VPA: <code className="font-mono text-teal-700 dark:text-teal-400 font-semibold">helpnest.cooperative@demo</code>
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={copyUpiUri}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
                      >
                        {copiedUpiUri ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copied UPI Intent String!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy UPI Intent String</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* FEATURE 5.A: SCAN UPI QR WITH THIS DEVICE'S CAMERA */}
                {upiSubTab === 'scan_camera' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <Camera className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                        <span>Live Device Camera QR Scanner</span>
                      </div>
                      {!isScanning ? (
                        <button
                          type="button"
                          onClick={handleStartScanner}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Start Camera Scanner</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopScanner}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          <CameraOff className="w-3.5 h-3.5" />
                          <span>Stop Scanner</span>
                        </button>
                      )}
                    </div>

                    {/* Html5Qrcode Scanner DOM Container */}
                    <div
                      id={scannerContainerId}
                      className={`w-full overflow-hidden rounded-xl bg-black border border-slate-300 dark:border-slate-700 transition-all ${
                        isScanning ? 'min-h-[220px]' : 'hidden'
                      }`}
                    />

                    {!isScanning && (
                      <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 text-center space-y-1.5">
                        <Camera className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                          Click "Start Camera Scanner" to point your camera at an existing UPI QR code.
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Supports UPI QR codes from Google Pay, PhonePe, Paytm, or any standard Bharat QR.
                        </p>
                      </div>
                    )}

                    {scannerError && (
                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <span>{scannerError}</span>
                      </div>
                    )}

                    {hasScannedOnce && parsedUpiData && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Verified Payee VPA: <strong>{parsedUpiData.pa}</strong>{' '}
                          {parsedUpiData.pn ? `(${parsedUpiData.pn})` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* MANUAL UPI ID INPUT */}
                {upiSubTab === 'manual_id' && (
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Cooperative VPA / UPI ID:
                    </label>
                    <input
                      type="text"
                      value={upiIdInput}
                      onChange={(e) => {
                        setUpiIdInput(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder="e.g. helpnest.cooperative@oksbi or worker@bank"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:border-teal-700"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Any standard handle format (e.g. username@bank) is accepted for evaluation.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* CASH PAYMENT INFO */}
            {paymentMethod === 'CASH' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-sm">
                  <Banknote className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>Direct Cash Payment to Worker</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  The customer hands exact cash of <strong>₹{totalAmountInr}.00</strong> directly to cooperative service provider <strong>{booking.workerName}</strong>.
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Clicking "Confirm Demo Cash Payment" below marks the transaction paid on the customer side, confirms delivery, and splits ₹{workerEarningsInr} (90%) to worker earnings and ₹{welfareContributionInr} (10%) to the Cooperative Welfare Fund.
                </p>
              </div>
            )}

            {/* 90:10 BREAKDOWN SUMMARY CARD */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2 text-xs font-mono tabular-nums">
              <div className="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-700">
                <span className="font-sans font-bold text-slate-800 dark:text-slate-200">
                  Booking Reference:
                </span>
                <strong className="text-teal-700 dark:text-teal-400">
                  {booking.bookingReference}
                </strong>
              </div>

              <div className="flex justify-between items-center py-0.5">
                <span className="font-sans text-slate-500 dark:text-slate-400">Assigned Worker:</span>
                <span className="font-sans font-semibold text-slate-900 dark:text-slate-100">
                  {booking.workerName} ({translateCategory(booking.workerCategory, lang)})
                </span>
              </div>

              <div className="flex justify-between items-center py-0.5">
                <span className="font-sans text-slate-500 dark:text-slate-400">Selected Method:</span>
                <span className="font-sans font-semibold text-slate-900 dark:text-slate-100">
                  {paymentMethod === 'UPI' ? 'UPI (Demo Simulation)' : 'Cash (Demo Hand-off)'}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700 text-sm font-bold">
                <span className="font-sans text-slate-900 dark:text-slate-100">Total Payable:</span>
                <span className="text-slate-900 dark:text-slate-100">₹{totalAmountInr}.00</span>
              </div>

              <div className="flex justify-between items-center text-emerald-800 dark:text-emerald-400 font-medium">
                <span className="font-sans">Worker Share (90% Net):</span>
                <span>₹{workerEarningsInr}.00</span>
              </div>

              <div className="flex justify-between items-center text-teal-800 dark:text-teal-400 font-medium">
                <span className="font-sans">Cooperative Welfare Fund (10%):</span>
                <span>₹{welfareContributionInr}.00</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDemoPayment}
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer shadow-md disabled:opacity-50 transition-all active:scale-98 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Confirming Demo Transaction...</span>
                  </>
                ) : paymentMethod === 'UPI' ? (
                  <>
                    <QrCode className="w-4 h-4" />
                    <span>Confirm Demo UPI Payment (₹{totalAmountInr})</span>
                  </>
                ) : (
                  <>
                    <Banknote className="w-4 h-4" />
                    <span>Confirm Demo Cash Payment (₹{totalAmountInr})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
