"use client";

/**
 * The ContextPass identity boundary.
 *
 *   Privy  →  authenticated user  →  ContextPassIdentity  →  UI
 *
 * This is the only module that talks to Privy. Everything else reads
 * `useIdentity()` and never sees Privy's user object, so the provider can
 * change without touching the product.
 *
 * Permission decisions are signed here, by the owner's embedded wallet,
 * through `send()`. Calls are encoded by the permission service
 * (src/lib/chain); this module only asks the owner to approve and submits.
 */

import {
  PrivyProvider,
  useCreateWallet,
  useLogin,
  useLogout,
  usePrivy,
  useSendTransaction,
  useWallets,
  type PrivyClientConfig,
  type User,
} from "@privy-io/react-auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { chain, SPONSOR_GAS } from "@/lib/chain/config";
import type { ContractCall } from "@/lib/chain/permissions";
import { identityConfigured, PRIVY_APP_ID, PRIVY_CLIENT_ID } from "./config";

/* ───────────────────────────────────────────────────────────── */

export type IdentityStatus =
  /** No Privy app ID in the environment. */
  | "unconfigured"
  /** Privy is restoring or checking a session. */
  | "initializing"
  | "signed-out"
  | "signed-in";

export interface IdentityIssue {
  kind: "cancelled" | "failed" | "unconfigured" | "wallet";
  /** Human sentence, safe to show. Raw error codes go to the console only. */
  message: string;
}

export interface ContextPassIdentity {
  status: IdentityStatus;
  /** True while the sign-in flow is open. */
  connecting: boolean;
  /** Privy user ID (DID). Stable owner key for context and permissions. */
  userId?: string;
  /** How the owner signed in — an email or social handle, shown quietly. */
  contact?: string;
  /** When this ContextPass identity was created. */
  since?: number;
  /** The owner's embedded Ethereum wallet: the future signing key for permissions. */
  walletAddress?: `0x${string}`;
  wallet: "none" | "preparing" | "ready";
  issue?: IdentityIssue;
  connect: () => void;
  disconnect: () => Promise<void>;
  dismissIssue: () => void;
  /** EIP-1193 provider of the embedded wallet. */
  getEthereumProvider: () => Promise<unknown | null>;
  /**
   * Ask the owner to approve a contract call, then submit it from their
   * embedded wallet. Resolves with the transaction hash once submitted
   * (not yet confirmed). Rejects if the owner closes the approval.
   */
  send: (call: ContractCall, approval: ApprovalCopy) => Promise<`0x${string}`>;
  /** A fresh Privy access token, for the ContextPass server to verify. Null when signed out. */
  getAccessToken: () => Promise<string | null>;
}

/** Words for the approval step, in ContextPass language. */
export interface ApprovalCopy {
  description: string;
  buttonText: string;
  /** Shown by the signing step once Monad has the transaction. */
  successHeader: string;
  successDescription: string;
}

const noop = () => {};

const UNCONFIGURED: ContextPassIdentity = {
  status: "unconfigured",
  connecting: false,
  wallet: "none",
  issue: { kind: "unconfigured", message: "Sign-in isn’t set up for this deployment yet." },
  connect: noop,
  disconnect: async () => {},
  dismissIssue: noop,
  getEthereumProvider: async () => null,
  send: async () => {
    throw new Error("Sign-in is not configured");
  },
  getAccessToken: async () => null,
};

const IdentityContext = createContext<ContextPassIdentity>(UNCONFIGURED);

export function useIdentity(): ContextPassIdentity {
  return useContext(IdentityContext);
}

/* ───────────────────────────────────────────────────────────── */

/** Privy's modal, dressed as ContextPass: paper, ink, the mark. No wallet UI. */
const PRIVY_CONFIG: PrivyClientConfig = {
  appearance: {
    theme: "#f8f6f0",
    accentColor: "#16150f",
    logo: "/contextpass-mark.svg",
    landingHeader: "Connect ContextPass",
    loginMessage: "Your context. Your control.",
    walletChainType: "ethereum-only",
    showWalletLoginFirst: false,
  },
  // Permissions live on Monad. The embedded wallet uses it by default.
  defaultChain: chain,
  supportedChains: [chain],
  embeddedWallets: {
    // Every owner gets an embedded wallet as their signing identity.
    ethereum: { createOnLogin: "users-without-wallets" },
    // ContextPass is not a wallet app: no wallet screens by default. The one
    // exception is the approval step for a permission decision (see send()).
    showWalletUIs: false,
  },
};

export function IdentityProvider({ children }: { children: ReactNode }) {
  if (!identityConfigured) {
    return <IdentityContext.Provider value={UNCONFIGURED}>{children}</IdentityContext.Provider>;
  }
  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID} config={PRIVY_CONFIG}>
      <IdentityBridge>{children}</IdentityBridge>
    </PrivyProvider>
  );
}

