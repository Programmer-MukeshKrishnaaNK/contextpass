/**
 * Identity configuration. Values come from the environment only
 * (see .env.example) and are read once at build time.
 */
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() || "";
export const PRIVY_CLIENT_ID = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID?.trim() || undefined;

export const identityConfigured = PRIVY_APP_ID.length > 0;
