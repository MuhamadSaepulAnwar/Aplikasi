import React, { useRef, useState } from 'react';
import { X, Printer, Copy, Check, FileDown, Image as ImageIcon, Loader2, Shirt, Edit3 } from 'lucide-react';
import { Order, ShopProfile } from '../types';
import { formatDateID, formatRp } from '../lib/format';
import { exportElementToJpg, exportElementToPdf, printElementDocument } from '../lib/exportDocument';
import { ShopLogo } from '../components/ShopLogo';
import { ShirtPurchaseOrderSheet } from '../components/ShirtPurchaseOrderSheet';

interface InvoiceModalProps {
  order: Order;
  shop: ShopProfile;
  onClose: () => void;
  onEditOrder?: () => void;
}

function formatDateDMY(iso: string): string {
  if (!iso || iso.length < 10) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function formatInvPrice(val: number): string {
  const safe = Number.isFinite(val) ? Math.round(val) : 0;
  return `Rp ${safe.toLocaleString('en-US')}`;
}

function formatInvDecimal(val: number, withPrefix = true): string {
  const safe = Number.isFinite(val) ? val : 0;
  const formatted = safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withPrefix ? `Rp ${formatted}` : formatted;
}

function formatSimpleInvoiceNumber(inv: string): string {
  const raw = (inv || '').trim();
  if (!raw) return 'INV001';
  // Simplify verbose auto-generated formats like INV-2026-101 or INV-202611-00182 -> INV101 / INV001
  const match = raw.match(/^([A-Za-z]+)-20\d{2,4}-(\d+)$/);
  if (match) {
    const prefix = match[1].toUpperCase();
    const digits = match[2];
    const shortNum = digits.length > 3 ? digits.slice(0, 3) : digits.padStart(3, '0');
    return `${prefix}${shortNum}`;
  }
  return raw;
}

function parseBulletLines(raw: string): string[] {
  if (!raw) return [];
  const results: string[] = [];
  const rawLines = raw.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const bulletParts = rawLine.split('•');
    for (const part of bulletParts) {
      const trimmed = part.replace(/^[\s\-*•]+/, '').trim();
      if (!trimmed) continue;
      // Split multi-sentence single lines cleanly without breaking abbreviations like Jl., No., PT., A.n
      const sentences = trimmed.split(/(?<=[a-zA-Z0-9]{3}\.)\s+(?=[A-Z])/);
      for (const s of sentences) {
        const clean = s.replace(/^[\s\-*•]+/, '').trim();
        if (clean) results.push(clean);
      }
    }
  }
  return results;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, shop, onClose, onEditOrder }) => {
  const [printMode, setPrintMode] = useState<'a4' | 'thermal'>('a4');
  const [copied, setCopied] = useState(false);
  const [busyAction, setBusyAction] = useState<'print' | 'pdf' | 'jpg' | null>(null);
  const [exportError, setExportError] = useState('');
  const invoicePaperRef = useRef<HTMLDivElement | null>(null);
  const poPaperRef = useRef<HTMLDivElement | null>(null);

  const hasPage2 = Boolean(order.shirtSpec?.enabled);

  const invoiceAccent =
    !shop.accentColor || shop.accentColor.toUpperCase() === '#0EA5E9'
      ? '#0099FF'
      : shop.accentColor;

  const displayInvoiceNumber = formatSimpleInvoiceNumber(order.invoiceNumber);

  const paymentLabel =
    order.paymentStatus === 'lunas'
      ? 'LUNAS'
      : order.paymentStatus === 'dp'
        ? 'DP SEBAGIAN'
        : 'BELUM BAYAR';

  const grossSubtotal = order.items.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
  const totalQty = order.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

  // Build structured notes lines for the "Catatan :" section (vertically stacked bullets)
  const footerLines = parseBulletLines(shop.invoiceFooter || '');
  const orderNoteLines = parseBulletLines(order.notes || '');
  const bankLines = (shop.bankInfo || '')
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•]+/, '').trim())
    .filter(Boolean);

  const handleCopyWhatsApp = async () => {
    const itemLines = order.items
      .map(
        (it, idx) =>
          `${idx + 1}. ${it.name} (${it.qty} ${it.unit} x ${formatRp(it.price)}) = ${formatRp(it.subtotal)}`
      )
      .join('\n');

    const text = [
      `*INVOICE — ${shop.shopName}*`,
      shop.address ? shop.address : '',
      shop.phone ? `WA/Telp: ${shop.phone}` : '',
      '--------------------------------',
      `No. Invoice: ${displayInvoiceNumber}`,
      `Tanggal: ${formatDateDMY(order.orderDate)}`,
      `Kepada Yth: ${order.customerName}`,
      order.deadlineDate ? `Estimasi Selesai: ${formatDateDMY(order.deadlineDate)}` : '',
      '--------------------------------',
      itemLines,
      '--------------------------------',
      order.discount > 0 ? `Diskon: -${formatRp(order.discount)}` : '',
      `*Hasil Akhir: ${formatRp(order.totalAmount)}*`,
      `DP / Dibayar: ${formatRp(order.paidAmount)}`,
      order.remainingAmount > 0
        ? `*Kurang Bayar: ${formatRp(order.remainingAmount)}*`
        : `*Status: LUNAS*`,
      shop.bankInfo ? `\nPembayaran Transfer:\n${shop.bankInfo}` : '',
      shop.invoiceFooter ? `\nCatatan:\n${shop.invoiceFooter}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback ignored
    }
  };

  const getTargetPages = (): HTMLElement[] => {
    const pages: HTMLElement[] = [];
    if (invoicePaperRef.current) pages.push(invoicePaperRef.current);
    if (printMode === 'a4' && hasPage2 && poPaperRef.current) {
      pages.push(poPaperRef.current);
    }
    return pages;
  };

  const baseFileName = `${printMode === 'thermal' ? 'Struk' : 'Invoice'}-${displayInvoiceNumber}-${order.customerName}`;

  const handlePrint = async () => {
    const pages = getTargetPages();
    if (pages.length === 0 || busyAction) return;
    setExportError('');
    setBusyAction('print');
    try {
      await printElementDocument(
        pages,
        printMode,
        `${printMode === 'thermal' ? 'Struk' : 'Invoice'} ${displayInvoiceNumber} - ${shop.shopName}`
      );
    } catch {
      // Fallback to native browser print if iframe print is blocked
      window.print();
    } finally {
      setBusyAction(null);
    }
  };

  const handleSavePdf = async () => {
    const pages = getTargetPages();
    if (pages.length === 0 || busyAction) return;
    setExportError('');
    setBusyAction('pdf');
    try {
      await exportElementToPdf(pages, baseFileName, printMode);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Gagal membuat file PDF. Silakan coba lagi.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveJpg = async () => {
    const pages = getTargetPages();
    if (pages.length === 0 || busyAction) return;
    setExportError('');
    setBusyAction('jpg');
    try {
      await exportElementToJpg(pages, baseFileName);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Gagal menyimpan gambar JPG. Silakan coba lagi.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl my-auto space-y-3">
        {/* Toolbar (hidden on print) */}
        <div className="no-print bg-[#121824] border border-[#232C3D] rounded-xl px-4 py-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#0B0F17] border border-[#232C3D] rounded-lg">
              <button
                type="button"
                onClick={() => setPrintMode('a4')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  printMode === 'a4'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Invoice A4
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('thermal')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  printMode === 'thermal'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Struk Thermal 80mm
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onEditOrder && (
                <button
                  type="button"
                  onClick={onEditOrder}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-sky-500/35 bg-sky-500/15 hover:bg-sky-500/25 text-xs font-bold text-sky-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Ubah Nota &amp; Desain
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#232C3D] bg-[#0B0F17] hover:bg-[#182030] text-xs font-semibold text-[#F8FAFC] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin WA
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleSaveJpg()}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50 text-xs font-bold text-emerald-400 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                {busyAction === 'jpg' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5" />
                )}
                Simpan JPG
              </button>

              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleSavePdf()}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-amber-500/35 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-50 text-xs font-bold text-amber-400 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                {busyAction === 'pdf' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                Simpan PDF
              </button>

              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handlePrint()}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                {busyAction === 'print' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                {printMode === 'thermal' ? 'Cetak Thermal' : 'Cetak A4'}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup pratinjau invoice"
                className="min-h-[38px] min-w-[38px] rounded-lg border border-[#232C3D] hover:bg-[#182030] text-[#94A3B8] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {hasPage2 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#0B0F17] border border-[#232C3D] rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-[#CBD5E1]">
                <Shirt className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                {printMode === 'a4' ? (
                  <span>
                    Dokumen terdiri dari <strong className="text-white">2 Halaman</strong>: Halaman 1 Invoice Pelanggan &amp; Halaman 2 Purchase Order Mockup Kaos.
                  </span>
                ) : (
                  <span>
                    Mockup Desain Kaos &amp; PO Produksi tersedia otomatis di mode <strong className="text-white">Invoice A4</strong> (Halaman 2).
                  </span>
                )}
              </div>
              {printMode === 'a4' && (
                <button
                  type="button"
                  onClick={() => poPaperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="text-sky-400 hover:text-sky-300 font-semibold whitespace-nowrap cursor-pointer"
                >
                  Lihat Halaman 2
                </button>
              )}
            </div>
          )}

          {exportError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {exportError}
            </div>
          )}
        </div>

        {/* Printable White Paper Container */}
        <div
          ref={invoicePaperRef}
          className={`print-only-container bg-white text-black rounded-xl shadow-2xl mx-auto border border-slate-200 ${
            printMode === 'thermal'
              ? 'print-thermal-80mm max-w-[330px] p-5 text-xs'
              : 'w-full p-6 sm:p-10 text-sm'
          }`}
        >
          {printMode === 'a4' ? (
            <div className="space-y-5">
              {/* 1. Kop Usaha: Logo + Nama Usaha, Alamat, No WA, Email/Tagline */}
              <div className="flex items-start gap-4 sm:gap-5">
                {shop.logoDataUrl ? (
                  <div className="w-24 h-24 shrink-0 flex items-center justify-center">
                    <img
                      src={shop.logoDataUrl}
                      alt={`Logo ${shop.shopName}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <ShopLogo
                    logoDataUrl={shop.logoDataUrl}
                    shopName={shop.shopName}
                    accentColor={invoiceAccent}
                    size="xl"
                    lightSurface
                  />
                )}

                <div className="pt-0.5 space-y-0.5 min-w-0">
                  <h2 className="text-2xl sm:text-[26px] font-extrabold text-black tracking-tight leading-tight">
                    {shop.shopName}
                  </h2>
                  {shop.tagline && (
                    <p className="text-xs font-bold text-slate-900">{shop.tagline}</p>
                  )}
                  {shop.address && (
                    <p className="text-xs font-bold text-slate-900 leading-snug pt-0.5">
                      {shop.address}
                    </p>
                  )}
                  {shop.phone && (
                    <p className="text-xs font-bold text-slate-900">{shop.phone}</p>
                  )}
                </div>
              </div>

              {/* 2. Centered INVOICE Band */}
              <div
                className="border-t border-b py-1.5 text-center"
                style={{ borderColor: invoiceAccent }}
              >
                <div
                  className="text-xl sm:text-2xl font-extrabold tracking-wide uppercase"
                  style={{ color: invoiceAccent }}
                >
                  INVOICE
                </div>
              </div>

              {/* 3. Recipient Left & Invoice Number + Date Right */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pt-0.5">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900">Kepada Yth</div>
                  <div className="text-sm font-extrabold text-black">{order.customerName}</div>
                  {order.customerPhone && (
                    <div className="text-xs font-bold text-slate-900">{order.customerPhone}</div>
                  )}
                </div>

                <div className="sm:text-right space-y-1">
                  <div className="text-2xl sm:text-[26px] font-extrabold text-black tracking-tight leading-none tabular-nums">
                    {displayInvoiceNumber}
                  </div>
                  <div className="text-xs font-bold text-slate-900 tabular-nums">
                    {formatDateDMY(order.orderDate)}
                  </div>
                </div>
              </div>

              {/* 4. Bordered 5-Column Products Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-700 text-xs sm:text-[13px]">
                  <thead>
                    <tr className="text-white font-bold" style={{ backgroundColor: invoiceAccent }}>
                      <th className="w-16 py-2.5 px-3 text-center border border-slate-700">
                        Nomor
                      </th>
                      <th className="py-2.5 px-3 text-left border border-slate-700">Produk</th>
                      <th className="w-28 py-2.5 px-3 text-right border border-slate-700">
                        Kuantitas
                      </th>
                      <th className="w-32 py-2.5 px-3 text-right border border-slate-700">
                        Harga
                      </th>
                      <th className="w-36 py-2.5 px-3 text-right border border-slate-700">
                        Jumlah
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => {
                      const lines = (item.name || '').split('\n');
                      return (
                        <tr key={`${item.name}-${idx}`} className="bg-white">
                          <td className="py-3.5 px-3 text-center font-bold text-black border border-slate-700 align-middle">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-3 text-left border border-slate-700 align-top">
                            <div className="font-extrabold text-black leading-snug">
                              {lines[0]}
                            </div>
                            {lines.slice(1).map((subLine, sIdx) => (
                              <div
                                key={sIdx}
                                className="font-semibold text-slate-800 text-xs leading-snug mt-0.5"
                              >
                                {subLine}
                              </div>
                            ))}
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold text-black border border-slate-700 align-middle tabular-nums whitespace-nowrap">
                            <div>{item.qty}</div>
                            <div className="italic font-bold">{item.unit}</div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold text-black border border-slate-700 align-middle tabular-nums whitespace-nowrap">
                            {formatInvPrice(item.price)}
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold text-black border border-slate-700 align-middle tabular-nums whitespace-nowrap">
                            {formatInvDecimal(item.subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#D9D9D9] text-black font-extrabold">
                      <td className="py-2.5 px-3 border border-slate-700" />
                      <td className="py-2.5 px-3 text-left border border-slate-700">Total</td>
                      <td className="py-2.5 px-3 text-right border border-slate-700 tabular-nums">
                        {totalQty}
                      </td>
                      <td className="py-2.5 px-3 border border-slate-700" />
                      <td className="py-2.5 px-3 text-right border border-slate-700 tabular-nums whitespace-nowrap">
                        {formatInvDecimal(grossSubtotal, false)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 5. Bottom 2-Column Section: Left Catatan & Bank Info | Right Totals & Signature */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-1 items-start">
                {/* Left: Catatan */}
                <div className="sm:col-span-7 space-y-2.5">
                  <div
                    className="border-t border-b py-1.5 text-xs font-extrabold text-black"
                    style={{ borderColor: invoiceAccent }}
                  >
                    Catatan :
                  </div>
                  <div className="pl-1 space-y-1.5 text-[11px] font-bold text-slate-900 leading-relaxed">
                    {footerLines.map((line, idx) => (
                      <div key={`ft-${idx}`} className="flex items-start gap-2">
                        <span className="shrink-0">•</span>
                        <span className="flex-1">{line}</span>
                      </div>
                    ))}
                    {orderNoteLines.map((noteLine, nIdx) => (
                      <div key={`nt-${nIdx}`} className="flex items-start gap-2">
                        <span className="shrink-0">•</span>
                        <span className="flex-1">{noteLine}</span>
                      </div>
                    ))}
                    {bankLines.length > 0 && (
                      <>
                        <div className="flex items-start gap-2">
                          <span className="shrink-0">•</span>
                          <span className="flex-1">Pembayaran bisa di Transfer</span>
                        </div>
                        {bankLines.map((bLine, bIdx) => {
                          const isSubDetail = /^(a\.?n\.?\b|\d[\d\s-]+$)/i.test(bLine);
                          return (
                            <div key={`bk-${bIdx}`} className="flex items-start gap-2">
                              <span className={`shrink-0 ${isSubDetail ? 'opacity-0' : ''}`}>•</span>
                              <span className="flex-1">{bLine}</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Financial Summary & Signature */}
                <div className="sm:col-span-5 flex flex-col justify-between">
                  <div className="text-xs font-bold text-black">
                    <div
                      className="flex justify-between items-center py-1.5 px-1.5 border-t tabular-nums"
                      style={{ borderColor: invoiceAccent }}
                    >
                      <span>Subtotal</span>
                      <span>{formatInvDecimal(grossSubtotal)}</span>
                    </div>

                    {order.discount > 0 && (
                      <div className="flex justify-between items-center py-1 px-1.5 text-slate-700 tabular-nums">
                        <span>Diskon</span>
                        <span>-{formatInvDecimal(order.discount)}</span>
                      </div>
                    )}

                    <div
                      className="flex justify-between items-center py-1.5 px-2 text-white font-extrabold tabular-nums"
                      style={{ backgroundColor: invoiceAccent }}
                    >
                      <span>Hasil akhir</span>
                      <span>{formatInvDecimal(order.totalAmount)}</span>
                    </div>

                    <div
                      className="flex justify-between items-center py-1.5 px-1.5 border-b tabular-nums"
                      style={{ borderColor: invoiceAccent }}
                    >
                      <span>
                        {order.paymentStatus === 'lunas' ? 'Dibayar' : 'DP'}{' '}
                        {formatDateDMY(order.orderDate)}
                      </span>
                      <span>{formatInvDecimal(order.paidAmount)}</span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 px-1.5 tabular-nums">
                      <span>Kurang Bayar</span>
                      <span>{formatInvDecimal(order.remainingAmount)}</span>
                    </div>
                  </div>

                  {/* Signature Block */}
                  <div className="mt-14 flex justify-end pr-2">
                    <div className="text-center min-w-[150px]">
                      <div className="h-16" />
                      <div className="text-xs font-bold text-slate-900">
                        {shop.ownerName || shop.shopName}
                      </div>
                      <div className="text-xs font-extrabold text-black mt-0.5">Tanda tangan</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Thermal 80mm Receipt Layout */
            <div className="space-y-3 font-mono text-[11px] leading-snug text-slate-900">
              <div className="text-center space-y-1 pb-2 border-b border-dashed border-slate-400">
                <div className="flex justify-center mb-1.5">
                  <ShopLogo
                    logoDataUrl={shop.logoDataUrl}
                    shopName={shop.shopName}
                    accentColor={invoiceAccent}
                    size="sm"
                    lightSurface
                  />
                </div>
                <div className="font-bold text-sm uppercase">{shop.shopName}</div>
                {shop.address && <div className="text-[10px] text-slate-600">{shop.address}</div>}
                {shop.phone && <div className="text-[10px] text-slate-700">WA: {shop.phone}</div>}
              </div>

              <div className="space-y-0.5 pb-2 border-b border-dashed border-slate-400">
                <div className="flex justify-between">
                  <span>Invoice:</span>
                  <span className="font-bold">{displayInvoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tgl:</span>
                  <span>{formatDateID(order.orderDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Plg:</span>
                  <span className="truncate max-w-[160px]">{order.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-bold">{paymentLabel}</span>
                </div>
              </div>

              <div className="space-y-2 pb-2 border-b border-dashed border-slate-400">
                {order.items.map((item, idx) => (
                  <div key={`${item.name}-${idx}`}>
                    <div className="font-semibold">{item.name}</div>
                    <div className="flex justify-between tabular-nums">
                      <span>
                        {item.qty} {item.unit} x {formatRp(item.price)}
                      </span>
                      <span>{formatRp(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pb-2 border-b border-dashed border-slate-400 tabular-nums">
                {order.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Diskon</span>
                    <span>-{formatRp(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xs">
                  <span>HASIL AKHIR</span>
                  <span>{formatRp(order.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>DP / Dibayar</span>
                  <span>{formatRp(order.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>KURANG BAYAR</span>
                  <span>{formatRp(order.remainingAmount)}</span>
                </div>
              </div>

              {shop.bankInfo && (
                <div className="text-center text-[10px] text-slate-700 whitespace-pre-line">
                  {shop.bankInfo}
                </div>
              )}
              <div className="text-center text-[10px] text-slate-500 pt-1 whitespace-pre-line">
                {shop.invoiceFooter || 'Terima kasih!'}
              </div>
            </div>
          )}
        </div>

        {/* Page 2: Purchase Order / Mockup Desain Kaos (A4 Mode only) */}
        {printMode === 'a4' && hasPage2 && order.shirtSpec && (
          <>
            <div className="no-print flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-[#232C3D]" />
              <span className="text-[11px] font-semibold text-[#94A3B8] whitespace-nowrap">
                Halaman 2 · Purchase Order &amp; Mockup Desain Kaos
              </span>
              <div className="flex-1 h-px bg-[#232C3D]" />
            </div>

            <div
              ref={poPaperRef}
              className="print-only-container bg-white text-black rounded-xl shadow-2xl mx-auto border border-slate-200 w-full p-6 sm:p-8 text-sm"
            >
              <ShirtPurchaseOrderSheet
                order={order}
                shop={shop}
                spec={order.shirtSpec}
                displayInvoiceNumber={displayInvoiceNumber}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
