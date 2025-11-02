import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Protected } from '../auth/Protected';
import { useAuth } from '../auth/AuthContext';
import {
  acceptChallenge,
  cancelQuickMatch,
  denyChallenge,
  requestQuickMatch,
  sendChallenge,
  watchActiveMatch,
  watchIncomingChallenges,
  watchQuickMatch,
  watchUserProfile,
  type ChallengeSnapshot,
  type MatchDoc,
} from '../lib/matchmaking';

function ProfileView() {
  const { user, nickname, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = React.useState<{ elo?: number } | null>(null);
  const [queueStatus, setQueueStatus] = React.useState<'idle' | 'waiting'>('idle');
  const queueStatusRef = React.useRef<'idle' | 'waiting'>('idle');
  const [queueError, setQueueError] = React.useState<string | null>(null);
  const [challengeOpen, setChallengeOpen] = React.useState(false);
  const [challengeNickname, setChallengeNickname] = React.useState('');
  const [challengeMessage, setChallengeMessage] = React.useState<string | null>(null);
  const [challengeError, setChallengeError] = React.useState<string | null>(null);
  const [incomingChallenges, setIncomingChallenges] = React.useState<ChallengeSnapshot[]>([]);
  const [activeMatch, setActiveMatch] = React.useState<MatchDoc | null>(null);
  const [acceptingChallengeId, setAcceptingChallengeId] = React.useState<string | null>(null);
  const matchedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const unsubscribe = watchUserProfile(user.uid, (data) => {
      if (!data) {
        setProfile(null);
        return;
      }
      const eloValue = typeof data.elo === 'number' ? data.elo : 100;
      setProfile({ elo: eloValue });
    });
    return unsubscribe;
  }, [user.uid]);

  React.useEffect(() => {
    queueStatusRef.current = queueStatus;
  }, [queueStatus]);

  React.useEffect(() => {
    const unsubscribe = watchQuickMatch(user.uid, (state) => {
      if (!state) {
        setQueueStatus('idle');
        return;
      }
      if (state.status === 'open') {
        setQueueStatus('waiting');
      }
      if (state.status === 'matched') {
        setQueueStatus('idle');
        if (state.matchId && matchedRef.current !== state.matchId) {
          matchedRef.current = state.matchId;
          navigate(`/match/${state.matchId}`);
        }
      }
    });
    return unsubscribe;
  }, [user.uid, navigate]);

  React.useEffect(() => {
    const unsubscribe = watchActiveMatch(user.uid, (match) => {
      setActiveMatch(match);
      if (match && matchedRef.current !== match.id) {
        matchedRef.current = match.id;
        navigate(`/match/${match.id}`);
      }
    });
    return unsubscribe;
  }, [user.uid, navigate]);

  React.useEffect(() => {
    const unsubscribe = watchIncomingChallenges(user.uid, (items) => {
      setIncomingChallenges(items);
    });
    return unsubscribe;
  }, [user.uid]);

  React.useEffect(() => () => {
    if (queueStatusRef.current === 'waiting') {
      cancelQuickMatch().catch(() => undefined);
    }
  }, []);

  const handleLogout = React.useCallback(async () => {
    try {
      await cancelQuickMatch();
    } catch {
      // ignore queue cancellation errors during logout
    }
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const handleQuickMatch = async () => {
    setQueueError(null);
    setChallengeMessage(null);
    try {
      const result = await requestQuickMatch(nickname);
      if (result.kind === 'waiting') {
        setQueueStatus('waiting');
      } else if (result.kind === 'matched') {
        matchedRef.current = result.matchId;
        navigate(`/match/${result.matchId}`);
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      if (code === 'ALREADY_WAITING') {
        setQueueStatus('waiting');
        setQueueError('Already waiting for an opponent.');
      } else if (code === 'AUTH') {
        setQueueError('You must be signed in to play.');
      } else {
        setQueueError('Could not start matchmaking. Please try again.');
      }
    }
  };

  const handleCancelQuickMatch = async () => {
    await cancelQuickMatch();
    setQueueStatus('idle');
  };

  const handleChallengeSubmit = async () => {
    if (!challengeNickname.trim()) {
      setChallengeError('Enter a nickname to challenge.');
      return;
    }
    setChallengeError(null);
    try {
      await sendChallenge(challengeNickname, nickname);
      setChallengeMessage('Challenge sent');
      setChallengeNickname('');
      setChallengeOpen(false);
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      if (code === 'NOT_FOUND') {
        setChallengeError('No player with that nickname.');
      } else if (code === 'SELF') {
        setChallengeError('You cannot challenge yourself.');
      } else if (code === 'BAD_NICK') {
        setChallengeError('Please enter a valid nickname.');
      } else if (code === 'AUTH') {
        setChallengeError('You must be signed in to send a challenge.');
      } else {
        setChallengeError('Could not send challenge. Please try again.');
      }
    }
  };

  const handleChallengeKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleChallengeSubmit();
    }
  };

  const handleAcceptChallenge = async (challenge: ChallengeSnapshot) => {
    setChallengeError(null);
    setAcceptingChallengeId(challenge.id);
    try {
      const matchId = await acceptChallenge(challenge.id);
      matchedRef.current = matchId;
      navigate(`/match/${matchId}`);
    } catch (err) {
      setChallengeError('Could not accept challenge.');
    } finally {
      setAcceptingChallengeId(null);
    }
  };

  const handleDenyChallenge = async (challenge: ChallengeSnapshot) => {
    setChallengeError(null);
    await denyChallenge(challenge.id);
  };

  const waitingForOpponent = queueStatus === 'waiting';
  const bannerChallenge = !activeMatch && incomingChallenges.length > 0 ? incomingChallenges[0] : null;

  const toggleChallengeInput = () => {
    setChallengeMessage(null);
    setChallengeError(null);
    setChallengeOpen((open) => !open);
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button className="btn outline" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {bannerChallenge ? (
        <div className="challenge-banner">
          <div className="challenge-banner-text">
            {bannerChallenge.challengerNickname} challenged you to a match.
          </div>
          <div className="challenge-banner-actions">
            <button
              className="btn outline"
              onClick={() => handleDenyChallenge(bannerChallenge)}
              disabled={acceptingChallengeId === bannerChallenge.id}
            >
              Deny
            </button>
            <button
              className="btn"
              onClick={() => handleAcceptChallenge(bannerChallenge)}
              disabled={acceptingChallengeId === bannerChallenge.id}
            >
              {acceptingChallengeId === bannerChallenge.id ? 'Starting…' : 'Accept'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="profile-card">
        <div className="profile-name">{nickname}</div>
        <div className="profile-elo">Elo {profile?.elo ?? 100}</div>

        <div className="profile-actions">
          <button className="btn" onClick={handleQuickMatch}>
            Play a game
          </button>
          <button className="btn outline" onClick={toggleChallengeInput}>
            Send a challenge
          </button>
        </div>

        {waitingForOpponent ? (
          <div className="waiting-message">
            <div className="spinner" aria-hidden="true" />
            <span>Waiting for opponent…</span>
            <button className="btn outline small-btn" onClick={handleCancelQuickMatch}>
              Cancel
            </button>
          </div>
        ) : null}
        {queueError ? <div className="challenge-feedback error">{queueError}</div> : null}

        {challengeOpen ? (
          <div className="challenge-input">
            <input
              type="text"
              value={challengeNickname}
              onChange={(event) => setChallengeNickname(event.target.value)}
              onKeyDown={handleChallengeKeyDown}
              placeholder="Enter nickname"
            />
            <button className="btn" onClick={handleChallengeSubmit}>
              Send
            </button>
          </div>
        ) : null}

        {challengeMessage ? <div className="challenge-feedback">{challengeMessage}</div> : null}
        {challengeError ? <div className="challenge-feedback error">{challengeError}</div> : null}
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Protected>
      <ProfileView />
    </Protected>
  );
}
