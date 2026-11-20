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
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  addDaysISO,
  formatDateID,
  formatRp,
  generateInvoiceNumber,
  todayISO,
} from '../lib/format';
import {
  Division,
  Order,
  OrderDraftFromHpp,
  OrderItem,
  PaymentMethod,
  PaymentStatus,
  ProductionStatus,
} from '../types';
import { InvoiceModal } from './InvoiceModal';

interface OrdersViewProps {
  openNewTrigger?: number;
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

export const OrdersView: React.FC<OrdersViewProps> = ({
  openNewTrigger,
  draftFromHpp,
  onConsumeDraft,
}) => {
  const {
    orders,
    products,
    shopProfile,
    createOrder,
    updateOrder,
    recordOrderPayment,
    updateOrderProductionStatus,
    deleteOrder,
  } = useWorkspace();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [divisionFilter, setDivisionFilter] = useState<'all' | Division>('all');

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
  const [autoLogCash, setAutoLogCash] = useState(true);
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
    setAutoLogCash(true);
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
    return { gross, totalHpp, total, paid, remaining, estProfit };
  }, [items, discount, paidAmount]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.name.trim().length > 0 && it.qty > 0);
    if (!customerName.trim() || validItems.length === 0) return;

    setSaving(true);
    try {
      if (editingOrder) {
        await updateOrder(editingOrder.id, {
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
        });
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
          },
          autoLogCash
        );
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
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

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.paymentStatus !== statusFilter) return false;
      if (divisionFilter !== 'all' && o.division !== divisionFilter) return false;
      if (!q) return true;
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.invoiceNumber.toLowerCase().includes(q) ||
        o.items.some((it) => it.name.toLowerCase().includes(q))
      );
    });
  }, [orders, search, statusFilter, divisionFilter]);

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
                  const isSealed =
                    order.paymentStatus === 'lunas' && order.productionStatus === 'diambil';
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
                        {order.deadlineDate && (
                          <div className="text-[11px] text-[#94A3B8] mt-1">
                            Deadline: {formatDateID(order.deadlineDate)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        {isSealed ? (
                          <span className="text-xs font-medium text-emerald-400">
                            {PRODUCTION_LABELS[order.productionStatus]}
                          </span>
                        ) : (
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
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="font-mono font-bold tabular-nums text-[#F8FAFC]">
                          {formatRp(order.totalAmount)}
                        </div>
                        {order.totalHpp > 0 && (
                          <div className="text-[11px] font-mono tabular-nums text-emerald-400 mt-0.5">
                            Est. Laba {formatRp(order.totalAmount - order.totalHpp)}
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
                            <button
                              type="button"
                              onClick={() => openPayModal(order)}
                              title="Catat DP / Pelunasan"
                              className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              Lunasi
                            </button>
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
                          {!isSealed && (
                            <button
                              type="button"
                              onClick={() => openEditForm(order)}
                              title="Edit Order"
                              aria-label="Edit order"
                              className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-[#232C3D] text-[#94A3B8] hover:text-white inline-flex items-center justify-center transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
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
                    Estimasi Selesai / Deadline
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

              {!editingOrder && (
                <label className="flex items-center gap-2.5 text-xs text-[#F8FAFC] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoLogCash}
                    onChange={(e) => setAutoLogCash(e.target.checked)}
                    className="w-4 h-4 rounded accent-sky-500"
                  />
                  <span>Otomatis catat nominal DP / pembayaran ini sebagai Pemasukan di Buku Kas</span>
                </label>
              )}

              {/* Live Totals Preview */}
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#232C3D] grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        />
      )}
    </div>
  );
};
