'use client';

import { useState, useEffect } from 'react';
import { X, Lightning, PencilSimple, SignOut, Spinner, Check } from '@phosphor-icons/react';
import { LnurlIdentity } from '@/types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  identity: LnurlIdentity | null;
  onUpdate: () => void;
  onUnlink: () => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  sessionId,
  identity,
  onUpdate,
  onUnlink,
}: ProfileModalProps) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  useEffect(() => {
    if (identity) {
      setDisplayName(identity.display_name || '');
    }
  }, [identity]);

  const handleSaveDisplayName = async () => {
    if (!sessionId) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/lnurl/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_session_id: sessionId,
          display_name: displayName.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setEditing(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!sessionId) return;

    setUnlinking(true);
    setError(null);

    try {
      const response = await fetch('/api/lnurl/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_session_id: sessionId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unlink');
      }

      onUnlink();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink');
    } finally {
      setUnlinking(false);
      setShowUnlinkConfirm(false);
    }
  };

  const handleClose = () => {
    setEditing(false);
    setError(null);
    setShowUnlinkConfirm(false);
    if (identity) {
      setDisplayName(identity.display_name || '');
    }
    onClose();
  };

  if (!isOpen || !identity) return null;

  const currentNym = identity.display_name || identity.anon_nym;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Lightning size={16} weight="fill" className="text-[var(--accent)]" />
            <span className="font-mono text-sm text-muted">your profile</span>
          </div>
          <button onClick={handleClose} className="text-muted hover:text-[var(--fg)] leading-none">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Identity display */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--accent)]/10 mb-3">
              <Lightning size={32} weight="fill" className="text-[var(--accent)]" />
            </div>
            <p className="text-lg font-mono text-[var(--fg)]">@{currentNym}</p>
            {identity.display_name && (
              <p className="text-xs text-muted font-mono mt-1">
                originally @{identity.anon_nym}
              </p>
            )}
          </div>

          {/* Display name section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted font-mono">display name</label>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-muted hover:text-[var(--fg)] font-mono flex items-center gap-1"
                >
                  <PencilSimple size={12} />
                  edit
                </button>
              )}
            </div>

            {editing ? (
              <div>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
                  placeholder={identity.anon_nym}
                  className="w-full p-2 border border-[var(--border)] bg-[var(--bg-alt)] text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none font-mono text-sm"
                  autoFocus
                />
                <p className="text-xs text-faint font-mono mt-1">
                  1-30 chars, letters, numbers, underscores
                </p>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      setEditing(false);
                      setDisplayName(identity.display_name || '');
                      setError(null);
                    }}
                    className="btn text-xs flex-1"
                  >
                    cancel
                  </button>
                  <button
                    onClick={handleSaveDisplayName}
                    disabled={saving}
                    className="btn btn-primary text-xs flex-1"
                  >
                    {saving ? 'saving...' : 'save'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm font-mono text-[var(--fg)] p-2 bg-[var(--bg-alt)] border border-[var(--border)]">
                {identity.display_name || (
                  <span className="text-muted">using @{identity.anon_nym}</span>
                )}
              </p>
            )}
          </div>

          {error && (
            <p className="mb-4 text-xs text-danger font-mono">{error}</p>
          )}

          {/* Stats placeholder */}
          <div className="border-t border-[var(--border)] pt-4 mb-4">
            <p className="text-xs text-muted font-mono mb-2">linked since</p>
            <p className="text-sm font-mono text-[var(--fg)]">
              {new Date(identity.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* Unlink section */}
          <div className="border-t border-[var(--border)] pt-4">
            {showUnlinkConfirm ? (
              <div className="bg-danger/10 p-3 border border-danger/30">
                <p className="text-xs text-danger font-mono mb-3">
                  are you sure? you&apos;ll become anonymous on this device.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowUnlinkConfirm(false)}
                    className="btn text-xs flex-1"
                    disabled={unlinking}
                  >
                    cancel
                  </button>
                  <button
                    onClick={handleUnlink}
                    disabled={unlinking}
                    className="btn text-xs flex-1 bg-danger/10 border-danger text-danger hover:bg-danger/20"
                  >
                    {unlinking ? 'unlinking...' : 'unlink'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowUnlinkConfirm(true)}
                className="w-full flex items-center justify-center gap-2 text-xs font-mono text-muted hover:text-danger transition-colors py-2"
              >
                <SignOut size={14} />
                unlink wallet from this device
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
