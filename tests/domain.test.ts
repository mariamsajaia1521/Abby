import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptPosition,
  distanceMeters,
  entryGate,
  phoneHref,
  routeDistance,
  safeWebsite,
} from "../src/domain.ts";
import { daysUntil } from "../src/dates.ts";

test("all entry paths enforce authentication, verification, and a saved pet in order", () => {
  for (const count of [0, 1, 10]) {
    assert.equal(entryGate(false, false, count), "auth");
    assert.equal(entryGate(false, true, count), "auth");
    assert.equal(entryGate(true, false, count), "verify");
  }
  assert.equal(entryGate(true, true, 0), "onboarding");
  assert.equal(entryGate(true, true, 1), "dashboard");
});
test("GPS uses the actual path and rejects jitter, low precision, impossible speed and stale time", () => {
  const first = { lat: 0, lng: 0, timestamp: 1000, accuracy: 5 };
  const next = { lat: 0, lng: 0.0001, timestamp: 11000, accuracy: 5 };
  assert.equal(routeDistance([]), 0);
  assert.equal(routeDistance([first]), 0);
  assert.equal(routeDistance([first, { ...next, segment_start: true }]), 0);
  assert.ok(Math.abs(distanceMeters(first, next) - 11.11949) < 0.01);
  assert.equal(acceptPosition(first, next), true);
  assert.equal(acceptPosition(first, { ...next, timestamp: 1500 }), false);
  assert.equal(acceptPosition(first, { ...next, accuracy: 51 }), false);
  assert.equal(acceptPosition(first, { ...next, lng: 0.000001 }), false);
  assert.equal(acceptPosition(first, { ...next, timestamp: 500 }), false);
  assert.equal(acceptPosition(undefined, { ...first, lat: 91 }), false);
  assert.equal(acceptPosition(undefined, { ...first, lng: NaN }), false);
});
test("countdowns measure calendar days across year and daylight-saving boundaries", () => {
  assert.equal(daysUntil("2027-01-01", "2026-12-31"), 1);
  assert.equal(daysUntil("2026-03-30", "2026-03-28"), 2);
  assert.equal(daysUntil("2026-11-09", "2026-11-09"), 0);
  assert.equal(daysUntil("2026-11-08", "2026-11-09"), -1);
});
test("contact links cannot execute scripts or accept malformed phone values", () => {
  assert.equal(phoneHref("javascript:alert(1)"), null);
  assert.equal(phoneHref("+995 (555) 00-00-00"), "tel:+995555000000");
  assert.equal(phoneHref("1"), null);
  assert.equal(safeWebsite("javascript:alert(1)"), undefined);
  assert.equal(safeWebsite("http://example.org"), undefined);
  assert.equal(safeWebsite("https://example.org"), "https://example.org/");
});
