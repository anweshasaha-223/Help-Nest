/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  LogOut,
  Shield,
  User,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Columns2,
  ChevronDown,
  Sun,
  Moon,
} from 'lucide-react';
import type {
  UserAccount,
  UserRole,
  WorkerProfile,
  BookingRecord,
  BookingStatus,
  SupportedServiceCategory,
} from './types';
import {
  translations,
  LANGUAGE_LABELS,
  type LanguageCode,
  translateArea,
} from './i18n/translations';
import {
  PWAInstallButton,
  OfflineBanner,
  useOnlineStatus,
} from './components/PWAInstallButton';
import { CustomerPortal } from './components/CustomerPortal';
import { WorkerPortal } from './components/WorkerPortal';
import { AdminDashboard } from './components/AdminDashboard';

const STORAGE_TOKEN_KEY = 'helpnest_auth_token_v2';
const STORAGE_LANG_KEY = 'helpnest_language';
const STORAGE_OFFLINE_CACHE_KEY = 'helpnest_offline_cache_v2';

/**
 * Custom Help Nest Cooperative Brand Logo
 */
const HelpNestLogo: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Help Nest Logo"
  >
    <rect width="64" height="64" rx="14" fill="#24312C" />
    <path
      d="M32 12L12 28V50C12 52.2091 13.7909 54 16 54H26V39H38V54H48C50.2091 54 52 52.2091 52 50V28L32 12Z"
      fill="#075E54"
    />
    <path
      d="M32 19L18 30.2V48H24V36C24 34.8954 24.8954 34 26 34H38C39.1046 34 40 34.8954 40 36V48H46V30.2L32 19Z"
      fill="#FFFCF5"
    />
    <circle cx="32" cy="27" r="4" fill="#D6AD60" />
  </svg>
);

