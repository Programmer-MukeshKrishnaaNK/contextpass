import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  encodeFunctionData,
  getAbiItem,
  http,
  InsufficientFundsError,
  UserRejectedRequestError,
  type Address,
  type Hex,
} from "viem";
import { contextPassPermissionsAbi as abi } from "./abi";
import { chain, CONTRACT_ADDRESS } from "./config";

/**
 * The permission service: the only module that reads from or encodes calls
 * for the ContextPass permission contract. UI code never builds calldata.
 * Signing happens in the identity layer, through the owner's embedded wallet.
 */

export const publicClient = createPublicClient({ chain, transport: http(), batch: { multicall: false } });

export interface ChainRecord {
  id: Hex;
  owner: Address;
  app: Hex;
  scope: Hex;
  /** Unix ms */
  grantedAt: number;
  expiresAt: number;
  revokedAt?: number;
  grantedBlock: bigint;
  revokedBlock?: bigint;
}

function requireAddress(): Address {
  if (!CONTRACT_ADDRESS) throw new Error("ContextPass permission contract is not configured");
  return CONTRACT_ADDRESS;
}

type RawPermission = {
  owner: Address;
  grantedAt: bigint;
  expiresAt: bigint;
  revokedAt: bigint;
  grantedBlock: bigint;
  revokedBlock: bigint;
  app: Hex;
  scope: Hex;
};

function toRecord(id: Hex, p: RawPermission): ChainRecord {
  return {
    id,
    owner: p.owner,
    app: p.app,
    scope: p.scope,
    grantedAt: Number(p.grantedAt) * 1000,
    expiresAt: Number(p.expiresAt) * 1000,
    revokedAt: p.revokedAt > BigInt(0) ? Number(p.revokedAt) * 1000 : undefined,
    grantedBlock: p.grantedBlock,
    revokedBlock: p.revokedBlock > BigInt(0) ? p.revokedBlock : undefined,
  };
}

/* ── Reads ───────────────────────────────────────────────────── */

/** Every permission this owner has granted, as currently recorded on Monad. */
export async function readPermissions(owner: Address): Promise<ChainRecord[]> {
  const [ids, records] = await publicClient.readContract({
    address: requireAddress(),
    abi,
    functionName: "permissionsOf",
    args: [owner],
  });
  return ids.map((id, i) => toRecord(id, records[i]));
}

export async function readPermission(id: Hex): Promise<ChainRecord | undefined> {
  const p = await publicClient.readContract({ address: requireAddress(), abi, functionName: "getPermission", args: [id] });
  return p.owner === "0x0000000000000000000000000000000000000000" ? undefined : toRecord(id, p);
}

export async function readIsActive(id: Hex): Promise<boolean> {
  return publicClient.readContract({ address: requireAddress(), abi, functionName: "isPermissionActive", args: [id] });
}

/**
 * The transaction that granted or revoked a permission. The contract stores
 * the block of each, so this is a one-block log query (Monad's RPC limits
 * eth_getLogs to 100-block ranges, so scanning history is not an option).
 */
export async function findTransaction(kind: "granted" | "revoked", id: Hex, block: bigint): Promise<Hex | undefined> {
  const range = { address: requireAddress(), args: { id }, fromBlock: block, toBlock: block } as const;
  const logs =
    kind === "granted"
      ? await publicClient.getLogs({ ...range, event: getAbiItem({ abi, name: "PermissionGranted" }) })
      : await publicClient.getLogs({ ...range, event: getAbiItem({ abi, name: "PermissionRevoked" }) });
  return logs.at(-1)?.transactionHash ?? undefined;
}

/* ── Writes (encoded here, signed by the identity layer) ─────── */

export interface ContractCall {
  to: Address;
  data: Hex;
  chainId: number;
}

export function grantCall(app: Hex, scope: Hex, expiresAtMs: number): ContractCall {
  return {
    to: requireAddress(),
    chainId: chain.id,
    data: encodeFunctionData({
      abi,
      functionName: "grantPermission",
      args: [app, scope, BigInt(Math.floor(expiresAtMs / 1000))],
    }),
  };
}

export function revokeCall(id: Hex): ContractCall {
  return {
    to: requireAddress(),
    chainId: chain.id,
    data: encodeFunctionData({ abi, functionName: "revokePermission", args: [id] }),
  };
}

const CONFIRM_TIMEOUT_MS = 90_000;

/** Resolves once Monad has included the transaction. Throws if it reverted or never confirmed. */
export async function waitForConfirmation(hash: Hex): Promise<void> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: CONFIRM_TIMEOUT_MS });
  if (receipt.status !== "success") throw new ContractFunctionRevertedError({ abi, functionName: "unknown" });
}

/* ── Failures, in ContextPass language ───────────────────────── */

export type FailureKind = "rejected" | "funds" | "sponsorship" | "reverted" | "network" | "timeout" | "unavailable";

export interface TxFailure {
  kind: FailureKind;
  /** One human sentence. Raw errors go to the console in development only. */
  detail: string;
}

export function describeFailure(error: unknown): TxFailure {
  if (process.env.NODE_ENV !== "production") console.warn("[chain]", error);

  const text = `${error instanceof Error ? error.message : String(error)} ${
    error instanceof BaseError ? error.details ?? "" : ""
  }`.toLowerCase();
  const walked = error instanceof BaseError ? error.walk() : undefined;

  if (walked instanceof UserRejectedRequestError || /user (rejected|denied|cancel)|rejected the request|exited|closed the modal|cancelled|canceled/.test(text)) {
    return { kind: "rejected", detail: "You closed the approval. Nothing was recorded." };
  }
  if (/sponsor/.test(text)) {
    return { kind: "sponsorship", detail: "Gas sponsorship isn’t active for Monad yet, so this couldn’t be recorded." };
  }
  if (walked instanceof InsufficientFundsError || /insufficient (funds|balance)|exceeds balance|not enough/.test(text)) {
    return { kind: "funds", detail: "This permission needs testnet funds to be recorded." };
  }
  if (walked instanceof ContractFunctionRevertedError || /revert/.test(text)) {
    return { kind: "reverted", detail: "Monad didn’t accept this change. Nothing was recorded." };
  }
  if (/timed? ?out|timeout/.test(text)) {
    return { kind: "timeout", detail: "Monad hasn’t confirmed it yet. Check again in a moment." };
  }
  if (/wallet|not ready|no embedded/.test(text) && !/fetch|network/.test(text)) {
    return { kind: "unavailable", detail: "Your signing key isn’t ready yet. Try again in a moment." };
  }
  return { kind: "network", detail: "Couldn’t reach Monad. Nothing was recorded. Try again." };
}
