import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { signedPhoto } from "../api";
import { Camera, LoaderCircle, Plus, X } from "./icons";

export function Paw({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
    >
      <ellipse cx="8" cy="10" rx="3.2" ry="4.2" transform="rotate(-25 8 10)" />
      <ellipse cx="15" cy="6.5" rx="3.1" ry="4.3" />
      <ellipse cx="23" cy="9" rx="3.1" ry="4.2" transform="rotate(25 23 9)" />
      <ellipse cx="27" cy="16" rx="2.8" ry="3.6" transform="rotate(35 27 16)" />
      <path d="M7 23c0-3 3.8-5.2 5.1-8.4 1.4-3.5 5.5-3.8 7.5-.4 1.7 3 6.2 4.7 6.2 8.4 0 5.7-5.4 5-9.4 3.5C12.9 24.8 7 28.7 7 23Z" />
    </svg>
  );
}
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark">
        <Paw size={23} />
      </span>
      <span className="wordmark">
        petlog<span>.</span>
      </span>
    </span>
  );
}
export function Button({
  children,
  busy,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  busy?: boolean;
  variant?: "primary" | "secondary" | "terracotta" | "ghost" | "danger";
}) {
  return (
    <button
      {...props}
      className={`btn btn-${variant} ${className}`}
      disabled={props.disabled || busy}
      aria-busy={busy}
    >
      {busy && <LoaderCircle size={17} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
export function Photo({
  path,
  alt,
  className = "",
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUrl("");
    setFailed(false);
    const load = () => {
      void signedPhoto(path)
        .then((value) => {
          if (active) {
            setUrl(value);
            setFailed(false);
          }
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    };
    load();
    const timer = window.setInterval(load, 45 * 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [path]);
  return (
    <span className={`photo ${className} ${!url && !failed ? "shimmer" : ""}`}>
      {url && !failed ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : failed ? (
        <span
          className="photo-error"
          role="img"
          aria-label={`${alt} — ფოტო ვერ ჩაიტვირთა`}
        >
          <Camera size={24} />
          <small>ფოტო ვერ ჩაიტვირთა</small>
        </span>
      ) : (
        <span className="sr-only">ფოტო იტვირთება</span>
      )}
    </span>
  );
}
export function useLocalPhoto(file: File | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return url;
}
export function EmptyIllustration({
  kind = "health",
}: {
  kind?: "health" | "memory" | "club" | "walk" | "pet";
}) {
  return (
    <svg
      className={`empty-art empty-art-${kind}`}
      viewBox="0 0 160 124"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="80" cy="110" rx="55" ry="6" fill="#E8E9DE" />
      <path
        d="M27 80c-5-24 10-49 35-53 27-5 56 7 63 32 9 31-8 47-39 47-27 0-53-2-59-26Z"
        fill="#EFF2E7"
      />
      <path
        d="M28 65c-10-11-9-22-5-28 10 7 14 17 5 28ZM129 89c14-7 18-17 16-24-13 3-20 12-16 24Z"
        fill="#BCD1B9"
      />
      <path
        d="m26 57 4 36m109-16-11 25"
        stroke="#8CA886"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {kind === "memory" ? (
        <g transform="rotate(-8 80 62)">
          <rect
            x="45"
            y="28"
            width="76"
            height="70"
            rx="9"
            fill="white"
            stroke="#D3DCCB"
            strokeWidth="1.5"
          />
          <rect x="51" y="34" width="64" height="47" rx="5" fill="#F4E3D6" />
          <circle cx="99" cy="47" r="7" fill="#E9AA85" />
          <path d="m52 77 19-22 17 16 9-10 18 16" fill="#93AD90" />
          <path
            d="M70 89h27"
            stroke="#D3DCCB"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      ) : kind === "club" ? (
        <g>
          <path
            d="M46 52h69v45H46z"
            fill="white"
            stroke="#C5D3BE"
            strokeWidth="1.5"
          />
          <path d="m40 52 10-24h61l10 24" fill="#F1DBCA" />
          <path
            d="M40 52c0 12 16 12 16 0 0 12 17 12 17 0 0 12 16 12 16 0 0 12 16 12 16 0 0 12 16 12 16 0"
            fill="#E5AB8E"
          />
          <path d="M56 72h20v25H56z" fill="#D9E5D4" />
          <rect x="87" y="70" width="18" height="15" rx="3" fill="#F2E9DD" />
        </g>
      ) : kind === "walk" ? (
        <g>
          <path
            d="M41 92c8-30 39-5 43-27 4-22 37-6 32-33"
            stroke="#9EB398"
            strokeWidth="4"
            strokeDasharray="5 6"
            strokeLinecap="round"
          />
          <path
            d="M80 42c0-13 19-13 19 0 0 8-10 16-10 16s-9-8-9-16Z"
            fill="#E07A5F"
          />
          <circle cx="89.5" cy="41" r="3.5" fill="white" />
          <circle cx="43" cy="93" r="7" fill="#1B4332" />
          <circle cx="43" cy="93" r="3" fill="white" />
        </g>
      ) : kind === "pet" ? (
        <g>
          <path
            d="M56 47 44 34c-9 5-12 26 2 34m58-21 12-13c9 5 12 26-2 34"
            fill="#D5AB89"
            stroke="#9E7A5C"
            strokeWidth="1.5"
          />
          <path
            d="M48 58c0-37 63-37 63 0v18c0 34-63 34-63 0V58Z"
            fill="#F3DFBF"
          />
          <circle cx="66" cy="64" r="3" fill="#394A36" />
          <circle cx="94" cy="64" r="3" fill="#394A36" />
          <path d="M75 76q5-5 10 0l-5 6-5-6Z" fill="#394A36" />
          <path
            d="M80 82v5m-8 1q8 7 16 0"
            stroke="#394A36"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <g transform="rotate(7 80 63)">
          <rect
            x="49"
            y="24"
            width="67"
            height="78"
            rx="10"
            fill="white"
            stroke="#C8D5C0"
            strokeWidth="1.5"
          />
          <path
            d="M67 24v-5h29v5"
            stroke="#A6B79F"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect x="69" y="42" width="27" height="27" rx="8" fill="#E6EDDF" />
          <path
            d="M82.5 48v15m-7.5-7.5h15"
            stroke="#73916A"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M62 81h41M62 89h27"
            stroke="#E6E9E0"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )}
      <path d="m124 22 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#E9B790" />
      <circle cx="32" cy="95" r="3" fill="#E6B392" />
    </svg>
  );
}
export function EmptyState({
  kind,
  title,
  description,
  action,
  onAction,
  compact = false,
}: {
  kind?: "health" | "memory" | "club" | "walk" | "pet";
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? "empty-compact" : ""}`}>
      <EmptyIllustration kind={kind} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action && onAction && (
        <Button variant="secondary" onClick={onAction}>
          <Plus size={16} />
          {action}
        </Button>
      )}
    </div>
  );
}
export function Skeleton({
  label = "მონაცემები იტვირთება",
}: {
  label?: string;
}) {
  return (
    <div className="skeleton-grid" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="shimmer skeleton-hero" />
      <div className="shimmer" />
      <div className="shimmer" />
      <div className="shimmer skeleton-wide" />
    </div>
  );
}
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-notice" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="text-link" onClick={onRetry}>
          თავიდან ცდა
        </button>
      )}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`dialog-shell ${wide ? "dialog-wide" : ""}`}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h2 id={id}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="დახურვა"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
export function SectionHead({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="section-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 tabIndex={-1}>{title}</h1>
        {description && <p className="section-description">{description}</p>}
      </div>
      {children}
    </header>
  );
}
