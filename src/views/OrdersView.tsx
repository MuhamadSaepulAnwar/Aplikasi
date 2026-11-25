import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Printer,
  Wallet,
  Trash2,
  Edit3,
  X,
  PackagePlus,
  BellRing,
  Copy,
  Check,
  Shirt,
  Upload,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  addDaysISO,
  buildOrderReminderMessage,
  compressMockupImage,
  createDefaultShirtSpec,
  DEFAULT_BACK_PLACEMENT,
  DEFAULT_FRONT_PLACEMENT,
  formatDateID,
  formatRp,
  GARMENT_STYLE_OPTIONS,
  generateInvoiceNumber,
  getOrderDueInfo,
  getShirtSizeTotals,
  sanitizeShirtSpec,
  SHIRT_POLA_OPTIONS,
  todayISO,
} from '../lib/format';
import {
  DesignPlacement,
  Division,
  GarmentStyle,
  MockupDisplayMode,
  Order,
  OrderDraftFromHpp,
  OrderItem,
  PaymentMethod,
  PaymentStatus,
  ProductionStatus,
  ShirtPola,
  ShirtProductionSpec,
  ShirtSizeRow,
} from '../types';
import { InvoiceModal } from './InvoiceModal';
import { VectorGarmentMockup } from '../components/ShirtPurchaseOrderSheet';

interface OrdersViewProps {
  openNewTrigger?: number;
  overdueFilterTrigger?: number;
  draftFromHpp?: OrderDraftFromHpp | null;
  onConsumeDraft?: () => void;
}

const PRODUCTION_LABELS: Record<ProductionStatus, string> = {
  antrean: 'Antrean',
  proses: 'Proses Produksi',
  selesai: 'Siap Ambil',
  diambil: 'Sudah Diambil',
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  belum_bayar: 'Belum Bayar',
  dp: 'DP Sebagian',
  lunas: 'Lunas',
};

const SHIRT_COLOR_PRESETS = [
  { label: 'Hitam', hex: '#18181B' },
  { label: 'Putih', hex: '#FFFFFF' },
  { label: 'Navy / Dongker', hex: '#1E293B' },
  { label: 'Abu Misty', hex: '#94A3B8' },
  { label: 'Maroon', hex: '#7F1D1D' },
  { label: 'Hijau Botol', hex: '#14532D' },
];

