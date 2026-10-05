import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";

export interface VisitGeo {
  ip: string;
  country: string | null;
  countryName: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  isLocal: boolean;
}

const COUNTRY_NAMES: Record<string, string> = {
  EG: "Egypt",
  SA: "Saudi Arabia",
  AE: "UAE",
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
};

export function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  const realIp = c.req.header("x-real-ip");
  if (realIp) return normalizeIp(realIp.trim());
  try {
    const remote = getConnInfo(c).remote.address;
    if (remote) return normalizeIp(remote);
  } catch {
    /* not node adapter */
  }
  return "unknown";
}

function normalizeIp(ip: string): string {
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

function isLocalIp(ip: string): boolean {
  return (
    ip === "unknown" ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip === "localhost"
  );
}

export function lookupGeo(ip: string): VisitGeo {
  if (isLocalIp(ip)) {
    return {
      ip,
      country: null,
      countryName: "Local / private network",
      city: null,
      region: null,
      timezone: null,
      isLocal: true,
    };
  }

  const geo = geoip.lookup(ip);
  const country = geo?.country ?? null;
  return {
    ip,
    country,
    countryName: country ? (COUNTRY_NAMES[country] ?? country) : null,
    city: geo?.city ?? null,
    region: geo?.region ?? null,
    timezone: geo?.timezone ?? null,
    isLocal: false,
  };
}

export interface VisitDeviceInfo {
  type: string;
  browser: string;
  os: string;
  language: string | null;
  screen: string | null;
  timezone: string | null;
}

export function buildDeviceInfo(
  parser: InstanceType<typeof UAParser>,
  sdkDevice?: Record<string, string>
): VisitDeviceInfo {
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  return {
    type: device.type || "desktop",
    browser: [browser.name, browser.version].filter(Boolean).join(" ") || "Unknown",
    os: [os.name, os.version].filter(Boolean).join(" ") || "Unknown",
    language: sdkDevice?.language ?? null,
    screen: sdkDevice?.screen ?? null,
    timezone: sdkDevice?.timezone ?? null,
  };
}
