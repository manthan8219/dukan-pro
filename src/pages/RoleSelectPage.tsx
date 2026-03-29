import { type Variants, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { patchUser } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { defaultPostLoginPath } from '../auth/postLoginRoute';
import { useAuthFlash } from '../auth/AuthFlashContext';
import { getBackendUserId, setRole } from '../auth/session';
import './RoleSelectPage.css';

const cardVariants = {
  hidden: { opacity: 0, y: 36, scale: 0.96 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.12 + i * 0.11,
      type: 'spring' as const,
      stiffness: 320,
      damping: 26,
    },
  }),
} satisfies Variants;

function IconCustomer() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M9 10h14l-1.2 12H10.2L9 10z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path d="M12 10V8a4 4 0 018 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 14h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  );
}

function IconSeller() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M6 14h20v12a2 2 0 01-2 2H8a2 2 0 01-2-2V14z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path d="M10 14V10a6 6 0 0112 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 18h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.45" />
      <circle cx="16" cy="22" r="1.5" fill="currentColor" />
    </svg>
  );
}

async function resolveBackendUserId(refresh: () => Promise<unknown>): Promise<string | null> {
  let bid = getBackendUserId();
  if (bid) return bid;
  await refresh();
  return getBackendUserId();
}

export function RoleSelectPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isNew = params.get('new') === '1';
  const { backendProfile, sessionSyncing, refreshBackendSession } = useAuth();
  const { showFlash } = useAuthFlash();
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    if (sessionSyncing || !backendProfile) return;
    if (backendProfile.role != null) {
      navigate(defaultPostLoginPath(backendProfile), { replace: true });
    }
  }, [sessionSyncing, backendProfile, navigate]);

  async function chooseCustomer() {
    if (choosing) return;
    setChoosing(true);
    try {
      const bid = await resolveBackendUserId(refreshBackendSession);
      if (!bid) {
        showFlash({
          title: 'Could not save role',
          message: 'Your account is not synced with the server yet. Check the API is running and try again.',
          variant: 'error',
        });
        return;
      }
      await patchUser(bid, { role: 'CUSTOMER' });
      setRole('customer');
      await refreshBackendSession();
      navigate('/app/customer', { replace: true });
    } catch (e) {
      showFlash({
        title: 'Could not set customer role',
        message: e instanceof Error ? e.message : 'Request failed',
        variant: 'error',
      });
    } finally {
      setChoosing(false);
    }
  }

  async function chooseSeller() {
    if (choosing) return;
    setChoosing(true);
    try {
      const bid = await resolveBackendUserId(refreshBackendSession);
      if (!bid) {
        showFlash({
          title: 'Could not save role',
          message: 'Your account is not synced with the server yet. Check the API is running and try again.',
          variant: 'error',
        });
        return;
      }
      await patchUser(bid, { role: 'SELLER' });
      setRole('seller');
      const profile = await refreshBackendSession();
      const goSellerApp = profile?.role === 'SELLER' && profile.sellerOnboardingComplete;
      navigate(goSellerApp ? '/app/seller' : '/onboarding/seller', { replace: true });
    } catch (e) {
      showFlash({
        title: 'Could not set seller role',
        message: e instanceof Error ? e.message : 'Request failed',
        variant: 'error',
      });
    } finally {
      setChoosing(false);
    }
  }

  return (
    <div className="rolePick">
      <div className="rolePick__bg" aria-hidden="true" />
      <div className="rolePick__gridPattern" aria-hidden="true" />
      <div className="rolePick__orb rolePick__orb--a" aria-hidden="true" />
      <div className="rolePick__orb rolePick__orb--b" aria-hidden="true" />

      <div className="rolePick__inner">
        <motion.header
          className="rolePick__hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }}
        >
          {isNew ? (
            <motion.span
              className="rolePick__badge"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, type: 'spring' as const, stiffness: 400, damping: 22 }}
            >
              <span className="rolePick__badgeDot" />
              You’re in
            </motion.span>
          ) : (
            <motion.span
              className="rolePick__badge"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, type: 'spring' as const, stiffness: 400, damping: 22 }}
            >
              <span className="rolePick__badgeDot" />
              Welcome back
            </motion.span>
          )}
          <h1 className="rolePick__title">
            <span className="rolePick__titleGrad">Choose your journey</span>
          </h1>
          <p className="rolePick__subtitle">
            {isNew
              ? 'Two paths — shop the neighbourhood or grow your dukaan online. Tap the card that fits you; this choice stays with your account.'
              : 'Pick how you want to use DukaanPro. For security and data integrity, you cannot switch between customer and seller later.'}
          </p>
        </motion.header>

        <div className="rolePick__cards">
          <motion.button
            type="button"
            className="rolePick__card rolePick__card--customer"
            variants={cardVariants}
            initial="hidden"
            animate="show"
            custom={0}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => void chooseCustomer()}
            disabled={choosing}
          >
            <span className="rolePick__cardShine" aria-hidden="true" />
            <span className="rolePick__cardInner">
              <div className="rolePick__cardTop">
                <span className="rolePick__iconWrap">
                  <IconCustomer />
                </span>
                <span className="rolePick__tag">Shop &amp; order</span>
              </div>
              <h2 className="rolePick__cardTitle">I’m a customer</h2>
              <p className="rolePick__cardDesc">
                Discover trusted stores, compare what’s in stock, and check out when you’re ready — all from your phone.
              </p>
              <ul className="rolePick__perks">
                <li>Browse nearby sellers</li>
                <li>Save favourites for later</li>
                <li>Fast, familiar checkout</li>
              </ul>
              <div className="rolePick__cardFooter">
                <span className="rolePick__cta">Start exploring</span>
                <span className="rolePick__ctaArrow" aria-hidden="true">
                  →
                </span>
              </div>
            </span>
          </motion.button>

          <motion.button
            type="button"
            className="rolePick__card rolePick__card--seller"
            variants={cardVariants}
            initial="hidden"
            animate="show"
            custom={1}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => void chooseSeller()}
            disabled={choosing}
          >
            <span className="rolePick__cardShine" aria-hidden="true" />
            <span className="rolePick__cardInner">
              <div className="rolePick__cardTop">
                <span className="rolePick__iconWrap">
                  <IconSeller />
                </span>
                <span className="rolePick__tag">Sell &amp; grow</span>
              </div>
              <h2 className="rolePick__cardTitle">I’m a seller</h2>
              <p className="rolePick__cardDesc">
                Put your shop on the map, show what you deal in, and reach buyers who actually live around you.
              </p>
              <ul className="rolePick__perks">
                <li>Pin your real location</li>
                <li>Show categories &amp; radius</li>
                <li>Guided shop setup</li>
              </ul>
              <div className="rolePick__cardFooter">
                <span className="rolePick__cta">Set up my shop</span>
                <span className="rolePick__ctaArrow" aria-hidden="true">
                  →
                </span>
              </div>
            </span>
          </motion.button>
        </div>

        <p className="rolePick__footerNote">DukaanPro · Your neighbourhood commerce</p>
      </div>
    </div>
  );
}
