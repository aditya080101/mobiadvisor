'use client';

import React, { useState, useEffect } from 'react';
import type { Phone, AIAnalysis } from 'types';
import { Button } from 'components/ui';
import { getComparisonAnalysis } from 'api/client';
import { cn, formatPrice } from 'lib/utils';
import { X, Sparkles, ExternalLink, Loader2 } from 'lucide-react';

interface CompareTabProps {
    comparePhones: Phone[];
    onRemove: (phoneId: number) => void;
    onClear: () => void;
    darkMode?: boolean;
}

export default function CompareTab({
    comparePhones,
    onRemove,
    onClear,
    darkMode = false,
}: CompareTabProps) {
    const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canGetAnalysis = comparePhones.length >= 2;

    const handleGetAnalysis = async () => {
        if (!canGetAnalysis) return;
        setLoading(true);
        setError(null);
        try {
            const data = await getComparisonAnalysis(comparePhones);
            setAnalysis(data.analysis);
        } catch (err) {
            console.error('Error:', err);
            setError('Failed to get AI analysis. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Reset analysis when phones change
    useEffect(() => {
        setAnalysis(null);
        setError(null);
    }, [comparePhones.length]);

    if (comparePhones.length === 0) {
        return (
            <div
                className={cn(
                    'flex flex-col items-center justify-center h-full rounded-xl border p-8',
                    darkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-500'
                )}
            >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className={cn('text-lg font-semibold mb-2', darkMode ? 'text-white' : 'text-gray-900')}>
                    No Phones to Compare
                </h3>
                <p className="text-sm text-center max-w-sm">
                    Add phones from the <strong>Browse</strong> or <strong>Chat</strong> tab to compare their specifications side by side.
                </p>
            </div>
        );
    }

    return (
        <div className={cn('h-full overflow-y-auto rounded-xl border', darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
            {/* Header */}
            <div className={cn('p-4 border-b flex items-center justify-between', darkMode ? 'border-gray-700' : 'border-gray-200')}>
                <h2 className={cn('font-semibold', darkMode ? 'text-white' : 'text-gray-900')}>
                    Compare ({comparePhones.length})
                </h2>
                <div className="flex gap-2">
                    {canGetAnalysis && (
                        <Button onClick={handleGetAnalysis} disabled={loading} size="sm">
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-1" />
                                    AI Analysis
                                </>
                            )}
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={onClear}>
                        Clear All
                    </Button>
                </div>
            </div>

            {/* Comparison Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className={cn('border-b', darkMode ? 'border-gray-700' : 'border-gray-200')}>
                            <th className={cn('p-3 text-left text-sm font-medium', darkMode ? 'text-gray-400' : 'text-gray-500')}>
                                Specification
                            </th>
                            {comparePhones.map((phone) => (
                                <th key={phone.id} className="p-3 min-w-[200px]">
                                    <div className="flex flex-col items-center relative">
                                        <button
                                            onClick={() => onRemove(phone.id)}
                                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                        <span className={cn('text-xs uppercase', darkMode ? 'text-gray-400' : 'text-gray-500')}>
                                            {phone.company_name}
                                        </span>
                                        <span className={cn('font-semibold capitalize text-sm', darkMode ? 'text-white' : 'text-gray-900')}>
                                            {phone.model_name}
                                        </span>
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded mt-1">
                                            ⭐ {phone.user_rating}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { label: 'Price', key: 'price_inr', format: (v: number) => v ? formatPrice(v) : 'N/A' },
                            { label: 'RAM', key: 'ram_gb', format: (v: number) => v ? `${v} GB` : 'N/A' },
                            { label: 'Storage', key: 'memory_gb', format: (v: number) => v ? `${v} GB` : 'N/A' },
                            { label: 'Battery', key: 'battery_mah', format: (v: number) => v ? `${v} mAh` : 'N/A' },
                            { label: 'Rear Camera', key: 'back_camera_mp', format: (v: number) => v ? `${v} MP` : 'N/A' },
                            { label: 'Front Camera', key: 'front_camera_mp', format: (v: number) => v ? `${v} MP` : 'N/A' },
                            { label: 'Screen Size', key: 'screen_size', format: (v: number) => v ? `${v}"` : 'N/A' },
                            { label: 'Processor', key: 'processor', format: (v: string) => v || 'N/A' },
                        ].map((spec) => (
                            <tr
                                key={spec.key}
                                className={cn('border-b', darkMode ? 'border-gray-700' : 'border-gray-100')}
                            >
                                <td className={cn('p-3 text-sm font-medium', darkMode ? 'text-gray-300' : 'text-gray-600')}>
                                    {spec.label}
                                </td>
                                {comparePhones.map((phone) => {
                                    const value = phone[spec.key as keyof Phone];
                                    return (
                                        <td
                                            key={phone.id}
                                            className={cn('p-3 text-center text-sm', darkMode ? 'text-gray-200' : 'text-gray-800')}
                                        >
                                            {spec.format(value as number & string)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {/* Buy Links */}
                        <tr>
                            <td className={cn('p-3 text-sm font-medium', darkMode ? 'text-gray-300' : 'text-gray-600')}>
                                Buy Now
                            </td>
                            {comparePhones.map((phone) => (
                                <td key={phone.id} className="p-3 text-center">
                                    <div className="flex gap-2 justify-center">
                                        <a
                                            href={`https://www.amazon.in/s?k=${encodeURIComponent(`${phone.company_name} ${phone.model_name}`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 flex items-center gap-1"
                                        >
                                            Amazon <ExternalLink className="w-3 h-3" />
                                        </a>
                                        <a
                                            href={`https://www.flipkart.com/search?q=${encodeURIComponent(`${phone.company_name} ${phone.model_name}`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
                                        >
                                            Flipkart <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* AI Analysis */}
            {error && (
                <div className={cn('p-4 m-4 rounded-lg', darkMode ? 'bg-red-900/50' : 'bg-red-50')}>
                    <p className={cn('text-sm', darkMode ? 'text-red-300' : 'text-red-600')}>{error}</p>
                </div>
            )}

            {analysis && (
                <div className={cn('p-4 border-t', darkMode ? 'border-gray-700' : 'border-gray-200')}>
                    <h3 className={cn('font-semibold mb-4 flex items-center gap-2', darkMode ? 'text-white' : 'text-gray-900')}>
                        <Sparkles className="w-5 h-5 text-violet-500" />
                        AI Analysis
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        {[
                            { label: '🏆 Overall', data: analysis.overall },
                            { label: '🎮 Gaming', data: analysis.gaming },
                            { label: '📷 Photography', data: analysis.photography },
                            { label: '💰 Value', data: analysis.value },
                            { label: '📱 Daily Use', data: analysis.dailyUse },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className={cn('p-3 rounded-lg', darkMode ? 'bg-gray-700' : 'bg-gray-50')}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={cn('text-sm font-medium', darkMode ? 'text-gray-200' : 'text-gray-700')}>
                                        {item.label}
                                    </span>
                                    <span className="text-xs font-semibold text-violet-600">{item.data?.winner || 'N/A'}</span>
                                </div>
                                <p className={cn('text-xs', darkMode ? 'text-gray-400' : 'text-gray-500')}>
                                    {item.data?.reasoning || 'No data'}
                                </p>
                            </div>
                        ))}
                    </div>
                    {analysis.summary && (
                        <div className={cn('mt-4 p-3 rounded-lg', darkMode ? 'bg-violet-900/30' : 'bg-violet-50')}>
                            <p className={cn('text-sm', darkMode ? 'text-violet-200' : 'text-violet-700')}>
                                {analysis.summary}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
