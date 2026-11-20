import { Timestamp } from 'firebase/firestore';

export type Division = 'percetakan' | 'sablon';
export type CashDivision = 'percetakan' | 'sablon' | 'umum';
export type PaymentMethod = 'tunai' | 'transfer' | 'qris';
export type PaymentStatus = 'belum_bayar' | 'dp' | 'lunas';
export type ProductionStatus = 'antrean' | 'proses' | 'selesai' | 'diambil';
export type TransactionType = 'pemasukan' | 'pengeluaran';
export type ExpenseGroup = 'penjualan' | 'bahan_baku' | 'gaji_karyawan' | 'biaya_lain_lain';
export type ReferenceType = 'manual' | 'order' | 'material' | 'payroll';
export type MaterialCategory =
  | 'tinta'
  | 'kaos_kain'
  | 'kertas_media'
  | 'kimia_sablon'
  | 'finishing'
  | 'lainnya';
export type PayScheme = 'harian' | 'borongan' | 'campuran';
export type PayrollType = 'harian' | 'borongan';
export type PayrollStatus = 'belum_dibayar' | 'dibayar';

export type TimeframeKey = '1m' | '2m' | '3m' | '6m' | '1y' | '2y' | '3y' | '5y';

export type NavTab =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'cash'
  | 'materials'
  | 'payroll'
  | 'reports'
  | 'settings';

export interface ShopProfile {
  ownerId: string;
  shopName: string;
  tagline: string;
  address: string;
  phone: string;
  ownerName: string;
  bankInfo: string;
  invoiceFooter: string;
  logoDataUrl: string;
  accentColor: string;
  invoicePrefix: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface HppComponent {
  label: string;
  amount: number;
  mode: 'per_unit' | 'fixed';
}

export interface Product {
  id: string;
  ownerId: string;
  name: string;
  division: Division;
  unit: string;
  sellPrice: number;
  hppUnit: number;
  hppComponents: HppComponent[];
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  hppUnit: number;
  subtotal: number;
}

export interface Order {
  id: string;
  ownerId: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  division: Division;
  orderDate: string; // YYYY-MM-DD
  deadlineDate: string; // YYYY-MM-DD or ''
  items: OrderItem[];
  discount: number;
  totalAmount: number;
  totalHpp: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  productionStatus: ProductionStatus;
  paymentMethod: PaymentMethod;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Transaction {
  id: string;
  ownerId: string;
  type: TransactionType;
  division: CashDivision;
  expenseGroup: ExpenseGroup;
  category: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string; // YYYY-MM-DD
  referenceType: ReferenceType;
  referenceId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Material {
  id: string;
  ownerId: string;
  name: string;
  category: MaterialCategory;
  division: Division;
  stock: number;
  minStock: number;
  unit: string;
  lastBuyPrice: number;
  supplier: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Employee {
  id: string;
  ownerId: string;
  name: string;
  role: string;
  phone: string;
  payScheme: PayScheme;
  defaultRate: number;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PayrollLog {
  id: string;
  ownerId: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  workDate: string; // YYYY-MM-DD
  payType: PayrollType;
  jobDescription: string;
  quantity: number;
  unitLabel: string;
  rate: number;
  bonus: number;
  deduction: number;
  netAmount: number;
  status: PayrollStatus;
  paidDate: string; // YYYY-MM-DD or ''
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface MonthlyProfitRow {
  monthKey: string; // YYYY-MM
  label: string; // e.g., "Nov 26"
  fullLabel: string; // e.g., "November 2026"
  omset: number;
  omsetPercetakan: number;
  omsetSablon: number;
  bahanBaku: number;
  gajiKaryawan: number;
  biayaLainLain: number;
  totalPengeluaran: number;
  profitBersih: number;
  marginPercent: number;
}

export interface BestSellerRow {
  key: string;
  name: string;
  division: Division;
  unit: string;
  totalQty: number;
  orderCount: number;
  totalRevenue: number;
  totalHpp: number;
  estProfit: number;
}

export interface OrderDraftFromHpp {
  name: string;
  division: Division;
  unit: string;
  qty: number;
  price: number;
  hppUnit: number;
}
