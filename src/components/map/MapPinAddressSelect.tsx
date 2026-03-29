import './MapPinAddressSelect.css';
import { useMapAddressPreview } from './useMapAddressPreview';

export type MapPinAddressSelectProps = {
  latitude: number;
  longitude: number;
  /** User has confirmed the current pin (parent clears this when the map centre changes). */
  locationConfirmed: boolean;
  /** Label shown after confirmation (stable while the map is still). */
  confirmedLabel: string;
  /** Called with the best available place name when the user confirms. */
  onSelectLocation: (label: string) => void;
  /** Show “Select this location” (onboarding / demands). Shop settings can hide it. */
  showSelectButton?: boolean;
  selectButtonText?: string;
  /** Visual theme for text contrast */
  variant?: 'wiz' | 'sshop' | 'dm';
  className?: string;
};

export function MapPinAddressSelect({
  latitude,
  longitude,
  locationConfirmed,
  confirmedLabel,
  onSelectLocation,
  showSelectButton = true,
  selectButtonText = 'Select this location',
  variant = 'wiz',
  className,
}: MapPinAddressSelectProps) {
  const { label, loading, lookupFailed } = useMapAddressPreview(latitude, longitude);

  const liveText = loading
    ? 'Looking up this area…'
    : lookupFailed
      ? 'Could not resolve a place name — nudge the map slightly or zoom in.'
      : label;

  const body = locationConfirmed ? confirmedLabel : liveText;
  const bodyClass =
    locationConfirmed ? 'mapPick__address mapPick__address--ok' : 'mapPick__address mapPick__address--muted';

  return (
    <div className={`mapPick mapPick--${variant} ${className ?? ''}`}>
      <div className="mapPick__row">
        <p className={bodyClass}>{body}</p>
        {showSelectButton ? (
          <button
            type="button"
            className="mapPick__btn"
            disabled={loading}
            onClick={() => {
              const trimmed = label?.trim();
              const chosen =
                trimmed && !lookupFailed ? trimmed : confirmedLabel.trim() || 'Selected map location';
              onSelectLocation(chosen);
            }}
          >
            {selectButtonText}
          </button>
        ) : null}
      </div>
      {showSelectButton && !locationConfirmed ? (
        <p className="mapPick__hint">Move the map until the pin is right, then tap {selectButtonText}.</p>
      ) : null}
      {showSelectButton && locationConfirmed ? (
        <p className="mapPick__hint">Location selected. Move the map if you need to change it — you’ll select again.</p>
      ) : null}
    </div>
  );
}
