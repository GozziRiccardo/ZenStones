export type Player = 'W' | 'B';
export type Phase =
  | 'BIDDING'
  | 'PLACEMENT'
  | 'ASSIGN_STATS_W'
  | 'ASSIGN_STATS_B'
  | 'MOVEMENT_BIDDING'
  | 'MOVEMENT'
  | 'ENDED';

export type DirMask = number; // bits: 1=Right, 2=Left, 4=Up, 8=Down
export const DIR = { R:1, L:2, U:4, D:8 } as const;

export type Dist = 1 | 2 | 3 | 4 | 5;

export type Stone = {
  id: string;
  owner: Player;
  r: number;
  c: number;
  d?: Dist;
  dirs?: DirMask;
};

export type Assignment = { d: Dist; dirs: DirMask };

export type Clocks = { W: number; B: number };
export type Scores = { W: number; B: number };
export type Credits = { W: number; B: number };

export type Labels = { whiteHalf: number[][]; blackHalf: number[][] };

export type ScoreDetail = { credits: number; position: number; total: number };

export type MovementBids = {
  W?: number;
  B?: number;
  revealed: boolean;
  winner?: Player;
};

export type MovementState = {
  bids: MovementBids;
  moveLimit?: number;
  moveCount: number;
  startingPlayer?: Player;
  decider?: Player;
};

export type GameState = {
  seed: string;
  board: (string|null)[][]; // stone id or null
  stones: Record<string, Stone>;
  turn: Player | null; // null before movement
  phase: Phase;
  lastPlacementBy?: Player;
  lastPlacementId?: string;
  placementCounts: Record<Player, number>;
  credits: Credits;
  clocks: Clocks; // milliseconds
  scores: Scores;
  scoreDetails: Record<Player, ScoreDetail>;
  bids: { W?: number; B?: number; revealed: boolean; startingPlayer?: Player };
  passesInARow: number;
  labels: Labels;
  winner?: Player | 'FLAG' | 'SCORE' | 'ELIM';
  assignments: Record<Player, Record<string, Assignment>>;
  movement: MovementState;
};
