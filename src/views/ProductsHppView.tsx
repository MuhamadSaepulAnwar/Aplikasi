import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Package,
  Plus,
  Trash2,
  Edit3,
  ShoppingBag,
  Save,
  Search,
  X,
  ArrowRight,
  History,
  AlertCircle,
  Download,
  Wallet,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  exportRowsToCsv,
  formatDateID,
  formatRp,
  getOrdersWithoutHpp,
  todayISO,
} from '../lib/format';
import {
  Division,
  HppComponent,
  HppRecord,
  HppSourceType,
  OrderDraftFromHpp,
  Product,
} from '../types';

interface ProductsHppViewProps {
  onSendDraftToOrder: (draft: OrderDraftFromHpp) => void;
  focusHistoryTrigger?: number;
}

const HPP_PRESETS: {
  label: string;
  name: string;
  division: Division;
  unit: string;
  qty: number;
  targetMargin: number;
  components: HppComponent[];
}[] = [
  {
    label: 'Kaos Sablon Manual / DTF',
    name: 'Kaos Polos Combed 30s + Sablon Custom',
    division: 'sablon',
    unit: 'pcs',
    qty: 24,
    targetMargin: 30,
    components: [
      { label: 'Beli Kaos Polos dari Supplier', amount: 35000, mode: 'per_unit' },
      { label: 'Ongkos Cetak Sablon Manual / DTF', amount: 15000, mode: 'per_unit' },
      { label: 'Ongkos Pekerja / Operator per pcs', amount: 3000, mode: 'per_unit' },
      { label: 'Listrik, Press & Kemasan Plastik', amount: 2000, mode: 'per_unit' },
    ],
  },
  {
    label: 'Spanduk / Banner Flexi',
    name: 'Spanduk Flexi 280gr Outdoor',
    division: 'percetakan',
    unit: 'm²',
    qty: 10,
    targetMargin: 45,
    components: [
      { label: 'Bahan Banner Flexi 280gr', amount: 8500, mode: 'per_unit' },
      { label: 'Tinta Solvent & Listrik Mesin', amount: 3500, mode: 'per_unit' },
      { label: 'Mata Ayam + Lem + Upah Finishing', amount: 2500, mode: 'per_unit' },
    ],
  },
  {
    label: 'Stiker Vinyl A3+ Cut',
    name: 'Stiker Vinyl A3+ Kiss Cut',
    division: 'percetakan',
    unit: 'lembar',
    qty: 50,
    targetMargin: 48,
    components: [
      { label: 'Kertas Stiker Vinyl A3+', amount: 4500, mode: 'per_unit' },
      { label: 'Klik Mesin Print / Toner', amount: 2700, mode: 'per_unit' },
      { label: 'Cutting & Operator', amount: 2000, mode: 'per_unit' },
    ],
  },
  {
    label: 'Totebag Sablon Custom',
    name: 'Totebag Kanvas + Sablon DTF',
    division: 'sablon',
    unit: 'pcs',
    qty: 30,
    targetMargin: 35,
    components: [
      { label: 'Totebag Kanvas Supplier', amount: 16000, mode: 'per_unit' },
      { label: 'Print Film DTF + Powder', amount: 9000, mode: 'per_unit' },
      { label: 'Ongkos Pekerja Press', amount: 2500, mode: 'per_unit' },
      { label: 'Listrik & Packing', amount: 1500, mode: 'per_unit' },
    ],
  },
];

