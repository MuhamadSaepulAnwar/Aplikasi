import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Calculator,
  Wallet,
  Boxes,
  Users,
  BarChart3,
  Settings,
  Plus,
  Menu,
  X,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { AuthScreen } from './components/AuthScreen';
import { ShopLogo } from './components/ShopLogo';
import { DashboardView } from './views/DashboardView';
import { OrdersView } from './views/OrdersView';
import { ProductsHppView } from './views/ProductsHppView';
import { CashLedgerView } from './views/CashLedgerView';
import { MaterialsView } from './views/MaterialsView';
import { PayrollView } from './views/PayrollView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { NavTab, OrderDraftFromHpp, TimeframeKey } from './types';

const NAV_ITEMS: { id: NavTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dasbor', shortLabel: 'Dasbor', icon: LayoutDashboard },
  { id: 'orders', label: 'Order & Nota', shortLabel: 'Order', icon: ShoppingBag },
  { id: 'products', label: 'Produk & HPP', shortLabel: 'Produk', icon: Calculator },
  { id: 'cash', label: 'Buku Kas', shortLabel: 'Kas', icon: Wallet },
  { id: 'materials', label: 'Stok Bahan', shortLabel: 'Stok', icon: Boxes },
  { id: 'payroll', label: 'Gaji Karyawan', shortLabel: 'Gaji', icon: Users },
  { id: 'reports', label: 'Laporan', shortLabel: 'Laporan', icon: BarChart3 },
  { id: 'settings', label: 'Pengaturan Toko', shortLabel: 'Toko', icon: Settings },
];

const MOBILE_MORE_TABS: NavTab[] = ['materials', 'payroll', 'reports', 'settings'];

