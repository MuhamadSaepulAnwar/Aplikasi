import React, { useMemo, useRef, useState } from 'react';
import { X, Printer, Copy, Check, CheckCircle2, Calendar, FileDown, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Employee, PaymentMethod, PayrollLog, ShopProfile, Transaction } from '../types';
import {
  formatDateID,
  formatMonthKeyLabel,
  formatRp,
  getEmployeeKasbonTransactions,
  todayISO,
} from '../lib/format';
import { exportElementToJpg, exportElementToPdf, printElementDocument } from '../lib/exportDocument';
import { ShopLogo } from '../components/ShopLogo';

interface PaySlipModalProps {
  employee: Employee;
  logs: PayrollLog[];
  transactions: Transaction[];
  initialMonth?: string;
  shop: ShopProfile;
  onMarkPaid: (
    unpaidLogs: PayrollLog[],
    employeeName: string,
    method: PaymentMethod,
    paidDate: string,
    logToCash: boolean,
    kasbonDeduction?: number
  ) => Promise<void>;
  onClose: () => void;
}

export const PaySlipModal: React.FC<PaySlipModalProps> = ({
  employee,
  logs,
  transactions,
  initialMonth = '',
  shop,
  onMarkPaid,
  onClose,
}) => {
  // All Kasbon transactions for this employee across all months
  const allEmployeeKasbons = useMemo(
    () => getEmployeeKasbonTransactions(transactions, employee),
    [transactions, employee]
  );

  // Collect distinct YYYY-MM months present in either work logs or kasbon entries (newest first)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      if (l.workDate && l.workDate.length >= 7) {
        set.add(l.workDate.slice(0, 7));
      }
    }
    for (const k of allEmployeeKasbons) {
      if (k.date && k.date.length >= 7) {
        set.add(k.date.slice(0, 7));
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [logs, allEmployeeKasbons]);

  const defaultMonth = useMemo(() => {
    if (initialMonth && /^\d{4}-\d{2}$/.test(initialMonth)) return initialMonth;
    const currentMonth = todayISO().slice(0, 7);
    if (availableMonths.includes(currentMonth)) return currentMonth;
    if (availableMonths.length > 0) return availableMonths[0];
    return currentMonth;
  }, [initialMonth, availableMonths]);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [copied, setCopied] = useState(false);
  const [paying, setPaying] = useState(false);
  const [busyAction, setBusyAction] = useState<'print' | 'pdf' | 'jpg' | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('tunai');
  const [logToCash, setLogToCash] = useState(true);
  const slipPaperRef = useRef<HTMLDivElement | null>(null);

  const slipAccent =
    !shop.accentColor || shop.accentColor.toUpperCase() === '#0EA5E9'
      ? '#0099FF'
      : shop.accentColor;

  const activeLogs = useMemo(() => {
    const filtered =
      selectedMonth === 'all'
        ? logs
        : logs.filter((l) => (l.workDate || '').startsWith(selectedMonth));
    return [...filtered].sort((a, b) => a.workDate.localeCompare(b.workDate));
  }, [logs, selectedMonth]);

  const activeKasbons = useMemo(() => {
    return getEmployeeKasbonTransactions(transactions, employee, selectedMonth);
  }, [transactions, employee, selectedMonth]);

  const periodMonthLabel = useMemo(() => {
    if (selectedMonth !== 'all' && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      return formatMonthKeyLabel(selectedMonth).full;
    }
    if (availableMonths.length === 1) {
      return formatMonthKeyLabel(availableMonths[0]).full;
    }
    if (availableMonths.length > 1) {
      const oldest = formatMonthKeyLabel(availableMonths[availableMonths.length - 1]).full;
      const newest = formatMonthKeyLabel(availableMonths[0]).full;
      return `${oldest} – ${newest}`;
    }
    return formatMonthKeyLabel(todayISO().slice(0, 7)).full;
  }, [selectedMonth, availableMonths]);

  const summary = useMemo(() => {
    let basePay = 0;
    let totalBonus = 0;
    let totalManualDeduction = 0;
    let totalWorkNet = 0;
    const unpaidLogs: PayrollLog[] = [];

    for (const l of activeLogs) {
      basePay += Math.round(l.quantity * l.rate);
      totalBonus += l.bonus;
      totalManualDeduction += l.deduction;
      totalWorkNet += l.netAmount;
      if (l.status === 'belum_dibayar') unpaidLogs.push(l);
    }

    const totalKasbon = activeKasbons.reduce((s, k) => s + (Number(k.amount) || 0), 0);
    const remainingSalary = totalWorkNet - totalKasbon;
    const unpaidWorkTotal = unpaidLogs.reduce((s, l) => s + l.netAmount, 0);
    const cashPayableNow = Math.max(0, unpaidWorkTotal - totalKasbon);

    return {
      basePay,
      totalBonus,
      totalManualDeduction,
      totalWorkNet,
      totalKasbon,
      remainingSalary,
      unpaidLogs,
      cashPayableNow,
    };
  }, [activeLogs, activeKasbons]);

  const isPaid = activeLogs.length > 0 && summary.unpaidLogs.length === 0;

  const handleCopyWhatsApp = async () => {
    const lines = activeLogs
      .map(
        (l, idx) =>
          `${idx + 1}. [${formatDateID(l.workDate)}] ${l.jobDescription} (${l.quantity} ${l.unitLabel} x ${formatRp(l.rate)}${
            l.bonus > 0 ? ` + bonus ${formatRp(l.bonus)}` : ''
          }${l.deduction > 0 ? ` - pot ${formatRp(l.deduction)}` : ''}) = ${formatRp(l.netAmount)}`
      )
      .join('\n');

    const kasbonLines = activeKasbons
      .map((k, idx) => `${idx + 1}. [${formatDateID(k.date)}] ${k.description}: -${formatRp(k.amount)}`)
      .join('\n');

    const msg = [
      `*SLIP GAJI — ${shop.shopName}*`,
      `Periode Bulan: *${periodMonthLabel}*`,
      '--------------------------------',
      `Nama: ${employee.name}`,
      `Bagian: ${employee.role}`,
      '--------------------------------',
      lines || '(Belum ada catatan pekerjaan)',
      activeKasbons.length > 0 ? `\n*Potongan Kasbon (Buku Kas):*\n${kasbonLines}` : '',
      '--------------------------------',
      `Total Upah Kerja: ${formatRp(summary.basePay)}`,
      summary.totalBonus > 0 ? `Bonus/Lembur: +${formatRp(summary.totalBonus)}` : '',
      summary.totalManualDeduction > 0
        ? `Potongan Lain: -${formatRp(summary.totalManualDeduction)}`
        : '',
      summary.totalKasbon > 0 ? `Total Kasbon: -${formatRp(summary.totalKasbon)}` : '',
      `*${summary.totalKasbon > 0 ? 'SISA GAJI BULAN INI' : 'TOTAL DITERIMA'}: ${formatRp(summary.remainingSalary)}*`,
      `Status: ${isPaid ? 'SUDAH DIBAYAR' : 'BELUM DIBAYAR'}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handlePayNow = async () => {
    if (summary.unpaidLogs.length === 0) return;
    setPaying(true);
    try {
      await onMarkPaid(
        summary.unpaidLogs,
        employee.name,
        payMethod,
        todayISO(),
        logToCash,
        summary.totalKasbon
      );
    } finally {
      setPaying(false);
    }
  };

  const slipFileName = `Slip-Gaji-${employee.name}-${periodMonthLabel}`;

  const handlePrintSlip = async () => {
    if (!slipPaperRef.current || busyAction) return;
    setBusyAction('print');
    try {
      await printElementDocument(
        slipPaperRef.current,
        'a4',
        `Slip Gaji ${employee.name} - ${periodMonthLabel}`
      );
    } catch {
      window.print();
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveSlipPdf = async () => {
    if (!slipPaperRef.current || busyAction) return;
    setBusyAction('pdf');
    try {
      await exportElementToPdf(slipPaperRef.current, slipFileName, 'a4');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveSlipJpg = async () => {
    if (!slipPaperRef.current || busyAction) return;
    setBusyAction('jpg');
    try {
      await exportElementToJpg(slipPaperRef.current, slipFileName);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-2xl my-auto space-y-3">
        {/* Action Toolbar (Hidden when printing) */}
        <div className="no-print bg-[#121824] border border-[#232C3D] rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#94A3B8]">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                <span>Periode:</span>
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="Pilih periode bulan slip gaji"
                className="min-h-[36px] px-3 py-1 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-xs font-semibold text-[#F8FAFC] focus:outline-none focus:border-sky-500"
              >
                {availableMonths.map((mk) => (
                  <option key={mk} value={mk}>
                    {formatMonthKeyLabel(mk).full}
                  </option>
                ))}
                {!availableMonths.includes(defaultMonth) && defaultMonth !== 'all' && (
                  <option value={defaultMonth}>{formatMonthKeyLabel(defaultMonth).full}</option>
                )}
                {availableMonths.length > 1 && <option value="all">Semua Bulan</option>}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#232C3D] bg-[#0B0F17] hover:bg-[#182030] text-xs font-semibold text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin WA
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleSaveSlipJpg()}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50 text-emerald-400 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {busyAction === 'jpg' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5" />
                )}
                JPG
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleSaveSlipPdf()}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-amber-500/35 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-50 text-amber-400 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {busyAction === 'pdf' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                PDF
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handlePrintSlip()}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {busyAction === 'print' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                Cetak
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup slip gaji"
                className="min-h-[38px] min-w-[38px] rounded-lg border border-[#232C3D] hover:bg-[#182030] text-[#94A3B8] hover:text-white inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {summary.unpaidLogs.length > 0 && (
            <div className="pt-3 border-t border-[#232C3D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-[#F8FAFC]"
                >
                  <option value="tunai">Bayar Tunai</option>
                  <option value="transfer">Transfer Bank</option>
                  <option value="qris">QRIS</option>
                </select>
                <label className="inline-flex items-center gap-2 text-[#F8FAFC] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logToCash}
                    onChange={(e) => setLogToCash(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <span>Catat sisa gaji ke Buku Kas</span>
                </label>
              </div>
              <button
                type="button"
                onClick={handlePayNow}
                disabled={paying}
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {paying
                  ? 'Memproses...'
                  : summary.cashPayableNow > 0
                    ? `Bayar Sisa ${formatRp(summary.cashPayableNow)} & Lunas`
                    : 'Tandai Lunas (Tertutup Kasbon)'}
              </button>
            </div>
          )}
        </div>

        {/* Printable Clean & Modern Pay Slip */}
        <div
          ref={slipPaperRef}
          className="print-only-container bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        >
          {/* Sleek top accent bar */}
          <div className="h-1.5 w-full" style={{ backgroundColor: slipAccent }} />

          <div className="p-6 sm:p-8 space-y-5">
            {/* 1. Simple Branded Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {shop.logoDataUrl ? (
                  <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                    <img
                      src={shop.logoDataUrl}
                      alt={`Logo ${shop.shopName}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <ShopLogo
                    logoDataUrl={shop.logoDataUrl}
                    shopName={shop.shopName}
                    accentColor={slipAccent}
                    size="md"
                    lightSurface
                  />
                )}
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight leading-tight truncate">
                    {shop.shopName}
                  </h2>
                  {shop.tagline && (
                    <p className="text-[11px] font-semibold text-slate-600 mt-0.5 truncate">
                      {shop.tagline}
                    </p>
                  )}
                  {(shop.address || shop.phone) && (
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {[shop.address, shop.phone].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div
                  className="text-base sm:text-lg font-extrabold tracking-wide uppercase leading-none"
                  style={{ color: slipAccent }}
                >
                  SLIP GAJI
                </div>
                <div className="text-xs font-extrabold text-slate-900 mt-1.5">
                  {periodMonthLabel}
                </div>
                <div
                  className={`text-[10px] font-extrabold uppercase tracking-wider mt-1 ${
                    isPaid ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {isPaid ? '● LUNAS' : '● BELUM DIBAYAR'}
                </div>
              </div>
            </div>

            {/* 2. Clean Employee & Period Strip */}
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-t border-b text-xs"
              style={{ borderColor: `${slipAccent}55` }}
            >
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Karyawan
                </div>
                <div className="font-extrabold text-slate-950 mt-0.5">{employee.name}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Bagian
                </div>
                <div className="font-bold text-slate-800 mt-0.5">{employee.role}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Periode Bulan
                </div>
                <div className="font-extrabold text-slate-950 mt-0.5">{periodMonthLabel}</div>
              </div>
              <div className="sm:text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Tanggal Cetak
                </div>
                <div className="font-bold text-slate-800 mt-0.5 tabular-nums">
                  {formatDateID(todayISO())}
                </div>
              </div>
            </div>

            {/* 3. Streamlined 4-Column Job Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr
                    className="text-left text-[11px] font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: slipAccent }}
                  >
                    <th className="py-2 px-3 rounded-tl-md">Tanggal</th>
                    <th className="py-2 px-2">Pekerjaan</th>
                    <th className="py-2 px-2 text-right">Volume × Tarif</th>
                    <th className="py-2 px-3 text-right rounded-tr-md">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 border-b border-slate-200">
                  {activeLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Belum ada catatan pekerjaan pada periode {periodMonthLabel}.
                      </td>
                    </tr>
                  ) : (
                    activeLogs.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap align-top">
                          {formatDateID(l.workDate)}
                        </td>
                        <td className="py-2.5 px-2 align-top">
                          <div className="font-bold text-slate-900">{l.jobDescription}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                            <span className="capitalize">{l.payType}</span>
                            {l.bonus > 0 && (
                              <span className="text-emerald-700 font-semibold">
                                +Bonus {formatRp(l.bonus)}
                              </span>
                            )}
                            {l.deduction > 0 && (
                              <span className="text-rose-700 font-semibold">
                                -Pot {formatRp(l.deduction)}
                              </span>
                            )}
                            {l.notes && <span>· {l.notes}</span>}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap align-top">
                          {l.quantity} {l.unitLabel} × {formatRp(l.rate)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-950 tabular-nums whitespace-nowrap align-top">
                          {formatRp(l.netAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 3B. Automatic Kasbon Deductions from Buku Kas */}
            {activeKasbons.length > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/60 overflow-hidden">
                <div className="px-3 py-1.5 bg-rose-100/80 border-b border-rose-200 flex items-center justify-between text-[11px] font-bold text-rose-800">
                  <span>Potongan Kasbon (Otomatis dari Buku Kas — {periodMonthLabel})</span>
                  <span className="font-mono tabular-nums">
                    -{formatRp(summary.totalKasbon)}
                  </span>
                </div>
                <div className="divide-y divide-rose-200/70 text-xs">
                  {activeKasbons.map((k) => (
                    <div
                      key={k.id}
                      className="px-3 py-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className="font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDateID(k.date)}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">
                          {k.description}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-rose-700 tabular-nums whitespace-nowrap">
                        -{formatRp(k.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Compact Bottom: Signatures Left & Clean Totals Right */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-1 items-end">
              {/* Compact Signatures */}
              <div className="sm:col-span-6 grid grid-cols-2 gap-4 text-center text-[11px] order-2 sm:order-1 pt-2">
                <div>
                  <div className="text-slate-400">Diserahkan,</div>
                  <div className="h-12" />
                  <div className="font-bold text-slate-900 border-t border-slate-300 pt-1">
                    {shop.ownerName || shop.shopName}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Diterima,</div>
                  <div className="h-12" />
                  <div className="font-bold text-slate-900 border-t border-slate-300 pt-1">
                    {employee.name}
                  </div>
                </div>
              </div>

              {/* Minimal Totals Stack */}
              <div className="sm:col-span-6 space-y-1.5 text-xs order-1 sm:order-2">
                <div className="flex justify-between px-2 text-slate-600">
                  <span>Upah Kerja ({activeLogs.length} item)</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatRp(summary.basePay)}
                  </span>
                </div>
                {summary.totalBonus > 0 && (
                  <div className="flex justify-between px-2 text-emerald-700">
                    <span>Bonus / Lembur</span>
                    <span className="font-mono font-semibold tabular-nums">
                      +{formatRp(summary.totalBonus)}
                    </span>
                  </div>
                )}
                {summary.totalManualDeduction > 0 && (
                  <div className="flex justify-between px-2 text-rose-700">
                    <span>Potongan Lain</span>
                    <span className="font-mono font-semibold tabular-nums">
                      -{formatRp(summary.totalManualDeduction)}
                    </span>
                  </div>
                )}
                {summary.totalKasbon > 0 && (
                  <div className="flex justify-between px-2 text-rose-700 font-semibold">
                    <span>Potongan Kasbon ({activeKasbons.length}×)</span>
                    <span className="font-mono tabular-nums">
                      -{formatRp(summary.totalKasbon)}
                    </span>
                  </div>
                )}
                <div
                  className="flex justify-between items-center px-3 py-2 rounded-lg text-white font-extrabold text-sm mt-1"
                  style={{
                    backgroundColor:
                      summary.remainingSalary < 0 ? '#E11D48' : slipAccent,
                  }}
                >
                  <span>
                    {summary.remainingSalary < 0
                      ? 'LEBIH KASBON'
                      : summary.totalKasbon > 0
                        ? 'SISA GAJI BULAN INI'
                        : 'TOTAL DITERIMA'}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatRp(summary.remainingSalary)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
