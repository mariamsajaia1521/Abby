import { useCallback, useEffect, useRef, useState } from "react";
import { startWalk, updateWalk } from "./api";
import { acceptPosition, routeDistance } from "./domain";
import { errorMessage } from "./supabase";
import type { Mood, Pet, RoutePoint, WalkSession } from "./types";

function gpsError(cause: GeolocationPositionError): Error {
  return new Error(
    cause.code === 1
      ? "USER:მდებარეობაზე წვდომა უარყოფილია. სეირნობის დასაწყებად ჩართე მდებარეობის ნებართვა ბრაუზერში."
      : cause.code === 3
        ? "USER:მდებარეობის მიღებას დრო დასჭირდა. გადი ღია სივრცეში და სცადე ხელახლა."
        : "USER:GPS მდებარეობა მიუწვდომელია. გადაამოწმე მოწყობილობის პარამეტრები.",
  );
}
function currentPosition(): Promise<GeolocationPosition> {
  if (!window.isSecureContext || !navigator.geolocation)
    return Promise.reject(
      new Error("USER:GPS-ს სჭირდება HTTPS კავშირი და მდებარეობის მხარდაჭერა."),
    );
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      resolve,
      (cause) => reject(gpsError(cause)),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    ),
  );
}
const pointFrom = (position: GeolocationPosition): RoutePoint => ({
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  accuracy: position.coords.accuracy,
  timestamp: Math.round(position.timestamp),
});

export function useWalkTracker(
  pet: Pet,
  walks: WalkSession[],
  onChanged: () => Promise<void>,
) {
  const [session, setSession] = useState<WalkSession | null>(null);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [tracking, setTracking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gpsStatus, setGpsStatus] = useState("მდებარეობა ჯერ არ არის ჩართული");
  const [now, setNow] = useState(Date.now());
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const sessionRef = useRef<WalkSession | null>(null);
  const routeRef = useRef<RoutePoint[]>([]);
  const watch = useRef<number | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const dirty = useRef(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    if (sessionRef.current?.pet_id === pet.id) return;
    const active = walks.find((walk) => !walk.ended_at) || null;
    sessionRef.current = active;
    routeRef.current = active?.route || [];
    setSession(active);
    setRoute(active?.route || []);
    setLastSaved(active ? Date.now() : null);
  }, [pet.id, walks]);
  const pause = useCallback(() => {
    if (watch.current !== null) {
      navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    }
    setTracking(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
    };
  }, []);
  const persist = useCallback(() => {
    if (!sessionRef.current || !dirty.current) return queue.current;
    const id = sessionRef.current.id;
    const snapshot = [...routeRef.current];
    dirty.current = false;
    queue.current = queue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await updateWalk(id, snapshot);
          if (mounted.current) {
            setLastSaved(Date.now());
            setError("");
          }
        } catch (cause) {
          dirty.current = true;
          if (mounted.current) setError(errorMessage(cause));
          throw cause;
        }
      });
    return queue.current;
  }, []);
  useEffect(() => {
    if (!tracking) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    const sync = setInterval(() => {
      void persist().catch(() => undefined);
    }, 10_000);
    return () => {
      clearInterval(timer);
      clearInterval(sync);
    };
  }, [tracking, persist]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (watch.current !== null || dirty.current) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  async function begin(mood: Mood) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setGpsStatus("GPS სიგნალის ძიება…");
    try {
      const position = pointFrom(await currentPosition());
      if (!acceptPosition(undefined, position))
        throw new Error(
          "USER:GPS სიზუსტე არასაკმარისია. გადი ღია სივრცეში და სცადე ხელახლა.",
        );
      const current = sessionRef.current || (await startWalk(pet.id, mood));
      if (!mounted.current) return;
      sessionRef.current = current;
      setSession(current);
      if (!routeRef.current.length) {
        routeRef.current = [position];
        setRoute([position]);
        dirty.current = true;
      } else if (
        position.timestamp - routeRef.current.at(-1)!.timestamp >=
        1000
      ) {
        routeRef.current = [
          ...routeRef.current,
          { ...position, segment_start: true },
        ];
        setRoute(routeRef.current);
        dirty.current = true;
      }
      setGpsStatus(`GPS სიზუსტე: ±${Math.round(position.accuracy)} მ`);
      setTracking(true);
      setNow(Date.now());
      watch.current = navigator.geolocation.watchPosition(
        (value) => {
          const point = pointFrom(value);
          const last = routeRef.current.at(-1);
          if (!acceptPosition(last, point)) {
            if (point.accuracy > 50)
              setGpsStatus("GPS სიგნალი სუსტია — ველოდებით ზუსტ მდებარეობას");
            return;
          }
          routeRef.current = [...routeRef.current, point];
          setRoute(routeRef.current);
          dirty.current = true;
          setGpsStatus(`GPS სიზუსტე: ±${Math.round(point.accuracy)} მ`);
          if (routeRef.current.length >= 10_000) {
            pause();
            setError(
              "სეირნობამ ჩანაწერების ზღვარს მიაღწია. შეინახე მიმდინარე მარშრუტი.",
            );
          }
        },
        (cause) => {
          setError(gpsError(cause).message.replace("USER:", ""));
          pause();
          void persist().catch(() => undefined);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
      );
      await persist().catch(() => undefined);
    } catch (cause) {
      if (mounted.current) {
        setError(errorMessage(cause));
        setGpsStatus("მდებარეობის მიღება ვერ მოხერხდა");
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function finish() {
    if (lock.current || !sessionRef.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    pause();
    try {
      await queue.current.catch(() => undefined);
      await updateWalk(sessionRef.current.id, [...routeRef.current], true);
      dirty.current = false;
      await onChanged();
      sessionRef.current = null;
      routeRef.current = [];
      setSession(null);
      setRoute([]);
      setGpsStatus("სეირნობა შენახულია");
      setLastSaved(Date.now());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function pauseAndSave() {
    pause();
    await persist().catch(() => undefined);
  }
  const elapsed = session
    ? Math.max(0, Math.floor((now - Date.parse(session.started_at)) / 1000))
    : 0;
  return {
    session,
    route,
    tracking,
    busy,
    error,
    gpsStatus,
    lastSaved,
    elapsed,
    distance: routeDistance(route),
    begin,
    finish,
    pauseAndSave,
    active: !!session,
  };
}
export type WalkTracker = ReturnType<typeof useWalkTracker>;
