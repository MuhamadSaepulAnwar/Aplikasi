import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatRp, sanitizeString, todayISO } from '../lib/format';
import {
  CashDivision,
  Division,
  Employee,
  ExpenseGroup,
  HppComponent,
  Material,
  MaterialCategory,
  Order,
  OrderItem,
  PaymentMethod,
  PaymentStatus,
  PayrollLog,
  PayrollType,
  PayScheme,
  Product,
  ProductionStatus,
  ReferenceType,
  ShopProfile,
  Transaction,
  TransactionType,
} from '../types';
import { ToastContainer, ToastMessage } from '../components/Toast';

const DEFAULT_PROFILE_BASE: Omit<ShopProfile, 'ownerId'> = {
  shopName: 'CetakKas Studio',
  tagline: 'Percetakan Digital & Sablon Custom',
  address: 'Jl. Industri Kreatif No. 12, Indonesia',
  phone: '0812-0000-0000',
  ownerName: 'Pemilik Usaha',
  bankInfo: 'BCA 1234567890 a.n. CetakKas Studio',
  invoiceFooter: 'Terima kasih atas pesanan Anda. Barang yang sudah dicetak tidak dapat dibatalkan.',
  logoDataUrl: '',
  accentColor: '#0EA5E9',
  invoicePrefix: 'INV',
};

