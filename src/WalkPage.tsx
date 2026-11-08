import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { deleteWalk, getWalk } from "./api";
import { formatDate } from "./dates";
import { errorMessage } from "./supabase";
import {
  ArrowRight,
  Check,
  MapPin,
  Play,
  ShieldCheck,
  Trash2,
} from "./components/icons";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorNotice,
  SectionHead,
} from "./components/UI";
import type { WalkTracker } from "./useWalkTracker";
import type { Mood, Pet, RoutePoint, WalkSession } from "./types";

function LiveMap({
  route,
  tracking,
}: {
  route: RoutePoint[];
  tracking: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const line = useRef<L.Polyline | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const [tileError, setTileError] = useState(false);
  const center = route.at(-1);
  useEffect(() => {
    if (!container.current || !center || mapRef.current) return;
    const map = L.map(container.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([center.lat, center.lng], 17);
    mapRef.current = map;
    const tiles = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      },
    );
    tiles.on("tileerror", () => setTileError(true));
    tiles.on("load", () => setTileError(false));
    tiles.addTo(map);
    line.current = L.polyline([], {
      color: "#1B4332",
      weight: 5,
      opacity: 0.9,
    }).addTo(map);
    marker.current = L.circleMarker([center.lat, center.lng], {
      radius: 9,
      color: "#fff",
      fillColor: "#E07A5F",
      fillOpacity: 1,
      weight: 3,
    }).addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      line.current = null;
      marker.current = null;
    };
  }, [!!center]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    const segments: L.LatLngExpression[][] = [];
    for (const point of route) {
      if (!segments.length || point.segment_start) segments.push([]);
      segments.at(-1)!.push([point.lat, point.lng]);
    }
    line.current?.setLatLngs(segments);
    marker.current?.setLatLng([center.lat, center.lng]);
    if (tracking || route.length === 1) map.panTo([center.lat, center.lng]);
    else if (route.length > 1)
      map.fitBounds(
        L.latLngBounds(route.map((point) => [point.lat, point.lng])),
        { padding: [30, 30], maxZoom: 17 },
      );
  }, [route, tracking]);
  return (
    <div className="map-wrap">
      <div
        ref={container}
        className="leaflet-map"
        role="region"
        aria-label="სეირნობის მარშრუტის რუკა"
      />
      {!center && (
        <div className="map-empty">
          <EmptyState
            kind="walk"
            title="თქვენი შემდეგი თავგადასავალი"
            description="სეირნობის დაწყებისას რუკაზე შენი რეალური მდებარეობა გამოჩნდება."
          />
        </div>
      )}
      {tileError && (
        <span className="map-tile-error" role="status">
          რუკის ფონი ვერ ჩაიტვირთა. მარშრუტის ჩაწერა გრძელდება.
        </span>
      )}
    </div>
  );
}

