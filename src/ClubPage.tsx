import { useEffect, useRef, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { applyForBooth, cancelVoucher, claimVoucher, getBooths } from "./api";
import { formatDate } from "./dates";
import { phoneHref, safeWebsite } from "./domain";
import { errorMessage } from "./supabase";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  MapPin,
  Plus,
  ShieldCheck,
} from "./components/icons";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorNotice,
  SectionHead,
  Skeleton,
} from "./components/UI";
import type { Booth, Pet, Voucher } from "./types";

export function ClubPage({
  pet,
  vouchers,
  onChanged,
}: {
  pet: Pet;
  vouchers: Voucher[];
  onChanged: () => Promise<void>;
}) {
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [category, setCategory] = useState<"all" | "clinic" | "shop">("all");
  const [application, setApplication] = useState(false);
  const [selected, setSelected] = useState<Voucher | null>(null);
  const [claiming, setClaiming] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getBooths(pet)
      .then((value) => {
        if (active) setBooths(value);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pet, retry]);
  async function claim(booth: Booth) {
    if (lock.current) return;
    const existing = vouchers.find(
      (voucher) => voucher.booth_id === booth.id && voucher.status === "active",
    );
    if (existing) {
      setSelected(existing);
      return;
    }
    lock.current = true;
    setClaiming(booth.id);
    setError("");
    try {
      const voucher = await claimVoucher(booth.id, pet.id);
      await onChanged();
      setSelected(voucher);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setClaiming("");
    }
  }
  const filtered = booths.filter(
    (booth) => category === "all" || booth.category === category,
  );
  return (
    <>
      <SectionHead
        eyebrow="კარგი მეგობრები, განსაკუთრებული შესაძლებლობები"
        title="კლუბი და სტენდები"
        description={`${pet.name} — შეთავაზებები მისი ასაკის, სახეობისა და ჯიშის მიხედვით.`}
      >
        <Button variant="secondary" onClick={() => setApplication(true)}>
          <Plus size={17} />
          გახდი პარტნიორი
        </Button>
      </SectionHead>
      <section className="club-banner">
        <div>
          <span className="eyebrow">მეტი, ვიდრე ზრუნვა</span>
          <h2>
            პატარა მეგობრებისთვის.
            <br />
            <em>დიდი სიყვარულით.</em>
          </h2>
          <p>კლინიკები და მაღაზიები, რომლებიც შენს მეგობარს უკეთ იცნობენ.</p>
        </div>
        <div className="club-banner-art" aria-hidden="true">
          <span>✳</span>
          <span>♡</span>
          <span>✦</span>
        </div>
      </section>
      <div className="club-toolbar">
        <div className="pill-tabs" aria-label="პარტნიორის კატეგორია">
          {(
            [
              ["all", "ყველა"],
              ["clinic", "ვეტკლინიკები"],
              ["shop", "პეტშოპები"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={category === value ? "active" : ""}
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="muted">
          {loading ? "იტვირთება…" : `${filtered.length} შეთავაზება`}
        </span>
      </div>
      {error && (
        <ErrorNotice
          message={error}
          onRetry={() => setRetry((value) => value + 1)}
        />
      )}{" "}
      {loading ? (
        <Skeleton label="პარტნიორების შეთავაზებები იტვირთება" />
      ) : (
        !error &&
        (filtered.length ? (
          <div className="booths-grid">
            {filtered.map((booth) => (
              <article key={booth.id} className="card booth-card">
                <div className={`booth-cover booth-${booth.category}`}>
                  {safeWebsite(booth.image_url) ? (
                    <img
                      src={safeWebsite(booth.image_url)}
                      alt={booth.name}
                      loading="lazy"
                    />
                  ) : (
                    <span className="booth-wordmark">
                      {booth.name.slice(0, 2)}
                    </span>
                  )}
                  <span className="badge">
                    {booth.category === "clinic" ? "ვეტკლინიკა" : "პეტშოპი"}
                  </span>
                  {booth.offer_label && (
                    <strong className="offer-label">{booth.offer_label}</strong>
                  )}
                </div>
                <div className="booth-copy">
                  <span className="eyebrow">{booth.name}</span>
                  <h2>{booth.title}</h2>
                  <p>{booth.description}</p>
                  {booth.address && (
                    <p className="address-line">
                      <MapPin size={15} />
                      {booth.address}
                    </p>
                  )}
                  {booth.expires_at && (
                    <p className="field-hint">
                      მოქმედებს {formatDate(booth.expires_at, true)}-მდე
                    </p>
                  )}
                  <div className="booth-actions">
                    <Button
                      variant="primary"
                      busy={claiming === booth.id}
                      disabled={!!claiming && claiming !== booth.id}
                      onClick={() => void claim(booth)}
                    >
                      {vouchers.some(
                        (item) =>
                          item.booth_id === booth.id &&
                          item.status === "active",
                      )
                        ? "ჩემი QR ვაუჩერი"
                        : "ვაუჩერის მიღება"}
                      <ArrowRight size={16} />
                    </Button>
                    {safeWebsite(booth.website) && (
                      <a
                        href={safeWebsite(booth.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="icon-button"
                        aria-label={`${booth.name} — ვებგვერდი`}
                      >
                        <ArrowUpRight size={20} />
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="card">
            <EmptyState
              kind="club"
              title="კარგი შესაძლებლობები გზაშია"
              description="შენთვის შესაფერისი შეთავაზება ჯერ არ არის გამოქვეყნებული. ახალი პარტნიორების სტენდები აქ გამოჩნდება."
            />
          </section>
        ))
      )}
      {vouchers.length > 0 && (
        <section className="voucher-section">
          <div className="card-heading">
            <h2>შენი ვაუჩერები</h2>
            <span className="badge neutral">{vouchers.length}</span>
          </div>
          <div className="voucher-list">
            {vouchers.map((voucher) => {
              const expired =
                voucher.expires_at &&
                Date.parse(voucher.expires_at) <= Date.now();
              return (
                <button
                  type="button"
                  key={voucher.id}
                  className="card voucher-row"
                  onClick={() => setSelected(voucher)}
                >
                  <span className="card-icon sage-icon">
                    <ShieldCheck size={21} />
                  </span>
                  <span>
                    <strong>
                      {booths.find((booth) => booth.id === voucher.booth_id)
                        ?.name || "შენახული ვაუჩერი"}
                    </strong>
                    <small>{formatDate(voucher.created_at, true)}</small>
                  </span>
                  <span
                    className={`badge ${voucher.status === "active" && !expired ? "sage" : "neutral"}`}
                  >
                    {voucher.status === "redeemed"
                      ? "გამოყენებულია"
                      : voucher.status === "cancelled"
                        ? "გაუქმებულია"
                        : expired
                          ? "ვადაგასულია"
                          : "აქტიურია"}
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              );
            })}
          </div>
        </section>
      )}
      <section className="partner-invite">
        <div>
          <span className="eyebrow">შექმენი ღირებული კავშირები</span>
          <h2>შენს ბიზნესსაც აქვს ადგილი ჩვენს კლუბში.</h2>
          <p>
            იქირავე ციფრული სტენდი და მიაწვდინე ხმა მათ, ვისაც შენი ზრუნვა
            სჭირდება.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setApplication(true)}>
          გახდი პარტნიორი / იქირავე სტენდი
          <ArrowUpRight size={17} />
        </Button>
      </section>
      {application && (
        <PartnerApplication onClose={() => setApplication(false)} />
      )}{" "}
      {selected && (
        <VoucherDialog
          voucher={selected}
          booth={booths.find((booth) => booth.id === selected.booth_id)}
          onClose={() => setSelected(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

function PartnerApplication({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) || "").trim();
    if (!phoneHref(value("phone"))) {
      setError("მიუთითე სწორი ტელეფონის ნომერი.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await applyForBooth({
        business_name: value("business_name"),
        contact_name: value("contact_name"),
        email: value("email"),
        phone: value("phone"),
        category: value("category") as "clinic" | "shop",
        message: value("message"),
      });
      setSent(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="გახდი პარტნიორი / იქირავე სტენდი"
      onClose={onClose}
      busy={busy}
    >
      {sent ? (
        <div className="application-success">
          <span className="verification-icon">
            <Check size={30} />
          </span>
          <h3>განაცხადი მიღებულია</h3>
          <p>
            შენი ბიზნესის ინფორმაცია შენახულია. განხილვის შემდეგ დაგიკავშირდებით
            მითითებულ საკონტაქტო მონაცემებზე.
          </p>
          <Button onClick={onClose}>
            მზადაა
            <Check size={17} />
          </Button>
        </div>
      ) : (
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <p className="modal-description">
            გაგვაცანი შენი ბიზნესი. შეავსე განაცხადი კლუბში სტენდის
            დასაქირავებლად.
          </p>
          <fieldset disabled={busy}>
            <label className="field">
              ბიზნესის სახელი
              <input
                name="business_name"
                required
                maxLength={160}
                pattern=".*\S.*"
              />
            </label>
            <label className="field">
              კატეგორია
              <select name="category" required defaultValue="">
                <option value="" disabled>
                  აირჩიე კატეგორია
                </option>
                <option value="clinic">ვეტკლინიკა</option>
                <option value="shop">პეტშოპი</option>
              </select>
            </label>
            <label className="field">
              საკონტაქტო პირი
              <input
                name="contact_name"
                required
                maxLength={160}
                pattern=".*\S.*"
                autoComplete="name"
              />
            </label>
            <div className="form-columns">
              <label className="field">
                ელფოსტა
                <input
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                />
              </label>
              <label className="field">
                ტელეფონი
                <input
                  type="tel"
                  name="phone"
                  required
                  maxLength={32}
                  autoComplete="tel"
                />
              </label>
            </div>
            <label className="field">
              მოგვიყევი შენს ბიზნესზე
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={3000}
                rows={3}
              />
            </label>
          </fieldset>
          {error && <ErrorNotice message={error} />}
          <Button type="submit" busy={busy}>
            განაცხადის გაგზავნა
            <ArrowRight size={17} />
          </Button>
        </form>
      )}
    </Dialog>
  );
}

function VoucherDialog({
  voucher,
  booth,
  onClose,
  onChanged,
}: {
  voucher: Voucher;
  booth?: Booth;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const expired =
    !!voucher.expires_at && Date.parse(voucher.expires_at) <= Date.now();
  const active = voucher.status === "active" && !expired;
  async function cancel() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await cancelVoucher(voucher.id);
      await onChanged();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="შენი QR ვაუჩერი" onClose={onClose} busy={busy}>
      <div className="qr-voucher">
        <span className="eyebrow">PetLog-ის კლუბი</span>
        <h3>{booth?.name || "შენახული ვაუჩერი"}</h3>
        {active ? (
          <>
            <div className="qr-frame">
              <QRCodeSVG
                value={JSON.stringify({
                  type: "petlog-voucher",
                  version: 1,
                  code: voucher.code,
                })}
                size={200}
                level="M"
                title="ვაუჩერის უნიკალური კოდი"
                marginSize={2}
              />
            </div>
            <p>აჩვენე ეს QR კოდი პარტნიორთან.</p>
          </>
        ) : (
          <p className="error-notice">
            {voucher.status === "redeemed"
              ? "ვაუჩერი უკვე გამოყენებულია."
              : voucher.status === "cancelled"
                ? "ვაუჩერი გაუქმებულია."
                : "ვაუჩერს ვადა გაუვიდა."}
          </p>
        )}
        <code className="voucher-code">{voucher.code}</code>
        {voucher.expires_at && (
          <span className="field-hint">
            ვადა: {formatDate(voucher.expires_at, true)}
          </span>
        )}
        <p className="privacy-line">
          <ShieldCheck size={16} />
          კოდი შენს ანგარიშზეა მიბმული.
        </p>
      </div>
      {error && <ErrorNotice message={error} />}{" "}
      {active &&
        (confirmCancel ? (
          <div className="cancel-voucher">
            <p>ვაუჩერი გაუქმდება და ხელახლა ვერ გაააქტიურებ.</p>
            <div className="modal-actions">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmCancel(false)}
              >
                უკან
              </Button>
              <Button
                variant="danger"
                busy={busy}
                onClick={() => void cancel()}
              >
                გაუქმების დადასტურება
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="full-width"
            onClick={() => setConfirmCancel(true)}
          >
            ვაუჩერის გაუქმება
          </Button>
        ))}
    </Dialog>
  );
}