interface WorkspaceContextValue {
  user: User | null;
  authReady: boolean;
  loadingData: boolean;
  shopProfile: ShopProfile;
  products: Product[];
  orders: Order[];
  transactions: Transaction[];
  materials: Material[];
  employees: Employee[];
  payrollLogs: PayrollLog[];
  notify: (text: string, type?: 'success' | 'error') => void;
  saveShopProfile: (updates: Omit<ShopProfile, 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  saveProduct: (
    data: {
      name: string;
      division: Division;
      unit: string;
      sellPrice: number;
      hppUnit: number;
      hppComponents: HppComponent[];
      notes: string;
    },
    editingId?: string
  ) => Promise<string>;
  deleteProduct: (id: string) => Promise<void>;
  createOrder: (
    data: {
      invoiceNumber: string;
      customerName: string;
      customerPhone: string;
      division: Division;
      orderDate: string;
      deadlineDate: string;
      items: OrderItem[];
      discount: number;
      paidAmount: number;
      paymentMethod: PaymentMethod;
      productionStatus: ProductionStatus;
      notes: string;
    },
    autoLogCash: boolean
  ) => Promise<string>;
  updateOrder: (
    id: string,
    data: {
      customerName: string;
      customerPhone: string;
      division: Division;
      orderDate: string;
      deadlineDate: string;
      items: OrderItem[];
      discount: number;
      paidAmount: number;
      paymentMethod: PaymentMethod;
      productionStatus: ProductionStatus;
      notes: string;
    }
  ) => Promise<void>;
  recordOrderPayment: (
    order: Order,
    addedPayment: number,
    method: PaymentMethod,
    paymentDate: string,
    autoLogCash: boolean
  ) => Promise<void>;
  updateOrderProductionStatus: (orderId: string, status: ProductionStatus) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  saveTransaction: (
    data: {
      type: TransactionType;
      division: CashDivision;
      expenseGroup: ExpenseGroup;
      category: string;
      description: string;
      amount: number;
      paymentMethod: PaymentMethod;
      date: string;
      referenceType?: ReferenceType;
      referenceId?: string;
    },
    editingId?: string
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveMaterial: (
    data: {
      name: string;
      category: MaterialCategory;
      division: Division;
      stock: number;
      minStock: number;
      unit: string;
      lastBuyPrice: number;
      supplier: string;
      notes: string;
    },
    editingId?: string
  ) => Promise<void>;
  adjustMaterialStock: (
    material: Material,
    delta: number,
    unitBuyPrice: number,
    logExpense: boolean,
    paymentMethod: PaymentMethod,
    date: string
  ) => Promise<void>;
  importMaterialsFromReceipt: (data: {
    supplier: string;
    date: string;
    invoiceRef: string;
    sourceLabel: string;
    paymentMethod: PaymentMethod;
    logExpense: boolean;
    items: Array<{
      matchedMaterialId: string;
      name: string;
      category: MaterialCategory;
      division: Division;
      qty: number;
      unit: string;
      unitPrice: number;
      minStock: number;
      notes: string;
    }>;
  }) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
  saveEmployee: (
    data: {
      name: string;
      role: string;
      phone: string;
      payScheme: PayScheme;
      defaultRate: number;
      isActive: boolean;
    },
    editingId?: string
  ) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  savePayrollLog: (
    data: {
      employeeId: string;
      employeeName: string;
      employeeRole: string;
      workDate: string;
      payType: PayrollType;
      jobDescription: string;
      quantity: number;
      unitLabel: string;
      rate: number;
      bonus: number;
      deduction: number;
      notes: string;
    },
    editingId?: string
  ) => Promise<void>;
  deletePayrollLog: (id: string) => Promise<void>;
  markPayrollPaidAndLogCash: (
    logs: PayrollLog[],
    employeeName: string,
    paymentMethod: PaymentMethod,
    paidDate: string,
    logToCash: boolean,
    kasbonDeduction?: number
  ) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [shopProfile, setShopProfile] = useState<ShopProfile>({
    ownerId: '',
    ...DEFAULT_PROFILE_BASE,
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollLogs, setPayrollLogs] = useState<PayrollLog[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setProducts([]);
        setOrders([]);
        setTransactions([]);
        setMaterials([]);
        setEmployees([]);
        setPayrollLogs([]);
        setShopProfile({ ownerId: '', ...DEFAULT_PROFILE_BASE });
        setLoadingData(false);
      }
    });
    return () => unsub();
  }, []);

  // Apply dynamic white-label branding to document title & CSS accent variable
  useEffect(() => {
    const accent = /^#[0-9a-fA-F]{6}$/.test(shopProfile.accentColor)
      ? shopProfile.accentColor
      : '#0EA5E9';
    document.documentElement.style.setProperty('--shop-accent', accent);
    document.title = shopProfile.shopName
      ? `${shopProfile.shopName} — Keuangan Percetakan & Sablon`
      : 'CetakKas — Keuangan & Operasional Percetakan & Sablon';
  }, [shopProfile.shopName, shopProfile.accentColor]);

  // Real-time Firestore listeners once authenticated
  useEffect(() => {
    if (!authReady || !user) return;
    setLoadingData(true);
    const uid = user.uid;

    const profileRef = doc(db, 'shopProfiles', uid);
    const unsubProfile = onSnapshot(
      profileRef,
      async (snap) => {
        if (snap.exists()) {
          setShopProfile(snap.data() as ShopProfile);
        } else {
          // Initialize clean white-label shop profile on first sign-in
          const initial: ShopProfile = {
            ownerId: uid,
            ...DEFAULT_PROFILE_BASE,
            ownerName: sanitizeString(user.displayName || 'Pemilik Usaha', 100),
          };
          setShopProfile(initial);
          try {
            await setDoc(profileRef, {
              ...initial,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `shopProfiles/${uid}`);
          }
        }
        setLoadingData(false);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `shopProfiles/${uid}`)
    );

    const qProducts = query(collection(db, 'products'), where('ownerId', '==', uid));
    const unsubProducts = onSnapshot(
      qProducts,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const qOrders = query(collection(db, 'orders'), where('ownerId', '==', uid));
    const unsubOrders = onSnapshot(
      qOrders,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
        list.sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || '') || b.invoiceNumber.localeCompare(a.invoiceNumber));
        setOrders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
    );

    const qTx = query(collection(db, 'transactions'), where('ownerId', '==', uid));
    const unsubTx = onSnapshot(
      qTx,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }));
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    const qMaterials = query(collection(db, 'materials'), where('ownerId', '==', uid));
    const unsubMaterials = onSnapshot(
      qMaterials,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Material, 'id'>) }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setMaterials(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'materials')
    );

    const qEmployees = query(collection(db, 'employees'), where('ownerId', '==', uid));
    const unsubEmployees = onSnapshot(
      qEmployees,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, 'id'>) }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setEmployees(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'employees')
    );

    const qPayroll = query(collection(db, 'payrollLogs'), where('ownerId', '==', uid));
    const unsubPayroll = onSnapshot(
      qPayroll,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PayrollLog, 'id'>) }));
        list.sort((a, b) => (b.workDate || '').localeCompare(a.workDate || ''));
        setPayrollLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payrollLogs')
    );

    return () => {
      unsubProfile();
      unsubProducts();
      unsubOrders();
      unsubTx();
      unsubMaterials();
      unsubEmployees();
      unsubPayroll();
    };
  }, [authReady, user]);

  // --- Mutations ---

  const saveShopProfile = async (
    updates: Omit<ShopProfile, 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) return;
    const ref = doc(db, 'shopProfiles', user.uid);
    const cleanAccent = /^#[0-9a-fA-F]{6}$/.test(updates.accentColor)
      ? updates.accentColor
      : '#0EA5E9';
    const payload = {
      shopName: sanitizeString(updates.shopName, 100) || 'Toko Percetakan',
      tagline: sanitizeString(updates.tagline, 140),
      address: sanitizeString(updates.address, 300),
      phone: sanitizeString(updates.phone, 40),
      ownerName: sanitizeString(updates.ownerName, 100),
      bankInfo: sanitizeString(updates.bankInfo, 300),
      invoiceFooter: sanitizeString(updates.invoiceFooter, 300),
      logoDataUrl: (updates.logoDataUrl || '').slice(0, 150000),
      accentColor: cleanAccent,
      invoicePrefix: sanitizeString(updates.invoicePrefix, 16) || 'INV',
      updatedAt: serverTimestamp(),
    };
    try {
      await updateDoc(ref, payload);
      notify('Identitas toko berhasil disimpan & diterapkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shopProfiles/${user.uid}`);
    }
  };

  const saveProduct = async (
    data: {
      name: string;
      division: Division;
      unit: string;
      sellPrice: number;
      hppUnit: number;
      hppComponents: HppComponent[];
      notes: string;
    },
    editingId?: string
  ): Promise<string> => {
    if (!user) return '';
    const cleanComponents = (data.hppComponents || []).slice(0, 20).map((c) => ({
      label: sanitizeString(c.label, 80) || 'Komponen',
      amount: Math.max(0, Number(c.amount) || 0),
      mode: c.mode === 'fixed' ? 'fixed' : 'per_unit',
    }));

    const base = {
      name: sanitizeString(data.name, 120) || 'Produk Baru',
      division: data.division,
      unit: sanitizeString(data.unit, 30) || 'pcs',
      sellPrice: Math.max(0, Math.min(1_000_000_000, Number(data.sellPrice) || 0)),
      hppUnit: Math.max(0, Math.min(1_000_000_000, Number(data.hppUnit) || 0)),
      hppComponents: cleanComponents,
      notes: sanitizeString(data.notes, 300),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), base);
        notify('Produk berhasil diperbarui.');
        return editingId;
      } else {
        const ref = await addDoc(collection(db, 'products'), {
          ownerId: user.uid,
          ...base,
          createdAt: serverTimestamp(),
        });
        notify('Produk berhasil ditambahkan ke katalog.');
        return ref.id;
      }
    } catch (err) {
      handleFirestoreError(
        err,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        editingId ? `products/${editingId}` : 'products'
      );
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      notify('Produk dihapus dari katalog.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    }
  };

  const computeOrderTotals = (items: OrderItem[], discount: number, paidAmount: number) => {
    const cleanItems = items.slice(0, 30).map((it) => {
      const qty = Math.max(1, Number(it.qty) || 1);
      const price = Math.max(0, Number(it.price) || 0);
      const hppUnit = Math.max(0, Number(it.hppUnit) || 0);
      return {
        productId: sanitizeString(it.productId || '', 128),
        name: sanitizeString(it.name, 120) || 'Item',
        qty,
        unit: sanitizeString(it.unit, 30) || 'pcs',
        price,
        hppUnit,
        subtotal: Math.round(qty * price),
      };
    });
    const gross = cleanItems.reduce((sum, it) => sum + it.subtotal, 0);
    const totalHpp = cleanItems.reduce((sum, it) => sum + Math.round(it.qty * it.hppUnit), 0);
    const safeDiscount = Math.max(0, Math.min(gross, Number(discount) || 0));
    const totalAmount = Math.max(0, gross - safeDiscount);
    const safePaid = Math.max(0, Math.min(totalAmount, Number(paidAmount) || 0));
    const remainingAmount = Math.max(0, totalAmount - safePaid);
    const paymentStatus: PaymentStatus =
      safePaid <= 0 ? 'belum_bayar' : remainingAmount === 0 ? 'lunas' : 'dp';
    return { cleanItems, safeDiscount, totalAmount, totalHpp, safePaid, remainingAmount, paymentStatus };
  };

  const createOrder = async (
    data: {
      invoiceNumber: string;
      customerName: string;
      customerPhone: string;
      division: Division;
      orderDate: string;
      deadlineDate: string;
      items: OrderItem[];
      discount: number;
      paidAmount: number;
      paymentMethod: PaymentMethod;
      productionStatus: ProductionStatus;
      notes: string;
    },
    autoLogCash: boolean
  ): Promise<string> => {
    if (!user) return '';
    const {
      cleanItems,
      safeDiscount,
      totalAmount,
      totalHpp,
      safePaid,
      remainingAmount,
      paymentStatus,
    } = computeOrderTotals(data.items, data.discount, data.paidAmount);

    const orderDate = /^\d{4}-\d{2}-\d{2}$/.test(data.orderDate) ? data.orderDate : todayISO();
    const deadlineDate = /^\d{4}-\d{2}-\d{2}$/.test(data.deadlineDate) ? data.deadlineDate : '';

    const orderRef = doc(collection(db, 'orders'));
    const batch = writeBatch(db);

    batch.set(orderRef, {
      ownerId: user.uid,
      invoiceNumber: sanitizeString(data.invoiceNumber, 40) || `INV-${Date.now()}`,
      customerName: sanitizeString(data.customerName, 120) || 'Pelanggan Umum',
      customerPhone: sanitizeString(data.customerPhone, 40),
      division: data.division,
      orderDate,
      deadlineDate,
      items: cleanItems,
      discount: safeDiscount,
      totalAmount,
      totalHpp,
      paidAmount: safePaid,
      remainingAmount,
      paymentStatus,
      productionStatus: data.productionStatus,
      paymentMethod: data.paymentMethod,
      notes: sanitizeString(data.notes, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (autoLogCash && safePaid > 0) {
      const txRef = doc(collection(db, 'transactions'));
      batch.set(txRef, {
        ownerId: user.uid,
        type: 'pemasukan',
        division: data.division,
        expenseGroup: 'penjualan',
        category: data.division === 'sablon' ? 'Order Sablon' : 'Order Percetakan',
        description: sanitizeString(
          `${paymentStatus === 'lunas' ? 'Pelunasan' : 'DP'} ${data.invoiceNumber} — ${data.customerName}`,
          250
        ),
        amount: safePaid,
        paymentMethod: data.paymentMethod,
        date: orderDate,
        referenceType: 'order',
        referenceId: orderRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      notify(
        autoLogCash && safePaid > 0
          ? 'Order disimpan & pembayaran otomatis dicatat ke Buku Kas.'
          : 'Order baru berhasil disimpan.'
      );
      return orderRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `orders/${orderRef.id}`);
    }
  };

  const updateOrder = async (
    id: string,
    data: {
      customerName: string;
      customerPhone: string;
      division: Division;
      orderDate: string;
      deadlineDate: string;
      items: OrderItem[];
      discount: number;
      paidAmount: number;
      paymentMethod: PaymentMethod;
      productionStatus: ProductionStatus;
      notes: string;
    }
  ) => {
    const {
      cleanItems,
      safeDiscount,
      totalAmount,
      totalHpp,
      safePaid,
      remainingAmount,
      paymentStatus,
    } = computeOrderTotals(data.items, data.discount, data.paidAmount);

    const orderDate = /^\d{4}-\d{2}-\d{2}$/.test(data.orderDate) ? data.orderDate : todayISO();
    const deadlineDate = /^\d{4}-\d{2}-\d{2}$/.test(data.deadlineDate) ? data.deadlineDate : '';

    try {
      await updateDoc(doc(db, 'orders', id), {
        customerName: sanitizeString(data.customerName, 120) || 'Pelanggan Umum',
        customerPhone: sanitizeString(data.customerPhone, 40),
        division: data.division,
        orderDate,
        deadlineDate,
        items: cleanItems,
        discount: safeDiscount,
        totalAmount,
        totalHpp,
        paidAmount: safePaid,
        remainingAmount,
        paymentStatus,
        productionStatus: data.productionStatus,
        paymentMethod: data.paymentMethod,
        notes: sanitizeString(data.notes, 500),
        updatedAt: serverTimestamp(),
      });
      notify('Order berhasil diperbarui.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const recordOrderPayment = async (
    order: Order,
    addedPayment: number,
    method: PaymentMethod,
    paymentDate: string,
    autoLogCash: boolean
  ) => {
    if (!user) return;
    const pay = Math.max(0, Math.min(order.remainingAmount, Math.round(addedPayment)));
    if (pay <= 0) return;

    const newPaid = Math.min(order.totalAmount, order.paidAmount + pay);
    const newRemaining = Math.max(0, order.totalAmount - newPaid);
    const newStatus: PaymentStatus = newRemaining === 0 ? 'lunas' : 'dp';
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(paymentDate) ? paymentDate : todayISO();

    const batch = writeBatch(db);
    batch.update(doc(db, 'orders', order.id), {
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      paymentStatus: newStatus,
      paymentMethod: method,
      updatedAt: serverTimestamp(),
    });

    if (autoLogCash) {
      const txRef = doc(collection(db, 'transactions'));
      batch.set(txRef, {
        ownerId: user.uid,
        type: 'pemasukan',
        division: order.division,
        expenseGroup: 'penjualan',
        category: order.division === 'sablon' ? 'Order Sablon' : 'Order Percetakan',
        description: sanitizeString(
          `${newStatus === 'lunas' ? 'Pelunasan' : 'Cicilan'} ${order.invoiceNumber} — ${order.customerName}`,
          250
        ),
        amount: pay,
        paymentMethod: method,
        date: validDate,
        referenceType: 'order',
        referenceId: order.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      notify(
        newStatus === 'lunas'
          ? `Order ${order.invoiceNumber} kini LUNAS & tercatat di Buku Kas.`
          : `Pembayaran tambahan berhasil dicatat.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const updateOrderProductionStatus = async (orderId: string, status: ProductionStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        productionStatus: status,
        updatedAt: serverTimestamp(),
      });
      notify('Status produksi diperbarui.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'orders', id));
      notify('Order berhasil dihapus.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${id}`);
    }
  };

  const saveTransaction = async (
    data: {
      type: TransactionType;
      division: CashDivision;
      expenseGroup: ExpenseGroup;
      category: string;
      description: string;
      amount: number;
      paymentMethod: PaymentMethod;
      date: string;
      referenceType?: ReferenceType;
      referenceId?: string;
    },
    editingId?: string
  ) => {
    if (!user) return;
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : todayISO();
    const safeAmount = Math.max(1, Math.min(10_000_000_000, Math.round(Number(data.amount) || 0)));
    const group: ExpenseGroup = data.type === 'pemasukan' ? 'penjualan' : data.expenseGroup;

    const editableFields = {
      type: data.type,
      division: data.division,
      expenseGroup: group,
      category: sanitizeString(data.category, 80) || 'Umum',
      description: sanitizeString(data.description, 250) || 'Transaksi',
      amount: safeAmount,
      paymentMethod: data.paymentMethod,
      date: validDate,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'transactions', editingId), editableFields);
        notify('Transaksi kas diperbarui.');
      } else {
        await addDoc(collection(db, 'transactions'), {
          ownerId: user.uid,
          ...editableFields,
          referenceType: data.referenceType || 'manual',
          referenceId: sanitizeString(data.referenceId || '', 128),
          createdAt: serverTimestamp(),
        });
        notify('Transaksi kas berhasil dicatat.');
      }
    } catch (err) {
      handleFirestoreError(
        err,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        editingId ? `transactions/${editingId}` : 'transactions'
      );
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      notify('Transaksi dihapus dari Buku Kas.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const saveMaterial = async (
    data: {
      name: string;
      category: MaterialCategory;
      division: Division;
      stock: number;
      minStock: number;
      unit: string;
      lastBuyPrice: number;
      supplier: string;
      notes: string;
    },
    editingId?: string
  ) => {
    if (!user) return;
    const fields = {
      name: sanitizeString(data.name, 120) || 'Bahan Baku',
      category: data.category,
      division: data.division,
      stock: Math.max(0, Math.min(10_000_000, Number(data.stock) || 0)),
      minStock: Math.max(0, Math.min(10_000_000, Number(data.minStock) || 0)),
      unit: sanitizeString(data.unit, 30) || 'pcs',
      lastBuyPrice: Math.max(0, Math.min(1_000_000_000, Number(data.lastBuyPrice) || 0)),
      supplier: sanitizeString(data.supplier, 120),
      notes: sanitizeString(data.notes, 300),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'materials', editingId), fields);
        notify('Data bahan baku diperbarui.');
      } else {
        await addDoc(collection(db, 'materials'), {
          ownerId: user.uid,
          ...fields,
          createdAt: serverTimestamp(),
        });
        notify('Bahan baku baru ditambahkan.');
      }
    } catch (err) {
      handleFirestoreError(
        err,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        editingId ? `materials/${editingId}` : 'materials'
      );
    }
  };

  const adjustMaterialStock = async (
    material: Material,
    delta: number,
    unitBuyPrice: number,
    logExpense: boolean,
    paymentMethod: PaymentMethod,
    date: string
  ) => {
    if (!user) return;
    const newStock = Math.max(0, Number((material.stock + delta).toFixed(2)));
    const safePrice = Math.max(0, Number(unitBuyPrice) || material.lastBuyPrice || 0);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();

    const batch = writeBatch(db);
    batch.update(doc(db, 'materials', material.id), {
      stock: newStock,
      lastBuyPrice: delta > 0 ? safePrice : material.lastBuyPrice,
      updatedAt: serverTimestamp(),
    });

    const totalCost = Math.round(delta * safePrice);
    if (delta > 0 && logExpense && totalCost > 0) {
      const txRef = doc(collection(db, 'transactions'));
      batch.set(txRef, {
        ownerId: user.uid,
        type: 'pengeluaran',
        division: material.division,
        expenseGroup: 'bahan_baku',
        category: material.division === 'sablon' ? 'Bahan Baku Sablon' : 'Bahan Baku Percetakan',
        description: sanitizeString(
          `Restok ${material.name} (${delta} ${material.unit})`,
          250
        ),
        amount: totalCost,
        paymentMethod,
        date: validDate,
        referenceType: 'material',
        referenceId: material.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      notify(
        delta > 0
          ? logExpense && totalCost > 0
            ? 'Stok bertambah & pembelian bahan dicatat ke Buku Kas.'
            : 'Stok bahan berhasil ditambahkan.'
          : 'Pemakaian bahan berhasil dicatat.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `materials/${material.id}`);
    }
  };

  const importMaterialsFromReceipt = async (data: {
    supplier: string;
    date: string;
    invoiceRef: string;
    sourceLabel: string;
    paymentMethod: PaymentMethod;
    logExpense: boolean;
    items: Array<{
      matchedMaterialId: string;
      name: string;
      category: MaterialCategory;
      division: Division;
      qty: number;
      unit: string;
      unitPrice: number;
      minStock: number;
      notes: string;
    }>;
  }) => {
    if (!user || data.items.length === 0) return;

    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : todayISO();
    const safeSupplier = sanitizeString(data.supplier, 120);
    const safeRef = sanitizeString(data.invoiceRef, 60);

    const batch = writeBatch(db);
    let totalCost = 0;
    let addedCount = 0;
    let updatedCount = 0;
    const divisionsUsed = new Set<Division>();
    const summaryNames: string[] = [];

    // Track running stock per existing material in case two rows match the same material
    const runningStockMap = new Map<string, number>();

    for (const item of data.items) {
      const safeQty = Math.max(0.1, Math.min(10_000_000, Number(item.qty) || 0));
      const safePrice = Math.max(0, Math.min(1_000_000_000, Math.round(Number(item.unitPrice) || 0)));
      const safeName = sanitizeString(item.name, 120) || 'Bahan Baku';
      const safeUnit = sanitizeString(item.unit, 30) || 'pcs';
      const safeNotes = sanitizeString(
        item.notes || (safeRef ? `Import ${data.sourceLabel} (${safeRef})` : `Import ${data.sourceLabel}`),
        300
      );

      divisionsUsed.add(item.division);
      totalCost += Math.round(safeQty * safePrice);
      summaryNames.push(`${safeName} (${safeQty} ${safeUnit})`);

      const existingMat = item.matchedMaterialId
        ? materials.find((m) => m.id === item.matchedMaterialId)
        : undefined;

      if (existingMat) {
        const baseStock = runningStockMap.has(existingMat.id)
          ? runningStockMap.get(existingMat.id)!
          : existingMat.stock;
        const nextStock = Math.min(10_000_000, Number((baseStock + safeQty).toFixed(2)));
        runningStockMap.set(existingMat.id, nextStock);

        batch.update(doc(db, 'materials', existingMat.id), {
          stock: nextStock,
          lastBuyPrice: safePrice > 0 ? safePrice : existingMat.lastBuyPrice,
          supplier: safeSupplier || existingMat.supplier,
          updatedAt: serverTimestamp(),
        });
        updatedCount += 1;
      } else {
        const newRef = doc(collection(db, 'materials'));
        batch.set(newRef, {
          ownerId: user.uid,
          name: safeName,
          category: item.category,
          division: item.division,
          stock: Number(safeQty.toFixed(2)),
          minStock: Math.max(0, Math.min(10_000_000, Number(item.minStock) || 5)),
          unit: safeUnit,
          lastBuyPrice: safePrice,
          supplier: safeSupplier,
          notes: safeNotes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addedCount += 1;
      }
    }

    if (data.logExpense && totalCost > 0) {
      const txDivision: CashDivision =
        divisionsUsed.size === 1 ? Array.from(divisionsUsed)[0] : 'umum';
      const txCategory =
        txDivision === 'sablon'
          ? 'Bahan Baku Sablon'
          : txDivision === 'percetakan'
            ? 'Bahan Baku Percetakan'
            : 'Belanja Bahan Baku';
      const supplierPart = safeSupplier ? ` — ${safeSupplier}` : '';
      const refPart = safeRef ? ` [${safeRef}]` : '';
      const desc = sanitizeString(
        `Belanja Bahan (${data.sourceLabel}${supplierPart}${refPart}): ${summaryNames.join(', ')}`,
        250
      );

      const txRef = doc(collection(db, 'transactions'));
      batch.set(txRef, {
        ownerId: user.uid,
        type: 'pengeluaran',
        division: txDivision,
        expenseGroup: 'bahan_baku',
        category: txCategory,
        description: desc,
        amount: Math.min(10_000_000_000, totalCost),
        paymentMethod: data.paymentMethod,
        date: validDate,
        referenceType: 'material',
        referenceId: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      const parts: string[] = [];
      if (updatedCount > 0) parts.push(`${updatedCount} stok ditambah`);
      if (addedCount > 0) parts.push(`${addedCount} bahan baru masuk`);
      if (data.logExpense && totalCost > 0) parts.push('tercatat di Buku Kas');
      notify(`Berhasil import stok: ${parts.join(', ')}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'materials/batchImport');
    }
  };

  const deleteMaterial = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'materials', id));
      notify('Bahan baku dihapus.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `materials/${id}`);
    }
  };

  const saveEmployee = async (
    data: {
      name: string;
      role: string;
      phone: string;
      payScheme: PayScheme;
      defaultRate: number;
      isActive: boolean;
    },
    editingId?: string
  ) => {
    if (!user) return;
    const fields = {
      name: sanitizeString(data.name, 120) || 'Karyawan',
      role: sanitizeString(data.role, 80) || 'Produksi',
      phone: sanitizeString(data.phone, 40),
      payScheme: data.payScheme,
      defaultRate: Math.max(0, Math.min(100_000_000, Number(data.defaultRate) || 0)),
      isActive: Boolean(data.isActive),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'employees', editingId), fields);
        notify('Data karyawan diperbarui.');
      } else {
        await addDoc(collection(db, 'employees'), {
          ownerId: user.uid,
          ...fields,
          createdAt: serverTimestamp(),
        });
        notify('Karyawan baru berhasil ditambahkan.');
      }
    } catch (err) {
      handleFirestoreError(
        err,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        editingId ? `employees/${editingId}` : 'employees'
      );
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'employees', id));
      notify('Data karyawan dihapus.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
    }
  };

  const savePayrollLog = async (
    data: {
      employeeId: string;
      employeeName: string;
      employeeRole: string;
      workDate: string;
      payType: PayrollType;
      jobDescription: string;
      quantity: number;
      unitLabel: string;
      rate: number;
      bonus: number;
      deduction: number;
      notes: string;
    },
    editingId?: string
  ) => {
    if (!user) return;
    const qty = Math.max(0.1, Math.min(1_000_000, Number(data.quantity) || 1));
    const rate = Math.max(0, Math.min(100_000_000, Number(data.rate) || 0));
    const bonus = Math.max(0, Math.min(100_000_000, Number(data.bonus) || 0));
    const deduction = Math.max(0, Math.min(100_000_000, Number(data.deduction) || 0));
    const netAmount = Math.max(0, Math.round(qty * rate + bonus - deduction));
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(data.workDate) ? data.workDate : todayISO();

    const editableFields = {
      employeeName: sanitizeString(data.employeeName, 120) || 'Karyawan',
      employeeRole: sanitizeString(data.employeeRole, 80),
      workDate: validDate,
      payType: data.payType,
      jobDescription: sanitizeString(data.jobDescription, 200) || 'Pekerjaan produksi',
      quantity: qty,
      unitLabel: sanitizeString(data.unitLabel, 30) || (data.payType === 'harian' ? 'hari' : 'pcs'),
      rate,
      bonus,
      deduction,
      netAmount,
      notes: sanitizeString(data.notes, 300),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'payrollLogs', editingId), editableFields);
        notify('Catatan kerja & gaji berhasil diperbarui.');
      } else {
        await addDoc(collection(db, 'payrollLogs'), {
          ownerId: user.uid,
          employeeId: sanitizeString(data.employeeId, 128),
          ...editableFields,
          status: 'belum_dibayar',
          paidDate: '',
          createdAt: serverTimestamp(),
        });
        notify('Catatan kerja & upah karyawan berhasil disimpan.');
      }
    } catch (err) {
      handleFirestoreError(
        err,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        editingId ? `payrollLogs/${editingId}` : 'payrollLogs'
      );
    }
  };

  const deletePayrollLog = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'payrollLogs', id));
      notify('Catatan kerja dihapus.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `payrollLogs/${id}`);
    }
  };

  const markPayrollPaidAndLogCash = async (
    logs: PayrollLog[],
    employeeName: string,
    paymentMethod: PaymentMethod,
    paidDate: string,
    logToCash: boolean,
    kasbonDeduction = 0
  ) => {
    if (!user) return;
    const unpaid = logs.filter((l) => l.status === 'belum_dibayar');
    if (unpaid.length === 0) return;

    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(paidDate) ? paidDate : todayISO();
    const grossUnpaid = unpaid.reduce((s, l) => s + (Number(l.netAmount) || 0), 0);
    const safeKasbon = Math.max(0, Math.round(Number(kasbonDeduction) || 0));
    const cashPayout = Math.max(0, grossUnpaid - safeKasbon);

    const batch = writeBatch(db);
    for (const item of unpaid) {
      batch.update(doc(db, 'payrollLogs', item.id), {
        status: 'dibayar',
        paidDate: validDate,
        updatedAt: serverTimestamp(),
      });
    }

    if (logToCash && cashPayout > 0) {
      const txRef = doc(collection(db, 'transactions'));
      batch.set(txRef, {
        ownerId: user.uid,
        type: 'pengeluaran',
        division: 'umum',
        expenseGroup: 'gaji_karyawan',
        category: 'Gaji & Upah Karyawan',
        description: sanitizeString(
          safeKasbon > 0
            ? `Pelunasan Sisa Gaji ${employeeName} (${unpaid.length} kerja, potong kasbon ${formatRp(safeKasbon)})`
            : `Pembayaran Gaji ${employeeName} (${unpaid.length} pekerjaan)`,
          250
        ),
        amount: cashPayout,
        paymentMethod,
        date: validDate,
        referenceType: 'payroll',
        referenceId: unpaid[0].employeeId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      notify(
        logToCash && cashPayout > 0
          ? safeKasbon > 0
            ? `Sisa gaji ${employeeName} (${formatRp(cashPayout)}) dicatat ke Buku Kas & ditandai LUNAS.`
            : `Gaji ${employeeName} ditandai DIBAYAR & tercatat di Buku Kas.`
          : `Gaji ${employeeName} ditandai LUNAS (terpotong kasbon).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'payrollLogs/batchPay');
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        authReady,
        loadingData,
        shopProfile,
        products,
        orders,
        transactions,
        materials,
        employees,
        payrollLogs,
        notify,
        saveShopProfile,
        saveProduct,
        deleteProduct,
        createOrder,
        updateOrder,
        recordOrderPayment,
        updateOrderProductionStatus,
        deleteOrder,
        saveTransaction,
        deleteTransaction,
        saveMaterial,
        adjustMaterialStock,
        importMaterialsFromReceipt,
        deleteMaterial,
        saveEmployee,
        deleteEmployee,
        savePayrollLog,
        deletePayrollLog,
        markPayrollPaidAndLogCash,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </WorkspaceContext.Provider>
  );
};

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
