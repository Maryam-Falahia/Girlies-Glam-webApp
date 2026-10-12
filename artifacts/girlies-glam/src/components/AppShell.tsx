import React from 'react';
import { ShoppingBag, Heart, User as UserIcon, Search } from 'lucide-react';
import { User } from '@workspace/api-client-react';
import { CATEGORIES } from '@/lib/constants';
import { useLocation } from 'wouter';

interface AppShellProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
  cartCount: number;
  wishCount: number;
  onOpenCart: () => void;
}

export function AppShell({ user, onLogout, children, cartCount, wishCount, onOpenCart }: AppShellProps) {
  const [location, setLocation] = useLocation();
  const activePage = location === '/' ? 'home' : location.split('/')[1] || 'home';

  const onNavigate = (page: string, category?: string) => {
    if (page === 'home') setLocation('/');
    else if (page === 'shop') setLocation(category ? `/shop?category=${encodeURIComponent(category)}` : '/shop');
    else setLocation(`/${page}`);
    window.scrollTo(0, 0);
  };

  return (
    <div id="app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav id="gg-nav">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', cursor: 'pointer' }} onClick={() => onNavigate('home')}>
          <span className="gg-logo" style={{ fontSize: '26px' }}>Girlies</span>
          <span className="gg-logo sub" style={{ fontSize: '15px' }}>Glam</span>
        </div>

        <div className="gg-nav-links">
          <span className={`gg-nav-link ${activePage === 'home' ? 'active' : ''}`} onClick={() => onNavigate('home')}>Home</span>
          <span className={`gg-nav-link ${activePage === 'shop' ? 'active' : ''}`} onClick={() => onNavigate('shop')}>Shop All</span>
          {CATEGORIES.map(c => (
            <span key={c.id} className="gg-nav-link" onClick={() => onNavigate('shop', c.id)}>{c.label}</span>
          ))}
        </div>

        <div className="gg-nav-icons">
          <button className="gg-icon-btn" title="Search" onClick={() => onNavigate('shop')}><Search size={19} /></button>
          <button className="gg-icon-btn" title="Wishlist" onClick={() => onNavigate('account')}>
            <Heart size={19} />
            {wishCount > 0 && <span className="gg-cart-count">{wishCount}</span>}
          </button>
          <button className="gg-icon-btn" title="Cart" onClick={onOpenCart}>
            <ShoppingBag size={19} />
            {cartCount > 0 && <span className="gg-cart-count">{cartCount}</span>}
          </button>
          <button className="gg-icon-btn" title={user.name} onClick={() => onNavigate('account')}><UserIcon size={19} /></button>
        </div>
      </nav>

      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        {children}
      </div>

      <footer id="gg-footer">
        <div className="gg-footer-grid gg-container">
          <div>
            <div className="gg-logo" style={{ fontSize: '24px', color: '#fff' }}>Girlies Glam</div>
            <p style={{ fontSize: '13px', color: '#d9b8ce', marginTop: '10px', maxWidth: '260px', lineHeight: 1.6 }}>
              Feminine fashion for everyday sparkle. New drops weekly, made to be photographed.
            </p>
          </div>
          <div>
            <div className="gg-footer-title">Shop</div>
            {CATEGORIES.map(c => (
              <span key={c.id} className="gg-footer-link" style={{ cursor: 'pointer' }} onClick={() => onNavigate('shop', c.id)}>{c.label}</span>
            ))}
          </div>
          <div>
            <div className="gg-footer-title">Help</div>
            <span className="gg-footer-link" style={{ cursor: 'pointer' }} onClick={() => onNavigate('account')}>My Orders</span>
            <span className="gg-footer-link">Shipping & Returns</span>
            <span className="gg-footer-link">Size Guide</span>
            <span className="gg-footer-link">Contact Us</span>
          </div>
          <div>
            <div className="gg-footer-title">Account</div>
            <span className="gg-footer-link" style={{ cursor: 'pointer' }} onClick={() => onNavigate('account')}>{user.name}</span>
            <span className="gg-footer-link" style={{ cursor: 'pointer' }} onClick={onLogout}>Sign Out</span>
          </div>
        </div>
        <div className="gg-footer-bottom">✨ Girlies Glam — Muscat, Oman · Made with love, glitter & good taste ✨</div>
      </footer>
    </div>
  );
}
