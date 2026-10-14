import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Calendar,
  Coins,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import type { BookingRecord, WelfareLedgerEntry, LanguageCode } from '../types';

export type TimeFilter = 'daily' | 'weekly' | 'monthly';

interface EarningsChartProps {
  bookings?: BookingRecord[];
  ledgerEntries?: WelfareLedgerEntry[];
  workerId?: string;
  role?: 'WORKER' | 'ADMIN';
  lang?: LanguageCode;
  title?: string;
}

interface ChartDataPoint {
  periodLabel: string;
  completedJobs: number;
  workerEarningsInr: number; // 90%
  welfareContributionInr: number; // 10%
  grossTotalInr: number; // 100%
  demoPaymentsCount: number;
  actualPaymentsCount: number;
}

export const EarningsChart: React.FC<EarningsChartProps> = ({
  bookings = [],
  ledgerEntries = [],
  workerId,
  role = 'WORKER',
  lang = 'en',
  title,
}) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('daily');

  // Extract deduplicated completed transaction records
  const uniqueRecords = useMemo(() => {
    const seenRefs = new Set<string>();
    const validRecords: Array<{
      id: string;
      ref: string;
      date: string;
      amountInr: number;
      workerShareInr: number;
      welfareShareInr: number;
      workerId: string;
      isDemo: boolean;
    }> = [];

    // 1. Process confirmed ledger entries first if present
    for (const entry of ledgerEntries) {
      if (workerId && entry.workerId !== workerId) continue;
      const ref = entry.bookingReference || entry.id;
      if (seenRefs.has(ref)) continue;
      seenRefs.add(ref);

      const gross = entry.grossAmountInr || 0;
      const workerShare =
        typeof entry.workerNetInr === 'number'
          ? entry.workerNetInr
          : Math.round(gross * 0.9);
      const welfareShare =
        typeof entry.welfareContributionInr === 'number'
          ? entry.welfareContributionInr
          : gross - workerShare;

      validRecords.push({
        id: entry.id,
        ref,
        date: entry.timestamp || new Date().toISOString(),
        amountInr: gross,
        workerShareInr: workerShare,
        welfareShareInr: welfareShare,
        workerId: entry.workerId,
        isDemo: Boolean(entry.isDemo ?? true),
      });
    }

    // 2. Process completed bookings with confirmed payments
    for (const b of bookings) {
      if (workerId && b.workerId !== workerId && b.assignedWorkerId !== workerId) continue;
      if (b.status !== 'COMPLETED') continue;

      const ref = b.bookingReference || b.id;
      if (seenRefs.has(ref)) continue;
      seenRefs.add(ref);

      const gross = b.amountInr || 0;
      // Strict 90:10 rule calculation
      const workerShare =
        typeof b.workerShareInr === 'number'
          ? b.workerShareInr
          : Math.round(gross * 0.9);
      const welfareShare =
        typeof b.welfareShareInr === 'number'
          ? b.welfareShareInr
          : gross - workerShare;

      validRecords.push({
        id: b.id,
        ref,
        date: b.updatedAt || b.preferredDate || new Date().toISOString(),
        amountInr: gross,
        workerShareInr: workerShare,
        welfareShareInr: welfareShare,
        workerId: b.workerId,
        isDemo: true, // Platform operates in verified cooperative sandbox
      });
    }

    return validRecords;
  }, [bookings, ledgerEntries, workerId]);

  // Aggregate by time period: Daily, Weekly, or Monthly
  const chartData: ChartDataPoint[] = useMemo(() => {
    const now = new Date();

    if (timeFilter === 'daily') {
      // Last 7 days
      const daysMap: Record<string, ChartDataPoint> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        const dayName = d.toLocaleDateString(lang === 'bn' ? 'bn-IN' : lang === 'hi' ? 'hi-IN' : 'en-US', {
          weekday: 'short',
          month: 'numeric',
          day: 'numeric',
        });
        daysMap[key] = {
          periodLabel: dayName,
          completedJobs: 0,
          workerEarningsInr: 0,
          welfareContributionInr: 0,
          grossTotalInr: 0,
          demoPaymentsCount: 0,
          actualPaymentsCount: 0,
        };
      }

      for (const rec of uniqueRecords) {
        const dateKey = rec.date.slice(0, 10);
        if (daysMap[dateKey]) {
          daysMap[dateKey].completedJobs += 1;
          daysMap[dateKey].workerEarningsInr += rec.workerShareInr;
          daysMap[dateKey].welfareContributionInr += rec.welfareShareInr;
          daysMap[dateKey].grossTotalInr += rec.amountInr;
          if (rec.isDemo) daysMap[dateKey].demoPaymentsCount += 1;
          else daysMap[dateKey].actualPaymentsCount += 1;
        }
      }

      return Object.values(daysMap);
    }

    if (timeFilter === 'weekly') {
      // Last 4 weeks
      const weeksMap: Record<string, ChartDataPoint> = {};
      for (let i = 3; i >= 0; i--) {
        const startWeek = new Date(now.getTime() - (i * 7 + 6) * 86400000);
        const endWeek = new Date(now.getTime() - i * 7 * 86400000);
        const key = `W-${i}`;
        const label = `Week ${4 - i} (${startWeek.getDate()}/${startWeek.getMonth() + 1} - ${endWeek.getDate()}/${endWeek.getMonth() + 1})`;
        weeksMap[key] = {
          periodLabel: label,
          completedJobs: 0,
          workerEarningsInr: 0,
          welfareContributionInr: 0,
          grossTotalInr: 0,
          demoPaymentsCount: 0,
          actualPaymentsCount: 0,
        };
      }

      for (const rec of uniqueRecords) {
        const recTime = new Date(rec.date).getTime();
        const diffDays = Math.floor((now.getTime() - recTime) / 86400000);
        if (diffDays >= 0 && diffDays < 28) {
          const weekIndex = Math.floor(diffDays / 7);
          const key = `W-${weekIndex}`;
          if (weeksMap[key]) {
            weeksMap[key].completedJobs += 1;
            weeksMap[key].workerEarningsInr += rec.workerShareInr;
            weeksMap[key].welfareContributionInr += rec.welfareShareInr;
            weeksMap[key].grossTotalInr += rec.amountInr;
            if (rec.isDemo) weeksMap[key].demoPaymentsCount += 1;
            else weeksMap[key].actualPaymentsCount += 1;
          }
        }
      }

      return Object.values(weeksMap);
    }

    // Monthly: Last 6 months
    const monthsMap: Record<string, ChartDataPoint> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(lang === 'bn' ? 'bn-IN' : lang === 'hi' ? 'hi-IN' : 'en-US', {
        month: 'short',
        year: '2-digit',
      });
      monthsMap[key] = {
        periodLabel: label,
        completedJobs: 0,
        workerEarningsInr: 0,
        welfareContributionInr: 0,
        grossTotalInr: 0,
        demoPaymentsCount: 0,
        actualPaymentsCount: 0,
      };
    }

    for (const rec of uniqueRecords) {
      const recDate = new Date(rec.date);
      const key = `${recDate.getFullYear()}-${String(recDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthsMap[key]) {
        monthsMap[key].completedJobs += 1;
        monthsMap[key].workerEarningsInr += rec.workerShareInr;
        monthsMap[key].welfareContributionInr += rec.welfareShareInr;
        monthsMap[key].grossTotalInr += rec.amountInr;
        if (rec.isDemo) monthsMap[key].demoPaymentsCount += 1;
        else monthsMap[key].actualPaymentsCount += 1;
      }
    }

    return Object.values(monthsMap);
  }, [uniqueRecords, timeFilter, lang]);

  // Overall totals across deduplicated records
  const totalStats = useMemo(() => {
    let completed = 0;
    let workerNet = 0;
    let welfareFund = 0;
    let gross = 0;

    for (const r of uniqueRecords) {
      completed += 1;
      workerNet += r.workerShareInr;
      welfareFund += r.welfareShareInr;
      gross += r.amountInr;
    }

    return { completed, workerNet, welfareFund, gross };
  }, [uniqueRecords]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5 shadow-2xs">
      {/* Header with Title and Time Period Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <span>{title || (role === 'ADMIN' ? 'Transparent 90:10 Cooperative Revenue & Welfare Ledger' : 'My Actual Earnings & 90:10 Welfare Split')}</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              90:10 Split
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Calculated strictly from completed stored records with zero duplicate counting. 90% direct worker share + 10% welfare contribution.
          </p>
        </div>

        {/* Daily / Weekly / Monthly Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shrink-0 self-start sm:self-auto">
          {(
            [
              { id: 'daily', labelEn: 'Daily', labelBn: 'দৈনিক', labelHi: 'दैनिक' },
              { id: 'weekly', labelEn: 'Weekly', labelBn: 'সাপ্তাহিক', labelHi: 'साप्ताहिक' },
              { id: 'monthly', labelEn: 'Monthly', labelBn: 'মাসিক', labelHi: 'मासिक' },
            ] as Array<{ id: TimeFilter; labelEn: string; labelBn: string; labelHi: string }>
          ).map((filter) => {
            const isSelected = timeFilter === filter.id;
            const label = lang === 'bn' ? filter.labelBn : lang === 'hi' ? filter.labelHi : filter.labelEn;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setTimeFilter(filter.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-300 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400 block">Completed Jobs</span>
          <strong className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 block mt-0.5">
            {totalStats.completed}
          </strong>
          <span className="text-[10px] text-slate-400">Actual unique records</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400 block">Total Gross Volume</span>
          <strong className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 block mt-0.5">
            ₹{totalStats.gross.toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-slate-400">100% service value</span>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80">
          <span className="text-emerald-700 dark:text-emerald-300 font-medium block">
            {role === 'ADMIN' ? 'Worker Payout (90%)' : 'My Net Earnings (90%)'}
          </span>
          <strong className="text-lg font-bold font-mono text-emerald-800 dark:text-emerald-200 block mt-0.5">
            ₹{totalStats.workerNet.toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">90% direct member share</span>
        </div>

        <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/80">
          <span className="text-teal-700 dark:text-teal-300 font-medium block">Welfare Reserve (10%)</span>
          <strong className="text-lg font-bold font-mono text-teal-800 dark:text-teal-200 block mt-0.5">
            ₹{totalStats.welfareFund.toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-teal-600/80 dark:text-teal-400/80">10% cooperative pool</span>
        </div>
      </div>

      {/* Transparent Bar Chart */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.25} />
            <XAxis
              dataKey="periodLabel"
              tick={{ fontSize: 11, fill: '#64748B' }}
              stroke="#94A3B8"
              opacity={0.5}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748B' }}
              stroke="#94A3B8"
              opacity={0.5}
              tickFormatter={(val) => `₹${val}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload as ChartDataPoint;
                return (
                  <div className="p-3 rounded-xl bg-slate-900 text-white text-xs space-y-1.5 shadow-xl border border-slate-700">
                    <strong className="block text-slate-200 border-b border-slate-700 pb-1 font-bold">
                      {label} ({d.completedJobs} {d.completedJobs === 1 ? 'Job' : 'Jobs'})
                    </strong>
                    <div className="flex justify-between gap-4 text-emerald-300">
                      <span>Worker Share (90%):</span>
                      <strong className="font-mono">₹{d.workerEarningsInr.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="flex justify-between gap-4 text-teal-300">
                      <span>Welfare Fund (10%):</span>
                      <strong className="font-mono">₹{d.welfareContributionInr.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="flex justify-between gap-4 text-slate-300 border-t border-slate-700/60 pt-1">
                      <span>Gross Total (100%):</span>
                      <strong className="font-mono">₹{d.grossTotalInr.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 pt-0.5">
                      Status: {d.demoPaymentsCount} demo payment record{d.demoPaymentsCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) => <span className="text-slate-700 dark:text-slate-300 font-medium">{value}</span>}
            />
            <Bar
              dataKey="workerEarningsInr"
              name={role === 'ADMIN' ? 'Worker Share (90%)' : 'My Earnings (90%)'}
              fill="#087F5B"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="welfareContributionInr"
              name="Cooperative Welfare Fund (10%)"
              fill="#075E54"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Verification Notice */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Formula: Gross ₹1,000 = ₹900 Worker Share (90%) + ₹100 Welfare Fund (10%)</span>
        </span>
        <span className="font-mono text-slate-400">
          Deduplication: Active · Zero repeated transactions
        </span>
      </div>
    </div>
  );
};
