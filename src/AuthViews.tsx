import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  Heart,
  Mail,
  ShieldCheck,
} from "./components/icons";
import { Brand, Button, ErrorNotice, Paw } from "./components/UI";
import { authRedirect, db, errorMessage, isConfigured } from "./supabase";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-layout">
      <aside className="auth-editorial">
        <img
          className="editorial-photo"
          src={`${import.meta.env.BASE_URL}welcome-dog.jpg`}
          alt="ძაღლი მწვანე ბაღში"
          fetchPriority="high"
        />
        <div className="editorial-shade" />
        <div className="editorial-top">
          <Brand light />
          <span className="editorial-label">
            პატარა მეგობარი. დიდი სიყვარული.
          </span>
        </div>
        <div className="editorial-copy">
          <span className="editorial-kicker">
            <span /> სიყვარულით შექმნილი სივრცე
          </span>
          <h1>
            მეტი ბედნიერი
            <br />
            დღე, <span>ერთად.</span>
          </h1>
          <p>
            მათი მთელი სამყარო შენ ხარ.
            <br />
            შენზე ზრუნვაში კი ჩვენ დაგეხმარებით.
          </p>
          <div className="editorial-chips">
            <span>
              <Heart size={15} /> ჯანმრთელობა
            </span>
            <span>
              <Paw size={16} /> თავგადასავლები
            </span>
            <span>
              <ShieldCheck size={16} /> სიმშვიდე
            </span>
          </div>
        </div>
        <span className="editorial-footnote">
          შენი მეგობრის კეთილდღეობა იწყება აქ.
        </span>
        <div className="editorial-photo-note">PetLog-ის სარედაქციო ფოტო</div>
      </aside>
      <section className="auth-right">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-content">{children}</div>
        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} PetLog</span>
          <span>
            <ShieldCheck size={14} /> შენი პირადი სივრცე
          </span>
        </footer>
      </section>
    </main>
  );
}

export function Auth({
  onVerification,
  initialError = "",
}: {
  onVerification: (email: string) => void;
  initialError?: string;
}) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const address = email.trim();
    try {
      if (mode === "register") {
        const { data, error: cause } = await db().auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: authRedirect() },
        });
        if (cause) throw cause;
        if (data.session) {
          await db().auth.signOut();
          throw new Error(
            "USER:რეგისტრაცია დროებით მიუწვდომელია. მოგვიანებით სცადე ხელახლა.",
          );
        }
        setPassword("");
        onVerification(address);
      } else if (mode === "reset") {
        const { error: cause } = await db().auth.resetPasswordForEmail(
          address,
          { redirectTo: authRedirect() },
        );
        if (cause) throw cause;
        setNotice(
          "თუ ეს ელფოსტა რეგისტრირებულია, პაროლის აღდგენის ბმულს მიიღებ.",
        );
      } else {
        const { error: cause } = await db().auth.signInWithPassword({
          email: address,
          password,
        });
        if (cause?.code === "email_not_confirmed") {
          onVerification(address);
          return;
        }
        if (cause) throw cause;
        setPassword("");
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function changeMode(value: typeof mode) {
    setMode(value);
    setError("");
    setNotice("");
    setPassword("");
  }
  return (
    <AuthLayout>
      <div className="auth-intro">
        <span className="eyebrow">
          <span className="tiny-leaf" /> ზრუნვა სიყვარულით
        </span>
        <h2>
          {mode === "register" ? (
            <>
              ყველაფერი იწყება
              <br /> ერთი მეგობრობით.
            </>
          ) : mode === "reset" ? (
            <>
              დავიბრუნოთ
              <br /> შენი სივრცე.
            </>
          ) : (
            <>
              კეთილი იყოს
              <br /> შენი დაბრუნება.
            </>
          )}
        </h2>
        <p>
          {mode === "register"
            ? "შექმენი შენი მეგობრის ჯანმრთელობისა და ბედნიერი მოგონებების პირადი სივრცე."
            : mode === "reset"
              ? "მოგწერთ ბმულს, რომლითაც ახალ პაროლს აირჩევ."
              : "შენი მეგობრის პატარა სამყარო აქ გელოდება."}
        </p>
      </div>
      {mode !== "reset" && (
        <div className="auth-tabs" aria-label="ავტორიზაციის ტიპი">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            aria-pressed={mode === "login"}
            onClick={() => changeMode("login")}
            disabled={busy}
          >
            შესვლა
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            aria-pressed={mode === "register"}
            onClick={() => changeMode("register")}
            disabled={busy}
          >
            რეგისტრაცია
          </button>
        </div>
      )}
      <form
        className="form-stack auth-form"
        onSubmit={(event) => void submit(event)}
        aria-busy={busy}
      >
        <fieldset disabled={busy}>
          <label className="field">
            ელფოსტა
            <div className="input-icon">
              <Mail size={18} />
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="შენი ელფოსტის მისამართი"
                autoComplete="email"
                maxLength={254}
                required
              />
            </div>
          </label>
          {mode !== "reset" && (
            <div className="field">
              <span className="field-top">
                <label htmlFor="auth-password">პაროლი</label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => changeMode("reset")}
                  >
                    დაგავიწყდა?
                  </button>
                )}
              </span>
              <div className="input-password">
                <input
                  id="auth-password"
                  type={visible ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    mode === "register"
                      ? "მინიმუმ 12 სიმბოლო"
                      : "შეიყვანე შენი პაროლი"
                  }
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  required
                  minLength={mode === "register" ? 12 : 1}
                  maxLength={256}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? "პაროლის დამალვა" : "პაროლის ჩვენება"}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}
          {mode === "register" && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                required
              />
              <span>
                მსურს პირადი ანგარიშის შექმნა და ელფოსტის დადასტურება.
              </span>
            </label>
          )}
        </fieldset>
        {error && <ErrorNotice message={error} />}
        <Button
          className="auth-submit"
          busy={busy}
          disabled={!isConfigured}
          type="submit"
        >
          {mode === "register"
            ? "შექმენი ანგარიში"
            : mode === "reset"
              ? "აღდგენის ბმულის გაგზავნა"
              : "შესვლა"}
          <ArrowRight size={18} />
        </Button>
        {notice && (
          <p className="success-notice" role="status">
            {notice}
          </p>
        )}
        {!isConfigured && (
          <p className="connection-note" role="status">
            სერვისთან კავშირი მზადდება. შესვლა მალე იქნება ხელმისაწვდომი.
          </p>
        )}
      </form>
      {mode === "reset" ? (
        <button
          type="button"
          className="auth-switch text-link"
          onClick={() => changeMode("login")}
        >
          შესვლაზე დაბრუნება <ArrowRight size={15} />
        </button>
      ) : (
        <p className="auth-switch">
          {mode === "login" ? "პირველად ხარ აქ?" : "უკვე ჩვენი მეგობარი ხარ?"}{" "}
          <button
            type="button"
            className="text-link"
            disabled={busy}
            onClick={() => changeMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "შემოგვიერთდი" : "შესვლა"}
            <ArrowUpRight size={14} />
          </button>
        </p>
      )}
      <div className="auth-reassurance">
        <span>
          <ShieldCheck size={18} />
        </span>
        <p>
          შენი მეგობრის ისტორია — მხოლოდ შენთვის.
          <br />
          <small>მონაცემები დაცულია შენს პირად ანგარიშში.</small>
        </p>
      </div>
    </AuthLayout>
  );
}

