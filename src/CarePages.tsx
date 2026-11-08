import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ClipboardList, FileText, FlaskConical, ImagePlus, Pencil, Pill, Plus, Repeat2, Scissors, Search, ShieldCheck, Stethoscope, Syringe, Trash2, Weight as WeightIcon, X } from './components/icons';
import { imageData } from './api';
import { calendarDate, formatDate } from './dates';
import { today, uid, type Health, type PageIntent, type Reminder, type Weight } from './types';
import { WeightChart } from './components/WeightChart';

type HealthCategory = Health['type'];
type Notify = (message: string) => void;
type FieldErrors = { title?: string; date?: string; weight?: string };
type HealthTab = 'records' | 'weights';
type PlanFilter = 'open' | 'done' | 'all';

const healthLabels: Record<HealthCategory, string> = {
  analysis: 'ანალიზი', vaccination: 'ვაქცინაცია', document: 'დოკუმენტი', visit: 'ვიზიტი',
  medication: 'მედიკამენტი', prevention: 'პრევენცია', surgery: 'ოპერაცია'
};
const healthIcons = {
  analysis: FlaskConical, vaccination: Syringe, document: FileText, visit: Stethoscope,
  medication: Pill, prevention: ShieldCheck, surgery: Scissors
};
const reminderLabels: Record<Reminder['category'], string> = {
  appointment: 'ვიზიტი', vaccination: 'ვაქცინაცია', medication: 'მედიკამენტი', prevention: 'პრევენცია', followup: 'განმეორებითი ვიზიტი'
};
const recurrenceLabels: Record<Reminder['recurrence'], string> = {
  none: 'არ მეორდება', daily: 'ყოველდღე', weekly: 'ყოველ კვირას', monthly: 'ყოველ თვეს', yearly: 'ყოველ წელს'
};
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'შენახვა ვერ მოხერხდა. გთხოვთ, სცადოთ ხელახლა.';
const fullDate = (value: string) => formatDate(value, { year: true });
const labelClass = 'ui-label min-w-0';
const iconClass = 'icon-button inline-flex h-11 w-11 shrink-0 items-center justify-center';

// Keep the original day through short months and leap years. Completing an overdue
// reminder advances from its scheduled date, preserving the existing recurrence policy.
function nextDate(value: string, recurrence: Reminder['recurrence'], anchorDay?: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (recurrence === 'daily' || recurrence === 'weekly') date.setDate(date.getDate() + (recurrence === 'daily' ? 1 : 7));
  if (recurrence === 'monthly' || recurrence === 'yearly') {
    const targetMonth = month - 1 + (recurrence === 'monthly' ? 1 : 12);
    const lastDay = new Date(year, targetMonth + 1, 0).getDate();
    date.setDate(1);
    date.setFullYear(year, targetMonth, Math.min(anchorDay || day, lastDay));
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function recurrenceAnchor(previous: Reminder | undefined, date: string, recurrence: Reminder['recurrence']) {
  return previous?.date === date && previous.recurrence === recurrence
    ? previous.anchorDay ?? Number(date.slice(8, 10))
    : Number(date.slice(8, 10));
}

function handleTabKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
  const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0 || !tabs.length) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}

function InlineError({ id, message }: { id: string; message?: string }) {
  return message ? <span id={id} className="form-error text-sm" role="alert">{message}</span> : null;
}

function Dialog({ title, description, children, onClose, busy = false, destructive = false, restoreFocusRef }: {
  title: string; description?: string; children: ReactNode; onClose: () => void;
  busy?: boolean; destructive?: boolean; restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const id = useId();
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const fallbackRef = useRef(restoreFocusRef);
  closeRef.current = onClose;
  busyRef.current = busy;
  fallbackRef.current = restoreFocusRef;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdropRef.current)
      .map(element => ({ element, inert: element.inert }));
    background.forEach(({ element }) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    ) ?? []).filter(element => element.getClientRects().length > 0 && !element.closest('[hidden], [inert]'));
    const focusInside = () => {
      const initial = dialogRef.current?.querySelector<HTMLElement>('[data-dialog-initial-focus]:not(:disabled)');
      (initial ?? focusable()[0] ?? dialogRef.current)?.focus({ preventScroll: true });
    };
    focusInside();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!busyRef.current) closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
      const inside = dialogRef.current?.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (!inside || document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault(); first.focus();
      }
    };
    const focusin = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) focusInside();
    };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', focusin);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', focusin);
      background.forEach(({ element, inert }) => { element.inert = inert; });
      document.body.style.overflow = previousOverflow;
      const target = previousFocus?.isConnected ? previousFocus : fallbackRef.current?.current;
      target?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(<div ref={backdropRef} className="modal-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <div ref={dialogRef} className="modal" role={destructive ? 'alertdialog' : 'dialog'} aria-modal="true"
      aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} aria-busy={busy} tabIndex={-1}>
      <div className="modal-head">
        <h2 id={`${id}-title`} className="section-title">{title}</h2>
        <button type="button" className={iconClass} aria-label="ფანჯრის დახურვა" disabled={busy} onClick={onClose}><X size={20} aria-hidden="true"/></button>
      </div>
      {description && <p id={`${id}-description`} className="muted break-words text-sm leading-7">{description}</p>}
      {children}
    </div>
  </div>, document.body);
}

