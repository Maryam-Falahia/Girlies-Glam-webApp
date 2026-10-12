import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useLogin, useRegister, getGetMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/Toast';

export function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('demo@girliesglam.com');
  const [password, setPassword] = useState('glam123');
  const [error, setError] = useState('');
  
  const queryClient = useQueryClient();
  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    
    loginMutation.mutate({ data: { email, password } }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast('Welcome back!', `Good to see you, ${data.user.name.split(' ')[0]} ✨`);
      },
      onError: (err: any) => {
        setError(err?.data?.error || 'Invalid email or password.');
      }
    });
  };

  const handleSignup = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!name.trim()) { setError('Tell us your name first!'); return; }
    
    registerMutation.mutate({ data: { name, email, password } }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast('Account created!', `Welcome to Girlies Glam, ${data.user.name.split(' ')[0]} 🎀`);
      },
      onError: (err: any) => {
        setError(err?.data?.error || 'Failed to create account.');
      }
    });
  };

  const loading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div id="gg-auth">
      <div className="gg-auth-box">
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div className="gg-logo" style={{ fontSize: '34px' }}>Girlies</div>
          <div className="gg-logo sub" style={{ fontSize: '18px', marginTop: '-6px' }}>Glam</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text2)', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Sparkles size={13} /> Feminine fashion, made to sparkle
          </div>
        </div>

        {error && <div className="gg-error-msg">{error}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <label className="gg-field-label">Email Address</label>
            <input className="gg-inp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            <label className="gg-field-label">Password</label>
            <input className="gg-inp" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            <button type="submit" className="gg-btn" style={{ width: '100%', marginTop: '4px' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="gg-auth-switch">New here? <span onClick={() => { setMode('signup'); setError(''); }}>Create an account</span></div>
            <div style={{ textAlign: 'center', fontSize: '11.5px', color: 'var(--text3)', marginTop: '10px' }}>
              Demo login: demo@girliesglam.com / glam123
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <label className="gg-field-label">Full Name</label>
            <input className="gg-inp" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Maryam Al-Falahi" required />
            <label className="gg-field-label">Email Address</label>
            <input className="gg-inp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            <label className="gg-field-label">Password</label>
            <input className="gg-inp" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password" minLength={6} required />
            <button type="submit" className="gg-btn" style={{ width: '100%', marginTop: '4px' }} disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
            <div className="gg-auth-switch">Already glam? <span onClick={() => { setMode('login'); setError(''); }}>Sign in</span></div>
          </form>
        )}
      </div>
    </div>
  );
}
