import { useRef, useState, type FormEvent } from "react";
import {
  deleteRecord,
  removePhoto,
  saveMemory,
  saveVaccination,
  saveVet,
} from "./api";
import { ageLabel, countdown, daysUntil, formatDate, today } from "./dates";
import { phoneHref } from "./domain";
import { errorMessage } from "./supabase";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Heart,
  HeartPulse,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Syringe,
  Trash2,
  Upload,
} from "./components/icons";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorNotice,
  Photo,
  SectionHead,
  useLocalPhoto,
} from "./components/UI";
import type {
  Memory,
  Page,
  Pet,
  PetData,
  Vaccination,
  VetContact,
} from "./types";

export type Editor =
  | { kind: "vaccination"; item?: Vaccination }
  | { kind: "vet"; item?: VetContact }
  | { kind: "memory"; item?: Memory };
export function VaccinationBadge({ due }: { due: string | null }) {
  if (!due)
    return <span className="badge neutral">შემდეგი თარიღი უცნობია</span>;
  const result = countdown(due);
  return (
    <span className={`badge ${result.tone}`}>
      <span />
      {result.label}
    </span>
  );
}
export function Overview({
  pet,
  data,
  displayName,
  go,
  edit,
}: {
  pet: Pet;
  data: PetData;
  displayName: string;
  go: (page: Page) => void;
  edit: (editor: Editor) => void;
}) {
  const due = [...data.vaccinations]
    .filter((item) => item.due_on)
    .sort((a, b) => a.due_on!.localeCompare(b.due_on!))[0];
  const completed = data.walks.filter((walk) => walk.ended_at);
  const distance =
    completed.reduce((sum, walk) => sum + Number(walk.distance_m), 0) / 1000;
  const coins = completed.reduce((sum, walk) => sum + walk.paw_coins, 0);
  return (
    <>
      <SectionHead
        eyebrow="პატარა ჩვევები. დიდი სიყვარული."
        title={
          displayName
            ? `გამარჯობა, ${displayName}`
            : "მეტი ზრუნვა, მეტი ბედნიერი დღე."
        }
        description="შენი მეგობრის მთელი სამყარო, ერთი შეხედვით."
      >
        <span className="today-label">
          <CalendarDays size={17} />
          {formatDate(today(), true)}
        </span>
      </SectionHead>
      <div className="bento-grid">
        <section className="card pet-hero">
          <div className="pet-hero-copy">
            <span className="hero-kicker">
              <span />
              ჩემი პატარა სამყარო
            </span>
            <h2>
              {pet.name}
              <span>♡</span>
            </h2>
            <p>{pet.breed}</p>
            <div className="hero-pet-tags">
              <span>{pet.species === "dog" ? "ძაღლი" : "კატა"}</span>
              <span>{ageLabel(pet.birth_date)}</span>
              <span>{pet.gender === "female" ? "მდედრი" : "მამრი"}</span>
            </div>
            <button
              type="button"
              className="hero-link"
              onClick={() => go("profile")}
            >
              მეგობრის პროფილი
              <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="hero-pet-photo">
            <Photo path={pet.photo_path} alt={pet.name} />
            <span className="hero-photo-frame" />
          </div>
          <span className="hero-flower" aria-hidden="true">
            ✳
          </span>
        </section>
        <section className="card weight-card">
          <span className="card-icon warm">
            <HeartPulse size={21} />
          </span>
          <span className="card-overline">ბოლო შენახული წონა</span>
          <strong className="stat-value">
            {Number(pet.weight_kg).toLocaleString("ka-GE")}
            <small>კგ</small>
          </strong>
          <p>ყოველი პატარა ცვლილება მნიშვნელოვანია.</p>
          <button
            type="button"
            className="text-link"
            onClick={() => go("profile")}
          >
            პროფილის განახლება
            <ArrowRight size={15} />
          </button>
        </section>
        <section className="card care-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">ჯანმრთელობა უპირველესად</span>
              <h2>ვაქცინაციის კალენდარი</h2>
            </div>
            <button
              type="button"
              className="icon-button subtle-button"
              onClick={() => edit({ kind: "vaccination" })}
              aria-label="ვაქცინაციის დამატება"
            >
              <Plus size={19} />
            </button>
          </div>
          {due ? (
            <div className="next-vaccine">
              <span className="vaccine-big-icon">
                <Syringe size={28} />
              </span>
              <div>
                <VaccinationBadge due={due.due_on} />
                <h3>{due.name}</h3>
                <p>შემდეგი აცრა · {formatDate(due.due_on!, true)}</p>
                <span className="field-hint">
                  თარიღი გადაამოწმე ვეტერინართან.
                </span>
              </div>
            </div>
          ) : (
            <EmptyState
              compact
              title="პირველი ჩანაწერი, მეტი სიმშვიდე"
              description="დაამატე ჩატარებული აცრა და შემდეგი თარიღი."
              action="აცრის დამატება"
              onAction={() => edit({ kind: "vaccination" })}
            />
          )}
          <button
            type="button"
            className="card-footer-link"
            onClick={() => go("health")}
          >
            ჯანმრთელობის სივრცე
            <span>
              {data.vaccinations.length} ჩანაწერი
              <ArrowUpRight size={17} />
            </span>
          </button>
        </section>
        <section className="card walk-summary">
          <div className="card-heading">
            <span className="card-icon sage-icon">
              <MapPin size={22} />
            </span>
            <span className="badge sage">ერთად, ღია ცის ქვეშ</span>
          </div>
          <h2>
            პატარა ნაბიჯები.
            <br />
            დიდი თავგადასავლები.
          </h2>
          <div className="walk-summary-stats">
            <div>
              <strong>
                {distance.toFixed(2)}
                <small>კმ</small>
              </strong>
              <span>გავლილი გზა</span>
            </div>
            <span />
            <div>
              <strong>
                {coins}
                <small>✦</small>
              </strong>
              <span>PawCoins</span>
            </div>
          </div>
          <Button variant="secondary" onClick={() => go("walk")}>
            გავისეირნოთ
            <ArrowUpRight size={17} />
          </Button>
          <div className="trail-decoration" aria-hidden="true">
            <svg viewBox="0 0 300 130">
              <path d="M-20 110C50 130 0 0 90 30s20 110 120 40S270 80 330 0" />
            </svg>
          </div>
        </section>
        <section className="card memories-preview">
          <div className="card-heading">
            <div>
              <span className="eyebrow">ღირს შესანახად</span>
              <h2>თქვენი პატარა ამბები</h2>
            </div>
            <span className="card-icon rose-icon">
              <Camera size={21} />
            </span>
          </div>
          {data.memories.length ? (
            <div className="mini-memories">
              {data.memories.slice(0, 3).map((memory) => (
                <button
                  key={memory.id}
                  type="button"
                  onClick={() => go("memories")}
                  aria-label={memory.caption}
                >
                  <Photo path={memory.photo_path} alt={memory.caption} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              kind="memory"
              title="საუკეთესო ამბები ჯერ წინ არის"
              description="პირველი ფოტო შენს ხელშია."
              action="მოგონების დამატება"
              onAction={() => edit({ kind: "memory" })}
            />
          )}
          <button
            className="card-footer-link"
            type="button"
            onClick={() => go("memories")}
          >
            ყველა მოგონება
            <ArrowUpRight size={17} />
          </button>
        </section>
        <section className="card vet-preview">
          <div className="card-heading">
            <h2>სანდო ხელში</h2>
            <ShieldCheck size={21} />
          </div>
          {data.vets[0] ? (
            <>
              <span className="vet-monogram">
                {data.vets[0].name.slice(0, 1)}
              </span>
              <h3>{data.vets[0].name}</h3>
              <p>{data.vets[0].clinic || "შენი ვეტერინარი"}</p>
              <a
                className="btn btn-secondary"
                href={phoneHref(data.vets[0].phone) || undefined}
              >
                <Phone size={16} />
                დარეკვა
              </a>
            </>
          ) : (
            <EmptyState
              compact
              title="შენი სანდო ვეტერინარი"
              description="შეინახე კონტაქტი, რომ საჭირო დროს ახლოს იყოს."
              action="კონტაქტის დამატება"
              onAction={() => edit({ kind: "vet" })}
            />
          )}
        </section>
        <button
          type="button"
          className="card club-invitation"
          onClick={() => go("club")}
        >
          <span className="club-symbol" aria-hidden="true">
            ✳
          </span>
          <span>
            <small>PetLog-ის კლუბი</small>
            <strong>
              კარგი მეგობრები.
              <br />
              განსაკუთრებული შესაძლებლობები.
            </strong>
            <span>
              აღმოაჩინე კლუბი და სტენდები
              <ArrowRight size={16} />
            </span>
          </span>
          <span className="round-arrow">
            <ArrowUpRight size={22} />
          </span>
        </button>
      </div>
    </>
  );
}

export function HealthPage({
  data,
  edit,
  remove,
}: {
  data: PetData;
  edit: (editor: Editor) => void;
  remove: (target: DeleteTarget) => void;
}) {
  const [tab, setTab] = useState<"vaccinations" | "vets">("vaccinations");
  const [filter, setFilter] = useState<"all" | "due">("all");
  const vaccinations = data.vaccinations.filter(
    (item) => filter === "all" || (item.due_on && daysUntil(item.due_on) <= 30),
  );
  return (
    <>
      <SectionHead
        eyebrow="ზრუნვა იწყება ყურადღებით"
        title="ჯანმრთელობის სივრცე"
        description="აცრები და სანდო კონტაქტები — ყოველთვის შენთან."
      >
        <Button
          variant="terracotta"
          onClick={() =>
            edit({ kind: tab === "vaccinations" ? "vaccination" : "vet" })
          }
        >
          <Plus size={18} />
          {tab === "vaccinations" ? "აცრის დამატება" : "ვეტერინარის დამატება"}
        </Button>
      </SectionHead>
      <div className="page-tabs" aria-label="ჯანმრთელობის კატეგორია">
        <button
          type="button"
          className={tab === "vaccinations" ? "active" : ""}
          aria-pressed={tab === "vaccinations"}
          onClick={() => setTab("vaccinations")}
        >
          <Syringe size={17} />
          ვაქცინაციები<span>{data.vaccinations.length}</span>
        </button>
        <button
          type="button"
          className={tab === "vets" ? "active" : ""}
          aria-pressed={tab === "vets"}
          onClick={() => setTab("vets")}
        >
          <ShieldCheck size={17} />
          ვეტერინარები<span>{data.vets.length}</span>
        </button>
      </div>
      {tab === "vaccinations" ? (
        <>
          <div className="list-toolbar">
            <p>თითოეული ჩანაწერი, მეტი სიმშვიდისთვის.</p>
            <label className="filter-select">
              <select
                aria-label="აცრების ფილტრი"
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as typeof filter)
                }
              >
                <option value="all">ყველა აცრა</option>
                <option value="due">მომავალი 30 დღე / გადაცილებული</option>
              </select>
            </label>
          </div>
          {vaccinations.length ? (
            <div className="health-grid">
              {vaccinations.map((item) => (
                <article className="card vaccination-card" key={item.id}>
                  <div className="card-heading">
                    <span className="card-icon sage-icon">
                      <Syringe size={22} />
                    </span>
                    <VaccinationBadge due={item.due_on} />
                  </div>
                  <h2>{item.name}</h2>
                  <p className="muted">
                    {item.clinic || "კლინიკა არ არის მითითებული"}
                  </p>
                  <dl className="detail-list">
                    <div>
                      <dt>ჩატარების თარიღი</dt>
                      <dd>{formatDate(item.administered_on, true)}</dd>
                    </div>
                    <div>
                      <dt>შემდეგი აცრა</dt>
                      <dd>
                        {item.due_on
                          ? formatDate(item.due_on, true)
                          : "არ არის მითითებული"}
                      </dd>
                    </div>
                  </dl>
                  {item.notes && <p className="record-note">{item.notes}</p>}
                  <div className="record-actions">
                    <Button
                      variant="ghost"
                      onClick={() => edit({ kind: "vaccination", item })}
                    >
                      <Pencil size={15} />
                      რედაქტირება
                    </Button>
                    <button
                      type="button"
                      className="icon-button danger-text"
                      aria-label={`${item.name} — წაშლა`}
                      onClick={() =>
                        remove({
                          table: "vaccinations",
                          id: item.id,
                          title: item.name,
                        })
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <section className="card">
              <EmptyState
                title={
                  filter === "due"
                    ? "ამ პერიოდში დაგეგმილი აცრა არ არის"
                    : "ზრუნვის ისტორია შენით იწყება"
                }
                description={
                  filter === "due"
                    ? "ყველა ჩანაწერის სანახავად შეცვალე ფილტრი."
                    : "დაამატე შენი მეგობრის პირველი ვაქცინაცია."
                }
                action="აცრის დამატება"
                onAction={() => edit({ kind: "vaccination" })}
              />
            </section>
          )}
        </>
      ) : data.vets.length ? (
        <div className="health-grid">
          {data.vets.map((item) => (
            <article className="card vet-card" key={item.id}>
              <div className="card-heading">
                <span className="vet-monogram">{item.name.slice(0, 1)}</span>
                <ShieldCheck size={21} />
              </div>
              <h2>{item.name}</h2>
              <p className="muted">{item.clinic || "შენი ვეტერინარი"}</p>
              {item.address && (
                <p className="address-line">
                  <MapPin size={16} />
                  {item.address}
                </p>
              )}
              {item.notes && <p className="record-note">{item.notes}</p>}
              <a
                className="btn btn-secondary"
                href={phoneHref(item.phone) || undefined}
              >
                <Phone size={16} />
                {item.phone}
              </a>
              <div className="record-actions">
                <Button
                  variant="ghost"
                  onClick={() => edit({ kind: "vet", item })}
                >
                  <Pencil size={15} />
                  რედაქტირება
                </Button>
                <button
                  type="button"
                  className="icon-button danger-text"
                  aria-label={`${item.name} — წაშლა`}
                  onClick={() =>
                    remove({
                      table: "vet_contacts",
                      id: item.id,
                      title: item.name,
                    })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="card">
          <EmptyState
            title="სანდო ადამიანი, ერთი ზარის მანძილზე"
            description="დაამატე შენი ვეტერინარის საკონტაქტო ინფორმაცია."
            action="ვეტერინარის დამატება"
            onAction={() => edit({ kind: "vet" })}
          />
        </section>
      )}
    </>
  );
}

export function MemoriesPage({
  data,
  edit,
  remove,
}: {
  data: PetData;
  edit: (editor: Editor) => void;
  remove: (target: DeleteTarget) => void;
}) {
  const [view, setView] = useState<Memory | null>(null);
  return (
    <>
      <SectionHead
        eyebrow="პატარა წამები, დიდი ბედნიერება"
        title="თქვენი მოგონებები"
        description="ამბები, რომლებსაც ისევ და ისევ დაუბრუნდები."
      >
        <Button variant="terracotta" onClick={() => edit({ kind: "memory" })}>
          <Plus size={18} />
          მოგონების დამატება
        </Button>
      </SectionHead>
      {data.memories.length ? (
        <div className="memories-grid">
          {data.memories.map((item) => (
            <article className="card memory-card" key={item.id}>
              <button
                type="button"
                className="memory-image"
                onClick={() => setView(item)}
                aria-label={`${item.caption} — ფოტოს ნახვა`}
              >
                <Photo path={item.photo_path} alt={item.caption} />
              </button>
              <div className="memory-copy">
                <time dateTime={item.taken_on}>
                  {formatDate(item.taken_on, true)}
                </time>
                <h2>{item.caption}</h2>
                <div className="record-actions">
                  <Button
                    variant="ghost"
                    onClick={() => edit({ kind: "memory", item })}
                  >
                    <Pencil size={15} />
                    რედაქტირება
                  </Button>
                  <button
                    type="button"
                    className="icon-button danger-text"
                    aria-label={`${item.caption} — წაშლა`}
                    onClick={() =>
                      remove({
                        table: "memories",
                        id: item.id,
                        title: item.caption,
                        photo: item.photo_path,
                      })
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="card memories-empty">
          <EmptyState
            kind="memory"
            title="თქვენი პირველი ამბავი ჯერ წინ არის"
            description="ატვირთე საყვარელი ფოტო და შეინახე ის პატარა წამი, რომელიც დიდ ბედნიერებას გჩუქნის."
            action="პირველი მოგონების დამატება"
            onAction={() => edit({ kind: "memory" })}
          />
          <div className="empty-caption">
            <Heart size={15} />
            ზოგი წამი სამუდამოდ რჩება.
          </div>
        </section>
      )}
      {view && (
        <Dialog title={view.caption} wide onClose={() => setView(null)}>
          <Photo
            className="lightbox-photo"
            path={view.photo_path}
            alt={view.caption}
          />
          <p className="muted">{formatDate(view.taken_on, true)}</p>
        </Dialog>
      )}
    </>
  );
}

export function RecordEditor({
  editor,
  pet,
  onClose,
  onSaved,
}: {
  editor: Editor;
  pet: Pet;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const item = editor.item;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const preview = useLocalPhoto(file);
  const lock = useRef(false);
  const title = `${item ? "რედაქტირება" : "დამატება"} — ${editor.kind === "vaccination" ? "ვაქცინაცია" : editor.kind === "vet" ? "ვეტერინარი" : "მოგონება"}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const values = new FormData(event.currentTarget);
    const value = (name: string) => String(values.get(name) || "").trim();
    if (
      editor.kind === "vaccination" &&
      value("due_on") &&
      value("due_on") < value("administered_on")
    ) {
      setError("შემდეგი აცრის თარიღი ჩატარების თარიღზე ადრე ვერ იქნება.");
      return;
    }
    if (editor.kind === "vet" && !phoneHref(value("phone"))) {
      setError("მიუთითე სწორი ტელეფონის ნომერი, 7–15 ციფრი.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (editor.kind === "vaccination")
        await saveVaccination(
          {
            pet_id: pet.id,
            name: value("name"),
            administered_on: value("administered_on"),
            due_on: value("due_on") || null,
            clinic: value("clinic"),
            notes: value("notes"),
          },
          editor.item?.id,
        );
      else if (editor.kind === "vet")
        await saveVet(
          {
            pet_id: pet.id,
            name: value("name"),
            clinic: value("clinic"),
            phone: value("phone"),
            address: value("address"),
            notes: value("notes"),
          },
          editor.item?.id,
        );
      else
        await saveMemory(
          {
            pet_id: pet.id,
            caption: value("caption"),
            taken_on: value("taken_on"),
          },
          file,
          editor.item,
        );
      await onSaved();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog title={title} onClose={onClose} busy={busy}>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <p className="modal-description">
          {pet.name} · ინფორმაცია შენს პირად სივრცეში შეინახება.
        </p>
        <fieldset disabled={busy}>
          {editor.kind === "vaccination" ? (
            <>
              <label className="field">
                ვაქცინის დასახელება
                <input
                  name="name"
                  defaultValue={editor.item?.name || ""}
                  required
                  maxLength={160}
                  pattern=".*\S.*"
                />
              </label>
              <div className="form-columns">
                <label className="field">
                  ჩატარების თარიღი
                  <input
                    type="date"
                    name="administered_on"
                    required
                    max={today()}
                    defaultValue={editor.item?.administered_on || ""}
                  />
                </label>
                <label className="field">
                  შემდეგი აცრა
                  <input
                    type="date"
                    name="due_on"
                    defaultValue={editor.item?.due_on || ""}
                  />
                </label>
              </div>
              <label className="field">
                კლინიკა
                <input
                  name="clinic"
                  defaultValue={editor.item?.clinic || ""}
                  maxLength={160}
                />
              </label>
              <label className="field">
                შენიშვნა
                <textarea
                  name="notes"
                  defaultValue={editor.item?.notes || ""}
                  maxLength={2000}
                  rows={3}
                />
              </label>
            </>
          ) : editor.kind === "vet" ? (
            <>
              <label className="field">
                ვეტერინარის სახელი
                <input
                  name="name"
                  defaultValue={editor.item?.name || ""}
                  required
                  maxLength={160}
                  pattern=".*\S.*"
                />
              </label>
              <label className="field">
                კლინიკა
                <input
                  name="clinic"
                  defaultValue={editor.item?.clinic || ""}
                  maxLength={160}
                />
              </label>
              <label className="field">
                ტელეფონი
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editor.item?.phone || ""}
                  required
                  maxLength={32}
                  autoComplete="tel"
                />
              </label>
              <label className="field">
                მისამართი
                <input
                  name="address"
                  defaultValue={editor.item?.address || ""}
                  maxLength={300}
                />
              </label>
              <label className="field">
                შენიშვნა
                <textarea
                  name="notes"
                  defaultValue={editor.item?.notes || ""}
                  maxLength={2000}
                  rows={3}
                />
              </label>
            </>
          ) : (
            <>
              <label className="photo-upload memory-upload">
                {preview ? (
                  <img src={preview} alt="არჩეული მოგონება" />
                ) : editor.item ? (
                  <Photo
                    path={editor.item.photo_path}
                    alt={editor.item.caption}
                  />
                ) : (
                  <Camera size={32} />
                )}
                <strong>
                  {preview || editor.item ? "ფოტოს შეცვლა" : "აირჩიე შენი ფოტო"}
                </strong>
                <small>JPG, PNG ან WebP · მაქსიმუმ 8 მბ</small>
                <Upload size={18} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="მოგონების ფოტოს არჩევა"
                  required={!editor.item && !file}
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
              </label>
              <label className="field">
                რა ამბავი აქვს ამ ფოტოს?
                <input
                  name="caption"
                  defaultValue={editor.item?.caption || ""}
                  required
                  maxLength={300}
                  pattern=".*\S.*"
                />
              </label>
              <label className="field">
                მოგონების თარიღი
                <input
                  type="date"
                  name="taken_on"
                  defaultValue={editor.item?.taken_on || ""}
                  required
                  max={today()}
                />
              </label>
            </>
          )}
        </fieldset>
        {error && <ErrorNotice message={error} />}
        <div className="modal-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onClose}
          >
            გაუქმება
          </Button>
          <Button type="submit" busy={busy}>
            შენახვა
            <ArrowRight size={17} />
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export type DeleteTarget = {
  table: "vaccinations" | "vet_contacts" | "memories";
  id: string;
  title: string;
  photo?: string;
};
export function DeleteRecordDialog({
  target,
  onClose,
  onSaved,
}: {
  target: DeleteTarget;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await deleteRecord(target.table, target.id);
      if (target.photo) await removePhoto(target.photo).catch(() => undefined);
      await onSaved();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="ჩანაწერის წაშლა" onClose={onClose} busy={busy}>
      <p className="modal-description">
        „{target.title}“ წაიშლება შენი ანგარიშიდან. ამ მოქმედების დაბრუნება
        შეუძლებელია.
      </p>
      {error && <ErrorNotice message={error} />}
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          გაუქმება
        </Button>
        <Button variant="danger" onClick={() => void remove()} busy={busy}>
          <Trash2 size={16} />
          წაშლა
        </Button>
      </div>
    </Dialog>
  );
}
