'use client';

import React, { useState, useEffect } from 'react';
import { Phone } from '@/types';
import ChatContainer from '@/components/chat/ChatContainer';
import BrowseTab from '@/components/browse/BrowseTab';
import CompareTab from '@/components/comparison/CompareTab';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import {
  Smartphone,
  MessageSquare,
  Grid3X3,
  GitCompare,
  Sparkles,
  Github,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  CheckCircle,
  X,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Tab = 'chat' | 'browse' | 'compare';

interface ToastMessage {
  id: number;
  message: string;
  phoneName: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [comparePhones, setComparePhones] = useState<Phone[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleAddToCompare = (phone: Phone) => {
    setComparePhones(prev => {
      if (prev.some(p => p.id === phone.id)) {
        // Already in compare
        setToast({
          id: Date.now(),
          message: 'already in Compare tab',
          phoneName: `${phone.company_name} ${phone.model_name}`
        });
        return prev;
      }
      if (prev.length >= 4) {
        // Replacing oldest
        setToast({
          id: Date.now(),
          message: 'added to Compare tab (replaced oldest)',
          phoneName: `${phone.company_name} ${phone.model_name}`
        });
        return [...prev.slice(1), phone];
      }
      // Normal add
      setToast({
        id: Date.now(),
        message: 'added to Compare tab',
        phoneName: `${phone.company_name} ${phone.model_name}`
      });
      return [...prev, phone];
    });
  };

  const handleRemoveFromCompare = (phoneId: number) => {
    setComparePhones(prev => prev.filter(p => p.id !== phoneId));
  };

  const navItems = [
    { id: 'chat' as Tab, label: 'Chat', icon: MessageSquare },
    { id: 'browse' as Tab, label: 'Browse', icon: Grid3X3 },
    { id: 'compare' as Tab, label: 'Compare', icon: GitCompare, badge: comparePhones.length },
  ];

  return (
    <div className={cn("h-screen flex flex-col md:flex-row", darkMode ? "dark bg-gray-900" : "bg-[#FFFDF8]")}>
      {/* Left Sidebar - Hidden on mobile */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-60",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-[#FFFCF5] border-amber-100"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center gap-2 p-4 border-b", darkMode ? "border-gray-700" : "border-gray-100")}>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h1 className={cn("text-lg font-bold flex items-center gap-1 whitespace-nowrap", darkMode ? "text-white" : "text-gray-900")}>
                MobiAdvisor
                <Sparkles className="w-4 h-4 text-violet-500" />
              </h1>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === item.id
                  ? "bg-violet-50 text-violet-700"
                  : darkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer - Single row to align with bottom bar */}
        <div className={cn(
          "p-2 border-t flex items-center gap-1",
          sidebarCollapsed ? "justify-center" : "justify-between",
          darkMode ? "border-gray-700" : "border-gray-100"
        )}>
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors",
              darkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-100"
            )}
            title={darkMode ? "Light Mode" : "Dark Mode"}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {!sidebarCollapsed && <span>{darkMode ? "Light" : "Dark"}</span>}
          </button>

          {!sidebarCollapsed && (
            <div className="flex items-center gap-1">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "p-1.5 rounded-lg text-xs",
                  darkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-400 hover:bg-gray-100"
                )}
                title="GitHub"
              >
                <Github className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={cn(
                  "p-1.5 rounded-lg text-xs",
                  darkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-400 hover:bg-gray-100"
                )}
                title="Collapse"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className={cn(
                "p-1.5 rounded-lg",
                darkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-400 hover:bg-gray-100"
              )}
              title="Expand"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col min-w-0 overflow-hidden",
        isMobile && "pb-20", // Add padding for bottom nav on mobile
        darkMode ? "bg-gray-900" : "bg-[#FFFDF8]"
      )}>
        {/* Mobile Header */}
        {isMobile && (
          <header className={cn(
            "flex items-center gap-2 p-3 border-b",
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <h1 className={cn("text-lg font-bold flex items-center gap-1", darkMode ? "text-white" : "text-gray-900")}>
              MobiAdvisor
              <Sparkles className="w-4 h-4 text-violet-500" />
            </h1>
          </header>
        )}
        <ErrorBoundary>
          {activeTab === 'chat' && (
            <ChatContainer onAddToCompare={handleAddToCompare} darkMode={darkMode} />
          )}
          {activeTab === 'browse' && (
            <div className={cn("flex-1 p-2 md:p-4 overflow-hidden", darkMode ? "bg-gray-900" : "bg-[#FFFDF8]")}>
              <BrowseTab
                comparePhones={comparePhones}
                onAddToCompare={handleAddToCompare}
                onRemove={handleRemoveFromCompare}
                darkMode={darkMode}
              />
            </div>
          )}
          {activeTab === 'compare' && (
            <div className={cn("flex-1 p-2 md:p-4 overflow-hidden", darkMode ? "bg-gray-900" : "bg-[#FFFDF8]")}>
              <CompareTab
                comparePhones={comparePhones}
                onRemove={handleRemoveFromCompare}
                onAdd={handleAddToCompare}
                darkMode={darkMode}
              />
            </div>
          )}
        </ErrorBoundary>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div
          key={toast.id}
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom-5 fade-in duration-300",
            darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"
          )}
        >
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className={cn("font-medium text-sm capitalize", darkMode ? "text-white" : "text-gray-900")}>
              {toast.phoneName}
            </p>
            <p className={cn("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('compare')}
            className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
          >
            View
          </button>
          <button
            onClick={() => setToast(null)}
            className={cn(
              "p-1 rounded-lg hover:bg-gray-100 transition-colors",
              darkMode ? "hover:bg-gray-700 text-gray-400" : "text-gray-400"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className={cn(
          "fixed bottom-0 left-0 right-0 border-t flex items-center justify-around py-2 px-4 z-40",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-all relative",
                activeTab === item.id
                  ? "text-violet-600"
                  : darkMode ? "text-gray-400" : "text-gray-500"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={cn(
              "flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-all",
              darkMode ? "text-gray-400" : "text-gray-500"
            )}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="text-xs font-medium">{darkMode ? "Light" : "Dark"}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