export const OrdersView: React.FC<OrdersViewProps> = ({
  openNewTrigger,
  overdueFilterTrigger,
  draftFromHpp,
  onConsumeDraft,
}) => {
  const {
    orders,
    products,
    hppRecords,
    shopProfile,
    createOrder,
    updateOrder,
    recordOrderPayment,
    updateOrderProductionStatus,
    deleteOrder,
    notify,
  } = useWorkspace();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [divisionFilter, setDivisionFilter] = useState<'all' | Division>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [copiedReminderId, setCopiedReminderId] = useState<string | null>(null);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [payModalOrder, setPayModalOrder] = useState<Order | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Order Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [division, setDivision] = useState<Division>('sablon');
  const [orderDate, setOrderDate] = useState(todayISO());
  const [deadlineDate, setDeadlineDate] = useState(addDaysISO(todayISO(), 5));
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const [productionStatus, setProductionStatus] = useState<ProductionStatus>('antrean');
  const [notes, setNotes] = useState('');
  const [shirtSpec, setShirtSpec] = useState<ShirtProductionSpec>(createDefaultShirtSpec());
  const [shirtEditorOpen, setShirtEditorOpen] = useState(false);
  const [uploadingMockupSide, setUploadingMockupSide] = useState<'front' | 'back' | null>(null);
  const [autoLogCash, setAutoLogCash] = useState(true);
  const [boronganCost, setBoronganCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [syncHppToCash, setSyncHppToCash] = useState(true);
  const [logPaidIncreaseToCash, setLogPaidIncreaseToCash] = useState(true);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [saving, setSaving] = useState(false);

  // Payment Settlement Modal State
  const [addedPayment, setAddedPayment] = useState(0);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('transfer');
  const [settleDate, setSettleDate] = useState(todayISO());
  const [settleAutoCash, setSettleAutoCash] = useState(true);

  const openCreateForm = (prefill?: OrderDraftFromHpp) => {
    setEditingOrder(null);
    setInvoiceNumber(generateInvoiceNumber(shopProfile.invoicePrefix, orders.length));
    setCustomerName('');
    setCustomerPhone('');
    setDivision(prefill?.division || 'sablon');
    const today = todayISO();
    setOrderDate(today);
    setDeadlineDate(addDaysISO(today, 5));
    if (prefill) {
      setItems([
        {
          productId: '',
          name: prefill.name,
          qty: prefill.qty,
          unit: prefill.unit,
          price: prefill.price,
          hppUnit: prefill.hppUnit,
          subtotal: Math.round(prefill.qty * prefill.price),
        },
      ]);
    } else {
      setItems([
        {
          productId: '',
          name: '',
          qty: 1,
          unit: 'pcs',
          price: 0,
          hppUnit: 0,
          subtotal: 0,
        },
      ]);
    }
    setDiscount(0);
    setPaidAmount(0);
    setPaymentMethod('transfer');
    setProductionStatus('antrean');
    setNotes('');
    setShirtSpec(createDefaultShirtSpec());
    setShirtEditorOpen(false);
    setAutoLogCash(true);
    setBoronganCost(0);
    setOtherCost(0);
    setSyncHppToCash(true);
    setLogPaidIncreaseToCash(true);
    setSelectedCatalogId('');
    setShowForm(true);
  };

  useEffect(() => {
    if (openNewTrigger && openNewTrigger > 0) {
      openCreateForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNewTrigger]);

  useEffect(() => {
    if (draftFromHpp) {
      openCreateForm(draftFromHpp);
      onConsumeDraft?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFromHpp]);

  useEffect(() => {
    if (overdueFilterTrigger && overdueFilterTrigger > 0) {
      setOverdueOnly(true);
      setStatusFilter('all');
    }
  }, [overdueFilterTrigger]);

  const openEditForm = (order: Order) => {
    setEditingOrder(order);
    setInvoiceNumber(order.invoiceNumber);
    setCustomerName(order.customerName);
    setCustomerPhone(order.customerPhone);
    setDivision(order.division);
    setOrderDate(order.orderDate);
    setDeadlineDate(order.deadlineDate);
    setItems(order.items.map((it) => ({ ...it })));
    setDiscount(order.discount);
    setPaidAmount(order.paidAmount);
    setPaymentMethod(order.paymentMethod);
    setProductionStatus(order.productionStatus);
    setNotes(order.notes);
    const loadedSpec = order.shirtSpec
      ? sanitizeShirtSpec(order.shirtSpec)
      : createDefaultShirtSpec();
    setShirtSpec(loadedSpec);
    setShirtEditorOpen(Boolean(order.shirtSpec?.enabled));
    const linkedHpp = hppRecords.find((h) => h.orderId === order.id);
    setBoronganCost(linkedHpp?.boronganCost || 0);
    setOtherCost(linkedHpp?.otherCost || 0);
    setSyncHppToCash(linkedHpp ? linkedHpp.syncToCash : true);
    setLogPaidIncreaseToCash(true);
    setSelectedCatalogId('');
    setShowForm(true);
  };

  const handleAddFromCatalog = (productId: string) => {
    setSelectedCatalogId('');
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const newItem: OrderItem = {
      productId: prod.id,
      name: prod.name,
      qty: 1,
      unit: prod.unit,
      price: prod.sellPrice,
      hppUnit: prod.hppUnit,
      subtotal: prod.sellPrice,
    };

    setDivision(prod.division);
    setItems((prev) => {
      // Replace first empty placeholder row if untouched
      if (prev.length === 1 && !prev[0].name.trim() && prev[0].price === 0) {
        return [newItem];
      }
      return [...prev, newItem];
    });
  };

  const updateItemField = (index: number, patch: Partial<OrderItem>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const next = { ...it, ...patch };
        next.subtotal = Math.round((Number(next.qty) || 0) * (Number(next.price) || 0));
        return next;
      })
    );
  };

  const removeItemRow = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const addEmptyItemRow = () => {
    setItems((prev) => [
      ...prev,
      { productId: '', name: '', qty: 1, unit: 'pcs', price: 0, hppUnit: 0, subtotal: 0 },
    ]);
  };

  const formSummary = useMemo(() => {
    const gross = items.reduce((s, it) => s + Math.round((Number(it.qty) || 0) * (Number(it.price) || 0)), 0);
    const totalHpp = items.reduce(
      (s, it) => s + Math.round((Number(it.qty) || 0) * (Number(it.hppUnit) || 0)),
      0
    );
    const disc = Math.max(0, Math.min(gross, Number(discount) || 0));
    const total = Math.max(0, gross - disc);
    const paid = Math.max(0, Math.min(total, Number(paidAmount) || 0));
    const remaining = Math.max(0, total - paid);
    const estProfit = total - totalHpp;
    const netProfit = estProfit - (Math.max(0, Number(boronganCost) || 0) + Math.max(0, Number(otherCost) || 0));
    return { gross, totalHpp, total, paid, remaining, estProfit, netProfit };
  }, [items, discount, paidAmount, boronganCost, otherCost]);

  const hppByOrderId = useMemo(() => {
    const map = new Map<string, (typeof hppRecords)[number]>();
    for (const h of hppRecords) {
      if (h.orderId) map.set(h.orderId, h);
    }
    return map;
  }, [hppRecords]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.name.trim().length > 0 && it.qty > 0);
    if (!customerName.trim() || validItems.length === 0) return;

    setSaving(true);
    try {
      const preparedShirtSpec =
        shirtSpec.enabled || editingOrder?.shirtSpec ? shirtSpec : undefined;
      if (editingOrder) {
        await updateOrder(
          editingOrder.id,
          {
            customerName,
            customerPhone,
            division,
            orderDate,
            deadlineDate,
            items: validItems,
            discount,
            paidAmount,
            paymentMethod,
            productionStatus,
            notes,
            shirtSpec: preparedShirtSpec,
          },
          {
            boronganCost,
            otherCost,
            syncHppToCash,
            logPaidIncreaseToCash,
          }
        );
      } else {
        await createOrder(
          {
            invoiceNumber,
            customerName,
            customerPhone,
            division,
            orderDate,
            deadlineDate,
            items: validItems,
            discount,
            paidAmount,
            paymentMethod,
            productionStatus,
            notes,
            shirtSpec: preparedShirtSpec,
          },
          autoLogCash,
          {
            boronganCost,
            otherCost,
            syncHppToCash,
          }
        );
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const updateShirtSpecField = <K extends keyof ShirtProductionSpec>(
    key: K,
    value: ShirtProductionSpec[K]
  ) => {
    setShirtSpec((prev) => ({ ...prev, [key]: value }));
  };

  const updateShirtSizeCell = (
    sizeLabel: string,
    col: keyof Omit<ShirtSizeRow, 'size'>,
    val: number
  ) => {
    const cleanVal = Math.max(0, Math.round(Number(val) || 0));
    setShirtSpec((prev) => ({
      ...prev,
      enabled: true,
      sizeMatrix: prev.sizeMatrix.map((row) =>
        row.size === sizeLabel ? { ...row, [col]: cleanVal } : row
      ),
    }));
  };

  const handleUploadMockup = async (
    side: 'front' | 'back',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingMockupSide(side);
    try {
      const compressed = await compressMockupImage(file);
      setShirtSpec((prev) => ({
        ...prev,
        enabled: true,
        [side === 'front' ? 'frontMockupDataUrl' : 'backMockupDataUrl']: compressed,
      }));
      setShirtEditorOpen(true);
      notify(`Mockup kaos ${side === 'front' ? 'depan' : 'belakang'} berhasil dimuat.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memproses gambar mockup.', 'error');
    } finally {
      setUploadingMockupSide(null);
    }
  };

  const shirtSizeTotals = useMemo(
    () => getShirtSizeTotals(shirtSpec.sizeMatrix),
    [shirtSpec.sizeMatrix]
  );

  const applySizeTotalToOrderItem = () => {
    if (shirtSizeTotals.grandTotal <= 0) return;
    setItems((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((it, idx) => {
        if (idx !== 0) return it;
        const nextQty = shirtSizeTotals.grandTotal;
        return {
          ...it,
          qty: nextQty,
          subtotal: Math.round(nextQty * (Number(it.price) || 0)),
        };
      });
    });
    notify(`Qty item pertama disamakan menjadi ${shirtSizeTotals.grandTotal} pcs.`);
  };

  const openPayModal = (order: Order) => {
    setPayModalOrder(order);
    setAddedPayment(order.remainingAmount);
    setSettleMethod(order.paymentMethod);
    setSettleDate(todayISO());
    setSettleAutoCash(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalOrder || addedPayment <= 0) return;
    setSaving(true);
    try {
      await recordOrderPayment(
        payModalOrder,
        addedPayment,
        settleMethod,
        settleDate,
        settleAutoCash
      );
      setPayModalOrder(null);
    } finally {
      setSaving(false);
    }
  };

  const overdueCount = useMemo(
    () => orders.filter((o) => getOrderDueInfo(o).status === 'overdue').length,
    [orders]
  );

  const handleCopyWaReminder = async (order: Order) => {
    try {
      await navigator.clipboard.writeText(buildOrderReminderMessage(order, shopProfile));
      setCopiedReminderId(order.id);
      notify(`Pengingat pelunasan WA untuk ${order.customerName} disalin.`);
      window.setTimeout(
        () => setCopiedReminderId((prev) => (prev === order.id ? null : prev)),
        2200
      );
    } catch {
      notify('Gagal menyalin pesan pengingat.', 'error');
    }
  };

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.paymentStatus !== statusFilter) return false;
      if (divisionFilter !== 'all' && o.division !== divisionFilter) return false;
      if (overdueOnly && getOrderDueInfo(o).status !== 'overdue') return false;
      if (!q) return true;
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.invoiceNumber.toLowerCase().includes(q) ||
        o.items.some((it) => it.name.toLowerCase().includes(q))
      );
    });
  }, [orders, search, statusFilter, divisionFilter, overdueOnly]);

  const filteredTotals = useMemo(() => {
    return filteredOrders.reduce(
      (acc, o) => {
        acc.total += o.totalAmount;
        acc.paid += o.paidAmount;
        acc.remaining += o.remainingAmount;
        return acc;
      },
      { total: 0, paid: 0, remaining: 0 }
    );
  }, [filteredOrders]);

  return (
    <div className="space-y-5">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#F8FAFC]">Order Pelanggan, DP & Nota</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Pilih produk dari katalog untuk isi harga & HPP otomatis, catat DP/pelunasan, lalu cetak nota berlogo toko.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreateForm()}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Order Baru
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
          <div className="text-xs text-[#94A3B8]">Total Nilai Order ({filteredOrders.length})</div>
          <div className="text-lg font-mono font-bold tabular-nums text-[#F8FAFC] mt-1">
            {formatRp(filteredTotals.total)}
          </div>
        </div>
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
          <div className="text-xs text-[#94A3B8]">Total DP & Pelunasan Masuk</div>
          <div className="text-lg font-mono font-bold tabular-nums text-emerald-400 mt-1">
            {formatRp(filteredTotals.paid)}
          </div>
        </div>
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
          <div className="text-xs text-[#94A3B8]">Sisa Belum Lunas (Piutang)</div>
          <div className="text-lg font-mono font-bold tabular-nums text-amber-400 mt-1">
            {formatRp(filteredTotals.remaining)}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pelanggan, nomor nota, atau item pesanan..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-[#121824] border border-[#232C3D] text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#121824] border border-[#232C3D] rounded-xl">
            {(['all', 'belum_bayar', 'dp', 'lunas'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {st === 'all' ? 'Semua' : PAYMENT_LABELS[st]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#121824] border border-[#232C3D] rounded-xl">
            {(['all', 'percetakan', 'sablon'] as const).map((div) => (
              <button
                key={div}
                type="button"
                onClick={() => setDivisionFilter(div)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize whitespace-nowrap ${
                  divisionFilter === div
                    ? 'bg-[#232C3D] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {div === 'all' ? 'Semua Divisi' : div}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOverdueOnly((v) => !v)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
              overdueOnly
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                : overdueCount > 0
                  ? 'bg-[#121824] border-rose-500/35 text-rose-400 hover:bg-rose-500/10'
                  : 'bg-[#121824] border-[#232C3D] text-[#94A3B8] hover:text-white'
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            Lewat Tenggat ({overdueCount})
          </button>
        </div>
      </div>

      {/* Orders List / Table */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-[#F8FAFC]">Belum ada order yang cocok</p>
          <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
            Tambahkan order percetakan atau sablon baru lengkap dengan DP dan estimasi selesai.
          </p>
          <button
            type="button"
            onClick={() => openCreateForm()}
            className="min-h-[42px] px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Catat Order Pertama
          </button>
        </div>
      ) : (
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232C3D] text-xs font-semibold text-[#94A3B8] bg-[#0B0F17]/60">
                  <th className="py-3 px-4">Nota & Pelanggan</th>
                  <th className="py-3 px-4">Pesanan</th>
                  <th className="py-3 px-4">Produksi</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Bayar / Sisa</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232C3D] text-sm">
                {filteredOrders.map((order) => {
                  const due = getOrderDueInfo(order);
                  return (
                    <tr key={order.id} className="hover:bg-[#182030]/60 transition-colors">
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-[#F8FAFC]">{order.customerName}</div>
                        <div className="text-xs text-[#94A3B8] mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-sky-400">{order.invoiceNumber}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{order.division}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDateID(order.orderDate)}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <div className="text-xs text-[#F8FAFC] space-y-0.5">
                          {order.items.slice(0, 2).map((it, idx) => (
                            <div key={idx} className="truncate">
                              {it.name}{' '}
                              <span className="text-[#94A3B8] font-mono">
                                ({it.qty} {it.unit})
                              </span>
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div className="text-[#94A3B8]">
                              +{order.items.length - 2} item lainnya
                            </div>
                          )}
                        </div>
                        {due.status !== 'paid' ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {due.dueDate && (
                              <span className="text-[11px] text-[#94A3B8]">
                                Tenggat: {formatDateID(due.dueDate)}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                due.status === 'overdue'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/35'
                                  : due.status === 'due_today' || due.status === 'due_soon'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                                    : 'bg-sky-500/10 text-sky-300 border border-sky-500/25'
                              }`}
                            >
                              <BellRing className="w-2.5 h-2.5" />
                              {due.label}
                            </span>
                          </div>
                        ) : (
                          order.deadlineDate && (
                            <div className="text-[11px] text-[#94A3B8] mt-1">
                              Deadline: {formatDateID(order.deadlineDate)}
                            </div>
                          )
                        )}
                        {order.shirtSpec?.enabled && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-sky-400">
                            <Shirt className="w-3 h-3" />
                            <span>Mockup &amp; PO Kaos (Hal. 2)</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <select
                          aria-label={`Status produksi ${order.invoiceNumber}`}
                          value={order.productionStatus}
                          onChange={(e) =>
                            updateOrderProductionStatus(
                              order.id,
                              e.target.value as ProductionStatus
                            )
                          }
                          className="text-xs bg-[#0B0F17] border border-[#232C3D] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                        >
                          {(['antrean', 'proses', 'selesai', 'diambil'] as ProductionStatus[]).map(
                            (st) => (
                              <option key={st} value={st}>
                                {PRODUCTION_LABELS[st]}
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="font-mono font-bold tabular-nums text-[#F8FAFC]">
                          {formatRp(order.totalAmount)}
                        </div>
                        {order.totalHpp > 0 ? (
                          <>
                            <div className="text-[11px] font-mono tabular-nums text-emerald-400 mt-0.5">
                              Laba Kotor {formatRp(order.totalAmount - order.totalHpp)}
                            </div>
                            {(() => {
                              const linkedHpp = hppByOrderId.get(order.id);
                              if (linkedHpp && (linkedHpp.boronganCost > 0 || linkedHpp.otherCost > 0)) {
                                return (
                                  <div className="text-[11px] font-mono tabular-nums text-sky-400">
                                    Bersih {formatRp(linkedHpp.netProfit)}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </>
                        ) : (
                          <div className="text-[11px] text-amber-400 mt-0.5">
                            HPP belum diisi
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div
                          className={`text-xs font-semibold ${
                            order.paymentStatus === 'lunas'
                              ? 'text-emerald-400'
                              : order.paymentStatus === 'dp'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                          }`}
                        >
                          {PAYMENT_LABELS[order.paymentStatus]}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-[#94A3B8] mt-0.5">
                          Masuk {formatRp(order.paidAmount)}
                        </div>
                        {order.remainingAmount > 0 && (
                          <div className="text-xs font-mono font-bold tabular-nums text-amber-400">
                            Sisa {formatRp(order.remainingAmount)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {order.remainingAmount > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleCopyWaReminder(order)}
                                title="Salin Pengingat Jatuh Tempo ke WhatsApp"
                                className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                {copiedReminderId === order.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                Tagih
                              </button>
                              <button
                                type="button"
                                onClick={() => openPayModal(order)}
                                title="Catat DP / Pelunasan"
                                className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                Lunasi
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setInvoiceOrder(order)}
                            title="Lihat & Cetak Nota"
                            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-[#1E293B] border border-[#232C3D] text-[#F8FAFC] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5 text-sky-400" />
                            Nota
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditForm(order)}
                            title="Ubah Nota & Desain"
                            aria-label="Ubah nota dan desain"
                            className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-[#232C3D] text-[#94A3B8] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {confirmDeleteId === order.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                void deleteOrder(order.id);
                                setConfirmDeleteId(null);
                              }}
                              className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                            >
                              Yakin Hapus?
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(order.id)}
                              title="Hapus Order"
                              aria-label="Hapus order"
                              className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-rose-500/15 text-[#94A3B8] hover:text-rose-400 inline-flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Order Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-[#121824] border border-[#232C3D] rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#232C3D]">
              <div>
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  {editingOrder ? `Edit Order ${editingOrder.invoiceNumber}` : 'Catat Order Baru'}
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5 font-mono">{invoiceNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Tutup form"
                className="min-h-[40px] min-w-[40px] rounded-lg hover:bg-[#182030] text-[#94A3B8] hover:text-white inline-flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="overflow-y-auto p-5 space-y-5 flex-1">
              {/* Customer & Division */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Nama Pelanggan *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Contoh: Komunitas Motor / CV Jaya"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    No. WhatsApp / Telp
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Divisi Utama
                  </label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value as Division)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                  >
                    <option value="sablon">Divisi Sablon</option>
                    <option value="percetakan">Divisi Percetakan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Tanggal Order
                  </label>
                  <input
                    type="date"
                    required
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Jatuh Tempo Pelunasan / Estimasi Selesai
                  </label>
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Auto-Fill from Product Catalog */}
              <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#232C3D] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                  <PackagePlus className="w-4 h-4" />
                  <span>Tambahkan Otomatis dari Daftar Produk</span>
                </div>
                {products.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">
                    Daftar produk masih kosong. Anda bisa mengisi manual di bawah atau menambah katalog di menu Produk & HPP.
                  </p>
                ) : (
                  <select
                    value={selectedCatalogId}
                    onChange={(e) => handleAddFromCatalog(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#121824] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                  >
                    <option value="">— Pilih produk dari katalog (otomatis isi harga & HPP) —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.division.toUpperCase()}] {p.name} — {formatRp(p.sellPrice)}/{p.unit} (HPP{' '}
                        {formatRp(p.hppUnit)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Order Line Items */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#F8FAFC]">Rincian Item Pesanan</label>
                  <button
                    type="button"
                    onClick={addEmptyItemRow}
                    className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Baris Manual
                  </button>
                </div>

                <div className="space-y-2.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 p-3 rounded-xl bg-[#0B0F17] border border-[#232C3D]"
                    >
                      <div className="col-span-12 sm:col-span-4">
                        <label className="block text-[11px] text-[#94A3B8] mb-1">Nama Item *</label>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => updateItemField(idx, { name: e.target.value })}
                          placeholder="Kaos Combed 30s + Sablon"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[11px] text-[#94A3B8] mb-1">Qty</label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={item.qty}
                          onChange={(e) =>
                            updateItemField(idx, { qty: Math.max(1, Number(e.target.value) || 1) })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs font-mono text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[11px] text-[#94A3B8] mb-1">Satuan</label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateItemField(idx, { unit: e.target.value })}
                          placeholder="pcs"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-[11px] text-[#94A3B8] mb-1">Harga Jual</label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={item.price}
                          onChange={(e) =>
                            updateItemField(idx, { price: Math.max(0, Number(e.target.value) || 0) })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs font-mono text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-2 flex items-end gap-1">
                        <div className="flex-1">
                          <label className="block text-[11px] text-[#94A3B8] mb-1">HPP/Unit</label>
                          <input
                            type="number"
                            min={0}
                            value={item.hppUnit}
                            onChange={(e) =>
                              updateItemField(idx, {
                                hppUnit: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs font-mono text-[#94A3B8] focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            aria-label="Hapus baris"
                            className="p-1.5 rounded-lg hover:bg-rose-500/15 text-[#94A3B8] hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment, DP & Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Diskon (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#94A3B8]">
                      DP / Dibayar Awal (Rp)
                    </label>
                    <button
                      type="button"
                      onClick={() => setPaidAmount(formSummary.total)}
                      className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      Bayar Lunas
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={formSummary.total}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Metode Pembayaran
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                  >
                    <option value="transfer">Transfer Bank</option>
                    <option value="tunai">Tunai</option>
                    <option value="qris">QRIS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Catatan Produksi / Pesanan
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Warna kaos hitam, sablon dada kiri & punggung A3"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Mockup Desain Kaos & Purchase Order Page 2 Section */}
              <div className="rounded-xl bg-[#0B0F17] border border-[#232C3D] overflow-hidden">
                <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 bg-[#0F1522]">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={shirtSpec.enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        updateShirtSpecField('enabled', checked);
                        if (checked) setShirtEditorOpen(true);
                      }}
                      className="w-4 h-4 rounded accent-sky-500"
                    />
                    <Shirt className="w-4 h-4 text-sky-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-[#F8FAFC]">
                        Mockup Desain Kaos &amp; Purchase Order (Halaman 2 setelah Invoice)
                      </div>
                      <div className="text-[11px] text-[#94A3B8]">
                        Upload mockup kaos, catat bahan, warna kaos, ukuran desain &amp; rincian size XS–5XL
                      </div>
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      if (!shirtEditorOpen && !shirtSpec.enabled) {
                        updateShirtSpecField('enabled', true);
                      }
                      setShirtEditorOpen((v) => !v);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#232C3D] bg-[#121824] hover:bg-[#182030] text-xs font-semibold text-sky-400 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {shirtEditorOpen ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        Tutup Detail Kaos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        Isi Mockup &amp; Detail Kaos
                      </>
                    )}
                  </button>
                </div>

                {shirtEditorOpen && (
                  <div className="p-4 space-y-5 border-t border-[#232C3D]">
                    {/* 1. Model Kaos & Warna Kaos Tak Terbatas */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#F8FAFC]">
                          1. Pilih Model Tampilan Kaos &amp; Warna Kaos (Tak Terbatas)
                        </span>
                        <div className="flex items-center gap-1 p-0.5 bg-[#121824] border border-[#232C3D] rounded-lg">
                          {(
                            [
                              { id: 'template_overlay', label: 'Tempel PNG ke Model Kaos' },
                              { id: 'uploaded_mockup', label: 'Mockup Jadi (Utuh)' },
                            ] as { id: MockupDisplayMode; label: string }[]
                          ).map((mode) => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => updateShirtSpecField('mockupDisplayMode', mode.id)}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                                shirtSpec.mockupDisplayMode === mode.id
                                  ? 'bg-sky-500 text-slate-950'
                                  : 'text-[#94A3B8] hover:text-white'
                              }`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Garment Style Selector: Pendek, Panjang, Raglan, Oversize, Hoodie, Polo */}
                      <div>
                        <label className="block text-[11px] font-medium text-[#94A3B8] mb-1.5">
                          Tampilan Model Pakaian
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          {GARMENT_STYLE_OPTIONS.map((opt) => {
                            const active = (shirtSpec.garmentStyle || 'pendek') === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setShirtSpec((prev) => ({
                                    ...prev,
                                    garmentStyle: opt.id as GarmentStyle,
                                    pola: opt.id === 'raglan' ? 'RAGLAN' : prev.pola,
                                  }));
                                }}
                                className={`min-h-[36px] px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-sky-500 border-sky-400 text-slate-950'
                                    : 'bg-[#121824] border-[#232C3D] text-[#CBD5E1] hover:border-sky-500/50 hover:text-white'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Unlimited Shirt Color Picker + Hex + Raglan Sleeve Color */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-[#121824] border border-[#232C3D] space-y-2">
                          <label className="block text-[11px] font-medium text-[#94A3B8]">
                            Warna Kaos Custom (Bebas Pilih / Kode Hex)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={
                                /^#[0-9a-fA-F]{6}$/.test(shirtSpec.shirtColorHex)
                                  ? shirtSpec.shirtColorHex
                                  : '#94A3B8'
                              }
                              onChange={(e) =>
                                updateShirtSpecField('shirtColorHex', e.target.value.toUpperCase())
                              }
                              title="Pilih warna kaos custom tak terbatas"
                              className="w-11 h-[38px] rounded bg-[#0B0F17] border border-[#232C3D] cursor-pointer p-0.5 shrink-0"
                            />
                            <input
                              type="text"
                              maxLength={7}
                              value={shirtSpec.shirtColorHex}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateShirtSpecField('shirtColorHex', val);
                              }}
                              placeholder="#1E293B"
                              className="w-24 min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-xs font-mono uppercase text-[#F8FAFC]"
                            />
                            <input
                              type="text"
                              maxLength={80}
                              value={shirtSpec.shirtColor}
                              onChange={(e) => updateShirtSpecField('shirtColor', e.target.value)}
                              placeholder="Nama warna (mis. Sage Green)"
                              className="flex-1 min-w-0 min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-xs text-[#F8FAFC]"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {SHIRT_COLOR_PRESETS.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() =>
                                  setShirtSpec((prev) => ({
                                    ...prev,
                                    shirtColor: preset.label,
                                    shirtColorHex: preset.hex,
                                  }))
                                }
                                className="px-2 py-0.5 rounded border border-[#232C3D] bg-[#0B0F17] hover:border-sky-500 text-[10px] text-[#CBD5E1] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-sm border border-slate-500"
                                  style={{ backgroundColor: preset.hex }}
                                />
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#121824] border border-[#232C3D] space-y-2.5">
                          {(shirtSpec.garmentStyle || 'pendek') === 'raglan' && (
                            <div>
                              <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                                Warna Lengan Raglan Custom
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={
                                    /^#[0-9a-fA-F]{6}$/.test(shirtSpec.sleeveColorHex || '')
                                      ? shirtSpec.sleeveColorHex
                                      : '#1E293B'
                                  }
                                  onChange={(e) =>
                                    updateShirtSpecField(
                                      'sleeveColorHex',
                                      e.target.value.toUpperCase()
                                    )
                                  }
                                  className="w-10 h-[36px] rounded bg-[#0B0F17] border border-[#232C3D] cursor-pointer p-0.5 shrink-0"
                                />
                                <input
                                  type="text"
                                  maxLength={7}
                                  value={shirtSpec.sleeveColorHex || '#1E293B'}
                                  onChange={(e) =>
                                    updateShirtSpecField('sleeveColorHex', e.target.value)
                                  }
                                  placeholder="#1E293B"
                                  className="w-24 min-h-[36px] px-2.5 py-1 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-xs font-mono uppercase text-[#F8FAFC]"
                                />
                                <span className="text-[11px] text-[#94A3B8]">
                                  Kombinasi lengan &amp; kerah raglan
                                </span>
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                              Pola Potongan (Untuk Tabel PO)
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {SHIRT_POLA_OPTIONS.map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => updateShirtSpecField('pola', p as ShirtPola)}
                                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                                    shirtSpec.pola === p
                                      ? 'bg-sky-500 border-sky-400 text-slate-950'
                                      : 'bg-[#0B0F17] border-[#232C3D] text-[#94A3B8] hover:text-white'
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. Upload PNG-Only & Live Interactive Positioning */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold text-[#F8FAFC]">
                            2. Upload Desain PNG &amp; Atur Posisi Custom pada Kaos
                          </span>
                          <p className="text-[11px] text-[#94A3B8]">
                            Hanya menerima format <strong className="text-sky-400">.PNG</strong> (latar transparan). Geser desain langsung di atas kaos atau gunakan slider di bawah.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(
                          [
                            {
                              side: 'front' as const,
                              title: 'Tampak Depan (DEPAN)',
                              dataUrl: shirtSpec.frontMockupDataUrl,
                              placement: shirtSpec.frontPlacement || DEFAULT_FRONT_PLACEMENT,
                              defaultPlacement: DEFAULT_FRONT_PLACEMENT,
                              presets: [
                                { label: 'Dada Tengah', val: { x: 50, y: 42, scale: 38 } },
                                { label: 'Dada Kiri', val: { x: 61, y: 36, scale: 18 } },
                                { label: 'Dada Kanan', val: { x: 39, y: 36, scale: 18 } },
                                { label: 'Full Depan', val: { x: 50, y: 48, scale: 52 } },
                              ],
                            },
                            {
                              side: 'back' as const,
                              title: 'Tampak Belakang (BELAKANG)',
                              dataUrl: shirtSpec.backMockupDataUrl,
                              placement: shirtSpec.backPlacement || DEFAULT_BACK_PLACEMENT,
                              defaultPlacement: DEFAULT_BACK_PLACEMENT,
                              presets: [
                                { label: 'Punggung', val: { x: 50, y: 40, scale: 40 } },
                                { label: 'Tengkuk', val: { x: 50, y: 24, scale: 20 } },
                                { label: 'Punggung Bawah', val: { x: 50, y: 62, scale: 38 } },
                              ],
                            },
                          ] as const
                        ).map((panel) => {
                          const isFront = panel.side === 'front';
                          const updatePlacement = (next: DesignPlacement) => {
                            updateShirtSpecField(
                              isFront ? 'frontPlacement' : 'backPlacement',
                              next
                            );
                          };
                          return (
                            <div
                              key={panel.side}
                              className="p-3 rounded-xl bg-[#121824] border border-[#232C3D] space-y-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#F8FAFC]">
                                  {panel.title}
                                </span>
                                {panel.dataUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateShirtSpecField(
                                        isFront ? 'frontMockupDataUrl' : 'backMockupDataUrl',
                                        ''
                                      )
                                    }
                                    className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                                  >
                                    Hapus PNG
                                  </button>
                                )}
                              </div>

                              {/* Live Interactive Preview */}
                              <div className="rounded-xl bg-white border border-slate-200 p-2 flex flex-col items-center justify-center">
                                {shirtSpec.mockupDisplayMode === 'uploaded_mockup' ? (
                                  panel.dataUrl ? (
                                    <img
                                      src={panel.dataUrl}
                                      alt={panel.title}
                                      className="h-48 w-full object-contain"
                                    />
                                  ) : (
                                    <div className="h-48 w-full flex items-center justify-center text-[11px] text-slate-400">
                                      Belum ada file PNG {isFront ? 'depan' : 'belakang'}
                                    </div>
                                  )
                                ) : (
                                  <div className="w-48 h-48">
                                    <VectorGarmentMockup
                                      side={panel.side}
                                      garmentStyle={shirtSpec.garmentStyle || 'pendek'}
                                      shirtColorHex={shirtSpec.shirtColorHex}
                                      sleeveColorHex={shirtSpec.sleeveColorHex}
                                      designDataUrl={panel.dataUrl}
                                      placement={panel.placement}
                                      interactive={Boolean(panel.dataUrl)}
                                      onChangePlacement={updatePlacement}
                                      className="w-full h-full"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* PNG-Only Upload Button */}
                              <label className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-[#182030] border border-[#232C3D] text-xs font-semibold text-[#F8FAFC] inline-flex items-center justify-center gap-1.5 cursor-pointer">
                                <Upload className="w-3.5 h-3.5 text-sky-400" />
                                <span>
                                  {uploadingMockupSide === panel.side
                                    ? 'Memproses PNG...'
                                    : panel.dataUrl
                                      ? `Ganti PNG ${isFront ? 'Depan' : 'Belakang'}`
                                      : `Upload PNG ${isFront ? 'Depan' : 'Belakang'}`}
                                </span>
                                <input
                                  type="file"
                                  accept=".png,image/png"
                                  onChange={(e) => void handleUploadMockup(panel.side, e)}
                                  className="hidden"
                                />
                              </label>

                              {/* Custom Positioning Controls (for template_overlay mode) */}
                              {shirtSpec.mockupDisplayMode === 'template_overlay' && (
                                <div className="p-2.5 rounded-lg bg-[#0B0F17] border border-[#232C3D] space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                                      Posisi &amp; Ukuran PNG
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => updatePlacement({ ...panel.defaultPlacement })}
                                      className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      Reset
                                    </button>
                                  </div>

                                  <div className="flex flex-wrap gap-1">
                                    {panel.presets.map((preset) => (
                                      <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => updatePlacement({ ...preset.val })}
                                        className="px-2 py-0.5 rounded border border-[#232C3D] bg-[#121824] hover:border-sky-500 text-[10px] font-medium text-[#CBD5E1] cursor-pointer"
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>

                                  <div className="grid grid-cols-3 gap-2 pt-0.5">
                                    <div>
                                      <div className="flex justify-between text-[10px] text-[#94A3B8]">
                                        <span>X</span>
                                        <span className="font-mono text-[#F8FAFC]">
                                          {panel.placement.x}%
                                        </span>
                                      </div>
                                      <input
                                        type="range"
                                        min={10}
                                        max={90}
                                        value={panel.placement.x}
                                        onChange={(e) =>
                                          updatePlacement({
                                            ...panel.placement,
                                            x: Number(e.target.value),
                                          })
                                        }
                                        className="w-full accent-sky-500 cursor-pointer"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex justify-between text-[10px] text-[#94A3B8]">
                                        <span>Y</span>
                                        <span className="font-mono text-[#F8FAFC]">
                                          {panel.placement.y}%
                                        </span>
                                      </div>
                                      <input
                                        type="range"
                                        min={10}
                                        max={90}
                                        value={panel.placement.y}
                                        onChange={(e) =>
                                          updatePlacement({
                                            ...panel.placement,
                                            y: Number(e.target.value),
                                          })
                                        }
                                        className="w-full accent-sky-500 cursor-pointer"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex justify-between text-[10px] text-[#94A3B8]">
                                        <span>Skala</span>
                                        <span className="font-mono text-[#F8FAFC]">
                                          {panel.placement.scale}%
                                        </span>
                                      </div>
                                      <input
                                        type="range"
                                        min={10}
                                        max={85}
                                        value={panel.placement.scale}
                                        onChange={(e) =>
                                          updatePlacement({
                                            ...panel.placement,
                                            scale: Number(e.target.value),
                                          })
                                        }
                                        className="w-full accent-sky-500 cursor-pointer"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Dynamic Sablon Colors + Material & Ink */}
                    <div className="p-3 rounded-xl bg-[#121824] border border-[#232C3D] space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold text-[#F8FAFC]">
                            3. Warna Sablon dalam Desain ({shirtSpec.swatchColors.length} Warna)
                          </span>
                          <p className="text-[11px] text-[#94A3B8]">
                            Tambahkan kotak warna sablon sesuai jumlah warna pada desain Anda (maks. 20 warna).
                          </p>
                        </div>
                        {shirtSpec.swatchColors.length < 20 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateShirtSpecField('swatchColors', [
                                ...shirtSpec.swatchColors,
                                '#EF4444',
                              ])
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-xs font-semibold text-sky-300 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Tambah Warna Sablon
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {shirtSpec.swatchColors.map((hex, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0B0F17] border border-[#232C3D]"
                          >
                            <input
                              type="color"
                              value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#FFFFFF'}
                              onChange={(e) => {
                                const next = [...shirtSpec.swatchColors];
                                next[idx] = e.target.value.toUpperCase();
                                updateShirtSpecField('swatchColors', next);
                              }}
                              title={`Warna sablon #${idx + 1}`}
                              className="w-6 h-6 rounded border border-[#334155] bg-transparent cursor-pointer p-0"
                            />
                            <span className="text-[11px] font-mono text-[#CBD5E1] uppercase">
                              {hex}
                            </span>
                            {shirtSpec.swatchColors.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateShirtSpecField(
                                    'swatchColors',
                                    shirtSpec.swatchColors.filter((_, i) => i !== idx)
                                  )
                                }
                                title="Hapus warna ini"
                                className="p-0.5 rounded hover:bg-rose-500/20 text-[#64748B] hover:text-rose-400 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Shirt Material, Order Title, Ink */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                          Nama Order / Event
                        </label>
                        <input
                          type="text"
                          maxLength={100}
                          value={shirtSpec.orderTitle}
                          onChange={(e) => updateShirtSpecField('orderTitle', e.target.value)}
                          placeholder="Contoh: GATHERING PT MEGA"
                          className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                          Bahan Kaos (Material)
                        </label>
                        <input
                          type="text"
                          maxLength={80}
                          value={shirtSpec.material}
                          onChange={(e) => updateShirtSpecField('material', e.target.value)}
                          placeholder="Contoh: COMBED 30S"
                          className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                          Jenis Tinta Sablon (Ink)
                        </label>
                        <input
                          type="text"
                          maxLength={80}
                          value={shirtSpec.inkType}
                          onChange={(e) => updateShirtSpecField('inkType', e.target.value)}
                          placeholder="Contoh: PLASTISOL / DTF"
                          className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                        />
                      </div>
                    </div>

                    {/* Design Dimensions & Sablon / Sewing / Finishing Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                          Ukuran Desain Depan
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={shirtSpec.frontDesignSize}
                          onChange={(e) =>
                            updateShirtSpecField('frontDesignSize', e.target.value)
                          }
                          placeholder="Contoh: 28 x 35 cm (A3)"
                          className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                          Ukuran Desain Belakang
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={shirtSpec.backDesignSize}
                          onChange={(e) =>
                            updateShirtSpecField('backDesignSize', e.target.value)
                          }
                          placeholder="Contoh: 28 x 38 cm"
                          className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                          Keterangan Sablon
                        </label>
                        <textarea
                          rows={2}
                          maxLength={600}
                          value={shirtSpec.sablonNotes}
                          onChange={(e) => updateShirtSpecField('sablonNotes', e.target.value)}
                          placeholder="Contoh: Dada kiri logo 9cm&#10;Punggung full warna putih"
                          className="w-full px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                          Keterangan Jahit
                        </label>
                        <textarea
                          rows={2}
                          maxLength={300}
                          value={shirtSpec.sewingNotes}
                          onChange={(e) => updateShirtSpecField('sewingNotes', e.target.value)}
                          placeholder="Contoh: Jahit rantai pundak"
                          className="w-full px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                          Finishing
                        </label>
                        <textarea
                          rows={2}
                          maxLength={300}
                          value={shirtSpec.finishingNotes}
                          onChange={(e) => updateShirtSpecField('finishingNotes', e.target.value)}
                          placeholder="Contoh: PRESS DOFF"
                          className="w-full px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                        />
                      </div>
                    </div>

                    {/* Size Matrix Table */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#F8FAFC]">
                          2. Rincian Ukuran &amp; Jumlah Kaos (Total:{' '}
                          <span className="font-mono text-sky-400">
                            {shirtSizeTotals.grandTotal} pcs
                          </span>
                          )
                        </span>
                        {shirtSizeTotals.grandTotal > 0 && (
                          <button
                            type="button"
                            onClick={applySizeTotalToOrderItem}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-[11px] font-semibold text-emerald-300 cursor-pointer"
                          >
                            Samakan Qty Item Order ({shirtSizeTotals.grandTotal} pcs)
                          </button>
                        )}
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-[#232C3D]">
                        <table className="w-full text-center border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#121824] text-[#94A3B8] border-b border-[#232C3D]">
                              <th className="py-1.5 px-2 text-left">Size</th>
                              <th className="py-1.5 px-2">Pendek</th>
                              <th className="py-1.5 px-2">Panjang</th>
                              <th className="py-1.5 px-2">3/4</th>
                              <th className="py-1.5 px-2">Oversize</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#232C3D] bg-[#0B0F17]">
                            {shirtSpec.sizeMatrix.map((row) => (
                              <tr key={row.size}>
                                <td className="py-1 px-2 text-left font-bold text-[#F8FAFC]">
                                  {row.size}
                                </td>
                                {(['pendek', 'panjang', 'tigaPerempat', 'oversize'] as const).map(
                                  (col) => (
                                    <td key={col} className="p-1">
                                      <input
                                        type="number"
                                        min={0}
                                        value={row[col] || ''}
                                        placeholder="0"
                                        onChange={(e) =>
                                          updateShirtSizeCell(
                                            row.size,
                                            col,
                                            Number(e.target.value)
                                          )
                                        }
                                        className="w-14 sm:w-16 px-1.5 py-1 text-center rounded bg-[#121824] border border-[#232C3D] text-xs font-mono tabular-nums text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                                      />
                                    </td>
                                  )
                                )}
                              </tr>
                            ))}
                            <tr className="bg-[#121824] font-bold text-amber-400 tabular-nums">
                              <td className="py-1.5 px-2 text-left">Total</td>
                              <td className="py-1.5 px-2">{shirtSizeTotals.pendek}</td>
                              <td className="py-1.5 px-2">{shirtSizeTotals.panjang}</td>
                              <td className="py-1.5 px-2">{shirtSizeTotals.tigaPerempat}</td>
                              <td className="py-1.5 px-2">{shirtSizeTotals.oversize}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Borongan & Other Cost for Riwayat HPP + Cash Sync */}
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#232C3D] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[#F8FAFC]">
                      Potongan Gaji Borongan &amp; Biaya Lain-Lain (Riwayat HPP)
                    </div>
                    <div className="text-[11px] text-[#94A3B8]">
                      Jika HPP atau biaya produksi diisi, order otomatis masuk ke Riwayat HPP (Laba Kotor &amp; Laba Bersih).
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                      Gaji Borongan Order (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={boronganCost}
                      onChange={(e) => setBoronganCost(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs font-mono text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                      Biaya Lain-Lain Order (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={otherCost}
                      onChange={(e) => setOtherCost(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs font-mono text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2.5 text-xs text-[#CBD5E1] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={syncHppToCash}
                    onChange={(e) => setSyncHppToCash(e.target.checked)}
                    className="w-4 h-4 rounded accent-sky-500"
                  />
                  <span>
                    Otomatis catat/sinkronkan biaya HPP, Gaji Borongan &amp; Biaya Lain-Lain ke Pengeluaran Buku Kas
                  </span>
                </label>
              </div>

              {!editingOrder ? (
                <label className="flex items-center gap-2.5 text-xs text-[#F8FAFC] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoLogCash}
                    onChange={(e) => setAutoLogCash(e.target.checked)}
                    className="w-4 h-4 rounded accent-sky-500"
                  />
                  <span>Otomatis catat nominal DP / pembayaran ini sebagai Pemasukan di Buku Kas</span>
                </label>
              ) : (
                paidAmount > editingOrder.paidAmount && (
                  <label className="flex items-center gap-2.5 text-xs text-emerald-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={logPaidIncreaseToCash}
                      onChange={(e) => setLogPaidIncreaseToCash(e.target.checked)}
                      className="w-4 h-4 rounded accent-emerald-500"
                    />
                    <span>
                      Catat penambahan pembayaran (+{formatRp(paidAmount - editingOrder.paidAmount)}) sebagai Pemasukan Buku Kas
                    </span>
                  </label>
                )
              )}

              {/* Live Totals Preview */}
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#232C3D] space-y-2.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-[11px] text-[#94A3B8]">Total Tagihan</div>
                    <div className="text-sm font-mono font-bold tabular-nums text-[#F8FAFC] mt-0.5">
                      {formatRp(formSummary.total)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#94A3B8]">Sisa Pelunasan</div>
                    <div className="text-sm font-mono font-bold tabular-nums text-amber-400 mt-0.5">
                      {formatRp(formSummary.remaining)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#94A3B8]">Total HPP</div>
                    <div className="text-sm font-mono font-semibold tabular-nums text-[#94A3B8] mt-0.5">
                      {formatRp(formSummary.totalHpp)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#94A3B8]">Estimasi Laba Kotor</div>
                    <div className="text-sm font-mono font-bold tabular-nums text-emerald-400 mt-0.5">
                      {formatRp(formSummary.estProfit)}
                    </div>
                  </div>
                </div>
                {(boronganCost > 0 || otherCost > 0) && (
                  <div className="pt-2 border-t border-[#232C3D] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#94A3B8]">
                      Estimasi Laba Bersih Riwayat HPP (setelah Borongan {formatRp(boronganCost)} &amp; Lain {formatRp(otherCost)}):
                    </span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        formSummary.netProfit >= 0 ? 'text-sky-400' : 'text-rose-400'
                      }`}
                    >
                      {formatRp(formSummary.netProfit)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#232C3D] text-xs font-semibold text-[#94A3B8] hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-bold text-xs"
                >
                  {saving ? 'Menyimpan...' : editingOrder ? 'Simpan Perubahan' : 'Simpan Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settlement / Add Payment Modal */}
      {payModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-[#232C3D] rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">Catat Pelunasan / Cicilan</h3>
              <button
                type="button"
                onClick={() => setPayModalOrder(null)}
                className="p-1.5 rounded-lg hover:bg-[#182030] text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#232C3D] space-y-1 text-xs">
              <div className="font-semibold text-[#F8FAFC]">
                {payModalOrder.customerName} · {payModalOrder.invoiceNumber}
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Total Tagihan</span>
                <span className="font-mono tabular-nums">{formatRp(payModalOrder.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Sudah Masuk</span>
                <span className="font-mono tabular-nums">{formatRp(payModalOrder.paidAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-amber-400 pt-1 border-t border-[#232C3D]">
                <span>Sisa Pelunasan</span>
                <span className="font-mono tabular-nums">
                  {formatRp(payModalOrder.remainingAmount)}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[#94A3B8]">Nominal Diterima (Rp)</label>
                  <button
                    type="button"
                    onClick={() => setAddedPayment(payModalOrder.remainingAmount)}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    Lunasi Semua
                  </button>
                </div>
                <input
                  type="number"
                  min={1}
                  max={payModalOrder.remainingAmount}
                  required
                  value={addedPayment}
                  onChange={(e) => setAddedPayment(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Metode</label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  >
                    <option value="transfer">Transfer</option>
                    <option value="tunai">Tunai</option>
                    <option value="qris">QRIS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#F8FAFC] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settleAutoCash}
                  onChange={(e) => setSettleAutoCash(e.target.checked)}
                  className="w-4 h-4 accent-sky-500"
                />
                <span>Otomatis catat ke Pemasukan Buku Kas</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModalOrder(null)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#232C3D] text-xs font-semibold text-[#94A3B8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {invoiceOrder && (
        <InvoiceModal
          order={invoiceOrder}
          shop={shopProfile}
          onClose={() => setInvoiceOrder(null)}
          onEditOrder={() => {
            const target = invoiceOrder;
            setInvoiceOrder(null);
            if (target) openEditForm(target);
          }}
        />
      )}
    </div>
  );
};