export function WalkPage({
  pet,
  walks,
  tracker,
  onChanged,
}: {
  pet: Pet;
  walks: WalkSession[];
  tracker: WalkTracker;
  onChanged: () => Promise<void>;
}) {
  const [mood, setMood] = useState<Mood | "">("");
  const [deleting, setDeleting] = useState<WalkSession | null>(null);
  const [view, setView] = useState<WalkSession | null>(null);
  const [viewLoading, setViewLoading] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const completed = walks.filter((walk) => walk.ended_at);
  const coins = completed.reduce((sum, walk) => sum + walk.paw_coins, 0);
  const minutes = Math.floor(tracker.elapsed / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (tracker.elapsed % 60).toString().padStart(2, "0");
  async function openWalk(walk: WalkSession) {
    if (viewLoading) return;
    setViewLoading(walk.id);
    setError("");
    try {
      setView(await getWalk(walk.id));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setViewLoading("");
    }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setError("");
    try {
      await deleteWalk(deleting.id);
      await onChanged();
      setDeleting(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionHead
        eyebrow="ბედნიერებას პატარა ნაბიჯები აქვს"
        title="სეირნობის რადარი"
        description="ჩაწერე თქვენი გზა და გადააქციე ერთად გატარებული დრო PawCoins-ად."
      >
        <span className="coin-balance">
          <span>✦</span>
          {coins}
          <small>PawCoins</small>
        </span>
      </SectionHead>
      <div className="walk-layout">
        <section className="card walk-map-card">
          <div className="card-heading">
            <span className={`gps-indicator ${tracker.tracking ? "live" : ""}`}>
              <span />
              {tracker.tracking
                ? "სეირნობა მიმდინარეობს"
                : tracker.session
                  ? "სეირნობა შეჩერებულია"
                  : "მზად ვართ თავგადასავლისთვის"}
            </span>
            <span className="map-private">
              <ShieldCheck size={15} />
              პირადი მარშრუტი
            </span>
          </div>
          <LiveMap route={tracker.route} tracking={tracker.tracking} />
          <p className="gps-status">{tracker.gpsStatus}</p>
        </section>
        <aside className="card walk-controls">
          <span className="eyebrow">{pet.name} და შენ</span>
          <h2>დღეს რა განწყობაზეა?</h2>
          <div className="mood-options" aria-label="ცხოველის განწყობა">
            {(
              [
                ["friendly", "მეგობრული", "ახალი მეგობრებისთვის მზად"],
                ["cautious", "ფრთხილი", "ცოტა პირადი სივრცე გვჭირდება"],
              ] as const
            ).map(([value, title, description]) => (
              <label
                key={value}
                className={`mood-option ${(tracker.session?.mood || mood) === value ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="mood"
                  value={value}
                  checked={(tracker.session?.mood || mood) === value}
                  onChange={() => setMood(value)}
                  disabled={tracker.active || tracker.busy}
                />
                <span className={`mood-dot ${value}`} />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                {(tracker.session?.mood || mood) === value && (
                  <Check size={16} />
                )}
              </label>
            ))}
          </div>
          <div className="tracker-stats">
            <div>
              <span>გავლილი მანძილი</span>
              <strong>
                {(tracker.distance / 1000).toFixed(2)}
                <small>კმ</small>
              </strong>
            </div>
            <div>
              <span>დრო დაწყებიდან</span>
              <strong className="timer">
                {minutes}:{seconds}
              </strong>
            </div>
            <div>
              <span>მოსალოდნელი PawCoins</span>
              <strong>
                {Math.floor(tracker.distance / 10)}
                <small>✦</small>
              </strong>
            </div>
          </div>
          {tracker.error && <ErrorNotice message={tracker.error} />}{" "}
          {tracker.tracking ? (
            <Button
              variant="secondary"
              busy={tracker.busy}
              onClick={() => void tracker.pauseAndSave()}
            >
              შეჩერება
            </Button>
          ) : (
            <Button
              variant="terracotta"
              busy={tracker.busy}
              disabled={!mood && !tracker.session}
              onClick={() => {
                const chosen = tracker.session?.mood || mood;
                if (chosen) void tracker.begin(chosen);
              }}
            >
              <Play size={17} />
              {tracker.session ? "სეირნობის გაგრძელება" : "სეირნობის დაწყება"}
            </Button>
          )}
          {tracker.session && (
            <Button
              variant="primary"
              busy={tracker.busy}
              onClick={() => void tracker.finish()}
            >
              დასრულება და შენახვა
              <Check size={17} />
            </Button>
          )}
          <p className="field-hint">
            1 კმ = 100 PawCoins. ქულები გერიცხება სეირნობის შენახვის შემდეგ.
            ჩაწერისთვის გვერდი ღია დატოვე.
          </p>
          {tracker.lastSaved && (
            <p className="sync-status">
              <ShieldCheck size={13} />
              ბოლო შენახვა:{" "}
              {new Date(tracker.lastSaved).toLocaleTimeString("ka-GE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          <p className="field-hint">
            განწყობა პირადი ჩანაწერია. შენი მდებარეობა სხვა მომხმარებლებს არ
            ეზიარება.
          </p>
        </aside>
      </div>
      <section className="walk-history">
        {error && !deleting && <ErrorNotice message={error} />}
        <div className="card-heading">
          <h2>გავლილი თავგადასავლები</h2>
          <span className="badge neutral">{completed.length} სეირნობა</span>
        </div>
        {completed.length ? (
          <div className="walk-history-grid">
            {completed.map((walk) => (
              <article key={walk.id} className="card walk-history-card">
                <span className="card-icon sage-icon">
                  <MapPin size={21} />
                </span>
                <div>
                  <h3>{formatDate(walk.started_at, true)}</h3>
                  <p>
                    {(walk.distance_m / 1000).toFixed(2)} კმ ·{" "}
                    {Math.max(
                      0,
                      Math.round(
                        (Date.parse(walk.ended_at!) -
                          Date.parse(walk.started_at)) /
                          60_000,
                      ),
                    )}{" "}
                    წთ
                  </p>
                </div>
                <span className="walk-earned">+{walk.paw_coins} ✦</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="შენახული მარშრუტის ნახვა"
                  disabled={!!viewLoading}
                  aria-busy={viewLoading === walk.id}
                  onClick={() => void openWalk(walk)}
                >
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button danger-text"
                  aria-label="სეირნობის წაშლა"
                  onClick={() => setDeleting(walk)}
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <section className="card">
            <EmptyState
              kind="walk"
              title="პირველი თავგადასავალი გელოდებათ"
              description="შენი რეალური მარშრუტები და გამომუშავებული PawCoins აქ შეინახება."
            />
          </section>
        )}
      </section>
      {deleting && (
        <Dialog
          title="სეირნობის წაშლა"
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <p className="modal-description">
            მარშრუტი და ამ სეირნობის {deleting.paw_coins} PawCoins წაიშლება.
            მოქმედების დაბრუნება შეუძლებელია.
          </p>
          {error && <ErrorNotice message={error} />}
          <div className="modal-actions">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              გაუქმება
            </Button>
            <Button variant="danger" busy={busy} onClick={() => void remove()}>
              წაშლა
            </Button>
          </div>
        </Dialog>
      )}
      {view && (
        <Dialog
          title={`${formatDate(view.started_at, true)} — მარშრუტი`}
          wide
          onClose={() => setView(null)}
        >
          <LiveMap route={view.route} tracking={false} />
          <p className="modal-description">
            {(view.distance_m / 1000).toFixed(2)} კმ · {view.paw_coins} PawCoins
          </p>
        </Dialog>
      )}
    </>
  );
}