export const ProductsHppView: React.FC<ProductsHppViewProps> = ({
  onSendDraftToOrder,
  focusHistoryTrigger,
}) => {
  const {
    products,
    orders,
    hppRecords,
    saveProduct,
    deleteProduct,
    saveHppRecord,
    deleteHppRecord,
  } = useWorkspace();

  const [subTab, setSubTab] = useState<'history' | 'calculator' | 'catalog'>('history');

  useEffect(() => {
    if (focusHistoryTrigger && focusHistoryTrigger > 0) {
      setSubTab('history');
    }
  }, [focusHistoryTrigger]);

  // --- Riwayat HPP Filters ---
  const [hppSearch, setHppSearch] = useState('');
  const [hppMonthFilter, setHppMonthFilter] = useState('');
  const [hppSourceFilter, setHppSourceFilter] = useState<'all' | HppSourceType>('all');
  const [confirmDeleteHppId, setConfirmDeleteHppId] = useState<string | null>(null);

  // --- Riwayat HPP Modal (Tulis HPP Manual / Pilih Order Belum Ada HPP / Edit) ---
  const [showHppModal, setShowHppModal] = useState(false);
  const [editingHpp, setEditingHpp] = useState<HppRecord | null>(null);
  const [hppSourceType, setHppSourceType] = useState<HppSourceType>('order');
  const [hppOrderId, setHppOrderId] = useState('');
  const [hppInvoiceNumber, setHppInvoiceNumber] = useState('');
  const [hppCustomerName, setHppCustomerName] = useState('');
  const [hppDivision, setHppDivision] = useState<Division>('sablon');
  const [hppRecordDate, setHppRecordDate] = useState(todayISO());
  const [hppItemName, setHppItemName] = useState('');
  const [hppQty, setHppQty] = useState(1);
  const [hppUnit, setHppUnit] = useState('pcs');
  const [hppSellPriceTotal, setHppSellPriceTotal] = useState(0);
  const [hppInputMode, setHppInputMode] = useState<'manual' | 'components'>('manual');
  const [hppManualPerUnit, setHppManualPerUnit] = useState(0);
  const [hppComponentsForm, setHppComponentsForm] = useState<HppComponent[]>([
    { label: 'Kaos Polos / Bahan Baku', amount: 0, mode: 'per_unit' },
    { label: 'Sablon / Cetak / Finishing', amount: 0, mode: 'per_unit' },
  ]);
  const [hppBoronganCost, setHppBoronganCost] = useState(0);
  const [hppOtherCost, setHppOtherCost] = useState(0);
  const [hppSyncToCash, setHppSyncToCash] = useState(true);
  const [hppNotes, setHppNotes] = useState('');
  const [savingHpp, setSavingHpp] = useState(false);

  const ordersWithoutHpp = useMemo(
    () => getOrdersWithoutHpp(orders, hppRecords),
    [orders, hppRecords]
  );

  // Orders selectable in HPP modal (un-costed orders + currently linked order when editing)
  const selectableOrdersForHpp = useMemo(() => {
    const linkedSet = new Set(
      hppRecords
        .filter((h) => h.id !== editingHpp?.id && h.orderId)
        .map((h) => h.orderId)
    );
    return orders.filter((o) => !linkedSet.has(o.id));
  }, [orders, hppRecords, editingHpp]);

  const applyOrderToHppForm = (orderId: string) => {
    setHppOrderId(orderId);
    const ord = orders.find((o) => o.id === orderId);
    if (!ord) return;
    const totalQty = Math.max(
      1,
      (ord.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0)
    );
    const summaryName = (ord.items || [])
      .map((it) => `${it.name}${ord.items.length > 1 ? ` (${it.qty} ${it.unit})` : ''}`)
      .join(', ')
      .slice(0, 160);
    setHppInvoiceNumber(ord.invoiceNumber);
    setHppCustomerName(ord.customerName);
    setHppDivision(ord.division);
    setHppRecordDate(ord.orderDate || todayISO());
    setHppItemName(summaryName || 'Pesanan Order');
    setHppQty(totalQty);
    setHppUnit(ord.items?.length === 1 ? ord.items[0].unit || 'pcs' : 'pcs');
    setHppSellPriceTotal(ord.totalAmount || 0);
    setHppManualPerUnit(
      ord.totalHpp > 0 ? Math.round(ord.totalHpp / totalQty) : 0
    );
    setHppNotes(ord.notes || '');
  };

  const openHppModal = (opts?: { record?: HppRecord; orderId?: string; manualDefault?: boolean }) => {
    if (opts?.record) {
      const r = opts.record;
      setEditingHpp(r);
      setHppSourceType(r.sourceType);
      setHppOrderId(r.orderId || '');
      setHppInvoiceNumber(r.invoiceNumber || '');
      setHppCustomerName(r.customerName || '');
      setHppDivision(r.division);
      setHppRecordDate(r.recordDate || todayISO());
      setHppItemName(r.itemName);
      setHppQty(Math.max(1, r.qty || 1));
      setHppUnit(r.unit || 'pcs');
      setHppSellPriceTotal(r.sellPriceTotal || 0);
      if (r.hppComponents && r.hppComponents.length > 0) {
        setHppInputMode('components');
        setHppComponentsForm(r.hppComponents.map((c) => ({ ...c })));
      } else {
        setHppInputMode('manual');
        setHppComponentsForm([
          { label: 'Kaos Polos / Bahan Baku', amount: r.hppUnit || 0, mode: 'per_unit' },
          { label: 'Sablon / Cetak', amount: 0, mode: 'per_unit' },
        ]);
      }
      setHppManualPerUnit(r.hppUnit || 0);
      setHppBoronganCost(r.boronganCost || 0);
      setHppOtherCost(r.otherCost || 0);
      setHppSyncToCash(Boolean(r.syncToCash));
      setHppNotes(r.notes || '');
    } else if (opts?.orderId) {
      setEditingHpp(null);
      setHppSourceType('order');
      setHppInputMode('manual');
      setHppComponentsForm([
        { label: 'Kaos Polos / Bahan Baku', amount: 0, mode: 'per_unit' },
        { label: 'Sablon / Cetak', amount: 0, mode: 'per_unit' },
      ]);
      setHppBoronganCost(0);
      setHppOtherCost(0);
      setHppSyncToCash(true);
      applyOrderToHppForm(opts.orderId);
    } else {
      const defaultOrder = !opts?.manualDefault ? ordersWithoutHpp[0] : undefined;
      setEditingHpp(null);
      setHppInputMode('manual');
      setHppComponentsForm([
        { label: 'Kaos Polos / Bahan Baku', amount: 0, mode: 'per_unit' },
        { label: 'Sablon / Cetak', amount: 0, mode: 'per_unit' },
      ]);
      setHppBoronganCost(0);
      setHppOtherCost(0);
      setHppSyncToCash(true);
      if (defaultOrder) {
        setHppSourceType('order');
        applyOrderToHppForm(defaultOrder.id);
      } else {
        setHppSourceType('manual');
        setHppOrderId('');
        setHppInvoiceNumber('');
        setHppCustomerName('');
        setHppDivision('sablon');
        setHppRecordDate(todayISO());
        setHppItemName('');
        setHppQty(1);
        setHppUnit('pcs');
        setHppSellPriceTotal(0);
        setHppManualPerUnit(0);
        setHppNotes('');
      }
    }
    setShowHppModal(true);
  };

  const hppFormComputed = useMemo(() => {
    const qty = Math.max(1, Math.round(Number(hppQty) || 1));
    let hppTotal = 0;
    let hppUnit = 0;
    if (hppInputMode === 'components') {
      let perUnit = 0;
      let fixed = 0;
      for (const c of hppComponentsForm) {
        const amt = Math.max(0, Number(c.amount) || 0);
        if (c.mode === 'fixed') fixed += amt;
        else perUnit += amt;
      }
      hppTotal = Math.round(perUnit * qty + fixed);
      hppUnit = Math.round(hppTotal / qty);
    } else {
      hppUnit = Math.max(0, Math.round(Number(hppManualPerUnit) || 0));
      hppTotal = Math.round(hppUnit * qty);
    }
    const sellPriceTotal = Math.max(0, Math.round(Number(hppSellPriceTotal) || 0));
    const boronganCost = Math.max(0, Math.round(Number(hppBoronganCost) || 0));
    const otherCost = Math.max(0, Math.round(Number(hppOtherCost) || 0));
    const grossProfit = sellPriceTotal - hppTotal;
    const netProfit = grossProfit - boronganCost - otherCost;
    const marginPercent = sellPriceTotal > 0 ? (netProfit / sellPriceTotal) * 100 : 0;
    return {
      qty,
      hppUnit,
      hppTotal,
      sellPriceTotal,
      boronganCost,
      otherCost,
      grossProfit,
      netProfit,
      marginPercent,
    };
  }, [
    hppQty,
    hppInputMode,
    hppComponentsForm,
    hppManualPerUnit,
    hppSellPriceTotal,
    hppBoronganCost,
    hppOtherCost,
  ]);

  const handleSubmitHppModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hppItemName.trim()) return;
    if (hppSourceType === 'order' && !hppOrderId) return;

    setSavingHpp(true);
    try {
      await saveHppRecord(
        {
          sourceType: hppSourceType,
          orderId: hppSourceType === 'order' ? hppOrderId : '',
          invoiceNumber: hppSourceType === 'order' ? hppInvoiceNumber : hppInvoiceNumber,
          customerName: hppCustomerName,
          division: hppDivision,
          recordDate: hppRecordDate,
          itemName: hppItemName,
          qty: hppFormComputed.qty,
          unit: hppUnit,
          sellPriceTotal: hppFormComputed.sellPriceTotal,
          hppUnit: hppFormComputed.hppUnit,
          hppTotal: hppFormComputed.hppTotal,
          boronganCost: hppFormComputed.boronganCost,
          otherCost: hppFormComputed.otherCost,
          hppComponents:
            hppInputMode === 'components'
              ? hppComponentsForm.filter((c) => c.label.trim().length > 0)
              : [],
          syncToCash: hppSyncToCash,
          notes: hppNotes,
        },
        editingHpp?.id
      );
      setShowHppModal(false);
    } finally {
      setSavingHpp(false);
    }
  };

  const filteredHppRecords = useMemo(() => {
    const q = hppSearch.trim().toLowerCase();
    return hppRecords.filter((r) => {
      if (hppMonthFilter && !(r.recordDate || '').startsWith(hppMonthFilter)) return false;
      if (hppSourceFilter !== 'all' && r.sourceType !== hppSourceFilter) return false;
      if (!q) return true;
      return (
        r.itemName.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    });
  }, [hppRecords, hppSearch, hppMonthFilter, hppSourceFilter]);

  const filteredHppTotals = useMemo(() => {
    return filteredHppRecords.reduce(
      (acc, r) => {
        acc.sell += Number(r.sellPriceTotal) || 0;
        acc.hpp += Number(r.hppTotal) || 0;
        acc.gross += Number(r.grossProfit) || 0;
        acc.borongan += Number(r.boronganCost) || 0;
        acc.other += Number(r.otherCost) || 0;
        acc.net += Number(r.netProfit) || 0;
        return acc;
      },
      { sell: 0, hpp: 0, gross: 0, borongan: 0, other: 0, net: 0 }
    );
  }, [filteredHppRecords]);

  const handleExportHppCsv = () => {
    exportRowsToCsv(
      `riwayat-hpp-${hppMonthFilter || 'semua'}.csv`,
      [
        'Tanggal',
        'Sumber',
        'No Invoice',
        'Pelanggan',
        'Item Produksi',
        'Qty',
        'Satuan',
        'Harga Jual (Rp)',
        'HPP/Unit (Rp)',
        'Total HPP (Rp)',
        'Keuntungan Kotor (Rp)',
        'Gaji Borongan (Rp)',
        'Biaya Lain-Lain (Rp)',
        'Keuntungan Bersih (Rp)',
      ],
      filteredHppRecords.map((r) => [
        r.recordDate,
        r.sourceType === 'order' ? 'Order' : 'Manual',
        r.invoiceNumber || '-',
        r.customerName || '-',
        r.itemName,
        r.qty,
        r.unit,
        r.sellPriceTotal,
        r.hppUnit,
        r.hppTotal,
        r.grossProfit,
        r.boronganCost,
        r.otherCost,
        r.netProfit,
      ])
    );
  };

  // --- Product Catalog State ---
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState<'all' | Division>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [showProdModal, setShowProdModal] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodDiv, setProdDiv] = useState<Division>('sablon');
  const [prodUnit, setProdUnit] = useState('pcs');
  const [prodHpp, setProdHpp] = useState(0);
  const [prodSell, setProdSell] = useState(0);
  const [prodNotes, setProdNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // --- HPP Custom Calculator State ---
  const [calcName, setCalcName] = useState(HPP_PRESETS[0].name);
  const [calcDiv, setCalcDiv] = useState<Division>(HPP_PRESETS[0].division);
  const [calcUnit, setCalcUnit] = useState(HPP_PRESETS[0].unit);
  const [calcQty, setCalcQty] = useState(HPP_PRESETS[0].qty);
  const [calcComponents, setCalcComponents] = useState<HppComponent[]>(
    HPP_PRESETS[0].components.map((c) => ({ ...c }))
  );
  const [pricingMode, setPricingMode] = useState<'margin' | 'manual'>('margin');
  const [targetMargin, setTargetMargin] = useState(30);
  const [manualSellPrice, setManualSellPrice] = useState(78000);
  const [calcBorongan, setCalcBorongan] = useState(0);
  const [calcOther, setCalcOther] = useState(0);
  const [calcNotes, setCalcNotes] = useState('');
  const [calcSaving, setCalcSaving] = useState(false);
  const [calcSavingHistory, setCalcSavingHistory] = useState(false);

  const calcResult = useMemo(() => {
    const qty = Math.max(1, Number(calcQty) || 1);
    let perUnitDirect = 0;
    let totalFixedBatch = 0;

    for (const comp of calcComponents) {
      const amt = Math.max(0, Number(comp.amount) || 0);
      if (comp.mode === 'fixed') {
        totalFixedBatch += amt;
      } else {
        perUnitDirect += amt;
      }
    }

    const fixedPerUnit = totalFixedBatch / qty;
    const hppPerUnit = Math.round(perUnitDirect + fixedPerUnit);
    const totalModalBatch = Math.round(perUnitDirect * qty + totalFixedBatch);

    let sellPricePerUnit = 0;
    if (pricingMode === 'margin') {
      const m = Math.min(90, Math.max(0, Number(targetMargin) || 0));
      sellPricePerUnit = m >= 95 ? hppPerUnit * 2 : Math.round(hppPerUnit / (1 - m / 100));
      sellPricePerUnit = Math.ceil(sellPricePerUnit / 500) * 500;
    } else {
      sellPricePerUnit = Math.max(0, Math.round(Number(manualSellPrice) || 0));
    }

    const profitPerUnit = sellPricePerUnit - hppPerUnit;
    const actualMargin = sellPricePerUnit > 0 ? (profitPerUnit / sellPricePerUnit) * 100 : 0;
    const totalRevenueBatch = sellPricePerUnit * qty;
    const totalProfitBatch = totalRevenueBatch - totalModalBatch;
    const netProfitBatch =
      totalProfitBatch - (Math.max(0, Number(calcBorongan) || 0) + Math.max(0, Number(calcOther) || 0));

    return {
      qty,
      perUnitDirect,
      totalFixedBatch,
      fixedPerUnit: Math.round(fixedPerUnit),
      hppPerUnit,
      totalModalBatch,
      sellPricePerUnit,
      profitPerUnit,
      actualMargin,
      totalRevenueBatch,
      totalProfitBatch,
      netProfitBatch,
    };
  }, [calcComponents, calcQty, pricingMode, targetMargin, manualSellPrice, calcBorongan, calcOther]);

  const applyPreset = (preset: (typeof HPP_PRESETS)[number]) => {
    setCalcName(preset.name);
    setCalcDiv(preset.division);
    setCalcUnit(preset.unit);
    setCalcQty(preset.qty);
    setTargetMargin(preset.targetMargin);
    setPricingMode('margin');
    setCalcComponents(preset.components.map((c) => ({ ...c })));
  };

  const loadProductToCalculator = (prod: Product) => {
    setCalcName(prod.name);
    setCalcDiv(prod.division);
    setCalcUnit(prod.unit);
    setCalcQty(24);
    setManualSellPrice(prod.sellPrice);
    setPricingMode('manual');
    setCalcNotes(prod.notes || '');
    if (prod.hppComponents && prod.hppComponents.length > 0) {
      setCalcComponents(prod.hppComponents.map((c) => ({ ...c })));
    } else {
      setCalcComponents([
        { label: 'Modal / HPP Dasar', amount: prod.hppUnit, mode: 'per_unit' },
      ]);
    }
    setSubTab('calculator');
  };

  const handleSaveFromCalculator = async () => {
    if (!calcName.trim()) return;
    setCalcSaving(true);
    try {
      await saveProduct({
        name: calcName,
        division: calcDiv,
        unit: calcUnit,
        sellPrice: calcResult.sellPricePerUnit,
        hppUnit: calcResult.hppPerUnit,
        hppComponents: calcComponents.filter((c) => c.label.trim().length > 0),
        notes: calcNotes,
      });
    } finally {
      setCalcSaving(false);
    }
  };

  const handleSaveCalculatorToHistory = async () => {
    if (!calcName.trim()) return;
    setCalcSavingHistory(true);
    try {
      await saveHppRecord({
        sourceType: 'manual',
        orderId: '',
        invoiceNumber: '',
        customerName: 'Kalkulator HPP Manual',
        division: calcDiv,
        recordDate: todayISO(),
        itemName: calcName,
        qty: calcResult.qty,
        unit: calcUnit,
        sellPriceTotal: calcResult.totalRevenueBatch,
        hppUnit: calcResult.hppPerUnit,
        hppTotal: calcResult.totalModalBatch,
        boronganCost: Math.max(0, Number(calcBorongan) || 0),
        otherCost: Math.max(0, Number(calcOther) || 0),
        hppComponents: calcComponents.filter((c) => c.label.trim().length > 0),
        syncToCash: true,
        notes: calcNotes,
      });
      setSubTab('history');
    } finally {
      setCalcSavingHistory(false);
    }
  };

  const handleSendToOrder = () => {
    onSendDraftToOrder({
      name: calcName.trim() || 'Produk Custom',
      division: calcDiv,
      unit: calcUnit.trim() || 'pcs',
      qty: calcResult.qty,
      price: calcResult.sellPricePerUnit,
      hppUnit: calcResult.hppPerUnit,
    });
  };

  const openCatalogModal = (prod?: Product) => {
    if (prod) {
      setEditingProd(prod);
      setProdName(prod.name);
      setProdDiv(prod.division);
      setProdUnit(prod.unit);
      setProdHpp(prod.hppUnit);
      setProdSell(prod.sellPrice);
      setProdNotes(prod.notes);
    } else {
      setEditingProd(null);
      setProdName('');
      setProdDiv('sablon');
      setProdUnit('pcs');
      setProdHpp(0);
      setProdSell(0);
      setProdNotes('');
    }
    setShowProdModal(true);
  };

  const handleSubmitProductModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;
    setSaving(true);
    try {
      await saveProduct(
        {
          name: prodName,
          division: prodDiv,
          unit: prodUnit,
          sellPrice: prodSell,
          hppUnit: prodHpp,
          hppComponents: editingProd?.hppComponents || [],
          notes: prodNotes,
        },
        editingProd?.id
      );
      setShowProdModal(false);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (divFilter !== 'all' && p.division !== divFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.notes.toLowerCase().includes(q);
    });
  }, [products, search, divFilter]);

  return (
    <div className="space-y-5">
      {/* Header & Sub-tab Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#F8FAFC]">Riwayat HPP, Kalkulator &amp; Daftar Produk</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Pantau HPP order &amp; input manual lengkap dengan keuntungan kotor dan keuntungan bersih (setelah gaji borongan &amp; biaya lain-lain).
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#121824] border border-[#232C3D] rounded-xl overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'history'
                ? 'bg-sky-500 text-slate-950'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Riwayat HPP ({hppRecords.length})
            {ordersWithoutHpp.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  subTab === 'history'
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {ordersWithoutHpp.length} baru
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('calculator')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'calculator'
                ? 'bg-sky-500 text-slate-950'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            Kalkulator HPP
          </button>
          <button
            type="button"
            onClick={() => setSubTab('catalog')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'catalog'
                ? 'bg-sky-500 text-slate-950'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Daftar Produk ({products.length})
          </button>
        </div>
      </div>

      {/* TAB 1: RIWAYAT HPP & LABA KOTOR/BERSIH */}
      {subTab === 'history' && (
        <div className="space-y-4">
          {/* Un-costed Orders Quick Action Strip */}
          {ordersWithoutHpp.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/35 rounded-xl p-4 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-[#F8FAFC]">
                      {ordersWithoutHpp.length} Orderan Sudah Dicatat tapi Belum Diisi HPP-nya
                    </div>
                    <div className="text-[11px] text-[#CBD5E1]">
                      Pilih salah satu order di bawah untuk memasukkan HPP, gaji borongan &amp; biaya lain-lainnya tanpa mengubah harga jual di nota pelanggan.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openHppModal({ orderId: ordersWithoutHpp[0].id })}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Isi HPP Order Sekarang
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {ordersWithoutHpp.slice(0, 5).map((ord) => (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => openHppModal({ orderId: ord.id })}
                    className="px-3 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-[#182030] border border-[#232C3D] hover:border-amber-500/50 text-left text-xs transition-colors cursor-pointer"
                  >
                    <span className="font-mono font-bold text-sky-400">{ord.invoiceNumber}</span>
                    <span className="text-[#94A3B8] mx-1.5">·</span>
                    <span className="text-[#F8FAFC] font-medium">{ord.customerName}</span>
                    <span className="text-[#94A3B8] mx-1.5">·</span>
                    <span className="font-mono text-amber-300">{formatRp(ord.totalAmount)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
              <div className="text-xs text-[#94A3B8]">Total Harga Jual</div>
              <div className="text-lg font-mono font-bold tabular-nums text-[#F8FAFC] mt-1">
                {formatRp(filteredHppTotals.sell)}
              </div>
            </div>
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
              <div className="text-xs text-[#94A3B8]">Total Biaya HPP</div>
              <div className="text-lg font-mono font-bold tabular-nums text-amber-400 mt-1">
                {formatRp(filteredHppTotals.hpp)}
              </div>
            </div>
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
              <div className="text-xs text-[#94A3B8]">Keuntungan Kotor</div>
              <div
                className={`text-lg font-mono font-bold tabular-nums mt-1 ${
                  filteredHppTotals.gross >= 0 ? 'text-sky-400' : 'text-rose-400'
                }`}
              >
                {formatRp(filteredHppTotals.gross)}
              </div>
              <div className="text-[11px] text-[#64748B] mt-0.5">Harga Jual − HPP</div>
            </div>
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
              <div className="text-xs text-[#94A3B8]">Borongan &amp; Biaya Lain</div>
              <div className="text-lg font-mono font-bold tabular-nums text-rose-400 mt-1">
                {formatRp(filteredHppTotals.borongan + filteredHppTotals.other)}
              </div>
              <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
                Borongan {formatRp(filteredHppTotals.borongan)} · Lain {formatRp(filteredHppTotals.other)}
              </div>
            </div>
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>Keuntungan Bersih</span>
                <span className="font-mono font-semibold text-[#CBD5E1]">
                  {filteredHppTotals.sell > 0
                    ? `${((filteredHppTotals.net / filteredHppTotals.sell) * 100).toFixed(1)}%`
                    : '0%'}
                </span>
              </div>
              <div
                className={`text-lg font-mono font-extrabold tabular-nums mt-1 ${
                  filteredHppTotals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatRp(filteredHppTotals.net)}
              </div>
              <div className="text-[11px] text-[#64748B] mt-0.5">Kotor − Borongan − Lain</div>
            </div>
          </div>

          {/* Filter & Action Toolbar */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={hppSearch}
                onChange={(e) => setHppSearch(e.target.value)}
                placeholder="Cari item produksi, nomor invoice, atau nama pelanggan..."
                className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-[#121824] border border-[#232C3D] text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                aria-label="Filter bulan riwayat HPP"
                value={hppMonthFilter}
                onChange={(e) => setHppMonthFilter(e.target.value)}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
              />
              {hppMonthFilter && (
                <button
                  type="button"
                  onClick={() => setHppMonthFilter('')}
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-[#232C3D] bg-[#121824] text-xs text-[#94A3B8] hover:text-white"
                >
                  Semua Bulan
                </button>
              )}

              <div className="flex items-center gap-1 p-1 bg-[#121824] border border-[#232C3D] rounded-xl">
                {(['all', 'order', 'manual'] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setHppSourceFilter(src)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      hppSourceFilter === src
                        ? 'bg-[#232C3D] text-white'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {src === 'all' ? 'Semua' : src === 'order' ? 'Dari Order' : 'Input Manual'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleExportHppCsv}
                disabled={filteredHppRecords.length === 0}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#232C3D] bg-[#121824] hover:bg-[#182030] disabled:opacity-50 text-xs font-semibold text-[#F8FAFC] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                CSV
              </button>

              <button
                type="button"
                onClick={() => openHppModal()}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Tulis HPP / Pilih Order
              </button>
            </div>
          </div>

          {/* Riwayat HPP Table */}
          {filteredHppRecords.length === 0 ? (
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-[#F8FAFC]">Belum ada catatan di Riwayat HPP</p>
              <p className="text-xs text-[#94A3B8] max-w-lg mx-auto">
                Setiap order yang sudah memiliki HPP otomatis tercatat di sini. Anda juga bisa memilih order yang belum punya HPP atau menulis HPP manual lengkap dengan gaji borongan dan biaya lain-lain.
              </p>
              <div className="flex flex-wrap justify-center gap-2.5">
                {ordersWithoutHpp.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openHppModal({ orderId: ordersWithoutHpp[0].id })}
                    className="min-h-[42px] px-4 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-300 inline-flex items-center gap-2 cursor-pointer"
                  >
                    Pilih Order Belum Input HPP ({ordersWithoutHpp.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openHppModal({ manualDefault: true })}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Tulis HPP Manual
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#232C3D] text-xs font-semibold text-[#94A3B8] bg-[#0B0F17]/60">
                      <th className="py-3 px-4">Tanggal &amp; Sumber</th>
                      <th className="py-3 px-4">Item Produksi</th>
                      <th className="py-3 px-4 text-right">Harga Jual</th>
                      <th className="py-3 px-4 text-right">Biaya HPP</th>
                      <th className="py-3 px-4 text-right">Keuntungan Kotor</th>
                      <th className="py-3 px-4 text-right">Borongan &amp; Lain</th>
                      <th className="py-3 px-4 text-right">Keuntungan Bersih</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232C3D] text-sm">
                    {filteredHppRecords.map((rec) => {
                      const netMargin =
                        rec.sellPriceTotal > 0 ? (rec.netProfit / rec.sellPriceTotal) * 100 : 0;
                      return (
                        <tr key={rec.id} className="hover:bg-[#182030]/60 transition-colors">
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="font-mono text-xs text-[#94A3B8]">
                              {formatDateID(rec.recordDate)}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {rec.sourceType === 'order' ? (
                                <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-mono text-[10px] font-bold">
                                  {rec.invoiceNumber || 'ORDER'}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                                  MANUAL
                                </span>
                              )}
                              {rec.syncToCash && (
                                <span
                                  title="Tersinkron ke Pengeluaran Buku Kas"
                                  className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-semibold inline-flex items-center gap-0.5"
                                >
                                  <Wallet className="w-2.5 h-2.5" />
                                  Kas
                                </span>
                              )}
                            </div>
                            {rec.customerName && (
                              <div className="text-xs font-medium text-[#F8FAFC] mt-1 max-w-[160px] truncate">
                                {rec.customerName}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top max-w-[240px]">
                            <div className="font-semibold text-[#F8FAFC] truncate">
                              {rec.itemName}
                            </div>
                            <div className="text-xs text-[#94A3B8] mt-0.5">
                              <span className="font-mono tabular-nums">
                                {rec.qty} {rec.unit}
                              </span>
                              <span className="mx-1.5" aria-hidden="true">
                                ·
                              </span>
                              <span className="capitalize">{rec.division}</span>
                            </div>
                            {rec.notes && (
                              <div className="text-[11px] text-[#64748B] mt-1 line-clamp-1">
                                {rec.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top text-right font-mono font-bold tabular-nums text-[#F8FAFC] whitespace-nowrap">
                            {formatRp(rec.sellPriceTotal)}
                          </td>

                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div className="font-mono font-semibold tabular-nums text-amber-400">
                              {formatRp(rec.hppTotal)}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-[#94A3B8]">
                              {formatRp(rec.hppUnit)}/{rec.unit}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div
                              className={`font-mono font-bold tabular-nums ${
                                rec.grossProfit >= 0 ? 'text-sky-400' : 'text-rose-400'
                              }`}
                            >
                              {formatRp(rec.grossProfit)}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap text-xs">
                            <div className="font-mono tabular-nums text-[#CBD5E1]">
                              Borongan: {formatRp(rec.boronganCost)}
                            </div>
                            <div className="font-mono tabular-nums text-[#94A3B8] mt-0.5">
                              Lain-lain: {formatRp(rec.otherCost)}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div
                              className={`font-mono font-extrabold tabular-nums ${
                                rec.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatRp(rec.netProfit)}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-[#94A3B8]">
                              {netMargin.toFixed(1)}%
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openHppModal({ record: rec })}
                                title="Edit Riwayat HPP"
                                aria-label="Edit riwayat HPP"
                                className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-[#232C3D] text-[#94A3B8] hover:text-white inline-flex items-center justify-center cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {confirmDeleteHppId === rec.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void deleteHppRecord(rec);
                                    setConfirmDeleteHppId(null);
                                  }}
                                  className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                                >
                                  Hapus?
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteHppId(rec.id)}
                                  title="Hapus Riwayat HPP"
                                  aria-label="Hapus riwayat HPP"
                                  className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-rose-500/15 text-[#94A3B8] hover:text-rose-400 inline-flex items-center justify-center cursor-pointer"
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
        </div>
      )}

      {/* TAB 2: DAFTAR PRODUK KATALOG */}
      {subTab === 'catalog' && (
        <div className="space-y-4">
          {/* Catalog Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama produk atau layanan cetak/sablon..."
                className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-[#121824] border border-[#232C3D] text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#121824] border border-[#232C3D] rounded-xl">
                {(['all', 'percetakan', 'sablon'] as const).map((div) => (
                  <button
                    key={div}
                    type="button"
                    onClick={() => setDivFilter(div)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors whitespace-nowrap ${
                      divFilter === div ? 'bg-[#232C3D] text-white' : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {div === 'all' ? 'Semua' : div}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => openCatalogModal()}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Tambah Produk
              </button>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-[#F8FAFC]">Daftar produk masih kosong</p>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                Simpan produk dari Kalkulator HPP Custom atau tambahkan produk baru agar otomatis muncul saat mencatat Order Baru.
              </p>
              <div className="flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSubTab('calculator')}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#232C3D] bg-[#0B0F17] hover:bg-[#182030] text-xs font-semibold text-[#F8FAFC] inline-flex items-center gap-2"
                >
                  <Calculator className="w-4 h-4 text-sky-400" />
                  Hitung di Kalkulator HPP
                </button>
                <button
                  type="button"
                  onClick={() => openCatalogModal()}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Produk Manual
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#232C3D] text-xs font-semibold text-[#94A3B8] bg-[#0B0F17]/60">
                      <th className="py-3 px-4">Produk / Layanan</th>
                      <th className="py-3 px-4 text-right">HPP / Modal</th>
                      <th className="py-3 px-4 text-right">Harga Jual</th>
                      <th className="py-3 px-4 text-right">Laba / Margin</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232C3D] text-sm">
                    {filteredProducts.map((prod) => {
                      const profit = prod.sellPrice - prod.hppUnit;
                      const margin = prod.sellPrice > 0 ? (profit / prod.sellPrice) * 100 : 0;
                      return (
                        <tr key={prod.id} className="hover:bg-[#182030]/60 transition-colors">
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-semibold text-[#F8FAFC]">{prod.name}</div>
                            <div className="text-xs text-[#94A3B8] mt-0.5">
                              <span className="capitalize">{prod.division}</span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>per {prod.unit}</span>
                              {prod.hppComponents?.length > 0 && (
                                <>
                                  <span className="mx-1.5" aria-hidden="true">·</span>
                                  <span>{prod.hppComponents.length} komponen HPP</span>
                                </>
                              )}
                            </div>
                            {prod.notes && (
                              <div className="text-[11px] text-[#64748B] mt-1">{prod.notes}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums text-[#94A3B8] whitespace-nowrap">
                            {formatRp(prod.hppUnit)}
                          </td>
                          <td className="py-3.5 px-4 align-top text-right font-mono font-bold tabular-nums text-[#F8FAFC] whitespace-nowrap">
                            {formatRp(prod.sellPrice)}
                          </td>
                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div
                              className={`font-mono font-semibold tabular-nums ${
                                profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatRp(profit)}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-[#94A3B8]">
                              {margin.toFixed(1)}%
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onSendDraftToOrder({
                                    name: prod.name,
                                    division: prod.division,
                                    unit: prod.unit,
                                    qty: 1,
                                    price: prod.sellPrice,
                                    hppUnit: prod.hppUnit,
                                  })
                                }
                                title="Buat Order dari produk ini"
                                className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 text-xs font-semibold inline-flex items-center gap-1.5"
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                Order
                              </button>
                              <button
                                type="button"
                                onClick={() => loadProductToCalculator(prod)}
                                title="Buka di Kalkulator HPP"
                                aria-label="Buka di Kalkulator HPP"
                                className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-[#232C3D] text-[#94A3B8] hover:text-sky-400 inline-flex items-center justify-center"
                              >
                                <Calculator className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openCatalogModal(prod)}
                                title="Edit Produk"
                                aria-label="Edit produk"
                                className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-[#232C3D] text-[#94A3B8] hover:text-white inline-flex items-center justify-center"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {confirmDeleteId === prod.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void deleteProduct(prod.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                                >
                                  Hapus?
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(prod.id)}
                                  title="Hapus Produk"
                                  aria-label="Hapus produk"
                                  className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-rose-500/15 text-[#94A3B8] hover:text-rose-400 inline-flex items-center justify-center"
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
        </div>
      )}

      {/* TAB 3: KALKULATOR HPP CUSTOM */}
      {subTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Cost Builder */}
          <div className="lg:col-span-7 bg-[#121824] border border-[#232C3D] rounded-xl p-5 space-y-5">
            {/* Quick Presets */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-[#94A3B8]">Template Cepat HPP:</div>
              <div className="flex flex-wrap gap-2">
                {HPP_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="px-3 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-[#182030] border border-[#232C3D] text-xs font-medium text-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Nama Produk Custom
                </label>
                <input
                  type="text"
                  value={calcName}
                  onChange={(e) => setCalcName(e.target.value)}
                  placeholder="Contoh: Kaos Combed 30s + Sablon DTF"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Divisi</label>
                <select
                  value={calcDiv}
                  onChange={(e) => setCalcDiv(e.target.value as Division)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                >
                  <option value="sablon">Sablon</option>
                  <option value="percetakan">Percetakan</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Satuan</label>
                <input
                  type="text"
                  value={calcUnit}
                  onChange={(e) => setCalcUnit(e.target.value)}
                  placeholder="pcs / m²"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                />
              </div>
            </div>

            {/* Cost Components List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#F8FAFC]">
                  Rincian Komponen Biaya Produksi (HPP)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setCalcComponents((prev) => [
                      ...prev,
                      { label: '', amount: 0, mode: 'per_unit' },
                    ])
                  }
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Komponen
                </button>
              </div>

              <div className="space-y-2">
                {calcComponents.map((comp, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-[#0B0F17] border border-[#232C3D]"
                  >
                    <div className="col-span-12 sm:col-span-5">
                      <input
                        type="text"
                        value={comp.label}
                        onChange={(e) =>
                          setCalcComponents((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, label: e.target.value } : c))
                          )
                        }
                        placeholder="Mis. Kaos polos supplier / Sablon / Listrik"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <select
                        value={comp.mode}
                        onChange={(e) =>
                          setCalcComponents((prev) =>
                            prev.map((c, i) =>
                              i === idx
                                ? { ...c, mode: e.target.value as 'per_unit' | 'fixed' }
                                : c
                            )
                          )
                        }
                        className="w-full px-2 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#94A3B8]"
                      >
                        <option value="per_unit">Per {calcUnit || 'pcs'}</option>
                        <option value="fixed">Tetap / Batch</option>
                      </select>
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <input
                        type="number"
                        min={0}
                        value={comp.amount}
                        onChange={(e) =>
                          setCalcComponents((prev) =>
                            prev.map((c, i) =>
                              i === idx
                                ? { ...c, amount: Math.max(0, Number(e.target.value) || 0) }
                                : c
                            )
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs font-mono text-right text-[#F8FAFC] focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setCalcComponents((prev) =>
                            prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)
                          )
                        }
                        aria-label="Hapus komponen"
                        className="p-1.5 rounded-lg hover:bg-rose-500/15 text-[#94A3B8] hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                Tip: Pilih <strong>Tetap / Batch</strong> untuk biaya sekali keluar seperti pembuatan film/screen afdruk atau ongkir bahan agar otomatis dibagi rata dengan jumlah pesanan.
              </p>
            </div>

            {/* Qty & Target Margin / Sell Price */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#232C3D]">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Jumlah Pesanan ({calcUnit || 'pcs'})
                </label>
                <input
                  type="number"
                  min={1}
                  value={calcQty}
                  onChange={(e) => setCalcQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Mode Harga Jual
                </label>
                <div className="grid grid-cols-2 p-1 rounded-lg bg-[#0B0F17] border border-[#232C3D] min-h-[42px]">
                  <button
                    type="button"
                    onClick={() => setPricingMode('margin')}
                    className={`text-xs font-semibold rounded-md ${
                      pricingMode === 'margin' ? 'bg-sky-500 text-slate-950' : 'text-[#94A3B8]'
                    }`}
                  >
                    Target %
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualSellPrice(calcResult.sellPricePerUnit);
                      setPricingMode('manual');
                    }}
                    className={`text-xs font-semibold rounded-md ${
                      pricingMode === 'manual' ? 'bg-sky-500 text-slate-950' : 'text-[#94A3B8]'
                    }`}
                  >
                    Manual Rp
                  </button>
                </div>
              </div>

              <div>
                {pricingMode === 'margin' ? (
                  <>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      Target Margin Profit (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={targetMargin}
                      onChange={(e) =>
                        setTargetMargin(Math.min(90, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      Harga Jual per {calcUnit || 'pcs'} (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={manualSellPrice}
                      onChange={(e) =>
                        setManualSellPrice(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Optional Borongan & Other Cost for Calculator -> Riwayat HPP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#232C3D]">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Gaji Borongan Batch (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={calcBorongan}
                  onChange={(e) => setCalcBorongan(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-xs font-mono text-[#F8FAFC]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Biaya Lain-Lain Batch (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={calcOther}
                  onChange={(e) => setCalcOther(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-xs font-mono text-[#F8FAFC]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Catatan Produk (opsional)
              </label>
              <input
                type="text"
                value={calcNotes}
                onChange={(e) => setCalcNotes(e.target.value)}
                placeholder="Mis. Minimal order 12 pcs, sablon 2 warna"
                className="w-full min-h-[40px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-xs text-[#F8FAFC]"
              />
            </div>
          </div>

          {/* Right: Live HPP Summary & Direct Actions */}
          <div className="lg:col-span-5 bg-[#121824] border border-[#232C3D] rounded-xl p-5 space-y-5 lg:sticky lg:top-20">
            <div>
              <div className="text-xs font-medium text-sky-400">Hasil Simulasi HPP Custom</div>
              <h3 className="text-base font-bold text-[#F8FAFC] mt-0.5 truncate">
                {calcName || 'Produk Custom'}
              </h3>
            </div>

            <div className="space-y-2.5 text-sm border-y border-[#232C3D] py-4">
              <div className="flex justify-between text-[#94A3B8]">
                <span>Biaya Langsung per {calcUnit || 'pcs'}</span>
                <span className="font-mono tabular-nums text-[#F8FAFC]">
                  {formatRp(calcResult.perUnitDirect)}
                </span>
              </div>
              {calcResult.totalFixedBatch > 0 && (
                <div className="flex justify-between text-[#94A3B8]">
                  <span>
                    Biaya Tetap ({formatRp(calcResult.totalFixedBatch)} ÷ {calcResult.qty})
                  </span>
                  <span className="font-mono tabular-nums text-[#F8FAFC]">
                    {formatRp(calcResult.fixedPerUnit)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-[#232C3D]">
                <span className="text-[#F8FAFC]">Total HPP per {calcUnit || 'pcs'}</span>
                <span className="font-mono tabular-nums text-amber-400">
                  {formatRp(calcResult.hppPerUnit)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[#94A3B8]">Rekomendasi / Harga Jual</span>
                <span className="text-2xl font-mono font-extrabold tabular-nums text-[#F8FAFC]">
                  {formatRp(calcResult.sellPricePerUnit)}
                  <span className="text-xs font-normal text-[#94A3B8]">/{calcUnit || 'pcs'}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#0B0F17] border border-[#232C3D]">
                <div>
                  <div className="text-[11px] text-[#94A3B8]">Laba per {calcUnit || 'pcs'}</div>
                  <div
                    className={`text-sm font-mono font-bold tabular-nums mt-0.5 ${
                      calcResult.profitPerUnit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatRp(calcResult.profitPerUnit)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#94A3B8]">Margin Kotor</div>
                  <div
                    className={`text-sm font-mono font-bold tabular-nums mt-0.5 ${
                      calcResult.actualMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {calcResult.actualMargin.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#232C3D] space-y-1.5 text-xs">
                <div className="font-semibold text-[#F8FAFC]">
                  Simulasi Total Pesanan ({calcResult.qty} {calcUnit || 'pcs'})
                </div>
                <div className="flex justify-between text-[#94A3B8]">
                  <span>Total Nilai Tagihan Pelanggan</span>
                  <span className="font-mono tabular-nums text-[#F8FAFC]">
                    {formatRp(calcResult.totalRevenueBatch)}
                  </span>
                </div>
                <div className="flex justify-between text-[#94A3B8]">
                  <span>− Total Modal HPP</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    -{formatRp(calcResult.totalModalBatch)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-sky-400 pt-1 border-t border-[#232C3D]">
                  <span>= Keuntungan Kotor</span>
                  <span className="font-mono tabular-nums">
                    {formatRp(calcResult.totalProfitBatch)}
                  </span>
                </div>
                {(calcBorongan > 0 || calcOther > 0) && (
                  <>
                    <div className="flex justify-between text-[#94A3B8]">
                      <span>− Borongan &amp; Lain-Lain</span>
                      <span className="font-mono tabular-nums text-rose-400">
                        -{formatRp(calcBorongan + calcOther)}
                      </span>
                    </div>
                    <div className="flex justify-between font-extrabold text-emerald-400 pt-1 border-t border-[#232C3D]">
                      <span>= Keuntungan Bersih</span>
                      <span className="font-mono tabular-nums">
                        {formatRp(calcResult.netProfitBatch)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleSaveFromCalculator}
                disabled={calcSaving}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {calcSaving ? 'Menyimpan...' : 'Simpan ke Daftar Produk (Auto-Fill Order)'}
              </button>
              <button
                type="button"
                onClick={handleSaveCalculatorToHistory}
                disabled={calcSavingHistory}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <History className="w-4 h-4" />
                {calcSavingHistory ? 'Menyimpan...' : 'Catat Langsung ke Riwayat HPP & Buku Kas'}
              </button>
              <button
                type="button"
                onClick={handleSendToOrder}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-[#232C3D] bg-[#0B0F17] hover:bg-[#182030] text-[#F8FAFC] font-semibold text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                Gunakan Langsung ke Order Baru
                <ArrowRight className="w-4 h-4 text-sky-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Input / Edit Riwayat HPP (Pilih Order atau Tulis HPP Manual) */}
      {showHppModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-[#121824] border border-[#232C3D] rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#232C3D]">
              <div>
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  {editingHpp ? 'Edit Catatan Riwayat HPP' : 'Input HPP Order / Tulis HPP Manual'}
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Hasil harga jual order tetap sama, sementara modal HPP, gaji borongan &amp; biaya lain dihitung di Riwayat HPP dan Buku Kas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHppModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#182030] text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitHppModal} className="overflow-y-auto p-5 space-y-4 flex-1">
              {/* Source Switcher */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0B0F17] border border-[#232C3D]">
                <button
                  type="button"
                  onClick={() => {
                    setHppSourceType('order');
                    if (!hppOrderId && selectableOrdersForHpp[0]) {
                      applyOrderToHppForm(selectableOrdersForHpp[0].id);
                    }
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    hppSourceType === 'order'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Pilih Orderan Tercatat ({selectableOrdersForHpp.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHppSourceType('manual');
                    setHppOrderId('');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    hppSourceType === 'manual'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Tulis HPP Manual (Tanpa Order)
                </button>
              </div>

              {hppSourceType === 'order' && (
                <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#232C3D] space-y-2">
                  <label className="block text-xs font-semibold text-sky-400">
                    Pilih Orderan yang Sudah Dicatat *
                  </label>
                  {selectableOrdersForHpp.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">
                      Semua order yang tercatat sudah memiliki Riwayat HPP. Anda masih bisa memilih mode &ldquo;Tulis HPP Manual&rdquo; atau edit langsung dari tabel.
                    </p>
                  ) : (
                    <select
                      required
                      value={hppOrderId}
                      onChange={(e) => applyOrderToHppForm(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#121824] border border-[#232C3D] text-sm text-[#F8FAFC]"
                    >
                      <option value="">— Pilih Order —</option>
                      {selectableOrdersForHpp.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.invoiceNumber} · {ord.customerName} ({ord.items.map((i) => i.name).join(', ').slice(0, 40)}) — {formatRp(ord.totalAmount)} {ord.totalHpp === 0 ? '[Belum Input HPP]' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Nama Item / Pesanan *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={hppItemName}
                    onChange={(e) => setHppItemName(e.target.value)}
                    placeholder="Contoh: Kaos Hitam 24s L + Sablon"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={hppRecordDate}
                    onChange={(e) => setHppRecordDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Divisi</label>
                  <select
                    value={hppDivision}
                    onChange={(e) => setHppDivision(e.target.value as Division)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  >
                    <option value="sablon">Sablon</option>
                    <option value="percetakan">Percetakan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Pelanggan / Ket.</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={hppCustomerName}
                    onChange={(e) => setHppCustomerName(e.target.value)}
                    placeholder="Nama pelanggan"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Qty *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={hppQty}
                    onChange={(e) => setHppQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Satuan</label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    value={hppUnit}
                    onChange={(e) => setHppUnit(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Harga Jual Total (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={hppSellPriceTotal}
                    onChange={(e) => setHppSellPriceTotal(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
              </div>

              {/* HPP Input Mode: Manual Direct OR Component Breakdown */}
              <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#232C3D] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#F8FAFC]">Biaya Modal HPP</span>
                  <div className="flex items-center gap-1 p-0.5 bg-[#121824] border border-[#232C3D] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setHppInputMode('manual')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                        hppInputMode === 'manual' ? 'bg-sky-500 text-slate-950' : 'text-[#94A3B8]'
                      }`}
                    >
                      Tulis HPP/Unit Langsung
                    </button>
                    <button
                      type="button"
                      onClick={() => setHppInputMode('components')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                        hppInputMode === 'components'
                          ? 'bg-sky-500 text-slate-950'
                          : 'text-[#94A3B8]'
                      }`}
                    >
                      Rinci Komponen
                    </button>
                  </div>
                </div>

                {hppInputMode === 'manual' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#94A3B8] mb-1">
                        HPP / Modal per {hppUnit || 'pcs'} (Rp)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={hppManualPerUnit}
                        onChange={(e) =>
                          setHppManualPerUnit(Math.max(0, Number(e.target.value) || 0))
                        }
                        placeholder="Contoh: 36000"
                        className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#121824] border border-[#232C3D] text-sm font-mono text-amber-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#94A3B8] mb-1">
                        Total Biaya HPP ({hppFormComputed.qty} {hppUnit || 'pcs'})
                      </label>
                      <div className="min-h-[42px] px-3 py-2 rounded-lg bg-[#121824]/70 border border-[#232C3D] text-sm font-mono font-bold text-amber-400 flex items-center">
                        {formatRp(hppFormComputed.hppTotal)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {hppComponentsForm.map((comp, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={comp.label}
                          onChange={(e) =>
                            setHppComponentsForm((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, label: e.target.value } : c))
                            )
                          }
                          placeholder="Komponen biaya"
                          className="col-span-5 px-2.5 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                        />
                        <select
                          value={comp.mode}
                          onChange={(e) =>
                            setHppComponentsForm((prev) =>
                              prev.map((c, i) =>
                                i === idx
                                  ? { ...c, mode: e.target.value as 'per_unit' | 'fixed' }
                                  : c
                              )
                            )
                          }
                          className="col-span-3 px-2 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#94A3B8]"
                        >
                          <option value="per_unit">Per {hppUnit || 'pcs'}</option>
                          <option value="fixed">Tetap Batch</option>
                        </select>
                        <input
                          type="number"
                          min={0}
                          value={comp.amount}
                          onChange={(e) =>
                            setHppComponentsForm((prev) =>
                              prev.map((c, i) =>
                                i === idx
                                  ? { ...c, amount: Math.max(0, Number(e.target.value) || 0) }
                                  : c
                              )
                            )
                          }
                          className="col-span-3 px-2.5 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs font-mono text-right text-[#F8FAFC]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setHppComponentsForm((prev) =>
                              prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="col-span-1 p-1.5 rounded-lg hover:bg-rose-500/15 text-[#94A3B8] hover:text-rose-400 flex justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setHppComponentsForm((prev) => [
                          ...prev,
                          { label: '', amount: 0, mode: 'per_unit' },
                        ])
                      }
                      className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Komponen
                    </button>
                  </div>
                )}
              </div>

              {/* Borongan & Other Cost Deductions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Potongan Gaji Borongan (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={hppBoronganCost}
                    onChange={(e) => setHppBoronganCost(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Potongan Biaya Lain-Lain (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={hppOtherCost}
                    onChange={(e) => setHppOtherCost(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  Catatan (opsional)
                </label>
                <input
                  type="text"
                  maxLength={400}
                  value={hppNotes}
                  onChange={(e) => setHppNotes(e.target.value)}
                  placeholder="Mis. Kaos supplier + sablon 2 sisi, borongan Budi"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-xs text-[#F8FAFC]"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-[#F8FAFC] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hppSyncToCash}
                  onChange={(e) => setHppSyncToCash(e.target.checked)}
                  className="w-4 h-4 rounded accent-sky-500"
                />
                <span>
                  Otomatis catat/update biaya HPP, Gaji Borongan &amp; Biaya Lain-Lain ke Pengeluaran Buku Kas
                </span>
              </label>

              {/* Live P&L Breakdown */}
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#232C3D] space-y-2 text-xs">
                <div className="flex justify-between text-[#94A3B8]">
                  <span>Harga Jual Total</span>
                  <span className="font-mono font-semibold text-[#F8FAFC]">
                    {formatRp(hppFormComputed.sellPriceTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-[#94A3B8]">
                  <span>− Total Modal HPP ({hppFormComputed.qty} {hppUnit || 'pcs'})</span>
                  <span className="font-mono font-semibold text-amber-400">
                    -{formatRp(hppFormComputed.hppTotal)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-sky-400 pt-1.5 border-t border-[#232C3D]">
                  <span>= Keuntungan Kotor</span>
                  <span className="font-mono tabular-nums">{formatRp(hppFormComputed.grossProfit)}</span>
                </div>
                <div className="flex justify-between text-[#94A3B8]">
                  <span>− Gaji Borongan</span>
                  <span className="font-mono tabular-nums text-rose-400">
                    -{formatRp(hppFormComputed.boronganCost)}
                  </span>
                </div>
                <div className="flex justify-between text-[#94A3B8]">
                  <span>− Biaya Lain-Lain</span>
                  <span className="font-mono tabular-nums text-rose-400">
                    -{formatRp(hppFormComputed.otherCost)}
                  </span>
                </div>
                <div className="flex justify-between font-extrabold text-sm pt-2 border-t border-[#232C3D]">
                  <span className="text-[#F8FAFC]">= Keuntungan Bersih ({hppFormComputed.marginPercent.toFixed(1)}%)</span>
                  <span
                    className={`font-mono tabular-nums ${
                      hppFormComputed.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatRp(hppFormComputed.netProfit)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHppModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#232C3D] text-xs font-semibold text-[#94A3B8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingHpp}
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  {savingHpp ? 'Menyimpan...' : editingHpp ? 'Simpan Perubahan HPP' : 'Simpan ke Riwayat HPP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Catalog Product Modal */}
      {showProdModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-[#232C3D] rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                {editingProd ? 'Edit Produk Katalog' : 'Tambah Produk ke Katalog'}
              </h3>
              <button
                type="button"
                onClick={() => setShowProdModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#182030] text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitProductModal} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  Nama Produk / Jasa *
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="Contoh: Kaos Combed 30s + Sablon DTF"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Divisi</label>
                  <select
                    value={prodDiv}
                    onChange={(e) => setProdDiv(e.target.value as Division)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  >
                    <option value="sablon">Sablon</option>
                    <option value="percetakan">Percetakan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Satuan *</label>
                  <input
                    type="text"
                    required
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    placeholder="pcs / m² / lembar"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    HPP / Modal (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={prodHpp}
                    onChange={(e) => setProdHpp(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={prodSell}
                    onChange={(e) => setProdSell(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">Catatan</label>
                <input
                  type="text"
                  value={prodNotes}
                  onChange={(e) => setProdNotes(e.target.value)}
                  placeholder="Keterangan spesifikasi / minimal order"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProdModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#232C3D] text-xs font-semibold text-[#94A3B8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