const MainShell: React.FC = () => {
  const { user, authReady, shopProfile, materials } = useWorkspace();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [timeframe, setTimeframe] = useState<TimeframeKey>('6m');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orderTrigger, setOrderTrigger] = useState(0);
  const [draftFromHpp, setDraftFromHpp] = useState<OrderDraftFromHpp | null>(null);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#232C3D] border-t-sky-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const lowStockCount = materials.filter((m) => m.stock <= m.minStock).length;
  const currentNavMeta = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  const handleOpenQuickOrder = () => {
    setActiveTab('orders');
    setOrderTrigger((c) => c + 1);
  };

  const handleSendDraftToOrder = (draft: OrderDraftFromHpp) => {
    setDraftFromHpp(draft);
    setActiveTab('orders');
  };

  const handleNavigate = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const accentColor = shopProfile.accentColor || '#0EA5E9';

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F8FAFC] flex">
      {/* Desktop Fixed Sidebar (256px) */}
      <aside className="no-print hidden lg:flex lg:flex-col w-64 shrink-0 bg-[#121824] border-r border-[#232C3D] fixed inset-y-0 left-0 z-30">
        {/* White-Label Brand Lockup */}
        <div className="h-16 px-5 border-b border-[#232C3D] flex items-center gap-3">
          <ShopLogo
            logoDataUrl={shopProfile.logoDataUrl}
            shopName={shopProfile.shopName}
            accentColor={accentColor}
            size="sm"
          />
          <span className="font-bold text-sm tracking-tight text-[#F8FAFC] truncate">
            {shopProfile.shopName}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full min-h-[42px] px-3.5 py-2 rounded-lg text-sm font-medium flex items-center justify-between gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#182030] text-[#F8FAFC] font-semibold'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#182030]/50'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-400' : 'text-[#64748B]'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'materials' && lowStockCount > 0 && (
                  <span className="text-xs font-mono font-bold text-amber-400 tabular-nums">
                    {lowStockCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Account Info */}
        <div className="p-4 border-t border-[#232C3D] text-xs">
          <div className="font-semibold text-[#F8FAFC] truncate">
            {shopProfile.ownerName || user.displayName || 'Pemilik Usaha'}
          </div>
          <div className="text-[#64748B] truncate mt-0.5">{user.email}</div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Desktop Top Header (Clean Single-Row Contract) */}
        <header className="no-print hidden lg:flex h-16 px-8 border-b border-[#232C3D] bg-[#0B0F17]/95 backdrop-blur-md sticky top-0 z-20 items-center justify-between gap-8">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-[#94A3B8] truncate">{shopProfile.shopName}</span>
            <span className="text-[#475569]" aria-hidden="true">
              /
            </span>
            <span className="font-bold text-[#F8FAFC] whitespace-nowrap">
              {currentNavMeta.label}
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenQuickOrder}
            className="min-h-[40px] px-4 py-2 rounded-lg text-slate-950 font-bold text-xs inline-flex items-center gap-2 transition-opacity hover:opacity-90 whitespace-nowrap shrink-0 cursor-pointer"
            style={{ backgroundColor: accentColor }}
          >
            <Plus className="w-4 h-4" />
            Order Baru
          </button>
        </header>

        {/* Mobile Compact Top App Bar (52px) */}
        <header className="no-print lg:hidden h-[52px] px-4 border-b border-[#232C3D] bg-[#121824]/95 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShopLogo
              logoDataUrl={shopProfile.logoDataUrl}
              shopName={shopProfile.shopName}
              accentColor={accentColor}
              size="sm"
            />
            <span className="text-sm font-bold text-[#F8FAFC] truncate">
              {activeTab === 'dashboard' ? shopProfile.shopName : currentNavMeta.label}
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenQuickOrder}
            className="min-h-[36px] px-3 py-1.5 rounded-lg text-slate-950 font-bold text-xs inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            style={{ backgroundColor: accentColor }}
          >
            <Plus className="w-3.5 h-3.5" />
            Order
          </button>
        </header>

        {/* Viewport Workspace Content */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-7 pb-24 lg:pb-10">
          {activeTab === 'dashboard' && (
            <DashboardView
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              onNavigate={handleNavigate}
              onOpenQuickOrder={handleOpenQuickOrder}
            />
          )}
          {activeTab === 'orders' && (
            <OrdersView
              openNewTrigger={orderTrigger}
              draftFromHpp={draftFromHpp}
              onConsumeDraft={() => setDraftFromHpp(null)}
            />
          )}
          {activeTab === 'products' && (
            <ProductsHppView onSendDraftToOrder={handleSendDraftToOrder} />
          )}
          {activeTab === 'cash' && <CashLedgerView />}
          {activeTab === 'materials' && <MaterialsView />}
          {activeTab === 'payroll' && <PayrollView />}
          {activeTab === 'reports' && (
            <ReportsView timeframe={timeframe} onTimeframeChange={setTimeframe} />
          )}
          {activeTab === 'settings' && <SettingsView />}
        </main>

        {/* Mobile Fixed Bottom Navigation Bar (5 Ergonomic Thumb Tabs) */}
        <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121824]/95 backdrop-blur-md border-t border-[#232C3D] pb-safe">
          <div className="grid grid-cols-5 h-16 items-center">
            {(['dashboard', 'orders', 'products', 'cash'] as NavTab[]).map((tabId) => {
              const item = NAV_ITEMS.find((n) => n.id === tabId)!;
              const Icon = item.icon;
              const isActive = activeTab === tabId && !mobileMenuOpen;
              return (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => handleNavigate(tabId)}
                  className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors ${
                    isActive ? 'text-sky-400' : 'text-[#94A3B8]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium tracking-tight leading-none">
                    {item.shortLabel}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors ${
                mobileMenuOpen || MOBILE_MORE_TABS.includes(activeTab)
                  ? 'text-sky-400'
                  : 'text-[#94A3B8]'
              }`}
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight leading-none">Lainnya</span>
            </button>
          </div>
        </nav>

        {/* Mobile Bottom Sheet Drawer for Secondary Modules */}
        {mobileMenuOpen && (
          <div
            className="no-print lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="w-full bg-[#121824] border-t border-[#232C3D] rounded-t-3xl p-5 pb-8 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1.5 rounded-full bg-[#334155] mx-auto" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#F8FAFC]">Menu Operasional</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Tutup menu"
                  className="min-h-[40px] min-w-[40px] rounded-lg hover:bg-[#182030] text-[#94A3B8] inline-flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {MOBILE_MORE_TABS.map((tabId) => {
                  const item = NAV_ITEMS.find((n) => n.id === tabId)!;
                  const Icon = item.icon;
                  const isActive = activeTab === tabId;
                  return (
                    <button
                      key={tabId}
                      type="button"
                      onClick={() => handleNavigate(tabId)}
                      className={`min-h-[56px] p-3.5 rounded-xl border text-left flex items-center gap-3 transition-colors ${
                        isActive
                          ? 'bg-[#182030] border-sky-500/50 text-[#F8FAFC]'
                          : 'bg-[#0B0F17] border-[#232C3D] text-[#94A3B8]'
                      }`}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-sky-400' : ''}`} />
                      <span className="text-xs font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <MainShell />
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}
