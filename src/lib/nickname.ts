import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export function normalize(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export async function userHasNickname(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return false;
  const data = snap.data();
  return typeof data?.nickname === 'string' && data.nickname.length > 0;
}

export async function claimNickname(input: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH');
  const nickname = normalize(input);
  if (nickname.length < 3 || nickname.length > 20) {
    throw new Error('BAD_NICK');
  }

  const handleRef = doc(db, 'handles', nickname);
  const userRef = doc(db, 'users', user.uid);

  await runTransaction(db, async (transaction) => {
    const handleDoc = await transaction.get(handleRef);
    if (handleDoc.exists() && handleDoc.data()?.uid !== user.uid) {
      throw new Error('TAKEN');
    }

    transaction.set(handleRef, {
      uid: user.uid,
      createdAt: serverTimestamp(),
    });

    transaction.set(
      userRef,
      {
        uid: user.uid,
        email: user.email ?? null,
        nickname,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  return nickname;
}
