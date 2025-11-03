import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { onSnapshot, doc } from 'firebase/firestore';
import App from '../App';
import { Protected } from '../auth/Protected';
import { useAuth } from '../auth/AuthContext';
import { db } from '../lib/firebase';

function MatchView() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'denied'>('loading');
  const [matchData, setMatchData] = React.useState<{
    playerUids: string[];
    players: Record<string, { nickname?: string; elo?: number }>;
    colors?: Record<string, 'W' | 'B'>;
    status?: string;
  } | null>(null);

  React.useEffect(() => {
    if (!matchId) {
      setStatus('denied');
      return;
    }
    const ref = doc(db, 'matches', matchId);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setStatus('denied');
        setMatchData(null);
        return;
      }
      const data = snap.data() as {
        playerUids?: string[];
        status?: string;
        players?: Record<string, { nickname?: string; elo?: number }>;
        colors?: Record<string, 'W' | 'B'>;
      };
      if (!data.playerUids?.includes(user.uid)) {
        setStatus('denied');
        setMatchData(null);
        return;
      }
      if (data.status !== 'active') {
        setStatus('denied');
        setMatchData(null);
        return;
      }
      const uids = Array.isArray(data.playerUids) ? data.playerUids : [];
      const players = typeof data.players === 'object' && data.players ? data.players : {};
      const colors = typeof data.colors === 'object' && data.colors ? data.colors : undefined;
      setMatchData({ playerUids: uids, players, colors, status: data.status });
      setStatus('ready');
    });
    return unsubscribe;
  }, [matchId, user.uid]);

  React.useEffect(() => {
    if (status === 'denied') {
      navigate('/play', { replace: true });
    }
  }, [status, navigate]);

  if (!matchId) {
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="container centered-container">
        <div className="card" style={{ maxWidth: 360 }}>
          Loading match…
        </div>
      </div>
    );
  }

  if (status !== 'ready') {
    return null;
  }

  return <App key={matchId} matchId={matchId} matchData={matchData ?? undefined} />;
}

export default function MatchPage() {
  return (
    <Protected>
      <MatchView />
    </Protected>
  );
}
