'use client';

import React from 'react';
import DOMPurify from 'dompurify';
import { Phone } from 'types';
import { cn, formatPrice } from 'lib/utils';
import { Plus, Minus } from 'lucide-react';
import { Button } from 'components/ui';

interface PhoneCardProps {
    phone: Phone;
    onCompare?: (phoneId: number) => void;
    darkMode?: boolean;
    compact?: boolean;
    isInCompare?: boolean;
}

export default function PhoneCard({
    phone,
    onCompare,
    darkMode = false,
    compact = false,
    isInCompare = false,
}: PhoneCardProps) {
    return (
        <div
            className={cn(
                'rounded-xl border transition-all',
                compact ? 'p-3' : 'p-4',
                isInCompare
                    ? darkMode
                        ? 'border-violet-400 bg-violet-900/40'
                        : 'border-violet-400 bg-violet-50'
                    : darkMode
                        ? 'border-gray-600 bg-gray-700 hover:shadow-md'
                        : 'border-gray-200 bg-white hover:shadow-md'
            )}
        >
            <div className="flex items-start justify-between mb-2">
                <div>
                    <p className={cn('text-xs uppercase', darkMode ? 'text-gray-400' : 'text-gray-500')}>
                        {phone.company_name}
                    </p>
                    <h3 className={cn('font-semibold capitalize line-clamp-1', compact ? 'text-sm' : 'text-base', darkMode ? 'text-white' : 'text-gray-900')}>
                        {phone.model_name}
                    </h3>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                    ⭐ {phone.user_rating}
                </span>
            </div>

            <div className={cn('grid grid-cols-2 gap-1 text-xs mb-3', darkMode ? 'text-gray-300' : 'text-gray-600')}>
                <div>💰 {formatPrice(phone.price_inr)}</div>
                <div>🔋 {phone.battery_mah ? `${phone.battery_mah}mAh` : 'N/A'}</div>
                <div>📷 {phone.back_camera_mp ? `${phone.back_camera_mp}MP` : 'N/A'}</div>
                <div>📱 {phone.screen_size ? `${phone.screen_size}"` : 'N/A'}</div>
                <div>🧠 {phone.ram_gb ? `${phone.ram_gb}GB RAM` : 'N/A'}</div>
                <div>💾 {phone.memory_gb ? `${phone.memory_gb}GB` : 'N/A'}</div>
            </div>

            {onCompare && (
                <Button
                    variant={isInCompare ? 'secondary' : 'outline'}
                    size="sm"
                    className="w-full"
                    onClick={() => onCompare(phone.id)}
                >
                    {isInCompare ? (
                        <>
                            <Minus className="w-4 h-4 mr-1" />
                            Remove
                        </>
                    ) : (
                        <>
                            <Plus className="w-4 h-4 mr-1" />
                            Compare
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}
