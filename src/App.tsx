import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getPetData, getPets, getProfile } from "./api";
import { Auth, RecoverPassword, VerifyEmail } from "./AuthViews";
import { entryGate } from "./domain";
import {
  DeleteRecordDialog,
  HealthPage,
  MemoriesPage,
  Overview,
  RecordEditor,
  type DeleteTarget,
  type Editor,
} from "./HealthHub";
import { PetWizard } from "./PetWizard";
import { ProfilePage } from "./ProfilePage";
import { authRedirect, db, errorMessage, supabase } from "./supabase";
import {
  Brand,
  Button,
  Dialog,
  ErrorNotice,
  Photo,
  Skeleton,
} from "./components/UI";
import {
  ArrowRight,
  Camera,
  Heart,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MapPin,
  Plus,
  ShieldCheck,
  UserRound,
} from "./components/icons";
import {
  emptyPetData,
  type Page,
  type Pet,
  type PetData,
  type Profile,
} from "./types";
import { useWalkTracker } from "./useWalkTracker";

const ClubPage = lazy(() =>
  import("./ClubPage").then((module) => ({ default: module.ClubPage })),
);
const WalkPage = lazy(() =>
  import("./WalkPage").then((module) => ({ default: module.WalkPage })),
);
const pages: { id: Page; label: string; short: string; icon: typeof Heart }[] =
  [
    {
      id: "overview",
      label: "ჩემი სივრცე",
      short: "მთავარი",
      icon: LayoutDashboard,
    },
    {
      id: "health",
      label: "ჯანმრთელობა",
      short: "ჯანმრთელობა",
      icon: HeartPulse,
    },
    { id: "memories", label: "მოგონებები", short: "მოგონებები", icon: Camera },
    { id: "club", label: "კლუბი და სტენდები", short: "კლუბი", icon: Heart },
    { id: "walk", label: "სეირნობის რადარი", short: "სეირნობა", icon: MapPin },
    {
      id: "profile",
      label: "მეგობრის პროფილი",
      short: "პროფილი",
      icon: UserRound,
    },
  ];
