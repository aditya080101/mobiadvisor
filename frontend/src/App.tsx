'use client';

import React, { useState } from 'react';
import type { Phone } from 'types';
import { cn } from 'lib/utils';
import { MessageCircle, Grid, Scale, Smartphone, Moon, Sun } from 'lucide-react';
import { ChatContainer } from 'components/chat';
import { BrowseTab } from 'components/browse';
import { CompareTab } from 'components/compare';

type Tab = 'chat' | 'browse' | 'compare';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'browse', label: 'Browse', icon: Grid },
    { id: 'compare', label: 'Compare', icon: Scale },
];

export default function App() {
    const [activeTab, setActiveTab] = useState<Tab>('chat');
    const [darkMode, setDarkMode] = useState(true);
    const [comparePhones, setComparePhones] = useState<Phone[]>([]);

    const handleAddToCompare = (phone: Phone) => {
        if (comparePhones.length >= 4) return;
        if (comparePhones.some((p) => p.id === phone.id)) return;
        setComparePhones((prev) => [...prev, phone]);
    };

    const handleRemoveFromCompare = (phoneId: number) => {
        setComparePhones((prev) => prev.filter((p) => p.id !== phoneId));
    };

    const handleClearCompare = () => {
        setComparePhones([]);
    };

    return (
        <div className={cn('h-screen flex flex-col', darkMode ? 'dark bg-gray-900' : 'bg-gray-50')}>
            {/* Header */}
            <header
                className={cn(
                    'flex-shrink-0 px-4 py-3 border-b flex items-center justify-between',
                    darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
            >
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                    </div>
                    <h1
                        className={cn(
                            'text-xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent'
                        )}
                    >
                        MobiAdvisor
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    {/* Compare Badge */}
                    {comparePhones.length > 0 && (
                        <button
                            onClick={() => setActiveTab('compare')}
                            className={cn(
                                'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
                                activeTab === 'compare'
                                    ? 'bg-violet-600 text-white'
                                    : darkMode
                                        ? 'bg-violet-900/40 text-violet-300 hover:bg-violet-900/60'
                                        : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                            )}
                        >
                            <Scale className="w-4 h-4" />
                            <span>{comparePhones.length}</span>
                        </button>
                    )}

                    {/* Dark Mode Toggle */}
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className={cn(
                            'p-2 rounded-lg',
                            darkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                    >
                        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                </div>
            </header>

            {/* Navigation Tabs */}
            <nav
                className={cn(
                    'flex-shrink-0 border-b flex overflow-x-auto',
                    darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
            >
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    const count = tab.id === 'compare' ? comparePhones.length : undefined;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                                isActive
                                    ? 'border-violet-500 text-violet-600'
                                    : darkMode
                                        ? 'border-transparent text-gray-400 hover:text-gray-200'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                            {count !== undefined && count > 0 && (
                                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-violet-600 text-white">
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden p-4">
                {activeTab === 'chat' && (
                    <ChatContainer
                        comparePhones={comparePhones}
                        onAddToCompare={handleAddToCompare}
                        onRemoveFromCompare={handleRemoveFromCompare}
                        darkMode={darkMode}
                    />
                )}
                {activeTab === 'browse' && (
                    <BrowseTab
                        comparePhones={comparePhones}
                        onAddToCompare={handleAddToCompare}
                        onRemove={handleRemoveFromCompare}
                        darkMode={darkMode}
                    />
                )}
                {activeTab === 'compare' && (
                    <CompareTab
                        comparePhones={comparePhones}
                        onRemove={handleRemoveFromCompare}
                        onClear={handleClearCompare}
                        darkMode={darkMode}
                    />
                )}
            </main>
        </div>
    );
}
