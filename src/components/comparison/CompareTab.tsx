'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Phone } from '@/types';
import { Button } from '@/components/ui/button';
import {
    X,
    Plus,
    Search,
    Trophy,
    Smartphone,
    TrendingUp,
    Sparkles,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface CompareTabProps {
    comparePhones: Phone[];
    onRemove: (phoneId: number) => void;
    onAdd: (phone: Phone) => void;
    darkMode?: boolean;
}

const specs = [
    { key: 'price_inr', label: 'Price', format: (v: number) => `₹${v.toLocaleString('en-IN')}`, best: 'min', icon: '💰' },
    { key: 'user_rating', label: 'Rating', format: (v: number) => `${v} ⭐`, best: 'max', icon: '⭐' },
    { key: 'battery_mah', label: 'Battery', format: (v: number) => `${v} mAh`, best: 'max', icon: '🔋' },
    { key: 'back_camera_mp', label: 'Rear Camera', format: (v: number) => `${v} MP`, best: 'max', icon: '📷' },
    { key: 'front_camera_mp', label: 'Front Camera', format: (v: number) => `${v} MP`, best: 'max', icon: '🤳' },
    { key: 'ram_gb', label: 'RAM', format: (v: number) => `${v} GB`, best: 'max', icon: '💾' },
    { key: 'memory_gb', label: 'Storage', format: (v: number) => `${v} GB`, best: 'max', icon: '📁' },
    { key: 'screen_size', label: 'Screen', format: (v: number) => `${v}"`, best: 'max', icon: '📱' },
] as const;

type SpecKey = typeof specs[number]['key'];

const getPhoneValue = (phone: Phone, key: SpecKey): number => {
    switch (key) {
        case 'price_inr': return phone.price_inr;
        case 'user_rating': return phone.user_rating;
        case 'battery_mah': return phone.battery_mah;
        case 'back_camera_mp': return phone.back_camera_mp;
        case 'front_camera_mp': return phone.front_camera_mp;
        case 'ram_gb': return phone.ram_gb;
        case 'memory_gb': return phone.memory_gb;
        case 'screen_size': return phone.screen_size;
    }
};

interface CategoryWinner {
    winner: string;
    reasoning: string;
}

interface AIAnalysis {
    overall: CategoryWinner;
    gaming: CategoryWinner;
    photography: CategoryWinner;
    value: CategoryWinner;
    dailyUse: CategoryWinner;
    summary: string;
}

export default function CompareTab({ comparePhones, onRemove, onAdd, darkMode = false }: CompareTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Phone[]>([]);
    const [searching, setSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (searchQuery.length > 0) {
            const timer = setTimeout(() => searchPhones(searchQuery), 200);
            return () => clearTimeout(timer);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearch(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchPhones = async (query: string) => {
        setSearching(true);
        try {
            const res = await fetch(`/api/phones?search=${encodeURIComponent(query)}&limit=8`);
            const data = await res.json();
            setSearchResults(data.phones || []);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setSearching(false);
        }
    };

    const getBestValue = (specKey: SpecKey, best: 'min' | 'max') => {
        if (comparePhones.length === 0) return null;
        const values = comparePhones.map(p => getPhoneValue(p, specKey));
        return best === 'max' ? Math.max(...values) : Math.min(...values);
    };

    const isInCompare = (phoneId: number) =>
        comparePhones.some(p => p.id === phoneId);

    const formatPrice = (price: number) =>
        `₹${price.toLocaleString('en-IN')}`;

    // Get category winners
    const getCategoryWinners = () => {
        if (comparePhones.length < 2) return {};

        const categories: Record<string, Phone | null> = {};

        // Best Camera
        const cameraWinner = comparePhones.reduce((best, phone) =>
            phone.back_camera_mp > best.back_camera_mp ? phone : best
        );
        categories['📷 Best Camera'] = cameraWinner;

        // Best Battery
        const batteryWinner = comparePhones.reduce((best, phone) =>
            phone.battery_mah > best.battery_mah ? phone : best
        );
        categories['🔋 Best Battery'] = batteryWinner;

        // Best Value (rating/price ratio)
        const valueWinner = comparePhones.reduce((best, phone) =>
            (phone.user_rating / phone.price_inr) > (best.user_rating / best.price_inr) ? phone : best
        );
        categories['💎 Best Value'] = valueWinner;

        // Most Affordable
        const affordableWinner = comparePhones.reduce((best, phone) =>
            phone.price_inr < best.price_inr ? phone : best
        );
        categories['💰 Most Affordable'] = affordableWinner;

        return categories;
    };

    const categoryWinners = getCategoryWinners();

    // Clear AI analysis when phones change
    useEffect(() => {
        setAiAnalysis(null);
    }, [comparePhones]);

    // Get AI-powered analysis
    const getAIAnalysis = async () => {
        if (comparePhones.length < 2) return;

        setIsAnalyzing(true);
        try {
            const response = await fetch('/api/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phones: comparePhones }),
            });

            const data = await response.json();
            if (data.success && data.analysis) {
                setAiAnalysis(data.analysis);
            }
        } catch (error) {
            console.error('AI analysis error:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className={cn(
            "h-full flex flex-col rounded-xl border overflow-hidden",
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
            {/* Header */}
            <div className={cn(
                "flex-shrink-0 p-4 border-b",
                darkMode ? "border-gray-700" : "border-gray-200"
            )}>
                <div className="flex items-center justify-between mb-3">
                    <h2 className={cn("font-semibold", darkMode ? "text-white" : "text-gray-900")}>
                        Compare Phones ({comparePhones.length}/4)
                    </h2>
                </div>

                {/* Search to Add with Autocomplete */}
                <div ref={searchRef} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search and add phones to compare..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setShowSearch(true)}
                        disabled={comparePhones.length >= 4}
                        className={cn(
                            "w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50",
                            darkMode
                                ? "bg-gray-700 border-gray-600 text-white focus:bg-gray-600"
                                : "bg-gray-50 border-gray-200 focus:bg-white"
                        )}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}

                    {/* Autocomplete Dropdown */}
                    {showSearch && searchQuery && (
                        <div className={cn(
                            "absolute z-20 w-full mt-1 border rounded-xl shadow-lg max-h-60 overflow-y-auto",
                            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                        )}>
                            {searching ? (
                                <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>
                            ) : searchResults.length > 0 ? (
                                searchResults.map(phone => (
                                    <button
                                        key={phone.id}
                                        onClick={() => {
                                            if (!isInCompare(phone.id) && comparePhones.length < 4) {
                                                onAdd(phone);
                                                setSearchQuery('');
                                                setShowSearch(false);
                                            }
                                        }}
                                        disabled={isInCompare(phone.id) || comparePhones.length >= 4}
                                        className={cn(
                                            "w-full px-4 py-3 text-left flex items-center gap-3 border-b border-gray-50 last:border-0",
                                            isInCompare(phone.id) ? "opacity-50 bg-gray-50" : "hover:bg-violet-50"
                                        )}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                            <Smartphone className="w-4 h-4 text-gray-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium capitalize">{phone.model_name}</p>
                                            <p className="text-xs text-gray-500">{phone.company_name} • {formatPrice(phone.price_inr)}</p>
                                        </div>
                                        {isInCompare(phone.id) ? (
                                            <span className="text-xs text-violet-600 bg-violet-100 px-2 py-0.5 rounded">Added</span>
                                        ) : (
                                            <Plus className="w-4 h-4 text-violet-600" />
                                        )}
                                    </button>
                                ))
                            ) : (
                                <div className="p-4 text-center text-gray-500 text-sm">No phones found</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Comparison Content */}
            <div className="flex-1 overflow-auto p-4">
                {comparePhones.length === 0 ? (
                    <div className={cn("flex flex-col items-center justify-center h-full", darkMode ? "text-gray-400" : "text-gray-500")}>
                        <Smartphone className={cn("w-16 h-16 mb-3", darkMode ? "text-gray-600" : "text-gray-300")} />
                        <p className="font-medium text-lg">No phones to compare</p>
                        <p className="text-sm mt-1">Search above or add phones from Browse tab</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Phone Cards with Remove */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {comparePhones.map(phone => (
                                <div
                                    key={phone.id}
                                    className={cn(
                                        "relative p-4 rounded-xl border-2 text-center",
                                        darkMode ? "border-gray-600 bg-gray-700" : "border-gray-200 bg-white"
                                    )}
                                >
                                    <button
                                        onClick={() => onRemove(phone.id)}
                                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-md"
                                        title="Remove"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    <p className={cn("text-xs uppercase", darkMode ? "text-gray-400" : "text-gray-500")}>{phone.company_name}</p>
                                    <p className={cn("font-semibold capitalize text-sm mt-1", darkMode ? "text-white" : "text-gray-900")}>{phone.model_name}</p>
                                    <p className="text-violet-500 font-medium text-sm mt-2">{formatPrice(phone.price_inr)}</p>
                                </div>
                            ))}
                            {/* Add placeholder slots */}
                            {Array.from({ length: 4 - comparePhones.length }).map((_, i) => (
                                <div
                                    key={`empty-${i}`}
                                    className={cn(
                                        "p-4 rounded-xl border-2 border-dashed flex items-center justify-center",
                                        darkMode ? "border-gray-600 text-gray-500" : "border-gray-200 text-gray-400"
                                    )}
                                >
                                    <Plus className="w-6 h-6" />
                                </div>
                            ))}
                        </div>

                        {/* Category Winners */}
                        {comparePhones.length >= 2 && (
                            <div className={cn(
                                "rounded-xl p-4",
                                darkMode ? "bg-gradient-to-r from-gray-700 to-gray-700" : "bg-gradient-to-r from-violet-50 to-indigo-50"
                            )}>
                                <h3 className={cn("font-semibold mb-3 flex items-center gap-2", darkMode ? "text-white" : "text-gray-900")}>
                                    <TrendingUp className="w-5 h-5 text-violet-500" />
                                    Quick Verdict
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {Object.entries(categoryWinners).map(([category, phone]) => (
                                        <div key={category} className={cn(
                                            "rounded-lg p-3 shadow-sm",
                                            darkMode ? "bg-gray-600" : "bg-white"
                                        )}>
                                            <p className={cn("text-xs", darkMode ? "text-gray-300" : "text-gray-500")}>{category}</p>
                                            <p className={cn("font-medium text-sm capitalize truncate", darkMode ? "text-white" : "text-gray-900")}>{phone?.model_name}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Detailed Comparison Table */}
                        <div className={cn(
                            "overflow-x-auto rounded-xl border",
                            darkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-200"
                        )}>
                            <table className="w-full">
                                <thead>
                                    <tr className={darkMode ? "bg-gray-800" : "bg-gray-50"}>
                                        <th className={cn(
                                            "text-left p-3 text-sm font-medium sticky left-0 min-w-[140px]",
                                            darkMode ? "text-gray-200 bg-gray-800" : "text-gray-700 bg-gray-50"
                                        )}>Specification</th>
                                        {comparePhones.map(phone => (
                                            <th key={phone.id} className="p-3 text-center min-w-[140px]">
                                                <span className={cn("text-sm font-medium capitalize", darkMode ? "text-white" : "text-gray-900")}>{phone.model_name}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {specs.map(spec => {
                                        const bestValue = getBestValue(spec.key, spec.best);
                                        return (
                                            <tr key={spec.key} className={cn(
                                                "border-t",
                                                darkMode ? "border-gray-600 hover:bg-gray-600" : "border-gray-100 hover:bg-gray-50"
                                            )}>
                                                <td className={cn(
                                                    "p-3 text-sm font-medium sticky left-0",
                                                    darkMode ? "text-gray-200 bg-gray-700" : "text-gray-700 bg-white"
                                                )}>
                                                    {spec.icon} {spec.label}
                                                </td>
                                                {comparePhones.map(phone => {
                                                    const value = getPhoneValue(phone, spec.key);
                                                    const isBest = value === bestValue && comparePhones.length > 1;
                                                    return (
                                                        <td
                                                            key={phone.id}
                                                            className={cn(
                                                                "p-3 text-center text-sm",
                                                                isBest && (darkMode ? "bg-green-900/30" : "bg-green-50")
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span className={cn(
                                                                    isBest ? "font-semibold text-green-500" : "",
                                                                    !isBest && darkMode ? "text-gray-200" : ""
                                                                )}>
                                                                    {spec.format(value)}
                                                                </span>
                                                                {isBest && <Trophy className="w-4 h-4 text-green-500" />}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* AI Analysis Section */}
                        <div className={cn(
                            "rounded-xl p-4 border",
                            darkMode ? "bg-gray-700/50 border-gray-600" : "bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200"
                        )}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Sparkles className={cn("w-5 h-5", darkMode ? "text-violet-400" : "text-violet-600")} />
                                    <span className={cn("font-semibold", darkMode ? "text-white" : "text-gray-900")}>
                                        AI Analysis
                                    </span>
                                </div>
                                {!aiAnalysis && (
                                    <Button
                                        onClick={getAIAnalysis}
                                        disabled={isAnalyzing || comparePhones.length < 2}
                                        size="sm"
                                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4 mr-1" />
                                                Get AI Analysis
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>

                            {!aiAnalysis && !isAnalyzing && (
                                <p className={cn("text-sm", darkMode ? "text-gray-400" : "text-gray-500")}>
                                    Click "Get AI Analysis" for intelligent comparison based on use cases
                                </p>
                            )}

                            {aiAnalysis && (
                                <div className="space-y-3">
                                    {/* Summary */}
                                    <p className={cn("text-sm italic", darkMode ? "text-gray-300" : "text-gray-600")}>
                                        {aiAnalysis.summary}
                                    </p>

                                    {/* Category Winners */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {[
                                            { key: 'overall', icon: '🏆', label: 'Overall Winner' },
                                            { key: 'gaming', icon: '🎮', label: 'Best for Gaming' },
                                            { key: 'photography', icon: '📷', label: 'Best for Photography' },
                                            { key: 'value', icon: '💎', label: 'Best Value' },
                                            { key: 'dailyUse', icon: '📱', label: 'Best for Daily Use' },
                                        ].map(({ key, icon, label }) => {
                                            const category = aiAnalysis[key as keyof AIAnalysis] as CategoryWinner;
                                            if (!category) return null;
                                            return (
                                                <div
                                                    key={key}
                                                    className={cn(
                                                        "p-3 rounded-lg",
                                                        darkMode ? "bg-gray-600/50" : "bg-white/70",
                                                        key === 'overall' && "md:col-span-2 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span>{icon}</span>
                                                        <span className={cn("text-xs font-medium", darkMode && key !== 'overall' ? "text-gray-300" : "text-gray-600")}>
                                                            {label}
                                                        </span>
                                                    </div>
                                                    <p className={cn(
                                                        "font-semibold capitalize",
                                                        key === 'overall' ? "text-lg" : "text-sm",
                                                        darkMode && key !== 'overall' ? "text-white" : ""
                                                    )}>
                                                        {category.winner}
                                                    </p>
                                                    <p className={cn(
                                                        "text-xs mt-1",
                                                        darkMode && key !== 'overall' ? "text-gray-400" : "text-gray-500"
                                                    )}>
                                                        {category.reasoning}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Refresh Button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={getAIAnalysis}
                                        disabled={isAnalyzing}
                                        className="w-full mt-2"
                                    >
                                        {isAnalyzing ? (
                                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-4 h-4 mr-1" />
                                        )}
                                        Refresh Analysis
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
