import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { CartCheckoutModal } from './pages/CartCheckoutModal';

// Pages
import { LandingPage } from './pages/LandingPage';
import { FarmerDashboard } from './pages/FarmerDashboard';
import { BuyerMarketplace } from './pages/BuyerMarketplace';
import { FairPriceEnginePage } from './pages/FairPriceEnginePage';
import { MarketExplorerPage } from './pages/MarketExplorerPage';
import { SurplusManagementPage } from './pages/SurplusManagementPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { OrdersPage } from './pages/OrdersPage';
import { AdminDashboard } from './pages/AdminDashboard';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="min-h-screen bg-[#F7F6EF] flex flex-col font-sans selection:bg-[#A7D948] selection:text-[#163D2A]">
            {/* Top Navigation */}
            <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            {/* Layout Body */}
            <div className="flex-1 flex">
              {/* Sidebar */}
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

              {/* Main Content Area */}
              <main className="flex-1 lg:pl-64 transition-all duration-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
                    <Route path="/marketplace" element={<BuyerMarketplace />} />
                    <Route path="/fair-price" element={<FairPriceEnginePage />} />
                    <Route path="/mandi-explorer" element={<MarketExplorerPage />} />
                    <Route path="/farmer/surplus" element={<SurplusManagementPage />} />
                    <Route path="/assistant" element={<AIAssistantPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/farmer/orders" element={<OrdersPage />} />
                    <Route path="/buyer/orders" element={<OrdersPage />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </div>
              </main>
            </div>

            {/* Cart & Checkout Drawer Modal */}
            <CartCheckoutModal />

            {/* Agricultural Transparency Footer */}
            <div className="lg:pl-64">
              <Footer />
            </div>
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
