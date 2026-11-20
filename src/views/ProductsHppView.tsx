import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { formatRp } from '../lib/format';
import { Division, HppComponent, OrderDraftFromHpp, Product } from '../types';

interface ProductsHppViewProps {
  onSendDraftToOrder: (draft: OrderDraftFromHpp) => void;
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

export const ProductsHppView: React.FC<ProductsHppViewProps> = ({ onSendDraftToOrder }) => {
  const { products, saveProduct, deleteProduct } = useWorkspace();

  const [subTab, setSubTab] = useState<'catalog' | 'calculator'>('catalog');
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState<'all' | Division>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Quick Product Modal (for direct add/edit in catalog)
  const [showProdModal, setShowProdModal] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodDiv, setProdDiv] = useState<Division>('sablon');
  const [prodUnit, setProdUnit] = useState('pcs');
  const [prodHpp, setProdHpp] = useState(0);
  const [prodSell, setProdSell] = useState(0);
  const [prodNotes, setProdNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // HPP Custom Calculator State (preloaded with user's exact example!)
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
  const [calcNotes, setCalcNotes] = useState('');
  const [calcSaving, setCalcSaving] = useState(false);

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
      // Round cleanly to nearest Rp500
      sellPricePerUnit = Math.ceil(sellPricePerUnit / 500) * 500;
    } else {
      sellPricePerUnit = Math.max(0, Math.round(Number(manualSellPrice) || 0));
    }

    const profitPerUnit = sellPricePerUnit - hppPerUnit;
    const actualMargin = sellPricePerUnit > 0 ? (profitPerUnit / sellPricePerUnit) * 100 : 0;
    const totalRevenueBatch = sellPricePerUnit * qty;
    const totalProfitBatch = totalRevenueBatch - totalModalBatch;

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
    };
  }, [calcComponents, calcQty, pricingMode, targetMargin, manualSellPrice]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#F8FAFC]">Daftar Produk & Kalkulator HPP Custom</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Kelola katalog untuk isi otomatis saat membuat order, atau hitung rincian HPP custom (kaos polos, sablon/DTF, pekerja, listrik).
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#121824] border border-[#232C3D] rounded-xl shrink-0">
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
            Kalkulator HPP Custom
          </button>
        </div>
      </div>

      {subTab === 'catalog' ? (
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
      ) : (
        /* HPP Custom Calculator */
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
                  <div className="text-[11px] text-[#94A3B8]">Margin Bersih</div>
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
                  <span>Total Modal Produksi</span>
                  <span className="font-mono tabular-nums">{formatRp(calcResult.totalModalBatch)}</span>
                </div>
                <div className="flex justify-between text-[#94A3B8]">
                  <span>Total Nilai Tagihan Pelanggan</span>
                  <span className="font-mono tabular-nums text-[#F8FAFC]">
                    {formatRp(calcResult.totalRevenueBatch)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-emerald-400 pt-1 border-t border-[#232C3D]">
                  <span>Estimasi Total Laba Order</span>
                  <span className="font-mono tabular-nums">
                    {formatRp(calcResult.totalProfitBatch)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleSaveFromCalculator}
                disabled={calcSaving}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {calcSaving ? 'Menyimpan...' : 'Simpan ke Daftar Produk (Auto-Fill Order)'}
              </button>
              <button
                type="button"
                onClick={handleSendToOrder}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#232C3D] bg-[#0B0F17] hover:bg-[#182030] text-[#F8FAFC] font-semibold text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                Gunakan Langsung ke Order Baru
                <ArrowRight className="w-4 h-4 text-sky-400" />
              </button>
            </div>
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
