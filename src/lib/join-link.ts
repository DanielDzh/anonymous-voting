import "server-only";
import { networkInterfaces } from "node:os";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { CODE_QUERY_PARAM } from "@/config/voting";

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** First non-internal IPv4 of this machine — the address phones on the same network can reach. */
const lanIPv4 = (): string | null =>
  Object.values(networkInterfaces())
    .flat()
    .find((address) => address?.family === "IPv4" && !address.internal)?.address ?? null;

/**
 * Where the QR should point:
 * 1. PUBLIC_URL, when set (real deployments, custom domains).
 * 2. Otherwise the request's own origin — except that a loopback host is swapped for the
 *    machine's LAN IP, so a QR shown from http://localhost still opens on a phone,
 *    and keeps working when the Mac moves to another network (e.g. a phone hotspot).
 */
const siteOrigin = async (): Promise<string> => {
  const configured = process.env.PUBLIC_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  // Proxies (Vercel, tunnels) set x-forwarded-proto; a direct hit on `next start` is plain http.
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() ?? "http";

  const [hostname, port] = host.startsWith("[") ? [host.slice(0, host.indexOf("]") + 1), host.split("]:")[1]] : host.split(":");
  const lan = LOOPBACK_HOSTS.includes(hostname) ? lanIPv4() : null;
  return `${protocol}://${lan ?? hostname}${port ? `:${port}` : ""}`;
};

export const buildJoinUrl = async (accessCode: string): Promise<string> =>
  `${await siteOrigin()}/?${CODE_QUERY_PARAM}=${encodeURIComponent(accessCode)}`;

/** Black-on-white with a quiet zone: the most reliably scannable combination, whatever the theme. */
export const renderQrSvg = (url: string): Promise<string> =>
  QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
