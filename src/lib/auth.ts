import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

export async function register(email: string, password: string, nickname: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(credential.user, {
    url: `${location.origin}/auth/verify-complete`,
  });
  localStorage.setItem('pendingNickname', nickname);
  return credential.user;
}

export async function login(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export function logout() {
  return signOut(auth);
}

export function watchAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('AUTH_REQUIRED');
  }
  return user;
}

export function requireVerifiedUser() {
  const user = getCurrentUser();
  if (!user.emailVerified) {
    throw new Error('EMAIL_NOT_VERIFIED');
  }
  return user;
}

export async function resendVerificationEmail() {
  const user = getCurrentUser();
  await sendEmailVerification(user, {
    url: `${location.origin}/auth/verify-complete`,
  });
}
