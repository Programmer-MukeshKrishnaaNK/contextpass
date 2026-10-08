import "server-only";
import { getAddress, isHash, parseEventLogs, type Address, type Hex } from "viem";
import { contextPassPermissionsAbi as abi } from "@/lib/chain/abi";
import { CONTRACT_ADDRESS } from "@/lib/chain/config";
import { publicClient, readIsActive, readPermission, type ChainRecord } from "@/lib/chain/permissions";
import { conflict, invalid, unavailable } from "./http";

/**
 * Chain checks for the server. A transaction hash from the browser is only a
 * pointer: the server fetches the receipt from Monad and requires the exact
 * event from the ContextPass contract for this permission and this owner,
 * then reads the contract's current state.
 */

export function contract(): Address {
  if (!CONTRACT_ADDRESS) throw unavailable("The permission contract isn’t configured on this server.");
  return CONTRACT_ADDRESS;
}

function asHash(value: unknown, what: string): Hex {
  if (typeof value !== "string" || !isHash(value)) throw invalid(`${what} must be a 32-byte hex value.`);
  return value.toLowerCase() as Hex;
}

export const parseTxHash = (v: unknown) => asHash(v, "transactionHash");
export const parsePermissionId = (v: unknown) => asHash(v, "permissionId");

async function chainCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[contextpass] chain", error);
    throw unavailable("Monad couldn’t be reached to verify this. Try again in a moment.");
  }
}

/**
 * Confirms `hash` is a successful transaction that emitted `eventName` from
 * the ContextPass contract for permission `id` owned by `owner`.
 * Returns the block it landed in.
 */
export async function verifyPermissionTx(
  eventName: "PermissionGranted" | "PermissionRevoked",
  hash: Hex,
  id: Hex,
  owner: Address,
): Promise<{ blockNumber: bigint }> {
  const receipt = await chainCall(() => publicClient.waitForTransactionReceipt({ hash, timeout: 45_000 }));
  if (receipt.status !== "success") throw conflict("That transaction didn’t succeed on Monad.");

  const events = parseEventLogs({ abi, eventName, logs: receipt.logs }).filter(
    (log) => getAddress(log.address) === getAddress(contract()),
  );
  const match = events.find(
    (log) => log.args.id.toLowerCase() === id.toLowerCase() && getAddress(log.args.owner) === getAddress(owner),
  );
  if (!match) throw conflict("That transaction doesn’t record this permission for your identity.");
  return { blockNumber: receipt.blockNumber };
}

export const isActiveOnChain = (id: Hex) => chainCall(() => readIsActive(id));
export const permissionOnChain = (id: Hex): Promise<ChainRecord | undefined> => chainCall(() => readPermission(id));
