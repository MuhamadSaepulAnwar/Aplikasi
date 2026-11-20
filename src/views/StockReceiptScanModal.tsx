import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  Image as ImageIcon,
  Receipt,
  ShoppingBag,
  AlertCircle,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { formatRp, todayISO } from '../lib/format';
import { Division, Material, MaterialCategory, PaymentMethod } from '../types';

interface StockReceiptScanModalProps {
  onClose: () => void;
}

interface ScannedRow {
  rowId: string;
  selected: boolean;
  matchedMaterialId: string;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  division: Division;
  category: MaterialCategory;
  minStock: number;
  notes: string;
}

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  tinta: 'Tinta & Cat',
  kaos_kain: 'Kaos & Kain Polos',
  kertas_media: 'Kertas, Banner & Stiker',
  kimia_sablon: 'Film DTF & Kimia Sablon',
  finishing: 'Finishing & Kemasan',
  lainnya: 'Lainnya',
};

/**
 * Resizes receipt photos / long online shopping screenshots client-side so upload is fast
 * while keeping small invoice text razor-sharp for OCR.
 */
function prepareReceiptImage(file: Blob): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.'));
      img.onload = () => {
        const maxDim = 1800;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas browser tidak tersedia.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        resolve({ base64, mimeType: 'image/jpeg', previewUrl: dataUrl });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function findFuzzyMaterialMatch(itemName: string, materials: Material[]): string {
  const clean = itemName.toLowerCase().trim();
  if (!clean) return '';
  const exact = materials.find((m) => m.name.toLowerCase().trim() === clean);
  if (exact) return exact.id;
  const contained = materials.find((m) => {
    const mName = m.name.toLowerCase().trim();
    return mName.length >= 5 && (clean.includes(mName) || mName.includes(clean));
  });
  return contained ? contained.id : '';
}

export const StockReceiptScanModal: React.FC<StockReceiptScanModalProps> = ({ onClose }) => {
  const { materials, importMaterialsFromReceipt } = useWorkspace();

  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<'upload' | 'camera' | 'scanning' | 'review'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [dragging, setDragging] = useState(false);

  // Extracted metadata & items
  const [sourceType, setSourceType] = useState<'nota_supplier' | 'pembelian_online'>('nota_supplier');
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [invoiceRef, setInvoiceRef] = useState('');
  const [rows, setRows] = useState<ScannedRow[]>([]);
  const [logExpense, setLogExpense] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const [saving, setSaving] = useState(false);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCameraStream();
  }, [stopCameraStream]);

  const scanImageBlob = useCallback(
    async (blob: Blob) => {
      setErrorMsg('');
      setStep('scanning');
      try {
        const prepared = await prepareReceiptImage(blob);
        setPreviewUrl(prepared.previewUrl);

        const existingHints = materials.map((m) => ({
          id: m.id,
          name: m.name,
          unit: m.unit,
          division: m.division,
          category: m.category,
        }));

        const res = await fetch('/api/scan-stock-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: prepared.base64,
            mimeType: prepared.mimeType,
            existingMaterials: existingHints,
          }),
        });

        const payload = (await res.json()) as {
          error?: string;
          sourceType?: 'nota_supplier' | 'pembelian_online';
          supplier?: string;
          purchaseDate?: string;
          invoiceRef?: string;
          items?: Array<{
            name: string;
            qty: number;
            unit: string;
            unitPrice: number;
            division: Division;
            category: MaterialCategory;
            matchedMaterialId: string;
            notes: string;
          }>;
        };

        if (!res.ok) {
          throw new Error(payload.error || 'Gagal membaca nota/screenshot.');
        }

        const extracted = payload.items || [];
        setSourceType(
          payload.sourceType === 'pembelian_online' ? 'pembelian_online' : 'nota_supplier'
        );
        setSupplier(payload.supplier || '');
        setPurchaseDate(payload.purchaseDate || todayISO());
        setInvoiceRef(payload.invoiceRef || '');

        if (extracted.length === 0) {
          setErrorMsg(
            'Tidak ada item bahan yang terbaca otomatis. Anda tetap bisa menambahkan item secara manual di bawah atau foto ulang lebih dekat.'
          );
        }

        const mappedRows: ScannedRow[] = extracted.map((it, idx) => {
          const matchedId =
            it.matchedMaterialId || findFuzzyMaterialMatch(it.name, materials);
          return {
            rowId: `scan-${Date.now()}-${idx}`,
            selected: true,
            matchedMaterialId: matchedId,
            name: it.name,
            qty: Number(it.qty) || 1,
            unit: it.unit || 'pcs',
            unitPrice: Math.max(0, Math.round(Number(it.unitPrice) || 0)),
            division: it.division === 'percetakan' ? 'percetakan' : 'sablon',
            category: it.category || 'lainnya',
            minStock: 5,
            notes: it.notes || '',
          };
        });

        setRows(mappedRows);
        setStep('review');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan saat membaca gambar.');
        setStep('upload');
      }
    },
    [materials]
  );

  // Support Ctrl+V clipboard screenshot paste directly inside the modal
  useEffect(() => {
    if (step !== 'upload') return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void scanImageBlob(file);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [step, scanImageBlob]);

  const startLiveCamera = async () => {
    setErrorMsg('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback to native file camera input
      mobileCameraRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setStep('camera');
      // Attach stream after video mounts
      window.setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          void videoRef.current.play();
        }
      }, 60);
    } catch {
      // If user denies or webcam not present, smoothly fallback to native camera/gallery file picker
      mobileCameraRef.current?.click();
    }
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCameraStream();
    canvas.toBlob(
      (blob) => {
        if (blob) {
          void scanImageBlob(blob);
        } else {
          setStep('upload');
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      void scanImageBlob(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void scanImageBlob(file);
    }
  };

  const updateRow = <K extends keyof ScannedRow>(rowId: string, key: K, val: ScannedRow[K]) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const next = { ...r, [key]: val };
        // If user picks an existing material, sync unit/division/category for consistency
        if (key === 'matchedMaterialId' && typeof val === 'string' && val) {
          const found = materials.find((m) => m.id === val);
          if (found) {
            next.unit = found.unit;
            next.division = found.division;
            next.category = found.category;
          }
        }
        return next;
      })
    );
  };

  const addBlankRow = () => {
    setRows((prev) => [
      ...prev,
      {
        rowId: `manual-${Date.now()}`,
        selected: true,
        matchedMaterialId: '',
        name: '',
        qty: 1,
        unit: 'pcs',
        unitPrice: 0,
        division: 'sablon',
        category: 'kaos_kain',
        minStock: 5,
        notes: '',
      },
    ]);
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => r.selected && r.name.trim().length > 0 && r.qty > 0),
    [rows]
  );

  const totalCost = useMemo(
    () => selectedRows.reduce((s, r) => s + Math.round(r.qty * r.unitPrice), 0),
    [selectedRows]
  );

  const handleConfirmImport = async () => {
    if (selectedRows.length === 0 || saving) return;
    setSaving(true);
    try {
      await importMaterialsFromReceipt({
        supplier,
        date: purchaseDate,
        invoiceRef,
        sourceLabel:
          sourceType === 'pembelian_online' ? 'Screenshot Pembelian Online' : 'Nota Supplier',
        paymentMethod,
        logExpense,
        items: selectedRows.map((r) => ({
          matchedMaterialId: r.matchedMaterialId,
          name: r.name,
          category: r.category,
          division: r.division,
          qty: r.qty,
          unit: r.unit,
          unitPrice: r.unitPrice,
          minStock: r.minStock,
          notes: r.notes,
        })),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#121824] border border-[#232C3D] rounded-2xl w-full max-w-4xl my-auto overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#232C3D]">
          <div>
            <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
              <Camera className="w-4 h-4 text-sky-400" />
              Scan Nota Supplier & Screenshot Pembelian Online
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Foto nota kertas pakai kamera atau unggah screenshot pesanan Shopee / Tokopedia / TikTok Shop untuk otomatis masuk stok bahan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            aria-label="Tutup modal scan nota"
            className="p-2 rounded-lg hover:bg-[#182030] text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden native file inputs */}
        <input
          ref={mobileCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
        />
        <input
          ref={fileUploadRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelected}
          className="hidden"
        />

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD / CHOOSE CAMERA OR SCREENSHOT */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Camera option */}
                <button
                  type="button"
                  onClick={() => void startLiveCamera()}
                  className="group p-5 rounded-xl bg-[#0B0F17] hover:bg-[#161F2E] border border-[#232C3D] hover:border-sky-500/50 text-left transition-all cursor-pointer space-y-2.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#F8FAFC]">
                      Foto Nota Invoice Supplier (Kamera)
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                      Langsung buka kamera HP atau webcam PC untuk memotret nota kertas / faktur pembelian bahan dari supplier.
                    </p>
                  </div>
                </button>

                {/* Online Screenshot / Gallery option */}
                <button
                  type="button"
                  onClick={() => fileUploadRef.current?.click()}
                  className="group p-5 rounded-xl bg-[#0B0F17] hover:bg-[#161F2E] border border-[#232C3D] hover:border-emerald-500/50 text-left transition-all cursor-pointer space-y-2.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#F8FAFC]">
                      Upload Screenshot Belanja Online / Galeri
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                      Pilih screenshot rincian pesanan Shopee, Tokopedia, TikTok Shop, Lazada, atau foto nota dari galeri.
                    </p>
                  </div>
                </button>
              </div>

              {/* Drag & Drop + Paste Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileUploadRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                  dragging
                    ? 'border-sky-400 bg-sky-500/10'
                    : 'border-[#232C3D] bg-[#0B0F17]/60 hover:border-[#384763]'
                }`}
              >
                <ImageIcon className="w-6 h-6 text-[#64748B] mx-auto mb-2" />
                <div className="text-xs font-semibold text-[#F8FAFC]">
                  Tarik & lepas gambar ke sini, atau tekan <span className="font-mono text-sky-400">Ctrl + V</span> untuk tempel screenshot langsung
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Mendukung JPG, PNG, WebP. Nama bahan, jumlah, satuan, harga beli, dan nama toko akan dibaca otomatis.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: LIVE CAMERA VIEWFINDER */}
          {step === 'camera' && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black border border-[#232C3D] aspect-[4/3] max-h-[60vh] mx-auto flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                <div className="pointer-events-none absolute inset-4 border border-sky-400/50 rounded-lg" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setStep('upload');
                  }}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#232C3D] text-xs font-semibold text-[#94A3B8] hover:text-white cursor-pointer"
                >
                  Kembali
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraStream();
                      mobileCameraRef.current?.click();
                    }}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#232C3D] bg-[#0B0F17] text-xs font-semibold text-[#F8FAFC] cursor-pointer"
                  >
                    Gunakan Kamera Bawaan HP
                  </button>
                  <button
                    type="button"
                    onClick={captureFromCamera}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    Ambil Foto Nota
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SCANNING / PROCESSING */}
          {step === 'scanning' && (
            <div className="py-10 text-center space-y-4">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Pratinjau nota"
                  className="w-40 h-48 object-cover rounded-xl border border-[#232C3D] mx-auto opacity-75"
                />
              )}
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-sky-500/30 text-sky-400 text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                Membaca daftar item, jumlah, satuan & harga dari gambar...
              </div>
              <p className="text-xs text-[#94A3B8]">
                Otomatis mencocokkan dengan daftar stok bahan Anda dan mengabaikan ongkir/biaya admin.
              </p>
            </div>
          )}

          {/* STEP 4: REVIEW & CONFIRM IMPORT */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Top summary: Thumbnail + Extracted Invoice Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-[#0B0F17] border border-[#232C3D] rounded-xl p-4">
                {previewUrl && (
                  <div className="md:col-span-3 space-y-2">
                    <img
                      src={previewUrl}
                      alt="Bukti pembelian"
                      className="w-full h-36 object-contain bg-black/40 rounded-lg border border-[#232C3D]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setStep('upload');
                      }}
                      className="w-full min-h-[34px] px-2.5 py-1 rounded-lg border border-[#232C3D] hover:bg-[#182030] text-[11px] font-semibold text-[#94A3B8] hover:text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Ganti / Scan Ulang
                    </button>
                  </div>
                )}

                <div className={`${previewUrl ? 'md:col-span-9' : 'md:col-span-12'} space-y-3`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                      {sourceType === 'pembelian_online' ? (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          Terdeteksi: Screenshot Pembelian Online
                        </>
                      ) : (
                        <>
                          <Receipt className="w-3.5 h-3.5" />
                          Terdeteksi: Nota / Invoice Supplier
                        </>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                        Supplier / Nama Toko Online
                      </label>
                      <input
                        type="text"
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        placeholder="Nama supplier / toko"
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                        Tanggal Pembelian
                      </label>
                      <input
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#94A3B8] mb-1">
                        No. Nota / Pesanan
                      </label>
                      <input
                        type="text"
                        value={invoiceRef}
                        onChange={(e) => setInvoiceRef(e.target.value)}
                        placeholder="Opsional"
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#121824] border border-[#232C3D] text-xs font-mono text-[#F8FAFC]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Extracted Items List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#F8FAFC]">
                    Daftar Bahan Terbaca ({selectedRows.length} dari {rows.length} dipilih)
                  </div>
                  <button
                    type="button"
                    onClick={addBlankRow}
                    className="min-h-[34px] px-3 py-1 rounded-lg bg-[#0B0F17] hover:bg-[#182030] border border-[#232C3D] text-xs font-semibold text-sky-400 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Baris
                  </button>
                </div>

                {rows.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#0B0F17] border border-[#232C3D] text-center text-xs text-[#94A3B8]">
                    Belum ada baris item. Klik &ldquo;Tambah Baris&rdquo; atau &ldquo;Ganti / Scan Ulang&rdquo;.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[38vh] overflow-y-auto pr-1">
                    {rows.map((row) => (
                      <div
                        key={row.rowId}
                        className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                          row.selected
                            ? 'bg-[#0B0F17] border-[#232C3D]'
                            : 'bg-[#0B0F17]/40 border-[#1A2233] opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => updateRow(row.rowId, 'selected', e.target.checked)}
                            className="w-4 h-4 mt-2 accent-sky-500 cursor-pointer shrink-0"
                          />
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            {/* Name */}
                            <div className="sm:col-span-5">
                              <label className="block text-[10px] text-[#94A3B8] mb-1">
                                Nama Bahan Baku *
                              </label>
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => updateRow(row.rowId, 'name', e.target.value)}
                                placeholder="Nama bahan"
                                className="w-full min-h-[36px] px-2.5 py-1 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                              />
                            </div>

                            {/* Target stock action */}
                            <div className="sm:col-span-4">
                              <label className="block text-[10px] text-[#94A3B8] mb-1">
                                Tujuan Masuk Stok
                              </label>
                              <select
                                value={row.matchedMaterialId}
                                onChange={(e) =>
                                  updateRow(row.rowId, 'matchedMaterialId', e.target.value)
                                }
                                className="w-full min-h-[36px] px-2.5 py-1 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                              >
                                <option value="">+ Buat Bahan Baku Baru</option>
                                {materials.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    Tambah ke: {m.name} (stok {m.stock} {m.unit})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Qty + Unit */}
                            <div className="sm:col-span-3 grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="block text-[10px] text-[#94A3B8] mb-1">Qty</label>
                                <input
                                  type="number"
                                  min={0.1}
                                  step="any"
                                  value={row.qty}
                                  onChange={(e) =>
                                    updateRow(
                                      row.rowId,
                                      'qty',
                                      Math.max(0, Number(e.target.value) || 0)
                                    )
                                  }
                                  className="w-full min-h-[36px] px-2 py-1 rounded-lg bg-[#121824] border border-[#232C3D] text-xs font-mono text-[#F8FAFC]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-[#94A3B8] mb-1">Satuan</label>
                                <input
                                  type="text"
                                  value={row.unit}
                                  onChange={(e) => updateRow(row.rowId, 'unit', e.target.value)}
                                  className="w-full min-h-[36px] px-2 py-1 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                                />
                              </div>
                            </div>

                            {/* Unit price */}
                            <div className="sm:col-span-4">
                              <label className="block text-[10px] text-[#94A3B8] mb-1">
                                Harga Beli / {row.unit || 'satuan'} (Rp)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={row.unitPrice}
                                onChange={(e) =>
                                  updateRow(
                                    row.rowId,
                                    'unitPrice',
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-full min-h-[36px] px-2.5 py-1 rounded-lg bg-[#121824] border border-[#232C3D] text-xs font-mono text-[#F8FAFC]"
                              />
                            </div>

                            {/* Division */}
                            <div className="sm:col-span-3">
                              <label className="block text-[10px] text-[#94A3B8] mb-1">Divisi</label>
                              <select
                                value={row.division}
                                onChange={(e) =>
                                  updateRow(row.rowId, 'division', e.target.value as Division)
                                }
                                className="w-full min-h-[36px] px-2 py-1 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                              >
                                <option value="sablon">Sablon</option>
                                <option value="percetakan">Percetakan</option>
                              </select>
                            </div>

                            {/* Category */}
                            <div className="sm:col-span-3">
                              <label className="block text-[10px] text-[#94A3B8] mb-1">Kategori</label>
                              <select
                                value={row.category}
                                onChange={(e) =>
                                  updateRow(
                                    row.rowId,
                                    'category',
                                    e.target.value as MaterialCategory
                                  )
                                }
                                className="w-full min-h-[36px] px-2 py-1 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                              >
                                {(Object.keys(CATEGORY_LABELS) as MaterialCategory[]).map((k) => (
                                  <option key={k} value={k}>
                                    {CATEGORY_LABELS[k]}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Line subtotal */}
                            <div className="sm:col-span-2 flex flex-col justify-end text-right">
                              <div className="text-[10px] text-[#94A3B8]">Subtotal</div>
                              <div className="font-mono font-bold text-xs text-amber-400 tabular-nums py-1.5">
                                {formatRp(Math.round(row.qty * row.unitPrice))}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeRow(row.rowId)}
                            aria-label="Hapus baris"
                            className="p-1.5 mt-1 rounded-lg hover:bg-rose-500/15 text-[#64748B] hover:text-rose-400 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cash Ledger Sync Option & Footer */}
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#232C3D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-[#F8FAFC] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={logExpense}
                      onChange={(e) => setLogExpense(e.target.checked)}
                      className="w-4 h-4 accent-sky-500"
                    />
                    <span>Otomatis catat total belanja ke Pengeluaran Bahan Baku (Buku Kas)</span>
                  </label>
                  {logExpense && (
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-[11px] text-[#94A3B8]">Metode Bayar:</span>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="px-2.5 py-1 rounded-lg bg-[#121824] border border-[#232C3D] text-xs text-[#F8FAFC]"
                      >
                        <option value="transfer">Transfer</option>
                        <option value="tunai">Tunai</option>
                        <option value="qris">QRIS</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="sm:text-right">
                  <div className="text-[11px] text-[#94A3B8]">Total Nilai Belanja</div>
                  <div className="text-lg font-mono font-bold tabular-nums text-amber-400">
                    {formatRp(totalCost)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#232C3D] text-xs font-semibold text-[#94A3B8] hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={selectedRows.length === 0 || saving}
                  onClick={() => void handleConfirmImport()}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saving
                    ? 'Memasukkan ke Stok...'
                    : `Masukkan ke Stok Bahan (${selectedRows.length} item)`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
