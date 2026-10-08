# ContextPass

**A user-controlled permission layer between people and their AI applications. Your context. Your control.**

ContextPass keeps your personal context in a private vault and lets AI apps read it only while you allow it. Every grant and revocation is recorded on **Monad**. Every read passes a server-side gate that asks the contract, at that moment, whether the permission is still active.

---

## The Problem

AI applications are more useful when they know about you: your projects, how you write code, how you like to learn. Today that context is handed over in one of two ways, and both are all-or-nothing:

- you paste it into every app;
- you grant broad account access and hope.

There is no clear permission layer that lets a person decide exactly what each AI application may read, for how long, and that stops working the moment they change their mind.

## The Idea

**Your context. Your control.** With ContextPass, you decide:

- **which** AI application gets access;
- **what** context it can read, scope by scope (for example *Projects* but not *About me*);
- **how long** the permission lasts (15 minutes, 1 hour, 1 day or 30 days);
- **when** access ends. Revoke it at any time, and the next read is refused.

AI applications can *ask*. The user remains the authority.

## How It Works

```
User
 ↓
Privy  ─────────── identity + embedded wallet that signs grants and revocations
 ↓
ContextPass  ───── Next.js app + server API (the only path to context)
 ├── Supabase ──── context vault, apps, requests, decisions, audit log (off-chain)
 └── Monad ─────── ContextPassPermissions contract: the source of truth for who may read what
```

**On-chain (Monad):** permission state only:

- the owner;
- an app key and a scope key (hashes);
- grant, expiry and revocation times.

**Off-chain (Supabase):** the context itself, the app registry, access requests, decisions and the activity ledger.

Context is never written on-chain. Authorization is never taken from the database or the UI alone. The gate re-checks Monad on every read.

## Architecture

| Layer | What it is |
| --- | --- |
| **Next.js 16 · React 19 · TypeScript · Tailwind v4** | The ContextPass app (`/app/*`), landing page, and the API route handlers (`src/app/api`). |
| **Privy** | Email sign-in and an embedded Ethereum wallet per user. The wallet signs `grantPermission` / `revokePermission`; Privy can sponsor gas. |
| **Supabase (Postgres)** | Context vault and records, accessed **only by the server** with explicit owner scoping. Row-level security is enabled on every table as defense in depth. The browser never talks to Supabase. |
| **Solidity · Foundry** | `contracts/src/ContextPassPermissions.sol` with a Foundry test suite. |
| **Monad Testnet** | Chain 10143. Hosts the deployed permission contract. |
| **viem** | Contract reads, transaction encoding, and server-side receipt and event verification. |
| **ContextPass server boundary** | `src/lib/server/*`. Covers Privy token verification, the access gate, request lifecycle, and on-chain verification. It is marked `server-only`. |
| **Consumer SDK** | `src/lib/contextpass-sdk`. A small typed client for apps: `requestAccess`, `getAuthorizedContext`, `respond`. |
| **CodePilot** (`/apps/code-pilot`) | Demo consumer (coding assistant). Asks for **Projects + Coding preferences**. |
| **StudyOS** (`/apps/study-os`) | Demo consumer (study planner). Asks for **Study preferences**. |

Context scopes are **About me**, **Study preferences**, **Coding preferences**, **Projects** and **Communication preferences**. The app registry is seeded with CodePilot, StudyOS and a third app, Margin, which has no demo page.

## Permission Flow

1. **An AI application requests context.** CodePilot calls `POST /api/contextpass/context` with `{ app, scopes }`.
2. **ContextPass identifies the authenticated owner.**
   - The Privy access token is verified on the server: ES256 signature against Privy's published keys, issuer, audience and expiry.
   - The owner's wallet is looked up from Privy's API.
   - Any wallet or user id sent in the request body is ignored.
3. **The app and scopes are validated.**
   - An unknown app gets `404`.
   - Scopes must be known and declared by that app (`422`).
4. **ContextPass checks Monad.** It reads the owner's permissions for that app from the contract and calls `isPermissionActive` on each one.
5. **Active:** the server releases **only** the scopes covered by an active permission. Other requested scopes are reported as withheld. The response includes a receipt: permission id, expiry and the grant transaction.
6. **Otherwise access is refused.**
   - Revoked, expired or missing permissions get `403` with a reason (`revoked`, `expired` or `no-permission`).
   - Malformed or unauthorized requests get `401`, `404` or `422`.
   - No context is queried when access is refused, and the refusal is logged as `blocked`.
7. **The user grants or revokes in ContextPass.**
   - **Allow:**
     1. The user's wallet signs `grantPermission`, after approving in Privy.
     2. The transaction confirms on Monad.
     3. The server re-verifies the receipt, the `PermissionGranted` event and `isPermissionActive`.
     4. Only then is the request marked approved.
   - **Revoke:** `revokePermission` on Monad, then the server verifies the `PermissionRevoked` event.
   - **Deny:** recorded by ContextPass only. **Deny never creates an on-chain transaction**, because nothing was granted.

