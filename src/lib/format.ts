import {
  BestSellerRow,
  Employee,
  MonthlyProfitRow,
  Order,
  TimeframeKey,
  Transaction,
} from '../types';

export const TIMEFRAME_OPTIONS: { key: TimeframeKey; label: string; shortLabel: string; months: number }[] = [
  { key: '1m', label: '1 Bulan Terakhir', shortLabel: '1 Bln', months: 1 },
  { key: '2m', label: '2 Bulan Terakhir', shortLabel: '2 Bln', months: 2 },
  { key: '3m', label: '3 Bulan Terakhir', shortLabel: '3 Bln', months: 3 },
  { key: '6m', label: '6 Bulan Terakhir', shortLabel: '6 Bln', months: 6 },
  { key: '1y', label: '1 Tahun Terakhir', shortLabel: '1 Thn', months: 12 },
  { key: '2y', label: '2 Tahun Terakhir', shortLabel: '2 Thn', months: 24 },
  { key: '3y', label: '3 Tahun Terakhir', shortLabel: '3 Thn', months: 36 },
  { key: '5y', label: '5 Tahun Terakhir', shortLabel: '5 Thn', months: 60 },
];

const MONTH_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const MONTH_LONG_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatRp(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const isNeg = safe < 0;
  const formatted = new Intl.NumberFormat('id-ID').format(Math.abs(safe));
  return `${isNeg ? '-' : ''}Rp${formatted}`;
}

