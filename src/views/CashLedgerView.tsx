import React, { useMemo, useState } from 'react';
import { Plus, Search, Download, Edit3, Trash2, X, ArrowDownLeft, ArrowUpRight, UserMinus } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  exportRowsToCsv,
  formatDateID,
  formatMonthKeyLabel,
  formatRp,
  getEmployeeKasbonTransactions,
  isKasbonTransaction,
  todayISO,
} from '../lib/format';
import {
  CashDivision,
  ExpenseGroup,
  PaymentMethod,
  Transaction,
  TransactionType,
} from '../types';

const EXPENSE_GROUP_LABELS: Record<ExpenseGroup, string> = {
  penjualan: 'Pemasukan / Penjualan',
  bahan_baku: 'Bahan Baku & Produksi',
  gaji_karyawan: 'Gaji & Upah Karyawan',
  biaya_lain_lain: 'Biaya Lain-Lain & Operasional',
};

const CATEGORY_PRESETS: Record<TransactionType, Record<ExpenseGroup, string[]>> = {
  pemasukan: {
    penjualan: [
      'Order Percetakan',
      'Order Sablon',
      'Penjualan Kaos Polos',
      'Jasa Desain Grafis',
      'Pemasukan Lainnya',
    ],
    bahan_baku: [],
    gaji_karyawan: [],
    biaya_lain_lain: [],
  },
  pengeluaran: {
    penjualan: [],
    bahan_baku: [
      'Kaos Polos Supplier',
      'Tinta Sablon & Plastisol',
      'Kertas, Banner & Stiker',
      'Film DTF & Powder',
      'Obat Afdruk & Bahan Kimia',
      'Bahan Finishing & Kemasan',
    ],
    gaji_karyawan: [
      'Kasbon Karyawan',
      'Gaji & Upah Karyawan',
      'Upah Borongan Sablon',
      'Lembur & Bonus Tim',
      'Uang Makan Karyawan',
    ],
    biaya_lain_lain: [
      'Listrik & Air Workshop',
      'Sewa Tempat / Kios',
      'Perawatan & Servis Mesin',
      'Internet & Pulsa Admin',
      'Ongkir & Transportasi',
      'Konsumsi & Kebersihan',
      'Biaya Tak Terduga / Lain-Lain',
    ],
  },
};

