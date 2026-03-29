import type { ConfirmationResult } from 'firebase/auth';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { useAuth } from '../auth/AuthContext';
import { defaultPostLoginPath } from '../auth/postLoginRoute';
import { useAuthFlash } from '../auth/AuthFlashContext';
import {
  firebaseErrorCode,
  formatEmailAuthError,
  formatGoogleAuthError,
  formatPhoneAuthError,
} from '../firebase/authErrors';
import { getMissingFirebaseAuthEnvKeys } from '../firebase/config';
import { firebaseSendPasswordReset, firebaseSignInWithEmail } from '../firebase/emailAuth';
import { createInvisibleRecaptcha, normalizeToE164, requestPhoneOtp } from '../firebase/phoneAuth';
import { AuthLayout } from '../layouts/AuthLayout';
import './LoginPage.css';

type LocationState = { from?: string; needFirebase?: boolean };
type AuthTab = 'email' | 'phone' | 'google';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const { user, loading, firebaseConfigured, signInWithGoogle, sessionSyncing, backendProfile, sessionError } =
    useAuth();
  const { showFlash } = useAuthFlash();

  const emailId = useId();
  const passwordId = useId();
  const phoneId = useId();
  const otpId = useId();

  const [tab, setTab] = useState<AuthTab>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);

  const recaptchaVerifierRef = useRef<ReturnType<typeof createInvisibleRecaptcha> | null>(null);

  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    if (loading || !user || sessionSyncing) return;
    if (sessionError) {
      showFlash({ title: 'Could not sync your account', message: sessionError, variant: 'error' });
      navigate('/welcome/role', { replace: true });
      return;
    }
    if (!backendProfile) return;
    const from = state?.from;
    if (typeof from === 'string' && from.startsWith('/')) {
      navigate(from, { replace: true });
      return;
    }
    navigate(defaultPostLoginPath(backendProfile), { replace: true });
  }, [loading, user, sessionSyncing, sessionError, backendProfile, navigate, state?.from, showFlash]);

  useEffect(() => {
    return () => {
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (tab !== 'phone') {
      setPhoneConfirmation(null);
      setOtp('');
    }
  }, [tab]);

  const busy = status === 'loading';

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      await firebaseSignInWithEmail(email, password);
      setStatus('idle');
    } catch (err: unknown) {
      setStatus('error');
      const { title, message } = formatEmailAuthError(firebaseErrorCode(err), 'signin');
      showFlash({ title, message, variant: 'error' });
    }
  }

  async function onForgotPassword() {
    if (!email.trim()) {
      showFlash({
        title: 'Email needed',
        message: 'Enter your email in the field above, then tap Forgot password again.',
        variant: 'info',
        durationMs: 7000,
      });
      return;
    }
    setStatus('loading');
    try {
      await firebaseSendPasswordReset(email);
      setStatus('idle');
      showFlash({
        title: 'Check your email',
        message:
          'If an account exists for that address, Firebase sent a reset link. Open it on this device and choose a new password.',
        variant: 'success',
        durationMs: 9000,
      });
    } catch (err: unknown) {
      setStatus('error');
      const { title, message } = formatEmailAuthError(firebaseErrorCode(err), 'reset');
      showFlash({ title, message, variant: 'error' });
    }
  }

  async function onSendPhoneCode() {
    setStatus('loading');
    recaptchaVerifierRef.current?.clear();
    recaptchaVerifierRef.current = null;
    try {
      const verifier = createInvisibleRecaptcha('login-recaptcha');
      recaptchaVerifierRef.current = verifier;
      const e164 = normalizeToE164(phone);
      const cr = await requestPhoneOtp(e164, verifier);
      setPhoneConfirmation(cr);
      setStatus('idle');
      showFlash({
        title: 'Code sent',
        message: 'We texted you a verification code. Enter it below to finish signing in.',
        variant: 'success',
        durationMs: 5500,
      });
    } catch (err: unknown) {
      setStatus('error');
      const { title, message } = formatPhoneAuthError(firebaseErrorCode(err));
      showFlash({ title, message, variant: 'error' });
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
    }
  }

  async function onVerifyPhoneOtp() {
    if (!phoneConfirmation) return;
    setStatus('loading');
    try {
      await phoneConfirmation.confirm(otp.trim());
      setStatus('idle');
    } catch (err: unknown) {
      setStatus('error');
      const { title, message } = formatPhoneAuthError(firebaseErrorCode(err));
      showFlash({ title, message, variant: 'error' });
    }
  }

  async function onGoogleClick() {
    setStatus('loading');
    try {
      await signInWithGoogle();
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      const { title, message } = formatGoogleAuthError(e);
      showFlash({ title, message, variant: 'error' });
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with email & password, phone OTP, or Google — all powered by Firebase."
      footer={
        <>
          <span className="login__footerLead">New here?</span>{' '}
          <Link to="/signup" className="login__inlineLink">
            Create an account
          </Link>
        </>
      }
    >
      {!firebaseConfigured ? (
        <div className="login__banner login__banner--error" role="alert">
          <strong>Firebase is not configured.</strong> Add{' '}
          <code className="login__code">VITE_FIREBASE_*</code> keys to <code className="login__code">.env</code> and restart
          Vite. In Firebase Console enable <strong>Email/Password</strong>, <strong>Phone</strong>, and <strong>Google</strong>{' '}
          under Authentication → Sign-in method.
        </div>
      ) : null}

      {state?.needFirebase ? (
        <p className="login__banner login__banner--error" role="status">
          <strong>Firebase env vars are not loaded in this run.</strong> You were sent here from a protected page because the
          app could not read all required <code className="login__code">VITE_FIREBASE_*</code> variables.
          {getMissingFirebaseAuthEnvKeys().length > 0 ? (
            <>
              {' '}
              Missing or empty:{' '}
              <code className="login__code">{getMissingFirebaseAuthEnvKeys().join(', ')}</code>.
            </>
          ) : null}{' '}
          Put them in <code className="login__code">frontend/.env.local</code> (or <code className="login__code">.env</code>),
          then <strong>stop and restart</strong> <code className="login__code">npm run dev</code>. For production, set the same
          variables in your host’s build settings before <code className="login__code">npm run build</code>.
        </p>
      ) : null}

      <div className="login__tabs" role="tablist" aria-label="Sign-in method">
        {(['email', 'phone', 'google'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`login__tab${tab === t ? ' login__tab--active' : ''}`}
            onClick={() => setTab(t)}
            disabled={!firebaseConfigured || loading}
          >
            {t === 'email' ? 'Email' : t === 'phone' ? 'Phone' : 'Google'}
          </button>
        ))}
      </div>

      <div className="login__tabPanel">
        {tab === 'email' ? (
          <form className="login__form" onSubmit={onEmailSubmit} noValidate>
            <div className="login__field">
              <label className="login__label" htmlFor={emailId}>
                Email
              </label>
              <input
                id={emailId}
                className="login__input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={busy || !firebaseConfigured || loading}
              />
            </div>
            <div className="login__field">
              <div className="login__labelRow">
                <label className="login__label" htmlFor={passwordId}>
                  Password
                </label>
                <button
                  type="button"
                  className="login__linkBtn"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={busy}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id={passwordId}
                className="login__input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                minLength={6}
                disabled={busy || !firebaseConfigured || loading}
              />
            </div>
            <button type="submit" className="login__submit" disabled={busy || !firebaseConfigured || loading}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="login__hint" style={{ marginTop: '0.65rem', textAlign: 'center' }}>
              <button type="button" className="login__textLink" onClick={onForgotPassword} disabled={busy}>
                Forgot password?
              </button>
            </p>
          </form>
        ) : null}

        {tab === 'phone' ? (
          <div className="login__form">
            <div className="login__field">
              <label className="login__label" htmlFor={phoneId}>
                Mobile number
              </label>
              <input
                id={phoneId}
                className="login__input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneConfirmation(null);
                  setOtp('');
                }}
                placeholder="+91 9876543210"
                disabled={busy || !firebaseConfigured || loading}
              />
              <p className="login__hint">Use country code (e.g. +91). 10-digit India numbers are accepted as 9876543210.</p>
            </div>
            <div id="login-recaptcha" className="login__recaptchaHost" />
            {!phoneConfirmation ? (
              <button
                type="button"
                className="login__submit"
                onClick={onSendPhoneCode}
                disabled={busy || !firebaseConfigured || loading || !phone.trim()}
              >
                {busy ? 'Sending…' : 'Send verification code'}
              </button>
            ) : (
              <>
                <div className="login__field">
                  <label className="login__label" htmlFor={otpId}>
                    SMS code
                  </label>
                  <input
                    id={otpId}
                    className="login__input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-digit code"
                    disabled={busy || !firebaseConfigured || loading}
                  />
                </div>
                <button
                  type="button"
                  className="login__submit"
                  onClick={onVerifyPhoneOtp}
                  disabled={busy || !firebaseConfigured || loading || otp.trim().length < 4}
                >
                  {busy ? 'Verifying…' : 'Verify & sign in'}
                </button>
                <button
                  type="button"
                  className="login__textLink"
                  style={{ display: 'block', marginTop: '0.75rem', textAlign: 'center', width: '100%' }}
                  onClick={() => {
                    setPhoneConfirmation(null);
                    setOtp('');
                  }}
                  disabled={busy}
                >
                  Use a different number
                </button>
              </>
            )}
          </div>
        ) : null}

        {tab === 'google' ? (
          <div className="login__firebaseActions">
            <GoogleSignInButton
              label="Continue with Google"
              busy={busy}
              disabled={!firebaseConfigured || loading}
              onClick={onGoogleClick}
            />
          </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}
