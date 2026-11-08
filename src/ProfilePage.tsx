import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { deletePet, getProfile, saveProfile } from "./api";
import { ageLabel, formatDate } from "./dates";
import { errorMessage } from "./supabase";
import { PetWizard } from "./PetWizard";
import {
  ArrowRight,
  LogOut,
  Pencil,
  ShieldCheck,
  Trash2,
} from "./components/icons";
import {
  Button,
  Dialog,
  ErrorNotice,
  Photo,
  SectionHead,
} from "./components/UI";
import type { Pet, Profile } from "./types";

export function ProfilePage({
  pet,
  user,
  profile,
  onProfile,
  onPetSaved,
  onPetDeleted,
  logout,
  walkActive,
}: {
  pet: Pet;
  user: User;
  profile: Profile | null;
  onProfile: (profile: Profile | null) => void;
  onPetSaved: (pet: Pet) => void;
  onPetDeleted: () => void;
  logout: () => Promise<void>;
  walkActive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = String(
      new FormData(event.currentTarget).get("display_name") || "",
    );
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await saveProfile(name);
      onProfile(await getProfile());
      setSaved(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function removePet() {
    if (busy || confirmation !== pet.name || walkActive) return;
    setBusy(true);
    setError("");
    try {
      await deletePet(pet);
      setDeleting(false);
      onPetDeleted();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionHead
        eyebrow="ყველა პატარა დეტალი მნიშვნელოვანია"
        title="მეგობრის პროფილი"
        description="გაიცანი, შეინახე, იზრუნე."
      >
        <Button variant="secondary" onClick={() => setEditing(true)}>
          <Pencil size={17} />
          რედაქტირება
        </Button>
      </SectionHead>
      <div className="profile-layout">
        <section className="card profile-portrait">
          <Photo path={pet.photo_path} alt={pet.name} />
          <div>
            <span className="eyebrow">ჩემი მეგობარი</span>
            <h2>
              {pet.name}
              <span>♡</span>
            </h2>
            <p>{pet.breed}</p>
            <span className="badge sage">{ageLabel(pet.birth_date)}</span>
          </div>
        </section>
        <section className="card profile-details">
          <div className="card-heading">
            <h2>პირადი ბარათი</h2>
            <ShieldCheck size={22} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>სახელი</dt>
              <dd>{pet.name}</dd>
            </div>
            <div>
              <dt>სახეობა</dt>
              <dd>{pet.species === "dog" ? "ძაღლი" : "კატა"}</dd>
            </div>
            <div>
              <dt>სქესი</dt>
              <dd>{pet.gender === "female" ? "მდედრი" : "მამრი"}</dd>
            </div>
            <div>
              <dt>ჯიში</dt>
              <dd>{pet.breed}</dd>
            </div>
            <div>
              <dt>დაბადების თარიღი</dt>
              <dd>{formatDate(pet.birth_date, true)}</dd>
            </div>
            <div>
              <dt>წონა</dt>
              <dd>{Number(pet.weight_kg).toLocaleString("ka-GE")} კგ</dd>
            </div>
            <div>
              <dt>მიკროჩიპი / ტეგი</dt>
              <dd>{pet.microchip || "არ არის მითითებული"}</dd>
            </div>
          </dl>
        </section>
        <section className="card account-card">
          <div className="card-heading">
            <h2>შენი ანგარიში</h2>
            <span className="badge sage">
              <ShieldCheck size={13} />
              ელფოსტა დადასტურებულია
            </span>
          </div>
          <form
            className="form-stack"
            onSubmit={(event) => void updateProfile(event)}
          >
            <fieldset disabled={busy}>
              <label className="field">
                როგორ მოგმართოთ?
                <input
                  name="display_name"
                  defaultValue={profile?.display_name || ""}
                  maxLength={100}
                  autoComplete="given-name"
                  placeholder="შენი სახელი"
                />
              </label>
              <label className="field">
                ელფოსტა
                <input type="email" value={user.email || ""} readOnly />
              </label>
            </fieldset>
            {error && !deleting && <ErrorNotice message={error} />}{" "}
            {saved && (
              <p className="success-notice" role="status">
                შენახულია.
              </p>
            )}
            <div className="account-actions">
              <Button type="submit" busy={busy}>
                შენახვა
                <ArrowRight size={17} />
              </Button>
              <Button
                variant="ghost"
                type="button"
                disabled={busy || walkActive}
                onClick={() => {
                  void logout().catch((cause) => setError(errorMessage(cause)));
                }}
              >
                <LogOut size={16} />
                ანგარიშიდან გასვლა
              </Button>
            </div>
            {walkActive && (
              <p className="field-hint">
                გასვლამდე დაასრულე და შეინახე მიმდინარე სეირნობა.
              </p>
            )}
          </form>
        </section>
        <section className="card profile-data-card">
          <span className="card-icon warm">
            <ShieldCheck size={23} />
          </span>
          <h2>შენი ინფორმაცია შენ გეკუთვნის.</h2>
          <p>
            ფოტოები და ჩანაწერები შენს ანგარიშზეა მიბმული. მეგობრის წაშლისას
            მისი ჯანმრთელობის ისტორია, მოგონებები, ვაუჩერები და სეირნობებიც
            წაიშლება.
          </p>
          <Button
            variant="ghost"
            className="danger-text"
            disabled={walkActive}
            onClick={() => {
              setDeleting(true);
              setError("");
            }}
          >
            <Trash2 size={16} />
            მეგობრისა და მისი მონაცემების წაშლა
          </Button>
        </section>
      </div>
      {editing && (
        <Dialog
          title="პროფილის რედაქტირება"
          wide
          onClose={() => setEditing(false)}
        >
          <PetWizard
            existing={pet}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              onPetSaved(updated);
              setEditing(false);
            }}
          />
        </Dialog>
      )}{" "}
      {deleting && (
        <Dialog
          title="მეგობრის მონაცემების წაშლა"
          onClose={() => setDeleting(false)}
          busy={busy}
        >
          <p className="modal-description">
            წაიშლება {pet.name}-ს პროფილი და მასთან დაკავშირებული ყველა
            ჩანაწერი. მოქმედების დაბრუნება შეუძლებელია.
          </p>
          <label className="field">
            დასადასტურებლად ჩაწერე მეგობრის სახელი: {pet.name}
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={busy}
              autoComplete="off"
            />
          </label>
          {error && <ErrorNotice message={error} />}
          <div className="modal-actions">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDeleting(false)}
            >
              გაუქმება
            </Button>
            <Button
              variant="danger"
              busy={busy}
              disabled={confirmation !== pet.name || walkActive}
              onClick={() => void removePet()}
            >
              მონაცემების წაშლა
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
