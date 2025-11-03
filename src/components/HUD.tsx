import * as React from 'react';
import type { GameState, Player } from '../game/types';

type Mode = 'none' | 'both' | Player;

export type PassControl = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
};

type PlayerDescriptor = {
  color: Player;
  nickname: string;
  elo: number | null;
  passControl: PassControl | null;
};

type StatusTone = 'thinking' | 'waiting' | 'passed' | 'completed' | 'winner' | 'loser';

type Status = { text: string; tone: StatusTone } | null;

export function HUD({
  state,
  tickingMode,
  players,
}: {
  state: GameState;
  tickingMode: Mode;
  players: Record<Player, PlayerDescriptor>;
}) {
  const moveCounter = React.useMemo(() => {
    if (state.phase !== 'MOVEMENT') return null;
    const limit = state.movement.moveLimit;
    const count = state.movement.moveCount;
    if (limit !== undefined) {
      return `Move ${count} / ${limit}`;
    }
    return `Move ${count}`;
  }, [state.phase, state.movement.moveCount, state.movement.moveLimit]);

  return (
    <div className="player-menu-cluster">
      <div className="player-menu-pair">
        {(['W', 'B'] as Player[]).map((color) => (
          <PlayerMenu
            key={color}
            state={state}
            descriptor={players[color]}
            tickingMode={tickingMode}
          />
        ))}
      </div>
      {moveCounter ? <div className="move-counter">{moveCounter}</div> : null}
    </div>
  );
}

function PlayerMenu({
  state,
  descriptor,
  tickingMode,
}: {
  state: GameState;
  descriptor: PlayerDescriptor;
  tickingMode: Mode;
}) {
  const { color, nickname, elo, passControl } = descriptor;
  const time = state.clocks[color];
  const timeActive = tickingMode === 'both' || tickingMode === color;
  const points = resolvePoints(state, color);
  const status = resolveStatus(state, color, tickingMode);
  const classNames = ['player-menu', color === 'W' ? 'player-white' : 'player-black'];
  if (timeActive) {
    classNames.push('active');
  }
  return (
    <div className={classNames.join(' ')}>
      <div className="player-menu-header">
        <div className="player-menu-color">{color === 'W' ? 'White' : 'Black'}</div>
        <div className="player-menu-name">{nickname}</div>
        <div className="player-menu-elo">Elo {typeof elo === 'number' ? elo : '—'}</div>
      </div>
      <div className="player-menu-metrics">
        <div
          className={['player-metric', 'time', timeActive ? 'active' : '', time <= 10000 ? 'critical' : '']
            .filter(Boolean)
            .join(' ')}
        >
          <span className="metric-label">Time</span>
          <span className="metric-value">{formatClock(time)}</span>
        </div>
        <div className="player-metric points">
          <span className="metric-label">Points</span>
          <span className="metric-value">{points}</span>
        </div>
      </div>
      <div className="player-menu-footer">
        {status ? (
          <div className={[
            'player-menu-status',
            status.tone,
          ].join(' ')}>
            {status.text}
          </div>
        ) : <div className="player-menu-status placeholder">&nbsp;</div>}
        {passControl ? (
          <button
            className="player-menu-pass"
            onClick={passControl.onClick}
            disabled={passControl.disabled}
            title={passControl.tooltip}
          >
            {passControl.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function resolvePoints(state: GameState, player: Player): number {
  if (
    state.phase === 'BIDDING' ||
    state.phase === 'PLACEMENT' ||
    state.phase === 'ASSIGN_STATS_W' ||
    state.phase === 'ASSIGN_STATS_B' ||
    state.phase === 'MOVEMENT_BIDDING'
  ) {
    return state.credits[player];
  }
  return state.scores[player];
}

function resolveStatus(state: GameState, player: Player, mode: Mode): Status {
  switch (state.phase) {
    case 'BIDDING': {
      const bid = state.bids[player];
      if (state.bids.revealed) {
        const winner = state.bids.startingPlayer ?? 'W';
        if (winner === player) {
          return { text: `Won initiative (${bid ?? 0})`, tone: 'winner' };
        }
        return { text: `Lost initiative (${bid ?? 0})`, tone: 'loser' };
      }
      if (typeof bid === 'number') {
        return { text: `Bid locked (${bid})`, tone: 'completed' };
      }
      return { text: 'Selecting bid', tone: 'thinking' };
    }
    case 'PLACEMENT': {
      if (state.turn === player) {
        return { text: 'Thinking', tone: 'thinking' };
      }
      if (state.passesInARow > 0) {
        return { text: 'Passed', tone: 'passed' };
      }
      return null;
    }
    case 'ASSIGN_STATS_W':
    case 'ASSIGN_STATS_B': {
      const active = state.phase === 'ASSIGN_STATS_W' ? 'W' : 'B';
      if (player === active) {
        return { text: 'Thinking', tone: 'thinking' };
      }
      const assignments = state.assignments[player];
      if (assignments && Object.keys(assignments).length > 0) {
        return { text: 'Completed', tone: 'completed' };
      }
      return { text: 'Waiting', tone: 'waiting' };
    }
    case 'MOVEMENT_BIDDING': {
      const bid = state.movement.bids[player];
      if (state.movement.bids.revealed) {
        const winner = state.movement.bids.winner;
        if (winner === player) {
          return { text: `Won initiative (${bid ?? 0})`, tone: 'winner' };
        }
        if (winner) {
          return { text: `Lost initiative (${bid ?? 0})`, tone: 'loser' };
        }
      }
      if (typeof bid === 'number') {
        return { text: `Bid locked (${bid})`, tone: 'completed' };
      }
      return { text: 'Selecting bid', tone: 'thinking' };
    }
    case 'MOVEMENT': {
      if (state.turn === player) {
        return { text: 'Thinking', tone: 'thinking' };
      }
      if (state.passesInARow > 0) {
        return { text: 'Passed', tone: 'passed' };
      }
      return null;
    }
    case 'ENDED': {
      if (state.winner === player) {
        return { text: 'Winner', tone: 'winner' };
      }
      if (state.winner === (player === 'W' ? 'B' : 'W')) {
        return { text: 'Defeated', tone: 'loser' };
      }
      return null;
    }
    default:
      break;
  }
  if (mode === player || mode === 'both') {
    return { text: 'Thinking', tone: 'thinking' };
  }
  return null;
}

function formatClock(ms: number) {
  const clamped = Math.max(0, ms);
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
