import React, { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Save, LogOut, Database } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { compressLogoImage } from '../lib/format';
import { logoutUser } from '../lib/firebase';
import { seedSampleBusinessData } from '../lib/seed';
import { ShopLogo } from '../components/ShopLogo';

const ACCENT_PRESETS = [
  { name: 'Cyan Cetak', hex: '#0EA5E9' },
  { name: 'Zamrud', hex: '#10B981' },
  { name: 'Amber Tinta', hex: '#F59E0B' },
  { name: 'Indigo Studio', hex: '#6366F1' },
  { name: 'Magenta CMYK', hex: '#EC4899' },
  { name: 'Oranye Sablon', hex: '#F97316' },
];

export const SettingsView: React.FC = () => {
  const { user, shopProfile, orders, transactions, saveShopProfile, notify } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [shopName, setShopName] = useState(shopProfile.shopName);
  const [tagline, setTagline] = useState(shopProfile.tagline);
  const [address, setAddress] = useState(shopProfile.address);
  const [phone, setPhone] = useState(shopProfile.phone);
  const [ownerName, setOwnerName] = useState(shopProfile.ownerName);
  const [bankInfo, setBankInfo] = useState(shopProfile.bankInfo);
  const [invoiceFooter, setInvoiceFooter] = useState(shopProfile.invoiceFooter);
  const [logoDataUrl, setLogoDataUrl] = useState(shopProfile.logoDataUrl);
  const [accentColor, setAccentColor] = useState(shopProfile.accentColor);
  const [invoicePrefix, setInvoicePrefix] = useState(shopProfile.invoicePrefix);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    setShopName(shopProfile.shopName);
    setTagline(shopProfile.tagline);
    setAddress(shopProfile.address);
    setPhone(shopProfile.phone);
    setOwnerName(shopProfile.ownerName);
    setBankInfo(shopProfile.bankInfo);
    setInvoiceFooter(shopProfile.invoiceFooter);
    setLogoDataUrl(shopProfile.logoDataUrl);
    setAccentColor(shopProfile.accentColor);
    setInvoicePrefix(shopProfile.invoicePrefix);
  }, [shopProfile]);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressLogoImage(file, 220);
      setLogoDataUrl(compressed);
      notify('Logo siap digunakan. Klik Simpan Identitas Toko untuk menerapkan.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memproses logo.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) return;
    setSaving(true);
    try {
      await saveShopProfile({
        shopName,
        tagline,
        address,
        phone,
        ownerName,
        bankInfo,
        invoiceFooter,
        logoDataUrl,
        accentColor,
        invoicePrefix,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDemo = async () => {
    if (!user || seeding) return;
    setSeeding(true);
    try {
      await seedSampleBusinessData(user.uid);
      notify('Data contoh percetakan & sablon berhasil ditambahkan.');
    } catch {
      notify('Gagal memuat data contoh.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F8FAFC]">Pengaturan Toko & White-Label</h2>
        <p className="text-xs text-[#94A3B8] mt-0.5">
          Kustomisasi penuh nama toko, logo, alamat, rekening, dan catatan nota — langsung tampil di seluruh aplikasi, Invoice Pelanggan, dan Slip Gaji Karyawan.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: White-Label Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-[#121824] border border-[#232C3D] rounded-xl p-5 space-y-5"
        >
          {/* Logo Upload Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-5 border-b border-[#232C3D]">
            <ShopLogo
              logoDataUrl={logoDataUrl}
              shopName={shopName || 'Toko'}
              accentColor={accentColor}
              size="lg"
            />
            <div className="flex-1 space-y-2">
              <div className="text-sm font-semibold text-[#F8FAFC]">Logo Usaha</div>
              <p className="text-xs text-[#94A3B8]">
                Format PNG/JPG/WebP. Gambar otomatis diperkecil agar ringan di cloud dan tajam saat dicetak pada Nota & Slip Gaji.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleUploadLogo}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-[#182030] border border-[#232C3D] text-xs font-semibold text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  Unggah Logo
                </button>
                {logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoDataUrl('')}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Logo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Nama Toko / Usaha *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Contoh: Bintang Sablon & Printing"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Tagline / Jenis Usaha (Tampil di bawah Nama Usaha)
              </label>
              <input
                type="text"
                maxLength={140}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Contoh: Percetakan Digital & Sablon"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
              Alamat Lengkap Toko / Workshop
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jl. Merdeka No. 45, Kota Bandung"
              className="w-full px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                No. WhatsApp / Telp
              </label>
              <input
                type="text"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812-3456-7890"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Nama Pemilik / TTD
              </label>
              <input
                type="text"
                maxLength={100}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Nama di tanda tangan nota/slip"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Prefix Nomor Nota
              </label>
              <input
                type="text"
                maxLength={16}
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="INV"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm font-mono uppercase text-[#F8FAFC]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
              Info Rekening Bank / Pembayaran (Tampil di Nota)
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={bankInfo}
              onChange={(e) => setBankInfo(e.target.value)}
              placeholder="BCA 1234567890 a.n. Nama Toko&#10;BRI 0987654321 a.n. Nama Pemilik"
              className="w-full px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
              Catatan Invoice / Syarat & Ketentuan (1 baris = 1 poin bullet)
            </label>
            <textarea
              rows={4}
              maxLength={300}
              value={invoiceFooter}
              onChange={(e) => setInvoiceFooter(e.target.value)}
              placeholder={"Pesanan akan diproses setelah DP masuk min 50%\nDesain sudah disepakati di awal tidak bisa berubah\nPembayaran CBD (Cash Before Delivery)"}
              className="w-full px-3.5 py-2 rounded-lg bg-[#0B0F17] border border-[#232C3D] text-sm text-[#F8FAFC] focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Accent Color Picker */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#94A3B8]">
              Warna Aksen Merek Toko
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => setAccentColor(preset.hex)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer ${
                    accentColor.toLowerCase() === preset.hex.toLowerCase()
                      ? 'border-white bg-[#182030] text-white'
                      : 'border-[#232C3D] bg-[#0B0F17] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: preset.hex }}
                  />
                  {preset.name}
                </button>
              ))}
              <label className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#232C3D] bg-[#0B0F17] text-xs text-[#94A3B8] cursor-pointer">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                />
                <span>Custom</span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Menyimpan...' : 'Simpan Identitas Toko'}
            </button>
          </div>
        </form>

        {/* Right: Live Branded Kop Preview + Account Actions */}
        <div className="lg:col-span-5 space-y-5">
          {/* Live White-Paper Header Preview */}
          <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-5 space-y-3">
            <div className="text-xs font-semibold text-sky-400">
              Pratinjau Kop Nota & Slip Gaji (Hasil Cetak)
            </div>
            <div className="bg-white text-black rounded-lg p-5 border border-slate-200 space-y-3">
              <div className="flex items-start gap-3">
                <ShopLogo
                  logoDataUrl={logoDataUrl}
                  shopName={shopName || 'Nama Toko'}
                  accentColor={accentColor}
                  size="lg"
                  lightSurface
                />
                <div className="min-w-0 space-y-0.5">
                  <div className="text-base font-extrabold text-black truncate">
                    {shopName || 'Nama Toko Anda'}
                  </div>
                  {tagline && (
                    <div className="text-[11px] font-semibold text-slate-800">{tagline}</div>
                  )}
                  {address && (
                    <div className="text-[11px] font-semibold text-slate-800 leading-snug">
                      {address}
                    </div>
                  )}
                  {phone && (
                    <div className="text-[11px] font-semibold text-slate-800">{phone}</div>
                  )}
                </div>
              </div>
              <div
                className="border-t border-b py-1 text-center text-sm font-extrabold tracking-wide"
                style={{
                  borderColor: accentColor === '#0EA5E9' ? '#0099FF' : accentColor,
                  color: accentColor === '#0EA5E9' ? '#0099FF' : accentColor,
                }}
              >
                INVOICE
              </div>
              {bankInfo && (
                <div className="text-[11px] text-slate-700 whitespace-pre-line">{bankInfo}</div>
              )}
              <div className="text-[10px] text-slate-600 whitespace-pre-line pt-1 border-t border-slate-200">
                {invoiceFooter || 'Catatan syarat & ketentuan invoice akan tampil di sini.'}
              </div>
            </div>
          </div>

          {/* Account & Demo Data Utilities */}
          <div className="bg-[#121824] border border-[#232C3D] rounded-xl p-5 space-y-4">
            <div>
              <div className="text-xs font-semibold text-[#94A3B8]">Akun Cloud Terhubung</div>
              <div className="text-sm font-bold text-[#F8FAFC] mt-1">
                {user?.displayName || 'Pemilik Usaha'}
              </div>
              <div className="text-xs text-[#94A3B8]">{user?.email}</div>
              <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                Seluruh data toko terisolasi di akun ini dan otomatis sinkron saat dibuka di PC
                kasir maupun HP. Pembeli lain cukup login dengan akun Google mereka untuk memiliki
                ruang kerja & identitas toko sendiri.
              </p>
            </div>

            {orders.length === 0 && transactions.length === 0 && (
              <button
                type="button"
                onClick={handleSeedDemo}
                disabled={seeding}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-[#232C3D] bg-[#0B0F17] hover:bg-[#182030] text-xs font-semibold text-[#F8FAFC] inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Database className="w-4 h-4 text-sky-400" />
                {seeding ? 'Memuat Data Contoh...' : 'Muat Data Contoh Percetakan & Sablon'}
              </button>
            )}

            <button
              type="button"
              onClick={() => void logoutUser()}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Keluar dari Akun Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
