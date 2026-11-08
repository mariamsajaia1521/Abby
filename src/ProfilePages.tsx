import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, CalendarDays, Camera, Check, HeartPulse, Mail, MapPin, PawPrint, Pencil, Phone, Plus, Save, ShieldCheck, Stethoscope, Trash2, Weight as WeightIcon, X } from './components/icons';
import { imageData, phoneHref } from './api';
import { ageLabel, calendarDate, formatDate } from './dates';
import { today, type Dog, type Vet, type Weight } from './types';

type Notify = (message: string) => void;
type FormError = { message: string; field?: string } | null;
type ProfileDraft = Required<Omit<Dog, 'photo' | 'createdAt'>>;

const missing = 'არ არის მითითებული';
const sterilizationLabels = { unknown: 'უცნობია', yes: 'ჩატარებულია', no: 'არ ჩატარებულა' };
const errorMessage = (error: unknown) => error instanceof Error && error.message ? error.message : 'შენახვა ვერ მოხერხდა. სცადე ხელახლა.';

function profileDraft(dog: Dog): ProfileDraft {
  return {
    name: dog.name, species: dog.species ?? '', breed: dog.breed, age: dog.age,
    gender: dog.gender, birthDate: dog.birthDate ?? '', microchip: dog.microchip ?? '',
    sterilization: dog.sterilization ?? 'unknown', sterilizationDate: dog.sterilizationDate ?? '',
    allergies: dog.allergies ?? '', conditions: dog.conditions ?? '', emergencyContact: dog.emergencyContact ?? ''
  };
}

function vetDraft(vet: Vet | null): Vet {
  return {
    name: vet?.name ?? '', clinic: vet?.clinic ?? '', phone: vet?.phone ?? '',
    emergencyPhone: vet?.emergencyPhone ?? '', address: vet?.address ?? '',
    email: vet?.email ?? '', notes: vet?.notes ?? ''
  };
}

export { phoneHref } from './api';

