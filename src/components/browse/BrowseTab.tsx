'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Phone } from '@/types';
import { Button } from '@/components/ui/button';
import {
    ArrowUp,
    ArrowDown,
    Plus,
    Search,
    Smartphone,
    X,
    Minus,
    ChevronDown,
    ChevronUp,
    Check,
    Filter
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface BrowseTabProps {
    comparePhones: Phone[];
    onAddToCompare: (phone: Phone) => void;
    onRemove: (phoneId: number) => void;
    darkMode?: boolean;
}

type SortField = 'price' | 'rating' | 'battery' | 'camera' | 'ram' | 'storage';
type SortOrder = 'asc' | 'desc';

interface Filters {
    companies: string[];
    priceMin: string;
    priceMax: string;
    ramMin: string[];
    battery: string;
    rating: string;
}

const companies = ['samsung', 'apple', 'xiaomi', 'oneplus', 'vivo', 'oppo', 'realme', 'motorola'];
const ramOptions = ['4', '6', '8', '12'];
const batteryOptions = [
    { label: 'Any', value: '' },
    { label: '4000+ mAh', value: '4000' },
    { label: '5000+ mAh', value: '5000' },
    { label: '6000+ mAh', value: '6000' },
];
const ratingOptions = [
    { label: 'Any', value: '' },
    { label: '4★ & above', value: '4' },
    { label: '4.5★ & above', value: '4.5' },
];

const sortOptions: { value: SortField; label: string }[] = [
    { value: 'rating', label: 'Rating' },
    { value: 'price', label: 'Price' },
    { value: 'battery', label: 'Battery' },
    { value: 'camera', label: 'Camera' },
];

export default function BrowseTab({ comparePhones, onAddToCompare, onRemove, darkMode = false }: BrowseTabProps) {
    const [phones, setPhones] = useState<Phone[]>([]);
    const [allPhones, setAllPhones] = useState<Phone[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<SortField>('rating');
    const [order, setOrder] = useState<SortOrder>('desc');
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState<Filters>({
        companies: [],
        priceMin: '',
        priceMax: '',
        ramMin: [],
        battery: '',
        rating: '',
    });

    // Collapsible sections
    const [expandedSections, setExpandedSections] = useState({
        brand: true,
        price: true,
        ram: true,
        battery: false,
        rating: false,
    });

    // Autocomplete
    const [suggestions, setSuggestions] = useState<Phone[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => { fetchAllPhones(); }, []);
    useEffect(() => { fetchPhones(); }, [sortBy, order, search, filters]);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchAllPhones = async () => {
        try {
            const res = await fetch('/api/phones?limit=200');
            const data = await res.json();
            setAllPhones(data.phones || []);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const fetchPhones = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ sortBy, order, limit: '50', ...(search && { search }) });
            const res = await fetch(`/api/phones?${params}`);
            const data = await res.json();
            let result = data.phones || [];

            // Apply filters
            if (filters.companies.length > 0) {
                result = result.filter((p: Phone) =>
                    filters.companies.includes(p.company_name.toLowerCase())
                );
            }
            if (filters.priceMin) {
                result = result.filter((p: Phone) => p.price_inr >= parseInt(filters.priceMin));
            }
            if (filters.priceMax) {
                result = result.filter((p: Phone) => p.price_inr <= parseInt(filters.priceMax));
            }
            if (filters.ramMin.length > 0) {
                const minRam = Math.min(...filters.ramMin.map(r => parseInt(r)));
                result = result.filter((p: Phone) => p.ram_gb >= minRam);
            }
            if (filters.battery) {
                result = result.filter((p: Phone) => p.battery_mah >= parseInt(filters.battery));
            }
            if (filters.rating) {
                result = result.filter((p: Phone) => p.user_rating >= parseFloat(filters.rating));
            }

            setPhones(result);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (value.length > 0) {
            const matches = allPhones.filter(p =>
                p.model_name.toLowerCase().includes(value.toLowerCase()) ||
                p.company_name.toLowerCase().includes(value.toLowerCase())
            ).slice(0, 6);
            setSuggestions(matches);
            setShowSuggestions(matches.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const toggleCompany = (company: string) => {
        setFilters(prev => ({
            ...prev,
            companies: prev.companies.includes(company)
                ? prev.companies.filter(c => c !== company)
                : [...prev.companies, company]
        }));
    };

    const toggleRam = (ram: string) => {
        setFilters(prev => ({
            ...prev,
            ramMin: prev.ramMin.includes(ram)
                ? prev.ramMin.filter(r => r !== ram)
                : [...prev.ramMin, ram]
        }));
    };

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const clearFilters = () => {
        setFilters({ companies: [], priceMin: '', priceMax: '', ramMin: [], battery: '', rating: '' });
        setSearch('');
    };

    const hasActiveFilters = filters.companies.length > 0 || filters.priceMin || filters.priceMax ||
        filters.ramMin.length > 0 || filters.battery || filters.rating || search;
    const activeFilterCount = filters.companies.length + (filters.priceMin || filters.priceMax ? 1 : 0) +
        filters.ramMin.length + (filters.battery ? 1 : 0) + (filters.rating ? 1 : 0);

    const isInCompare = (phoneId: number) => comparePhones.some(p => p.id === phoneId);
    const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN')}`;

    return (
        <div className={cn(
            "h-full flex flex-col md:flex-row rounded-xl border overflow-hidden relative",
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
            {/* Mobile Filter Toggle Button */}
            <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className={cn(
                    "md:hidden flex items-center gap-2 px-4 py-3 border-b w-full",
                    darkMode ? "bg-gray-900 border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                )}
            >
                <Filter className="w-4 h-4" />
                <span className="font-medium text-sm">Filters</span>
                {hasActiveFilters && (
                    <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-violet-600 text-white">
                        {filters.companies.length + (filters.priceMin ? 1 : 0) + (filters.priceMax ? 1 : 0) + filters.ramMin.length + (filters.battery ? 1 : 0) + (filters.rating ? 1 : 0)}
                    </span>
                )}
                <ChevronDown className={cn("w-4 h-4 ml-auto transition-transform", showMobileFilters && "rotate-180")} />
            </button>

            {/* Mobile Filter Overlay */}
            {showMobileFilters && (
                <div
                    className="md:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setShowMobileFilters(false)}
                />
            )}

            {/* Sidebar Filters - E-commerce Style */}
            <aside className={cn(
                "w-64 flex-shrink-0 border-r overflow-y-auto z-50 transition-transform duration-300",
                // Mobile: slide-in panel
                "fixed md:relative inset-y-0 left-0",
                showMobileFilters ? "translate-x-0" : "-translate-x-full md:translate-x-0",
                darkMode ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-gray-50"
            )}>
                {/* Mobile Close Button */}
                <div className="md:hidden flex items-center justify-between p-4 border-b">
                    <h3 className={cn("font-semibold", darkMode ? "text-white" : "text-gray-900")}>Filters</h3>
                    <button
                        onClick={() => setShowMobileFilters(false)}
                        className={cn("p-1 rounded-lg", darkMode ? "hover:bg-gray-800" : "hover:bg-gray-200")}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4">
                    <div className="hidden md:flex items-center justify-between mb-4">
                        <h3 className={cn("font-semibold", darkMode ? "text-white" : "text-gray-900")}>Filters</h3>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="text-xs text-red-600 hover:underline">
                                Clear All
                            </button>
                        )}
                    </div>
                    {/* Mobile Clear Button */}
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="md:hidden w-full mb-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                        >
                            Clear All Filters
                        </button>
                    )}

                    {/* Brand Filter */}
                    <div className="mb-4">
                        <button
                            onClick={() => toggleSection('brand')}
                            className={cn(
                                "w-full flex items-center justify-between py-2 font-medium text-sm",
                                darkMode ? "text-gray-200" : "text-gray-700"
                            )}
                        >
                            Brand {filters.companies.length > 0 && <span className="text-violet-600">({filters.companies.length})</span>}
                            {expandedSections.brand ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {expandedSections.brand && (
                            <div className="space-y-1 mt-2">
                                {companies.map(company => (
                                    <label key={company} className={cn(
                                        "flex items-center gap-2 py-1 px-2 rounded cursor-pointer",
                                        darkMode ? "hover:bg-gray-800" : "hover:bg-white"
                                    )}>
                                        <input
                                            type="checkbox"
                                            checked={filters.companies.includes(company)}
                                            onChange={() => toggleCompany(company)}
                                            className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                                        />
                                        <span className={cn("text-sm capitalize", darkMode ? "text-gray-300" : "text-gray-700")}>{company}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Price Filter */}
                    <div className="mb-4">
                        <button
                            onClick={() => toggleSection('price')}
                            className={cn(
                                "w-full flex items-center justify-between py-2 font-medium text-sm",
                                darkMode ? "text-gray-200" : "text-gray-700"
                            )}
                        >
                            Price Range
                            {expandedSections.price ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {expandedSections.price && (
                            <div className="space-y-2 mt-2">
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        placeholder="Min"
                                        value={filters.priceMin}
                                        onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
                                        className={cn(
                                            "w-full px-2 py-1.5 text-sm border rounded",
                                            darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-200"
                                        )}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Max"
                                        value={filters.priceMax}
                                        onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
                                        className={cn(
                                            "w-full px-2 py-1.5 text-sm border rounded",
                                            darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-200"
                                        )}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {[
                                        { label: '<15k', min: '', max: '15000' },
                                        { label: '15-30k', min: '15000', max: '30000' },
                                        { label: '30-50k', min: '30000', max: '50000' },
                                        { label: '50k+', min: '50000', max: '' },
                                    ].map(range => (
                                        <button
                                            key={range.label}
                                            onClick={() => setFilters({ ...filters, priceMin: range.min, priceMax: range.max })}
                                            className={cn(
                                                "px-2 py-1 text-xs rounded border",
                                                filters.priceMin === range.min && filters.priceMax === range.max
                                                    ? "bg-violet-600 text-white border-violet-600"
                                                    : darkMode ? "border-gray-600 text-gray-300 hover:border-violet-400" : "border-gray-200 hover:border-violet-300"
                                            )}
                                        >
                                            {range.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RAM Filter */}
                    <div className="mb-4">
                        <button
                            onClick={() => toggleSection('ram')}
                            className={cn(
                                "w-full flex items-center justify-between py-2 font-medium text-sm",
                                darkMode ? "text-gray-200" : "text-gray-700"
                            )}
                        >
                            RAM {filters.ramMin.length > 0 && <span className="text-violet-500">({filters.ramMin.length})</span>}
                            {expandedSections.ram ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {expandedSections.ram && (
                            <div className="space-y-1 mt-2">
                                {ramOptions.map(ram => (
                                    <label key={ram} className={cn(
                                        "flex items-center gap-2 py-1 px-2 rounded cursor-pointer",
                                        darkMode ? "hover:bg-gray-800" : "hover:bg-white"
                                    )}>
                                        <input
                                            type="checkbox"
                                            checked={filters.ramMin.includes(ram)}
                                            onChange={() => toggleRam(ram)}
                                            className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                                        />
                                        <span className={cn("text-sm", darkMode ? "text-gray-300" : "text-gray-700")}>{ram} GB & above</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Battery Filter */}
                    <div className="mb-4">
                        <button
                            onClick={() => toggleSection('battery')}
                            className={cn(
                                "w-full flex items-center justify-between py-2 font-medium text-sm",
                                darkMode ? "text-gray-200" : "text-gray-700"
                            )}
                        >
                            Battery
                            {expandedSections.battery ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {expandedSections.battery && (
                            <div className="space-y-1 mt-2">
                                {batteryOptions.map(opt => (
                                    <label key={opt.value} className={cn(
                                        "flex items-center gap-2 py-1 px-2 rounded cursor-pointer",
                                        darkMode ? "hover:bg-gray-800" : "hover:bg-white"
                                    )}>
                                        <input
                                            type="radio"
                                            checked={filters.battery === opt.value}
                                            onChange={() => setFilters({ ...filters, battery: opt.value })}
                                            className="w-4 h-4 border-gray-300 text-violet-600 focus:ring-violet-500"
                                        />
                                        <span className={cn("text-sm", darkMode ? "text-gray-300" : "text-gray-700")}>{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Rating Filter */}
                    <div className="mb-4">
                        <button
                            onClick={() => toggleSection('rating')}
                            className={cn(
                                "w-full flex items-center justify-between py-2 font-medium text-sm",
                                darkMode ? "text-gray-200" : "text-gray-700"
                            )}
                        >
                            Customer Rating
                            {expandedSections.rating ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {expandedSections.rating && (
                            <div className="space-y-1 mt-2">
                                {ratingOptions.map(opt => (
                                    <label key={opt.value} className="flex items-center gap-2 py-1 px-2 hover:bg-white rounded cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={filters.rating === opt.value}
                                            onChange={() => setFilters({ ...filters, rating: opt.value })}
                                            className="w-4 h-4 border-gray-300 text-violet-600 focus:ring-violet-500"
                                        />
                                        <span className="text-sm">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <div className={cn(
                    "flex-shrink-0 p-4 border-b flex gap-4 items-center",
                    darkMode ? "border-gray-700" : "border-gray-200"
                )}>
                    {/* Search */}
                    <div ref={searchRef} className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search phones..."
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onFocus={() => search && suggestions.length > 0 && setShowSuggestions(true)}
                            className={cn(
                                "w-full pl-10 pr-8 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500",
                                darkMode
                                    ? "bg-gray-700 border-gray-600 text-white focus:bg-gray-600"
                                    : "bg-gray-50 border-gray-200 focus:bg-white"
                            )}
                        />
                        {search && (
                            <button onClick={() => { setSearch(''); setSuggestions([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        )}
                        {showSuggestions && (
                            <div className={cn(
                                "absolute z-20 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-y-auto",
                                darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                            )}>
                                {suggestions.map(phone => (
                                    <button
                                        key={phone.id}
                                        onClick={() => { setSearch(phone.model_name); setShowSuggestions(false); }}
                                        className={cn(
                                            "w-full px-4 py-2 text-left flex items-center gap-2",
                                            darkMode ? "hover:bg-gray-700" : "hover:bg-violet-50"
                                        )}
                                    >
                                        <Smartphone className={cn("w-4 h-4", darkMode ? "text-gray-500" : "text-gray-400")} />
                                        <span className={cn("text-sm capitalize", darkMode ? "text-gray-200" : "text-gray-900")}>{phone.model_name}</span>
                                        <span className={cn("text-xs", darkMode ? "text-gray-500" : "text-gray-400")}>({phone.company_name})</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sort */}
                    <div className="flex items-center gap-2">
                        <span className={cn("text-sm", darkMode ? "text-gray-400" : "text-gray-500")}>Sort:</span>
                        {sortOptions.map(opt => (
                            <Button
                                key={opt.value}
                                variant={sortBy === opt.value ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => {
                                    if (sortBy === opt.value) setOrder(order === 'asc' ? 'desc' : 'asc');
                                    else { setSortBy(opt.value); setOrder('desc'); }
                                }}
                                className={cn(
                                    "text-xs h-8",
                                    sortBy !== opt.value && darkMode && "text-gray-300 hover:text-white hover:bg-gray-700"
                                )}
                            >
                                {opt.label}
                                {sortBy === opt.value && (order === 'desc' ? <ArrowDown className="w-3 h-3 ml-1" /> : <ArrowUp className="w-3 h-3 ml-1" />)}
                            </Button>
                        ))}
                    </div>

                    {/* Results count */}
                    <span className={cn("text-sm", darkMode ? "text-gray-400" : "text-gray-500")}>{phones.length} phones</span>
                </div>

                {/* Phone Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
                        </div>
                    ) : phones.length === 0 ? (
                        <div className={cn("flex flex-col items-center justify-center h-full", darkMode ? "text-gray-400" : "text-gray-500")}>
                            <Smartphone className="w-12 h-12 mb-2" />
                            <p>No phones found</p>
                            {hasActiveFilters && <Button variant="link" onClick={clearFilters} className="mt-2">Clear filters</Button>}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {phones.map(phone => (
                                <div
                                    key={phone.id}
                                    className={cn(
                                        "p-4 rounded-xl border transition-all relative",
                                        isInCompare(phone.id)
                                            ? darkMode
                                                ? "border-violet-400 bg-violet-900/40"
                                                : "border-violet-400 bg-violet-50"
                                            : darkMode
                                                ? "border-gray-600 bg-gray-700 hover:shadow-md"
                                                : "border-gray-200 bg-white hover:shadow-md"
                                    )}
                                >
                                    {isInCompare(phone.id) && (
                                        <button
                                            onClick={() => onRemove(phone.id)}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-sm"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className={cn("text-xs uppercase", darkMode ? "text-gray-400" : "text-gray-500")}>{phone.company_name}</p>
                                            <h3 className={cn("font-semibold capitalize line-clamp-1", darkMode ? "text-white" : "text-gray-900")}>{phone.model_name}</h3>
                                        </div>
                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">⭐ {phone.user_rating}</span>
                                    </div>
                                    <div className={cn("grid grid-cols-2 gap-2 text-xs mb-3", darkMode ? "text-gray-300" : "text-gray-600")}>
                                        <div>💰 {formatPrice(phone.price_inr)}</div>
                                        <div>🔋 {phone.battery_mah}mAh</div>
                                        <div>📷 {phone.back_camera_mp}MP</div>
                                        <div>💾 {phone.ram_gb}GB / {phone.memory_gb}GB</div>
                                    </div>
                                    <Button
                                        variant={isInCompare(phone.id) ? 'secondary' : 'outline'}
                                        size="sm"
                                        className="w-full"
                                        onClick={() => isInCompare(phone.id) ? onRemove(phone.id) : onAddToCompare(phone)}
                                    >
                                        {isInCompare(phone.id) ? <><Minus className="w-4 h-4 mr-1" />Remove</> : <><Plus className="w-4 h-4 mr-1" />Compare</>}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