## Security Model

What is implemented:

- **Authenticated requests.** Every private route requires a Privy access token verified server-side. Forged, tampered, `alg: none`, expired, wrong-issuer and wrong-audience tokens get `401`.
- **Server-side authorization.** Context is released only by the gate in `src/lib/server/access.ts`. The UI showing "Active" is never enough.
- **Owner-bound access.** Every query is scoped to the verified owner. The wallet comes from Privy, never from the request body.
- **App and scope validation.**
  - Unknown apps are rejected.
  - Scopes an app never declared are rejected; CodePilot cannot ask for *About me*.
  - One app's permission never unlocks another app.
- **On-chain permission verification.** Every read calls `isPermissionActive` on Monad. The contract wins over any stored expiry.
- **Transaction receipt verification.** An Allow or Revoke is recorded only if Monad returns a successful receipt containing the exact event, for this permission id and this owner.
- **Replay, wrong-contract and wrong-owner rejection.** Each of these gets `409`:
  - reusing another permission's transaction;
  - offering a revoke transaction as a grant;
  - an event from a different contract;
  - an event for another owner.

  A transaction that cannot be found fails closed (`503`) and is never approved.
- **Malformed request rejection.** Invalid JSON, hashes, ids, scopes and oversize content get `422` or `404`, never `500`.
- **Blocked-request logging.** Refused reads are written to the activity ledger as `blocked`, alongside requests, grants, reads, revocations and denials.
- **Secrets kept server-side.**
  - `PRIVY_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` are read only under `src/lib/server` and `scripts/`.
  - None is `NEXT_PUBLIC_`.
  - A missing secret fails closed with `503`.
- **Browser bundle.** The production client bundle was scanned and contains no server secret names and no ContextPass server code.
- **Database isolation.**
  - RLS is enabled on all five tables. Owner-isolation policies are keyed on the Privy subject.
  - The `anon` and `authenticated` roles have narrow grants.
  - These policies are covered by tests.

## Current Demo

Verified end to end on Monad Testnet with a real Privy account:

1. **CodePilot asks for context** and gets `403`. ContextPass has no active permission for it.
2. **CodePilot requests access.** The request appears in ContextPass with the app, its stated reason, the scopes and a duration.
3. **The user reviews and allows it.** The user approves in Privy, and the permission is **recorded on Monad**.
4. **CodePilot asks again** and receives **only Projects + Coding preferences**, with a receipt that links the on-chain permission and its transaction.
5. **The user revokes access** on Monad.
6. **CodePilot asks again** and gets `403`: *"Access revoked. ContextPass blocked this request."* No context is returned.
7. **StudyOS is denied.** The request is declined with **no on-chain transaction**, and StudyOS stays blocked.

Transactions from the verified run on Monad Testnet:

