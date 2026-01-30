'use client';

import React from 'react';
import { Phone } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Battery,
  Camera,
  Cpu,
  HardDrive,
  Star,
  Plus,
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { formatPriceINR, generateBuyLinks } from '@/lib/utils/error-handler';
import { cn } from '@/lib/utils/cn';

interface PhoneCardProps {
  phone: Phone;
  onCompare?: (phoneId: number) => void;
  selected?: boolean;
  compact?: boolean;
  darkMode?: boolean;
}

export default function PhoneCard({
  phone,
  onCompare,
  selected = false,
  compact = false,
  darkMode = false
}: PhoneCardProps) {
  const links = generateBuyLinks(phone.company_name, phone.model_name);

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-emerald-500';
    if (rating >= 4.0) return 'text-green-500';
    if (rating >= 3.5) return 'text-amber-500';
    return 'text-red-500';
  };

  const [expanded, setExpanded] = React.useState(false);

  if (compact) {
    return (
      <Card
        className={cn(
          'transition-all cursor-pointer hover:shadow-lg',
          selected && 'ring-2 ring-violet-500',
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <CardContent className="p-4">
          {/* Compact Header */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
              darkMode ? "bg-gradient-to-br from-gray-700 to-gray-600" : "bg-gradient-to-br from-gray-100 to-gray-200"
            )}>
              <Smartphone className={cn("w-6 h-6", darkMode ? "text-gray-400" : "text-gray-500")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("font-medium capitalize text-sm leading-tight", darkMode ? "text-white" : "text-gray-900")}>
                {phone.model_name}
              </p>
              <p className={cn("text-sm capitalize", darkMode ? "text-gray-400" : "text-gray-500")}>{phone.company_name}</p>
            </div>
            <Badge variant="secondary" className="font-bold flex-shrink-0">
              {formatPriceINR(phone.price_inr)}
            </Badge>
          </div>

          {/* Expanded Details */}
          {expanded && (
            <div className={cn(
              "mt-4 pt-4 border-t space-y-3 animate-fade-in",
              darkMode ? "border-gray-700" : "border-gray-100"
            )}>
              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className={cn('flex items-center gap-1', getRatingColor(phone.user_rating))}>
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-semibold">{phone.user_rating.toFixed(1)}</span>
                </div>
                <span className={cn("text-sm", darkMode ? "text-gray-400" : "text-gray-500")}>User Rating</span>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Camera className={cn("w-4 h-4", darkMode ? "text-gray-500" : "text-gray-400")} />
                  <span className={darkMode ? "text-gray-300" : "text-gray-700"}>{phone.back_camera_mp}MP Camera</span>
                </div>
                <div className="flex items-center gap-2">
                  <Battery className={cn("w-4 h-4", darkMode ? "text-gray-500" : "text-gray-400")} />
                  <span className={darkMode ? "text-gray-300" : "text-gray-700"}>{phone.battery_mah}mAh</span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className={cn("w-4 h-4", darkMode ? "text-gray-500" : "text-gray-400")} />
                  <span className={darkMode ? "text-gray-300" : "text-gray-700"}>{phone.ram_gb}GB RAM</span>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className={cn("w-4 h-4", darkMode ? "text-gray-500" : "text-gray-400")} />
                  <span className={darkMode ? "text-gray-300" : "text-gray-700"}>{phone.memory_gb}GB Storage</span>
                </div>
              </div>

              {/* Processor */}
              <div className={cn(
                "text-sm rounded-lg px-3 py-2",
                darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-50 text-gray-600"
              )}>
                <span className="font-medium">Processor:</span> {phone.processor}
              </div>

              {/* Actions */}
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {onCompare && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCompare(phone.id)}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Compare
                  </Button>
                )}
                <a
                  href={links.amazon}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="default" size="sm" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Buy
                  </Button>
                </a>
              </div>
            </div>
          )}

          {/* Click hint */}
          {!expanded && (
            <p className={cn("text-xs mt-2 text-center", darkMode ? "text-gray-500" : "text-gray-400")}>
              Click to see details
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'overflow-hidden transition-all hover:shadow-xl',
      selected && 'ring-2 ring-violet-500',
      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'
    )}>
      {/* Header */}
      <div className={cn(
        "relative p-6",
        darkMode ? "bg-gradient-to-br from-gray-700 to-gray-600" : "bg-gradient-to-br from-gray-50 to-gray-100"
      )}>
        <div className="absolute top-3 right-3">
          <Badge className="capitalize">{phone.company_name}</Badge>
        </div>
        <div className="flex items-center justify-center h-24">
          <Smartphone className={cn("w-16 h-16", darkMode ? "text-gray-400" : "text-gray-400")} />
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Name & Price */}
        <div>
          <h3 className={cn("font-semibold capitalize line-clamp-2", darkMode ? "text-white" : "text-gray-900")}>
            {phone.model_name}
          </h3>
          <p className="text-2xl font-bold text-violet-500 mt-1">
            {formatPriceINR(phone.price_inr)}
          </p>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center gap-1', getRatingColor(phone.user_rating))}>
            <Star className="w-4 h-4 fill-current" />
            <span className="font-semibold">{phone.user_rating.toFixed(1)}</span>
          </div>
          <span className={cn("text-sm", darkMode ? "text-gray-400" : "text-gray-500")}>User Rating</span>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 gap-3">
          <SpecItem
            icon={<Camera className="w-4 h-4" />}
            label="Camera"
            value={`${phone.back_camera_mp}MP`}
            darkMode={darkMode}
          />
          <SpecItem
            icon={<Battery className="w-4 h-4" />}
            label="Battery"
            value={`${phone.battery_mah}mAh`}
            darkMode={darkMode}
          />
          <SpecItem
            icon={<Cpu className="w-4 h-4" />}
            label="RAM"
            value={`${phone.ram_gb}GB`}
            darkMode={darkMode}
          />
          <SpecItem
            icon={<HardDrive className="w-4 h-4" />}
            label="Storage"
            value={`${phone.memory_gb}GB`}
            darkMode={darkMode}
          />
        </div>

        {/* Processor */}
        <div className={cn(
          "text-sm rounded-lg px-3 py-2",
          darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-50 text-gray-600"
        )}>
          <span className="font-medium">Processor:</span> {phone.processor}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {onCompare && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCompare(phone.id)}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-1" />
              Compare
            </Button>
          )}
          <a
            href={links.amazon}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button variant="default" size="sm" className="w-full">
              <ExternalLink className="w-4 h-4 mr-1" />
              Buy
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function SpecItem({
  icon,
  label,
  value,
  darkMode = false
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  darkMode?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={darkMode ? "text-gray-500" : "text-gray-400"}>{icon}</div>
      <div>
        <p className={cn("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>{label}</p>
        <p className={cn("font-medium", darkMode ? "text-gray-200" : "text-gray-900")}>{value}</p>
      </div>
    </div>
  );
}
