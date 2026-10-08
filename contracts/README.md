# ContextPass permission contract

`src/ContextPassPermissions.sol` — the on-chain record of what an owner has allowed an AI app to access, and until when.

It stores **permission metadata only**: owner (always `msg.sender`), an app identifier, a scope identifier, timestamps and the revocation state. App and scope are opaque `bytes32` hashes resolved off-chain by ContextPass. No context, email or personal data is ever written on-chain.

| Function | |
| --- | --- |
| `grantPermission(app, scope, expiresAt) → id` | Caller is the owner. Expiry must be in the future and within 365 days. Re-granting the same app + scope renews it. |
| `revokePermission(id)` | Owner only. Records `revokedAt` and `revokedBlock`. |
| `isPermissionActive(id) → bool` | Granted, not revoked, and `block.timestamp < expiresAt`. |
| `getPermission(id)` / `permissionsOf(owner)` | Reads for the frontend. |
| `permissionId(owner, app, scope)` | `keccak256(abi.encode(owner, app, scope))` — deterministic. |

Each record stores the block it was granted and revoked in, so clients can fetch the exact transaction with a one-block `eth_getLogs` query (Monad's RPC limits log queries to 100 blocks).

## Test

```bash
forge test -vv
```

## Deploy (Monad Testnet, chain 10143)

The key is never stored in this repository. Import it once into an encrypted Foundry keystore:

```bash
cast wallet import contextpass-deployer --interactive
forge script script/Deploy.s.sol --rpc-url monad_testnet --account contextpass-deployer --broadcast
```

Then set `NEXT_PUBLIC_CONTEXTPASS_CONTRACT_ADDRESS` in `../.env.local`.

After changing the contract, regenerate the frontend ABI:

```bash
forge inspect ContextPassPermissions abi --json
```

and update `src/lib/chain/abi.ts`.