- Grant: [`0x44b99ac0…f038f`](https://testnet.monadexplorer.com/tx/0x44b99ac0dbd53db34fe57f16ff8c171a57d0508c954b889eaeadf8ad2bdf038f)
- Revoke: [`0xb4bff885…f45525`](https://testnet.monadexplorer.com/tx/0xb4bff8851a79cfe89e7f24ffde93608fb8dae8fba48413834dbabb5625f45525)

The demo apps run inside this repository and call ContextPass **with the signed-in user's ContextPass session**. They do not have independent production app credentials.

## On-Chain Contract

| | |
| --- | --- |
| Contract | `ContextPassPermissions` ([`contracts/src/ContextPassPermissions.sol`](contracts/src/ContextPassPermissions.sol)) |
| Network | Monad Testnet |
| Chain ID | `10143` |
| Address | [`0xD6CEB04bC6C4F6c4b3AD3Ef742Dd0615B0eA248f`](https://testnet.monadexplorer.com/address/0xD6CEB04bC6C4F6c4b3AD3Ef742Dd0615B0eA248f) |

Core functions:

| Function | |
| --- | --- |
| `grantPermission(app, scope, expiresAt) → id` | The caller is the owner. Expiry is in the future and at most 365 days away. Re-granting renews the permission. |
| `revokePermission(id)` | Owner only. |
| `isPermissionActive(id) → bool` | Granted, not revoked, and not past `expiresAt`. |
| `permissionsOf(owner)`, `getPermission(id)`, `permissionId(owner, app, scope)` | Reads used by the app and the server. |

Identifiers:

- app key: `keccak256("contextpass.app:<slug>")`;
- scope key: `keccak256("contextpass.scope:<sorted scope ids>")`;
- permission id: `keccak256(abi.encode(owner, app, scope))`.

See [`contracts/README.md`](contracts/README.md) for deployment.

## Local Development

Requirements: Node.js 20.9+ and npm. For contract tests, [Foundry](https://getfoundry.sh). You also need a Privy app and a Supabase project.

```bash
# 1. Clone
git clone <repository-url> contextpass
cd contextpass

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp .env.example .env.local
```

4. Fill in `.env.local` (see [`.env.example`](.env.example) for where each value comes from).

   | Variable | Scope | Purpose |
   | --- | --- | --- |
   | `NEXT_PUBLIC_PRIVY_APP_ID` | public | Privy app |
   | `NEXT_PUBLIC_CONTEXTPASS_CONTRACT_ADDRESS` | public | Deployed contract (prefilled) |
   | `NEXT_PUBLIC_PRIVY_SPONSOR_GAS` | public | `true` to have Privy sponsor gas |
   | `PRIVY_APP_SECRET` | **server only** | Look up the user's embedded wallet |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Database access from the API |
   | `SUPABASE_DB_URL` | **server only** | Migrations only |

   Optional: `NEXT_PUBLIC_PRIVY_CLIENT_ID`, `NEXT_PUBLIC_MONAD_CHAIN_ID`, `NEXT_PUBLIC_MONAD_RPC_URL`.

5. Apply the database migrations (schema, row-level security, app registry):

   ```bash
   npm run db:migrate
   npm run db:migrate -- --status   # lists applied / pending migrations
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`, sign in, add context (or use **Add sample context**), then open CodePilot at `/apps/code-pilot`.

Privy dashboard setup:

- add your local origin to the allowed origins;
- enable email login and Ethereum embedded wallets;
- to sponsor gas, enable gas sponsorship **and** client-side sponsorship for Monad Testnet.

Without sponsorship, the embedded wallet needs testnet MON.

## Testing

```bash
npm test                 # server security suite + database isolation (Vitest)
npm run test:contracts   # Solidity tests (Foundry)
npm run typecheck        # TypeScript
npm run lint             # ESLint
npm run build            # production build
```

Current verified state:

| Check | Result |
| --- | --- |
| Server + database tests (`npm test`) | **62 / 62 passing** |
| Solidity / Foundry tests | **16 / 16 passing** |
| Typecheck | clean |
| Lint | clean |
| Production build | passing |

What the suites cover:

- **Database isolation** (`supabase/tests`) runs the real migrations in PGlite and checks that one user can never read or write another user's rows.
- **Server security** (`src/lib/server/__tests__`) runs the real route handlers and gate with Monad and Supabase stubbed. It covers:
  - forged, expired and wrong-audience tokens;
  - spoofed body identities;
  - slug swapping;
  - undeclared and unknown scopes;
  - revoked, expired and missing permissions;
  - partial scope grants;
  - reverted, wrong-contract, wrong-owner and replayed transactions;
  - cross-user request decisions;
  - ledger reconciliation with the chain.
- **Contract tests** (`contracts/test`) cover grant, renew, revoke, expiry, ownership and input validation.

## Hackathon Disclosure

AI coding tools (Claude Code) were used during development to help write, test and document the code. The project was directed by its developer. Every change was run and checked, including the live on-chain flows described above.

## Current Status / Limitations

Scope of this hackathon build:

- **AI responses use the built-in demo writer.**
  - CodePilot and StudyOS answer with a deterministic writer that personalises its answer from only the context ContextPass released.
  - The UI labels it ("Demo writer — no AI model was called").
  - No external AI provider is configured; Gemini is not integrated.
  - The code includes an optional Anthropic (Claude) provider path in `src/lib/server/ai.ts`. It activates only if `ANTHROPIC_API_KEY` is set. It is not configured and was not used in the demo.
- **Demo apps use the user's session.** CodePilot and StudyOS call ContextPass with the signed-in user's session, not with independent app credentials. An app still receives only what an on-chain permission for its own app key allows. Per-app credentials for third-party apps are the natural next step.
- **Expiry** is enforced by the contract (`isPermissionActive`) and covered by the automated tests. It has not been demonstrated as a live, wait-for-it end-to-end scenario.
- **Monad Testnet only.** The contract is deployed on testnet. No mainnet deployment.
- **Server database access** uses the Supabase service role with explicit owner scoping in every query. RLS policies are a tested second layer, not the primary enforcement path.

## Project Structure

```
contracts/                 Solidity contract, Foundry tests, deploy script (forge-std vendored in lib/)
supabase/migrations/       schema · row-level security · app registry seed
supabase/tests/            database isolation tests (PGlite)
scripts/migrate.mjs        applies migrations to SUPABASE_DB_URL
src/app/                   pages (landing, /connect, /app/*, /apps/[slug]) and API routes (/api/*)
src/components/            UI: app shell and screens, permission request pass, ledger, demo app
src/lib/server/            server only: auth, access gate, requests, chain verifier, context, db, AI
src/lib/chain/             contract config, ABI, ids, reads and transaction helpers
src/lib/contextpass-sdk/   typed client for consumer apps
src/lib/contextpass/       domain types, scopes, client state
src/lib/identity/          the Privy boundary (useIdentity)
```

## License

[MIT](LICENSE)
