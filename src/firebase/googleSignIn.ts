import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseAuthConfigured } from './config';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
provider.addScope('email');
provider.addScope('profile');

export async function firebaseSignInWithGoogle(): Promise<void> {
  if (!isFirebaseAuthConfigured()) {
    throw new Error('Firebase is not configured for this build.');
  }
  const auth = getFirebaseAuth();
  await signInWithPopup(auth, provider);
}
