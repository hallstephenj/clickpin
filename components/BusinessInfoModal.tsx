'use client';

import { X, Lightning, MapPin, Phone, Globe, Clock, Storefront, UsersThree } from '@phosphor-icons/react';
import type { Location, LocationType } from '@/types';
import { getLocationLabel } from '@/lib/location-utils';

interface BusinessInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location;
  isClaimed: boolean;
  onClaimClick: () => void;
  showClaimButton: boolean;
}

function LocationTypeBadge({ type }: { type: LocationType }) {
  if (type === 'bitcoin_merchant') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-[#f7931a]/10 text-[#f7931a] rounded">
        <Lightning size={14} weight="fill" />
        accepts bitcoin
      </span>
    );
  }
  if (type === 'community_space') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-500/10 text-blue-500 rounded">
        <UsersThree size={14} />
        community space
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-500/10 text-gray-500 rounded">
      <Storefront size={14} />
      merchant
    </span>
  );
}

export function BusinessInfoModal({
  isOpen,
  onClose,
  location,
  isClaimed,
  onClaimClick,
  showClaimButton,
}: BusinessInfoModalProps) {
  if (!isOpen) return null;

  const locationType: LocationType = location.location_type || (location.is_bitcoin_merchant ? 'bitcoin_merchant' : 'merchant');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-sm max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] sticky top-0 bg-[#fafafa] dark:bg-[#0a0a0a]">
          <span className="font-mono text-sm text-muted">business info</span>
          <button
            onClick={onClose}
            className="text-muted hover:text-[var(--fg)] leading-none"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Name and type */}
          <div>
            <h2 className="font-bold text-lg">{location.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              {getLocationLabel(location) && (
                <span className="text-sm text-muted">{getLocationLabel(location)}</span>
              )}
              <LocationTypeBadge type={locationType} />
            </div>
            {isClaimed && (
              <span className="inline-block mt-2 text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded font-mono">
                verified business
              </span>
            )}
          </div>

          {/* Address */}
          {location.address && (
            <div className="flex gap-3">
              <MapPin size={18} className="text-muted flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-muted font-mono mb-0.5">address</div>
                <p className="text-sm">{location.address}</p>
              </div>
            </div>
          )}

          {/* Phone */}
          {location.phone && (
            <div className="flex gap-3">
              <Phone size={18} className="text-muted flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-muted font-mono mb-0.5">phone</div>
                <a href={`tel:${location.phone}`} className="text-sm text-accent hover:underline">
                  {location.phone}
                </a>
              </div>
            </div>
          )}

          {/* Website */}
          {location.website && (
            <div className="flex gap-3">
              <Globe size={18} className="text-muted flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-muted font-mono mb-0.5">website</div>
                <a
                  href={location.website.startsWith('http') ? location.website : `https://${location.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:underline break-all"
                >
                  {location.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            </div>
          )}

          {/* Opening hours */}
          {location.opening_hours && (
            <div className="flex gap-3">
              <Clock size={18} className="text-muted flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-muted font-mono mb-0.5">hours</div>
                <p className="text-sm whitespace-pre-wrap">{location.opening_hours}</p>
              </div>
            </div>
          )}

          {/* Coordinates */}
          <div className="flex gap-3">
            <MapPin size={18} className="text-muted flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-muted font-mono mb-0.5">coordinates</div>
              <p className="text-sm font-mono text-muted">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </p>
            </div>
          </div>

          {/* BTCMap link if available */}
          {location.btcmap_id && (
            <div className="pt-2 border-t border-[var(--border)]">
              <a
                href={`https://btcmap.org/merchant/${location.btcmap_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline font-mono"
              >
                view on BTCMap →
              </a>
            </div>
          )}

          {/* Claim button for unclaimed locations */}
          {showClaimButton && !isClaimed && (
            <div className="pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-muted mb-3">
                Own this business? Claim it to accept tips via Lightning, customize your welcome message, and manage your board.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onClaimClick();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-[var(--accent)] text-accent hover:bg-[var(--accent)] hover:text-black transition-colors text-sm font-mono"
              >
                <Lightning size={16} weight="fill" />
                claim this business
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
