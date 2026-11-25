import React, { useMemo } from 'react';
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
import { Download, Trophy } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  TIMEFRAME_OPTIONS,
  buildBestSellers,
  buildMonthlyProfitSeries,
  exportRowsToCsv,
  formatRp,
  formatRpCompact,
  summarizeHppRecords,
} from '../lib/format';
import { TimeframeKey } from '../types';

interface ReportsViewProps {
  timeframe: TimeframeKey;
  onTimeframeChange: (tf: TimeframeKey) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ timeframe, onTimeframeChange }) => {
  const { transactions, orders, hppRecords } = useWorkspace();

  const hppTotals = useMemo(
    () => summarizeHppRecords(hppRecords, timeframe),
    [hppRecords, timeframe]
  );

  const monthlySeries = useMemo(
    () => buildMonthlyProfitSeries(transactions, timeframe),
    [transactions, timeframe]
  );

  // Reverse for table display (newest month on top)
  const monthlyTableRows = useMemo(() => [...monthlySeries].reverse(), [monthlySeries]);

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

  const bestSellers = useMemo(() => buildBestSellers(orders, timeframe), [orders, timeframe]);

  const activeMeta = TIMEFRAME_OPTIONS.find((t) => t.key === timeframe) || TIMEFRAME_OPTIONS[0];

  const chartData = useMemo(() => {
    if (monthlySeries.length <= 12) {
      return monthlySeries.map((r) => ({
        label: r.label,
        Omset: r.omset,
        'Biaya Total': r.totalPengeluaran,
        'Profit Bersih': r.profitBersih,
      }));
    }
    const chunkSize = monthlySeries.length >= 48 ? 6 : 3;
    const buckets: { label: string; Omset: number; 'Biaya Total': number; 'Profit Bersih': number }[] =
      [];
    for (let i = 0; i < monthlySeries.length; i += chunkSize) {
      const slice = monthlySeries.slice(i, i + chunkSize);
      const first = slice[0];
      const last = slice[slice.length - 1];
      buckets.push({
        label: slice.length === 1 ? first.label : `${first.label}–${last.label}`,
        Omset: slice.reduce((s, r) => s + r.omset, 0),
        'Biaya Total': slice.reduce((s, r) => s + r.totalPengeluaran, 0),
        'Profit Bersih': slice.reduce((s, r) => s + r.profitBersih, 0),
      });
    }
    return buckets;
  }, [monthlySeries]);

  const handleExportMonthlyCsv = () => {
    exportRowsToCsv(
      `laporan-laba-rugi-${timeframe}.csv`,
      [
        'Bulan',
        'Omset Total (Rp)',
        'Omset Percetakan (Rp)',
        'Omset Sablon (Rp)',
        'Bahan Baku (Rp)',
        'Gaji Karyawan (Rp)',
        'Biaya Lain-Lain (Rp)',
        'Profit Bersih (Rp)',
        'Margin (%)',
      ],
      monthlyTableRows.map((r) => [
        r.fullLabel,
        r.omset,
        r.omsetPercetakan,
        r.omsetSablon,
        r.bahanBaku,
        r.gajiKaryawan,
        r.biayaLainLain,
        r.profitBersih,
        r.marginPercent.toFixed(1),
      ])
    );
  };

  const cetakPct = totals.omset > 0 ? (totals.omsetPercetakan / totals.omset) * 100 : 0;
  const sablonPct = totals.omset > 0 ? (totals.omsetSablon / totals.omset) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header & 1m - 5y Timeframe Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#F8FAFC]">
            Laporan Omset & Profit Bersih per Bulan
          </h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Pilih periode 1 bulan hingga 5 tahun terakhir untuk melihat akumulasi omset, potongan biaya lain-lain, dan profit bersih bulanan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#121824] border border-[#232C3D] rounded-xl overflow-x-auto">
            {TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onTimeframeChange(opt.key)}
                className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  timeframe === opt.key
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#182030]'
                }`}
              >
                {opt.shortLabel}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportMonthlyCsv}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#232C3D] bg-[#121824] hover:bg-[#182030] text-xs font-semibold text-[#F8FAFC] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* 5-Column P&L Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-4">
          <div className="text-xs text-[#94A3B8]">Omset ({activeMeta.shortLabel})</div>
          <div className="text-lg font-mono font-bold tabular-nums text-sky-400 mt-1">
            {formatRp(totals.omset)}
          </div>
        </div>
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-4">
          <div className="text-xs text-[#94A3B8]">− Bahan Baku</div>
          <div className="text-lg font-mono font-semibold tabular-nums text-[#F8FAFC] mt-1">
            {formatRp(totals.bahanBaku)}
          </div>
        </div>
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-4">
          <div className="text-xs text-[#94A3B8]">− Gaji Karyawan</div>
          <div className="text-lg font-mono font-semibold tabular-nums text-[#F8FAFC] mt-1">
            {formatRp(totals.gajiKaryawan)}
          </div>
        </div>
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-4">
          <div className="text-xs text-[#94A3B8]">− Biaya Lain-Lain</div>
          <div className="text-lg font-mono font-semibold tabular-nums text-amber-400 mt-1">
            {formatRp(totals.biayaLainLain)}
          </div>
        </div>
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>= Profit Bersih</span>
            <span className="font-mono font-semibold">{totals.marginPercent.toFixed(1)}%</span>
          </div>
          <div
            className={`text-lg font-mono font-extrabold tabular-nums mt-1 ${
              totals.profitBersih >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatRp(totals.profitBersih)}
          </div>
        </div>
      </div>

      {/* Riwayat HPP P&L Summary */}
      <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#F8FAFC]">
              Rekap Laba Kotor &amp; Bersih Riwayat HPP ({activeMeta.label})
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Berdasarkan {hppTotals.count} catatan HPP order &amp; manual (dipotong modal HPP, gaji borongan &amp; biaya lain-lain).
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#232C3D]">
            <div className="text-[11px] text-[#94A3B8]">Penjualan HPP</div>
            <div className="text-sm font-mono font-bold tabular-nums text-[#F8FAFC] mt-0.5">
              {formatRp(hppTotals.sellPriceTotal)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#232C3D]">
            <div className="text-[11px] text-[#94A3B8]">Modal HPP</div>
            <div className="text-sm font-mono font-bold tabular-nums text-amber-400 mt-0.5">
              {formatRp(hppTotals.hppTotal)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#232C3D]">
            <div className="text-[11px] text-[#94A3B8]">Keuntungan Kotor</div>
            <div className="text-sm font-mono font-bold tabular-nums text-sky-400 mt-0.5">
              {formatRp(hppTotals.grossProfit)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#232C3D]">
            <div className="text-[11px] text-[#94A3B8]">Borongan &amp; Lain</div>
            <div className="text-sm font-mono font-bold tabular-nums text-rose-400 mt-0.5">
              {formatRp(hppTotals.boronganCost + hppTotals.otherCost)}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3 rounded-lg bg-[#0B0F17] border border-emerald-500/25">
            <div className="text-[11px] text-[#94A3B8]">Keuntungan Bersih</div>
            <div
              className={`text-sm font-mono font-extrabold tabular-nums mt-0.5 ${
                hppTotals.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatRp(hppTotals.netProfit)}
            </div>
          </div>
        </div>
      </div>

      {/* Chart + Division Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-[#121824] border border-[#232C3D] rounded-xl p-5 flex flex-col">
          <h3 className="text-sm font-bold text-[#F8FAFC] mb-1">
            Grafik Omset & Profit Bersih ({activeMeta.label})
          </h3>
          <p className="text-xs text-[#94A3B8] mb-4">
            Perbandingan langsung antara total pemasukan, total seluruh biaya, dan sisa profit bersih.
          </p>
          <div className="w-full h-64 mt-auto">
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
                <Bar dataKey="Biaya Total" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="Profit Bersih" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Division Omset Split */}
        <div className="lg:col-span-4 bg-[#121824] border border-[#232C3D] rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#F8FAFC]">Kontribusi Omset per Divisi</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">Periode {activeMeta.label}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-[#F8FAFC]">Divisi Sablon</span>
                <span className="font-mono tabular-nums text-sky-400">
                  {formatRp(totals.omsetSablon)} ({sablonPct.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#0B0F17] overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full"
                  style={{ width: `${Math.min(100, sablonPct)}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-[#F8FAFC]">Divisi Percetakan</span>
                <span className="font-mono tabular-nums text-emerald-400">
                  {formatRp(totals.omsetPercetakan)} ({cetakPct.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#0B0F17] overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, cetakPct)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#232C3D] text-xs text-[#94A3B8] space-y-1">
            <div className="flex justify-between">
              <span>Rata-rata Omset / Bulan</span>
              <span className="font-mono font-semibold text-[#F8FAFC] tabular-nums">
                {formatRp(totals.omset / Math.max(1, monthlySeries.length))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Rata-rata Profit Bersih / Bulan</span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  totals.profitBersih >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatRp(totals.profitBersih / Math.max(1, monthlySeries.length))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Monthly Net Profit Table */}
      <div className="bg-[#121824] border border-[#232C3D] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#232C3D] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#F8FAFC]">
              Tabel Rincian Profit Bersih per Bulan ({monthlyTableRows.length} Bulan)
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Profit Bersih = Omset − Bahan Baku − Gaji Karyawan − Biaya Lain-Lain (listrik, sewa, operasional, dll.)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0B0F17]">
              <tr className="border-b border-[#232C3D] text-xs font-semibold text-[#94A3B8]">
                <th className="py-3 px-4">Bulan</th>
                <th className="py-3 px-4 text-right">Omset</th>
                <th className="py-3 px-4 text-right">Bahan Baku</th>
                <th className="py-3 px-4 text-right">Gaji Karyawan</th>
                <th className="py-3 px-4 text-right">Biaya Lain-Lain</th>
                <th className="py-3 px-4 text-right">Profit Bersih</th>
                <th className="py-3 px-4 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232C3D] text-sm">
              {monthlyTableRows.map((row) => (
                <tr key={row.monthKey} className="hover:bg-[#182030]/60 transition-colors">
                  <td className="py-3 px-4 font-medium text-[#F8FAFC] whitespace-nowrap">
                    {row.fullLabel}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-sky-400 whitespace-nowrap">
                    {formatRp(row.omset)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[#94A3B8] whitespace-nowrap">
                    {formatRp(row.bahanBaku)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[#94A3B8] whitespace-nowrap">
                    {formatRp(row.gajiKaryawan)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-400 whitespace-nowrap">
                    {formatRp(row.biayaLainLain)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                      row.profitBersih >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatRp(row.profitBersih)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#94A3B8] whitespace-nowrap">
                    {row.omset > 0 ? `${row.marginPercent.toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-[#0B0F17] border-t-2 border-[#232C3D] font-bold text-sm">
              <tr>
                <td className="py-3.5 px-4 text-[#F8FAFC]">TOTAL ({activeMeta.shortLabel})</td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sky-400 whitespace-nowrap">
                  {formatRp(totals.omset)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#F8FAFC] whitespace-nowrap">
                  {formatRp(totals.bahanBaku)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#F8FAFC] whitespace-nowrap">
                  {formatRp(totals.gajiKaryawan)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-amber-400 whitespace-nowrap">
                  {formatRp(totals.biayaLainLain)}
                </td>
                <td
                  className={`py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap ${
                    totals.profitBersih >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatRp(totals.profitBersih)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-[#F8FAFC] whitespace-nowrap">
                  {totals.marginPercent.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Best-Selling Products Full Table */}
      <div className="bg-[#121824] border border-[#232C3D] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#232C3D] flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-[#F8FAFC]">
            Peringkat Produk Terlaris ({activeMeta.label})
          </h3>
        </div>
        {bestSellers.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#94A3B8]">
            Belum ada data penjualan produk pada periode {activeMeta.label}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232C3D] text-xs font-semibold text-[#94A3B8] bg-[#0B0F17]/60">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Nama Produk / Layanan</th>
                  <th className="py-3 px-4 text-right">Terjual</th>
                  <th className="py-3 px-4 text-right">Jumlah Order</th>
                  <th className="py-3 px-4 text-right">Total Omset</th>
                  <th className="py-3 px-4 text-right">Estimasi Laba Kotor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232C3D] text-sm">
                {bestSellers.map((item, idx) => (
                  <tr key={item.key} className="hover:bg-[#182030]/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-[#94A3B8]">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#F8FAFC]">{item.name}</div>
                      <div className="text-xs text-[#94A3B8] capitalize">Divisi {item.division}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#F8FAFC] whitespace-nowrap">
                      {item.totalQty} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#94A3B8] whitespace-nowrap">
                      {item.orderCount}x
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-sky-400 whitespace-nowrap">
                      {formatRp(item.totalRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-emerald-400 whitespace-nowrap">
                      {item.totalHpp > 0 ? formatRp(item.estProfit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
