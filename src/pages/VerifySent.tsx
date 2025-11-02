import * as React from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { resendVerificationEmail, sendVerificationEmail } from '../lib/auth';

export default function VerifySentPage() {
  const [status, setStatus] = React.useState<'idle' | 'pending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = React.useState<string | null>(null);
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    if (initialized) {
      return;
    }
    setInitialized(true);
    const user = auth.currentUser;
    if (!user) {
      setMessage('Please log in to verify your email.');
      setStatus('error');
      return;
    }
    let cancelled = false;
    setStatus('pending');
    setMessage(null);
    sendVerificationEmail(user)
      .then(() => {
        if (cancelled) return;
        setStatus('sent');
        setMessage('Verification email sent. Check your inbox.');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        const text = err instanceof Error ? err.message : 'Unable to send email';
        setMessage(text);
      });
    return () => {
      cancelled = true;
    };
  }, [initialized]);

  async function handleResend() {
    const user = auth.currentUser;
    if (!user) {
      setMessage('Please log in to resend the email.');
      return;
    }
    try {
      setStatus('pending');
      setMessage(null);
      await resendVerificationEmail();
      setStatus('sent');
      setMessage('Verification email sent. Check your inbox.');
    } catch (err) {
      setStatus('error');
      const text = err instanceof Error ? err.message : 'Unable to send email';
      setMessage(text);
    }
  }

  return (
    <div className="container centered-container">
      <h1 className="h1">Check your inbox</h1>
      <div className="card" style={{ maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p>
          We sent you a verification email. Open the link in that email to verify your account, then
          return here.
        </p>
        <p className="small">
          Already clicked the link? <Link to="/auth/verify-complete">Continue</Link>.
        </p>
        <button className="btn outline" type="button" onClick={handleResend} disabled={status === 'pending'}>
          {status === 'pending' ? 'Sending…' : 'Resend verification email'}
        </button>
        {message ? (
          <div className="small" style={{ color: status === 'error' ? 'var(--stone-600)' : 'var(--stone-700)' }}>
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