export default function App() {
  const isOnline = useOnlineStatus();

  // Language state (persisted across reloads)
  const [lang, setLang] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem(STORAGE_LANG_KEY) as LanguageCode | null;
    return saved && ['en', 'bn', 'hi'].includes(saved) ? saved : 'en';
  });

  const t = translations[lang] || translations.en;

  const handleLanguageChange = (newLang: LanguageCode) => {
    setLang(newLang);
    localStorage.setItem(STORAGE_LANG_KEY, newLang);
  };

  // Theme state (dark / light mode persisted in localStorage)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('helpnest_theme') as 'light' | 'dark' | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('helpnest_theme', theme);
  }, [theme]);

  // Auth & Session state
  const [token, setToken] = useState<string | null>(() => {
    localStorage.removeItem('helpnest_auth_token');
    localStorage.removeItem('helpnest_offline_cache_v1');
    return localStorage.getItem(STORAGE_TOKEN_KEY);
  });
  const [user, setUser] = useState<UserAccount | null>(null);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [allWorkers, setAllWorkers] = useState<WorkerProfile[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  const [customerTab, setCustomerTab] = useState<'request' | 'bookings' | 'bulk'>('request');
  const [workerTab, setWorkerTab] = useState<'jobs' | 'earnings' | 'cooperativeFund' | 'profile' | 'collaboration' | 'voting' | 'rules' | 'learn'>('jobs');
  const [adminTab, setAdminTab] = useState<'kyc' | 'bookings' | 'welfare' | 'forecast' | 'disputes' | 'rules' | 'intelligence' | 'customers' | 'settings'>('kyc');
  const [liveSyncNotice, setLiveSyncNotice] = useState<string | null>(null);

  // Active workspace portal view
  const [workspaceView, setWorkspaceView] = useState<'CUSTOMER' | 'WORKER' | 'ADMIN' | 'SPLIT'>('CUSTOMER');
  const [activeDispatchedWorkerId, setActiveDispatchedWorkerId] = useState<string | null>(null);

  // Auth form state — clean user registration/login with no pre-filled names or example data
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [selectedRole, setSelectedRole] = useState<UserRole>('CUSTOMER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [tradeCategory, setTradeCategory] = useState<SupportedServiceCategory | ''>('');
  const [serviceZone, setServiceZone] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Track current user and worker profile in refs for real-time socket events without stale closures
  const userRef = useRef<UserAccount | null>(user);
  userRef.current = user;
  const workerProfileRef = useRef<WorkerProfile | null>(workerProfile);
  workerProfileRef.current = workerProfile;

  // Sync bookings & workers from server or offline cache
  const refreshPortalData = useCallback(
    async (activeToken?: string | null): Promise<boolean> => {
      const currentToken = activeToken ?? token;
      if (!currentToken) return false;

      if (!navigator.onLine) {
        try {
          const cached = localStorage.getItem(STORAGE_OFFLINE_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.bookings) setBookings(parsed.bookings);
            if (parsed.workerProfile) setWorkerProfile(parsed.workerProfile);
            if (parsed.allWorkers) setAllWorkers(parsed.allWorkers);
          }
        } catch {
          // Ignore cache parse error
        }
        return false;
      }

      try {
        const currentUser = userRef.current;
        const currentProfile = workerProfileRef.current;
        const activeWorkerId =
          currentUser?.workerId ||
          currentProfile?.id ||
          (currentUser?.role === 'WORKER' ? currentUser.id : undefined);

        const bookingsUrl =
          currentUser?.role === 'WORKER' && activeWorkerId
            ? `/api/bookings?workerId=${encodeURIComponent(activeWorkerId)}`
            : '/api/bookings';

        const [meRes, bkgRes, wrkRes] = await Promise.all([
          fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${currentToken}` },
          }),
          fetch(bookingsUrl, {
            headers: { Authorization: `Bearer ${currentToken}` },
          }),
          fetch('/api/workers', {
            headers: { Authorization: `Bearer ${currentToken}` },
          }),
        ]);

        if (meRes.status === 401) {
          localStorage.removeItem(STORAGE_TOKEN_KEY);
          setToken(null);
          setUser(null);
          setWorkerProfile(null);
          return false;
        }

        const meData =
          meRes.ok && meRes.headers.get('content-type')?.includes('application/json')
            ? await meRes.json().catch(() => null)
            : null;
        const bkgData =
          bkgRes.ok && bkgRes.headers.get('content-type')?.includes('application/json')
            ? await bkgRes.json().catch(() => null)
            : null;
        const wrkData =
          wrkRes.ok && wrkRes.headers.get('content-type')?.includes('application/json')
            ? await wrkRes.json().catch(() => null)
            : null;

        if (meData?.user) {
          setUser(meData.user);
          setWorkerProfile(meData.workerProfile || null);
          setWorkspaceView((prev) => {
            if (prev === 'CUSTOMER' && meData.user.role === 'WORKER') return 'WORKER';
            if (prev === 'CUSTOMER' && meData.user.role === 'ADMIN') return 'ADMIN';
            return prev;
          });
        }
        if (bkgData?.bookings) {
          setBookings(bkgData.bookings);
        }
        if (wrkData?.workers) {
          setAllWorkers(wrkData.workers);
        }

        localStorage.setItem(
          STORAGE_OFFLINE_CACHE_KEY,
          JSON.stringify({
            user: meData?.user,
            workerProfile: meData?.workerProfile,
            bookings: bkgData?.bookings || [],
            allWorkers: wrkData?.workers || [],
            cachedAt: new Date().toISOString(),
          })
        );

        return Boolean(bkgRes.ok);
      } catch (err) {
        console.warn('[HelpNest Data Refresh Warning]', err);
        const cached = localStorage.getItem(STORAGE_OFFLINE_CACHE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.user) setUser(parsed.user);
            if (parsed.workerProfile) setWorkerProfile(parsed.workerProfile);
            if (parsed.bookings) setBookings(parsed.bookings);
            if (parsed.allWorkers) setAllWorkers(parsed.allWorkers);
          } catch {
            // ignore
          }
        }
        return false;
      }
    },
    [token]
  );

  useEffect(() => {
    const initSession = async () => {
      if (!token) {
        setLoadingSession(false);
        return;
      }
      await refreshPortalData(token);
      setLoadingSession(false);
    };
    initSession();
  }, [token, refreshPortalData]);

  // Real-time synchronization across Worker, Customer, and Admin devices via Socket.IO & SSE
  useEffect(() => {
    if (!token || !isOnline) return;

    const handleIncomingBookingEvent = (payload: {
      eventType: 'booking:created' | 'booking:updated';
      booking: BookingRecord;
    }) => {
      const updatedBooking = payload?.booking;
      if (!updatedBooking || !updatedBooking.id) return;

      setBookings((prev) => {
        const exists = prev.some((b) => b.id === updatedBooking.id);
        if (exists) {
          return prev.map((b) => (b.id === updatedBooking.id ? updatedBooking : b));
        }
        return [updatedBooking, ...prev];
      });

      const currentUser = userRef.current;
      const currentWorkerCategory = workerProfileRef.current?.category;
      const isMyWorkerJob =
        currentUser?.role === 'WORKER' &&
        (currentUser.workerId === updatedBooking.workerId ||
          currentUser.workerId === updatedBooking.assignedWorkerId ||
          (updatedBooking.status === 'PENDING' &&
            (!currentWorkerCategory || currentWorkerCategory === updatedBooking.workerCategory)));

      if (isMyWorkerJob && updatedBooking.status === 'PENDING') {
        setLiveSyncNotice(
          `🔔 New Job Received! Booking ${updatedBooking.bookingReference} for ${updatedBooking.workerCategory} from customer ${updatedBooking.customerName}.`
        );
      } else if (currentUser?.role === 'CUSTOMER' && currentUser.id === updatedBooking.customerId) {
        const statusText =
          updatedBooking.status === 'ACCEPTED'
            ? `Your booking accepted: ${updatedBooking.workerName} has accepted your booking (${updatedBooking.bookingReference})!`
            : updatedBooking.status === 'IN_PROGRESS'
            ? `Work in Progress: ${updatedBooking.workerName} has started work on booking ${updatedBooking.bookingReference}.`
            : updatedBooking.status === 'COMPLETED'
            ? `Work Completed: ${updatedBooking.workerName} has finished booking ${updatedBooking.bookingReference}. Please complete payment.`
            : `Live Update (${updatedBooking.bookingReference}): ${updatedBooking.status}`;

        setLiveSyncNotice(statusText);
      }

      // Proactively pull freshest database state
      refreshPortalData(token);
    };

    // 1. Connect Socket.IO client using polling first to avoid WebSocket proxy errors
    const socket = io({
      path: '/socket.io',
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      refreshPortalData(token);
    });

    socket.on('booking:created', handleIncomingBookingEvent);
    socket.on('worker:new-job', (payload: any) => {
      if (payload?.booking) {
        handleIncomingBookingEvent({ eventType: 'booking:created', booking: payload.booking });
      }
    });
    socket.on('booking:updated', handleIncomingBookingEvent);
    socket.on('worker:location-updated', (payload: any) => {
      if (payload?.bookingId && payload?.coordinates) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === payload.bookingId
              ? {
                  ...b,
                  liveWorkerLocation: {
                    ...payload.coordinates,
                    updatedAt: payload.updatedAt || new Date().toISOString(),
                    isLive: payload.status === 'ACCEPTED' || payload.status === 'IN_PROGRESS',
                    accuracy: payload.accuracy,
                  },
                  workerCoordinates: payload.coordinates,
                }
              : b
          )
        );
      }
    });
    socket.on('worker:registered', () => refreshPortalData(token));
    socket.on('worker:updated', () => refreshPortalData(token));
    socket.on('job-note:created', () => refreshPortalData(token));
    socket.on('job-note:batch-synced', () => refreshPortalData(token));
    socket.on('job-note:deleted', () => refreshPortalData(token));

    // 2. Connect SSE stream for instant server push
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/bookings/stream?token=${encodeURIComponent(token)}`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.eventType === 'booking:created' || data.eventType === 'booking:updated') {
            handleIncomingBookingEvent(data);
          } else if (
            data.eventType === 'job-note:created' ||
            data.eventType === 'job-note:batch-synced' ||
            data.eventType === 'job-note:deleted'
          ) {
            refreshPortalData(token);
          }
        } catch {
          // Ignore malformed event
        }
      };
    } catch {
      // Ignore if EventSource unavailable
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPortalData(token);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      socket.disconnect();
      if (eventSource) {
        eventSource.close();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, isOnline, refreshPortalData, t]);

  // Periodic poll fallback so both team devices stay in continuous real-time sync
  useEffect(() => {
    if (!token || !isOnline) return;

    // Fast 2.5s polling interval ensures cross-device synchronization without manual refresh
    const interval = setInterval(() => {
      refreshPortalData(token);
    }, 2500);

    return () => clearInterval(interval);
  }, [token, isOnline, refreshPortalData]);

  // Immediate refetch from backend when browser transitions back online
  useEffect(() => {
    if (isOnline && token) {
      refreshPortalData(token);
    }
  }, [isOnline, token, refreshPortalData]);

  // When Customer books a worker -> switch to Customer Bookings tab to view live status
  const handleCustomerBookingDispatched = (
    createdBooking: BookingRecord,
    assignedWorker?: WorkerProfile
  ) => {
    const targetWorkerId = assignedWorker?.id || createdBooking.workerId;
    setActiveDispatchedWorkerId(targetWorkerId);
    setCustomerTab('bookings');
    setLiveSyncNotice(
      `Booking ${createdBooking.bookingReference} dispatched to ${createdBooking.workerName}! You can track live progress in My Bookings.`
    );
  };

  // When Worker updates job status:
  const handleWorkerStatusUpdated = (
    updatedBooking: BookingRecord,
    nextStatus: BookingStatus
  ) => {
    if (nextStatus === 'IN_PROGRESS') {
      setLiveSyncNotice(
        `Work Started (${updatedBooking.bookingReference}): Live status updated to WORK IN PROGRESS.`
      );
    } else if (nextStatus === 'COMPLETED') {
      setCustomerTab('bookings');
      setLiveSyncNotice(
        `Work Completed by ${updatedBooking.workerName} (${updatedBooking.bookingReference})! Customer payment invoice is ready.`
      );
    }
  };

  // Module 1: Login & Registration Submit with rigorous input format validation and anti-placeholder checks
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setFieldErrors({});
    setLogoutMessage(null);

    const trimmedName = name.trim().replace(/\s+/g, ' ');
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    const trimmedAddress = addressLabel.trim().replace(/\s+/g, ' ');
    const trimmedSociety = societyName.trim().replace(/\s+/g, ' ');

    const newFieldErrors: Record<string, string> = {};
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const nameRegex = /^[\p{L}\p{M}]+(?:[\s.'-][\p{L}\p{M}]+)*$/u;
    const normalizedDigits = trimmedPhone.replace(/[\s()-]/g, '');
    const phoneRegex = /^(?:\+?91|0)?[6-9]\d{9}$|^\+?[1-9]\d{9,14}$/;
    const addressRegex = /^[\p{L}\p{M}\d\s,./#()-]+$/u;
    const hasLettersRegex = /[\p{L}\p{M}]{2,}/u;

    const blockedPlaceholderNames = new Set([
      'rohan chatterjee',
      'subrata mondal',
      'rameshwar yadav',
      'bikash das',
      'ananya sen',
      'john doe',
      'jane doe',
      'your name',
      'full name',
      'enter name',
      'enter your name',
      'example',
      'example user',
      'sample user',
      'demo user',
      'test',
      'test user',
      'placeholder',
      'user name',
      'username',
      'customer',
      'worker',
      'admin',
    ]);

    const blockedPlaceholderKeywords = [
      'placeholder',
      'example',
      'sample text',
      'demo account',
      'test account',
      'your name',
      'your address',
      'your society',
    ];

    const blockedPlaceholderDomains = new Set([
      'example.com',
      'example.org',
      'example.net',
      'test.com',
      'test.local',
      'sample.com',
      'placeholder.com',
      'domain.com',
      'email.com',
    ]);

    const blockedEmailLocals = new Set([
      'example',
      'placeholder',
      'sample',
      'demo',
      'test',
      'yourname',
      'youremail',
      'rohan',
    ]);

    const blockedPhoneNumbers = new Set([
      '9876543210',
      '0123456789',
      '1234567890',
      '9830012345',
      '9830511201',
      '9830977812',
      '9831265400',
      '9830090011',
    ]);

    const blockedPasswords = new Set(['example', 'placeholder']);

    const blockedAddresses = new Set([
      'example',
      'placeholder',
      'sample address',
      'your address',
      'enter address',
      'test address',
      '123 main st',
      'abc',
      'xyz',
      'na',
      'n/a',
      'none',
    ]);

    if (authMode === 'register') {
      // 1. Validate Full Name
      const lowerName = trimmedName.toLowerCase();
      if (!trimmedName) {
        newFieldErrors.name = 'Full name is required.';
      } else if (trimmedName.length < 2 || trimmedName.length > 80) {
        newFieldErrors.name = 'Invalid name length. Full name must be between 2 and 80 characters.';
      } else if (!nameRegex.test(trimmedName)) {
        newFieldErrors.name =
          'Invalid name format. Use letters and spaces only (no numbers or special symbols).';
      } else if (/^(\p{L})\1+$/iu.test(trimmedName.replace(/\s+/g, ''))) {
        newFieldErrors.name = 'Invalid name. Please enter a real full name without repeating characters.';
      } else if (
        blockedPlaceholderNames.has(lowerName) ||
        blockedPlaceholderKeywords.some((kw) => lowerName.includes(kw))
      ) {
        newFieldErrors.name =
          'Example or placeholder names are not allowed. Please enter your real full name.';
      }

      // 2. Validate Phone Number
      const coreTenDigits = normalizedDigits.replace(/^(?:\+?91|0)/, '');
      if (!trimmedPhone) {
        newFieldErrors.phone = 'Mobile phone number is required.';
      } else if (!/^\+?[\d\s()-]+$/.test(trimmedPhone)) {
        newFieldErrors.phone =
          'Invalid phone format. Phone number can only contain digits, spaces, or a leading +.';
      } else if (!phoneRegex.test(normalizedDigits) || /^(\d)\1{7,}$/.test(coreTenDigits)) {
        newFieldErrors.phone =
          'Invalid phone number format. Please enter a valid 10-digit mobile number (starting with 6–9).';
      } else if (blockedPhoneNumbers.has(coreTenDigits)) {
        newFieldErrors.phone =
          'Example or placeholder phone numbers are not allowed. Please enter your active mobile number.';
      }

      // 3. Validate Email Address
      if (!trimmedEmail) {
        newFieldErrors.email = 'Email address is required.';
      } else if (!emailRegex.test(trimmedEmail)) {
        newFieldErrors.email =
          'Invalid email format. Please enter a valid email address (e.g., name@domain.com).';
      } else {
        const [emailLocal = '', emailDomain = ''] = trimmedEmail.split('@');
        if (
          blockedPlaceholderDomains.has(emailDomain) ||
          blockedEmailLocals.has(emailLocal) ||
          emailLocal.includes('placeholder') ||
          emailLocal.includes('example')
        ) {
          newFieldErrors.email =
            'Example or placeholder email addresses are blocked. Please enter your real email address.';
        }
      }

      // 4. Validate Password
      if (!password) {
        newFieldErrors.password = 'Password is required.';
      } else if (password.length < 6 || password.length > 64) {
        newFieldErrors.password =
          'Invalid password length. Password must be between 6 and 64 characters long.';
      } else if (/^\s+|\s+$/.test(password) || /^\s+$/.test(password)) {
        newFieldErrors.password =
          'Invalid password format. Password cannot start or end with spaces.';
      } else if (blockedPasswords.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) {
        newFieldErrors.password =
          'Weak or example passwords are not allowed. Please choose a stronger password.';
      }

      // 5. Validate Role-Specific Inputs
      if (selectedRole === 'CUSTOMER') {
        const lowerAddr = trimmedAddress.toLowerCase();
        if (!trimmedAddress) {
          newFieldErrors.addressLabel = 'Service address or locality is required.';
        } else if (trimmedAddress.length < 3 || trimmedAddress.length > 120) {
          newFieldErrors.addressLabel =
            'Invalid address length. Please enter between 3 and 120 characters.';
        } else if (!addressRegex.test(trimmedAddress) || !hasLettersRegex.test(trimmedAddress)) {
          newFieldErrors.addressLabel =
            'Invalid address format. Please include your locality or street name using valid characters.';
        } else if (
          blockedAddresses.has(lowerAddr) ||
          blockedPlaceholderKeywords.some((kw) => lowerAddr.includes(kw))
        ) {
          newFieldErrors.addressLabel =
            'Placeholder or example addresses are not allowed. Please enter your actual service address.';
        }
      } else if (selectedRole === 'WORKER') {
        const allowedCategories: SupportedServiceCategory[] = [
          'Electrician',
          'Plumber',
          'Carpenter',
          'Painter',
          'Cleaner',
          'Babysitter',
        ];
        if (!tradeCategory || !allowedCategories.includes(tradeCategory)) {
          newFieldErrors.tradeCategory = 'Please select a valid trade category from the list.';
        }
        const allowedZones = [
          'Central Area',
          'North Area',
          'East Area',
          'IT Tech Area',
          'Sector-1',
          'Sector-2',
          'Sector-3',
          'Sector-5',
        ];
        if (!serviceZone || !allowedZones.includes(serviceZone)) {
          newFieldErrors.serviceZone = 'Please select a valid cooperative service zone.';
        }
      } else if (selectedRole === 'ADMIN') {
        const lowerSoc = trimmedSociety.toLowerCase();
        if (!trimmedSociety) {
          newFieldErrors.societyName = 'Cooperative Society name is required.';
        } else if (trimmedSociety.length < 3 || trimmedSociety.length > 120) {
          newFieldErrors.societyName =
            'Invalid society name length. Please enter between 3 and 120 characters.';
        } else if (!addressRegex.test(trimmedSociety) || !hasLettersRegex.test(trimmedSociety)) {
          newFieldErrors.societyName =
            'Invalid society name format. Please use letters, numbers, and standard punctuation.';
        } else if (
          blockedAddresses.has(lowerSoc) ||
          blockedPlaceholderKeywords.some((kw) => lowerSoc.includes(kw))
        ) {
          newFieldErrors.societyName =
            'Placeholder or example society names are not allowed. Please enter the real Cooperative Society name.';
        }
      }
    } else {
      // Login validation
      if (!trimmedEmail) {
        newFieldErrors.email = 'Email address is required.';
      } else if (!emailRegex.test(trimmedEmail)) {
        newFieldErrors.email =
          'Invalid email format. Please enter a valid registered email address.';
      }

      if (!password) {
        newFieldErrors.password = 'Password is required.';
      } else if (password.length < 6) {
        newFieldErrors.password =
          'Invalid password format. Password must be at least 6 characters long.';
      }
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setAuthError(Object.values(newFieldErrors)[0]);
      return;
    }

    setAuthSubmitting(true);

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        authMode === 'register'
          ? {
              name: trimmedName,
              email: trimmedEmail,
              phone: normalizedDigits,
              password,
              role: selectedRole,
              preferredLanguage: lang,
              category: selectedRole === 'WORKER' ? tradeCategory : undefined,
              serviceZone: selectedRole === 'WORKER' ? serviceZone : undefined,
              addressLabel: selectedRole === 'CUSTOMER' ? trimmedAddress : undefined,
              societyName: selectedRole === 'ADMIN' ? trimmedSociety : undefined,
            }
          : {
              email: trimmedEmail,
              password,
              role: selectedRole,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          data = {};
        }
      } else {
        const text = await res.text();
        throw new Error(
          res.ok
            ? 'Authentication response was not JSON.'
            : `Authentication failed (${res.status}): ${text.slice(0, 100)}`
        );
      }

      if (!res.ok) {
        if (data.field && typeof data.field === 'string') {
          setFieldErrors({ [data.field]: data.error || 'Invalid field value.' });
        }
        setAuthError(data.error || 'Authentication failed.');
      } else {
        localStorage.setItem(STORAGE_TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(data.user);
        setWorkerProfile(data.workerProfile || null);
        // Clear all form fields after successful submission
        setName('');
        setEmail('');
        setPhone('');
        setPassword('');
        setAddressLabel('');
        setSocietyName('');
        setTradeCategory('');
        setServiceZone('');
        setFieldErrors({});
        setWorkspaceView(
          data.user.role === 'ADMIN' ? 'ADMIN' : data.user.role === 'WORKER' ? 'WORKER' : 'CUSTOMER'
        );
        // Preserve manually chosen language in UI
        const savedLang = localStorage.getItem(STORAGE_LANG_KEY);
        if (!savedLang && data.user.preferredLanguage && ['en', 'bn', 'hi'].includes(data.user.preferredLanguage)) {
          handleLanguageChange(data.user.preferredLanguage as LanguageCode);
        }
        await refreshPortalData(data.token);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Unable to connect to authentication server.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Module 1: Functional Logout with Server Session Invalidation & Route Protection
  const handleLogout = async () => {
    try {
      if (token && isOnline) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }).catch(() => {});
        clearTimeout(timeoutId);
      }
    } catch {
      // Proceed with local cleanup even if network is unreachable
    } finally {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem('helpnest_auth_token');
      localStorage.removeItem(STORAGE_OFFLINE_CACHE_KEY);
      localStorage.removeItem('helpnest_offline_cache_v1');
      setToken(null);
      setUser(null);
      setWorkerProfile(null);
      setBookings([]);
      setAllWorkers([]);
      setActiveDispatchedWorkerId(null);
      setWorkspaceView('CUSTOMER');
      setCustomerTab('request');
      setWorkerTab('jobs');
      setAdminTab('kyc');
      setAuthMode('login');
      setAuthError(null);
      setFieldErrors({});
      setLogoutMessage(t.logoutSuccessMsg || 'You have been securely logged out.');
    }
  };

  // Resolve the active worker profile strictly for authenticated Worker or synchronized demo dual view
  const resolvedActiveWorker: WorkerProfile | null =
    user?.role === 'WORKER'
      ? workerProfile ||
        (user.workerId ? allWorkers.find((w) => w.id === user.workerId) || null : null) ||
        allWorkers.find((w) => w.userId === user.id) ||
        null
      : (activeDispatchedWorkerId
          ? allWorkers.find((w) => w.id === activeDispatchedWorkerId) || null
          : null) ||
        workerProfile ||
        (bookings.length > 0
          ? allWorkers.find((w) => w.id === bookings[0].workerId) || null
          : null) ||
        allWorkers[0] ||
        null;

  const workerSpecificBookings = user?.role === 'WORKER'
    ? bookings.filter((b) => {
        const myWorkerId = user.workerId || resolvedActiveWorker?.id || workerProfile?.id;
        if (myWorkerId && (b.workerId === myWorkerId || b.assignedWorkerId === myWorkerId)) {
          return true;
        }
        const activeCategory = resolvedActiveWorker?.category || workerProfile?.category;
        if (b.status === 'PENDING') {
          if (!activeCategory || b.workerCategory === activeCategory) {
            return true;
          }
        }
        return false;
      })
    : resolvedActiveWorker
    ? bookings.filter((b) => b.workerId === resolvedActiveWorker.id || b.status === 'PENDING')
    : bookings;

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">
          Loading Help Nest Cooperative Platform...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      <OfflineBanner message={t.offlineBanner} />

      {/* TOP HEADER BAR: Arranged properly with Brand, Portal Navigation, Theme, Language, Install, and Logout */}
      <header className="sticky top-0 z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-2.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <HelpNestLogo className="w-8 h-8 shrink-0" />
            <div>
              <span className="block text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                {t.brandTitle}
              </span>
              <span className="text-[10px] font-medium text-teal-700 dark:text-teal-400 tracking-normal block">
                {t.brandSubtitle}
              </span>
            </div>
          </div>

          {/* Center: Current Portal Badge (Strict role isolation — other portals are hidden) */}
          {user && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold order-3 lg:order-2 w-full lg:w-auto justify-center sm:justify-start">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-teal-700 text-white shadow-2xs font-bold whitespace-nowrap">
                {user.role === 'CUSTOMER' && <User className="w-3.5 h-3.5 shrink-0" />}
                {user.role === 'WORKER' && <Wrench className="w-3.5 h-3.5 shrink-0" />}
                {user.role === 'ADMIN' && <Shield className="w-3.5 h-3.5 shrink-0" />}
                <span>
                  {user.role === 'CUSTOMER'
                    ? t.portalCustomer
                    : user.role === 'WORKER'
                    ? t.portalWorker
                    : t.portalAdmin}
                </span>
              </span>
            </div>
          )}

          {/* Right: Controls (Theme Toggle, Language Dropdown, Install App, and working Logout Button) */}
          <div className="flex items-center gap-2 shrink-0 ml-auto order-2 lg:order-3">
            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs active:scale-95"
              title={theme === 'dark' ? t.lightTheme || 'Light Mode' : t.darkTheme || 'Dark Mode'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              )}
            </button>

            {/* Language Selector Dropdown */}
            <div className="relative">
              <select
                value={lang}
                onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
                className="appearance-none bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-6 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-700"
                aria-label="Language selection"
              >
                <option value="en">English</option>
                <option value="bn">বাংলা</option>
                <option value="hi">हिन्दी</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-slate-500 dark:text-slate-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Install App Button */}
            <PWAInstallButton label={t.installApp} />

            {/* Working Logout Button with User Info */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                <div className="hidden xl:block text-right">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">
                    {user.name}
                  </div>
                  <div className="text-[10px] font-medium text-teal-700 dark:text-teal-400">{user.role}</div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white transition-all text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer shadow-2xs active:scale-95"
                  title="Logout and clear active session"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.logoutBtn}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {!user ? (
          /* MODULE 1: AUTHENTICATION PORTAL (USER REGISTERS/LOGS IN WITH OWN NAME — NO EXAMPLE ACCOUNTS) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Platform Overview (Desktop only for ultra minimalist mobile UX) */}
            <div className="hidden lg:block lg:col-span-6 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-5 shadow-2xs">
                <div className="flex items-center gap-3.5">
                  <HelpNestLogo className="w-12 h-12 shrink-0" />
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Help Nest — Cooperative Services Platform
                    </h2>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <strong className="text-slate-900 dark:text-slate-100 block">Multilingual AI</strong>
                    <span className="text-slate-500 dark:text-slate-400">
                      Understands বাংলা, हिन्दी, and English household requests.
                    </span>
                  </div>
                  <div>
                    <strong className="text-slate-900 dark:text-slate-100 block">Explainable Fair Dispatch</strong>
                    <span className="text-slate-500 dark:text-slate-400">
                      Proximity (45%) + Skill (30%) + Fairness (25%).
                    </span>
                  </div>
                  <div>
                    <strong className="text-slate-900 dark:text-slate-100 block">Proposed 90:10 Split</strong>
                    <span className="text-slate-500 dark:text-slate-400">
                      90% Worker Net Earnings · 10% Cooperative Welfare Fund.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: User Registration & Sign In */}
            <div className="lg:col-span-6 max-w-lg mx-auto w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 space-y-5 shadow-2xs">
              <div className="flex lg:hidden items-center justify-center gap-2 pb-1">
                <HelpNestLogo className="w-8 h-8 shrink-0" />
                <span className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">Help Nest</span>
              </div>
              {logoutMessage && (
                <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs font-medium text-teal-900 dark:text-teal-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                  <span>{logoutMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <HelpNestLogo className="w-7 h-7 shrink-0" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {authMode === 'login' ? t.signInTitle : t.registerTitle}
                  </h2>
                </div>
                {selectedRole !== 'ADMIN' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'login' ? 'register' : 'login');
                      setAuthError(null);
                      setFieldErrors({});
                    }}
                    className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    {authMode === 'login' ? t.switchToRegister : t.switchToLogin}
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                    Administrator Sign In
                  </span>
                )}
              </div>

              {/* Role Selector Tabs */}
              <div className="grid grid-cols-3 gap-1 sm:gap-2 p-1 sm:p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                {(
                  [
                    { id: 'CUSTOMER', label: t.roleCustomer, icon: User },
                    { id: 'WORKER', label: t.roleWorker, icon: Wrench },
                    { id: 'ADMIN', label: t.roleAdmin, icon: Shield },
                  ] as Array<{ id: UserRole; label: string; icon: React.FC<{ className?: string }> }>
                ).map((r) => {
                  const RoleIcon = r.icon;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedRole(r.id);
                        if (r.id === 'ADMIN') {
                          setAuthMode('login');
                        }
                        setAuthError(null);
                        setFieldErrors({});
                      }}
                      className={`py-2 sm:py-2.5 px-1 sm:px-2 rounded-lg text-[10.5px] sm:text-xs font-semibold transition-colors cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center leading-tight min-h-[46px] sm:min-h-[42px] ${
                        selectedRole === r.id
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <RoleIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="whitespace-normal leading-tight text-center break-words sm:break-normal">{r.label}</span>
                    </button>
                  );
                })}
              </div>

              {selectedRole === 'ADMIN' && (
                <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div>
                      <strong className="block font-bold">Secure Society Administrator Console</strong>
                      <span>
                        Access restricted to cooperative society administrators.
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('admin@helpnest.coop');
                          setPassword('helpnest123');
                          setAuthMode('login');
                          setAuthError(null);
                          setFieldErrors({});
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-800 font-semibold cursor-pointer text-[11px] transition-colors"
                      >
                        Auto-fill Admin (admin@helpnest.coop)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode(authMode === 'login' ? 'register' : 'login');
                          setAuthError(null);
                          setFieldErrors({});
                        }}
                        className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-slate-700 text-[11px] font-semibold cursor-pointer transition-colors"
                      >
                        {authMode === 'login' ? 'Register New Society Admin' : 'Switch to Admin Login'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} noValidate className="space-y-4">
                {authMode === 'register' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t.fullNameLabel} *
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (fieldErrors.name) {
                            setFieldErrors((prev) => ({ ...prev, name: '' }));
                          }
                        }}
                        className={`w-full rounded-xl border px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 ${
                          fieldErrors.name ? 'border-red-500 bg-red-50/20' : 'border-slate-300 dark:border-slate-700'
                        }`}
                      />
                      {fieldErrors.name && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t.phoneLabel} *
                      </label>
                      <input
                        type="tel"
                        required
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (fieldErrors.phone) {
                            setFieldErrors((prev) => ({ ...prev, phone: '' }));
                          }
                        }}
                        className={`w-full rounded-xl border px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 ${
                          fieldErrors.phone ? 'border-red-500 bg-red-50/20' : 'border-slate-300 dark:border-slate-700'
                        }`}
                      />
                      {fieldErrors.phone && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.phone}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className={authMode === 'register' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' : 'space-y-4'}>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.emailLabel} *
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) {
                          setFieldErrors((prev) => ({ ...prev, email: '' }));
                        }
                      }}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 ${
                        fieldErrors.email ? 'border-red-500 bg-red-50/20' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.passwordLabel} *
                    </label>
                    <input
                      type="password"
                      required
                      autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({ ...prev, password: '' }));
                        }
                      }}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 ${
                        fieldErrors.password ? 'border-red-500 bg-red-50/20' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {fieldErrors.password && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</p>
                    )}
                  </div>
                </div>

                {authMode === 'register' && selectedRole === 'CUSTOMER' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.serviceAddressLabel} *
                    </label>
                    <input
                      type="text"
                      required
                      value={addressLabel}
                      onChange={(e) => {
                        setAddressLabel(e.target.value);
                        if (fieldErrors.addressLabel) {
                          setFieldErrors((prev) => ({ ...prev, addressLabel: '' }));
                        }
                      }}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 ${
                        fieldErrors.addressLabel ? 'border-red-500 bg-red-50/20' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {fieldErrors.addressLabel && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.addressLabel}</p>
                    )}
                  </div>
                )}

                {authMode === 'register' && selectedRole === 'WORKER' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t.chooseCategory} *
                      </label>
                      <select
                        required
                        value={tradeCategory}
                        onChange={(e) => {
                          setTradeCategory(e.target.value as SupportedServiceCategory | '');
                          if (fieldErrors.tradeCategory) {
                            setFieldErrors((prev) => ({ ...prev, tradeCategory: '' }));
                          }
                        }}
                        className={`w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 ${
                          fieldErrors.tradeCategory
                            ? 'border-red-500 bg-red-50/20'
                            : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <option value="">{t.chooseCategory}</option>
                        <option value="Electrician">{t.catElectrician || 'Electrician'}</option>
                        <option value="Plumber">{t.catPlumber || 'Plumber'}</option>
                        <option value="Carpenter">{t.catCarpenter || 'Carpenter'}</option>
                        <option value="Painter">{t.catPainter || 'Painter'}</option>
                        <option value="Cleaner">{t.catCleaner || 'Cleaner'}</option>
                        <option value="Babysitter">{t.catBabysitter || 'Babysitter'}</option>
                      </select>
                      {fieldErrors.tradeCategory && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.tradeCategory}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t.serviceZoneLabel} *
                      </label>
                      <select
                        required
                        value={serviceZone}
                        onChange={(e) => {
                          setServiceZone(e.target.value);
                          if (fieldErrors.serviceZone) {
                            setFieldErrors((prev) => ({ ...prev, serviceZone: '' }));
                          }
                        }}
                        className={`w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 ${
                          fieldErrors.serviceZone
                            ? 'border-red-500 bg-red-50/20'
                            : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <option value="">{t.selectZone}</option>
                        <option value="Central Area">{translateArea('Central Area', lang)}</option>
                        <option value="North Area">{translateArea('North Area', lang)}</option>
                        <option value="East Area">{translateArea('East Area', lang)}</option>
                        <option value="IT Tech Area">{translateArea('IT Tech Area', lang)}</option>
                      </select>
                      {fieldErrors.serviceZone && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.serviceZone}</p>
                      )}
                    </div>
                  </div>
                )}

                {authMode === 'register' && selectedRole === 'ADMIN' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.societyNameLabel} *
                    </label>
                    <input
                      type="text"
                      required
                      value={societyName}
                      onChange={(e) => {
                        setSocietyName(e.target.value);
                        if (fieldErrors.societyName) {
                          setFieldErrors((prev) => ({ ...prev, societyName: '' }));
                        }
                      }}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-700 ${
                        fieldErrors.societyName ? 'border-red-500 bg-red-50/20' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {fieldErrors.societyName && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.societyName}</p>
                    )}
                  </div>
                )}

                {authError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-teal-700 text-white text-sm font-semibold hover:bg-slate-800 dark:hover:bg-teal-600 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs active:scale-98"
                >
                  {authSubmitting
                    ? 'Submitting...'
                    : authMode === 'login'
                    ? `${t.loginBtn} (${selectedRole})`
                    : `${t.registerBtn} (${selectedRole})`}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* ROLE-PROTECTED AUTHENTICATED PORTALS */
          <div className="space-y-6">
            {/* 1. CUSTOMER PORTAL */}
            {user.role === 'CUSTOMER' && token && (
              <CustomerPortal
                user={user}
                token={token}
                activeSubTab={customerTab}
                setActiveSubTab={setCustomerTab}
                bookings={bookings}
                onRefreshBookings={async () => {
                  await refreshPortalData(token);
                }}
                onBookingDispatched={handleCustomerBookingDispatched}
                t={t}
                lang={lang}
                isOnline={isOnline}
                liveSyncNotice={liveSyncNotice}
                onDismissSyncNotice={() => setLiveSyncNotice(null)}
              />
            )}

            {/* 2. WORKER PORTAL */}
            {user.role === 'WORKER' && token && (
              <WorkerPortal
                worker={
                  resolvedActiveWorker || {
                    id: user.workerId || user.id,
                    userId: user.id,
                    name: user.name,
                    phone: user.phone,
                    avatarInitials: user.name.slice(0, 2).toUpperCase(),
                    category: (user.category as SupportedServiceCategory) || 'Electrician',
                    skills: ['General Installation & Repairs'],
                    verified: true,
                    kycStatus: 'VERIFIED',
                    skillBadges: ['KYC Verified Member'],
                    isAvailable: true,
                    shift: 'Morning (08:00 - 12:00)',
                    serviceZone: user.serviceZone || 'Central Area',
                    coordinates: {
                      lat: 22.5867,
                      lng: 88.4178,
                      addressLabel: user.serviceZone || 'Central Area',
                    },
                    rating: 4.9,
                    reviewCount: 12,
                    baseRateInr: 250,
                    completedJobsTotal: 0,
                    completedJobsThisWeek: 0,
                    grossEarningsInr: 0,
                    netEarningsInr: 0,
                    welfareContributionInr: 0,
                  }
                }
                token={token}
                activeTab={workerTab}
                setActiveTab={setWorkerTab}
                bookings={workerSpecificBookings}
                onRefreshData={async () => {
                  await refreshPortalData(token);
                }}
                onStatusUpdated={handleWorkerStatusUpdated}
                t={t}
                lang={lang}
                isOnline={isOnline}
              />
            )}

            {/* 3. SOCIETY ADMIN DASHBOARD */}
            {user.role === 'ADMIN' && token && (
              <AdminDashboard
                token={token}
                activeTab={adminTab}
                setActiveTab={setAdminTab}
                workers={allWorkers}
                bookings={bookings}
                onRefreshAll={async () => {
                  await refreshPortalData(token);
                }}
                t={t}
                lang={lang}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
