'use client';

import { useState } from 'react';
import { Lightning, Envelope } from '@phosphor-icons/react';

interface LoginFormProps {
  type: 'admin' | 'merchant';
  redirectTo?: string;
  onSuccess?: () => void;
  locationId?: string;
}

export function LoginForm({ type, redirectTo, onSuccess, locationId }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = type === 'admin'
        ? '/api/auth/login'
        : '/api/merchant/auth/login';

      const body: Record<string, string> = { email };
      if (redirectTo) body.redirect_to = redirectTo;
      if (locationId) body.location_id = locationId;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send login link');
      }

      setSent(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center p-6 border border-[var(--border)] bg-[var(--bg-alt)]">
        <Envelope size={48} className="mx-auto mb-4 text-accent" />
        <h2 className="font-bold mb-2">check your email</h2>
        <p className="text-sm text-muted font-mono">
          we sent a magic link to
        </p>
        <p className="text-sm font-mono text-accent mt-1">{email}</p>
        <button
          onClick={() => {
            setSent(false);
            setEmail('');
          }}
          className="mt-4 text-xs text-muted hover:text-accent font-mono"
        >
          use different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-[var(--border)] p-6 bg-[var(--bg-alt)]">
      <div className="mb-4">
        <label className="block text-xs text-muted font-mono mb-1">
          email address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 bg-[var(--bg)] border border-[var(--border)] font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
          placeholder="you@example.com"
          required
          autoFocus
          autoComplete="email"
        />
      </div>

      {error && (
        <p className="mb-4 text-xs text-danger font-mono">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !email}
        className="btn btn-primary w-full justify-center disabled:opacity-50"
      >
        <Lightning size={16} weight="fill" />
        {loading ? 'sending...' : 'send magic link'}
      </button>

      <p className="mt-4 text-xs text-faint font-mono text-center">
        no password needed - we&apos;ll email you a login link
      </p>
    </form>
  );
}
