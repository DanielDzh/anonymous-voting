import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * This machine's LAN IPv4 addresses (Wi-Fi, phone hotspot…). Phones on the same network open
 * the dev server by IP, and Next blocks dev scripts for any hostname it doesn't know, which
 * leaves the page without JavaScript (no animations, buttons do nothing). Computed at startup,
 * so switching networks only needs a dev-server restart, not a config edit. Dev-only setting.
 */
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .flatMap((address) => (address && address.family === "IPv4" && !address.internal ? [address.address] : []));

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: lanAddresses,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
