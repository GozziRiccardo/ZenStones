import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, sendVerificationEmail } from '../lib/auth';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError('Please provide email and password.');
      return;
    }
    try {
      setPending(true);
      const user = await register(trimmedEmail, trimmedPassword);
      navigate('/auth/verify-sent');
      sendVerificationEmail(user).catch((err) => {
        console.error('Failed to send verification email:', err);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="container login-container">
      <h1 className="h1">ZenStones — Sign up</h1>
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
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? (
          <div className="small" style={{ color: 'var(--stone-600)' }}>
            {error}
          </div>
        ) : null}
        <div className="row gap">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'Creating account…' : 'Create account'}
          </button>
        </div>
        <div className="small">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}
