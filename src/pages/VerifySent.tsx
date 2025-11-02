import * as React from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { resendVerificationEmail, watchAuth } from '../lib/auth';

export default function VerifySentPage() {
  const [status, setStatus] = React.useState<'idle' | 'pending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = React.useState<string>(() => {
    const email = auth.currentUser?.email;
    return email
      ? `We sent a verification email to ${email} when you created your account.`
      : 'We sent you a verification email when you created your account. Check your inbox.';
  });

  React.useEffect(() => {
    const unsubscribe = watchAuth((user) => {
      if (!user) {
        setStatus('error');
        setMessage('Please log in to verify your email.');
        return;
      }
      setStatus((prev) => (prev === 'pending' ? prev : 'idle'));
      setMessage(
        `We sent a verification email to ${user.email ?? 'your address'} when you created your account.`,
      );
    });
    return unsubscribe;
  }, []);

  async function handleResend() {
    const user = auth.currentUser;
    if (!user) {
      setStatus('error');
      setMessage('Please log in to resend the email.');
      return;
    }
    try {
      setStatus('pending');
      setMessage('Sending verification email…');
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
          {status === 'pending' ? 'Sending…' : 'Send another email'}
        </button>
        <div className="small" style={{ color: status === 'error' ? 'var(--stone-600)' : 'var(--stone-700)' }}>
          {message}
        </div>
      </div>
    </div>
  );
}