const validEmail = (value: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

function PhoneLink({ value, label, className = '' }: { value: string; label: string; className?: string }) {
  const href = phoneHref(value);
  if (!value.trim()) return <span className="muted font-normal">{missing}</span>;
  return href ? <a href={href} className={`call-link min-h-11 max-w-full ${className}`} aria-label={`${label}: ${value}`}><Phone size={18} aria-hidden="true" className="shrink-0"/><bdi dir="ltr" className="min-w-0 break-all">{value}</bdi></a> : <bdi dir="ltr" className="break-all">{value}</bdi>;
}

function InfoLine({ label, children }: { label: string; children: ReactNode }) {
  return <div className="info-line"><dt className="min-w-0">{label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{children}</dd></div>;
}

function FormMessage({ id, error }: { id: string; error: FormError }) {
  return error ? <p id={id} role="alert" className="flex items-start gap-3 rounded-xl border border-[#b42318]/25 bg-[#f7f8fc] p-4 text-sm leading-6 text-[#b42318]"><AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0"/><span>{error.message}</span></p> : null;
}

function reportFormError(form: HTMLFormElement, setError: (error: FormError) => void, error: NonNullable<FormError>) {
  setError(error);
  const field = error.field ? form.elements.namedItem(error.field) : null;
  if (field instanceof HTMLElement) field.focus();
}

function PetPortrait({ photo, name, detail }: { photo?: string; name: string; detail: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  const hasPhoto = Boolean(photo) && !failed;

  return <figure className={`portrait-card m-0 ${hasPhoto ? '' : 'portrait-fallback'}`}>
    {hasPhoto ? <img src={photo} alt={`${name || 'შინაური ცხოველი'} — პროფილის ფოტო`} decoding="async" onError={() => setFailed(true)}/> : <div className="portrait-placeholder flex flex-col items-center gap-4 px-6 py-8 text-center">
      <img src={`${import.meta.env.BASE_URL}app-logo.png`} alt="" width={144} height={144} decoding="async" className="h-36 w-36 rounded-3xl object-cover"/>
      <span className="badge">PetLog-ის ილუსტრაცია</span>
      <p className="muted max-w-64 text-sm leading-6">{failed ? 'პროფილის ფოტო ვერ ჩაიტვირთა. შეგიძლია სხვა ფოტო აირჩიო.' : 'შენი მეგობრის ფოტო ჯერ არ დამატებულა.'}</p>
    </div>}
    <figcaption className="portrait-caption">
      <p className="mb-2 text-sm font-medium">ჩემი მეგობარი</p>
      <p className="break-words text-3xl font-semibold leading-snug">{name.trim() || 'შენი მეგობარი'}</p>
      {detail && <p className="mt-2 break-words text-sm leading-6">{detail}</p>}
    </figcaption>
  </figure>;
}

export function ProfilePage({ dog, vet, weight, save, notify }: {
  dog: Dog; vet: Vet | null; weight: Weight | undefined; save: (dog: Dog) => Promise<void>; notify: Notify;
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => profileDraft(dog));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<FormError>(null);
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  // null means untouched; an empty string means the user explicitly removed it.
  const [photoChange, setPhotoChange] = useState<string | null>(null);
  const imageVersion = useRef(0);
  const savingRef = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const editForm = useRef<HTMLFormElement>(null);
  const initialField = useRef('name');
  const returnFocus = useRef(false);

  useEffect(() => {
    imageVersion.current += 1;
    setDraft(profileDraft(dog));
    setPhotoChange(null);
    setImageBusy(false);
    setError(null);
    setEditing(false);
  }, [dog]);
  useEffect(() => () => { imageVersion.current += 1; }, []);
  useEffect(() => {
    if (!editing) return;
    const field = editForm.current?.elements.namedItem(initialField.current);
    if (field instanceof HTMLElement) field.focus();
  }, [editing]);
  useEffect(() => {
    if (returnFocus.current && !editing && !saving) {
      returnFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing, saving]);

  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
    setError(null);
  };
  const reset = () => {
    imageVersion.current += 1;
    setDraft(profileDraft(dog));
    setPhotoChange(null);
    setImageBusy(false);
    setError(null);
  };
  const openEditor = (field = 'name') => {
    if (savingRef.current) return;
    reset();
    initialField.current = field;
    setEditing(true);
  };
  const closeEditor = () => {
    if (savingRef.current) return;
    reset();
    returnFocus.current = true;
    setEditing(false);
  };
  const choosePhoto = async (file: File) => {
    if (savingRef.current) return;
    const version = ++imageVersion.current;
    setError(null);
    setImageBusy(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('აირჩიე 10 მბ-მდე ზომის ფოტო.');
      const result = await imageData(file);
      if (version === imageVersion.current) setPhotoChange(result);
    } catch (cause) {
      if (version === imageVersion.current) {
        const message = errorMessage(cause);
        setError({ message, field: 'photo' });
        notify(message);
      }
    } finally {
      if (version === imageVersion.current) setImageBusy(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current || imageBusy) return;
    const fail = (field: string, message: string) => reportFormError(event.currentTarget, setError, { field, message });
    if (!draft.name.trim()) return fail('name', 'მიუთითე შენი მეგობრის სახელი.');
    if (draft.birthDate && (!calendarDate(draft.birthDate) || draft.birthDate > today())) return fail('birthDate', 'დაბადების თარიღი უნდა იყოს სწორი და არ უნდა იყოს მომავალში.');
    if (draft.sterilizationDate && (!calendarDate(draft.sterilizationDate) || draft.sterilizationDate > today())) return fail('sterilizationDate', 'მიუთითე სტერილიზაციის სწორი თარიღი, რომელიც არ არის მომავალში.');
    if (draft.birthDate && draft.sterilizationDate && draft.sterilizationDate < draft.birthDate) return fail('sterilizationDate', 'სტერილიზაციის თარიღი არ უნდა უსწრებდეს დაბადების თარიღს.');
    const next: Dog = {
      ...dog,
      name: draft.name.trim(), species: draft.species.trim(), breed: draft.breed.trim(),
      birthDate: draft.birthDate, age: draft.age.trim(), gender: draft.gender,
      microchip: draft.microchip.trim(), sterilization: draft.sterilization,
      sterilizationDate: draft.sterilizationDate, allergies: draft.allergies.trim(),
      conditions: draft.conditions.trim(), emergencyContact: draft.emergencyContact.trim(),
      ...(photoChange !== null ? { photo: photoChange } : {})
    };
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await save(next);
      returnFocus.current = true;
      setEditing(false);
      notify('პროფილი განახლდა.');
    } catch (cause) {
      const message = errorMessage(cause);
      setError({ message });
      notify(message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const photo = editing && photoChange !== null ? photoChange : dog.photo;
  const portraitName = editing ? draft.name : dog.name;
  const portraitDetail = editing ? [draft.species, draft.breed].filter(Boolean).join(' · ') : [dog.species, dog.breed].filter(Boolean).join(' · ');
  const errorId = `${id}-error`;
  const errorProps = (field: string, hint?: string) => ({
    'aria-invalid': error?.field === field || undefined,
    'aria-describedby': [hint, error?.field === field ? errorId : undefined].filter(Boolean).join(' ') || undefined
  });
  const hasWeight = weight !== undefined && Number.isFinite(weight.weightKg) && weight.weightKg > 0;
  const hasCareDetails = Boolean(dog.allergies?.trim() || dog.conditions?.trim() || dog.emergencyContact?.trim());

  return <div className="profile-page space-y-7">
    <header className="page-top">
      <div className="min-w-0">
        <p className="eyebrow">ჩემი მეგობარი</p>
        <h1 className="page-title">მეგობრის პროფილი</h1>
        <p className="page-description">მისი მონაცემები, ზრუნვის საჭიროებები და სანდო კონტაქტები ერთ სივრცეში.</p>
      </div>
      <button ref={editButton} type="button" className={`btn ${editing ? 'btn-secondary' : 'btn-primary'} shrink-0`} disabled={saving} aria-expanded={editing} aria-controls={editing ? `${id}-form` : undefined} onClick={() => editing ? closeEditor() : openEditor()}>
        {editing ? <X size={18} aria-hidden="true"/> : <Pencil size={18} aria-hidden="true"/>}
        {editing ? 'რედაქტირების გაუქმება' : 'პროფილის შეცვლა'}
      </button>
    </header>

    <div className="profile-layout grid items-start gap-6 lg:grid-cols-[minmax(240px,.7fr)_minmax(0,1.6fr)]">
      <aside className="profile-summary grid min-w-0 items-start gap-5 sm:grid-cols-2 lg:grid-cols-1" aria-label="მეგობრის ბარათი და ბოლო წონა">
        <div className="min-w-0 space-y-4">
          {editing && <span className="badge">ცვლილებების წინასწარი ხედი</span>}
          <PetPortrait photo={photo} name={portraitName} detail={portraitDetail}/>
          {editing && photoChange !== null && <p role="status" className="muted text-sm leading-6">{photoChange ? 'ახალი ფოტო შეინახება პროფილის ცვლილებებთან ერთად.' : 'ფოტო წაიშლება ცვლილებების შენახვის შემდეგ.'}</p>}
          {!editing && <button type="button" className="btn btn-secondary w-full" disabled={saving} onClick={() => openEditor('photo')}><Camera size={18} aria-hidden="true"/>{dog.photo ? 'ფოტოს შეცვლა' : 'ფოტოს დამატება'}</button>}
        </div>
        <section className="surface min-w-0 p-6" aria-labelledby={`${id}-weight-title`}>
          <div className="flex items-center justify-between gap-3">
            <h2 id={`${id}-weight-title`} className="text-base font-semibold">ბოლო წონა</h2>
            <WeightIcon size={22} strokeWidth={1.5} className="shrink-0 text-[#5661d5]" aria-hidden="true"/>
          </div>
          {hasWeight ? <>
            <p className="mt-5 text-4xl font-semibold leading-tight">{weight.weightKg.toLocaleString('ka-GE', { maximumFractionDigits: 3 })} <span className="text-base font-normal">კგ</span></p>
            <p className="muted mt-3 flex items-start gap-2 text-sm leading-6"><CalendarDays size={18} className="mt-0.5 shrink-0" aria-hidden="true"/><time dateTime={weight.date}>{formatDate(weight.date, { year: true })}</time></p>
          </> : <div className="empty-state mt-5">
            <p className="font-medium text-[#202227]">წონა ჯერ არ დაფიქსირებულა</p>
            <p className="mt-2">პირველი გაზომვის დამატების შემდეგ აქ ბოლო წონას და თარიღს ნახავ.</p>
          </div>}
        </section>
      </aside>

      <div className="min-w-0 space-y-6">
        {editing ? <section id={`${id}-form`} className="surface min-w-0 p-6 sm:p-7" aria-labelledby={`${id}-edit-title`}>
          <div className="mb-7">
            <p className="eyebrow">ინფორმაციის განახლება</p>
            <h2 id={`${id}-edit-title`} className="section-title mt-2">პროფილის შეცვლა</h2>
            <p id={`${id}-required-help`} className="muted mt-3 text-sm leading-7">სახელი აუცილებელია. დანარჩენი ველები შეავსე იმ ინფორმაციით, რომელიც იცი. ცვლილებები შენახვის შემდეგ გამოჩნდება.</p>
          </div>
          <form ref={editForm} onSubmit={event => void submit(event)} noValidate aria-busy={saving || imageBusy} aria-describedby={`${id}-required-help`}>
            <fieldset disabled={saving} className="m-0 min-w-0 space-y-7 border-0 p-0">
              <legend className="sr-only">პროფილის მონაცემები</legend>
              <section className="profile-field-group space-y-5" aria-labelledby={`${id}-identity-edit-title`}>
                <h3 id={`${id}-identity-edit-title`} className="flex items-center gap-2 text-base font-semibold"><PawPrint size={19} className="shrink-0 text-[#5661d5]" aria-hidden="true"/>ძირითადი მონაცემები</h3>
                <div className="field-grid">
                  <label className="ui-label full"><span>სახელი <span className="muted font-normal">(აუცილებელი)</span></span><input name="name" className="ui-input" required maxLength={40} value={draft.name} onChange={event => update('name', event.target.value)} autoComplete="off" {...errorProps('name')}/></label>
                  <label className="ui-label">სახეობა<input name="species" className="ui-input" maxLength={60} value={draft.species} onChange={event => update('species', event.target.value)} placeholder="მაგ. ძაღლი"/></label>
                  <label className="ui-label">ჯიში<input name="breed" className="ui-input" maxLength={60} value={draft.breed} onChange={event => update('breed', event.target.value)}/></label>
                  <label className="ui-label">დაბადების თარიღი<input name="birthDate" className="ui-input" type="date" max={today()} value={draft.birthDate} onChange={event => update('birthDate', event.target.value)} {...errorProps('birthDate')}/></label>
                  <label className="ui-label">ასაკი<input name="age" className="ui-input" value={draft.age} onChange={event => update('age', event.target.value)} placeholder="მაგ. 3 წელი" aria-describedby={`${id}-age-help`}/><span id={`${id}-age-help`} className="muted text-sm font-normal leading-6">შეავსე, თუ დაბადების თარიღი უცნობია. თარიღის მითითებისას ასაკი ავტომატურად გამოითვლება, ეს ჩანაწერი კი შენარჩუნდება.</span></label>
                  <label className="ui-label">სქესი<select name="gender" className="ui-select" value={draft.gender} onChange={event => update('gender', event.target.value as Dog['gender'])}><option value="male">მამრი</option><option value="female">მდედრი</option></select></label>
                  <label className="ui-label">მიკროჩიპის ნომერი<input name="microchip" className="ui-input" maxLength={100} value={draft.microchip} onChange={event => update('microchip', event.target.value)} autoComplete="off"/></label>
                </div>
              </section>

              <section className="profile-field-group space-y-5 border-t border-[#e5e7eb] pt-7" aria-labelledby={`${id}-photo-title`}>
                <h3 id={`${id}-photo-title`} className="flex items-center gap-2 text-base font-semibold"><Camera size={19} className="shrink-0 text-[#5661d5]" aria-hidden="true"/>პროფილის ფოტო</h3>
                <label className="ui-label">ფოტოს არჩევა<input name="photo" className="ui-input" type="file" accept="image/*" disabled={imageBusy} {...errorProps('photo', `${id}-photo-help`)} onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void choosePhoto(file); }}/></label>
                <p id={`${id}-photo-help`} className="muted text-sm leading-6">აირჩიე 10 მბ-მდე ზომის სურათი. ფოტოს დამატება ან წაშლა ძალაში შევა პროფილის შენახვისას.</p>
                <p role="status" className="text-sm font-medium text-[#5661d5]">{imageBusy ? 'ფოტო მუშავდება…' : ''}</p>
                {(photo || photoChange !== null) && <div className="flex flex-wrap gap-3">
                  {photo && <button type="button" className="btn btn-secondary" disabled={imageBusy} onClick={() => { setPhotoChange(''); setError(null); }}><Trash2 size={17} aria-hidden="true"/>ფოტოს წაშლა</button>}
                  {photoChange !== null && <button type="button" className="btn btn-secondary" disabled={imageBusy} onClick={() => { setPhotoChange(null); setError(null); }}>ფოტოს ცვლილების გაუქმება</button>}
                </div>}
              </section>

              <section className="profile-field-group space-y-5 border-t border-[#e5e7eb] pt-7" aria-labelledby={`${id}-health-edit-title`}>
                <h3 id={`${id}-health-edit-title`} className="flex items-center gap-2 text-base font-semibold"><HeartPulse size={19} className="shrink-0 text-[#5661d5]" aria-hidden="true"/>ჯანმრთელობა და ზრუნვა</h3>
                <div className="field-grid">
                  <label className="ui-label">სტერილიზაცია<select name="sterilization" className="ui-select" value={draft.sterilization} onChange={event => { const value = event.target.value as ProfileDraft['sterilization']; setDraft(current => ({ ...current, sterilization: value, sterilizationDate: value === 'yes' ? current.sterilizationDate : '' })); setError(null); }}><option value="unknown">უცნობია</option><option value="yes">ჩატარებულია</option><option value="no">არ ჩატარებულა</option></select></label>
                  <label className="ui-label">სტერილიზაციის თარიღი<input name="sterilizationDate" className="ui-input" type="date" disabled={draft.sterilization !== 'yes'} min={draft.birthDate || undefined} max={today()} value={draft.sterilizationDate} onChange={event => update('sterilizationDate', event.target.value)} {...errorProps('sterilizationDate', `${id}-sterilization-help`)}/><span id={`${id}-sterilization-help`} className="muted text-sm font-normal leading-6">{draft.sterilization === 'yes' ? 'შეავსე, თუ ჩატარების თარიღი იცი.' : 'თარიღის შესავსებად აირჩიე „ჩატარებულია“.'}</span></label>
                  <label className="ui-label full">ალერგიები<textarea name="allergies" className="ui-textarea" rows={3} value={draft.allergies} onChange={event => update('allergies', event.target.value)} placeholder="ცნობილი ალერგიები, რეაქციები და მნიშვნელოვანი მითითებები"/></label>
                  <label className="ui-label full">ჯანმრთელობის მდგომარეობა<textarea name="conditions" className="ui-textarea" rows={3} value={draft.conditions} onChange={event => update('conditions', event.target.value)} placeholder="დიაგნოზები და ზრუნვის განსაკუთრებული საჭიროებები"/></label>
                </div>
              </section>

              <section className="profile-field-group space-y-5 border-t border-[#e5e7eb] pt-7" aria-labelledby={`${id}-contact-edit-title`}>
                <h3 id={`${id}-contact-edit-title`} className="flex items-center gap-2 text-base font-semibold"><ShieldCheck size={19} className="shrink-0 text-[#5661d5]" aria-hidden="true"/>საგანგებო კონტაქტი</h3>
                <label className="ui-label">საკონტაქტო პირი<textarea name="emergencyContact" className="ui-textarea" rows={3} value={draft.emergencyContact} onChange={event => update('emergencyContact', event.target.value)} placeholder="სახელი, ტელეფონის ნომერი და საჭირო მითითებები" aria-describedby={`${id}-contact-help`}/></label>
                <p id={`${id}-contact-help`} className="muted text-sm leading-6">ადამიანი, რომელსაც საჭიროებისას შენი მეგობრის შესახებ დაუკავშირდებიან.</p>
              </section>
            </fieldset>
            <div className="mt-5"><FormMessage id={errorId} error={error}/></div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving || imageBusy}><Save size={18} aria-hidden="true"/>{imageBusy ? 'ფოტო მუშავდება…' : saving ? 'ინახება…' : 'ცვლილებების შენახვა'}</button>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={closeEditor}>გაუქმება</button>
            </div>
          </form>
        </section> : <>
          <section className="surface min-w-0 p-6 sm:p-7" aria-labelledby={`${id}-details-title`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><p className="eyebrow">პირადი ბარათი</p><h2 id={`${id}-details-title`} className="section-title mt-2">ძირითადი მონაცემები</h2></div>
              <PawPrint size={24} strokeWidth={1.5} className="shrink-0 text-[#5661d5]" aria-hidden="true"/>
            </div>
            <dl className="profile-facts grid min-w-0 gap-x-8 sm:grid-cols-2">
              <InfoLine label="სახეობა">{dog.species?.trim() || missing}</InfoLine>
              <InfoLine label="ჯიში">{dog.breed?.trim() || missing}</InfoLine>
              <InfoLine label="ასაკი">{ageLabel(dog)}</InfoLine>
              <InfoLine label="დაბადების თარიღი">{dog.birthDate ? <time dateTime={dog.birthDate}>{formatDate(dog.birthDate, { year: true })}</time> : missing}</InfoLine>
              <InfoLine label="სქესი">{dog.gender === 'female' ? 'მდედრი' : dog.gender === 'male' ? 'მამრი' : missing}</InfoLine>
              <InfoLine label="მიკროჩიპის ნომერი">{dog.microchip?.trim() || missing}</InfoLine>
              <InfoLine label="სტერილიზაცია">{sterilizationLabels[dog.sterilization ?? 'unknown']}</InfoLine>
              {dog.sterilizationDate && <InfoLine label="სტერილიზაციის თარიღი"><time dateTime={dog.sterilizationDate}>{formatDate(dog.sterilizationDate, { year: true })}</time></InfoLine>}
            </dl>
          </section>

          <section className="surface min-w-0 p-6 sm:p-7" aria-labelledby={`${id}-care-title`}>
            <div className="mb-6 flex items-start gap-3">
              <HeartPulse size={23} strokeWidth={1.5} className="mt-1 shrink-0 text-[#5661d5]" aria-hidden="true"/>
              <div><p className="eyebrow">ყოველდღიური ზრუნვისთვის</p><h2 id={`${id}-care-title`} className="section-title mt-2">რაც უნდა გვახსოვდეს</h2></div>
            </div>
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <div className="min-w-0 rounded-2xl bg-[#fafafa] p-5">
                <h3 className="text-base font-semibold">ალერგიები</h3>
                <p className={`mt-3 whitespace-pre-wrap break-words text-sm leading-7 ${dog.allergies?.trim() ? '' : 'muted'}`}>{dog.allergies?.trim() || 'ალერგიების შესახებ ჩანაწერი ჯერ არ დამატებულა.'}</p>
              </div>
              <div className="min-w-0 rounded-2xl bg-[#fafafa] p-5">
                <h3 className="text-base font-semibold">ჯანმრთელობის მდგომარეობა</h3>
                <p className={`mt-3 whitespace-pre-wrap break-words text-sm leading-7 ${dog.conditions?.trim() ? '' : 'muted'}`}>{dog.conditions?.trim() || 'დიაგნოზები და ზრუნვის განსაკუთრებული საჭიროებები ჯერ არ არის მითითებული.'}</p>
              </div>
              <div className="min-w-0 rounded-2xl bg-[#f7f8fc] p-5 md:col-span-2">
                <h3 className="flex items-start gap-2 text-base font-semibold"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#5661d5]" aria-hidden="true"/>საგანგებო საკონტაქტო პირი</h3>
                <p className={`mt-3 whitespace-pre-wrap break-words text-sm leading-7 ${dog.emergencyContact?.trim() ? '' : 'muted'}`}>{dog.emergencyContact?.trim() || 'დაამატე იმ ადამიანის სახელი და ნომერი, რომელსაც საჭიროებისას დაუკავშირდებიან.'}</p>
              </div>
            </div>
            {!hasCareDetails && <button type="button" className="btn btn-secondary mt-5" disabled={saving} onClick={() => openEditor('allergies')}><Plus size={18} aria-hidden="true"/>დეტალების დამატება</button>}
          </section>
        </>}
      </div>
    </div>

    <section className="surface contact-card min-w-0 p-6 sm:p-7" aria-labelledby={`${id}-vet-title`}>
      <div className="flex items-start gap-3">
        <span className="contact-icon grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f7f8fc] text-[#5661d5]"><Stethoscope size={23} strokeWidth={1.5} aria-hidden="true"/></span>
        <div className="min-w-0"><p className="eyebrow">ზრუნვის გუნდი</p><h2 id={`${id}-vet-title`} className="section-title mt-1">ვეტერინარი</h2></div>
      </div>
      {vet ? <div className="mt-6 grid min-w-0 items-start gap-6 md:grid-cols-2">
        <div className="min-w-0"><h3 className="break-words text-lg font-semibold">{vet.name || vet.clinic || missing}</h3>{vet.name && vet.clinic && <p className="muted mt-2 break-words text-sm leading-7">{vet.clinic}</p>}</div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          <div className="min-w-0"><p className="muted text-sm">ტელეფონი</p><PhoneLink value={vet.phone} label="ვეტერინართან დარეკვა" className="mt-1"/></div>
          {vet.emergencyPhone?.trim() && <div className="min-w-0"><p className="muted text-sm">გადაუდებელი დახმარება</p><PhoneLink value={vet.emergencyPhone} label="ვეტერინარის გადაუდებელ ნომერზე დარეკვა" className="mt-1"/></div>}
        </div>
      </div> : <div className="empty-state mt-6">
        <h3 className="font-semibold text-[#202227]">სანდო კონტაქტი ყოველთვის ხელთ</h3>
        <p className="mt-2">დაამატე კლინიკა ან ექიმი „ვეტერინარის“ გვერდზე. შენახული საკონტაქტო ნომრები აქაც გამოჩნდება.</p>
      </div>}
    </section>
  </div>;
}

function RemoveVetDialog({ busy, error, onCancel, onConfirm }: { busy: boolean; error: FormError; onCancel: () => void; onConfirm: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  return <dialog ref={dialog} className="modal fixed m-auto border-0 text-[#202227] backdrop:bg-[#202227]/50" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="modal-head"><div><p className="eyebrow">მოქმედების დადასტურება</p><h2 id={`${id}-title`} className="section-title mt-2">წაიშალოს ვეტერინარის ბარათი?</h2></div><button type="button" className="icon-button shrink-0" disabled={busy} aria-label="წაშლის გაუქმება" onClick={onCancel}><X size={20} aria-hidden="true"/></button></div>
    <p id={`${id}-description`} className="muted text-sm leading-7">ვეტერინარის საკონტაქტო ინფორმაცია და შენიშვნები წაიშლება. საჭიროების შემთხვევაში ბარათს თავიდან შექმნი.</p>
    <div className="mt-4"><FormMessage id={`${id}-error`} error={error}/></div>
    <div className="form-actions"><button autoFocus type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>ბარათის დატოვება</button><button type="button" className="btn btn-danger" disabled={busy} onClick={onConfirm}><Trash2 size={18} aria-hidden="true"/>{busy ? 'იშლება…' : 'ბარათის წაშლა'}</button></div>
  </dialog>;
}

export function VetPage({ vet, save, notify }: { vet: Vet | null; save: (vet: Vet | null) => Promise<void>; notify: Notify }) {
  const id = useId();
  const [draft, setDraft] = useState(() => vetDraft(vet));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<FormError>(null);
  const [removeError, setRemoveError] = useState<FormError>(null);
  const busyRef = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const editForm = useRef<HTMLFormElement>(null);
  const initialField = useRef('name');
  const returnFocus = useRef(false);
  const busy = saving || removing;

  useEffect(() => {
    setDraft(vetDraft(vet));
    setEditing(false);
    setConfirmRemove(false);
    setError(null);
    setRemoveError(null);
  }, [vet]);
  useEffect(() => {
    if (!editing) return;
    const field = editForm.current?.elements.namedItem(initialField.current);
    if (field instanceof HTMLElement) field.focus();
  }, [editing]);
  useEffect(() => {
    if (returnFocus.current && !editing && !busy && !confirmRemove) {
      returnFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing, busy, confirmRemove]);

  const update = (key: keyof Vet, value: string) => { setDraft(current => ({ ...current, [key]: value })); setError(null); };
  const openEditor = (field = 'name') => {
    if (busyRef.current) return;
    setDraft(vetDraft(vet));
    setError(null);
    initialField.current = field;
    setEditing(true);
  };
  const closeEditor = () => {
    if (busyRef.current) return;
    setDraft(vetDraft(vet));
    setError(null);
    returnFocus.current = true;
    setEditing(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current) return;
    const fail = (field: string, message: string) => reportFormError(event.currentTarget, setError, { field, message });
    if (!draft.name.trim() && !draft.clinic.trim()) return fail('name', 'მიუთითე ვეტერინარის სახელი ან კლინიკის დასახელება.');
    for (const field of ['phone', 'emergencyPhone'] as const) {
      if (draft[field].trim() && !phoneHref(draft[field])) return fail(field, 'ნომერი უნდა შეიცავდეს 3–15 ციფრს. დასაშვებია +, გამოტოვება, ფრჩხილები, ტირე და დამატებითი ნომერი (ext).');
    }
    if (draft.email.trim() && !validEmail(draft.email.trim())) return fail('email', 'მიუთითე ელფოსტის სწორი მისამართი.');
    const next: Vet = {
      ...(vet ?? {}), name: draft.name.trim(), clinic: draft.clinic.trim(),
      phone: draft.phone.trim(), emergencyPhone: draft.emergencyPhone.trim(),
      address: draft.address.trim(), email: draft.email.trim(), notes: draft.notes.trim()
    };
    busyRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await save(next);
      returnFocus.current = true;
      setEditing(false);
      notify(vet ? 'ვეტერინარის ინფორმაცია განახლდა.' : 'ვეტერინარის ინფორმაცია დაემატა.');
    } catch (cause) {
      const message = errorMessage(cause);
      setError({ message });
      notify(message);
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };
  const remove = async () => {
    if (busyRef.current || !vet || !confirmRemove) return;
    busyRef.current = true;
    setRemoving(true);
    setRemoveError(null);
    try {
      await save(null);
      returnFocus.current = true;
      setConfirmRemove(false);
      setEditing(false);
      setDraft(vetDraft(null));
      notify('ვეტერინარის ინფორმაცია წაიშალა.');
    } catch (cause) {
      const message = errorMessage(cause);
      setRemoveError({ message });
      notify(message);
    } finally {
      busyRef.current = false;
      setRemoving(false);
    }
  };
  const errorId = `${id}-error`;
  const errorProps = (field: string, hint?: string) => ({
    'aria-invalid': error?.field === field || undefined,
    'aria-describedby': [hint, error?.field === field ? errorId : undefined].filter(Boolean).join(' ') || undefined
  });

  return <div className="vet-page space-y-7">
    <header className="page-top">
      <div className="min-w-0">
        <p className="eyebrow">ზრუნვის გუნდი</p>
        <h1 className="page-title">ვეტერინარი</h1>
        <p className="page-description">ექიმი, კლინიკა და საჭირო ნომრები — მშვიდი ყოველდღიურობისთვის.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button ref={editButton} type="button" className={`btn ${editing ? 'btn-secondary' : 'btn-primary'}`} disabled={busy} aria-expanded={editing} aria-controls={editing ? `${id}-form` : undefined} onClick={() => editing ? closeEditor() : openEditor()}>
          {editing ? <X size={18} aria-hidden="true"/> : vet ? <Pencil size={18} aria-hidden="true"/> : <Plus size={18} aria-hidden="true"/>}
          {editing ? 'რედაქტირების გაუქმება' : vet ? 'ბარათის შეცვლა' : 'ვეტერინარის დამატება'}
        </button>
        {vet && !editing && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setRemoveError(null); setConfirmRemove(true); }}><Trash2 size={18} aria-hidden="true"/>ბარათის წაშლა</button>}
      </div>
    </header>

    {editing ? <section id={`${id}-form`} className="surface min-w-0 max-w-4xl p-6 sm:p-7" aria-labelledby={`${id}-edit-title`}>
      <div className="mb-7">
        <p className="eyebrow">საკონტაქტო ინფორმაცია</p>
        <h2 id={`${id}-edit-title`} className="section-title mt-2">{vet ? 'ბარათის შეცვლა' : 'ახალი საკონტაქტო ბარათი'}</h2>
        <p id={`${id}-required-help`} className="muted mt-3 max-w-2xl text-sm leading-7">მიუთითე ვეტერინარის სახელი ან კლინიკის დასახელება. დანარჩენი ველები არჩევითია. ცვლილებები შენახვის შემდეგ გამოჩნდება.</p>
      </div>
      <form ref={editForm} onSubmit={event => void submit(event)} noValidate aria-busy={saving} aria-describedby={`${id}-required-help`}>
        <fieldset disabled={busy} className="m-0 min-w-0 space-y-7 border-0 p-0">
          <legend className="sr-only">ვეტერინარის მონაცემები</legend>
          <section className="profile-field-group space-y-5" aria-labelledby={`${id}-identity-edit-title`}>
            <h3 id={`${id}-identity-edit-title`} className="flex items-center gap-2 text-base font-semibold"><Stethoscope size={19} className="shrink-0 text-[#5661d5]" aria-hidden="true"/>ექიმი და კლინიკა</h3>
            <div className="field-grid">
              <label className="ui-label">ვეტერინარის სახელი<input name="name" className="ui-input" autoComplete="name" maxLength={120} value={draft.name} onChange={event => update('name', event.target.value)} {...errorProps('name', `${id}-required-help`)}/></label>
              <label className="ui-label">კლინიკის დასახელება<input name="clinic" className="ui-input" autoComplete="organization" maxLength={120} value={draft.clinic} onChange={event => update('clinic', event.target.value)} aria-describedby={`${id}-required-help`}/></label>
            </div>
          </section>

          <section className="profile-field-group space-y-5 border-t border-[#e5e7eb] pt-7" aria-labelledby={`${id}-contact-edit-title`}>
            <h3 id={`${id}-contact-edit-title`} className="flex items-center gap-2 text-base font-semibold"><Phone size={19} className="shrink-0 text-[#5661d5]" aria-hidden="true"/>როგორ დავუკავშირდეთ</h3>
            <div className="field-grid">
              <label className="ui-label">ტელეფონი<input name="phone" className="ui-input" type="tel" autoComplete="tel" maxLength={80} value={draft.phone} onChange={event => update('phone', event.target.value)} {...errorProps('phone', `${id}-phone-help`)}/></label>
              <label className="ui-label">გადაუდებელი დახმარების ნომერი<input name="emergencyPhone" className="ui-input" type="tel" autoComplete="off" maxLength={80} value={draft.emergencyPhone} onChange={event => update('emergencyPhone', event.target.value)} {...errorProps('emergencyPhone', `${id}-phone-help`)}/></label>
              <p id={`${id}-phone-help`} className="muted full text-sm leading-6">ნომერი უნდა შეიცავდეს 3–15 ციფრს. შეგიძლია გამოიყენო +, გამოტოვება, ფრჩხილები, ტირე და დამატებითი ნომერი (ext).</p>
              <label className="ui-label full">მისამართი<textarea name="address" className="ui-textarea" rows={2} autoComplete="street-address" value={draft.address} onChange={event => update('address', event.target.value)}/></label>
              <label className="ui-label full">ელფოსტა<input name="email" className="ui-input" type="email" autoComplete="email" maxLength={254} value={draft.email} onChange={event => update('email', event.target.value)} {...errorProps('email')}/></label>
            </div>
          </section>

          <section className="profile-field-group space-y-5 border-t border-[#e5e7eb] pt-7" aria-labelledby={`${id}-notes-edit-title`}>
            <h3 id={`${id}-notes-edit-title`} className="text-base font-semibold">დამატებითი დეტალები</h3>
            <label className="ui-label">შენიშვნები<textarea name="notes" className="ui-textarea" rows={4} value={draft.notes} onChange={event => update('notes', event.target.value)} placeholder="სამუშაო საათები, ვიზიტის მითითებები და სხვა მნიშვნელოვანი ინფორმაცია"/></label>
          </section>
        </fieldset>
        <div className="mt-5"><FormMessage id={errorId} error={error}/></div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}><Check size={18} aria-hidden="true"/>{saving ? 'ინახება…' : 'ბარათის შენახვა'}</button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={closeEditor}>გაუქმება</button>
        </div>
      </form>
    </section> : vet ? <div className="vet-layout grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="surface contact-card min-w-0 p-6 sm:p-7" aria-labelledby={`${id}-card-title`}>
        <div className="mb-6 flex items-start gap-4">
          <span className="contact-icon grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#f7f8fc] text-[#5661d5]"><Stethoscope size={27} strokeWidth={1.5} aria-hidden="true"/></span>
          <div className="min-w-0">
            <p className="eyebrow">{vet.name.trim() ? 'შენი ვეტერინარი' : 'შენი კლინიკა'}</p>
            <h2 id={`${id}-card-title`} className="mt-2 break-words text-2xl font-semibold leading-snug">{vet.name.trim() || vet.clinic.trim() || missing}</h2>
            {vet.name.trim() && vet.clinic.trim() && <p className="muted mt-2 break-words text-sm leading-7">{vet.clinic}</p>}
          </div>
        </div>
        <div className="min-w-0 rounded-2xl bg-[#f7f8fc] p-5">
          <p className="muted text-sm">ტელეფონი</p>
          <div className="mt-1"><PhoneLink value={vet.phone} label="ვეტერინართან დარეკვა"/></div>
          {vet.phone.trim() && !phoneHref(vet.phone) && <p className="mt-3 text-sm leading-6 text-[#b42318]">დარეკვამდე გადაამოწმე ნომრის ფორმატი და განაახლე ბარათი.</p>}
          {!vet.phone.trim() && <button type="button" className="btn btn-secondary mt-4" disabled={busy} onClick={() => openEditor('phone')}><Plus size={17} aria-hidden="true"/>ტელეფონის დამატება</button>}
        </div>
        <dl className="mt-5 min-w-0">
          <InfoLine label="მისამართი">{vet.address?.trim() ? <span className="inline-flex min-w-0 items-start gap-2"><MapPin size={18} aria-hidden="true" className="mt-0.5 shrink-0"/><span className="min-w-0">{vet.address}</span></span> : <span className="muted font-normal">{missing}</span>}</InfoLine>
          <InfoLine label="ელფოსტა">{vet.email?.trim() && validEmail(vet.email.trim()) ? <a href={`mailto:${encodeURIComponent(vet.email.trim())}`} className="call-link min-h-11 max-w-full" aria-label={`ელფოსტის გაგზავნა: ${vet.email}`}><Mail size={18} className="shrink-0" aria-hidden="true"/><bdi dir="ltr" className="min-w-0 break-all">{vet.email}</bdi></a> : <span className="muted font-normal">{vet.email || missing}</span>}</InfoLine>
        </dl>
      </section>

      <aside className="min-w-0 space-y-6" aria-label="გადაუდებელი კონტაქტი და შენიშვნები">
        <section className="surface contact-card contact-card--emergency min-w-0 p-6 sm:p-7" aria-labelledby={`${id}-emergency-title`}>
          <div className="flex items-start gap-3">
            <span className="contact-icon grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f7f8fc] text-[#5661d5]"><ShieldCheck size={23} strokeWidth={1.5} aria-hidden="true"/></span>
            <div className="min-w-0"><p className="eyebrow">საჭირო დროს ხელთ</p><h2 id={`${id}-emergency-title`} className="section-title mt-1">გადაუდებელი ნომერი</h2></div>
          </div>
          {vet.emergencyPhone?.trim() ? <div className="mt-5">
            <PhoneLink value={vet.emergencyPhone} label="ვეტერინარის გადაუდებელ ნომერზე დარეკვა"/>
            {!phoneHref(vet.emergencyPhone) && <p className="mt-3 text-sm leading-6 text-[#b42318]">დარეკვამდე გადაამოწმე ნომრის ფორმატი.</p>}
          </div> : <div className="mt-5">
            <p className="muted text-sm leading-7">გადაუდებელი დახმარების ნომერი ჯერ არ შეგინახავს. დაამატე კლინიკის მიერ მითითებული ნომერი, რომ საჭირო დროს სწრაფად იპოვო.</p>
            <button type="button" className="btn btn-secondary mt-4" disabled={busy} onClick={() => openEditor('emergencyPhone')}><Plus size={17} aria-hidden="true"/>ნომრის დამატება</button>
          </div>}
        </section>

        <section className="surface min-w-0 p-6 sm:p-7" aria-labelledby={`${id}-notes-title`}>
          <p className="eyebrow">შენთვის მნიშვნელოვანი</p>
          <h2 id={`${id}-notes-title`} className="section-title mt-2">შენიშვნები</h2>
          {vet.notes?.trim() ? <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7">{vet.notes.trim()}</p> : <>
            <p className="muted mt-4 text-sm leading-7">შენიშვნები ჯერ არ დამატებულა. აქ შეინახავ სამუშაო საათებს, ვიზიტის მითითებებს და სხვა სასარგებლო დეტალებს.</p>
            <button type="button" className="btn btn-secondary mt-4" disabled={busy} onClick={() => openEditor('notes')}><Plus size={17} aria-hidden="true"/>შენიშვნის დამატება</button>
          </>}
        </section>
      </aside>
    </div> : <section className="surface empty-state min-w-0 p-6 sm:p-9" aria-labelledby={`${id}-empty-title`}>
      <div className="grid items-start gap-6 text-left md:grid-cols-[auto_minmax(0,1fr)]">
        <span className="contact-icon grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-[#f7f8fc] text-[#5661d5]"><Stethoscope size={36} strokeWidth={1.4} aria-hidden="true"/></span>
        <div className="min-w-0">
          <p className="eyebrow">კონტაქტები ერთ სივრცეში</p>
          <h2 id={`${id}-empty-title`} className="section-title mt-2 text-[#202227]">შექმენი ვეტერინარის ბარათი</h2>
          <p className="muted mt-3 max-w-2xl text-sm leading-7">შეინახე შენი ვეტერინარის ან კლინიკის ნომერი, მისამართი და მნიშვნელოვანი დეტალები. საკონტაქტო ნომრები მეგობრის პროფილზეც გამოჩნდება.</p>
          <button type="button" className="btn btn-primary mt-5" disabled={busy} onClick={() => openEditor()}><Plus size={18} aria-hidden="true"/>ბარათის შექმნა</button>
        </div>
      </div>
    </section>}

    {confirmRemove && vet && <RemoveVetDialog busy={removing} error={removeError} onCancel={() => { if (!busyRef.current) { setConfirmRemove(false); setRemoveError(null); } }} onConfirm={() => void remove()}/>}
  </div>;
}
