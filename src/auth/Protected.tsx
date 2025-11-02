import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { getUserNickname } from '../lib/nickname';
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
    let cancelled = false;
    async function checkNickname() {
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
      try {
        const nickname = await getUserNickname(currentUser.uid);
        if (!cancelled) {
          setUserState((prev) => ({
            ...prev,
            hasNickname: Boolean(nickname),
            checkingNickname: false,
            nickname: nickname,
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setUserState((prev) => ({
            ...prev,
            hasNickname: false,
            checkingNickname: false,
            nickname: null,
          }));
        }
      }
    }
    checkNickname();
    return () => {
      cancelled = true;
    };
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
