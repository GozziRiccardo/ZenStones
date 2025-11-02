# Chesslike (working title)

Repository prepared for a simple, chess-like game. Rules are now documented in [`docs/rules.md`](docs/rules.md).

## What’s here

- `README.md` — project overview and links.
- `LICENSE` — MIT (change the name/year if needed).
- `.gitignore` — Node/TypeScript focused.
- `.github/ISSUE_TEMPLATE/task.yml` — quick template to brief Codex on tasks.
- `docs/rules.md` — complete specification for the ZenStones hot-seat MVP.

## Quick start (after you add code)

```bash
# install deps (when package.json exists)
npm install

# run dev (when a dev script exists)
npm run dev
```

## Working with Codex

Open **Issues** and use the **Task** template. Keep each change small and specific.

## Auth & Firebase

- Enable Firebase Authentication (Email/Password) and require email verification.
- Add your Cloudflare Pages domain(s) to the Firebase authorized domains list.
- Enable Firestore in Native mode for nickname storage.
- Provide the Firebase configuration values as `VITE_FIREBASE_*` environment variables in Cloudflare Pages (Project → Settings → Environment Variables).
- Deploy, then access routes:
  - `/` — registration
  - `/login` — log in
  - `/auth/verify-sent` — verification reminder/resend
  - `/auth/verify-complete` — post-verification landing
  - `/nickname` — nickname claim (after verification)
  - `/play` — game (requires verified account with nickname)
