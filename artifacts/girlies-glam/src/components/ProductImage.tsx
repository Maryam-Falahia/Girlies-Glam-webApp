import React from 'react';
import { Sparkles } from 'lucide-react';
import { Product } from '@/lib/data';

const CATEGORY_ICON: Record<string, string> = {
  'Cotton Makhwar': '🧵',
  'Italy Silk Makhwar': '✨',
  'Digital Cotton Liberty': '🌸',
  'Cotton Amoudi Makhwar': '♡',
};

export function ProductImage({ product, className = '', children }: { product: Product; className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={`gg-card-img ${className}`}
      style={{ background: `linear-gradient(155deg, ${product.swatch} 0%, #ffffff 130%)` }}
    >
      <span style={{ fontSize: '54px', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.12))' }}>
        {CATEGORY_ICON[product.category] || '✨'}
      </span>
      <Sparkles size={16} style={{ position: 'absolute', top: '14px', left: '14px', color: 'rgba(255,255,255,0.8)', zIndex: 1 }} />
      {children}
    </div>
  );
}