export function HealthPage({ entries, weights, saveEntries, saveWeights, notify, intent, onIntentHandled }: {
  entries: Health[]; weights: Weight[]; saveEntries: (items: Health[]) => Promise<void>;
  saveWeights: (items: Weight[]) => Promise<void>; notify: Notify; intent?: PageIntent; onIntentHandled?: () => void;
}) {
  const id = useId();
  const [activeTab, setActiveTab] = useState<HealthTab>('records');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [showRecord, setShowRecord] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [type, setType] = useState<HealthCategory>('visit');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [recordErrors, setRecordErrors] = useState<FieldErrors>({});
  const [recordError, setRecordError] = useState('');
  const [showWeight, setShowWeight] = useState(false);
  const [editingWeight, setEditingWeight] = useState<string | null>(null);
  const [weightDate, setWeightDate] = useState(today());
  const [weightValue, setWeightValue] = useState('');
  const [weightErrors, setWeightErrors] = useState<FieldErrors>({});
  const [weightError, setWeightError] = useState('');
  const [pending, setPending] = useState<'record' | 'weight' | 'delete' | null>(null);
  const [preview, setPreview] = useState('');
  const [deleting, setDeleting] = useState<{ kind: 'record' | 'weight'; id: string } | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [recordFocusRequest, requestRecordFocus] = useState(0);
  const [weightFocusRequest, requestWeightFocus] = useState(0);
  const operationRef = useRef(false);
  const imageSequence = useRef(0);
  const handledIntent = useRef<PageIntent | undefined>(undefined);
  const recordTitleRef = useRef<HTMLInputElement>(null);
  const recordDateRef = useRef<HTMLInputElement>(null);
  const recordErrorRef = useRef<HTMLParagraphElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const weightDateRef = useRef<HTMLInputElement>(null);
  const weightErrorRef = useRef<HTMLParagraphElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const recordTriggerRef = useRef<HTMLElement | null>(null);
  const weightTriggerRef = useRef<HTMLElement | null>(null);
  const busy = pending !== null;

  const records = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return [...entries].filter(item => (category === 'all' || item.type === category)
      && (!search || [item.title, item.note, healthLabels[item.type] || item.type].some(value => (value || '').toLocaleLowerCase().includes(search))))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, query, category]);
  const sortedWeights = useMemo(() => [...weights].sort((a, b) => b.date.localeCompare(a.date) || b.timestamp - a.timestamp), [weights]);
  const chartWeights = useMemo(() => weights.filter(item => Number.isFinite(item.weightKg) && item.weightKg > 0 && calendarDate(item.date)), [weights]);
  const latestRecord = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date))[0], [entries]);
  const latestWeight = sortedWeights[0];
  const hasFilters = Boolean(query.trim() || category !== 'all');

  const openRecord = useCallback(() => {
    recordTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    imageSequence.current += 1;
    setImageBusy(false); setImageError(''); setRecordErrors({}); setRecordError('');
    setEditing(null); setType('visit'); setTitle(''); setDate(today()); setNote(''); setPhoto('');
    setActiveTab('records'); setShowRecord(true);
    requestRecordFocus(value => value + 1);
  }, []);
  const openWeight = useCallback(() => {
    weightTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingWeight(null); setWeightDate(today()); setWeightValue(''); setWeightErrors({}); setWeightError('');
    setActiveTab('weights'); setShowWeight(true);
    requestWeightFocus(value => value + 1);
  }, []);

  useEffect(() => {
    if (!intent) { handledIntent.current = undefined; return; }
    if (intent !== 'health-record' && intent !== 'weight') return;
    if (handledIntent.current === intent) return;
    handledIntent.current = intent;
    if (intent === 'health-record') openRecord(); else openWeight();
    onIntentHandled?.();
  }, [intent, onIntentHandled, openRecord, openWeight]);
  useEffect(() => {
    if (recordFocusRequest) recordTitleRef.current?.focus();
  }, [recordFocusRequest]);
  useEffect(() => {
    if (weightFocusRequest) weightInputRef.current?.focus();
  }, [weightFocusRequest]);
  useEffect(() => { if (recordError) recordErrorRef.current?.focus(); }, [recordError]);
  useEffect(() => { if (weightError) weightErrorRef.current?.focus(); }, [weightError]);
  useEffect(() => () => { imageSequence.current += 1; }, []);

  const resetRecord = () => {
    imageSequence.current += 1;
    setEditing(null); setTitle(''); setNote(''); setPhoto(''); setImageBusy(false); setImageError('');
    setRecordErrors({}); setRecordError(''); setShowRecord(false);
    requestAnimationFrame(() => {
      const target = recordTriggerRef.current;
      (target?.isConnected ? target : listHeadingRef.current)?.focus({ preventScroll: true });
    });
  };
  const resetWeight = () => {
    setEditingWeight(null); setWeightValue(''); setWeightErrors({}); setWeightError(''); setShowWeight(false);
    requestAnimationFrame(() => {
      const target = weightTriggerRef.current;
      (target?.isConnected ? target : listHeadingRef.current)?.focus({ preventScroll: true });
    });
  };
  const editRecord = (item: Health) => {
    recordTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    imageSequence.current += 1;
    setImageBusy(false); setImageError(''); setRecordErrors({}); setRecordError('');
    setEditing(item.id); setType(item.type); setTitle(item.title); setDate(item.date); setNote(item.note || '');
    setPhoto(item.photo || ''); setActiveTab('records'); setShowRecord(true);
    requestRecordFocus(value => value + 1);
  };
  const editWeight = (item: Weight) => {
    weightTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingWeight(item.id); setWeightDate(item.date); setWeightValue(String(item.weightKg));
    setWeightErrors({}); setWeightError(''); setActiveTab('weights'); setShowWeight(true);
    requestWeightFocus(value => value + 1);
  };
  const submitRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (operationRef.current || imageBusy) return;
    const errors: FieldErrors = {};
    if (!title.trim()) errors.title = 'მიუთითეთ ჩანაწერის სათაური.';
    if (!calendarDate(date)) errors.date = 'მიუთითეთ სწორი თარიღი.';
    setRecordErrors(errors); setRecordError('');
    if (Object.keys(errors).length) {
      (errors.title ? recordTitleRef : recordDateRef).current?.focus();
      return;
    }
    const previous = entries.find(item => item.id === editing);
    const item: Health = { ...previous, id: editing || uid(), type, title: title.trim(), date, note: note.trim(), photo: photo || undefined };
    operationRef.current = true; setPending('record');
    try {
      await saveEntries(editing ? entries.map(entry => entry.id === editing ? item : entry) : [...entries, item]);
      setQuery(''); setCategory('all');
      resetRecord(); notify(editing ? 'სამედიცინო ჩანაწერი განახლდა.' : 'სამედიცინო ჩანაწერი დაემატა.');
    } catch (error) { setRecordError(errorMessage(error)); }
    finally { operationRef.current = false; setPending(null); }
  };
  const submitWeight = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (operationRef.current) return;
    const value = Number(weightValue);
    const errors: FieldErrors = {};
    if (!weightValue.trim() || !Number.isFinite(value) || value <= 0 || value > 120) errors.weight = 'მიუთითეთ წონა 0-ზე მეტი და არაუმეტეს 120 კგ.';
    if (!calendarDate(weightDate)) errors.date = 'მიუთითეთ გაზომვის სწორი თარიღი.';
    setWeightErrors(errors); setWeightError('');
    if (Object.keys(errors).length) {
      (errors.weight ? weightInputRef : weightDateRef).current?.focus();
      return;
    }
    const previous = weights.find(item => item.id === editingWeight);
    const item: Weight = { ...previous, id: editingWeight || uid(), date: weightDate, weightKg: value, timestamp: previous?.timestamp ?? Date.now() };
    operationRef.current = true; setPending('weight');
    try {
      await saveWeights(editingWeight ? weights.map(entry => entry.id === editingWeight ? item : entry) : [...weights, item]);
      resetWeight(); notify(editingWeight ? 'წონის ჩანაწერი განახლდა.' : 'წონის ჩანაწერი დაემატა.');
    } catch (error) { setWeightError(errorMessage(error)); }
    finally { operationRef.current = false; setPending(null); }
  };
  const uploadPhoto = async (file: File) => {
    const sequence = ++imageSequence.current;
    setImageBusy(true); setImageError('');
    try {
      const result = await imageData(file);
      if (sequence === imageSequence.current) setPhoto(result);
    } catch (error) {
      if (sequence === imageSequence.current) setImageError(errorMessage(error));
    } finally {
      if (sequence === imageSequence.current) setImageBusy(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleting || operationRef.current) return;
    operationRef.current = true; setPending('delete'); setDeleteError('');
    try {
      if (deleting.kind === 'record') {
        await saveEntries(entries.filter(item => item.id !== deleting.id));
        if (editing === deleting.id) resetRecord();
      } else {
        await saveWeights(weights.filter(item => item.id !== deleting.id));
        if (editingWeight === deleting.id) resetWeight();
      }
      setDeleting(null);
      notify(deleting.kind === 'record' ? 'სამედიცინო ჩანაწერი წაიშალა.' : 'წონის ჩანაწერი წაიშალა.');
    } catch (error) { setDeleteError(errorMessage(error)); }
    finally { operationRef.current = false; setPending(null); }
  };
  const deletedRecord = deleting?.kind === 'record' ? entries.find(item => item.id === deleting.id) : undefined;
  const deletedWeight = deleting?.kind === 'weight' ? weights.find(item => item.id === deleting.id) : undefined;

  return <div className="care-page space-y-6 pb-8">
    <header className="page-top">
      <div><p className="eyebrow">ზრუნვის ისტორია</p><h1 className="page-title">ჯანმრთელობა</h1>
        <p className="page-description">ვიზიტები, სამედიცინო დოკუმენტები და წონის ცვლილება — ყველაფერი ერთ სივრცეში.</p></div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-secondary" type="button" disabled={busy || imageBusy} onClick={openWeight}><WeightIcon size={18} aria-hidden="true"/> წონის დამატება</button>
        <button className="btn btn-primary" type="button" disabled={busy || imageBusy} onClick={openRecord}><Plus size={18} aria-hidden="true"/> ჩანაწერის დამატება</button>
      </div>
    </header>

    <dl className="health-summary grid gap-3 sm:grid-cols-3">
      <div className="health-stat surface p-5"><dt className="muted text-sm">სამედიცინო ჩანაწერები</dt><dd className="mt-2"><span className="text-2xl font-semibold">{entries.length}</span><p className="muted mt-1 text-sm">შენახული ისტორია</p></dd></div>
      <div className="health-stat surface p-5"><dt className="muted text-sm">ბოლო გაზომვა</dt><dd className="mt-2"><span className="text-2xl font-semibold">{latestWeight ? <>{latestWeight.weightKg} <span className="text-base font-normal">კგ</span></> : '—'}</span><p className="muted mt-1 text-sm">{latestWeight ? fullDate(latestWeight.date) : 'გაზომვა ჯერ არ დამატებულა'}</p></dd></div>
      <div className="health-stat surface p-5"><dt className="muted text-sm">ბოლო ჩანაწერი</dt><dd className="mt-2"><span className="break-words text-base font-semibold">{latestRecord ? fullDate(latestRecord.date) : '—'}</span><p className="muted mt-1 truncate text-sm">{latestRecord ? latestRecord.title || 'სამედიცინო დოკუმენტი' : 'დაიწყეთ პირველი ჩანაწერით'}</p></dd></div>
    </dl>

    <div className="filter-tabs flex flex-wrap gap-2" role="tablist" aria-label="ჯანმრთელობის ისტორია" onKeyDown={handleTabKeys}>
      {([{ value: 'records', label: 'სამედიცინო ჩანაწერები', count: entries.length }, { value: 'weights', label: 'წონის ისტორია', count: weights.length }] as const).map(tab => <button
        key={tab.value} id={`${id}-${tab.value}-tab`} type="button" role="tab" aria-selected={activeTab === tab.value}
        aria-controls={`${id}-${tab.value}-panel`} tabIndex={activeTab === tab.value ? 0 : -1} disabled={busy || imageBusy}
        className={`btn ${activeTab === tab.value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(tab.value)}>
        {tab.label}<span className="tab-count"> {tab.count}</span>
      </button>)}
    </div>

    <section id={`${id}-records-panel`} role="tabpanel" aria-labelledby={`${id}-records-tab`} hidden={activeTab !== 'records'} className="space-y-5">
      {showRecord && <section className="surface p-5 sm:p-6" aria-labelledby={`${id}-record-form-title`}>
        <div className="panel-heading mb-5 flex items-start justify-between gap-3">
          <div><p className="eyebrow">სამედიცინო ისტორია</p><h2 id={`${id}-record-form-title`} className="section-title mt-2">{editing ? 'ჩანაწერის რედაქტირება' : 'ახალი სამედიცინო ჩანაწერი'}</h2><p className="muted mt-2 text-sm">სათაური და თარიღი აუცილებელია. სურათის დამატება არასავალდებულოა.</p></div>
          <button type="button" className={iconClass} disabled={busy || imageBusy} onClick={resetRecord} aria-label="ჩანაწერის ფორმის დახურვა"><X size={20} aria-hidden="true"/></button>
        </div>
        <form noValidate onSubmit={event => void submitRecord(event)} aria-busy={pending === 'record' || imageBusy}>
          {recordError && <p ref={recordErrorRef} className="form-error mb-4 text-sm" role="alert" tabIndex={-1}>{recordError}</p>}
          <fieldset disabled={busy || imageBusy} className="min-w-0">
            <div className="field-grid">
              <label className={`${labelClass} full`}>სათაური <span className="sr-only">(აუცილებელი)</span><input ref={recordTitleRef} className="ui-input" required maxLength={80} value={title} onChange={event => { setTitle(event.target.value); setRecordErrors(errors => ({ ...errors, title: undefined })); }}
                aria-invalid={Boolean(recordErrors.title)} aria-describedby={recordErrors.title ? `${id}-record-title-error` : undefined} placeholder="მაგ., წლიური ვეტერინარული შემოწმება"/>
                <InlineError id={`${id}-record-title-error`} message={recordErrors.title}/></label>
              <label className={labelClass}>კატეგორია<select className="ui-select" value={type} onChange={event => setType(event.target.value as HealthCategory)}>
                {Object.entries(healthLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                {!Object.hasOwn(healthLabels, type) && <option value={type}>{type}</option>}
              </select></label>
              <label className={labelClass}>თარიღი <span className="sr-only">(აუცილებელი)</span><input ref={recordDateRef} className="ui-input" type="date" required value={date} onChange={event => { setDate(event.target.value); setRecordErrors(errors => ({ ...errors, date: undefined })); }}
                aria-invalid={Boolean(recordErrors.date)} aria-describedby={recordErrors.date ? `${id}-record-date-error` : undefined}/><InlineError id={`${id}-record-date-error`} message={recordErrors.date}/></label>
              <label className={`${labelClass} full`}>შენიშვნა (არასავალდებულო)<textarea className="ui-textarea" rows={3} maxLength={5000} value={note} onChange={event => setNote(event.target.value)} placeholder="ვეტერინარის რეკომენდაცია, გამოკვლევის შედეგი ან სხვა მნიშვნელოვანი დეტალი"/></label>
              <label className={`${labelClass} full`}><span className="inline-flex items-center gap-2"><ImagePlus size={18} aria-hidden="true"/> სურათი (არასავალდებულო)</span>
                <input className="ui-input" type="file" accept="image/*" aria-invalid={Boolean(imageError)} aria-describedby={`${id}-photo-hint${imageError ? ` ${id}-photo-error` : ''}`} onChange={event => {
                  const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void uploadPhoto(file);
                }}/><span id={`${id}-photo-hint`} className="muted text-sm font-normal">შეგიძლიათ დაურთოთ ანალიზის, დანიშნულების ან სხვა დოკუმენტის ფოტო.</span><InlineError id={`${id}-photo-error`} message={imageError}/>
              </label>
            </div>
            {photo && <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="rounded-xl" onClick={() => setPreview(photo)} aria-label="მიმაგრებული სურათის გადიდება"><img src={photo} alt="მიმაგრებული სამედიცინო დოკუმენტი" className="h-24 w-24 rounded-xl object-cover"/></button>
              <button className="btn btn-secondary" type="button" onClick={() => { setPhoto(''); setImageError(''); }}><X size={16} aria-hidden="true"/> სურათის მოხსნა</button>
            </div>}
          </fieldset>
          {imageBusy && <p className="muted mt-4 text-sm" role="status">სურათი მუშავდება…</p>}
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy || imageBusy} type="submit">{pending === 'record' ? 'ინახება…' : 'ჩანაწერის შენახვა'}</button>
            <button className="btn btn-secondary" type="button" disabled={busy || imageBusy} onClick={resetRecord}>გაუქმება</button>
          </div>
        </form>
      </section>}

      <section className="surface p-5 sm:p-6" aria-labelledby={`${id}-records-title`}>
        <div className="panel-heading mb-5 flex flex-wrap items-end justify-between gap-3"><h2 id={`${id}-records-title`} ref={activeTab === 'records' ? listHeadingRef : undefined} tabIndex={-1} className="section-title">სამედიცინო ჩანაწერები</h2><span className="muted text-sm" role="status">{hasFilters ? `ნაპოვნია: ${records.length} / ${entries.length}` : `${entries.length} ჩანაწერი`}</span></div>
        {entries.length > 0 && <div className="filter-bar mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className={labelClass}><span className="sr-only">სამედიცინო ჩანაწერების ძიება</span><span className="relative block"><Search size={18} className="muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true"/><input className="ui-input !pl-10" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="ძიება სათაურით ან შენიშვნით"/></span></label>
          <label className={labelClass}><span className="sr-only">სამედიცინო ჩანაწერის კატეგორია</span><select className="ui-select" value={category} onChange={event => setCategory(event.target.value)}><option value="all">ყველა კატეგორია</option>{Object.entries(healthLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>}
        {records.length > 0 ? <div className="record-list">{records.map(item => {
          const Icon = healthIcons[item.type] || ClipboardList;
          return <article key={item.id} className="record-row flex flex-wrap !items-start gap-3 sm:flex-nowrap sm:gap-4">
            <span className="record-type-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f7f8fc] text-[#5661d5]"><Icon size={20} aria-hidden="true"/></span>
            <div className="record-content min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><span className="badge">{healthLabels[item.type] || item.type}</span><time className="record-date muted text-sm" dateTime={item.date}>{fullDate(item.date)}</time></div>
              <h3 className="mt-2 break-words font-semibold [overflow-wrap:anywhere]">{item.title || 'სამედიცინო დოკუმენტი'}</h3>
              {item.note && <p className="muted mt-2 whitespace-pre-wrap break-words leading-7 [overflow-wrap:anywhere]">{item.note}</p>}
              {item.photo && <button type="button" onClick={() => setPreview(item.photo || '')} className="btn btn-secondary mt-3"><FileText size={17} aria-hidden="true"/> დოკუმენტის ნახვა</button>}
            </div>
            <div className="record-actions flex w-full justify-end gap-1 sm:w-auto">
              <button className={iconClass} type="button" disabled={busy || imageBusy} onClick={() => editRecord(item)} aria-label={`${item.title || 'ჩანაწერი'} — რედაქტირება`} title="რედაქტირება"><Pencil size={18} aria-hidden="true"/></button>
              <button className={iconClass} type="button" disabled={busy || imageBusy} onClick={() => { setDeleteError(''); setDeleting({ kind: 'record', id: item.id }); }} aria-label={`${item.title || 'ჩანაწერი'} — წაშლა`} title="წაშლა"><Trash2 size={18} aria-hidden="true"/></button>
            </div>
          </article>;
        })}</div> : <div className="empty-state">
          <span className="empty-state-icon mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f7f8fc] text-[#5661d5]"><ClipboardList size={26} aria-hidden="true"/></span>
          <h3 className="font-semibold">{entries.length ? 'შესაბამისი ჩანაწერი ვერ მოიძებნა' : 'ზრუნვის ისტორია აქ იწყება'}</h3>
          <p className="muted mx-auto mt-2 max-w-md leading-7">{entries.length ? 'შეცვალეთ საძიებო სიტყვა ან კატეგორია, რომ საჭირო ჩანაწერი იპოვოთ.' : 'შეინახეთ პირველი ვიზიტი, ვაქცინაცია ან გამოკვლევის შედეგი, რომ მნიშვნელოვანი ინფორმაცია ყოველთვის ხელთ გქონდეთ.'}</p>
          <button className="btn btn-secondary mt-5" type="button" disabled={busy || imageBusy} onClick={entries.length ? () => { setQuery(''); setCategory('all'); } : openRecord}>{entries.length ? 'ფილტრების გასუფთავება' : <><Plus size={18} aria-hidden="true"/> პირველი ჩანაწერის დამატება</>}</button>
        </div>}
      </section>
    </section>

    <section id={`${id}-weights-panel`} role="tabpanel" aria-labelledby={`${id}-weights-tab`} hidden={activeTab !== 'weights'} className="space-y-5">
      {showWeight && <section className="surface p-5 sm:p-6" aria-labelledby={`${id}-weight-form-title`}>
        <div className="panel-heading mb-5 flex items-start justify-between gap-3"><div><p className="eyebrow">წონის აღრიცხვა</p><h2 id={`${id}-weight-form-title`} className="section-title mt-2">{editingWeight ? 'გაზომვის რედაქტირება' : 'ახალი გაზომვა'}</h2><p className="muted mt-2 text-sm">მიუთითეთ რეალური გაზომვის თარიღი და წონა კილოგრამებში.</p></div><button type="button" className={iconClass} disabled={busy} onClick={resetWeight} aria-label="წონის ფორმის დახურვა"><X size={20} aria-hidden="true"/></button></div>
        <form noValidate onSubmit={event => void submitWeight(event)} aria-busy={pending === 'weight'}>
          {weightError && <p ref={weightErrorRef} className="form-error mb-4 text-sm" role="alert" tabIndex={-1}>{weightError}</p>}
          <fieldset disabled={busy} className="field-grid min-w-0">
            <label className={labelClass}>წონა (კგ)<input ref={weightInputRef} className="ui-input" required type="number" inputMode="decimal" min="0" max="120" step="any" value={weightValue} onChange={event => { setWeightValue(event.target.value); setWeightErrors(errors => ({ ...errors, weight: undefined })); }} placeholder="მაგ., 12.4"
              aria-invalid={Boolean(weightErrors.weight)} aria-describedby={weightErrors.weight ? `${id}-weight-error` : undefined}/><InlineError id={`${id}-weight-error`} message={weightErrors.weight}/></label>
            <label className={labelClass}>გაზომვის თარიღი<input ref={weightDateRef} className="ui-input" required type="date" value={weightDate} onChange={event => { setWeightDate(event.target.value); setWeightErrors(errors => ({ ...errors, date: undefined })); }}
              aria-invalid={Boolean(weightErrors.date)} aria-describedby={weightErrors.date ? `${id}-weight-date-error` : undefined}/><InlineError id={`${id}-weight-date-error`} message={weightErrors.date}/></label>
          </fieldset>
          <div className="form-actions"><button className="btn btn-primary" disabled={busy} type="submit">{pending === 'weight' ? 'ინახება…' : 'გაზომვის შენახვა'}</button><button className="btn btn-secondary" type="button" disabled={busy} onClick={resetWeight}>გაუქმება</button></div>
        </form>
      </section>}
      <section className="surface p-5 sm:p-6" aria-labelledby={`${id}-weights-title`}>
        <div className="panel-heading mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 id={`${id}-weights-title`} ref={activeTab === 'weights' ? listHeadingRef : undefined} tabIndex={-1} className="section-title">წონის ისტორია</h2><p className="muted mt-2 text-sm">{weights.length ? 'ყველა გაზომვა თარიღის მიხედვით, უახლესიდან.' : 'გაზომვები დაგეხმარებათ წონის ცვლილების დაკვირვებაში.'}</p></div><span className="muted text-sm">{weights.length} გაზომვა</span></div>
        {chartWeights.length >= 2 && <WeightChart weights={chartWeights}/>}
        {sortedWeights.length > 0 ? <>
          {chartWeights.length < 2 && <p className="muted mb-4 rounded-xl bg-[#f7f8fc] p-4 text-sm leading-7">წონის გრაფიკი გამოჩნდება მინიმუმ ორი დათარიღებული გაზომვის დამატების შემდეგ.</p>}
          <div className="record-list">{sortedWeights.map(item => <article key={item.id} className="record-row flex flex-wrap gap-3 sm:flex-nowrap sm:gap-4">
            <span className="record-type-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f7f8fc] text-[#5661d5]"><WeightIcon size={20} aria-hidden="true"/></span>
            <div className="record-content min-w-0 flex-1"><h3 className="font-semibold">{item.weightKg} კგ</h3><time className="record-date muted mt-1 block text-sm" dateTime={item.date}>{fullDate(item.date)}</time></div>
            <div className="record-actions flex w-full justify-end gap-1 sm:w-auto"><button className={iconClass} type="button" disabled={busy} aria-label={`${fullDate(item.date)}, ${item.weightKg} კგ — რედაქტირება`} title="რედაქტირება" onClick={() => editWeight(item)}><Pencil size={18} aria-hidden="true"/></button><button className={iconClass} type="button" disabled={busy} aria-label={`${fullDate(item.date)}, ${item.weightKg} კგ — წაშლა`} title="წაშლა" onClick={() => { setDeleteError(''); setDeleting({ kind: 'weight', id: item.id }); }}><Trash2 size={18} aria-hidden="true"/></button></div>
          </article>)}</div>
        </> : <div className="empty-state"><span className="empty-state-icon mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f7f8fc] text-[#5661d5]"><WeightIcon size={26} aria-hidden="true"/></span><h3 className="font-semibold">დაამატეთ პირველი გაზომვა</h3><p className="muted mx-auto mt-2 max-w-md leading-7">შეინახეთ წონა და გაზომვის თარიღი. ორი გაზომვის შემდეგ აქ ცვლილების გრაფიკიც გამოჩნდება.</p><button className="btn btn-secondary mt-5" type="button" disabled={busy} onClick={openWeight}><Plus size={18} aria-hidden="true"/> წონის დამატება</button></div>}
      </section>
    </section>

    {preview && <Dialog title="სამედიცინო დოკუმენტი" onClose={() => setPreview('')} restoreFocusRef={listHeadingRef}><img src={preview} alt="სამედიცინო ჩანაწერზე მიმაგრებული დოკუმენტი" className="max-h-[70vh] w-full object-contain"/></Dialog>}
    {deleting && <Dialog title={deleting.kind === 'record' ? 'წაიშალოს სამედიცინო ჩანაწერი?' : 'წაიშალოს წონის ჩანაწერი?'} destructive busy={pending === 'delete'} restoreFocusRef={listHeadingRef}
      description={`${deletedRecord ? `„${deletedRecord.title || 'სამედიცინო დოკუმენტი'}“` : deletedWeight ? `${fullDate(deletedWeight.date)} — ${deletedWeight.weightKg} კგ` : 'არჩეული ჩანაწერი'} წაიშლება. ამ მოქმედების გაუქმება შეუძლებელია.`}
      onClose={() => { setDeleting(null); setDeleteError(''); }}>
      {deleteError && <p className="form-error mt-4 text-sm" role="alert">{deleteError}</p>}
      <div className="form-actions"><button className="btn btn-secondary" type="button" data-dialog-initial-focus disabled={busy} onClick={() => setDeleting(null)}>გაუქმება</button><button className="btn btn-danger" type="button" disabled={busy} onClick={() => void confirmDelete()}>{pending === 'delete' ? 'იშლება…' : 'ჩანაწერის წაშლა'}</button></div>
    </Dialog>}
  </div>;
}

export function PlanPage({ reminders, save, notify, intent, onIntentHandled }: {
  reminders: Reminder[]; save: (items: Reminder[]) => Promise<void>; notify: Notify;
  intent?: PageIntent; onIntentHandled?: () => void;
}) {
  const id = useId();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Reminder['category']>('appointment');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState<Reminder['recurrence']>('none');
  const [pending, setPending] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlanFilter>('open');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [focusRequest, requestFocus] = useState(0);
  const operationRef = useRef(false);
  const handledIntent = useRef<PageIntent | undefined>(undefined);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const busy = pending !== null;
  const currentDate = today();
  const counts = useMemo(() => ({
    open: reminders.filter(item => item.status === 'open').length,
    done: reminders.filter(item => item.status === 'done').length,
    all: reminders.length,
    today: reminders.filter(item => item.status === 'open' && item.date === currentDate).length,
    overdue: reminders.filter(item => item.status === 'open' && item.date < currentDate).length
  }), [reminders, currentDate]);
  const sorted = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return [...reminders].filter(item => (filter === 'all' || item.status === filter)
      && (categoryFilter === 'all' || item.category === categoryFilter)
      && (!search || [item.title, item.notes, reminderLabels[item.category]].some(value => (value || '').toLocaleLowerCase().includes(search))))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        return (a.status === 'done' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) || b.createdAt - a.createdAt;
      });
  }, [reminders, filter, query, categoryFilter]);
  const hasFilters = Boolean(query.trim() || categoryFilter !== 'all');

  const openForm = useCallback(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(null); setTitle(''); setCategory('appointment'); setDate(today()); setNotes(''); setRecurrence('none');
    setErrors({}); setFormError(''); setShowForm(true);
    requestFocus(value => value + 1);
  }, []);
  useEffect(() => {
    if (!intent) { handledIntent.current = undefined; return; }
    if (intent !== 'reminder' || handledIntent.current === intent) return;
    handledIntent.current = intent; openForm(); onIntentHandled?.();
  }, [intent, onIntentHandled, openForm]);
  useEffect(() => { if (focusRequest) titleRef.current?.focus(); }, [focusRequest]);
  useEffect(() => { if (formError) formErrorRef.current?.focus(); }, [formError]);

  const reset = () => {
    setEditing(null); setTitle(''); setCategory('appointment'); setDate(today()); setNotes(''); setRecurrence('none');
    setErrors({}); setFormError(''); setShowForm(false);
    requestAnimationFrame(() => {
      const target = triggerRef.current;
      (target?.isConnected ? target : listHeadingRef.current)?.focus({ preventScroll: true });
    });
  };
  const edit = (item: Reminder) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(item.id); setTitle(item.title); setCategory(item.category); setDate(item.date); setNotes(item.notes || '');
    setRecurrence(item.recurrence); setErrors({}); setFormError(''); setShowForm(true);
    requestFocus(value => value + 1);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (operationRef.current) return;
    const nextErrors: FieldErrors = {};
    if (!title.trim()) nextErrors.title = 'მიუთითეთ შეხსენების სათაური.';
    if (!calendarDate(date)) nextErrors.date = 'მიუთითეთ შეხსენების სწორი თარიღი.';
    setErrors(nextErrors); setFormError('');
    if (Object.keys(nextErrors).length) { (nextErrors.title ? titleRef : dateRef).current?.focus(); return; }
    const previous = reminders.find(item => item.id === editing);
    const item: Reminder = {
      ...previous, id: editing || uid(), title: title.trim(), category, date, notes: notes.trim(), recurrence,
      status: previous?.status ?? 'open', createdAt: previous?.createdAt ?? Date.now(), anchorDay: recurrenceAnchor(previous, date, recurrence)
    };
    operationRef.current = true; setPending('save');
    try {
      await save(editing ? reminders.map(entry => entry.id === editing ? item : entry) : [...reminders, item]);
      setFilter(current => current === 'all' ? 'all' : item.status); setQuery(''); setCategoryFilter('all');
      reset(); notify(editing ? 'შეხსენება განახლდა.' : 'შეხსენება დაემატა.');
    } catch (error) { setFormError(errorMessage(error)); }
    finally { operationRef.current = false; setPending(null); }
  };
  const complete = async (item: Reminder) => {
    if (operationRef.current || item.status === 'done') return;
    const updated: Reminder[] = reminders.map(entry => entry.id === item.id ? { ...entry, status: 'done' } : entry);
    if (item.recurrence !== 'none') updated.push({
      ...item, id: uid(), date: nextDate(item.date, item.recurrence, item.anchorDay),
      anchorDay: item.anchorDay || Number(item.date.slice(8, 10)), status: 'open', createdAt: Date.now()
    });
    operationRef.current = true; setPending(`complete-${item.id}`); setActionError('');
    try {
      await save(updated);
      if (editing === item.id) reset();
      notify(item.recurrence === 'none' ? 'შეხსენება შესრულებულად მოინიშნა.' : 'შესრულებულია. მომდევნო შეხსენება დაემატა.');
      requestAnimationFrame(() => listHeadingRef.current?.focus({ preventScroll: true }));
    } catch (error) { setActionError(errorMessage(error)); }
    finally { operationRef.current = false; setPending(null); }
  };
  const confirmDelete = async () => {
    if (!deleting || operationRef.current) return;
    operationRef.current = true; setPending('delete'); setDeleteError('');
    try {
      await save(reminders.filter(item => item.id !== deleting));
      if (editing === deleting) reset();
      setDeleting(null); notify('შეხსენება წაიშალა.');
    } catch (error) { setDeleteError(errorMessage(error)); }
    finally { operationRef.current = false; setPending(null); }
  };
  const deletedReminder = reminders.find(item => item.id === deleting);

  return <div className="care-page space-y-6 pb-8">
    <header className="page-top"><div><p className="eyebrow">წინასწარ დაგეგმილი ზრუნვა</p><h1 className="page-title">ზრუნვის გეგმა</h1><p className="page-description">დაგეგმეთ ვიზიტები, ვაქცინაციები და ყოველდღიური მოვლა მნიშვნელოვანი თარიღების გასახსენებლად.</p></div><button className="btn btn-primary" type="button" disabled={busy} onClick={openForm}><Plus size={18} aria-hidden="true"/> შეხსენების დამატება</button></header>

    <dl className="health-summary grid gap-3 sm:grid-cols-3">
      <div className="health-stat surface p-5"><dt className="muted text-sm">დაგეგმილი</dt><dd className="mt-2"><span className="text-2xl font-semibold">{counts.open}</span><p className="muted mt-1 text-sm">შესასრულებელი შეხსენება</p></dd></div>
      <div className="health-stat surface p-5"><dt className="muted text-sm">დღეს</dt><dd className="mt-2"><span className="text-2xl font-semibold">{counts.today}</span><p className="muted mt-1 text-sm">{fullDate(currentDate)}</p></dd></div>
      <div className="health-stat surface p-5" data-tone={counts.overdue ? 'warm' : undefined}><dt className="muted text-sm">ვადაგადაცილებული</dt><dd className="mt-2"><span className="text-2xl font-semibold">{counts.overdue}</span><p className="muted mt-1 text-sm">{counts.overdue ? 'გადახედეთ გასულ თარიღებს' : 'გადაცილებული თარიღები არ არის'}</p></dd></div>
    </dl>

    {showForm && <section className="surface p-5 sm:p-6" aria-labelledby={`${id}-reminder-form-title`}>
      <div className="panel-heading mb-5 flex items-start justify-between gap-3"><div><p className="eyebrow">ზრუნვის დაგეგმვა</p><h2 id={`${id}-reminder-form-title`} className="section-title mt-2">{editing ? 'შეხსენების რედაქტირება' : 'ახალი შეხსენება'}</h2><p className="muted mt-2 text-sm">სათაური და თარიღი აუცილებელია. საჭიროების შემთხვევაში ჩართეთ გამეორება.</p></div><button type="button" className={iconClass} disabled={busy} onClick={reset} aria-label="შეხსენების ფორმის დახურვა"><X size={20} aria-hidden="true"/></button></div>
      <form noValidate onSubmit={event => void submit(event)} aria-busy={pending === 'save'}>
        {formError && <p ref={formErrorRef} className="form-error mb-4 text-sm" role="alert" tabIndex={-1}>{formError}</p>}
        <fieldset disabled={busy} className="field-grid min-w-0">
          <label className={`${labelClass} full`}>სათაური <span className="sr-only">(აუცილებელი)</span><input ref={titleRef} className="ui-input" required maxLength={100} value={title} onChange={event => { setTitle(event.target.value); setErrors(current => ({ ...current, title: undefined })); }} placeholder="მაგ., ვაქცინაცია ვეტერინართან"
            aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? `${id}-title-error` : undefined}/><InlineError id={`${id}-title-error`} message={errors.title}/></label>
          <label className={labelClass}>კატეგორია<select className="ui-select" value={category} onChange={event => setCategory(event.target.value as Reminder['category'])}>{Object.entries(reminderLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={labelClass}>თარიღი <span className="sr-only">(აუცილებელი)</span><input ref={dateRef} className="ui-input" required type="date" value={date} onChange={event => { setDate(event.target.value); setErrors(current => ({ ...current, date: undefined })); }}
            aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? `${id}-date-error` : undefined}/><InlineError id={`${id}-date-error`} message={errors.date}/></label>
          <label className={`${labelClass} full`}>გამეორება<select className="ui-select" value={recurrence} onChange={event => setRecurrence(event.target.value as Reminder['recurrence'])} aria-describedby={`${id}-recurrence-hint`}>{Object.entries(recurrenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <span id={`${id}-recurrence-hint`} className="muted text-sm font-normal leading-7">{recurrence === 'none' ? 'ერთჯერადი შეხსენება. შესრულებულად მონიშვნის შემდეგ ისტორიაში დარჩება.' : `შესრულებულად მონიშვნისას მომდევნო თარიღი ავტომატურად გამოითვლება დაგეგმილი თარიღიდან.${recurrence === 'monthly' || recurrence === 'yearly' ? ' თუ თვეში შესაბამისი რიცხვი არ არის, შეირჩევა თვის ბოლო დღე.' : ''}`}</span>
          </label>
          <label className={`${labelClass} full`}>შენიშვნა (არასავალდებულო)<textarea className="ui-textarea" rows={3} maxLength={5000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="კლინიკა, მომზადების წესი ან სხვა საჭირო ინფორმაცია"/></label>
        </fieldset>
        <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={busy}>{pending === 'save' ? 'ინახება…' : 'შეხსენების შენახვა'}</button><button className="btn btn-secondary" type="button" disabled={busy} onClick={reset}>გაუქმება</button></div>
      </form>
    </section>}

    <section className="surface p-5 sm:p-6" aria-labelledby={`${id}-plan-list-title`}>
      <div className="panel-heading mb-5 flex flex-wrap items-end justify-between gap-3"><h2 id={`${id}-plan-list-title`} ref={listHeadingRef} tabIndex={-1} className="section-title">შეხსენებები</h2><span className="muted text-sm" role="status">{sorted.length} შეხსენება</span></div>
      <div className="filter-tabs mb-5 flex flex-wrap gap-2" role="tablist" aria-label="შეხსენების სტატუსი" onKeyDown={handleTabKeys}>
        {([{ value: 'open', label: 'დაგეგმილი' }, { value: 'done', label: 'შესრულებული' }, { value: 'all', label: 'ყველა' }] as const).map(tab => <button
          key={tab.value} id={`${id}-${tab.value}-tab`} type="button" role="tab" aria-selected={filter === tab.value} aria-controls={`${id}-${tab.value}-panel`}
          tabIndex={filter === tab.value ? 0 : -1} className={`btn ${filter === tab.value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilter(tab.value); setActionError(''); }}>
          {tab.label}<span className="tab-count"> {counts[tab.value]}</span>
        </button>)}
      </div>
      {reminders.length > 0 && <div className="filter-bar mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className={labelClass}><span className="sr-only">შეხსენებების ძიება</span><span className="relative block"><Search size={18} className="muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true"/><input className="ui-input !pl-10" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="ძიება სათაურით ან შენიშვნით"/></span></label>
        <label className={labelClass}><span className="sr-only">შეხსენების კატეგორია</span><select className="ui-select" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">ყველა კატეგორია</option>{Object.entries(reminderLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>}
      {actionError && <p className="form-error mb-4 text-sm" role="alert">{actionError}</p>}
      {(['open', 'done', 'all'] as const).map(panelFilter => <div key={panelFilter} id={`${id}-${panelFilter}-panel`} role="tabpanel" aria-labelledby={`${id}-${panelFilter}-tab`} hidden={filter !== panelFilter}>
        {filter === panelFilter && (sorted.length > 0 ? <div className="record-list">{sorted.map(item => {
          const overdue = item.status === 'open' && item.date < currentDate;
          const isToday = item.status === 'open' && item.date === currentDate;
          return <article key={item.id} className="record-row flex flex-wrap !items-start gap-3 sm:flex-nowrap sm:gap-4">
            <span className="record-type-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f7f8fc] text-[#5661d5]">{item.status === 'done' ? <Check size={20} aria-hidden="true"/> : <CalendarDays size={20} aria-hidden="true"/>}</span>
            <div className="record-content min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="badge">{reminderLabels[item.category]}</span>{item.status === 'done' && <span className="badge" data-tone="success">შესრულებულია</span>}{overdue && <span className="badge" data-tone="warm">ვადაგადაცილებული</span>}{isToday && <span className="badge" data-tone="warm">დღეს</span>}</div>
              <h3 className="mt-2 break-words font-semibold [overflow-wrap:anywhere]">{item.title}</h3>
              <div className="muted mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"><time className="record-date" dateTime={item.date}>{fullDate(item.date)}</time>{item.recurrence !== 'none' && <span className="inline-flex items-center gap-1.5"><Repeat2 size={15} aria-hidden="true"/>{recurrenceLabels[item.recurrence]}</span>}</div>
              {item.notes && <p className="muted mt-2 whitespace-pre-wrap break-words leading-7 [overflow-wrap:anywhere]">{item.notes}</p>}
            </div>
            <div className="record-actions flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto">
              {item.status === 'open' && <button className="btn btn-secondary" type="button" disabled={busy} aria-label={`${item.title} — შესრულებულად მონიშვნა`} onClick={() => void complete(item)}><Check size={17} aria-hidden="true"/>{pending === `complete-${item.id}` ? 'ინიშნება…' : 'შესრულება'}</button>}
              <button className={iconClass} type="button" disabled={busy} aria-label={`${item.title} — რედაქტირება`} title="რედაქტირება" onClick={() => edit(item)}><Pencil size={18} aria-hidden="true"/></button>
              <button className={iconClass} type="button" disabled={busy} aria-label={`${item.title} — წაშლა`} title="წაშლა" onClick={() => { setDeleteError(''); setDeleting(item.id); }}><Trash2 size={18} aria-hidden="true"/></button>
            </div>
          </article>;
        })}</div> : <div className="empty-state">
          <span className="empty-state-icon mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f7f8fc] text-[#5661d5]"><CalendarDays size={26} aria-hidden="true"/></span>
          <h3 className="font-semibold">{hasFilters ? 'შესაბამისი შეხსენება ვერ მოიძებნა' : filter === 'done' ? 'შესრულებული შეხსენებები ჯერ არ არის' : counts.done && filter === 'open' ? 'ყველა დაგეგმილი საქმე შესრულებულია' : 'დაგეგმეთ შემდეგი ნაბიჯი'}</h3>
          <p className="muted mx-auto mt-2 max-w-md leading-7">{hasFilters ? 'სცადეთ სხვა საძიებო სიტყვა ან კატეგორია.' : filter === 'done' ? 'შეხსენების შესრულებულად მონიშვნის შემდეგ მას აქ იპოვით.' : 'დაამატეთ მომდევნო ვიზიტი, ვაქცინაცია ან მოვლის სხვა მნიშვნელოვანი თარიღი.'}</p>
          {hasFilters ? <button className="btn btn-secondary mt-5" type="button" onClick={() => { setQuery(''); setCategoryFilter('all'); }}>ფილტრების გასუფთავება</button> : filter === 'done' ? <button className="btn btn-secondary mt-5" type="button" onClick={() => setFilter('open')}>დაგეგმილი შეხსენებები</button> : <button className="btn btn-secondary mt-5" type="button" disabled={busy} onClick={openForm}><Plus size={18} aria-hidden="true"/> შეხსენების დამატება</button>}
        </div>)}
      </div>)}
    </section>
    {deleting && <Dialog title="წაიშალოს შეხსენება?" destructive busy={pending === 'delete'} restoreFocusRef={listHeadingRef}
      description={`„${deletedReminder?.title || 'არჩეული შეხსენება'}“ წაიშლება. ამ მოქმედების გაუქმება შეუძლებელია.${deletedReminder?.recurrence !== 'none' && deletedReminder ? ' სხვა თარიღებზე არსებული შეხსენებები შენარჩუნდება.' : ''}`}
      onClose={() => { setDeleting(null); setDeleteError(''); }}>
      {deleteError && <p className="form-error mt-4 text-sm" role="alert">{deleteError}</p>}
      <div className="form-actions"><button className="btn btn-secondary" type="button" data-dialog-initial-focus disabled={busy} onClick={() => setDeleting(null)}>გაუქმება</button><button className="btn btn-danger" type="button" disabled={busy} onClick={() => void confirmDelete()}>{pending === 'delete' ? 'იშლება…' : 'შეხსენების წაშლა'}</button></div>
    </Dialog>}
  </div>;
}
