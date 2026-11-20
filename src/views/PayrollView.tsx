import React, { useMemo, useState } from 'react';
import {
  Plus,
  Users,
  ClipboardList,
  Printer,
  Edit3,
  Trash2,
  X,
  UserPlus,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  formatDateID,
  formatMonthKeyLabel,
  formatRp,
  getEmployeeKasbonTransactions,
  todayISO,
} from '../lib/format';
import { Employee, PayrollLog, PayrollStatus, PayrollType, PayScheme } from '../types';
import { PaySlipModal } from './PaySlipModal';

export const PayrollView: React.FC = () => {
  const {
    employees,
    payrollLogs,
    transactions,
    shopProfile,
    saveEmployee,
    deleteEmployee,
    savePayrollLog,
    deletePayrollLog,
    markPayrollPaidAndLogCash,
  } = useWorkspace();

  const [subTab, setSubTab] = useState<'logs' | 'employees'>('logs');
  const [filterEmpId, setFilterEmpId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | PayrollStatus>('all');
  const [filterMonth, setFilterMonth] = useState<string>(''); // YYYY-MM or ''
  const [confirmDeleteLogId, setConfirmDeleteLogId] = useState<string | null>(null);
  const [confirmDeleteEmpId, setConfirmDeleteEmpId] = useState<string | null>(null);

  // PaySlip Modal State
  const [slipEmployee, setSlipEmployee] = useState<Employee | null>(null);

  // Employee Modal State
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empScheme, setEmpScheme] = useState<PayScheme>('borongan');
  const [empRate, setEmpRate] = useState(3000);
  const [empActive, setEmpActive] = useState(true);

  // Work / Payroll Log Modal State
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingLog, setEditingLog] = useState<PayrollLog | null>(null);
  const [logEmpId, setLogEmpId] = useState('');
  const [logDate, setLogDate] = useState(todayISO());
  const [logPayType, setLogPayType] = useState<PayrollType>('borongan');
  const [logJobDesc, setLogJobDesc] = useState('');
  const [logQty, setLogQty] = useState(1);
  const [logUnit, setLogUnit] = useState('pcs');
  const [logRate, setLogRate] = useState(0);
  const [logBonus, setLogBonus] = useState(0);
  const [logDeduction, setLogDeduction] = useState(0);
  const [logNotes, setLogNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const openEmpModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmp(emp);
      setEmpName(emp.name);
      setEmpRole(emp.role);
      setEmpPhone(emp.phone);
      setEmpScheme(emp.payScheme);
      setEmpRate(emp.defaultRate);
      setEmpActive(emp.isActive);
    } else {
      setEditingEmp(null);
      setEmpName('');
      setEmpRole('');
      setEmpPhone('');
      setEmpScheme('borongan');
      setEmpRate(3000);
      setEmpActive(true);
    }
    setShowEmpModal(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !empRole.trim()) return;
    setSaving(true);
    try {
      await saveEmployee(
        {
          name: empName,
          role: empRole,
          phone: empPhone,
          payScheme: empScheme,
          defaultRate: empRate,
          isActive: empActive,
        },
        editingEmp?.id
      );
      setShowEmpModal(false);
    } finally {
      setSaving(false);
    }
  };

  const openLogModal = (log?: PayrollLog) => {
    if (log) {
      setEditingLog(log);
      setLogEmpId(log.employeeId);
      setLogDate(log.workDate);
      setLogPayType(log.payType);
      setLogJobDesc(log.jobDescription);
      setLogQty(log.quantity);
      setLogUnit(log.unitLabel);
      setLogRate(log.rate);
      setLogBonus(log.bonus);
      setLogDeduction(log.deduction);
      setLogNotes(log.notes);
    } else {
      setEditingLog(null);
      const firstEmp = employees[0];
      setLogEmpId(firstEmp?.id || '');
      setLogDate(todayISO());
      const defaultType: PayrollType = firstEmp?.payScheme === 'harian' ? 'harian' : 'borongan';
      setLogPayType(defaultType);
      setLogJobDesc('');
      setLogQty(defaultType === 'harian' ? 1 : 24);
      setLogUnit(defaultType === 'harian' ? 'hari' : 'pcs');
      setLogRate(firstEmp?.defaultRate || 0);
      setLogBonus(0);
      setLogDeduction(0);
      setLogNotes('');
    }
    setShowLogModal(true);
  };

  const handleSelectLogEmployee = (id: string) => {
    setLogEmpId(id);
    const emp = employees.find((e) => e.id === id);
    if (!emp) return;
    const pType: PayrollType = emp.payScheme === 'harian' ? 'harian' : 'borongan';
    setLogPayType(pType);
    setLogUnit(pType === 'harian' ? 'hari' : 'pcs');
    setLogRate(emp.defaultRate);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((item) => item.id === logEmpId);
    if (!emp || !logJobDesc.trim()) return;
    setSaving(true);
    try {
      await savePayrollLog(
        {
          employeeId: emp.id,
          employeeName: emp.name,
          employeeRole: emp.role,
          workDate: logDate,
          payType: logPayType,
          jobDescription: logJobDesc,
          quantity: logQty,
          unitLabel: logUnit,
          rate: logRate,
          bonus: logBonus,
          deduction: logDeduction,
          notes: logNotes,
        },
        editingLog?.id
      );
      setShowLogModal(false);
    } finally {
      setSaving(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return payrollLogs.filter((l) => {
      if (filterEmpId !== 'all' && l.employeeId !== filterEmpId) return false;
      if (filterStatus !== 'all' && l.status !== filterStatus) return false;
      if (filterMonth && !l.workDate.startsWith(filterMonth)) return false;
      return true;
    });
  }, [payrollLogs, filterEmpId, filterStatus, filterMonth]);

  const activeSummaryMonth = filterMonth || todayISO().slice(0, 7);
  const activeSummaryMonthLabel = formatMonthKeyLabel(activeSummaryMonth).full;

  // Per-employee summary for quick Slip Gaji generation (including auto Kasbon deduction for active month)
  const employeeSummaries = useMemo(() => {
    return employees.map((emp) => {
      const empLogs = payrollLogs.filter(
        (l) =>
          l.employeeId === emp.id &&
          l.workDate.startsWith(activeSummaryMonth)
      );
      const unpaid = empLogs
        .filter((l) => l.status === 'belum_dibayar')
        .reduce((s, l) => s + l.netAmount, 0);
      const paid = empLogs
        .filter((l) => l.status === 'dibayar')
        .reduce((s, l) => s + l.netAmount, 0);
      const empKasbons = getEmployeeKasbonTransactions(transactions, emp, activeSummaryMonth);
      const kasbonTotal = empKasbons.reduce((s, k) => s + k.amount, 0);
      const totalEarned = unpaid + paid;
      const sisaGaji = totalEarned - kasbonTotal;
      return {
        employee: emp,
        logs: empLogs,
        kasbonCount: empKasbons.length,
        kasbonTotal,
        unpaid,
        paid,
        total: totalEarned,
        sisaGaji,
      };
    });
  }, [employees, payrollLogs, transactions, activeSummaryMonth]);

  const totalUnpaidAll = useMemo(
    () =>
      filteredLogs
        .filter((l) => l.status === 'belum_dibayar')
        .reduce((s, l) => s + l.netAmount, 0),
    [filteredLogs]
  );

  const totalPaidAll = useMemo(
    () =>
      filteredLogs
        .filter((l) => l.status === 'dibayar')
        .reduce((s, l) => s + l.netAmount, 0),
    [filteredLogs]
  );

  const slipLogs = useMemo(() => {
    if (!slipEmployee) return [];
    return payrollLogs
      .filter((l) => l.employeeId === slipEmployee.id)
      .sort((a, b) => a.workDate.localeCompare(b.workDate));
  }, [slipEmployee, payrollLogs]);

  const liveLogNet = Math.max(
    0,
    Math.round((Number(logQty) || 0) * (Number(logRate) || 0) + (Number(logBonus) || 0) - (Number(logDeduction) || 0))
  );

  return (
    <div className="space-y-5">
      {/* Header & Sub-tab */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#F8FAFC]">Gaji Karyawan (Harian & Borongan)</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Catat & edit upah kerja harian maupun borongan per pekerjaan, lalu cetak Slip Gaji lengkap dengan logo usaha.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#121824] border border-[#232C3D] rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('logs')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              subTab === 'logs' ? 'bg-sky-500 text-slate-950' : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Pekerjaan & Slip Gaji
          </button>
          <button
            type="button"
            onClick={() => setSubTab('employees')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              subTab === 'employees'
                ? 'bg-sky-500 text-slate-950'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Karyawan ({employees.length})
          </button>
        </div>
      </div>

      {subTab === 'logs' ? (
        <div className="space-y-5">
          {/* Quick Slip Gaji per Employee Cards */}
          {employees.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#94A3B8]">
                  Ringkasan & Slip Gaji per Karyawan — Periode {activeSummaryMonthLabel}
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="month"
                    aria-label="Filter bulan gaji"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                  />
                  {filterMonth && (
                    <button
                      type="button"
                      onClick={() => setFilterMonth('')}
                      className="px-2.5 py-1.5 rounded-lg border border-[#232C3D] bg-[#121824] text-xs text-[#94A3B8] hover:text-white"
                    >
                      Bulan Ini
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {employeeSummaries.map(
                  ({ employee, logs, kasbonCount, kasbonTotal, total, sisaGaji }) => (
                    <div
                      key={employee.id}
                      className="bg-[#121824] border border-[#232C3D] rounded-xl p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#F8FAFC] truncate">
                            {employee.name}
                          </div>
                          <div className="text-xs text-[#94A3B8] truncate">
                            {employee.role} · <span className="capitalize">{employee.payScheme}</span>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-[#94A3B8] shrink-0">
                          {logs.length} kerja
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-[#232C3D] text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#94A3B8]">Upah {activeSummaryMonthLabel}</span>
                          <span className="font-mono font-semibold tabular-nums text-[#F8FAFC]">
                            {formatRp(total)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#94A3B8]">
                            Kasbon (Buku Kas){kasbonCount > 0 ? ` · ${kasbonCount}×` : ''}
                          </span>
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              kasbonTotal > 0 ? 'text-rose-400' : 'text-[#64748B]'
                            }`}
                          >
                            {kasbonTotal > 0 ? `-${formatRp(kasbonTotal)}` : 'Rp0'}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-[#232C3D]/70">
                          <span className="font-semibold text-[#F8FAFC]">Sisa Gaji Bulan Ini</span>
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              sisaGaji < 0
                                ? 'text-rose-400'
                                : kasbonTotal > 0
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                            }`}
                          >
                            {formatRp(sisaGaji)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={logs.length === 0 && kasbonCount === 0}
                        onClick={() => setSlipEmployee(employee)}
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-[#182030] disabled:opacity-40 border border-[#232C3D] text-xs font-semibold text-[#F8FAFC] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-sky-400" />
                        Lihat & Cetak Slip Gaji
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Filter & Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter karyawan"
                value={filterEmpId}
                onChange={(e) => setFilterEmpId(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
              >
                <option value="all">Semua Karyawan</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 p-1 bg-[#121824] border border-[#232C3D] rounded-xl">
                {(['all', 'belum_dibayar', 'dibayar'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${
                      filterStatus === st
                        ? 'bg-[#232C3D] text-white'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {st === 'all' ? 'Semua' : st === 'belum_dibayar' ? 'Belum Dibayar' : 'Dibayar'}
                  </button>
                ))}
              </div>

              <span className="text-xs text-[#94A3B8] hidden md:inline">
                Belum dibayar:{' '}
                <strong className="font-mono text-amber-400">{formatRp(totalUnpaidAll)}</strong> ·
                Dibayar:{' '}
                <strong className="font-mono text-emerald-400">{formatRp(totalPaidAll)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {employees.length === 0 ? (
                <button
                  type="button"
                  onClick={() => openEmpModal()}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Tambah Karyawan Dulu
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openLogModal()}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Catat Pekerjaan / Gaji
                </button>
              )}
            </div>
          </div>

          {/* Work Logs Table */}
          {filteredLogs.length === 0 ? (
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-[#F8FAFC]">
                Belum ada catatan kerja / upah karyawan
              </p>
              <p className="text-xs text-[#94A3B8]">
                {employees.length === 0
                  ? 'Tambahkan data karyawan terlebih dahulu lalu catat pekerjaan harian atau borongan mereka.'
                  : 'Klik "Catat Pekerjaan / Gaji" untuk mencatat hasil kerja harian maupun borongan.'}
              </p>
            </div>
          ) : (
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#232C3D] text-xs font-semibold text-[#94A3B8] bg-[#0B0F17]/60">
                      <th className="py-3 px-4">Tanggal & Karyawan</th>
                      <th className="py-3 px-4">Pekerjaan & Tipe</th>
                      <th className="py-3 px-4 text-right">Volume × Tarif</th>
                      <th className="py-3 px-4 text-right">Upah Bersih</th>
                      <th className="py-3 px-4 text-right">Status & Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232C3D] text-sm">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#182030]/60 transition-colors">
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-semibold text-[#F8FAFC]">{log.employeeName}</div>
                          <div className="text-xs text-[#94A3B8] mt-0.5">
                            <span className="font-mono">{formatDateID(log.workDate)}</span>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span>{log.employeeRole}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <div className="text-sm text-[#F8FAFC]">{log.jobDescription}</div>
                          <div className="text-xs text-[#94A3B8] mt-0.5 capitalize">
                            {log.payType}
                            {log.bonus > 0 && ` · Bonus +${formatRp(log.bonus)}`}
                            {log.deduction > 0 && ` · Potongan -${formatRp(log.deduction)}`}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top text-right font-mono text-xs tabular-nums text-[#94A3B8] whitespace-nowrap">
                          {log.quantity} {log.unitLabel} × {formatRp(log.rate)}
                        </td>
                        <td className="py-3.5 px-4 align-top text-right font-mono font-bold tabular-nums text-[#F8FAFC] whitespace-nowrap">
                          {formatRp(log.netAmount)}
                        </td>
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className={`text-xs font-semibold mr-1 ${
                                log.status === 'dibayar' ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {log.status === 'dibayar' ? 'Dibayar' : 'Belum Dibayar'}
                            </span>
                            {log.status === 'belum_dibayar' && (
                              <button
                                type="button"
                                onClick={() => openLogModal(log)}
                                title="Edit catatan kerja & gaji"
                                aria-label="Edit catatan kerja"
                                className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-[#232C3D] text-[#94A3B8] hover:text-white inline-flex items-center justify-center"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            {confirmDeleteLogId === log.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void deletePayrollLog(log.id);
                                  setConfirmDeleteLogId(null);
                                }}
                                className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                              >
                                Hapus?
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteLogId(log.id)}
                                aria-label="Hapus catatan kerja"
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
        </div>
      ) : (
        /* Employees Directory Sub-tab */
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openEmpModal()}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Tambah Karyawan
            </button>
          </div>

          {employees.length === 0 ? (
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-[#F8FAFC]">Belum ada karyawan terdaftar</p>
              <p className="text-xs text-[#94A3B8]">
                Tambahkan operator cetak, tukang sablon, desainer, atau tim finishing beserta skema gaji harian/borongannya.
              </p>
              <button
                type="button"
                onClick={() => openEmpModal()}
                className="min-h-[42px] px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Tambah Karyawan Pertama
              </button>
            </div>
          ) : (
            <div className="bg-[#121824] border border-[#232C3D] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#232C3D] text-xs font-semibold text-[#94A3B8] bg-[#0B0F17]/60">
                      <th className="py-3 px-4">Nama & Bagian</th>
                      <th className="py-3 px-4">No. WA</th>
                      <th className="py-3 px-4">Skema Upah</th>
                      <th className="py-3 px-4 text-right">Tarif Default</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232C3D] text-sm">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-[#182030]/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#F8FAFC]">{emp.name}</div>
                          <div className="text-xs text-[#94A3B8]">{emp.role}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#94A3B8] font-mono">
                          {emp.phone || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-xs capitalize text-[#F8FAFC]">
                          {emp.payScheme} ·{' '}
                          <span className={emp.isActive ? 'text-emerald-400' : 'text-[#64748B]'}>
                            {emp.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-[#F8FAFC]">
                          {formatRp(emp.defaultRate)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEmpModal(emp)}
                              aria-label="Edit karyawan"
                              className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-[#232C3D] text-[#94A3B8] hover:text-white inline-flex items-center justify-center"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {confirmDeleteEmpId === emp.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void deleteEmployee(emp.id);
                                  setConfirmDeleteEmpId(null);
                                }}
                                className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                              >
                                Hapus?
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteEmpId(emp.id)}
                                aria-label="Hapus karyawan"
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
        </div>
      )}

      {/* Employee Modal */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-[#232C3D] rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                {editingEmp ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowEmpModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#182030] text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Posisi / Bagian *
                  </label>
                  <input
                    type="text"
                    required
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value)}
                    placeholder="Tukang Sablon / Operator"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">No. WA</label>
                  <input
                    type="text"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Skema Upah</label>
                  <select
                    value={empScheme}
                    onChange={(e) => setEmpScheme(e.target.value as PayScheme)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  >
                    <option value="borongan">Borongan (per pcs/pekerjaan)</option>
                    <option value="harian">Harian (per hari kerja)</option>
                    <option value="campuran">Campuran (Harian & Borongan)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Tarif Standar (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={empRate}
                    onChange={(e) => setEmpRate(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#F8FAFC] cursor-pointer">
                <input
                  type="checkbox"
                  checked={empActive}
                  onChange={(e) => setEmpActive(e.target.checked)}
                  className="w-4 h-4 accent-sky-500"
                />
                <span>Status Karyawan Aktif</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#232C3D] text-xs font-semibold text-[#94A3B8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Work & Payroll Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121824] border border-[#232C3D] rounded-2xl w-full max-w-lg p-5 space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                {editingLog ? 'Edit Catatan Pekerjaan & Gaji' : 'Catat Pekerjaan & Gaji Karyawan'}
              </h3>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#182030] text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLog} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Karyawan *
                  </label>
                  <select
                    required
                    disabled={Boolean(editingLog)}
                    value={logEmpId}
                    onChange={(e) => handleSelectLogEmployee(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] disabled:opacity-60"
                  >
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Tanggal Kerja *
                  </label>
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0B0F17] border border-[#232C3D]">
                <button
                  type="button"
                  onClick={() => {
                    setLogPayType('borongan');
                    setLogUnit('pcs');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg ${
                    logPayType === 'borongan' ? 'bg-sky-500 text-slate-950' : 'text-[#94A3B8]'
                  }`}
                >
                  Borongan (Per Pekerjaan)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogPayType('harian');
                    setLogUnit('hari');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg ${
                    logPayType === 'harian' ? 'bg-sky-500 text-slate-950' : 'text-[#94A3B8]'
                  }`}
                >
                  Harian (Per Hari Kerja)
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  Nama / Detail Pekerjaan *
                </label>
                <input
                  type="text"
                  required
                  value={logJobDesc}
                  onChange={(e) => setLogJobDesc(e.target.value)}
                  placeholder="Contoh: Sablon Manual Kaos Komunitas 2 Warna / Operator Cetak"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Jumlah ({logPayType === 'harian' ? 'Hari' : 'Qty'}) *
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    step="any"
                    required
                    value={logQty}
                    onChange={(e) => setLogQty(Math.max(0.5, Number(e.target.value) || 0.5))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Satuan *</label>
                  <input
                    type="text"
                    required
                    value={logUnit}
                    onChange={(e) => setLogUnit(e.target.value)}
                    placeholder="pcs / hari / lusin"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Tarif (Rp) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={logRate}
                    onChange={(e) => setLogRate(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Bonus / Lembur (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={logBonus}
                    onChange={(e) => setLogBonus(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                    Potongan / Kasbon (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={logDeduction}
                    onChange={(e) => setLogDeduction(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono text-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  Catatan (opsional)
                </label>
                <input
                  type="text"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="Contoh: Lembur 2 jam / kasbon makan siang"
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-xs text-[#F8FAFC]"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#232C3D] flex items-center justify-between">
                <span className="text-xs text-[#94A3B8]">Total Upah Bersih Diterima</span>
                <span className="text-base font-mono font-bold tabular-nums text-emerald-400">
                  {formatRp(liveLogNet)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#232C3D] text-xs font-semibold text-[#94A3B8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
                >
                  {saving ? 'Menyimpan...' : editingLog ? 'Simpan Perubahan' : 'Simpan Catatan Kerja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Branded Pay Slip Modal */}
      {slipEmployee && (
        <PaySlipModal
          employee={slipEmployee}
          logs={slipLogs}
          transactions={transactions}
          initialMonth={activeSummaryMonth}
          shop={shopProfile}
          onMarkPaid={markPayrollPaidAndLogCash}
          onClose={() => setSlipEmployee(null)}
        />
      )}
    </div>
  );
};