export function formatRpCompact(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp${(abs / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp${Math.round(abs / 1_000)} rb`;
  }
  return `${sign}Rp${Math.round(abs)}`;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysISO(baseISO: string, days: number): string {
  const [y, m, d] = baseISO.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function formatDateID(iso: string): string {
  if (!iso || iso.length < 10) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTH_SHORT_ID[m - 1] || ''} ${y}`;
}

export function formatMonthKeyLabel(monthKey: string): { short: string; full: string } {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return { short: monthKey, full: monthKey };
  return {
    short: `${MONTH_SHORT_ID[m - 1]} ${String(y).slice(-2)}`,
    full: `${MONTH_LONG_ID[m - 1]} ${y}`,
  };
}

/**
 * Generates ordered YYYY-MM month keys ending in the current month for the given timeframe (1m up to 5y).
 */
export function getMonthKeysForTimeframe(timeframe: TimeframeKey, anchorDate = new Date()): string[] {
  const found = TIMEFRAME_OPTIONS.find((t) => t.key === timeframe);
  const count = found ? found.months : 1;
  const keys: string[] = [];
  const baseYear = anchorDate.getFullYear();
  const baseMonth = anchorDate.getMonth(); // 0-indexed

  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(baseYear, baseMonth - i, 1);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${m}`);
  }
  return keys;
}

export function getStartDateForTimeframe(timeframe: TimeframeKey, anchorDate = new Date()): string {
  const keys = getMonthKeysForTimeframe(timeframe, anchorDate);
  return `${keys[0]}-01`;
}

export function isDateInTimeframe(dateStr: string, timeframe: TimeframeKey, anchorDate = new Date()): boolean {
  if (!dateStr || dateStr.length < 7) return false;
  const keys = getMonthKeysForTimeframe(timeframe, anchorDate);
  const firstKey = keys[0];
  const lastKey = keys[keys.length - 1];
  const ym = dateStr.slice(0, 7);
  return ym >= firstKey && ym <= lastKey;
}

/**
 * Computes monthly revenue, bahan baku, gaji karyawan, biaya lain-lain, and net profit per month.
 */
export function buildMonthlyProfitSeries(
  transactions: Transaction[],
  timeframe: TimeframeKey,
  anchorDate = new Date()
): MonthlyProfitRow[] {
  const monthKeys = getMonthKeysForTimeframe(timeframe, anchorDate);
  const map = new Map<string, MonthlyProfitRow>();

  for (const key of monthKeys) {
    const labels = formatMonthKeyLabel(key);
    map.set(key, {
      monthKey: key,
      label: labels.short,
      fullLabel: labels.full,
      omset: 0,
      omsetPercetakan: 0,
      omsetSablon: 0,
      bahanBaku: 0,
      gajiKaryawan: 0,
      biayaLainLain: 0,
      totalPengeluaran: 0,
      profitBersih: 0,
      marginPercent: 0,
    });
  }

  for (const tx of transactions) {
    const ym = tx.date?.slice(0, 7);
    if (!ym || !map.has(ym)) continue;
    const row = map.get(ym)!;
    const amt = Number(tx.amount) || 0;

    if (tx.type === 'pemasukan') {
      row.omset += amt;
      if (tx.division === 'percetakan') row.omsetPercetakan += amt;
      if (tx.division === 'sablon') row.omsetSablon += amt;
    } else {
      row.totalPengeluaran += amt;
      if (tx.expenseGroup === 'bahan_baku') {
        row.bahanBaku += amt;
      } else if (tx.expenseGroup === 'gaji_karyawan') {
        row.gajiKaryawan += amt;
      } else {
        row.biayaLainLain += amt;
      }
    }
  }

  const rows: MonthlyProfitRow[] = [];
  for (const key of monthKeys) {
    const row = map.get(key)!;
    row.profitBersih = row.omset - row.totalPengeluaran;
    row.marginPercent = row.omset > 0 ? (row.profitBersih / row.omset) * 100 : 0;
    rows.push(row);
  }

  return rows;
}

/**
 * Aggregates best-selling products/services from orders within the chosen timeframe.
 */
export function buildBestSellers(orders: Order[], timeframe: TimeframeKey | 'all'): BestSellerRow[] {
  const map = new Map<string, BestSellerRow>();

  for (const order of orders) {
    if (timeframe !== 'all' && !isDateInTimeframe(order.orderDate, timeframe)) continue;
    for (const item of order.items || []) {
      const normalizedName = (item.name || '').trim();
      if (!normalizedName) continue;
      const key = item.productId
        ? `pid:${item.productId}`
        : `name:${normalizedName.toLowerCase()}|${order.division}`;
      const existing = map.get(key);
      const qty = Number(item.qty) || 0;
      const revenue = Number(item.subtotal) || qty * (Number(item.price) || 0);
      const hppTotal = qty * (Number(item.hppUnit) || 0);

      if (existing) {
        existing.totalQty += qty;
        existing.orderCount += 1;
        existing.totalRevenue += revenue;
        existing.totalHpp += hppTotal;
        existing.estProfit = existing.totalRevenue - existing.totalHpp;
      } else {
        map.set(key, {
          key,
          name: normalizedName,
          division: order.division,
          unit: item.unit || 'pcs',
          totalQty: qty,
          orderCount: 1,
          totalRevenue: revenue,
          totalHpp: hppTotal,
          estProfit: revenue - hppTotal,
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export function generateInvoiceNumber(prefix: string, existingCount: number): string {
  const cleanPrefix = (prefix || 'INV').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'INV';
  const seq = String(existingCount + 1).padStart(3, '0');
  return `${cleanPrefix}${seq}`;
}

export function exportRowsToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Compresses an uploaded shop logo image to a compact square/aspect PNG/WEBP data URL (< 90KB)
 * so it stores safely in Firestore and prints crisply on Invoices and Pay Slips.
 */
export function compressLogoImage(file: File, maxDim = 220): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia.'));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        // Prefer webp for tiny footprint, fallback to png
        let dataUrl = canvas.toDataURL('image/webp', 0.85);
        if (!dataUrl.startsWith('data:image/webp') || dataUrl.length > 130000) {
          dataUrl = canvas.toDataURL('image/png');
        }
        if (dataUrl.length > 140000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        }
        if (dataUrl.length > 148000) {
          reject(new Error('Ukuran logo terlalu besar. Gunakan gambar beresolusi lebih kecil.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function sanitizeString(val: string, maxLen: number): string {
  return (val || '').trim().slice(0, maxLen);
}

/**
 * Checks whether a cash ledger transaction represents an employee cash advance (Kasbon).
 */
export function isKasbonTransaction(tx: Transaction): boolean {
  if (tx.type !== 'pengeluaran' || tx.expenseGroup !== 'gaji_karyawan') return false;
  return /kasbon/i.test(tx.category || '') || /\bkasbon\b/i.test(tx.description || '');
}

/**
 * Returns all Kasbon transactions from Buku Kas belonging to a specific employee
 * (matched by referenceId or employee name fallback), optionally filtered by YYYY-MM month.
 */
export function getEmployeeKasbonTransactions(
  transactions: Transaction[],
  employee: Pick<Employee, 'id' | 'name'>,
  monthKey?: string
): Transaction[] {
  const empNameLower = (employee.name || '').trim().toLowerCase();
  return transactions
    .filter((tx) => {
      if (!isKasbonTransaction(tx)) return false;
      if (monthKey && monthKey !== 'all' && !(tx.date || '').startsWith(monthKey)) {
        return false;
      }
      if (tx.referenceType === 'payroll' && tx.referenceId) {
        return tx.referenceId === employee.id;
      }
      if (!tx.referenceId && empNameLower.length >= 3) {
        return (tx.description || '').toLowerCase().includes(empNameLower);
      }
      return false;
    })
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}
