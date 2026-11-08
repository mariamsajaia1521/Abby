import type { RoutePoint } from "./types.ts";

export type Gate = "auth" | "verify" | "onboarding" | "dashboard";
export function entryGate(
  authenticated: boolean,
  emailVerified: boolean,
  petCount: number,
): Gate {
  if (!authenticated) return "auth";
  if (!emailVerified) return "verify";
  return petCount > 0 ? "dashboard" : "onboarding";
}
export function distanceMeters(
  a: Pick<RoutePoint, "lat" | "lng">,
  b: Pick<RoutePoint, "lat" | "lng">,
): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return (
    6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function routeDistance(route: RoutePoint[]): number {
  return route
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum + (point.segment_start ? 0 : distanceMeters(route[index], point)),
      0,
    );
}
export function acceptPosition(
  last: RoutePoint | undefined,
  point: RoutePoint,
): boolean {
  if (
    ![point.lat, point.lng, point.timestamp, point.accuracy].every(
      Number.isFinite,
    ) ||
    Math.abs(point.lat) > 90 ||
    Math.abs(point.lng) > 180 ||
    point.accuracy < 0 ||
    point.accuracy > 50
  )
    return false;
  if (!last) return true;
  const seconds = (point.timestamp - last.timestamp) / 1000;
  const meters = distanceMeters(last, point);
  return seconds >= 1 && meters >= 3 && meters / seconds <= 5;
}
export function phoneHref(value: string): string | null {
  const phone = value.trim().replace(/[\s().-]/g, "");
  return /^\+?\d{7,15}$/.test(phone) ? `tel:${phone}` : null;
}
export function safeWebsite(value: string | null): string | undefined {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