export function VerifyEmail({
  email,
  onBack,
  onVerified,
}: {
  email: string;
  onBack: () => Promise<void>;
  onVerified: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(60);
  const lock = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible")
        void onVerified().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [onVerified]);
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const { error: cause } = await db().auth.verifyOtp({
        email,
        token: code,
        type: "signup",
      });
      if (cause) throw cause;
      await onVerified();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function resend() {
    if (cooldown || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: cause } = await db().auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: authRedirect() },
      });
      if (cause) throw cause;
      setCooldown(60);
      setNotice("ახალი წერილი გამოგზავნილია. შეამოწმე სპამის საქაღალდეც.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <div className="verification-icon">
        <Mail size={30} />
        <span>
          <Check size={13} />
        </span>
      </div>
      <div className="auth-intro">
        <p className="eyebrow">ერთი პატარა ნაბიჯი</p>
        <h2>
          ელფოსტის
          <br />
          დადასტურება.
        </h2>
        <p>
          დადასტურების ბმული და 6-ნიშნა კოდი გამოგიგზავნეთ მისამართზე{" "}
          <strong className="email-address">{email}</strong>
        </p>
      </div>
      <form className="form-stack" onSubmit={(event) => void verify(event)}>
        <label className="field">
          დადასტურების კოდი
          <input
            className="otp-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            autoComplete="one-time-code"
            maxLength={6}
            minLength={6}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="· · · · · ·"
            required
            disabled={busy}
            autoFocus
          />
        </label>
        {error && <ErrorNotice message={error} />}
        <Button type="submit" busy={busy} disabled={code.length !== 6}>
          ელფოსტის დადასტურება
          <ArrowRight size={18} />
        </Button>
        {notice && (
          <p className="success-notice" role="status">
            {notice}
          </p>
        )}
      </form>
      <p className="auth-switch">
        არ მიგიღია წერილი?{" "}
        <button
          type="button"
          className="text-link"
          disabled={busy || cooldown > 0}
          onClick={() => void resend()}
        >
          {cooldown ? `ხელახლა გაგზავნა (${cooldown})` : "ხელახლა გაგზავნა"}
        </button>
      </p>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => {
          setError("");
          void onBack().catch((cause) => setError(errorMessage(cause)));
        }}
      >
        სხვა ელფოსტის გამოყენება
      </Button>
      <div className="auth-reassurance">
        <ShieldCheck size={22} />
        <p>
          შენი სივრცე გაიხსნება ელფოსტის
          <br />
          წარმატებით დადასტურების შემდეგ.
        </p>
      </div>
    </AuthLayout>
  );
}

export function RecoverPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError("პაროლები ერთმანეთს არ ემთხვევა.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: cause } = await db().auth.updateUser({ password });
      if (cause) throw cause;
      onDone();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <div className="auth-intro">
        <p className="eyebrow">შენი პირადი სივრცე</p>
        <h2>
          აირჩიე
          <br />
          ახალი პაროლი.
        </h2>
        <p>გამოიყენე მინიმუმ 12 სიმბოლო.</p>
      </div>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <label className="field">
          ახალი პაროლი
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
        </label>
        <label className="field">
          გაიმეორე პაროლი
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={256}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            disabled={busy}
          />
        </label>
        {error && <ErrorNotice message={error} />}
        <Button busy={busy} type="submit">
          პაროლის შენახვა
          <ArrowRight size={18} />
        </Button>
      </form>
    </AuthLayout>
  );
}
