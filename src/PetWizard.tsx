import { useRef, useState, type FormEvent } from "react";
import { savePet } from "./api";
import { today } from "./dates";
import { errorMessage } from "./supabase";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  LogOut,
  ShieldCheck,
  Upload,
} from "./components/icons";
import {
  Brand,
  Button,
  EmptyIllustration,
  ErrorNotice,
  Photo,
  useLocalPhoto,
} from "./components/UI";
import type { Gender, Pet, Species } from "./types";

export function PetWizard({
  existing,
  onSaved,
  onCancel,
  onLogout,
}: {
  existing?: Pet;
  onSaved: (pet: Pet) => void;
  onCancel?: () => void;
  onLogout?: () => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(existing?.name || "");
  const [species, setSpecies] = useState<Species | "">(existing?.species || "");
  const [gender, setGender] = useState<Gender | "">(existing?.gender || "");
  const [breed, setBreed] = useState(existing?.breed || "");
  const [birth, setBirth] = useState(existing?.birth_date || "");
  const [weight, setWeight] = useState(
    existing ? String(existing.weight_kg) : "",
  );
  const [microchip, setMicrochip] = useState(existing?.microchip || "");
  const [file, setFile] = useState<File | null>(null);
  const preview = useLocalPhoto(file);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = !existing && !onCancel;
  function go(value: number) {
    setError("");
    setStep(value);
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (step === 1 && !file && !existing?.photo_path) {
      setError("ატვირთე შენი მეგობრის რეალური ფოტო.");
      return;
    }
    if (step < 3) {
      go(step + 1);
      return;
    }
    if (!species || !gender) {
      go(1);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const pet = await savePet(
        {
          name,
          species,
          gender,
          breed,
          birth_date: birth,
          weight_kg: Number(weight),
          microchip: microchip || null,
        },
        file,
        existing,
      );
      onSaved(pet);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const body = (
    <div className="wizard-card">
      <div className="wizard-intro">
        <span className="eyebrow">
          {existing ? "უფრო ახლოს გავიცნოთ" : "თქვენი ისტორია იწყება აქ"}
        </span>
        <h1 ref={heading} tabIndex={-1}>
          {existing ? (
            "მეგობრის პროფილი"
          ) : first ? (
            <>
              დაამატე შენი
              <br />
              პირველი მეგობარი.
            </>
          ) : (
            "გაიცანი ახალი მეგობარი."
          )}
        </h1>
        <p>
          {first
            ? "სამი პატარა ნაბიჯი, რომ მთელი ზრუნვა ერთ სივრცეში მოაქციო."
            : "შეინახე შენი მეგობრის ზუსტი და განახლებული ინფორმაცია."}
        </p>
      </div>
      <ol className="wizard-steps" aria-label="პროფილის შევსების ნაბიჯები">
        {["გაცნობა", "დეტალები", "დადასტურება"].map((label, index) => (
          <li
            key={label}
            className={
              step === index + 1
                ? "current"
                : step > index + 1
                  ? "complete"
                  : ""
            }
            aria-current={step === index + 1 ? "step" : undefined}
          >
            <span>
              {step > index + 1 ? <Check size={15} /> : `0${index + 1}`}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <form
        onSubmit={(event) => void submit(event)}
        className="form-stack"
        aria-busy={busy}
      >
        <fieldset disabled={busy}>
          {step === 1 && (
            <div className="wizard-fields">
              <label
                className={`photo-upload ${preview || existing ? "has-photo" : ""}`}
              >
                <span className="upload-preview">
                  {preview ? (
                    <img src={preview} alt="შენ მიერ არჩეული ფოტო" />
                  ) : existing ? (
                    <Photo path={existing.photo_path} alt={existing.name} />
                  ) : (
                    <Camera size={30} />
                  )}
                </span>
                <span>
                  <strong>
                    {preview || existing ? "ფოტოს შეცვლა" : "ატვირთე მისი ფოტო"}
                  </strong>
                  <small>JPG, PNG ან WebP · მაქსიმუმ 8 მბ</small>
                </span>
                <Upload size={20} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="ცხოველის ფოტოს ატვირთვა"
                  onChange={(event) => {
                    const chosen = event.target.files?.[0];
                    if (chosen) {
                      setFile(chosen);
                      setError("");
                    }
                    event.target.value = "";
                  }}
                />
              </label>
              <label className="field">
                რა ჰქვია შენს მეგობარს?
                <input
                  name="pet-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={60}
                  pattern=".*\S.*"
                  placeholder="შეიყვანე მისი სახელი"
                  autoComplete="off"
                />
              </label>
              <div className="field">
                ვინ არის შენი მეგობარი?
                <div className="choice-grid">
                  {(["dog", "cat"] as const).map((value) => (
                    <label
                      key={value}
                      className={`choice ${species === value ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="species"
                        value={value}
                        checked={species === value}
                        onChange={() => setSpecies(value)}
                        required
                      />
                      <span>{value === "dog" ? "ძაღლი" : "კატა"}</span>
                      <span className="choice-dot" />
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                სქესი
                <div className="choice-grid">
                  {(["female", "male"] as const).map((value) => (
                    <label
                      key={value}
                      className={`choice ${gender === value ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={value}
                        checked={gender === value}
                        onChange={() => setGender(value)}
                        required
                      />
                      <span>{value === "female" ? "მდედრი" : "მამრი"}</span>
                      <span className="choice-dot" />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="wizard-fields">
              <label className="field">
                ჯიში
                <input
                  value={breed}
                  onChange={(event) => setBreed(event.target.value)}
                  required
                  maxLength={100}
                  pattern=".*\S.*"
                  placeholder="შეიყვანე ჯიში"
                />
                <span className="field-hint">
                  თუ ჯიში არ იცი, შეგიძლია ჩაწერო „უცნობია“.
                </span>
              </label>
              <div className="form-columns">
                <label className="field">
                  დაბადების თარიღი
                  <input
                    type="date"
                    value={birth}
                    onChange={(event) => setBirth(event.target.value)}
                    required
                    max={today()}
                    min="1980-01-01"
                  />
                </label>
                <label className="field">
                  წონა, კგ
                  <input
                    type="number"
                    inputMode="decimal"
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                    required
                    min="0.05"
                    max="200"
                    step="0.01"
                    placeholder="კილოგრამი"
                  />
                </label>
              </div>
              <label className="field">
                მიკროჩიპის / ტეგის ნომერი{" "}
                <span className="optional">არასავალდებულო</span>
                <input
                  value={microchip}
                  onChange={(event) => setMicrochip(event.target.value)}
                  maxLength={100}
                  placeholder="შეიყვანე ნომერი"
                />
              </label>
            </div>
          )}
          {step === 3 && (
            <div className="wizard-review">
              <div className="review-pet">
                {preview ? (
                  <img src={preview} alt={name} />
                ) : (
                  existing && <Photo path={existing.photo_path} alt={name} />
                )}
                <div>
                  <span className="eyebrow">შენი მეგობარი</span>
                  <h2>{name}</h2>
                  <p>
                    {species === "dog" ? "ძაღლი" : "კატა"} ·{" "}
                    {gender === "female" ? "მდედრი" : "მამრი"}
                  </p>
                </div>
                <span className="review-heart">♡</span>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>ჯიში</dt>
                  <dd>{breed}</dd>
                </div>
                <div>
                  <dt>დაბადების თარიღი</dt>
                  <dd>{birth}</dd>
                </div>
                <div>
                  <dt>წონა</dt>
                  <dd>{weight} კგ</dd>
                </div>
                <div>
                  <dt>მიკროჩიპი / ტეგი</dt>
                  <dd>{microchip || "არ არის მითითებული"}</dd>
                </div>
              </dl>
              <p className="privacy-line">
                <ShieldCheck size={18} />
                ეს ინფორმაცია მხოლოდ შენს ანგარიშში შეინახება.
              </p>
            </div>
          )}
        </fieldset>
        {error && <ErrorNotice message={error} />}
        <div className="wizard-actions">
          {step > 1 ? (
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => go(step - 1)}
            >
              <ChevronLeft size={17} />
              უკან
            </Button>
          ) : (
            onCancel && (
              <Button variant="ghost" type="button" onClick={onCancel}>
                გაუქმება
              </Button>
            )
          )}
          <Button
            variant={step === 3 ? "terracotta" : "primary"}
            type="submit"
            busy={busy}
          >
            {step === 3
              ? existing
                ? "ცვლილებების შენახვა"
                : "ჩემი მეგობრის დამატება"
              : "გაგრძელება"}
            <ArrowRight size={18} />
          </Button>
        </div>
      </form>
    </div>
  );
  if (!first) return body;
  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Brand />
        {onLogout && (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              void onLogout().catch((cause) => setError(errorMessage(cause)));
            }}
          >
            გასვლა
            <LogOut size={16} />
          </button>
        )}
      </header>
      <div className="onboarding-layout">
        <aside className="onboarding-story">
          <div className="onboarding-art">
            <EmptyIllustration kind="pet" />
          </div>
          <span className="eyebrow">ერთად, ყოველდღე</span>
          <h2>
            მთელი სიყვარული.
            <br />
            მთელი ზრუნვა.
            <br />
            <em>ერთ სივრცეში.</em>
          </h2>
          <p>
            აცრებიდან პირველ დიდ გასეირნებამდე — შეინახე ყველაფერი, რაც მისთვის
            მნიშვნელოვანია.
          </p>
          <span className="onboarding-flower" aria-hidden="true">
            ✳
          </span>
        </aside>
        {body}
      </div>
      <footer className="onboarding-footer">
        <ShieldCheck size={15} />
        პირადი სივრცე შენთვის და შენი მეგობრისთვის
      </footer>
    </main>
  );
}
