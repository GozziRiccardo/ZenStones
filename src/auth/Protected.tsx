import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { userHasNickname } from '../lib/nickname';
import { watchAuth } from '../lib/auth';

export function Protected({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [userState, setUserState] = React.useState(() => ({
    loading: true,
    hasNickname: false,
    checkingNickname: false,
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
        setUserState((prev) => ({ ...prev, hasNickname: false, checkingNickname: false }));
        return;
      }
      setUserState((prev) => ({ ...prev, checkingNickname: true }));
      try {
        const has = await userHasNickname(currentUser.uid);
        if (!cancelled) {
          setUserState((prev) => ({ ...prev, hasNickname: has, checkingNickname: false }));
        }
      } catch (err) {
        if (!cancelled) {
          setUserState((prev) => ({ ...prev, hasNickname: false, checkingNickname: false }));
        }
      }
    }
    checkNickname();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  if (userState.loading || userState.checkingNickname) {
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

  if (!userState.hasNickname) {
    return <Navigate to="/nickname" replace />;
  }

  return <>{children}</>;
}
