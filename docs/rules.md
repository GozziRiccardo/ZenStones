# ZenStones — Local MVP (Hot-Seat)

## Goal

Implement a local, hot-seat prototype of ZenStones with full rules and UI. Online and simultaneous play will come later.

## Board & Players

- **Board:** 10×10 grid.
- **Players:** White and Black. Colors are assigned randomly at game start.
- **Starting Resources:** Each player begins with 100 credits and 10:00 on a chess-clock timer (countdown, no increment).

## Phases

### 1. Bidding (Simultaneous)

1. Each player secretly enters a bid (integer ≥ 0, ≤ current credits).
2. On "Lock", bids reveal. Higher bid starts placement; ties favor White.
3. Both players immediately pay their bid from credits.

### 2. Placement (Alternating)

- The board is split into two halves of 50 squares. Each player may place stones in their half. When a square is claimed, the mirrored square with the same label in the opponent half unlocks for that opponent for future placements.
- Each half is labeled **1–50** (from that player’s perspective):
  - 1 is bottom-left; 10 is bottom-right.
  - 11 is above 10; 50 is top-right.
- On a turn, a player may either:
  - **Place** a stone on any empty square in their half, paying credits equal to the square’s label.
  - **Pass**, which is always allowed.
- Two consecutive passes end the placement phase.
- Stones placed during this phase do not yet have movement stats.

### 3. Assign Stats (Sequential)

1. White assigns stats to all White stones, then Black assigns stats to all Black stones.
2. For each stone:
   - Choose **Move Distance** `d` ∈ {1, 2, 3, 4, 5}.
   - Choose **Directions** as a subset of {Right, Left, Up, Down}. Represent as a 4-bit mask.
   - Pay **Cost = d × number_of_directions** from remaining credits.
3. **Shapes** (visual only): `1` → circle, `2` → double circle, `3` → triangle, `4` → square, `5` → pentagon. Render arrows inside for the selected directions.

### 4. Movement (Alternating)

- The player who **did not** make the last placement move starts movement.
- On a turn, select one of your stones and move it:
  - The stone may move up to `d` squares along its allowed orthogonal directions.
  - Movement is blocked by any stone (ally or enemy); stones cannot be passed through.
  - A player may stop before reaching `d`.
  - Landing on an enemy stone removes both stones (mutual annihilation).
- Passing is not allowed during movement if a legal move exists.

## Timers (Local MVP)

- Clocks start at the beginning of the bidding phase.
- **Bidding:** both clocks run until bids are locked.
- **Placement & Movement:** only the active player’s clock runs (chess-clock style).
- **Assign Stats:** only the current player’s clock runs while assigning stats.
- If a clock hits 0:00, that player loses immediately.

## Scoring

- At the start of movement, each player’s **score = remaining credits**.
- During movement, add **position points** for stones located in the opponent’s half:
  - Points for a stone = `51 – label_of_that_square_in_opponent_half`.
  - Stones in a player’s own half score 0 points.
- Precompute two label maps:
  - `labelWhiteHalf[r][c]` = 1..50 for squares in White’s half; otherwise 0 or null.
  - `labelBlackHalf[r][c]` = 1..50 for squares in Black’s half; otherwise 0 or null.
- Use the appropriate map when scoring stones in the opponent half.
- Update scores after every move or capture.

## End Conditions

- **Score Win:** If a player’s score reaches ≥ 100, they win immediately. If both would reach ≥ 100 due to a single move or capture, the mover wins (first to hit the threshold).
- **Elimination Loss:** A player with no stones on the board loses.
- **Flag Loss:** A player whose timer hits 0:00 loses.

## UI Requirements

- 10×10 board with half-tone shading to distinguish halves.
- Placement phase shows half labels (1–50) dimly over the active side.
- Stones render shape by `d` value and arrows for chosen directions.
- Clicking a stone previews reachable squares for the turn.
- Persistent HUD displays credits, scores, clocks, current phase, and active player.
- Bidding UI provides private inputs with a "Lock" control for each player, then reveals bids.
- Assign Stats UI offers per-stone editors with distance picker (1–5), direction toggles, cost display, and remaining credits.

### Stone Icon Reference

Use the following minimal React component as a baseline for rendering stone shapes by distance value. Layer the four directional arrows on top as needed for the assigned movement directions.

```tsx
type Dist = 1 | 2 | 3 | 4 | 5;

export function StoneIcon({ d }: { d: Dist }) {
  const size = 36,
    cx = 18,
    cy = 18,
    r = 12;

  const poly = (n: number, rr = r) =>
    Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; // top vertex up
      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);
      return `${x},${y}`;
    }).join(" ");

  if (d === 1) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={2} />
      </svg>
    );
  }
  if (d === 2) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={r - 4} fill="none" stroke="currentColor" strokeWidth={2} />
      </svg>
    );
  }
  if (d === 3) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <polygon points={poly(3)} fill="none" stroke="currentColor" strokeWidth={2} />
      </svg>
    );
  }
  if (d === 4) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <rect
          x={cx - r}
          y={cy - r}
          width={2 * r}
          height={2 * r}
          rx={2}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        />
      </svg>
    );
  }
  // d === 5 → pentagon
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <polygon points={poly(5)} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}
```

## Data Model (TypeScript)

```ts
export type Player = 'W' | 'B';
export type Phase =
  | 'BIDDING'
  | 'PLACEMENT'
  | 'ASSIGN_STATS_W'
  | 'ASSIGN_STATS_B'
  | 'MOVEMENT'
  | 'ENDED';

export type DirMask = number; // bits: 1=Right, 2=Left, 4=Up, 8=Down

export type Stone = {
  id: string;
  owner: Player;
  r: number;
  c: number;
  // stats
  d?: 1 | 2 | 3 | 4 | 5;
  dirs?: DirMask;
};

export type Clocks = { W: number; B: number };
export type Scores = { W: number; B: number };
export type Credits = { W: number; B: number };

export type GameState = {
  seed: string; // for initial color randomization
  board: (string | null)[][]; // stone id or null
  stones: Record<string, Stone>;
  turn: Player | null; // null before movement
  phase: Phase;
  lastPlacementBy?: Player; // determines movement starter
  credits: Credits;
  clocks: Clocks;
  scores: Scores;
  bids?: { W?: number; B?: number; revealed: boolean };
  passesInARow: number; // placement only
  labels: {
    whiteHalf: number[][];
    blackHalf: number[][];
  }; // 1..50 or 0
};
```

## Acceptance Criteria

- Full phase flow implemented exactly as described.
- Legal moves respect distance/directions with no passing through stones.
- Captures remove both stones involved.
- Scoring updates live; crossing into an opponent half uses correct labels.
- Placement ends on two consecutive passes.
- Movement begins with the player who did not make the last placement.
- Chess-clock behavior as specified; flagging results in loss.
- End conditions enforced with mover winning simultaneous threshold hits.
- (Optional) Save/load by serializing `GameState` to JSON for debugging.

## Implementation Milestones

1. Project scaffold (React + TypeScript + Vite), board rendering, and half-labeling utility.
2. GameState store, clocks, credits; bidding UI and flow.
3. Placement logic with costs, pass handling, and two-pass termination.
4. Assign-stats UI with credit costs.
5. Movement engine (path blocking, capture), move previews/highlights.
6. Scoring engine and HUD.
7. End conditions and basic replay/save tooling.

## Notes / Assumptions

- Movement is orthogonal only; no jumping; maximum `d` per move; may stop early.
- Movement phase forbids passing if any legal move exists.
- Scoring uses static opponent-half labels after movement; labels are not recomputed.
