import { AnimatePresence, type Variants, motion } from 'framer-motion';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDeliveryRadiusRule } from '../api/deliveryRadiusRule';
import { createShopForUser } from '../api/createShop';
import { attachShopContentLink } from '../api/shopContentLinks';
import { uploadFileAndRegisterContent } from '../api/uploadContent';
import {
  getBackendUserId,
  getLastShopId,
  isSellerOnboardingComplete,
  setLastShopId,
  setSellerOnboardingComplete,
} from '../auth/session';
import { GoogleMapsEmbedMapPicker } from '../components/GoogleMapsEmbedMapPicker';
import type { MapLocateEvent } from '../components/map';
import type { MapGeocodeSettledPayload } from '../components/map/MapPinAddressSelect';
import { MapPinAddressSelect } from '../components/map/MapPinAddressSelect';
import {
  FALLBACK_MAP_CENTER,
  rememberDeviceCoordinates,
  resolveDefaultMapCoordinates,
} from '../geo/deviceLocation';
import './SellerOnboardingPage.css';

type RadiusTierDraft = { id: string; minRupee: string; maxKm: string };

function newTierDraft(): RadiusTierDraft {
  return { id: crypto.randomUUID(), minRupee: '', maxKm: '' };
}

/** Indian GSTIN: 15 chars, standard format (state PAN entity Z check). */
function isValidGstin(raw: string): boolean {
  const s = raw.trim().toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s);
}

const WIZ_STEPS = [
  {
    emoji: '✨',
    short: 'Name',
    headline: 'What should we call your dukaan?',
    sub: 'Pick a name that feels friendly on the street — you can polish billing details anytime.',
    cheer: 'Love it — this is the name buyers will remember.',
    nextCta: 'Sounds great — next!',
  },
  {
    emoji: '📸',
    short: 'Glow-up',
    headline: 'Give your shop a face',
    sub: 'Drop up to 8 pics — when you launch, we upload them to your public shop bucket and save each file in your content library.',
    cheer: 'Photos make you stand out in the feed.',
    nextCta: 'Looking good — continue',
  },
  {
    emoji: '📍',
    short: 'Pin',
    headline: 'Where should we drop the pin?',
    sub: 'Use GPS or drag the map — however you roll, buyers will find you.',
    cheer: 'Perfect — neighbours can spot you now.',
    nextCta: 'Pin locked — next',
  },
  {
    emoji: '🧾',
    short: 'GST',
    headline: 'Registered under GST?',
    sub: 'If yes, enter your 15-character GSTIN. If not, choose “No” and we skip it — you can add it later in shop settings.',
    cheer: 'Tax details noted.',
    nextCta: 'Onward — what’s on the menu',
  },
  {
    emoji: '🛒',
    short: 'Stock',
    headline: 'What’s flying off your shelves?',
    sub: 'Tap categories, pick retail or wholesale, then set your usual delivery circle — that radius applies to every order unless a bigger tier kicks in on the next step.',
    cheer: 'That’s a tasty mix of categories!',
    nextCta: 'Menu’s fire — next: big orders!',
  },
  {
    emoji: '📡',
    short: 'Boost',
    headline: 'Big orders, bigger reach?',
    sub: 'Optional: when a cart crosses an amount you choose, you can serve farther — same rules the app uses at checkout time.',
    cheer: 'Sweet — loyal spenders get more love.',
    nextCta: 'Rules set — review & launch',
  },
  {
    emoji: '🚀',
    short: 'Blast off',
    headline: 'Ready to go live?',
    sub: 'One confident tap and your shop hits the server. No jargon, just momentum.',
    cheer: 'You did the hard part — launch when you’re ready.',
    nextCta: '',
  },
] as const;

const PRODUCT_PRESETS = [
  'Groceries',
  'Staples & grains',
  'Dairy & eggs',
  'Fresh produce',
  'Beverages',
  'Snacks & packaged',
  'Household',
  'Personal care',
  'Electronics',
  'Fashion & apparel',
  'Pharmacy',
  'Hardware & tools',
  'Gifts & stationery',
];

const cardSlide = {
  initial: { opacity: 0, y: 28, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: { opacity: 0, y: -18, scale: 0.98, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] as const } },
} satisfies Variants;

const heroFade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.22 } },
};