function readPending(): string {
  try {
    return sessionStorage.getItem("petlog.verification-email") || "";
  } catch {
    return "";
  }
}
function storePending(email: string) {
  try {
    if (email) sessionStorage.setItem("petlog.verification-email", email);
    else sessionStorage.removeItem("petlog.verification-email");
  } catch {
    /* Verification can still proceed in memory. */
  }
}
function currentPage(): Page {
  return (
    pages.find((page) => `#${page.id}` === location.hash)?.id || "overview"
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [pending, setPending] = useState(readPending);
  const [recovery, setRecovery] = useState(false);
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dataError, setDataError] = useState("");
  const [retry, setRetry] = useState(0);
  const authSequence = useRef(0);
  const userRef = useRef<User | null>(null);
  const refreshAuth = useCallback(async () => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    const sequence = ++authSequence.current;
    try {
      const { data: local, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!local.session) {
        if (sequence !== authSequence.current) return;
        userRef.current = null;
        setUser(null);
        setPets(null);
        setProfile(null);
        setAuthLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.getUser();
      if (sequence !== authSequence.current) return;
      if (error) throw error;
      if (userRef.current?.id !== data.user.id) {
        setPets(null);
        setProfile(null);
      }
      userRef.current = data.user;
      setUser(data.user);
      setAuthError("");
      if (data.user.email_confirmed_at) {
        storePending("");
        setPending("");
      }
    } catch (cause) {
      if (sequence !== authSequence.current) return;
      userRef.current = null;
      setUser(null);
      setPets(null);
      setAuthError(errorMessage(cause));
    } finally {
      if (sequence === authSequence.current) setAuthLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    const url = new URL(location.href);
    const hashParams = new URLSearchParams(url.hash.slice(1));
    if (url.searchParams.has("error") || hashParams.has("error")) {
      setAuthError(
        "დადასტურების ბმული არასწორია ან ვადა გაუვიდა. მოითხოვე ახალი წერილი.",
      );
      history.replaceState(null, "", authRedirect());
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        ++authSequence.current;
        userRef.current = null;
        setUser(null);
        setPets(null);
        setProfile(null);
        setRecovery(false);
        setAuthLoading(false);
        return;
      }
      if (session && userRef.current?.id !== session.user.id)
        setAuthLoading(true);
      setTimeout(() => {
        void refreshAuth();
      }, 0);
    });
    void refreshAuth();
    return () => {
      ++authSequence.current;
      subscription.unsubscribe();
    };
  }, [refreshAuth]);
  useEffect(() => {
    if (!user?.email_confirmed_at) return;
    let active = true;
    setDataError("");
    void Promise.all([getPets(), getProfile()])
      .then(([friends, account]) => {
        if (active) {
          setPets(friends);
          setProfile(account);
        }
      })
      .catch((cause) => {
        if (active) setDataError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.email_confirmed_at, retry]);
  async function logout() {
    const { error } = await db().auth.signOut();
    if (error) throw error;
    storePending("");
    setPending("");
    setPets(null);
    setProfile(null);
    setUser(null);
    history.replaceState(null, "", authRedirect());
  }
  function verification(email: string) {
    storePending(email);
    setPending(email);
  }
  async function onVerified() {
    await refreshAuth();
  }
  if (authLoading)
    return (
      <main className="gate-loading">
        <Brand />
        <Skeleton label="პირადი ანგარიშის შემოწმება" />
      </main>
    );
  if (recovery && user)
    return <RecoverPassword onDone={() => setRecovery(false)} />;
  if (!user)
    return pending ? (
      <VerifyEmail email={pending} onVerified={onVerified} onBack={logout} />
    ) : (
      <Auth onVerification={verification} initialError={authError} />
    );
  const gate = entryGate(true, !!user.email_confirmed_at, pets?.length || 0);
  if (gate === "verify")
    return (
      <VerifyEmail
        email={user.email || pending}
        onVerified={onVerified}
        onBack={logout}
      />
    );
  if (dataError || pets === null)
    return (
      <main className="gate-loading">
        <Brand />
        {dataError ? (
          <div className="card gate-error">
            <h1>შენი სივრცე დროებით მიუწვდომელია</h1>
            <ErrorNotice
              message={dataError}
              onRetry={() => setRetry((value) => value + 1)}
            />
            <Button
              variant="ghost"
              onClick={() => {
                void logout().catch((cause) =>
                  setAuthError(errorMessage(cause)),
                );
              }}
            >
              ანგარიშიდან გასვლა
            </Button>
          </div>
        ) : (
          <Skeleton />
        )}
      </main>
    );
  if (gate === "onboarding")
    return <PetWizard onSaved={(pet) => setPets([pet])} onLogout={logout} />;
  return (
    <Workspace
      key={user.id}
      user={user}
      pets={pets}
      setPets={setPets}
      profile={profile}
      setProfile={setProfile}
      logout={logout}
    />
  );
}

function Workspace({
  user,
  pets,
  setPets,
  profile,
  setProfile,
  logout,
}: {
  user: User;
  pets: Pet[];
  setPets: (pets: Pet[]) => void;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  logout: () => Promise<void>;
}) {
  const [petId, setPetId] = useState(pets[0].id);
  const pet = pets.find((friend) => friend.id === petId) || pets[0];
  const [page, setPage] = useState<Page>(currentPage);
  const [data, setData] = useState<PetData>(emptyPetData);
  const [loadedFor, setLoadedFor] = useState("");
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [addPet, setAddPet] = useState(false);
  const [toast, setToast] = useState("");
  const sequence = useRef(0);
  const currentPetRef = useRef(pet.id);
  currentPetRef.current = pet.id;
  const heading = useRef<HTMLElement>(null);
  const refresh = useCallback(async () => {
    const id = pet.id;
    const ticket = ++sequence.current;
    try {
      const records = await getPetData(id);
      if (ticket === sequence.current && id === currentPetRef.current) {
        if (records.activeWalk && records.activeWalk.pet_id !== id) {
          setPetId(records.activeWalk.pet_id);
          return;
        }
        setData(records);
        setLoadedFor(id);
        setError("");
      }
    } catch (cause) {
      if (ticket === sequence.current) setError(errorMessage(cause));
    }
  }, [pet.id]);
  useEffect(() => {
    setData(emptyPetData());
    setLoadedFor("");
    setError("");
    void refresh();
    return () => {
      ++sequence.current;
    };
  }, [refresh]);
  const tracker = useWalkTracker(pet, data.walks, refresh);
  useEffect(() => {
    const listener = () => setPage(currentPage());
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    document.title = `${pages.find((item) => item.id === page)?.label} — PetLog`;
  }, [page]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  function go(value: Page) {
    setPage(value);
    history.pushState(null, "", `#${value}`);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function changed() {
    await refresh();
    setToast("შენახულია შენს პირად სივრცეში.");
  }
  const content =
    loadedFor !== pet.id ? (
      error ? (
        <div className="card gate-error">
          <h2>მონაცემები ვერ ჩაიტვირთა</h2>
          <ErrorNotice message={error} onRetry={() => void refresh()} />
        </div>
      ) : (
        <Skeleton />
      )
    ) : (
      <>
        {error && (
          <ErrorNotice message={error} onRetry={() => void refresh()} />
        )}
        <Suspense fallback={<Skeleton />}>
          {page === "overview" && (
            <Overview
              pet={pet}
              data={data}
              displayName={profile?.display_name || ""}
              go={go}
              edit={setEditor}
            />
          )}{" "}
          {page === "health" && (
            <HealthPage data={data} edit={setEditor} remove={setDeleting} />
          )}{" "}
          {page === "memories" && (
            <MemoriesPage data={data} edit={setEditor} remove={setDeleting} />
          )}{" "}
          {page === "club" && (
            <ClubPage
              key={pet.id}
              pet={pet}
              vouchers={data.vouchers}
              onChanged={changed}
            />
          )}{" "}
          {page === "walk" && (
            <WalkPage
              pet={pet}
              walks={data.walks}
              tracker={tracker}
              onChanged={refresh}
            />
          )}{" "}
          {page === "profile" && (
            <ProfilePage
              pet={pet}
              user={user}
              profile={profile}
              onProfile={setProfile}
              onPetSaved={(updated) => {
                setPets(
                  pets.map((item) => (item.id === updated.id ? updated : item)),
                );
                setToast("პროფილი განახლებულია.");
              }}
              onPetDeleted={() =>
                setPets(pets.filter((item) => item.id !== pet.id))
              }
              logout={logout}
              walkActive={tracker.active}
            />
          )}
        </Suspense>
      </>
    );
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          heading.current?.focus();
          heading.current?.scrollIntoView({ block: "start" });
        }}
      >
        მთავარ შიგთავსზე გადასვლა
      </a>
      <aside className="sidebar">
        <button
          type="button"
          className="brand-button"
          aria-label="PetLog — მთავარი"
          onClick={() => go("overview")}
        >
          <Brand />
        </button>
        <span className="sidebar-caption">მათთვის, ვინც ოჯახია.</span>
        <div className="sidebar-divider" />
        <span className="nav-eyebrow">შენი პატარა სამყარო</span>
        <nav aria-label="მთავარი ნავიგაცია">
          {pages.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${page === item.id ? "active" : ""}`}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => go(item.id)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {page === item.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-love">
            <span>♡</span>
            <p>
              სიყვარული დეტალებშია.
              <br />
              <strong>ჩვენ მათ შენახვაში გეხმარებით.</strong>
            </p>
          </div>
          <button
            type="button"
            className="sidebar-account"
            onClick={() => go("profile")}
          >
            <span className="account-avatar">
              {(profile?.display_name || user.email || "")
                .slice(0, 1)
                .toUpperCase()}
            </span>
            <span>
              <strong>{profile?.display_name || "ჩემი ანგარიში"}</strong>
              <small>{user.email}</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button
            type="button"
            className="sidebar-logout"
            disabled={tracker.active || tracker.busy}
            title={
              tracker.active ? "ჯერ შეინახე მიმდინარე სეირნობა" : undefined
            }
            onClick={() => {
              void logout().catch((cause) => setToast(errorMessage(cause)));
            }}
          >
            <LogOut size={15} />
            ანგარიშიდან გასვლა
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="topbar-breadcrumb">
            <span>შენი პირადი სივრცე</span>
            <span>/</span>
            <strong>{pages.find((item) => item.id === page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            {tracker.active && (
              <button
                type="button"
                className="active-walk-pill"
                onClick={() => go("walk")}
              >
                <span />
                {tracker.tracking ? "ვსეირნობთ" : "სეირნობა შეჩერებულია"}
              </button>
            )}
            <div className="pet-switcher">
              <Photo path={pet.photo_path} alt={pet.name} />
              <select
                aria-label="აირჩიე მეგობარი"
                value={pet.id}
                onChange={(event) => setPetId(event.target.value)}
                disabled={tracker.active || tracker.busy}
              >
                {pets.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="icon-button add-pet-button"
              disabled={tracker.active || tracker.busy}
              aria-label="ახალი მეგობრის დამატება"
              onClick={() => setAddPet(true)}
            >
              <Plus size={19} />
            </button>
          </div>
        </header>
        <main
          id="main-content"
          className="main-content"
          ref={heading}
          tabIndex={-1}
        >
          {content}
          <footer className="workspace-footer">
            <span>პატარა მეგობარი. მთელი სიყვარული.</span>
            <span>
              <ShieldCheck size={14} />
              შენი პირადი სივრცე · PetLog
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-dock" aria-label="მობილური ნავიგაცია">
        {pages.map((item) => (
          <button
            key={item.id}
            type="button"
            className={page === item.id ? "active" : ""}
            aria-current={page === item.id ? "page" : undefined}
            onClick={() => go(item.id)}
          >
            <item.icon size={20} />
            <span>{item.short}</span>
          </button>
        ))}
      </nav>
      {editor && (
        <RecordEditor
          editor={editor}
          pet={pet}
          onClose={() => setEditor(null)}
          onSaved={changed}
        />
      )}{" "}
      {deleting && (
        <DeleteRecordDialog
          target={deleting}
          onClose={() => setDeleting(null)}
          onSaved={changed}
        />
      )}{" "}
      {addPet && (
        <Dialog title="ახალი მეგობარი" wide onClose={() => setAddPet(false)}>
          <PetWizard
            onCancel={() => setAddPet(false)}
            onSaved={(friend) => {
              setPets([...pets, friend]);
              setPetId(friend.id);
              setAddPet(false);
              go("overview");
            }}
          />
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <ShieldCheck size={17} />
          {toast}
          <button
            type="button"
            className="text-link"
            onClick={() => setToast("")}
          >
            კარგი
          </button>
        </div>
      )}
    </div>
  );
}
