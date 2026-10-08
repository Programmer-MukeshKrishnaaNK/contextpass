import { encodeAbiParameters, keccak256, stringToHex, type Address, type Hex } from "viem";
import { LEGACY_SCOPE_ALIASES, SCOPES, type ScopeId } from "@/lib/contextpass/scopes";

/**
 * Stable on-chain identifiers.
 *
 * Only these opaque hashes go on-chain — never the context itself, never a
 * label that could change. The same app and scope set always resolve to the
 * same key, on the client and on the server.
 */

/** keccak256("contextpass.app:<slug>") */
export function appKey(slug: string): Hex {
  return keccak256(stringToHex(`contextpass.app:${slug}`));
}

/** Canonical form of a scope set: unique and sorted, so order never changes the key. */
export function canonicalScopes<T extends string>(scopes: readonly T[]): T[] {
  return [...new Set(scopes)].sort();
}

/** keccak256("contextpass.scope:<sorted,scope,ids>") */
export function scopeKey(scopes: readonly string[]): Hex {
  return keccak256(stringToHex(`contextpass.scope:${canonicalScopes(scopes).join(",")}`));
}

/** Mirrors ContextPassPermissions.permissionId(owner, app, scope). */
export function permissionId(owner: Address, app: Hex, scope: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: "address" }, { type: "bytes32" }, { type: "bytes32" }], [owner, app, scope]));
}

function subsets<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let mask = 1; mask < 1 << items.length; mask++) out.push(items.filter((_, i) => mask & (1 << i)));
  return out;
}

/**
 * Scope key → the scopes it covers, for every non-empty subset of the
 * current scopes, plus Phase 3 keys (read-only, mapped to their successors).
 */
export const SCOPE_LOOKUP: ReadonlyMap<Hex, ScopeId[]> = (() => {
  const map = new Map<Hex, ScopeId[]>();
  for (const legacy of subsets(Object.keys(LEGACY_SCOPE_ALIASES))) {
    map.set(scopeKey(legacy), canonicalScopes(legacy.map((s) => LEGACY_SCOPE_ALIASES[s])));
  }
  for (const subset of subsets(SCOPES)) map.set(scopeKey(subset), canonicalScopes(subset));
  return map;
})();