/* ───────────────────────────────────────────────────────────── */

const EMBEDDED_CLIENTS = new Set(["privy", "privy-v2"]);

function embeddedAddress(user: User | null): `0x${string}` | undefined {
  const account = user?.linkedAccounts.find(
    (a) => a.type === "wallet" && a.chainType === "ethereum" && EMBEDDED_CLIENTS.has(a.walletClientType ?? ""),
  );
  return account && "address" in account ? (account.address as `0x${string}`) : undefined;
}

function contactOf(user: User | null): string | undefined {
  if (!user) return undefined;
  return (
    user.email?.address ??
    user.google?.email ??
    user.apple?.email ??
    (user.github?.username ? `@${user.github.username}` : undefined) ??
    (user.twitter?.username ? `@${user.twitter.username}` : undefined) ??
    user.phone?.number ??
    undefined
  );
}

function issueFor(code: string): IdentityIssue {
  if (code === "exited_auth_flow" || code === "oauth_user_denied") {
    return { kind: "cancelled", message: "Connection wasn’t completed. Try again." };
  }
  if (code === "missing_or_invalid_privy_app_id" || code === "allowlist_rejected") {
    return { kind: "unconfigured", message: "Sign-in isn’t set up correctly for this deployment." };
  }
  return { kind: "failed", message: "Something interrupted the connection. Try again." };
}

function IdentityBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [connecting, setConnecting] = useState(false);
  const [issue, setIssue] = useState<IdentityIssue>();

  const { login } = useLogin({
    onComplete: () => {
      setConnecting(false);
      setIssue(undefined);
    },
    onError: (code) => {
      setConnecting(false);
      setIssue(issueFor(String(code)));
      if (process.env.NODE_ENV !== "production") console.warn("[identity] sign-in ended:", code);
    },
  });

  const { logout } = useLogout();

  const { createWallet } = useCreateWallet({
    onError: (code) => {
      setIssue({ kind: "wallet", message: "Your signing key isn’t ready yet. It will be set up next time you connect." });
      if (process.env.NODE_ENV !== "production") console.warn("[identity] embedded wallet:", code);
    },
  });

  const walletAddress = embeddedAddress(user);

  // Owners who signed up before wallets were enabled get one on their next visit.
  const creating = useRef(false);
  useEffect(() => {
    if (!ready || !authenticated || !walletsReady || walletAddress || creating.current) return;
    creating.current = true;
    createWallet().catch(() => {
      /* reported through onError */
    });
  }, [ready, authenticated, walletsReady, walletAddress, createWallet]);

  const connect = useCallback(() => {
    setIssue(undefined);
    setConnecting(true);
    login();
  }, [login]);

  const disconnect = useCallback(async () => {
    creating.current = false;
    await logout();
  }, [logout]);

  const { sendTransaction } = useSendTransaction();

  const send = useCallback(
    async (call: ContractCall, approval: ApprovalCopy) => {
      if (!walletAddress) throw new Error("No embedded wallet is ready");
      const { hash } = await sendTransaction(
        { to: call.to, data: call.data, chainId: call.chainId },
        {
          address: walletAddress,
          sponsor: SPONSOR_GAS,
          uiOptions: {
            showWalletUIs: true,
            description: approval.description,
            buttonText: approval.buttonText,
            successHeader: approval.successHeader,
            successDescription: approval.successDescription,
            isCancellable: true,
          },
        },
      );
      return hash;
    },
    [sendTransaction, walletAddress],
  );

  const getEthereumProvider = useCallback(async () => {
    const wallet = wallets.find((w) => EMBEDDED_CLIENTS.has(w.walletClientType));
    return wallet ? wallet.getEthereumProvider() : null;
  }, [wallets]);

  const value = useMemo<ContextPassIdentity>(
    () => ({
      status: !ready ? "initializing" : authenticated ? "signed-in" : "signed-out",
      connecting,
      userId: authenticated ? user?.id : undefined,
      contact: authenticated ? contactOf(user) : undefined,
      since: authenticated && user ? new Date(user.createdAt).getTime() : undefined,
      walletAddress: authenticated ? walletAddress : undefined,
      wallet: !authenticated ? "none" : walletAddress ? "ready" : "preparing",
      issue,
      connect,
      disconnect,
      dismissIssue: () => setIssue(undefined),
      getEthereumProvider,
      send,
      getAccessToken,
    }),
    [ready, authenticated, user, walletAddress, connecting, issue, connect, disconnect, getEthereumProvider, send, getAccessToken],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}
