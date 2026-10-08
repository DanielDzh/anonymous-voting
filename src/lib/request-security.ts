import "server-only";
import { headers } from "next/headers";

/**
 * True when the visitor reached us over HTTPS (directly or via a proxy).
 * Cookies get `secure` only then: browsers drop secure cookies on plain http://<LAN-IP>,
 * which would silently break admin login and the repeat-vote guard when testing over Wi-Fi.
 */
export const isHttpsRequest = async (): Promise<boolean> => {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return process.env.PUBLIC_URL?.startsWith("https://") ?? false;
};
