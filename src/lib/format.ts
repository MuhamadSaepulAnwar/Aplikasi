import {
  BestSellerRow,
  DesignPlacement,
  Employee,
  GarmentStyle,
  HppRecord,
  MonthlyProfitRow,
  Order,
  OrderItem,
  ShirtPola,
  ShirtProductionSpec,
  ShirtSizeRow,
  ShopProfile,
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

export type OrderDueStatus =
  | 'paid'
  | 'overdue'
  | 'due_today'
  | 'due_soon'
  | 'upcoming'
  | 'no_deadline';

export interface OrderDueInfo {
  status: OrderDueStatus;
  dueDate: string;
  daysDiff: number; // positive = days remaining, negative = days overdue
  overdueDays: number;
  label: string;
  shortLabel: string;
}

/**
 * Computes signed day difference (targetISO - baseISO) safely in local calendar days.
 */
export function diffDaysISO(targetISO: string, baseISO = todayISO()): number {
  const [ty, tm, td] = targetISO.slice(0, 10).split('-').map(Number);
  const [by, bm, bd] = baseISO.slice(0, 10).split('-').map(Number);
  if (!ty || !tm || !td || !by || !bm || !bd) return 0;
  const targetMs = Date.UTC(ty, tm - 1, td);
  const baseMs = Date.UTC(by, bm - 1, bd);
  return Math.round((targetMs - baseMs) / 86_400_000);
}

/**
 * Evaluates automatic due-date reminder status for orders with Belum Lunas / DP status.
 */
export function getOrderDueInfo(order: Order, referenceISO = todayISO()): OrderDueInfo {
  if (order.paymentStatus === 'lunas' || order.remainingAmount <= 0) {
    return {
      status: 'paid',
      dueDate: order.deadlineDate || '',
      daysDiff: 0,
      overdueDays: 0,
      label: 'Lunas',
      shortLabel: 'Lunas',
    };
  }

  const dueDate = (order.deadlineDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return {
      status: 'no_deadline',
      dueDate: '',
      daysDiff: 9999,
      overdueDays: 0,
      label: 'Jatuh tempo belum diatur',
      shortLabel: 'Tanpa tenggat',
    };
  }

  const daysDiff = diffDaysISO(dueDate, referenceISO);

  if (daysDiff < 0) {
    const overdueDays = Math.abs(daysDiff);
    return {
      status: 'overdue',
      dueDate,
      daysDiff,
      overdueDays,
      label: `Lewat tenggat ${overdueDays} hari`,
      shortLabel: `Lewat ${overdueDays} hr`,
    };
  }

  if (daysDiff === 0) {
    return {
      status: 'due_today',
      dueDate,
      daysDiff: 0,
      overdueDays: 0,
      label: 'Jatuh tempo hari ini',
      shortLabel: 'Hari ini',
    };
  }

  if (daysDiff <= 3) {
    return {
      status: 'due_soon',
      dueDate,
      daysDiff,
      overdueDays: 0,
      label: `Jatuh tempo ${daysDiff} hari lagi`,
      shortLabel: `${daysDiff} hr lagi`,
    };
  }

  return {
    status: 'upcoming',
    dueDate,
    daysDiff,
    overdueDays: 0,
    label: `Jatuh tempo ${daysDiff} hari lagi`,
    shortLabel: `${daysDiff} hr lagi`,
  };
}

/**
 * Formats a polite WhatsApp payment reminder message for a Belum Lunas / DP order.
 */
export function buildOrderReminderMessage(order: Order, shop: ShopProfile): string {
  const due = getOrderDueInfo(order);
  const statusLine =
    due.status === 'overdue'
      ? `Tenggat pelunasan pada *${formatDateID(due.dueDate)}* (lewat ${due.overdueDays} hari).`
      : due.status === 'due_today'
        ? `Tenggat pelunasan jatuh pada *hari ini (${formatDateID(due.dueDate)})*.`
        : due.dueDate
          ? `Estimasi jatuh tempo pelunasan: *${formatDateID(due.dueDate)}*.`
          : '';

  return [
    `Halo Kak *${order.customerName}*,`,
    `Kami dari *${shop.shopName}* ingin menginformasikan pengingat pelunasan order *${order.invoiceNumber}* (${order.items.map((i) => i.name).slice(0, 2).join(', ')}).`,
    '',
    `Total Order: ${formatRp(order.totalAmount)}`,
    `Sudah Dibayar (DP): ${formatRp(order.paidAmount)}`,
    `*Sisa Pelunasan: ${formatRp(order.remainingAmount)}*`,
    statusLine,
    shop.bankInfo ? `\nPembayaran dapat ditransfer ke:\n${shop.bankInfo}` : '',
    '\nTerima kasih!',
  ]
    .filter(Boolean)
    .join('\n');
}

export const SHIRT_SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'] as const;
export const SHIRT_POLA_OPTIONS: ShirtPola[] = ['T-SHIRT', 'RAGLAN', '3/4', 'B', 'C'];
export const GARMENT_STYLE_OPTIONS: { id: GarmentStyle; label: string }[] = [
  { id: 'pendek', label: 'Pendek' },
  { id: 'panjang', label: 'Panjang' },
  { id: 'raglan', label: 'Raglan' },
  { id: 'oversize', label: 'Oversize' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'polo', label: 'Polo' },
];

export const DEFAULT_FRONT_PLACEMENT: DesignPlacement = { x: 50, y: 42, scale: 38 };
export const DEFAULT_BACK_PLACEMENT: DesignPlacement = { x: 50, y: 40, scale: 40 };

export function createDefaultShirtSpec(): ShirtProductionSpec {
  return {
    enabled: false,
    orderTitle: '',
    material: 'Combed 30s',
    shirtColor: '',
    shirtColorHex: '#94A3B8',
    sleeveColorHex: '#1E293B',
    garmentStyle: 'pendek',
    inkType: 'Plastisol',
    pola: 'T-SHIRT',
    frontDesignSize: '',
    backDesignSize: '',
    frontPlacement: { ...DEFAULT_FRONT_PLACEMENT },
    backPlacement: { ...DEFAULT_BACK_PLACEMENT },
    mockupDisplayMode: 'template_overlay',
    frontMockupDataUrl: '',
    backMockupDataUrl: '',
    swatchColors: ['#FFFFFF', '#0284C7'],
    sizeMatrix: SHIRT_SIZE_LABELS.map((size) => ({
      size,
      pendek: 0,
      panjang: 0,
      tigaPerempat: 0,
      oversize: 0,
    })),
    sablonNotes: '',
    sewingNotes: '',
    finishingNotes: 'Press Doff',
  };
}

export function getShirtSizeTotals(sizeMatrix: ShirtSizeRow[] = []) {
  return sizeMatrix.reduce(
    (acc, row) => {
      const pdk = Math.max(0, Math.round(Number(row.pendek) || 0));
      const pjg = Math.max(0, Math.round(Number(row.panjang) || 0));
      const tp = Math.max(0, Math.round(Number(row.tigaPerempat) || 0));
      const ovs = Math.max(0, Math.round(Number(row.oversize) || 0));
      acc.pendek += pdk;
      acc.panjang += pjg;
      acc.tigaPerempat += tp;
      acc.oversize += ovs;
      acc.grandTotal += pdk + pjg + tp + ovs;
      return acc;
    },
    { pendek: 0, panjang: 0, tigaPerempat: 0, oversize: 0, grandTotal: 0 }
  );
}

/**
 * Accepts ONLY PNG files and preserves full alpha transparency while scaling
 * cleanly so the PNG data URL fits within the 330KB Firestore field limit.
 */
export function compressMockupImage(
  file: File,
  maxDim = 760,
  maxLength = 320000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const isPng =
      file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (!isPng) {
      reject(new Error('Desain hanya bisa diupload dalam format PNG (.png).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar PNG.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File PNG tidak valid atau rusak.'));
      img.onload = () => {
        let currentDim = maxDim;
        while (currentDim >= 220) {
          const scale = Math.min(1, currentDim / Math.max(img.width, img.height));
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
          const pngUrl = canvas.toDataURL('image/png');
          if (pngUrl.length <= maxLength) {
            resolve(pngUrl);
            return;
          }
          currentDim = Math.round(currentDim * 0.8);
        }
        reject(
          new Error(
            'Ukuran file PNG terlalu besar setelah kompresi. Gunakan PNG beresolusi lebih ringkas.'
          )
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function sanitizePlacement(
  p: DesignPlacement | undefined,
  fallback: DesignPlacement
): DesignPlacement {
  if (!p) return { ...fallback };
  const x = Number.isFinite(Number(p.x)) ? Math.max(5, Math.min(95, Math.round(Number(p.x)))) : fallback.x;
  const y = Number.isFinite(Number(p.y)) ? Math.max(5, Math.min(95, Math.round(Number(p.y)))) : fallback.y;
  const scale = Number.isFinite(Number(p.scale))
    ? Math.max(10, Math.min(100, Math.round(Number(p.scale))))
    : fallback.scale;
  return { x, y, scale };
}

export function sanitizeShirtSpec(spec?: ShirtProductionSpec): ShirtProductionSpec {
  const base = createDefaultShirtSpec();
  if (!spec) return base;

  const validPola: ShirtPola = SHIRT_POLA_OPTIONS.includes(spec.pola) ? spec.pola : 'T-SHIRT';
  const validGarment: GarmentStyle = GARMENT_STYLE_OPTIONS.some((g) => g.id === spec.garmentStyle)
    ? (spec.garmentStyle as GarmentStyle)
    : 'pendek';
  const validHex = /^#[0-9a-fA-F]{6}$/.test(spec.shirtColorHex || '')
    ? spec.shirtColorHex
    : base.shirtColorHex;
  const validSleeveHex = /^#[0-9a-fA-F]{6}$/.test(spec.sleeveColorHex || '')
    ? (spec.sleeveColorHex as string)
    : base.sleeveColorHex!;
  const validMode =
    spec.mockupDisplayMode === 'uploaded_mockup' ? 'uploaded_mockup' : 'template_overlay';

  const cleanSwatches = (spec.swatchColors || [])
    .slice(0, 20)
    .map((c) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#FFFFFF'));

  const rowMap = new Map<string, ShirtSizeRow>();
  for (const row of spec.sizeMatrix || []) {
    const key = sanitizeString(row.size, 10).toUpperCase();
    if (!key) continue;
    rowMap.set(key, {
      size: key,
      pendek: Math.max(0, Math.min(100000, Math.round(Number(row.pendek) || 0))),
      panjang: Math.max(0, Math.min(100000, Math.round(Number(row.panjang) || 0))),
      tigaPerempat: Math.max(0, Math.min(100000, Math.round(Number(row.tigaPerempat) || 0))),
      oversize: Math.max(0, Math.min(100000, Math.round(Number(row.oversize) || 0))),
    });
  }

  const cleanMatrix: ShirtSizeRow[] = SHIRT_SIZE_LABELS.map(
    (lbl) =>
      rowMap.get(lbl) || {
        size: lbl,
        pendek: 0,
        panjang: 0,
        tigaPerempat: 0,
        oversize: 0,
      }
  );

  return {
    enabled: Boolean(spec.enabled),
    orderTitle: sanitizeString(spec.orderTitle, 100),
    material: sanitizeString(spec.material, 80),
    shirtColor: sanitizeString(spec.shirtColor, 80),
    shirtColorHex: validHex,
    sleeveColorHex: validSleeveHex,
    garmentStyle: validGarment,
    inkType: sanitizeString(spec.inkType, 80),
    pola: validPola,
    frontDesignSize: sanitizeString(spec.frontDesignSize, 60),
    backDesignSize: sanitizeString(spec.backDesignSize, 60),
    frontPlacement: sanitizePlacement(spec.frontPlacement, DEFAULT_FRONT_PLACEMENT),
    backPlacement: sanitizePlacement(spec.backPlacement, DEFAULT_BACK_PLACEMENT),
    mockupDisplayMode: validMode,
    frontMockupDataUrl: (spec.frontMockupDataUrl || '').slice(0, 329000),
    backMockupDataUrl: (spec.backMockupDataUrl || '').slice(0, 329000),
    swatchColors: cleanSwatches.length > 0 ? cleanSwatches : ['#FFFFFF', '#0284C7'],
    sizeMatrix: cleanMatrix,
    sablonNotes: sanitizeString(spec.sablonNotes, 600),
    sewingNotes: sanitizeString(spec.sewingNotes, 300),
    finishingNotes: sanitizeString(spec.finishingNotes, 300),
  };
}

export interface HppSummaryTotals {
  count: number;
  sellPriceTotal: number;
  hppTotal: number;
  boronganCost: number;
  otherCost: number;
  grossProfit: number;
  netProfit: number;
  grossMarginPercent: number;
  netMarginPercent: number;
}

export function summarizeHppRecords(
  records: HppRecord[],
  timeframe: TimeframeKey | 'all' = 'all'
): HppSummaryTotals {
  let count = 0;
  let sellPriceTotal = 0;
  let hppTotal = 0;
  let boronganCost = 0;
  let otherCost = 0;
  let grossProfit = 0;
  let netProfit = 0;

  for (const r of records) {
    if (timeframe !== 'all' && !isDateInTimeframe(r.recordDate, timeframe)) continue;
    count += 1;
    sellPriceTotal += Number(r.sellPriceTotal) || 0;
    hppTotal += Number(r.hppTotal) || 0;
    boronganCost += Number(r.boronganCost) || 0;
    otherCost += Number(r.otherCost) || 0;
    grossProfit += Number(r.grossProfit) || 0;
    netProfit += Number(r.netProfit) || 0;
  }

  return {
    count,
    sellPriceTotal,
    hppTotal,
    boronganCost,
    otherCost,
    grossProfit,
    netProfit,
    grossMarginPercent: sellPriceTotal > 0 ? (grossProfit / sellPriceTotal) * 100 : 0,
    netMarginPercent: sellPriceTotal > 0 ? (netProfit / sellPriceTotal) * 100 : 0,
  };
}

/**
 * Finds orders that haven't had their HPP entered yet (either no HppRecord or totalHpp === 0).
 */
export function getOrdersWithoutHpp(orders: Order[], hppRecords: HppRecord[]): Order[] {
  const linkedOrderIds = new Set(hppRecords.map((h) => h.orderId).filter(Boolean));
  return orders.filter((o) => !linkedOrderIds.has(o.id) && (Number(o.totalHpp) || 0) <= 0);
}

/**
 * Distributes an updated total HPP across an order's line items without changing prices or subtotals.
 */
export function applyHppUnitToOrderItems(items: OrderItem[], hppUnit: number): OrderItem[] {
  const safeHppUnit = Math.max(0, Math.round(Number(hppUnit) || 0));
  return (items || []).map((it) => ({
    ...it,
    hppUnit: safeHppUnit,
  }));
}


