import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { watchAuth } from '../lib/auth';
import { AuthProvider } from './AuthContext';

export function Protected({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [userState, setUserState] = React.useState(() => ({
    loading: true,
    hasNickname: null as boolean | null,
    checkingNickname: false,
    nickname: null as string | null,
  }));
  const [currentUser, setCurrentUser] = React.useState(() => auth.currentUser);

  React.useEffect(() => {
    const unsubscribe = watchAuth((user) => {
      setCurrentUser(user);
      setUserState((prev) => ({
        ...prev,
        loading: false,
      }));
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (!currentUser || !currentUser.emailVerified) {
      setUserState((prev) => ({
        ...prev,
        hasNickname: null,
        checkingNickname: false,
        nickname: null,
      }));
      return;
    }

    setUserState((prev) => ({ ...prev, checkingNickname: true, hasNickname: null }));

    const ref = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        const nick = typeof data?.nickname === 'string' ? data.nickname.trim() : '';
        setUserState((prev) => ({
          ...prev,
          hasNickname: nick.length > 0,
          checkingNickname: false,
          nickname: nick.length > 0 ? nick : null,
        }));
      },
      () => {
        setUserState((prev) => ({
          ...prev,
          hasNickname: false,
          checkingNickname: false,
          nickname: null,
        }));
      },
    );

    return unsubscribe;
  }, [currentUser]);

  if (
    userState.loading ||
    userState.checkingNickname ||
    (currentUser?.emailVerified && userState.hasNickname === null)
  ) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: 360 }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!currentUser.emailVerified) {
    return <Navigate to="/auth/verify-sent" replace />;
  }

  if (userState.hasNickname === false) {
    return <Navigate to="/nickname" replace />;
  }

  if (!userState.nickname) {
    return null;
  }

  return <AuthProvider user={currentUser} nickname={userState.nickname}>{children}</AuthProvider>;
}