export const CashLedgerView: React.FC = () => {
  const { transactions, employees, payrollLogs, saveTransaction, deleteTransaction } = useWorkspace();

  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState(''); // '' = all, or YYYY-MM
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [divFilter, setDivFilter] = useState<'all' | CashDivision>('all');
  const [groupFilter, setGroupFilter] = useState<'all' | ExpenseGroup>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form Modal
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [type, setType] = useState<TransactionType>('pengeluaran');
  const [division, setDivision] = useState<CashDivision>('umum');
  const [expenseGroup, setExpenseGroup] = useState<ExpenseGroup>('biaya_lain_lain');
  const [category, setCategory] = useState('Listrik & Air Workshop');
  const [kasbonEmployeeId, setKasbonEmployeeId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tunai');
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const isKasbonMode =
    type === 'pengeluaran' &&
    expenseGroup === 'gaji_karyawan' &&
    /kasbon/i.test(category);

  const openModal = (
    presetType: TransactionType = 'pengeluaran',
    tx?: Transaction,
    presetKasbon = false
  ) => {
    if (tx) {
      setEditingTx(tx);
      setType(tx.type);
      setDivision(tx.division);
      setExpenseGroup(tx.expenseGroup);
      setCategory(tx.category);
      setKasbonEmployeeId(tx.referenceType === 'payroll' ? tx.referenceId : '');
      setDescription(tx.description);
      setAmount(tx.amount);
      setPaymentMethod(tx.paymentMethod);
      setDate(tx.date);
    } else {
      setEditingTx(null);
      setType(presetType);
      if (presetType === 'pemasukan') {
        setDivision('sablon');
        setExpenseGroup('penjualan');
        setCategory('Order Sablon');
        setKasbonEmployeeId('');
        setDescription('');
      } else if (presetKasbon) {
        const firstActiveEmp = employees.find((e) => e.isActive) || employees[0];
        setDivision('umum');
        setExpenseGroup('gaji_karyawan');
        setCategory('Kasbon Karyawan');
        setKasbonEmployeeId(firstActiveEmp?.id || '');
        setDescription(firstActiveEmp ? `Kasbon ${firstActiveEmp.name}` : 'Kasbon Karyawan');
      } else {
        setDivision('umum');
        setExpenseGroup('biaya_lain_lain');
        setCategory('Listrik & Air Workshop');
        setKasbonEmployeeId('');
        setDescription('');
      }
      setAmount(0);
      setPaymentMethod('tunai');
      setDate(todayISO());
    }
    setShowModal(true);
  };

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    if (nextType === 'pemasukan') {
      setExpenseGroup('penjualan');
      setCategory('Order Sablon');
      setDivision('sablon');
      setKasbonEmployeeId('');
    } else {
      setExpenseGroup('biaya_lain_lain');
      setCategory('Listrik & Air Workshop');
      setDivision('umum');
      setKasbonEmployeeId('');
    }
  };

  const handleGroupChange = (nextGroup: ExpenseGroup) => {
    setExpenseGroup(nextGroup);
    const list = CATEGORY_PRESETS[type][nextGroup];
    if (list && list.length > 0) {
      const nextCat = list[0];
      setCategory(nextCat);
      if (nextGroup === 'gaji_karyawan' && /kasbon/i.test(nextCat)) {
        const firstEmp = employees.find((e) => e.isActive) || employees[0];
        if (firstEmp && !kasbonEmployeeId) {
          setKasbonEmployeeId(firstEmp.id);
          if (!description.trim()) setDescription(`Kasbon ${firstEmp.name}`);
        }
      }
    }
  };

  const handleSelectKasbonEmployee = (empId: string) => {
    const prevEmp = employees.find((e) => e.id === kasbonEmployeeId);
    const nextEmp = employees.find((e) => e.id === empId);
    setKasbonEmployeeId(empId);
    if (
      nextEmp &&
      (!description.trim() ||
        description.trim() === 'Kasbon Karyawan' ||
        (prevEmp && description.trim() === `Kasbon ${prevEmp.name}`))
    ) {
      setDescription(`Kasbon ${nextEmp.name}`);
    }
  };

  // Live preview of employee's running monthly salary balance when entering Kasbon
  const kasbonSalaryPreview = useMemo(() => {
    if (!isKasbonMode || !kasbonEmployeeId) return null;
    const emp = employees.find((e) => e.id === kasbonEmployeeId);
    if (!emp) return null;
    const monthKey = (date || todayISO()).slice(0, 7);
    const monthLogs = payrollLogs.filter(
      (l) => l.employeeId === emp.id && (l.workDate || '').startsWith(monthKey)
    );
    const earnedMonth = monthLogs.reduce((s, l) => s + (Number(l.netAmount) || 0), 0);
    const existingKasbons = getEmployeeKasbonTransactions(transactions, emp, monthKey).filter(
      (t) => t.id !== editingTx?.id
    );
    const prevKasbonTotal = existingKasbons.reduce((s, t) => s + t.amount, 0);
    const currentInput = Math.max(0, Number(amount) || 0);
    const remainingMonthSalary = earnedMonth - prevKasbonTotal - currentInput;
    return {
      employee: emp,
      monthLabel: formatMonthKeyLabel(monthKey).full,
      earnedMonth,
      prevKasbonTotal,
      currentInput,
      remainingMonthSalary,
    };
  }, [isKasbonMode, kasbonEmployeeId, employees, date, payrollLogs, transactions, editingTx, amount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) return;
    if (isKasbonMode && !editingTx && employees.length > 0 && !kasbonEmployeeId) return;
    setSaving(true);
    try {
      await saveTransaction(
        {
          type,
          division,
          expenseGroup: type === 'pemasukan' ? 'penjualan' : expenseGroup,
          category,
          description,
          amount,
          paymentMethod,
          date,
          referenceType: isKasbonMode && kasbonEmployeeId ? 'payroll' : undefined,
          referenceId: isKasbonMode && kasbonEmployeeId ? kasbonEmployeeId : undefined,
        },
        editingTx?.id
      );
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (monthFilter && !tx.date.startsWith(monthFilter)) return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (divFilter !== 'all' && tx.division !== divFilter) return false;
      if (groupFilter !== 'all' && tx.expenseGroup !== groupFilter) return false;
      if (!q) return true;
      return (
        tx.description.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q)
      );
    });
  }, [transactions, search, monthFilter, typeFilter, divFilter, groupFilter]);

  const summary = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    let bahan = 0;
    let gaji = 0;
    let lain = 0;
    for (const tx of filtered) {
      if (tx.type === 'pemasukan') {
        masuk += tx.amount;
      } else {
        keluar += tx.amount;
        if (tx.expenseGroup === 'bahan_baku') bahan += tx.amount;
        else if (tx.expenseGroup === 'gaji_karyawan') gaji += tx.amount;
        else lain += tx.amount;
      }
    }
    return { masuk, keluar, saldo: masuk - keluar, bahan, gaji, lain };
  }, [filtered]);

  const handleExportCsv = () => {
    exportRowsToCsv(
      `buku-kas-${monthFilter || 'semua'}.csv`,
      ['Tanggal', 'Jenis', 'Divisi', 'Kelompok', 'Kategori', 'Keterangan', 'Metode', 'Nominal (Rp)'],
      filtered.map((tx) => [
        tx.date,
        tx.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
        tx.division,
        EXPENSE_GROUP_LABELS[tx.expenseGroup],
        tx.category,
        tx.description,
        tx.paymentMethod.toUpperCase(),
        tx.type === 'pemasukan' ? tx.amount : -tx.amount,
      ])
    );
  };

  const activeCategoryPresets =
    CATEGORY_PRESETS[type][type === 'pemasukan' ? 'penjualan' : expenseGroup] || [];

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#F8FAFC]">Buku Kas Harian</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Catat seluruh pemasukan, belanja bahan baku, gaji karyawan, serta biaya lain-lain (listrik, sewa, servis mesin).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openModal('pemasukan')}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-400 font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            Pemasukan
          </button>
          <button
            type="button"
            onClick={() => openModal('pengeluaran', undefined, true)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-400 font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <UserMinus className="w-4 h-4" />
            Kasbon Karyawan
          </button>
          <button
            type="button"
            onClick={() => openModal('pengeluaran')}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Catat Pengeluaran
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
          <div className="text-xs text-[#94A3B8]">Total Pemasukan</div>
          <div className="text-lg font-mono font-bold tabular-nums text-emerald-400 mt-1">
            {formatRp(summary.masuk)}
          </div>
        </div>
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
          <div className="text-xs text-[#94A3B8]">Total Pengeluaran</div>
          <div className="text-lg font-mono font-bold tabular-nums text-rose-400 mt-1">
            {formatRp(summary.keluar)}
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
            Bahan {formatRp(summary.bahan)} · Gaji {formatRp(summary.gaji)} · Lain {formatRp(summary.lain)}
          </div>
        </div>
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3.5">
          <div className="text-xs text-[#94A3B8]">Arus Kas Bersih</div>
          <div
            className={`text-lg font-mono font-bold tabular-nums mt-1 ${
              summary.saldo >= 0 ? 'text-[#F8FAFC]' : 'text-rose-400'
            }`}
          >
            {formatRp(summary.saldo)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari keterangan atau kategori transaksi..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-[#121824] border border-[#232C3D] text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            aria-label="Filter bulan"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
          />
          {monthFilter && (
            <button
              type="button"
              onClick={() => setMonthFilter('')}
              className="min-h-[42px] px-3 py-2 rounded-xl border border-[#232C3D] bg-[#121824] text-xs text-[#94A3B8] hover:text-white"
            >
              Semua Bulan
            </button>
          )}

          <select
            aria-label="Filter jenis transaksi"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | TransactionType)}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
          >
            <option value="all">Semua Jenis</option>
            <option value="pemasukan">Pemasukan</option>
            <option value="pengeluaran">Pengeluaran</option>
          </select>

          <select
            aria-label="Filter kelompok pos"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value as 'all' | ExpenseGroup)}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
          >
            <option value="all">Semua Kelompok</option>
            <option value="penjualan">Penjualan</option>
            <option value="bahan_baku">Bahan Baku</option>
            <option value="gaji_karyawan">Gaji Karyawan</option>
            <option value="biaya_lain_lain">Biaya Lain-Lain</option>
          </select>

          <select
            aria-label="Filter divisi"
            value={divFilter}
            onChange={(e) => setDivFilter(e.target.value as 'all' | CashDivision)}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
          >
            <option value="all">Semua Divisi</option>
            <option value="percetakan">Percetakan</option>
            <option value="sablon">Sablon</option>
            <option value="umum">Umum</option>
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#232C3D] bg-[#121824] hover:bg-[#182030] disabled:opacity-50 text-xs font-semibold text-[#F8FAFC] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            CSV
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      {filtered.length === 0 ? (
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-[#F8FAFC]">Belum ada transaksi kas</p>
          <p className="text-xs text-[#94A3B8]">
            Transaksi otomatis masuk saat Anda mencatat DP/pelunasan order, restok bahan, gaji, atau input manual.
          </p>
        </div>
      ) : (
        <div className="bg-[#121824] border border-[#232C3D] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232C3D] text-xs font-semibold text-[#94A3B8] bg-[#0B0F17]/60">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Keterangan & Kategori</th>
                  <th className="py-3 px-4">Pos / Divisi</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232C3D] text-sm">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#182030]/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-[#94A3B8] whitespace-nowrap">
                      {formatDateID(tx.date)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#F8FAFC]">{tx.description}</div>
                      <div className="text-xs text-[#94A3B8] mt-0.5 flex flex-wrap items-center gap-x-1.5">
                        <span>{tx.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="uppercase">{tx.paymentMethod}</span>
                        {isKasbonTransaction(tx) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-400 font-semibold">
                              Potong Slip Gaji
                              {tx.referenceId
                                ? ` (${employees.find((e) => e.id === tx.referenceId)?.name || 'Karyawan'})`
                                : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#94A3B8] whitespace-nowrap">
                      <div className="text-[#F8FAFC]">{EXPENSE_GROUP_LABELS[tx.expenseGroup]}</div>
                      <div className="capitalize mt-0.5">Divisi {tx.division}</div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span
                        className={`font-mono font-bold tabular-nums inline-flex items-center gap-1 ${
                          tx.type === 'pemasukan' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {tx.type === 'pemasukan' ? (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                        {tx.type === 'pemasukan' ? '+' : '-'}
                        {formatRp(tx.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openModal(tx.type, tx)}
                          aria-label="Edit transaksi"
                          className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-[#232C3D] text-[#94A3B8] hover:text-white inline-flex items-center justify-center"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {confirmDeleteId === tx.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              void deleteTransaction(tx.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                          >
                            Hapus?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(tx.id)}
                            aria-label="Hapus transaksi"
                            className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-rose-500/15 text-[#94A3B8] hover:text-rose-400 inline-flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Cash Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-[#232C3D] rounded-2xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                {editingTx ? 'Edit Transaksi Kas' : 'Catat Transaksi Kas'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#182030] text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Type Segmented Toggle */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0B0F17] border border-[#232C3D]">
                <button
                  type="button"
                  onClick={() => handleTypeChange('pemasukan')}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                    type === 'pemasukan'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Pemasukan (+)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('pengeluaran')}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                    type === 'pengeluaran'
                      ? 'bg-rose-500 text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Pengeluaran (−)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Tanggal *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Nominal (Rp) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={amount || ''}
                    onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="Contoh: 150000"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Divisi</label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value as CashDivision)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  >
                    <option value="percetakan">Percetakan</option>
                    <option value="sablon">Sablon</option>
                    <option value="umum">Umum / Operasional</option>
                  </select>
                </div>

                {type === 'pengeluaran' ? (
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                      Kelompok Biaya (Laporan Laba Rugi)
                    </label>
                    <select
                      value={expenseGroup}
                      onChange={(e) => handleGroupChange(e.target.value as ExpenseGroup)}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                    >
                      <option value="bahan_baku">Bahan Baku & Produksi</option>
                      <option value="gaji_karyawan">Gaji & Upah Karyawan</option>
                      <option value="biaya_lain_lain">Biaya Lain-Lain & Operasional</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                      Metode Bayar
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                    >
                      <option value="transfer">Transfer</option>
                      <option value="tunai">Tunai</option>
                      <option value="qris">QRIS</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Kategori *
                  </label>
                  <input
                    type="text"
                    required
                    list="cash-category-presets"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Pilih atau ketik kategori..."
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                  <datalist id="cash-category-presets">
                    {activeCategoryPresets.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                {type === 'pengeluaran' && (
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                      Metode Bayar
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                    >
                      <option value="tunai">Tunai</option>
                      <option value="transfer">Transfer</option>
                      <option value="qris">QRIS</option>
                    </select>
                  </div>
                )}
              </div>

              {isKasbonMode && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-amber-300 mb-1">
                      Pilih Nama Karyawan yang Kasbon (Otomatis Potong di Slip Gaji) *
                    </label>
                    {employees.length === 0 ? (
                      <div className="text-xs text-[#94A3B8]">
                        Belum ada data karyawan. Tambahkan karyawan dulu di menu Gaji Karyawan.
                      </div>
                    ) : (
                      <select
                        required={!editingTx}
                        disabled={Boolean(editingTx)}
                        value={kasbonEmployeeId}
                        onChange={(e) => handleSelectKasbonEmployee(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-amber-500/40 disabled:opacity-70 text-sm text-[#F8FAFC]"
                      >
                        <option value="">-- Pilih Karyawan --</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} — {emp.role}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {kasbonSalaryPreview && (
                    <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#232C3D] space-y-1 text-xs">
                      <div className="text-[11px] font-semibold text-[#94A3B8] pb-1 border-b border-[#232C3D]">
                        Simulasi Slip Gaji — {kasbonSalaryPreview.employee.name} ({kasbonSalaryPreview.monthLabel})
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="text-[#94A3B8]">Upah Bulan Berjalan</span>
                        <span className="font-mono tabular-nums text-[#F8FAFC]">
                          {formatRp(kasbonSalaryPreview.earnedMonth)}
                        </span>
                      </div>
                      {kasbonSalaryPreview.prevKasbonTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#94A3B8]">Kasbon Sebelumnya</span>
                          <span className="font-mono tabular-nums text-rose-400">
                            -{formatRp(kasbonSalaryPreview.prevKasbonTotal)}
                          </span>
                        </div>
                      )}
                      {kasbonSalaryPreview.currentInput > 0 && (
                        <div className="flex justify-between">
                          <span className="text-amber-300">Kasbon Ini</span>
                          <span className="font-mono tabular-nums text-amber-300">
                            -{formatRp(kasbonSalaryPreview.currentInput)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-[#232C3D] font-bold">
                        <span className="text-[#F8FAFC]">Sisa Gaji Bulan Berjalan</span>
                        <span
                          className={`font-mono tabular-nums ${
                            kasbonSalaryPreview.remainingMonthSalary >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {formatRp(kasbonSalaryPreview.remainingMonthSalary)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  Keterangan Transaksi *
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    isKasbonMode
                      ? 'Contoh: Kasbon Andi — keperluan mendadak'
                      : 'Contoh: Token listrik mesin press & printer bulan ini'
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#232C3D] text-xs font-semibold text-[#94A3B8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
