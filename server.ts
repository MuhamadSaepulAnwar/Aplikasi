import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const VALID_CATEGORIES = new Set([
  'tinta',
  'kaos_kain',
  'kertas_media',
  'kimia_sablon',
  'finishing',
  'lainnya',
]);

const VALID_DIVISIONS = new Set(['percetakan', 'sablon']);

interface ExistingMaterialHint {
  id: string;
  name: string;
  unit: string;
  division: string;
  category: string;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  // API: Scan supplier receipt photo or online order screenshot -> structured raw materials list
  app.post('/api/scan-stock-receipt', async (req, res) => {
    try {
      const { imageBase64, mimeType, existingMaterials } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        existingMaterials?: ExistingMaterialHint[];
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Gambar nota atau screenshot tidak ditemukan.' });
        return;
      }

      const safeMime =
        mimeType && /^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(mimeType)
          ? mimeType
          : 'image/jpeg';

      // Strip data URL prefix if accidentally included
      const pureBase64 = imageBase64.includes(',')
        ? imageBase64.slice(imageBase64.indexOf(',') + 1)
        : imageBase64;

      const ai = getGeminiClient();

      const existingListText =
        Array.isArray(existingMaterials) && existingMaterials.length > 0
          ? existingMaterials
              .slice(0, 80)
              .map(
                (m) =>
                  `- id="${m.id}" | nama="${m.name}" | satuan="${m.unit}" | divisi="${m.division}" | kategori="${m.category}"`
              )
              .join('\n')
          : '(Belum ada daftar bahan baku tersimpan)';

      const promptText = `Anda adalah asisten administrasi gudang & keuangan untuk bisnis Percetakan Digital dan Sablon di Indonesia.
Tugas Anda: Baca gambar yang diberikan (bisa berupa foto nota/invoice kertas dari supplier, struk toko bahan, atau screenshot pesanan pembelian online seperti Shopee, Tokopedia, TikTok Shop, Lazada, Bukalapak, WhatsApp).

Ekstrak seluruh item barang / bahan baku yang dibeli untuk dimasukkan ke daftar Stok Bahan Baku.

Aturan penting:
1. Jangan masukkan ongkos kirim, biaya layanan, biaya penanganan, asuransi pengiriman, kode voucher, atau diskon sebagai item barang. Fokus hanya pada item produk/bahan baku yang dibeli.
2. Untuk setiap item:
   - "name": Nama bahan yang jelas dan ringkas (sertakan varian/warna/ukuran jika tertulis, misal "Kaos Polos Combed 30s Hitam L" atau "Tinta Plastisol Putih 1kg").
   - "qty": Jumlah barang yang dibeli (angka positif, misal 12, 2, 50). Jika tertulis "x2" atau "2 pcs", isi 2.
   - "unit": Satuan yang paling sesuai (misal "pcs", "lusin", "kg", "liter", "botol", "roll", "lembar", "rim", "pack", "meter"). Jika tidak tertulis, gunakan "pcs".
   - "unitPrice": Harga beli PER SATUAN dalam Rupiah (angka bulat tanpa titik/koma). Jika di nota hanya tertulis harga total baris untuk qty > 1, bagi total baris dengan qty agar mendapat harga satuan.
   - "division": Pilih "sablon" untuk kaos polos, kain, tinta plastisol/rubber/DTF, film PET DTF, powder DTF, obat afdruk, rakel, screen; pilih "percetakan" untuk banner flexi, stiker vinyl/chromo, kertas art paper/HVS/ivory, tinta solvent/sublim/art paper, laminasi, mata ayam.
   - "category": Pilih salah satu dari:
     * "tinta" (tinta cetak, tinta DTF, cat plastisol/rubber, toner)
     * "kaos_kain" (kaos polos, hoodie, totebag, kain)
     * "kertas_media" (kertas, stiker, banner flexi, vinyl, kanvas)
     * "kimia_sablon" (film DTF, powder, obat afdruk, pengencer, remover, lem meja)
     * "finishing" (plastik kemasan, mata ayam, lem banner, laminasi, hangtag)
     * "lainnya" (jika tidak masuk kategori di atas)
   - "matchedMaterialId": Cocokkan dengan Daftar Bahan Tersimpan di bawah ini. Jika item pada gambar JELAS merupakan bahan yang sama dengan salah satu item tersimpan (meski penulisan sedikit berbeda), isi dengan "id"-nya. Jika ini bahan baru atau ragu-ragu, isi string kosong "".
   - "notes": Info tambahan singkat jika ada (varian, catatan ukuran, dll) atau string kosong "".
3. "sourceType": Pilih "pembelian_online" jika gambar adalah screenshot aplikasi e-commerce/marketplace/chat, atau "nota_supplier" jika berupa foto nota/faktur/struk toko fisik.
4. "supplier": Nama toko/supplier/penjual yang terlihat di nota atau screenshot (kosongkan jika tidak terbaca).
5. "purchaseDate": Tanggal pembelian dalam format YYYY-MM-DD jika terlihat di gambar, atau string kosong "" jika tidak terlihat.
6. "invoiceRef": Nomor nota / nomor pesanan / invoice jika terlihat, atau string kosong "".

Daftar Bahan Tersimpan saat ini:
${existingListText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: pureBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sourceType: {
                type: Type.STRING,
                description: 'nota_supplier atau pembelian_online',
              },
              supplier: {
                type: Type.STRING,
                description: 'Nama toko atau supplier',
              },
              purchaseDate: {
                type: Type.STRING,
                description: 'Tanggal transaksi YYYY-MM-DD atau string kosong',
              },
              invoiceRef: {
                type: Type.STRING,
                description: 'Nomor nota atau nomor pesanan online',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    qty: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    unitPrice: { type: Type.NUMBER },
                    division: { type: Type.STRING },
                    category: { type: Type.STRING },
                    matchedMaterialId: { type: Type.STRING },
                    notes: { type: Type.STRING },
                  },
                  required: ['name', 'qty', 'unit', 'unitPrice', 'division', 'category'],
                },
              },
            },
            required: ['sourceType', 'supplier', 'purchaseDate', 'invoiceRef', 'items'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({
          error: 'Tidak ada data yang terbaca dari gambar. Pastikan tulisan nota terlihat jelas.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        sourceType?: string;
        supplier?: string;
        purchaseDate?: string;
        invoiceRef?: string;
        items?: Array<{
          name?: string;
          qty?: number;
          unit?: string;
          unitPrice?: number;
          division?: string;
          category?: string;
          matchedMaterialId?: string;
          notes?: string;
        }>;
      };

      const validIds = new Set(
        Array.isArray(existingMaterials) ? existingMaterials.map((m) => m.id) : []
      );

      const normalizedItems = (Array.isArray(parsed.items) ? parsed.items : [])
        .map((it) => {
          const name = String(it.name || '').trim().slice(0, 120);
          const qty = Math.max(0.1, Number(it.qty) || 1);
          const unit = String(it.unit || 'pcs').trim().slice(0, 30) || 'pcs';
          const unitPrice = Math.max(0, Math.round(Number(it.unitPrice) || 0));
          const division = VALID_DIVISIONS.has(String(it.division || ''))
            ? String(it.division)
            : 'sablon';
          const category = VALID_CATEGORIES.has(String(it.category || ''))
            ? String(it.category)
            : 'lainnya';
          const matchedMaterialId =
            it.matchedMaterialId && validIds.has(it.matchedMaterialId)
              ? it.matchedMaterialId
              : '';
          const notes = String(it.notes || '').trim().slice(0, 200);
          return {
            name,
            qty,
            unit,
            unitPrice,
            division,
            category,
            matchedMaterialId,
            notes,
          };
        })
        .filter((it) => it.name.length > 0);

      res.json({
        sourceType:
          parsed.sourceType === 'pembelian_online' ? 'pembelian_online' : 'nota_supplier',
        supplier: String(parsed.supplier || '').trim().slice(0, 120),
        purchaseDate: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.purchaseDate || ''))
          ? String(parsed.purchaseDate)
          : '',
        invoiceRef: String(parsed.invoiceRef || '').trim().slice(0, 60),
        items: normalizedItems,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses gambar nota.';
      console.error('Error in /api/scan-stock-receipt:', err);

      if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(msg)) {
        res.status(403).json({
          error:
            'Kunci API Gemini tidak valid atau belum aktif. Silakan periksa panel Settings > Secrets.',
        });
        return;
      }
      if (/RESOURCE_EXHAUSTED|429/i.test(msg)) {
        res.status(429).json({
          error: 'Batas permintaan pemindaian sementara tercapai. Silakan coba lagi sebentar lagi.',
        });
        return;
      }

      res.status(500).json({ error: msg });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CetakKas server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
