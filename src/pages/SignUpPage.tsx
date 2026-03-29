import type { ConfirmationResult } from 'firebase/auth';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { useAuth } from '../auth/AuthContext';
import { useAuthFlash } from '../auth/AuthFlashContext';
import {
  firebaseErrorCode,
  formatEmailAuthError,
  formatGoogleAuthError,
  formatPhoneAuthError,
} from '../firebase/authErrors';
import { firebaseRegisterWithEmail } from '../firebase/emailAuth';
import { createInvisibleRecaptcha, normalizeToE164, requestPhoneOtp } from '../firebase/phoneAuth';
import { AuthLayout } from '../layouts/AuthLayout';
import './LoginPage.css';

type LocationState = { from?: string; needAccount?: boolean };
type AuthTab = 'email' | 'phone' | 'google';

export function SignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const { user, loading, firebaseConfigured, signInWithGoogle, sessionSyncing, sessionError } = useAuth();
  const { showFlash } = useAuthFlash();

  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const nameId = useId();
  const phoneId = useId();
  const otpId = useId();

  const [tab, setTab] = useState<AuthTab>('email');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
    }
    navigate('/welcome/role?new=1', { replace: true });
  }, [loading, user, sessionSyncing, sessionError, navigate, showFlash]);

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

  async function onEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      showFlash({
        title: 'Passwords don’t match',
        message: 'Re-enter the same password in both fields, then try again.',
        variant: 'error',
      });
      return;
    }
    if (password.length < 6) {
      showFlash({
        title: 'Password too short',
        message: 'Firebase requires at least 6 characters. Use a longer password.',
        variant: 'error',
      });
      return;
    }
    setStatus('loading');
    try {
      await firebaseRegisterWithEmail(email, password, displayName);
      setStatus('idle');
      navigate('/welcome/role?new=1', { replace: true });
    } catch (err: unknown) {
      setStatus('error');
      const { title, message } = formatEmailAuthError(firebaseErrorCode(err), 'signup');
      showFlash({ title, message, variant: 'error', durationMs: 14_000 });
    }
  }

  async function onSendPhoneCode() {
    setStatus('loading');
    recaptchaVerifierRef.current?.clear();
    recaptchaVerifierRef.current = null;
    try {
      const verifier = createInvisibleRecaptcha('signup-recaptcha');
      recaptchaVerifierRef.current = verifier;
      const e164 = normalizeToE164(phone);
      const cr = await requestPhoneOtp(e164, verifier);
      setPhoneConfirmation(cr);
      setStatus('idle');
      showFlash({
        title: 'Code sent',
        message: 'Enter the SMS code below to verify your number and finish sign-up.',
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
      navigate('/welcome/role?new=1', { replace: true });
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
      navigate('/welcome/role?new=1', { replace: true });
    } catch (e) {
      setStatus('error');
      const { title, message } = formatGoogleAuthError(e);
      showFlash({ title, message, variant: 'error' });
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Register with email & password, phone OTP, or Google. Then choose buyer or seller."
      footer={
        <>
          <span className="login__footerLead">Already have an account?</span>{' '}
          <Link to="/" className="login__inlineLink">
            Sign in
          </Link>
        </>
      }
    >
      {!firebaseConfigured ? (
        <div className="login__banner login__banner--error" role="alert">
          <strong>Firebase is not configured.</strong> Add <code className="login__code">VITE_FIREBASE_*</code> to{' '}
          <code className="login__code">.env</code>. Enable <strong>Email/Password</strong>, <strong>Phone</strong>, and{' '}
          <strong>Google</strong> in Firebase Authentication.
        </div>
      ) : null}

      {state?.needAccount ? (
        <p className="login__banner login__banner--error" role="status">
          Create an account to continue
          {state.from ? ` (you tried ${state.from}).` : '.'}
        </p>
      ) : null}

      <div className="login__tabs" role="tablist" aria-label="Sign-up method">
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
          <form className="login__form" onSubmit={onEmailSignUp} noValidate>
            <div className="login__field">
              <label className="login__label" htmlFor={nameId}>
                Name (optional)
              </label>
              <input
                id={nameId}
                className="login__input"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Shown in the app"
                disabled={busy || !firebaseConfigured || loading}
              />
            </div>
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                disabled={busy || !firebaseConfigured || loading}
              />
            </div>
            <div className="login__field">
              <label className="login__label" htmlFor={confirmId}>
                Confirm password
              </label>
              <input
                id={confirmId}
                className="login__input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                minLength={6}
                disabled={busy || !firebaseConfigured || loading}
              />
            </div>
            <button type="submit" className="login__submit" disabled={busy || !firebaseConfigured || loading}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        ) : null}

        {tab === 'phone' ? (
          <div className="login__form">
            <p className="login__hint" style={{ marginBottom: '1rem' }}>
              We’ll text you a code. If this number is new to DukaanPro, Firebase creates your account when you verify.
            </p>
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
              <p className="login__hint">Include country code (+91). You can enter 10 digits for India.</p>
            </div>
            <div id="signup-recaptcha" className="login__recaptchaHost" />
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
                  {busy ? 'Verifying…' : 'Verify & create account'}
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
              label="Sign up with Google"
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
