import React, { useMemo, useState } from 'react';
import { Plus, Minus, Search, AlertTriangle, Edit3, Trash2, X, Camera } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { formatRp, todayISO } from '../lib/format';
import { Division, Material, MaterialCategory, PaymentMethod } from '../types';
import { StockReceiptScanModal } from './StockReceiptScanModal';

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  tinta: 'Tinta & Cat',
  kaos_kain: 'Kaos & Kain Polos',
  kertas_media: 'Kertas, Banner & Stiker',
  kimia_sablon: 'Film DTF & Kimia Sablon',
  finishing: 'Finishing & Kemasan',
  lainnya: 'Lainnya',
};

export const MaterialsView: React.FC = () => {
  const { materials, saveMaterial, adjustMaterialStock, deleteMaterial } = useWorkspace();

  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState<'all' | Division>('all');
  const [lowOnly, setLowOnly] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Add/Edit Material Modal & Receipt Scanner Modal
  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('kaos_kain');
  const [division, setDivision] = useState<Division>('sablon');
  const [stock, setStock] = useState(0);
  const [minStock, setMinStock] = useState(10);
  const [unit, setUnit] = useState('pcs');
  const [lastBuyPrice, setLastBuyPrice] = useState(0);
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Stock Adjustment Modal (In / Out)
  const [adjustTarget, setAdjustTarget] = useState<{ material: Material; mode: 'in' | 'out' } | null>(
    null
  );
  const [adjQty, setAdjQty] = useState(1);
  const [adjPrice, setAdjPrice] = useState(0);
  const [adjLogCash, setAdjLogCash] = useState(true);
  const [adjMethod, setAdjMethod] = useState<PaymentMethod>('transfer');
  const [adjDate, setAdjDate] = useState(todayISO());

  const openForm = (mat?: Material) => {
    if (mat) {
      setEditing(mat);
      setName(mat.name);
      setCategory(mat.category);
      setDivision(mat.division);
      setStock(mat.stock);
      setMinStock(mat.minStock);
      setUnit(mat.unit);
      setLastBuyPrice(mat.lastBuyPrice);
      setSupplier(mat.supplier);
      setNotes(mat.notes);
    } else {
      setEditing(null);
      setName('');
      setCategory('kaos_kain');
      setDivision('sablon');
      setStock(0);
      setMinStock(10);
      setUnit('pcs');
      setLastBuyPrice(0);
      setSupplier('');
      setNotes('');
    }
    setShowForm(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveMaterial(
        {
          name,
          category,
          division,
          stock,
          minStock,
          unit,
          lastBuyPrice,
          supplier,
          notes,
        },
        editing?.id
      );
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const openAdjust = (material: Material, mode: 'in' | 'out') => {
    setAdjustTarget({ material, mode });
    setAdjQty(mode === 'in' ? 10 : 1);
    setAdjPrice(material.lastBuyPrice || 0);
    setAdjLogCash(mode === 'in');
    setAdjMethod('transfer');
    setAdjDate(todayISO());
  };

  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget || adjQty <= 0) return;
    setSaving(true);
    try {
      const delta = adjustTarget.mode === 'in' ? adjQty : -adjQty;
      await adjustMaterialStock(
        adjustTarget.material,
        delta,
        adjPrice,
        adjustTarget.mode === 'in' && adjLogCash,
        adjMethod,
        adjDate
      );
      setAdjustTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter((m) => {
      if (divFilter !== 'all' && m.division !== divFilter) return false;
      if (lowOnly && m.stock > m.minStock) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.supplier.toLowerCase().includes(q) ||
        CATEGORY_LABELS[m.category].toLowerCase().includes(q)
      );
    });
  }, [materials, search, divFilter, lowOnly]);

  const lowCount = useMemo(
    () => materials.filter((m) => m.stock <= m.minStock).length,
    [materials]
  );

  const inventoryValue = useMemo(
    () => materials.reduce((s, m) => s + m.stock * m.lastBuyPrice, 0),
    [materials]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#F8FAFC]">Stok Bahan Baku Cetak & Sablon</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Pantau stok tinta, kaos polos, kertas, banner, dan film DTF — scan nota supplier atau screenshot belanja online langsung masuk stok.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#121824] hover:bg-[#182030] border border-sky-500/40 text-sky-400 font-bold text-xs inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            Scan Nota / Screenshot
          </button>
          <button
            type="button"
            onClick={() => openForm()}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Bahan Baku
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
          <div className="text-xs text-[#94A3B8]">Total Jenis Bahan</div>
          <div className="text-lg font-mono font-bold tabular-nums text-[#F8FAFC] mt-1">
            {materials.length} item
          </div>
        </div>
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
          <div className="text-xs text-[#94A3B8]">Perlu Restok (Menipis / Habis)</div>
          <div
            className={`text-lg font-mono font-bold tabular-nums mt-1 ${
              lowCount > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {lowCount} bahan
          </div>
        </div>
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
          <div className="text-xs text-[#94A3B8]">Estimasi Nilai Aset Stok</div>
          <div className="text-lg font-mono font-bold tabular-nums text-[#F8FAFC] mt-1">
            {formatRp(inventoryValue)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari tinta, kaos polos, roll flexi, atau supplier..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-[#121824] border border-[#232C3D] text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-sky-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#121824] border border-[#232C3D] rounded-xl">
            {(['all', 'percetakan', 'sablon'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDivFilter(d)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap ${
                  divFilter === d ? 'bg-[#232C3D] text-white' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {d === 'all' ? 'Semua' : d}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLowOnly((v) => !v)}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
              lowOnly
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                : 'bg-[#121824] border-[#232C3D] text-[#94A3B8] hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Stok Menipis ({lowCount})
          </button>
        </div>
      </div>

      {/* Materials Table */}
      {filtered.length === 0 ? (
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-[#F8FAFC]">Belum ada data bahan baku</p>
          <p className="text-xs text-[#94A3B8]">
            Tambahkan bahan seperti Kaos Polos Combed 30s, Tinta Plastisol, atau Roll Flexi agar stok selalu terpantau.
          </p>
          <button
            type="button"
            onClick={() => openForm()}
            className="min-h-[42px] px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Tambah Bahan Pertama
          </button>
        </div>
      ) : (
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232C3D] text-xs font-semibold text-[#94A3B8] bg-[#0B0F17]/60">
                  <th className="py-3 px-4">Nama Bahan & Kategori</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-right">Harga Beli</th>
                  <th className="py-3 px-4 text-right">Sisa Stok</th>
                  <th className="py-3 px-4 text-right">Mutasi & Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232C3D] text-sm">
                {filtered.map((mat) => {
                  const isOut = mat.stock <= 0;
                  const isLow = mat.stock <= mat.minStock;
                  return (
                    <tr key={mat.id} className="hover:bg-[#182030]/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#F8FAFC]">{mat.name}</div>
                        <div className="text-xs text-[#94A3B8] mt-0.5">
                          <span className="capitalize">{mat.division}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{CATEGORY_LABELS[mat.category]}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#94A3B8]">
                        {mat.supplier || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-[#F8FAFC] whitespace-nowrap">
                        {formatRp(mat.lastBuyPrice)}/{mat.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div
                          className={`font-mono font-bold tabular-nums ${
                            isOut
                              ? 'text-rose-400'
                              : isLow
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }`}
                        >
                          {mat.stock} {mat.unit}
                        </div>
                        <div className="text-[11px] text-[#94A3B8]">
                          {isOut ? 'Habis' : isLow ? 'Perlu Restok' : 'Aman'} · Min {mat.minStock}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openAdjust(mat, 'in')}
                            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Masuk
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjust(mat, 'out')}
                            disabled={mat.stock <= 0}
                            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-[#1E293B] border border-[#232C3D] disabled:opacity-40 text-[#F8FAFC] text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Minus className="w-3.5 h-3.5 text-amber-400" />
                            Pakai
                          </button>
                          <button
                            type="button"
                            onClick={() => openForm(mat)}
                            aria-label="Edit bahan"
                            className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-[#232C3D] text-[#94A3B8] hover:text-white inline-flex items-center justify-center"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {confirmDeleteId === mat.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                void deleteMaterial(mat.id);
                                setConfirmDeleteId(null);
                              }}
                              className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                            >
                              Hapus?
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(mat.id)}
                              aria-label="Hapus bahan"
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

      {/* Add / Edit Material Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-[#232C3D] rounded-2xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                {editing ? 'Edit Bahan Baku' : 'Tambah Bahan Baku Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg hover:bg-[#182030] text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  Nama Bahan *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Kaos Polos Combed 30s Hitam (L)"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Divisi</label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value as Division)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  >
                    <option value="sablon">Sablon</option>
                    <option value="percetakan">Percetakan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  >
                    {(Object.keys(CATEGORY_LABELS) as MaterialCategory[]).map((k) => (
                      <option key={k} value={k}>
                        {CATEGORY_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Stok Awal</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={stock}
                    onChange={(e) => setStock(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Stok Min</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={minStock}
                    onChange={(e) => setMinStock(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Satuan *</label>
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="pcs / kg / roll"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Harga Beli / Satuan (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={lastBuyPrice}
                    onChange={(e) => setLastBuyPrice(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Supplier</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Nama toko / supplier"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#232C3D] text-xs font-semibold text-[#94A3B8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Bahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-[#232C3D] rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                {adjustTarget.mode === 'in' ? 'Restok / Bahan Masuk' : 'Catat Pemakaian Produksi'}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="p-1.5 rounded-lg hover:bg-[#182030] text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#232C3D] text-xs">
              <div className="font-semibold text-[#F8FAFC]">{adjustTarget.material.name}</div>
              <div className="text-[#94A3B8] mt-0.5">
                Stok saat ini:{' '}
                <span className="font-mono font-bold text-[#F8FAFC]">
                  {adjustTarget.material.stock} {adjustTarget.material.unit}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitAdjust} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  Jumlah ({adjustTarget.material.unit}) *
                </label>
                <input
                  type="number"
                  min={0.1}
                  step="any"
                  max={adjustTarget.mode === 'out' ? adjustTarget.material.stock : 1000000}
                  required
                  value={adjQty}
                  onChange={(e) => setAdjQty(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                />
              </div>

              {adjustTarget.mode === 'in' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                        Harga Beli / {adjustTarget.material.unit}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={adjPrice}
                        onChange={(e) => setAdjPrice(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#94A3B8] mb-1">Tanggal</label>
                      <input
                        type="date"
                        value={adjDate}
                        onChange={(e) => setAdjDate(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#232C3D] flex justify-between text-xs">
                    <span className="text-[#94A3B8]">Total Belanja Bahan</span>
                    <span className="font-mono font-bold text-amber-400">
                      {formatRp(Math.round(adjQty * adjPrice))}
                    </span>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#F8FAFC] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adjLogCash}
                      onChange={(e) => setAdjLogCash(e.target.checked)}
                      className="w-4 h-4 accent-sky-500"
                    />
                    <span>Otomatis catat sebagai Pengeluaran Bahan Baku di Buku Kas</span>
                  </label>

                  {adjLogCash && (
                    <div>
                      <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                        Metode Bayar
                      </label>
                      <select
                        value={adjMethod}
                        onChange={(e) => setAdjMethod(e.target.value as PaymentMethod)}
                        className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                      >
                        <option value="transfer">Transfer</option>
                        <option value="tunai">Tunai</option>
                        <option value="qris">QRIS</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#232C3D] text-xs font-semibold text-[#94A3B8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Receipt / Online Screenshot Scanner Modal */}
      {showScanner && <StockReceiptScanModal onClose={() => setShowScanner(false)} />}
    </div>
  );
};
