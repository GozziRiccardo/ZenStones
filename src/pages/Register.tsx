import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../lib/auth';
import { normalize } from '../lib/nickname';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const normalizedNickname = normalize(nickname);
    if (!trimmedEmail || !trimmedPassword || !normalizedNickname) {
      setError('Please provide email, password, and nickname.');
      return;
    }
    if (normalizedNickname.length < 3 || normalizedNickname.length > 20) {
      setError('Nickname must be 3-20 characters.');
      return;
    }
    try {
      setPending(true);
      await register(trimmedEmail, trimmedPassword, normalizedNickname);
      navigate('/auth/verify-sent');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="container">
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
            placeholder="Nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
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
          <div className="small" style={{ color: '#b91c1c' }}>
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