export function SellerOnboardingPage() {
  const navigate = useNavigate();
  const shopNameId = useId();
  const gstinId = useId();

  useEffect(() => {
    const sid = getLastShopId();
    if (sid && !isSellerOnboardingComplete()) {
      setSellerOnboardingComplete();
    }
    if (isSellerOnboardingComplete() && getLastShopId()) {
      navigate('/app/seller/shop', { replace: true });
    }
  }, [navigate]);

  const [step, setStep] = useState(0);
  const [shopName, setShopName] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [latitude, setLatitude] = useState(FALLBACK_MAP_CENTER.latitude);
  const [longitude, setLongitude] = useState(FALLBACK_MAP_CENTER.longitude);
  const [mapResolvedLabel, setMapResolvedLabel] = useState('');
  const [addressText, setAddressText] = useState('');
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [locAccuracyM, setLocAccuracyM] = useState<number | null>(null);
  const [mapUserMoving, setMapUserMoving] = useState(false);
  /** Ignore the next N centre updates for clearing GPS accuracy (map sync + settle). */
  const skipAccuracyResetCountRef = useRef(0);
  const mapUserMovingRef = useRef(false);
  const userGesturedMapRef = useRef(false);
  mapUserMovingRef.current = mapUserMoving;

  const onMapGeocodeSettled = useCallback((p: MapGeocodeSettledPayload) => {
    if (mapUserMovingRef.current || p.lookupFailed || !p.parts) return;
    setMapResolvedLabel(p.parts.label);
    setAddressText((prev) => {
      if (!userGesturedMapRef.current && prev.trim()) return prev;
      const bits = [p.parts!.line1, p.parts!.line2, p.parts!.city].filter((x) => x.trim());
      return bits.length ? bits.join(', ') : p.parts!.label;
    });
  }, []);
  const pinStepGeolocationDoneRef = useRef(false);
  const [shopType, setShopType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [dealIn, setDealIn] = useState<Set<string>>(() => new Set(['Groceries']));
  const [serviceRadiusKm, setServiceRadiusKm] = useState(8);
  const [radiusTiers, setRadiusTiers] = useState<RadiusTierDraft[]>([]);
  const [gstChoice, setGstChoice] = useState<'unset' | 'no' | 'yes'>('unset');
  const [gstNo, setGstNo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepMeta = WIZ_STEPS[step];
  const totalSteps = WIZ_STEPS.length;
  const progressPct = ((step + 1) / totalSteps) * 100;

  const onMapCenterChange = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    if (skipAccuracyResetCountRef.current > 0) {
      skipAccuracyResetCountRef.current -= 1;
      return;
    }
    setLocAccuracyM(null);
  }, []);

  const onMapDeviceLocation = useCallback((ev: MapLocateEvent) => {
    if (ev.kind === 'request') {
      setGeoHint('Your browser will ask for location permission — choose “Allow” to jump the map to you.');
      return;
    }
    if (ev.kind === 'success') {
      skipAccuracyResetCountRef.current = 4;
      setLatitude(ev.latitude);
      setLongitude(ev.longitude);
      rememberDeviceCoordinates(ev.latitude, ev.longitude);
      setLocAccuracyM(ev.accuracyMeters);
      setGeoHint(
        'Got it — map centred on you. Fine-tune by dragging the map if you’re not exactly at the shop counter.',
      );
      return;
    }
    skipAccuracyResetCountRef.current = 0;
    setLocAccuracyM(null);
    if (ev.code === 'unsupported') {
      setGeoHint('This browser does not expose GPS. Drag the map so the centre pin sits on your shop.');
      return;
    }
    if (ev.code === 1) {
      setGeoHint(
        'Permission denied. Click the lock/site icon in the address bar → allow location — or drag the map to your shop.',
      );
    } else if (ev.code === 2) {
      setGeoHint('Position unavailable (weak GPS or indoors). Drag the map to the correct spot.');
    } else if (ev.code === 3) {
      setGeoHint('Location timed out. Try again near a window or drag the map manually.');
    } else {
      setGeoHint('Could not read location. Drag the map so the pin is on your shop.');
    }
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    const perm = navigator.permissions?.query?.({ name: 'geolocation' });
    if (!perm) return;
    void perm.then((p) => {
      if (p.state === 'denied') {
        setGeoHint((prev) =>
          prev ??
          'Location is blocked for this site. Use the lock icon in the address bar to allow it, or drag the map.',
        );
      }
    });
  }, [step]);

  /** Default the shop pin from the device when the user opens the map step. */
  useEffect(() => {
    if (step !== 2 || pinStepGeolocationDoneRef.current) return;
    pinStepGeolocationDoneRef.current = true;
    let cancelled = false;
    void resolveDefaultMapCoordinates({ preferHighAccuracy: true }).then((p) => {
      if (cancelled) return;
      skipAccuracyResetCountRef.current = 4;
      setLatitude(p.latitude);
      setLongitude(p.longitude);
    });
    return () => {
      cancelled = true;
      pinStepGeolocationDoneRef.current = false;
    };
  }, [step]);

  function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const next = [...photoFiles, ...Array.from(files)].slice(0, 8);
    setPhotoUrls((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return next.map((f) => URL.createObjectURL(f));
    });
    setPhotoFiles(next);
  }

  function removePhoto(index: number) {
    setPhotoUrls((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return copy;
    });
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleCategory(label: string) {
    setDealIn((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function addRadiusTier() {
    if (radiusTiers.length >= 5) return;
    setRadiusTiers((prev) => [...prev, newTierDraft()]);
  }

  function removeRadiusTier(index: number) {
    setRadiusTiers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRadiusTier(index: number, patch: Partial<Pick<RadiusTierDraft, 'minRupee' | 'maxKm'>>) {
    setRadiusTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function canAdvance(): boolean {
    if (step === 0) return shopName.trim().length >= 2;
    if (step === 1) return true;
    if (step === 2) {
      return Number.isFinite(latitude) && Number.isFinite(longitude);
    }
    if (step === 3) {
      if (gstChoice === 'unset') return false;
      if (gstChoice === 'no') return true;
      return isValidGstin(gstNo);
    }
    if (step === 4) return dealIn.size >= 1;
    if (step === 5) {
      if (radiusTiers.length === 0) return true;
      return radiusTiers.every((t) => {
        const minS = t.minRupee.trim();
        const maxS = t.maxKm.trim();
        const min = Number(minS);
        const maxKm = Number(maxS);
        if (!Number.isFinite(min) || min <= 0) return false;
        if (!Number.isFinite(maxKm) || maxKm <= serviceRadiusKm) return false;
        return true;
      });
    }
    return true;
  }

  const dealInList = useMemo(() => Array.from(dealIn), [dealIn]);

  const radiusTiersSummary = useMemo(() => {
    const lines = radiusTiers
      .map((t) => {
        const min = Number(t.minRupee.trim());
        const km = Number(t.maxKm.trim());
        if (!Number.isFinite(min) || min <= 0 || !Number.isFinite(km) || km <= serviceRadiusKm) return null;
        return `≥ ₹${min} → ${km} km`;
      })
      .filter((x): x is string => x !== null);
    return lines.length > 0 ? lines.join(' · ') : 'None (default radius only)';
  }, [radiusTiers, serviceRadiusKm]);

  async function submitShop() {
    const userId = getBackendUserId();
    if (!userId) {
      setError('Your account is still syncing with the server. Wait a moment and try again.');
      setSubmitting(false);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const name = shopName.trim();
      const photoContentIds: string[] = [];
      for (const file of photoFiles) {
        try {
          const row = await uploadFileAndRegisterContent(file, {
            visibility: 'public',
            kind: 'IMAGE',
            ownerUserId: userId,
          });
          photoContentIds.push(row.id);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : 'Could not upload a shop photo. Check storage settings on the server.',
          );
          setSubmitting(false);
          return;
        }
      }

      const shop = await createShopForUser(userId, {
        name,
        displayName: name,
        billingName: `${name} (Business)`,
        location: {
          coordinates: { latitude, longitude },
          addressText: addressText.trim() || null,
        },
        offering: {
          shopType,
          dealIn: dealInList,
          serviceRadiusKm,
        },
        gst:
          gstChoice === 'yes'
            ? {
                isGstApplicable: true,
                gstNo: gstNo.trim().toUpperCase(),
              }
            : { isGstApplicable: false, gstNo: null },
        notes: null,
      });
      setLastShopId(shop.id);

      let attachWarning: string | undefined;
      for (let i = 0; i < photoContentIds.length; i++) {
        try {
          await attachShopContentLink(shop.id, photoContentIds[i], i);
        } catch (e) {
          attachWarning =
            e instanceof Error
              ? e.message
              : 'Photos uploaded but could not be linked to the shop.';
          break;
        }
      }

      setSellerOnboardingComplete();

      const tiersToPost = radiusTiers
        .map((t) => ({
          minOrderAmount: Number(t.minRupee.trim()),
          maxServiceRadiusKm: Number(t.maxKm.trim()),
        }))
        .filter(
          (t) =>
            Number.isFinite(t.minOrderAmount) &&
            t.minOrderAmount > 0 &&
            Number.isFinite(t.maxServiceRadiusKm) &&
            t.maxServiceRadiusKm > serviceRadiusKm,
        )
        .sort((a, b) => a.minOrderAmount - b.minOrderAmount);

      let tierWarning: string | undefined;
      for (const tier of tiersToPost) {
        try {
          await createDeliveryRadiusRule(shop.id, tier);
        } catch (e) {
          tierWarning =
            e instanceof Error
              ? e.message
              : 'Shop was created but one or more delivery-radius rules could not be saved.';
          break;
        }
      }

      navigate('/app/seller', {
        replace: true,
        state: {
          launched: true,
          ...(tierWarning ? { tierWarning } : {}),
          ...(attachWarning ? { attachWarning } : {}),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create shop.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wiz">
      <div className="wiz__bg" aria-hidden="true" />
      <div className="wiz__pattern" aria-hidden="true" />
      <div className="wiz__orb wiz__orb--a" aria-hidden="true" />
      <div className="wiz__orb wiz__orb--b" aria-hidden="true" />
      <div className="wiz__sparkle wiz__sparkle--1" aria-hidden="true" />
      <div className="wiz__sparkle wiz__sparkle--2" aria-hidden="true" />
      <div className="wiz__sparkle wiz__sparkle--3" aria-hidden="true" />

      <header className="wiz__header">
        <div className="wiz__brand">
          <div className="wiz__brandLeft">
            <span className="wiz__logo">D</span>
            <span className="wiz__brandText">Seller quest</span>
          </div>
          <span className="wiz__pill">Fun mode on</span>
        </div>

        <div className="wiz__progressWrap">
          <div className="wiz__progressTrack" aria-hidden="true">
            <motion.div
              className="wiz__progressFill"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 22 }}
            />
          </div>
          <div className="wiz__progressMeta">
            <span>
              Step {step + 1} / {totalSteps}
            </span>
            <span>{stepMeta.short}</span>
          </div>
          <div className="wiz__stepDots" role="list" aria-label="Jump to step">
            {WIZ_STEPS.map((s, i) => (
              <button
                key={s.short}
                type="button"
                role="listitem"
                className={`wiz__stepDot ${i === step ? 'wiz__stepDot--active' : ''} ${i < step ? 'wiz__stepDot--done' : ''}`}
                disabled={i > step}
                aria-label={`${s.short}${i < step ? ', done' : i === step ? ', current' : ''}`}
                onClick={() => {
                  if (i <= step) setStep(i);
                }}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="wiz__hero"
            variants={heroFade}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <span className="wiz__emoji" aria-hidden="true">
              {stepMeta.emoji}
            </span>
            <h2 className="wiz__headline">{stepMeta.headline}</h2>
            <p className="wiz__sub">{stepMeta.sub}</p>
            {canAdvance() ? <span className="wiz__cheer">{stepMeta.cheer}</span> : null}
          </motion.div>
        </AnimatePresence>
      </header>

      <div className="wiz__body">
        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.div
              key="s0"
              className="wiz__card"
              variants={cardSlide}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="wiz__cardInner">
                <label className="wiz__fieldLabel" htmlFor={shopNameId}>
                  Shop name
                </label>
                <input
                  id={shopNameId}
                  className="wiz__input"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Sharma General Store"
                  maxLength={200}
                  autoFocus
                />
              </div>
            </motion.div>
          ) : null}

          {step === 1 ? (
            <motion.div
              key="s1"
              className="wiz__card"
              variants={cardSlide}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="wiz__cardInner">
                <div className="wiz__fileRow">
                  <label className="wiz__fileBtn">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="wiz__fileInput"
                      onChange={(e) => addPhotos(e.target.files)}
                    />
                    ✨ Add photos
                  </label>
                </div>
                {photoUrls.length > 0 ? (
                  <motion.ul className="wiz__photoGrid" layout>
                    {photoUrls.map((url, i) => (
                      <motion.li
                        key={url}
                        className="wiz__photoCell"
                        layout
                        initial={{ opacity: 0, scale: 0.75, rotate: -4 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                      >
                        <img src={url} alt="" className="wiz__photoImg" />
                        <button
                          type="button"
                          className="wiz__photoRemove"
                          onClick={() => removePhoto(i)}
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                      </motion.li>
                    ))}
                  </motion.ul>
                ) : (
                  <div className="wiz__photoEmpty">
                    No snaps yet — totally optional, but your shop will pop with a few pics.
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}

          {step === 2 ? (
            <motion.div
              key="s2"
              className="wiz__card"
              variants={cardSlide}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="wiz__cardInner">
                <p className="wiz__geoCallout">
                  The <strong>teal pin stays in the middle</strong> — <strong>drag the map</strong> underneath it (finger or mouse).
                  Tap <strong>Use my location</strong> on the map for GPS, then zoom in for an exact doorstep.
                </p>
                <MapPinAddressSelect
                  className="wiz__mapPick"
                  variant="wiz"
                  latitude={latitude}
                  longitude={longitude}
                  mapInteracting={mapUserMoving}
                  onGeocodeSettled={onMapGeocodeSettled}
                />
                {geoHint ? <p className="wiz__hint">{geoHint}</p> : null}
                <GoogleMapsEmbedMapPicker
                  className="wiz__map"
                  latitude={latitude}
                  longitude={longitude}
                  accuracyMeters={locAccuracyM}
                  onCenterChange={onMapCenterChange}
                  useMyLocationLabel="🛰️ Use my location"
                  onDeviceLocation={onMapDeviceLocation}
                  onUserMapGestureActiveChange={(active) => {
                    setMapUserMoving(active);
                    if (active) userGesturedMapRef.current = true;
                  }}
                />
                <label className="wiz__fieldLabel" htmlFor="addr">
                  Address (optional)
                </label>
                <textarea
                  id="addr"
                  className="wiz__textarea"
                  rows={3}
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  placeholder="Famous landmark, lane, area — the juicy details"
                  maxLength={5000}
                />
              </div>
            </motion.div>
          ) : null}

          {step === 3 ? (
            <motion.div
              key="s3gst"
              className="wiz__card"
              variants={cardSlide}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="wiz__cardInner">
                <p className="wiz__fieldLabel">Is your shop registered under GST?</p>
                <div className="wiz__segmented">
                  <motion.button
                    type="button"
                    className={`wiz__seg ${gstChoice === 'no' ? 'wiz__seg--on' : ''}`}
                    onClick={() => {
                      setGstChoice('no');
                      setGstNo('');
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    No, skip
                  </motion.button>
                  <motion.button
                    type="button"
                    className={`wiz__seg ${gstChoice === 'yes' ? 'wiz__seg--on' : ''}`}
                    onClick={() => setGstChoice('yes')}
                    whileTap={{ scale: 0.97 }}
                  >
                    Yes, I have a GSTIN
                  </motion.button>
                </div>
                {gstChoice === 'yes' ? (
                  <>
                    <label className="wiz__fieldLabel" htmlFor={gstinId} style={{ marginTop: '1rem' }}>
                      GSTIN (15 characters)
                    </label>
                    <input
                      id={gstinId}
                      className="wiz__input"
                      type="text"
                      inputMode="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={15}
                      value={gstNo}
                      onChange={(e) =>
                        setGstNo(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^0-9A-Z]/g, '')
                            .slice(0, 15),
                        )
                      }
                      placeholder="e.g. 27AABCU9603R1ZX"
                    />
                    <p className="wiz__rangeHint">
                      2-digit state code + 10-character PAN + entity code + Z + check digit. Must match a valid GSTIN to
                      continue.
                    </p>
                  </>
                ) : null}
                {gstChoice === 'no' ? (
                  <p className="wiz__hint" style={{ marginTop: '0.85rem' }}>
                    No problem — you can add GST later in Shop settings. This is stored on the server when you launch.
                  </p>
                ) : null}
                {gstChoice === 'unset' ? (
                  <p className="wiz__hint" style={{ marginTop: '0.85rem' }}>
                    Pick an option above to continue.
                  </p>
                ) : null}
              </div>
            </motion.div>
          ) : null}

          {step === 4 ? (
            <motion.div
              key="s4stock"
              className="wiz__card"
              variants={cardSlide}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="wiz__cardInner">
                <p className="wiz__fieldLabel">Shop vibe</p>
                <div className="wiz__segmented">
                  <motion.button
                    type="button"
                    className={`wiz__seg ${shopType === 'RETAIL' ? 'wiz__seg--on' : ''}`}
                    onClick={() => setShopType('RETAIL')}
                    whileTap={{ scale: 0.97 }}
                  >
                    🏪 Retail
                  </motion.button>
                  <motion.button
                    type="button"
                    className={`wiz__seg ${shopType === 'WHOLESALE' ? 'wiz__seg--on' : ''}`}
                    onClick={() => setShopType('WHOLESALE')}
                    whileTap={{ scale: 0.97 }}
                  >
                    📦 Wholesale
                  </motion.button>
                </div>
                <p className="wiz__fieldLabel">Tap your categories</p>
                <div className="wiz__chips">
                  {PRODUCT_PRESETS.map((c) => (
                    <motion.button
                      key={c}
                      type="button"
                      className={`wiz__chip ${dealIn.has(c) ? 'wiz__chip--on' : ''}`}
                      onClick={() => toggleCategory(c)}
                      layout
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.92 }}
                    >
                      {dealIn.has(c) ? '✓ ' : ''}
                      {c}
                    </motion.button>
                  ))}
                </div>
                <div className="wiz__rangeWrap">
                  <p className="wiz__rangeLabel">Delivery radius: {serviceRadiusKm} km</p>
                  <input
                    id="radius"
                    type="range"
                    min={1}
                    max={80}
                    value={serviceRadiusKm}
                    onChange={(e) => setServiceRadiusKm(Number(e.target.value))}
                    className="wiz__range"
                  />
                  <p className="wiz__rangeHint">
                    This is your default radius for every order. Next step: optional “if cart is huge, I’ll go farther”
                    rules.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}

          {step === 5 ? (
            <motion.div
              key="s5tiers"
              className="wiz__card"
              variants={cardSlide}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="wiz__cardInner">
                <div className="wiz__callout">
                  <span className="wiz__calloutEmoji" aria-hidden="true">
                    💡
                  </span>
                  <div>
                    <p className="wiz__calloutTitle">How it works</p>
                    <p className="wiz__calloutText">
                      Your base radius is <strong>{serviceRadiusKm} km</strong> (saved on your shop in the database). Add
                      tiers only if you want to stretch farther when the order total crosses an amount you pick (e.g. ₹2,000
                      → 15 km). Each tier is stored as its own row linked to your shop after launch. Skip this if one
                      distance is enough.
                    </p>
                  </div>
                </div>

                {radiusTiers.length === 0 ? (
                  <p className="wiz__tierEmpty">No bonus rules yet — tap below if big carts deserve extra kilometres.</p>
                ) : (
                  <ul className="wiz__tierList">
                    {radiusTiers.map((tier, index) => (
                      <motion.li
                        key={tier.id}
                        className="wiz__tierRow"
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="wiz__tierFields">
                          <label className="wiz__tierLabel">
                            When order is at least (₹)
                            <input
                              className="wiz__tierInput"
                              inputMode="decimal"
                              placeholder="2000"
                              value={tier.minRupee}
                              onChange={(e) => updateRadiusTier(index, { minRupee: e.target.value })}
                              autoComplete="off"
                            />
                          </label>
                          <label className="wiz__tierLabel">
                            Deliver up to (km)
                            <input
                              className="wiz__tierInput"
                              inputMode="decimal"
                              placeholder={`${serviceRadiusKm + 5}`}
                              value={tier.maxKm}
                              onChange={(e) => updateRadiusTier(index, { maxKm: e.target.value })}
                              autoComplete="off"
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          className="wiz__tierRemove"
                          onClick={() => removeRadiusTier(index)}
                          aria-label="Remove this rule"
                        >
                          ✕
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                )}

                {radiusTiers.length < 5 ? (
                  <motion.button
                    type="button"
                    className="wiz__tierAdd"
                    onClick={addRadiusTier}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    + Add a bigger-radius rule
                  </motion.button>
                ) : (
                  <p className="wiz__tierCap">Five rules max — that’s plenty for v1.</p>
                )}

                <p className="wiz__tierFootnote">
                  Each “km” must be <strong>greater than {serviceRadiusKm} km</strong> (your default). When you launch, each
                  rule is saved on the server and linked to your shop for checkout and nearby-shop matching.
                </p>
              </div>
            </motion.div>
          ) : null}

          {step === 6 ? (
            <motion.div
              key="s6launch"
              className="wiz__card"
              variants={cardSlide}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="wiz__cardInner">
                <div className="wiz__launchParty">
                  <span className="wiz__launchEmoji" aria-hidden="true">
                    🎉
                  </span>
                  <h3 className="wiz__launchTitle">You’re one tap from live</h3>
                  <p className="wiz__launchSub">
                    We create your shop on the server with GST (if provided), default delivery radius on the shop record,
                    and any extra radius rules saved as separate rows. If something’s off, you can fix it in Shop settings.
                  </p>
                </div>
                <div className="wiz__summary">
                  <div className="wiz__summaryRow">
                    <span>Shop</span>
                    <strong>{shopName.trim() || '—'}</strong>
                  </div>
                  <div className="wiz__summaryRow wiz__summaryRow--block">
                    <span>GST</span>
                    <strong>
                      {gstChoice === 'yes'
                        ? gstNo.trim().toUpperCase() || '—'
                        : gstChoice === 'no'
                          ? 'Not registered'
                          : '—'}
                    </strong>
                  </div>
                  <div className="wiz__summaryRow wiz__summaryRow--block">
                    <span>Pin</span>
                    <strong>{mapResolvedLabel.trim() || addressText.trim() || '—'}</strong>
                  </div>
                  <div className="wiz__summaryRow">
                    <span>Vibe</span>
                    <strong>{shopType === 'RETAIL' ? '🏪 Retail' : '📦 Wholesale'}</strong>
                  </div>
                  <div className="wiz__summaryRow">
                    <span>Default radius</span>
                    <strong>{serviceRadiusKm} km</strong>
                  </div>
                  <div className="wiz__summaryRow wiz__summaryRow--block">
                    <span>Big-order radius rules</span>
                    <strong>{radiusTiersSummary}</strong>
                  </div>
                  <div className="wiz__summaryRow wiz__summaryRow--block">
                    <span>Categories</span>
                    <strong>{dealInList.join(', ')}</strong>
                  </div>
                  <div className="wiz__summaryRow wiz__summaryRow--block">
                    <span>Photos</span>
                    <strong>
                      {photoFiles.length > 0 ? `${photoFiles.length} ready (preview on device)` : 'Skipping for now'}
                    </strong>
                  </div>
                </div>
                {error ? (
                  <p className="wiz__error" role="alert">
                    {error}
                  </p>
                ) : null}
                <motion.button
                  type="button"
                  className="wiz__submitBtn"
                  disabled={submitting}
                  onClick={submitShop}
                  whileHover={{ scale: submitting ? 1 : 1.02 }}
                  whileTap={{ scale: submitting ? 1 : 0.98 }}
                >
                  {submitting ? 'Launching…' : '🚀 Launch my shop'}
                </motion.button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {step < totalSteps - 1 ? (
        <footer className="wiz__footer">
          <motion.button
            type="button"
            className="wiz__btn wiz__btn--ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
            whileTap={{ scale: 0.97 }}
          >
            ← Back
          </motion.button>
          <motion.button
            type="button"
            className="wiz__btn wiz__btn--primary"
            disabled={!canAdvance()}
            onClick={() => setStep((s) => s + 1)}
            whileHover={{ scale: canAdvance() ? 1.03 : 1 }}
            whileTap={{ scale: canAdvance() ? 0.97 : 1 }}
          >
            {stepMeta.nextCta}
          </motion.button>
        </footer>
      ) : (
        <footer className="wiz__footer">
          <motion.button
            type="button"
            className="wiz__btn wiz__btn--ghost"
            onClick={() => setStep((s) => s - 1)}
            whileTap={{ scale: 0.97 }}
          >
            ← Tweak something
          </motion.button>
          <span className="wiz__pill" style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
            Final step above ↑
          </span>
        </footer>
      )}
    </div>
  );
}
