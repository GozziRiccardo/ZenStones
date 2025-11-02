import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { applyActionCode } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { userHasNickname } from '../lib/nickname';
import { watchAuth } from '../lib/auth';

export default function VerifyCompletePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = React.useState('Finalising verification…');

  React.useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let resolved = false;

    async function process() {
      try {
        const mode = searchParams.get('mode');
        const code = searchParams.get('oobCode');
        if (mode === 'verifyEmail' && code) {
          await applyActionCode(auth, code);
        }
      } catch (err) {
        if (!cancelled) {
          setMessage('Verification link is invalid or expired.');
        }
        return;
      }

      unsubscribe = watchAuth(async (user) => {
        if (resolved) {
          return;
        }
        if (!user) {
          if (!cancelled) {
            setMessage('Please log in to continue.');
            navigate('/login', { replace: true });
          }
          resolved = true;
          return;
        }
        await user.reload();
        if (!user.emailVerified) {
          if (!cancelled) {
            setMessage('Email is not verified yet.');
            navigate('/auth/verify-sent', { replace: true });
          }
          resolved = true;
          return;
        }
        try {
          const has = await userHasNickname(user.uid);
          if (!cancelled) {
            resolved = true;
            navigate(has ? '/play' : '/nickname', { replace: true });
          }
        } catch (err) {
          if (!cancelled) {
            setMessage('Could not complete verification.');
          }
        }
      });
    }

    process();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [navigate, searchParams]);

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420 }}>
        <p className="small">{message}</p>
      </div>
    </div>
  );
}
