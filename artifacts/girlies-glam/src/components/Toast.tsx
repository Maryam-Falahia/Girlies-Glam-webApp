import React, { useEffect, useState } from 'react';

type ToastEvent = CustomEvent<{ title: string; body?: string; color?: string }>;

export function toast(title: string, body?: string, color?: string) {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { title, body, color } }));
}

interface ToastMsg {
  id: number;
  title: string;
  body?: string;
  color?: string;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => {
    let idCounter = 0;
    const handleToast = (e: Event) => {
      const ev = e as ToastEvent;
      const id = idCounter++;
      setToasts(prev => [...prev, { id, ...ev.detail }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    };

    window.addEventListener('show-toast', handleToast);
    return () => window.removeEventListener('show-toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="toast" style={{ borderColor: t.color || 'var(--p400)' }}>
          <div className="toast-title">{t.title}</div>
          {t.body && <div className="toast-body">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}
