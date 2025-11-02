import * as React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { login } from '../lib/auth';
import { auth } from '../lib/firebase';
import { userHasNickname } from '../lib/nickname';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      setPending(true);
      await login(email.trim(), password);
      const user = auth.currentUser;
      if (!user) {
        setError('Unable to log in.');
        return;
      }
      if (!user.emailVerified) {
        navigate('/auth/verify-sent');
        return;
      }
      const hasNickname = await userHasNickname(user.uid);
      if (!hasNickname) {
        navigate('/nickname');
        return;
      }
      const redirectTo = (location.state as { from?: Location })?.from?.pathname;
      navigate(redirectTo ?? '/play');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to log in';
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="container">
      <h1 className="h1">ZenStones — Log in</h1>
      <form className="card" style={{ maxWidth: 420 }} onSubmit={handleSubmit}>
        <div className="row gap">
          <input
            className="input"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="row gap">
          <input
            className="input"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? (
          <div className="small" style={{ color: '#b91c1c' }}>
            {error}
          </div>
        ) : null}
        <div className="row gap">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Log in'}
          </button>
        </div>
        <div className="small">
          Need an account? <Link to="/">Create one</Link>
        </div>
      </form>
    </div>
  );
}
