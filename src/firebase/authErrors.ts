/** Firebase Auth error `code` from caught errors. */
export function firebaseErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const c = (err as { code: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return '';
}

export type AuthErrorIntent = 'signin' | 'signup' | 'reset';

/** Rich copy for toast / popout UI (title optional). */
export function formatEmailAuthError(code: string, intent: AuthErrorIntent): { title?: string; message: string } {
  if (code === 'auth/email-already-in-use' && intent === 'signup') {
    return {
      title: 'This email is already registered',
      message:
        'You can’t create a second account with the same email. Go to Sign in, open the Email tab, and sign in with this address and your password. If you forgot your password, use Forgot password on that page.',
    };
  }

  if (code === 'auth/email-already-in-use') {
    return {
      title: 'Email already in use',
      message: 'This email is already linked to an account. Try signing in instead.',
    };
  }

  if (code === 'auth/invalid-email') {
    return { title: 'Invalid email', message: 'Check the email address and try again.' };
  }

  if (code === 'auth/user-disabled') {
    return { title: 'Account disabled', message: 'This account has been disabled. Contact support if you need help.' };
  }

  if (code === 'auth/user-not-found' && intent === 'reset') {
    return {
      title: 'Reset link',
      message:
        'If an account exists for this email, we sent a reset link. Check your inbox and spam folder. (For privacy, Firebase may not say whether the email exists.)',
    };
  }

  if (code === 'auth/user-not-found') {
    return {
      title: 'No account found',
      message: 'There is no account with this email. Create one on the Sign up page, or check for a typo.',
    };
  }

  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return {
      title: 'Sign-in failed',
      message: 'Wrong email or password. Try again or use Forgot password.',
    };
  }

  if (code === 'auth/weak-password') {
    return { title: 'Weak password', message: 'Use at least 6 characters. Try a longer, stronger password.' };
  }

  if (code === 'auth/too-many-requests') {
    return {
      title: 'Too many attempts',
      message: 'Wait a few minutes before trying again, or reset your password from the sign-in page.',
    };
  }

  if (code === 'auth/network-request-failed') {
    return { title: 'Network issue', message: 'Check your internet connection and try again.' };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      title: 'Sign-in method off',
      message: 'This sign-in method isn’t enabled in Firebase. Ask the admin to enable it in the Firebase console.',
    };
  }

  if (code === 'auth/account-exists-with-different-credential') {
    return {
      title: 'Account exists another way',
      message:
        'This email is already used with a different sign-in method (e.g. password vs Google). Sign in using the method you used originally, or link accounts in Firebase if you use that feature.',
    };
  }

  return {
    title: 'Something went wrong',
    message: 'We couldn’t finish that request. Try again in a moment.',
  };
}

export function formatPhoneAuthError(code: string): { title?: string; message: string } {
  if (code === 'auth/invalid-phone-number') {
    return {
      title: 'Invalid phone number',
      message: 'Use a full number with country code, e.g. +91 9876543210.',
    };
  }
  if (code === 'auth/missing-phone-number') {
    return { title: 'Phone required', message: 'Enter your mobile number before sending the code.' };
  }
  if (code === 'auth/quota-exceeded') {
    return { title: 'SMS limit', message: 'Too many SMS were sent. Try again later or contact support.' };
  }
  if (code === 'auth/captcha-check-failed') {
    return {
      title: 'Verification failed',
      message: 'reCAPTCHA didn’t complete. Refresh the page and try sending the code again.',
    };
  }
  if (code === 'auth/invalid-verification-code') {
    return { title: 'Wrong code', message: 'That code doesn’t match. Check the SMS and try again.' };
  }
  if (code === 'auth/code-expired') {
    return { title: 'Code expired', message: 'Request a new verification code and enter it promptly.' };
  }
  if (code === 'auth/too-many-requests') {
    return { title: 'Too many attempts', message: 'Wait a bit before requesting another SMS or code.' };
  }
  if (code === 'auth/network-request-failed') {
    return { title: 'Network issue', message: 'Check your connection and try again.' };
  }
  return { title: 'Phone sign-in failed', message: 'Something went wrong. Try again or use email / Google.' };
}

export function formatGoogleAuthError(err: unknown): { title: string; message: string } {
  const msg = err instanceof Error ? err.message : '';
  if (msg.includes('popup') || msg.includes('Popup')) {
    return {
      title: 'Pop-up blocked',
      message: 'Allow pop-ups for this site, then try Google sign-in again.',
    };
  }
  if (msg.includes('cancel') || msg.includes('closed')) {
    return { title: 'Sign-in cancelled', message: 'Google sign-in was closed before it finished.' };
  }
  return {
    title: 'Google sign-in failed',
    message: msg || 'Try again or use email or phone sign-in.',
  };
}
