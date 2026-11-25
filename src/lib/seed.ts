import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

function monthsAgoISO(monthsAgo: number, day = 12): string {
  const d = new Date();
  const target = new Date(d.getFullYear(), d.getMonth() - monthsAgo, Math.min(day, 28));
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Seeds realistic Indonesian printing & screen-printing demo data for the current owner
 * when they explicitly click "Muat Data Contoh" so they can explore all modules immediately.
 */
export async function seedSampleBusinessData(uid: string) {
  try {
    // 1. Sample Products with detailed HPP Breakdown
    const sampleProducts = [
      {
        name: 'Kaos Combed 30s + Sablon Manual / DTF',
        division: 'sablon',
        unit: 'pcs',
        sellPrice: 78000,
        hppUnit: 55000,
        hppComponents: [
          { label: 'Kaos Polos Combed 30s (Supplier)', amount: 35000, mode: 'per_unit' },
          { label: 'Ongkos Cetak Sablon Manual / DTF', amount: 15000, mode: 'per_unit' },
          { label: 'Ongkos Pekerja / Operator', amount: 3000, mode: 'per_unit' },
          { label: 'Listrik, Press & Kemasan Plastik', amount: 2000, mode: 'per_unit' },
        ],
        notes: 'Best seller kaos komunitas & event minimal 12 pcs',
      },
      {
        name: 'Spanduk / Banner Flexi 280gr Outdoor',
        division: 'percetakan',
        unit: 'm²',
        sellPrice: 28000,
        hppUnit: 14500,
        hppComponents: [
          { label: 'Bahan Flexi 280gr', amount: 8500, mode: 'per_unit' },
          { label: 'Tinta Solvent & Listrik Mesin', amount: 3500, mode: 'per_unit' },
          { label: 'Mata Ayam + Lem Finishing + Pekerja', amount: 2500, mode: 'per_unit' },
        ],
        notes: 'Termasuk mata ayam sudut standar',
      },
      {
        name: 'Stiker Vinyl A3+ Kiss Cut (Anti Air)',
        division: 'percetakan',
        unit: 'lembar',
        sellPrice: 18000,
        hppUnit: 9200,
        hppComponents: [
          { label: 'Bahan Stiker Vinyl A3+', amount: 4500, mode: 'per_unit' },
          { label: 'Toner / Klik Mesin Print A3', amount: 2700, mode: 'per_unit' },
          { label: 'Cutting Plotter & Operator', amount: 2000, mode: 'per_unit' },
        ],
        notes: 'Cocok untuk label kemasan UMKM minuman/makanan',
      },
      {
        name: 'Totebag Kanvas + Sablon DTF A4',
        division: 'sablon',
        unit: 'pcs',
        sellPrice: 45000,
        hppUnit: 29000,
        hppComponents: [
          { label: 'Totebag Kanvas Polos', amount: 16000, mode: 'per_unit' },
          { label: 'Print Film DTF + Powder', amount: 9000, mode: 'per_unit' },
          { label: 'Ongkos Press Pekerja', amount: 2500, mode: 'per_unit' },
          { label: 'Listrik & Kemasan', amount: 1500, mode: 'per_unit' },
        ],
        notes: 'Cocok untuk seminar & souvenir kantor',
      },
    ];

    const productIds: string[] = [];
    for (const p of sampleProducts) {
      const ref = await addDoc(collection(db, 'products'), {
        ownerId: uid,
        ...p,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      productIds.push(ref.id);
    }

    // 2. Sample Materials (including low-stock warning)
    const sampleMaterials = [
      {
        name: 'Kaos Polos Cotton Combed 30s Hitam (L)',
        category: 'kaos_kain',
        division: 'sablon',
        stock: 24,
        minStock: 30,
        unit: 'pcs',
        lastBuyPrice: 35000,
        supplier: 'Grosir Kaos Bandung Jaya',
        notes: 'Stok menipis, perlu restok sebelum akhir pekan',
      },
      {
        name: 'Tinta Plastisol Putih Super White',
        category: 'tinta',
        division: 'sablon',
        stock: 3,
        minStock: 5,
        unit: 'kg',
        lastBuyPrice: 145000,
        supplier: 'Toko Sablon Nusantara',
        notes: 'Fast moving untuk sablon kaos gelap',
      },
      {
        name: 'Roll Bahan Banner Flexi 280gr (3.2m x 70m)',
        category: 'kertas_media',
        division: 'percetakan',
        stock: 6,
        minStock: 2,
        unit: 'roll',
        lastBuyPrice: 1250000,
        supplier: 'PT Media Grafika',
        notes: 'Aman untuk produksi 3 minggu ke depan',
      },
      {
        name: 'PET Film DTF 60cm (100m)',
        category: 'kimia_sablon',
        division: 'sablon',
        stock: 4,
        minStock: 2,
        unit: 'roll',
        lastBuyPrice: 780000,
        supplier: 'DTF Supply ID',
        notes: 'Cold & hot peel',
      },
    ];

    for (const m of sampleMaterials) {
      await addDoc(collection(db, 'materials'), {
        ownerId: uid,
        ...m,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 3. Sample Orders (mix of Lunas & DP)
    const sampleOrders = [
      {
        invoiceNumber: 'INV101',
        customerName: 'Komunitas Trail Merdeka',
        customerPhone: '081234567890',
        division: 'sablon',
        orderDate: monthsAgoISO(0, 6),
        deadlineDate: monthsAgoISO(0, 14),
        items: [
          {
            productId: productIds[0],
            name: sampleProducts[0].name,
            qty: 50,
            unit: 'pcs',
            price: 78000,
            hppUnit: 55000,
            subtotal: 3900000,
          },
        ],
        discount: 0,
        totalAmount: 3900000,
        totalHpp: 2750000,
        paidAmount: 2000000,
        remainingAmount: 1900000,
        paymentStatus: 'dp',
        productionStatus: 'proses',
        paymentMethod: 'transfer',
        notes: 'DP 50% sudah masuk via BCA, pelunasan saat ambil barang',
      },
      {
        invoiceNumber: 'INV102',
        customerName: 'Kopi Senja Roastery',
        customerPhone: '085611223344',
        division: 'percetakan',
        orderDate: monthsAgoISO(0, 10),
        deadlineDate: monthsAgoISO(0, 12),
        items: [
          {
            productId: productIds[2],
            name: sampleProducts[2].name,
            qty: 80,
            unit: 'lembar',
            price: 18000,
            hppUnit: 9200,
            subtotal: 1440000,
          },
          {
            productId: productIds[1],
            name: sampleProducts[1].name,
            qty: 18,
            unit: 'm²',
            price: 28000,
            hppUnit: 14500,
            subtotal: 504000,
          },
        ],
        discount: 44000,
        totalAmount: 1900000,
        totalHpp: 997000,
        paidAmount: 1900000,
        remainingAmount: 0,
        paymentStatus: 'lunas',
        productionStatus: 'selesai',
        paymentMethod: 'qris',
        notes: 'Siap diambil besok pagi',
      },
      {
        invoiceNumber: 'INV103',
        customerName: 'Raka Pratama',
        customerPhone: '081277889900',
        division: 'sablon',
        orderDate: monthsAgoISO(0, 14),
        deadlineDate: monthsAgoISO(0, 19),
        items: [
          {
            productId: '',
            name: 'Kaos Hitam 24s L + Sablon',
            qty: 1,
            unit: 'pcs',
            price: 75000,
            hppUnit: 0,
            subtotal: 75000,
          },
        ],
        discount: 0,
        totalAmount: 75000,
        totalHpp: 0,
        paidAmount: 75000,
        remainingAmount: 0,
        paymentStatus: 'lunas',
        productionStatus: 'selesai',
        paymentMethod: 'transfer',
        notes: 'Order contoh yang HPP-nya belum dimasukkan (siap dipilih di Riwayat HPP)',
      },
      {
        invoiceNumber: 'INV094',
        customerName: 'PT Sinar Karya Mandiri',
        customerPhone: '081398765432',
        division: 'sablon',
        orderDate: monthsAgoISO(1, 15),
        deadlineDate: monthsAgoISO(1, 22),
        items: [
          {
            productId: productIds[3],
            name: sampleProducts[3].name,
            qty: 100,
            unit: 'pcs',
            price: 45000,
            hppUnit: 29000,
            subtotal: 4500000,
          },
        ],
        discount: 0,
        totalAmount: 4500000,
        totalHpp: 2900000,
        paidAmount: 4500000,
        remainingAmount: 0,
        paymentStatus: 'lunas',
        productionStatus: 'diambil',
        paymentMethod: 'transfer',
        notes: 'Event gathering kantor',
      },
    ];

    for (const o of sampleOrders) {
      const orderRef = doc(collection(db, 'orders'));
      await setDoc(orderRef, {
        ownerId: uid,
        ...o,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (o.totalHpp > 0) {
        const totalQty = Math.max(
          1,
          o.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
        );
        const boronganCost = o.invoiceNumber === 'INV101' ? 175000 : o.invoiceNumber === 'INV094' ? 250000 : 90000;
        const otherCost = o.invoiceNumber === 'INV101' ? 75000 : o.invoiceNumber === 'INV094' ? 150000 : 45000;
        const grossProfit = o.totalAmount - o.totalHpp;
        const netProfit = grossProfit - boronganCost - otherCost;
        const itemSummary = o.items.map((it) => it.name).join(', ').slice(0, 160);

        await addDoc(collection(db, 'hppRecords'), {
          ownerId: uid,
          sourceType: 'order',
          orderId: orderRef.id,
          invoiceNumber: o.invoiceNumber,
          customerName: o.customerName,
          division: o.division,
          recordDate: o.orderDate,
          itemName: itemSummary,
          qty: totalQty,
          unit: o.items[0]?.unit || 'pcs',
          sellPriceTotal: o.totalAmount,
          hppUnit: Math.round(o.totalHpp / totalQty),
          hppTotal: o.totalHpp,
          boronganCost,
          otherCost,
          grossProfit,
          netProfit,
          hppComponents: [],
          syncToCash: false,
          notes: o.notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    // 4. Sample Multi-Month Cash Transactions (so 1m, 2m, 3m, 6m, 1y charts & Monthly Net Profit shine)
    const multiMonthSnapshots = [
      { mAgo: 5, cetak: 6200000, sablon: 8400000, bahan: 6400000, gaji: 2800000, lain: 1350000 },
      { mAgo: 4, cetak: 7100000, sablon: 9200000, bahan: 7100000, gaji: 3100000, lain: 1450000 },
      { mAgo: 3, cetak: 6800000, sablon: 10500000, bahan: 7800000, gaji: 3250000, lain: 1500000 },
      { mAgo: 2, cetak: 8300000, sablon: 11200000, bahan: 8400000, gaji: 3500000, lain: 1600000 },
      { mAgo: 1, cetak: 9100000, sablon: 12800000, bahan: 9200000, gaji: 3800000, lain: 1750000 },
      { mAgo: 0, cetak: 5400000, sablon: 8900000, bahan: 5800000, gaji: 2450000, lain: 1420000 },
    ];

    for (const snap of multiMonthSnapshots) {
      const entries = [
        {
          type: 'pemasukan',
          division: 'percetakan',
          expenseGroup: 'penjualan',
          category: 'Order Percetakan',
          description: 'Pembayaran order spanduk, stiker & brosur',
          amount: snap.cetak,
          paymentMethod: 'transfer',
          date: monthsAgoISO(snap.mAgo, 8),
        },
        {
          type: 'pemasukan',
          division: 'sablon',
          expenseGroup: 'penjualan',
          category: 'Order Sablon',
          description: 'Pembayaran order kaos sablon manual & DTF',
          amount: snap.sablon,
          paymentMethod: 'transfer',
          date: monthsAgoISO(snap.mAgo, 11),
        },
        {
          type: 'pengeluaran',
          division: 'sablon',
          expenseGroup: 'bahan_baku',
          category: 'Bahan Baku Kaos & Tinta',
          description: 'Belanja kaos polos supplier, tinta & film DTF',
          amount: snap.bahan,
          paymentMethod: 'transfer',
          date: monthsAgoISO(snap.mAgo, 9),
        },
        {
          type: 'pengeluaran',
          division: 'umum',
          expenseGroup: 'gaji_karyawan',
          category: 'Gaji & Upah Karyawan',
          description: 'Pembayaran upah harian & borongan tim produksi',
          amount: snap.gaji,
          paymentMethod: 'tunai',
          date: monthsAgoISO(snap.mAgo, 15),
        },
        {
          type: 'pengeluaran',
          division: 'umum',
          expenseGroup: 'biaya_lain_lain',
          category: 'Listrik, Sewa & Operasional',
          description: 'Token listrik workshop, internet, perawatan mesin & konsumsi',
          amount: snap.lain,
          paymentMethod: 'qris',
          date: monthsAgoISO(snap.mAgo, 16),
        },
      ];

      for (const tx of entries) {
        await addDoc(collection(db, 'transactions'), {
          ownerId: uid,
          ...tx,
          referenceType: 'manual',
          referenceId: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    // 5. Sample Employees & Editable Payroll Logs (Daily + Piece-Rate)
    const emp1Ref = doc(collection(db, 'employees'));
    const emp2Ref = doc(collection(db, 'employees'));

    await setDoc(emp1Ref, {
      ownerId: uid,
      name: 'Budi Santoso',
      role: 'Tukang Sablon Manual & DTF',
      phone: '081299887766',
      payScheme: 'borongan',
      defaultRate: 3000,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(emp2Ref, {
      ownerId: uid,
      name: 'Rina Kusuma',
      role: 'Operator Cetak & Desainer',
      phone: '085744332211',
      payScheme: 'harian',
      defaultRate: 110000,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const sampleLogs = [
      {
        employeeId: emp1Ref.id,
        employeeName: 'Budi Santoso',
        employeeRole: 'Tukang Sablon Manual & DTF',
        workDate: monthsAgoISO(0, 12),
        payType: 'borongan',
        jobDescription: 'Sablon Manual Kaos Komunitas Trail (2 sisi)',
        quantity: 50,
        unitLabel: 'pcs',
        rate: 3000,
        bonus: 25000,
        deduction: 0,
        netAmount: 175000,
        status: 'belum_dibayar',
        paidDate: '',
        notes: 'Bonus lembur selesai tepat waktu',
      },
      {
        employeeId: emp1Ref.id,
        employeeName: 'Budi Santoso',
        employeeRole: 'Tukang Sablon Manual & DTF',
        workDate: monthsAgoISO(0, 14),
        payType: 'borongan',
        jobDescription: 'Press Sablon DTF Totebag Kanvas',
        quantity: 60,
        unitLabel: 'pcs',
        rate: 2500,
        bonus: 0,
        deduction: 20000,
        netAmount: 130000,
        status: 'belum_dibayar',
        paidDate: '',
        notes: 'Potongan kasbon Rp20.000',
      },
      {
        employeeId: emp2Ref.id,
        employeeName: 'Rina Kusuma',
        employeeRole: 'Operator Cetak & Desainer',
        workDate: monthsAgoISO(0, 15),
        payType: 'harian',
        jobDescription: 'Operator Cetak Banner, Stiker & Layout Desain',
        quantity: 6,
        unitLabel: 'hari',
        rate: 110000,
        bonus: 50000,
        deduction: 0,
        netAmount: 710000,
        status: 'belum_dibayar',
        paidDate: '',
        notes: 'Kerja Senin–Sabtu + bonus target',
      },
    ];

    for (const log of sampleLogs) {
      await addDoc(collection(db, 'payrollLogs'), {
        ownerId: uid,
        ...log,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedSampleBusinessData');
  }
}
