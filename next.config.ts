import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A lockfile higher up the filesystem would otherwise be picked as the root.
  turbopack: {
    root: __dirname,
  },
  // Keep demos free of framework chrome.
  devIndicators: false,
};

export default nextConfig;
