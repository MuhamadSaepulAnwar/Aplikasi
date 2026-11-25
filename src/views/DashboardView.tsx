import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Plus,
  AlertTriangle,
  ArrowUpRight,
  Database,
  TrendingUp,
  Trophy,
  Clock,
  Package,
  BellRing,
  Copy,
  Check,
  History,
  ArrowDownLeft,
  Calculator,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  TIMEFRAME_OPTIONS,
  buildBestSellers,
  buildMonthlyProfitSeries,
  buildOrderReminderMessage,
  formatDateID,
  formatRp,
  formatRpCompact,
  getOrderDueInfo,
  getOrdersWithoutHpp,
  isDateInTimeframe,
  summarizeHppRecords,
} from '../lib/format';
import { seedSampleBusinessData } from '../lib/seed';
import { NavTab, Order, TimeframeKey } from '../types';

interface DashboardViewProps {
  timeframe: TimeframeKey;
  onTimeframeChange: (tf: TimeframeKey) => void;
  onNavigate: (tab: NavTab) => void;
  onOpenQuickOrder: () => void;
  onOpenOverdueOrders?: () => void;
  onOpenHppHistory?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  timeframe,
  onTimeframeChange,
  onNavigate,
  onOpenQuickOrder,
  onOpenOverdueOrders,
  onOpenHppHistory,
}) => {
  const {
    user,
    shopProfile,
    orders,
    transactions,
    materials,
    payrollLogs,
    hppRecords,
    loadingData,
    notify,
  } = useWorkspace();
  const [seeding, setSeeding] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const overdueNotifiedRef = useRef(false);

  const monthlySeries = useMemo(
    () => buildMonthlyProfitSeries(transactions, timeframe),
    [transactions, timeframe]
  );

  const totals = useMemo(() => {
    const omset = monthlySeries.reduce((s, r) => s + r.omset, 0);
    const omsetPercetakan = monthlySeries.reduce((s, r) => s + r.omsetPercetakan, 0);
    const omsetSablon = monthlySeries.reduce((s, r) => s + r.omsetSablon, 0);
    const bahanBaku = monthlySeries.reduce((s, r) => s + r.bahanBaku, 0);
    const gajiKaryawan = monthlySeries.reduce((s, r) => s + r.gajiKaryawan, 0);
    const biayaLainLain = monthlySeries.reduce((s, r) => s + r.biayaLainLain, 0);
    const totalPengeluaran = bahanBaku + gajiKaryawan + biayaLainLain;
    const profitBersih = omset - totalPengeluaran;
    const marginPercent = omset > 0 ? (profitBersih / omset) * 100 : 0;
    return {
      omset,
      omsetPercetakan,
      omsetSablon,
      bahanBaku,
      gajiKaryawan,
      biayaLainLain,
      totalPengeluaran,
      profitBersih,
      marginPercent,
    };
  }, [monthlySeries]);

  const currentMonthRow = monthlySeries[monthlySeries.length - 1];

  const receivables = useMemo(() => {
    const unpaid = orders
      .filter((o) => o.remainingAmount > 0 || o.paymentStatus !== 'lunas')
      .map((order) => ({ order, due: getOrderDueInfo(order) }))
      .sort((a, b) => a.due.daysDiff - b.due.daysDiff);
    const total = unpaid.reduce((s, item) => s + item.order.remainingAmount, 0);
    const overdue = unpaid.filter((item) => item.due.status === 'overdue');
    const dueTodayOrSoon = unpaid.filter(
      (item) => item.due.status === 'due_today' || item.due.status === 'due_soon'
    );
    const overdueTotal = overdue.reduce((s, item) => s + item.order.remainingAmount, 0);
    return {
      count: unpaid.length,
      total,
      list: unpaid.slice(0, 5),
      overdue,
      overdueTotal,
      dueTodayOrSoon,
    };
  }, [orders]);

  useEffect(() => {
    if (!loadingData && receivables.overdue.length > 0 && !overdueNotifiedRef.current) {
      overdueNotifiedRef.current = true;
      notify(
        `Pengingat Jatuh Tempo: ${receivables.overdue.length} order DP/Belum Lunas melewati tenggat waktu!`,
        'error'
      );
    }
  }, [loadingData, receivables.overdue.length, notify]);

  const handleCopyReminder = async (order: Order) => {
    try {
      await navigator.clipboard.writeText(buildOrderReminderMessage(order, shopProfile));
      setCopiedOrderId(order.id);
      notify(`Pesan tagihan WA untuk ${order.customerName} tersalin.`);
      window.setTimeout(() => setCopiedOrderId((prev) => (prev === order.id ? null : prev)), 2200);
    } catch {
      notify('Gagal menyalin pesan pengingat.', 'error');
    }
  };

  const lowStockMaterials = useMemo(
    () => materials.filter((m) => m.stock <= m.minStock),
    [materials]
  );

  const unpaidPayrollTotal = useMemo(
    () =>
      payrollLogs
        .filter((l) => l.status === 'belum_dibayar')
        .reduce((s, l) => s + (Number(l.netAmount) || 0), 0),
    [payrollLogs]
  );

  const bestSellers = useMemo(
    () => buildBestSellers(orders, timeframe).slice(0, 5),
    [orders, timeframe]
  );

  const hppSummary = useMemo(
    () => summarizeHppRecords(hppRecords, timeframe),
    [hppRecords, timeframe]
  );

  const ordersWithoutHpp = useMemo(
    () => getOrdersWithoutHpp(orders, hppRecords),
    [orders, hppRecords]
  );

  const recentHpp = useMemo(
    () => hppRecords.filter((h) => isDateInTimeframe(h.recordDate, timeframe)).slice(0, 5),
    [hppRecords, timeframe]
  );

  const recentTransactions = useMemo(
    () => transactions.filter((t) => isDateInTimeframe(t.date, timeframe)).slice(0, 6),
    [transactions, timeframe]
  );

  // For long multi-year charts (2y/3y/5y), aggregate chart bars neatly by quarter or half-year if >18 months
  const chartData = useMemo(() => {
    if (monthlySeries.length <= 12) {
      return monthlySeries.map((r) => ({
        label: r.label,
        Omset: r.omset,
        Pengeluaran: r.totalPengeluaran,
        'Profit Bersih': r.profitBersih,
      }));
    }
    // Group into quarterly buckets for crisp chart readability while monthly table in Reports keeps every single month
    const buckets: { label: string; Omset: number; Pengeluaran: number; 'Profit Bersih': number }[] = [];
    const chunkSize = monthlySeries.length >= 48 ? 6 : 3;
    for (let i = 0; i < monthlySeries.length; i += chunkSize) {
      const slice = monthlySeries.slice(i, i + chunkSize);
      const first = slice[0];
      const last = slice[slice.length - 1];
      buckets.push({
        label: slice.length === 1 ? first.label : `${first.label}–${last.label}`,
        Omset: slice.reduce((s, r) => s + r.omset, 0),
        Pengeluaran: slice.reduce((s, r) => s + r.totalPengeluaran, 0),
        'Profit Bersih': slice.reduce((s, r) => s + r.profitBersih, 0),
      });
    }
    return buckets;
  }, [monthlySeries]);

  const activeTimeframeMeta = TIMEFRAME_OPTIONS.find((t) => t.key === timeframe) || TIMEFRAME_OPTIONS[0];
  const isEmptyWorkspace = !loadingData && orders.length === 0 && transactions.length === 0;

  const handleSeedDemo = async () => {
    if (!user || seeding) return;
    setSeeding(true);
    try {
      await seedSampleBusinessData(user.uid);
      notify('Data contoh percetakan & sablon berhasil dimuat.');
    } catch {
      notify('Gagal memuat data contoh.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  if (loadingData) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-[#121824] rounded-xl border border-[#232C3D]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#121824] rounded-xl border border-[#232C3D]" />
          ))}
        </div>
        <div className="h-72 bg-[#121824] rounded-xl border border-[#232C3D]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Automatic Overdue & Due-Date Notification Banner */}
      {(receivables.overdue.length > 0 || receivables.dueTodayOrSoon.length > 0) && (
        <div
          role="alert"
          className={`rounded-xl border p-4 sm:p-5 space-y-3 ${
            receivables.overdue.length > 0
              ? 'bg-rose-500/10 border-rose-500/40'
              : 'bg-amber-500/10 border-amber-500/35'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  receivables.overdue.length > 0
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#F8FAFC]">
                  {receivables.overdue.length > 0
                    ? `Peringatan Jatuh Tempo: ${receivables.overdue.length} Order Belum Lunas Melewati Tenggat Waktu`
                    : `Pengingat Jatuh Tempo: ${receivables.dueTodayOrSoon.length} Order Mendekati Tenggat Pelunasan`}
                </h3>
                <p className="text-xs text-[#CBD5E1] mt-0.5">
                  {receivables.overdue.length > 0 ? (
                    <>
                      Total sisa pelunasan terlambat:{' '}
                      <span className="font-mono font-bold text-rose-300">
                        {formatRp(receivables.overdueTotal)}
                      </span>
                      {receivables.dueTodayOrSoon.length > 0 &&
                        ` · Ditambah ${receivables.dueTodayOrSoon.length} order jatuh tempo ≤3 hari lagi`}
                    </>
                  ) : (
                    'Segera follow-up pelunasan pelanggan sebelum melewati tanggal tenggat.'
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => (onOpenOverdueOrders ? onOpenOverdueOrders() : onNavigate('orders'))}
              className={`min-h-[38px] px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                receivables.overdue.length > 0
                  ? 'bg-rose-500 hover:bg-rose-400 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {receivables.overdue.length > 0 ? 'Tinjau Order Terlambat' : 'Lihat Order Belum Lunas'}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#232C3D]/80 bg-[#0B0F17]/80 border border-[#232C3D] rounded-xl overflow-hidden">
            {(receivables.overdue.length > 0
              ? receivables.overdue
              : receivables.dueTodayOrSoon
            )
              .slice(0, 4)
              .map(({ order, due }) => (
                <div
                  key={order.id}
                  className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono font-bold text-sky-400">{order.invoiceNumber}</span>
                    <span className="font-semibold text-[#F8FAFC] truncate">
                      {order.customerName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                        due.status === 'overdue'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {due.label} ({formatDateID(due.dueDate)})
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="font-mono font-bold tabular-nums text-amber-400">
                      Sisa {formatRp(order.remainingAmount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyReminder(order)}
                      className="min-h-[32px] px-2.5 py-1 rounded-lg border border-[#232C3D] bg-[#121824] hover:bg-[#182030] text-[11px] font-semibold text-[#F8FAFC] inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedOrderId === order.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-sky-400" />
                          Tagih WA
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Empty Workspace Quick Start Banner */}
      {isEmptyWorkspace && (
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#F8FAFC]">
              Ruang kerja toko Anda siap digunakan
            </h2>
            <p className="text-sm text-[#94A3B8]">
              Mulai catat order pertama atau muat data contoh percetakan & sablon (produk, HPP,
              omset 6 bulan, stok & gaji) untuk mencoba seluruh fitur.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleSeedDemo}
              disabled={seeding}
              className="min-h-[42px] px-4 py-2 rounded-lg border border-[#232C3D] bg-[#0B0F17] hover:bg-[#182030] text-xs font-semibold text-[#F8FAFC] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Database className="w-4 h-4 text-sky-400" />
              {seeding ? 'Memuat Data...' : 'Muat Data Contoh'}
            </button>
            <button
              type="button"
              onClick={onOpenQuickOrder}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Catat Order Pertama
            </button>
          </div>
        </div>
      )}

      {/* Timeframe Selector (1 Bln up to 5 Thn) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#F8FAFC]">Ringkasan Omset & Profit Bersih</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Periode aktif: <span className="text-[#F8FAFC] font-medium">{activeTimeframeMeta.label}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#121824] border border-[#232C3D] rounded-xl overflow-x-auto">
          {TIMEFRAME_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onTimeframeChange(opt.key)}
              className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                timeframe === opt.key
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#182030]'
              }`}
            >
              {opt.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* 4-Column Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Omset */}
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Nominal Omset ({activeTimeframeMeta.shortLabel})</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-mono font-bold tabular-nums text-[#F8FAFC] tracking-tight">
            {formatRp(totals.omset)}
          </div>
          <div className="text-xs text-[#94A3B8] flex items-center gap-2 truncate">
            <span>Cetak {formatRpCompact(totals.omsetPercetakan)}</span>
            <span aria-hidden="true">·</span>
            <span>Sablon {formatRpCompact(totals.omsetSablon)}</span>
          </div>
        </div>

        {/* Profit Bersih */}
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Profit Bersih ({activeTimeframeMeta.shortLabel})</span>
            <span
              className={`text-xs font-mono font-semibold tabular-nums ${
                totals.profitBersih >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              Margin {totals.marginPercent.toFixed(1)}%
            </span>
          </div>
          <div
            className={`text-2xl font-mono font-bold tabular-nums tracking-tight ${
              totals.profitBersih >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatRp(totals.profitBersih)}
          </div>
          <div className="text-xs text-[#94A3B8] truncate">
            Bulan ini: <span className="font-mono tabular-nums text-[#F8FAFC]">{formatRp(currentMonthRow?.profitBersih || 0)}</span>
          </div>
        </div>

        {/* Pengeluaran & Biaya Lain-lain */}
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Total Biaya ({activeTimeframeMeta.shortLabel})</span>
            <span className="text-xs text-rose-400 font-medium">Keluar</span>
          </div>
          <div className="text-2xl font-mono font-bold tabular-nums text-[#F8FAFC] tracking-tight">
            {formatRp(totals.totalPengeluaran)}
          </div>
          <div className="text-xs text-[#94A3B8] flex items-center gap-1.5 truncate">
            <span>Bahan {formatRpCompact(totals.bahanBaku)}</span>
            <span aria-hidden="true">·</span>
            <span>Gaji {formatRpCompact(totals.gajiKaryawan)}</span>
            <span aria-hidden="true">·</span>
            <span>Lain {formatRpCompact(totals.biayaLainLain)}</span>
          </div>
        </div>

        {/* Piutang & Gaji Belum Dibayar */}
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Sisa Pelunasan Order (Piutang)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-mono font-bold tabular-nums text-amber-400 tracking-tight">
            {formatRp(receivables.total)}
          </div>
          <div className="text-xs text-[#94A3B8] flex items-center gap-2 truncate">
            <span>{receivables.count} order belum lunas</span>
            {unpaidPayrollTotal > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>Gaji terutang {formatRpCompact(unpaidPayrollTotal)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Riwayat HPP & Laba Produksi Summary Strip */}
      <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-[#F8FAFC]">
                Ringkasan Riwayat HPP &amp; Laba Kotor / Bersih ({activeTimeframeMeta.shortLabel})
              </h3>
              <p className="text-xs text-[#94A3B8]">
                {hppSummary.count} catatan produksi terhitung — dikurangi modal HPP, gaji borongan &amp; biaya lain-lain.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ordersWithoutHpp.length > 0 && (
              <button
                type="button"
                onClick={() => (onOpenHppHistory ? onOpenHppHistory() : onNavigate('products'))}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-bold text-amber-300 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                {ordersWithoutHpp.length} Order Belum Input HPP
              </button>
            )}
            <button
              type="button"
              onClick={() => (onOpenHppHistory ? onOpenHppHistory() : onNavigate('products'))}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              Buka Riwayat HPP
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#232C3D]">
            <div className="text-[11px] text-[#94A3B8]">Harga Jual Tercatat</div>
            <div className="text-sm sm:text-base font-mono font-bold tabular-nums text-[#F8FAFC] mt-0.5">
              {formatRp(hppSummary.sellPriceTotal)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#232C3D]">
            <div className="text-[11px] text-[#94A3B8]">Modal Biaya HPP</div>
            <div className="text-sm sm:text-base font-mono font-bold tabular-nums text-amber-400 mt-0.5">
              {formatRp(hppSummary.hppTotal)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#232C3D]">
            <div className="text-[11px] text-[#94A3B8]">Keuntungan Kotor</div>
            <div
              className={`text-sm sm:text-base font-mono font-bold tabular-nums mt-0.5 ${
                hppSummary.grossProfit >= 0 ? 'text-sky-400' : 'text-rose-400'
              }`}
            >
              {formatRp(hppSummary.grossProfit)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#232C3D]">
            <div className="text-[11px] text-[#94A3B8]">Borongan &amp; Biaya Lain</div>
            <div className="text-sm sm:text-base font-mono font-bold tabular-nums text-rose-400 mt-0.5">
              {formatRp(hppSummary.boronganCost + hppSummary.otherCost)}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3 rounded-lg bg-[#0B0F17] border border-emerald-500/25">
            <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
              <span>Keuntungan Bersih HPP</span>
              <span className="font-mono text-[#CBD5E1]">{hppSummary.netMarginPercent.toFixed(1)}%</span>
            </div>
            <div
              className={`text-sm sm:text-base font-mono font-extrabold tabular-nums mt-0.5 ${
                hppSummary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatRp(hppSummary.netProfit)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart + Best-Selling Products Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Monthly Revenue & Net Profit Chart */}
        <div className="lg:col-span-8 bg-[#121824] border border-[#232C3D] rounded-xl p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#F8FAFC]">
                Tren Omset vs Profit Bersih ({activeTimeframeMeta.label})
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Profit bersih sudah dikurangi bahan baku, gaji karyawan, dan biaya lain-lain.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Rincian per Bulan
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-full h-72 mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232C3D" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#232C3D' }}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatRpCompact(Number(v))}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  contentStyle={{
                    backgroundColor: '#0B0F17',
                    borderColor: '#232C3D',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#F8FAFC',
                  }}
                  formatter={(value: unknown) => formatRp(Number(value) || 0)}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="Omset" fill="#0EA5E9" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="Pengeluaran" fill="#64748B" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="Profit Bersih" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Best-Selling Products Ranking */}
        <div className="lg:col-span-4 bg-[#121824] border border-[#232C3D] rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="text-sm font-bold text-[#F8FAFC]">Produk Terlaris</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 whitespace-nowrap"
            >
              Kelola Katalog
            </button>
          </div>

          {bestSellers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 space-y-2">
              <Package className="w-8 h-8 text-[#475569]" />
              <p className="text-sm font-medium text-[#94A3B8]">Belum ada penjualan di periode ini</p>
              <p className="text-xs text-[#64748B]">
                Peringkat otomatis muncul setelah Anda mencatat order pelanggan.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#232C3D] flex-1">
              {bestSellers.map((item, index) => (
                <div key={item.key} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs font-bold text-[#94A3B8] tabular-nums">
                        0{index + 1}.
                      </span>
                      <span className="text-sm font-semibold text-[#F8FAFC] truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-xs text-[#94A3B8] mt-1 pl-6">
                      <span className="capitalize">{item.division}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {item.totalQty} {item.unit}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{item.orderCount} order</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-bold tabular-nums text-[#F8FAFC]">
                      {formatRpCompact(item.totalRevenue)}
                    </div>
                    {item.totalHpp > 0 && (
                      <div className="text-[11px] font-mono tabular-nums text-emerald-400 mt-0.5">
                        +{formatRpCompact(item.estProfit)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Riwayat HPP & Cash Flow Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent HPP Records */}
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400 shrink-0" />
              <h3 className="text-sm font-bold text-[#F8FAFC]">Riwayat HPP Order &amp; Manual Terbaru</h3>
            </div>
            <button
              type="button"
              onClick={() => (onOpenHppHistory ? onOpenHppHistory() : onNavigate('products'))}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 whitespace-nowrap cursor-pointer"
            >
              Kelola Semua HPP
            </button>
          </div>

          {recentHpp.length === 0 ? (
            <p className="text-sm text-[#94A3B8] py-4">
              Belum ada Riwayat HPP pada periode ini. HPP otomatis masuk saat Anda mencatat order atau mengisi HPP manual.
            </p>
          ) : (
            <div className="divide-y divide-[#232C3D]">
              {recentHpp.map((rec) => (
                <div
                  key={rec.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#0B0F17] border border-[#232C3D] font-mono text-[10px] font-bold text-sky-400 shrink-0">
                        {rec.sourceType === 'order' ? rec.invoiceNumber || 'ORDER' : 'MANUAL'}
                      </span>
                      <span className="text-sm font-semibold text-[#F8FAFC] truncate">
                        {rec.itemName}
                      </span>
                    </div>
                    <div className="text-xs text-[#94A3B8] mt-0.5 truncate">
                      <span>{formatDateID(rec.recordDate)}</span>
                      {rec.customerName && (
                        <>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{rec.customerName}</span>
                        </>
                      )}
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>HPP {formatRpCompact(rec.hppTotal)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-mono font-bold tabular-nums ${
                        rec.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      Bersih {formatRp(rec.netProfit)}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-sky-400">
                      Kotor {formatRp(rec.grossProfit)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Pemasukan & Pengeluaran */}
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-bold text-[#F8FAFC]">Data Pemasukan &amp; Pengeluaran Terbaru</h3>
            <button
              type="button"
              onClick={() => onNavigate('cash')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 whitespace-nowrap cursor-pointer"
            >
              Buka Buku Kas
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <p className="text-sm text-[#94A3B8] py-4">
              Belum ada aktivitas pemasukan atau pengeluaran kas pada periode ini.
            </p>
          ) : (
            <div className="divide-y divide-[#232C3D]">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-[#F8FAFC] truncate">
                      {tx.description}
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
                      <span>{formatDateID(tx.date)}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{tx.category}</span>
                    </div>
                  </div>
                  <div
                    className={`text-xs sm:text-sm font-mono font-bold tabular-nums shrink-0 inline-flex items-center gap-1 ${
                      tx.type === 'pemasukan' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tx.type === 'pemasukan' ? (
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    )}
                    {tx.type === 'pemasukan' ? '+' : '-'}
                    {formatRp(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Operational Strip: Unpaid Orders & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Settlement Orders */}
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-bold text-[#F8FAFC]">Order Menunggu Pelunasan</h3>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 whitespace-nowrap"
            >
              Lihat Semua Order
            </button>
          </div>

          {receivables.list.length === 0 ? (
            <p className="text-sm text-[#94A3B8] py-4">
              Semua order saat ini sudah lunas. Tidak ada piutang tertunda.
            </p>
          ) : (
            <div className="divide-y divide-[#232C3D]">
              {receivables.list.map(({ order, due }) => (
                <div
                  key={order.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-[#F8FAFC] truncate">
                        {order.customerName}
                      </span>
                      {due.status === 'overdue' && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold shrink-0">
                          {due.shortLabel}
                        </span>
                      )}
                      {(due.status === 'due_today' || due.status === 'due_soon') && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold shrink-0">
                          {due.shortLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#94A3B8] mt-0.5 truncate">
                      <span className="font-mono">{order.invoiceNumber}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="capitalize">{order.division}</span>
                      {due.dueDate && (
                        <>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span
                            className={
                              due.status === 'overdue'
                                ? 'text-rose-400 font-medium'
                                : due.status === 'due_today' || due.status === 'due_soon'
                                  ? 'text-amber-400 font-medium'
                                  : ''
                            }
                          >
                            Jatuh tempo {formatDateID(due.dueDate)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-bold tabular-nums text-amber-400">
                      Sisa {formatRp(order.remainingAmount)}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-[#94A3B8]">
                      Total {formatRp(order.totalAmount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Raw Materials */}
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="text-sm font-bold text-[#F8FAFC]">Peringatan Stok Bahan Menipis</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('materials')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 whitespace-nowrap"
            >
              Kelola Stok
            </button>
          </div>

          {lowStockMaterials.length === 0 ? (
            <p className="text-sm text-[#94A3B8] py-4">
              {materials.length === 0
                ? 'Belum ada data bahan baku. Tambahkan tinta, kaos polos, atau kertas untuk pemantauan stok.'
                : 'Seluruh stok bahan baku berada di atas batas minimum.'}
            </p>
          ) : (
            <div className="divide-y divide-[#232C3D]">
              {lowStockMaterials.slice(0, 5).map((mat) => (
                <div
                  key={mat.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#F8FAFC] truncate">{mat.name}</div>
                    <div className="text-xs text-[#94A3B8] mt-0.5">
                      <span className="capitalize">{mat.division}</span>
                      {mat.supplier && (
                        <>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{mat.supplier}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-mono font-bold tabular-nums ${
                        mat.stock <= 0 ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    >
                      {mat.stock} {mat.unit}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-[#94A3B8]">
                      Min {mat.minStock} {mat.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
