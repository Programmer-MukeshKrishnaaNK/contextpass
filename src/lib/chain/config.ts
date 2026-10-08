import { defineChain, isAddress, type Address } from "viem";
import { monadTestnet } from "viem/chains";

/**
 * The single source of chain configuration.
 *
 * Defaults are viem's Monad Testnet definition, verified against the live
 * RPC (eth_chainId = 0x279f = 10143). Environment variables can override the
 * chain ID and RPC; the contract address only ever comes from the environment.
 */

const envChainId = Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || monadTestnet.id);
const envRpc = process.env.NEXT_PUBLIC_MONAD_RPC_URL?.trim() || monadTestnet.rpcUrls.default.http[0];

export const chain = defineChain({
  ...monadTestnet,
  id: envChainId,
  rpcUrls: { default: { http: [envRpc] } },
});

const rawAddress = process.env.NEXT_PUBLIC_CONTEXTPASS_CONTRACT_ADDRESS?.trim() ?? "";

export const CONTRACT_ADDRESS: Address | undefined = isAddress(rawAddress) ? rawAddress : undefined;

/** True once a deployed permission contract is configured. */
export const chainConfigured = Boolean(CONTRACT_ADDRESS);

/** Ask Privy to sponsor gas (requires sponsorship enabled for this chain in the Privy dashboard). */
export const SPONSOR_GAS = process.env.NEXT_PUBLIC_PRIVY_SPONSOR_GAS === "true";

export function explorerTx(hash: string): string | undefined {
  const base = chain.blockExplorers?.default.url;
  return base ? `${base}/tx/${hash}` : undefined;
}
