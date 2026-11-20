import React, { useState } from 'react';
import {
  Printer,
  ArrowRight,
  Layers,
  Calculator,
  FileSpreadsheet,
  Users,
  Smartphone,
  Building2,
} from 'lucide-react';
import { loginWithGoogle } from '../lib/firebase';

export const AuthScreen: React.FC = () => {
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    setErrorMsg('');
    setSigningIn(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setErrorMsg('Gagal masuk. Pastikan popup browser tidak diblokir lalu coba lagi.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const capabilities = [
    {
      icon: FileSpreadsheet,
      title: 'Omset 1 Bln – 5 Thn & Profit Bersih',
      desc: 'Pantau akumulasi omset lintas periode dan profit bersih per bulan setelah bahan baku, gaji, dan biaya lain-lain.',
    },
    {
      icon: Calculator,
      title: 'Kalkulator HPP Custom & Katalog',
      desc: 'Hitung modal kaos polos, sablon/DTF, upah pekerja, dan listrik — lalu isi otomatis saat mencatat order baru.',
    },
    {
      icon: Users,
      title: 'Gaji Harian/Borongan & Slip Gaji',
      desc: 'Catat pekerjaan karyawan yang mudah diedit dan cetak slip gaji lengkap dengan logo & alamat usaha.',
    },
    {
      icon: Building2,
      title: 'White-Label & Sinkron PC + HP',
      desc: 'Ubah nama toko, logo, alamat, dan rekening sendiri. Data tersimpan online dan sinkron real-time di semua perangkat.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F8FAFC] flex flex-col">
      <header className="w-full border-b border-[#232C3D]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-8 h-8 rounded-lg bg-sky-500 text-slate-950 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-[#F8FAFC]">CetakKas</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-[#94A3B8]">
            <span>Keuangan Percetakan & Sablon</span>
            <span aria-hidden="true">·</span>
            <span>Akses Online PC & HP</span>
            <span aria-hidden="true">·</span>
            <span>Kustomisasi White-Label</span>
          </div>
          <button
            type="button"
            onClick={handleLogin}
            disabled={signingIn}
            className="px-4 py-2 min-h-[40px] rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            {signingIn ? 'Menghubungkan...' : 'Masuk Google'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto w-full px-6 py-12 lg:py-16 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <p className="text-xs font-medium text-sky-400 tracking-wide">
              Sistem Keuangan Bengkel Cetak & Sablon
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold leading-[1.15] tracking-tight text-[#F8FAFC] [text-wrap:balance]">
              Catat omset, HPP custom, stok, dan gaji karyawan dalam satu ruang kerja.
            </h1>
            <p className="text-base text-[#94A3B8] leading-relaxed max-w-xl">
              Dirancang khusus untuk usaha percetakan digital dan sablon manual/DTF. Sinkron
              otomatis di PC kasir dan HP pemilik, dengan kustomisasi penuh nama toko, logo, dan
              alamat untuk dipakai sendiri maupun dijual kembali.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-4">
              <button
                type="button"
                onClick={handleLogin}
                disabled={signingIn}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.18v2.98h5.27c-.23 1.49-1.72 4.38-5.27 4.38-3.17 0-5.76-2.62-5.76-5.86s2.59-5.86 5.76-5.86c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.78 4.21 14.68 3.3 12.17 3.3 7.06 3.3 2.92 7.45 2.92 12.6s4.14 9.3 9.25 9.3c5.34 0 8.88-3.75 8.88-9.03 0-.61-.07-1.08-.15-1.77z"
                  />
                </svg>
                {signingIn ? 'Membuka Akun Google...' : 'Masuk dengan Akun Google'}
                <ArrowRight className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                <Smartphone className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Data terisolasi aman per akun pemilik usaha</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-sm">
                {errorMsg}
              </div>
            )}

            <div className="pt-4 border-t border-[#232C3D] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#94A3B8]">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                Divisi Percetakan & Sablon
              </span>
              <span aria-hidden="true">·</span>
              <span>Nota A4 & Thermal 80mm</span>
              <span aria-hidden="true">·</span>
              <span>Slip Gaji Berlogo Toko</span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="bg-[#121824] border border-[#232C3D] rounded-2xl divide-y divide-[#232C3D]">
              {capabilities.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="p-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#0B0F17] border border-[#232C3D] flex items-center justify-center text-sky-400 shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold text-[#F8FAFC]">{item.title}</h2>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
