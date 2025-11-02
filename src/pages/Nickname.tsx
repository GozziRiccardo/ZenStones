import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { claimNickname, normalize } from '../lib/nickname';

export default function NicknamePage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = React.useState(() => normalize(localStorage.getItem('pendingNickname') ?? ''));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (!user.emailVerified) {
      navigate('/auth/verify-sent', { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const normalized = normalize(nickname);
    if (normalized.length < 3 || normalized.length > 20) {
      setError('Nickname must be 3-20 characters (a-z, 0-9, _).');
      return;
    }
    try {
      setPending(true);
      const claimed = await claimNickname(normalized);
      localStorage.removeItem('pendingNickname');
      setNickname(claimed);
      navigate('/play', { replace: true });
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'TAKEN') {
          setError('Nickname already taken. Try a different one.');
        } else if (err.message === 'BAD_NICK') {
          setError('Nickname must be 3-20 characters (a-z, 0-9, _).');
        } else {
          setError('Could not claim nickname.');
        }
      } else {
        setError('Could not claim nickname.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="container">
      <h1 className="h1">Choose your nickname</h1>
      <form className="card" style={{ maxWidth: 420 }} onSubmit={handleSubmit}>
        <input
          className="input"
          placeholder="nickname (3-20 characters)"
          value={nickname}
          onChange={(event) => setNickname(normalize(event.target.value))}
        />
        {error ? (
          <div className="small" style={{ color: '#b91c1c' }}>
            {error}
          </div>
        ) : null}
        <div className="row gap">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'Claiming…' : 'Claim nickname'}
          </button>
        </div>
      </form>
    </div>
  );
}
