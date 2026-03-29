import { AnimatePresence, motion } from 'framer-motion';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import './auth-flash.css';

export type AuthFlashPayload = {
  title?: string;
  message: string;
  variant: 'error' | 'success' | 'info';
  /** Default: 10s error/info, 5s success */
  durationMs?: number;
};

type FlashEntry = AuthFlashPayload & { id: number };

type AuthFlashContextValue = {
  showFlash: (payload: AuthFlashPayload) => void;
  dismissFlash: () => void;
};

const AuthFlashContext = createContext<AuthFlashContextValue | null>(null);

export function AuthFlashProvider({ children }: { children: ReactNode }) {
  const [flash, setFlash] = useState<FlashEntry | null>(null);
  const idRef = useRef(0);

  const dismissFlash = useCallback(() => setFlash(null), []);

  const showFlash = useCallback((payload: AuthFlashPayload) => {
    idRef.current += 1;
    setFlash({ ...payload, id: idRef.current });
  }, []);

  useEffect(() => {
    if (!flash) return;
    const defaultMs = flash.variant === 'success' ? 5200 : 11_000;
    const ms = flash.durationMs ?? defaultMs;
    const t = window.setTimeout(dismissFlash, ms);
    return () => window.clearTimeout(t);
  }, [flash, dismissFlash]);

  return (
    <AuthFlashContext.Provider value={{ showFlash, dismissFlash }}>
      {children}
      <div className="authFlash__root">
        <AnimatePresence mode="wait">
          {flash ? (
            <motion.div
              key={flash.id}
              layout
              role="alert"
              aria-live="assertive"
              className={`authFlash authFlash--${flash.variant}`}
              initial={{ opacity: 0, y: -18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              <div className="authFlash__body">
                {flash.title ? <p className="authFlash__title">{flash.title}</p> : null}
                <p className="authFlash__text">{flash.message}</p>
              </div>
              <button type="button" className="authFlash__x" onClick={dismissFlash} aria-label="Dismiss">
                ×
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </AuthFlashContext.Provider>
  );
}

export function useAuthFlash(): AuthFlashContextValue {
  const ctx = useContext(AuthFlashContext);
  if (!ctx) {
    throw new Error('useAuthFlash must be used within AuthFlashProvider');
  }
  return ctx;
}
