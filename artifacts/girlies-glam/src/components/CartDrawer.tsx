import React from 'react';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { Product } from '@workspace/api-client-react';
import { CartLine } from '@/lib/types';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  products: Product[];
  onUpdateQty: (productId: string, size: string, qty: number) => void;
  onRemove: (productId: string, size: string) => void;
  onCheckout: () => void;
}

export function CartDrawer({ open, onClose, lines, products, onUpdateQty, onRemove, onCheckout }: CartDrawerProps) {
  if (!open) return null;

  const detailed = lines.map(l => ({ line: l, product: products.find(p => p.id === l.productId)! })).filter(x => x.product);
  const subtotal = detailed.reduce((sum, { line, product }) => sum + product.price * line.qty, 0);

  return (
    <>
      <div className="gg-cart-overlay" onClick={onClose} />
      <div className="gg-cart-drawer">
        <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '19px', color: 'var(--plum)' }}>Your Bag ({detailed.length})</div>
          <button className="gg-icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px' }}>
          {detailed.length === 0 && (
            <div className="gg-empty">
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🛍️</div>
              Your bag is feeling light. Go find something sparkly!
            </div>
          )}
          {detailed.map(({ line, product }) => (
            <div className="gg-cart-line" key={product.id + line.size}>
              <div className="gg-cart-thumb" style={{ background: `linear-gradient(155deg, ${product.swatch}, #fff)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                👗
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--plum)' }}>{product.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>Size {line.size}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px 8px' }}>
                    <button onClick={() => onUpdateQty(product.id, line.size, Math.max(1, line.qty - 1))}><Minus size={12} /></button>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{line.qty}</span>
                    <button onClick={() => onUpdateQty(product.id, line.size, line.qty + 1)}><Plus size={12} /></button>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--pink-deep)', fontSize: '13.5px' }}>${product.price * line.qty}</span>
                </div>
              </div>
              <button onClick={() => onRemove(product.id, line.size)} style={{ color: 'var(--text3)', alignSelf: 'flex-start' }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {detailed.length > 0 && (
          <div style={{ padding: '18px 22px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px', color: 'var(--text2)' }}>
              <span>Subtotal</span><span>${subtotal}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '14px' }}>Shipping & taxes calculated at checkout</div>
            <button className="gg-btn" style={{ width: '100%' }} onClick={onCheckout}>Checkout</button>
          </div>
        )}
      </div>
    </>
  );
}
