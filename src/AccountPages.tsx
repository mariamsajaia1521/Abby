import { useState } from 'react';
import { ArrowRight, Check, DatabaseBackup, Download, FileCheck2, HeartPulse, LoaderCircle, LogOut, Phone, ShieldCheck, Trash2, Upload, UserRound } from './components/icons';
import { phoneHref, request, restoreBackup } from './api';
import { Dialog, PetAvatar } from './components/UI';
import { dateLabel, today, type Navigate, type State, type User } from './types';

export function EmergencyPage({ state, go }: { state: State; go: Navigate }) {
  const dog = state.dog!;
  const vet = state.vet;
  const phone = vet?.phone ? phoneHref(vet.phone) : null;
  const emergencyPhone = vet?.emergencyPhone ? phoneHref(vet.emergencyPhone) : null;
  const medications = state.healthRecords.filter(item => item.type === 'medication').sort((a, b) => b.date.localeCompare(a.date));
  return <div className="emergency-page"><header className="page-top"><div><p className="eyebrow">მნიშვნელოვანი დეტალები, მარტივად</p><h1 className="page-title">გადაუდებელი ინფორმაცია</h1><p className="page-description">შენი მეგობრის მთავარი ინფორმაცია — საჭირო დროს, ერთ ეკრანზე.</p></div><button className="btn btn-secondary" onClick={() => window.print()}><FileCheck2 size={17}/> ბარათის ბეჭდვა</button></header>
    <section className="emergency-strip"><span className="emergency-icon"><Phone size={25} aria-hidden="true"/></span><div><h2>ვეტერინართან დაკავშირება</h2><p>{vet?.clinic || vet?.name || 'დაამატე სანდო კონტაქტი, რომ ნომერი ყოველთვის ხელთ გქონდეს.'}</p></div><div className="emergency-actions">{emergencyPhone && <a className="btn btn-primary" href={emergencyPhone}><Phone size={17}/> გადაუდებელი ნომერი</a>}{phone && <a className="btn btn-secondary" href={phone}><Phone size={17}/> ვეტერინარი</a>}{!phone && !emergencyPhone && <button className="btn btn-primary" onClick={() => go('vet')}>{vet ? 'კონტაქტის განახლება' : 'კონტაქტის დამატება'}<ArrowRight size={16}/></button>}</div></section>
    <div className="account-grid"><section className="surface account-panel"><div className="panel-heading"><PetAvatar name={dog.name} photo={dog.photo}/><div><p className="eyebrow">ჯანმრთელობის ბარათი</p><h2 className="section-title">{dog.name}</h2></div></div><dl><div className="info-line"><dt>ალერგიები</dt><dd>{dog.allergies?.trim() || 'ინფორმაცია არ არის მითითებული'}</dd></div><div className="info-line"><dt>მნიშვნელოვანი მდგომარეობები</dt><dd>{dog.conditions?.trim() || 'ინფორმაცია არ არის მითითებული'}</dd></div><div className="info-line"><dt>მიკროჩიპი</dt><dd>{dog.microchip || 'არ არის მითითებული'}</dd></div><div className="info-line"><dt>საკონტაქტო პირი</dt><dd>{dog.emergencyContact || 'არ არის მითითებული'}</dd></div></dl><p className="field-hint">მიუთითებელი ინფორმაცია არ ნიშნავს ალერგიის ან მდგომარეობის არარსებობას.</p><button className="text-link panel-link" onClick={() => go('profile')}>პროფილის განახლება <ArrowRight size={15}/></button></section>
      <section className="surface account-panel"><div className="panel-heading"><span className="section-icon peach"><HeartPulse size={21}/></span><div><p className="eyebrow">შენახული ისტორია</p><h2 className="section-title">მედიკამენტები</h2></div></div><p className="page-description">ისტორიული ჩანაწერი არ ადასტურებს, რომ მედიკამენტი ამჟამად მიიღება.</p>{medications.length ? <div className="medication-list">{medications.slice(0, 5).map(item => <div className="info-line" key={item.id}><span>{item.title}</span><time dateTime={item.date}>{dateLabel(item.date)}</time></div>)}</div> : <div className="empty-state compact-empty"><HeartPulse size={27} aria-hidden="true"/><h3>მედიკამენტების ჩანაწერები არ არის</h3><p>შენახული ინფორმაცია სამედიცინო ისტორიაში გამოჩნდება.</p></div>}<button className="text-link panel-link" onClick={() => go('health')}>სამედიცინო ისტორია <ArrowRight size={15}/></button></section>
    </div><div className="privacy-note"><ShieldCheck size={17}/><p>გადაამოწმე და განაახლე ეს ინფორმაცია რეგულარულად.</p></div></div>;
}

export function SettingsPage({ user, state, restore, reset, logout, notify, demo }: { user: User; state: State; restore: (state: State) => Promise<void>; reset: () => Promise<void>; logout: () => Promise<void>; notify: (message: string) => void; demo: boolean }) {
  const [activeTab, setActiveTab] = useState<'account' | 'data'>('account');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<'restore' | 'reset' | null>(null);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  async function exportData() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const latest = demo ? state : (await request<{ state: State }>('/api/state')).state;
      const media: { url: string; data: string }[] = [];
      const urls = [...new Set(latest.memories.flatMap(memory => memory.videoUrl ? [memory.videoUrl] : []))];
      for (const videoUrl of urls) {
        const response = await fetch(videoUrl, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('ვიდეოს ჩამოტვირთვა ვერ მოხერხდა. ასლი არ შექმნილა.');
        const blob = await response.blob();
        const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('ვიდეო ვერ დამუშავდა.')); reader.readAsDataURL(blob); });
        media.push({ url: videoUrl, data });
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), state: latest, media })], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `petlog-${demo ? 'demo-' : ''}backup-${today()}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      notify('სარეზერვო ასლი ჩამოიტვირთა.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ექსპორტი ვერ შესრულდა.'); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (pending === 'reset') await reset();
      else if (backupFile) { await restoreBackup(backupFile, restore); notify('სარეზერვო ასლი აღდგენილია.'); }
      setPending(null); setBackupFile(null); setConfirmation('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'მოქმედება ვერ შესრულდა.'); }
    finally { setBusy(false); }
  }

  function close() { setPending(null); setBackupFile(null); setError(''); setConfirmation(''); }

  return <div className="settings-page">
    <header className="page-top">
      <div>
        <h1 className="page-title">პარამეტრები</h1>
        <p className="page-description">მართე შენი ანგარიში და შეინახე მონაცემების ასლი.</p>
      </div>
    </header>

    <div
      className="settings-tabs"
      role="tablist"
      aria-label="პარამეტრების სექციები"
      onKeyDown={event => {
        let nextTab: typeof activeTab;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') nextTab = activeTab === 'account' ? 'data' : 'account';
        else if (event.key === 'Home') nextTab = 'account';
        else if (event.key === 'End') nextTab = 'data';
        else return;
        event.preventDefault();
        setActiveTab(nextTab);
        event.currentTarget.querySelector<HTMLButtonElement>(`#settings-tab-${nextTab}`)?.focus();
      }}
    >
      <button
        type="button"
        className={`settings-tab${activeTab === 'account' ? ' is-active' : ''}`}
        id="settings-tab-account"
        role="tab"
        aria-selected={activeTab === 'account'}
        aria-controls="settings-panel-account"
        tabIndex={activeTab === 'account' ? 0 : -1}
        onClick={() => setActiveTab('account')}
      >
        <UserRound size={16} aria-hidden="true"/> ანგარიში
      </button>
      <button
        type="button"
        className={`settings-tab${activeTab === 'data' ? ' is-active' : ''}`}
        id="settings-tab-data"
        role="tab"
        aria-selected={activeTab === 'data'}
        aria-controls="settings-panel-data"
        tabIndex={activeTab === 'data' ? 0 : -1}
        onClick={() => setActiveTab('data')}
      >
        <DatabaseBackup size={16} aria-hidden="true"/> მონაცემები
      </button>
    </div>

    <div
      className="settings-tab-panel"
      id="settings-panel-account"
      role="tabpanel"
      aria-labelledby="settings-tab-account"
      tabIndex={0}
      hidden={activeTab !== 'account'}
    >
      <section className="settings-section" aria-labelledby="settings-email-heading">
        <div className="settings-section-heading">
          <h2 className="ui-label" id="settings-email-heading"><label htmlFor="settings-email">ელფოსტა</label></h2>
          <p className="field-hint" id="settings-email-description">ამ მისამართით შედიხარ ანგარიშში.</p>
        </div>
        <div className="settings-section-body">
          <input
            className="ui-input settings-account-email"
            id="settings-email"
            type="email"
            value={user.email}
            readOnly
            aria-describedby="settings-email-description settings-email-readonly"
          />
          <p className="field-hint" id="settings-email-readonly">ამ გვერდზე ელფოსტას ვერ შეცვლი.</p>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-profile-heading">
        <div className="settings-section-heading">
          <h2 className="ui-label" id="settings-profile-heading">მეგობრის პროფილი</h2>
          <p className="field-hint">შენს ანგარიშში შენახული პროფილი.</p>
        </div>
        <div className="settings-section-body">
          <dl className="settings-summary">
            <div><dt>სახელი</dt><dd>{state.dog?.name || 'ჯერ არ შექმნილა'}</dd></div>
            <div><dt>ანგარიში</dt><dd>{demo ? 'სადემონსტრაციო' : 'პირადი'}</dd></div>
          </dl>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-logout-heading">
        <div className="settings-section-heading">
          <h2 className="ui-label" id="settings-logout-heading">ანგარიშიდან გასვლა</h2>
          <p className="field-hint">შემდეგ ხელახლა შეძლებ შესვლას.</p>
        </div>
        <div className="settings-section-body">
          <button className="btn btn-secondary" disabled={busy} onClick={() => { setBusy(true); void logout().catch(cause => setError(cause instanceof Error ? cause.message : 'გასვლა ვერ მოხერხდა.')).finally(() => setBusy(false)); }}>
            <LogOut size={16} aria-hidden="true"/> {demo ? 'დემოდან გასვლა' : 'ანგარიშიდან გასვლა'}
          </button>
        </div>
      </section>
    </div>

    <div
      className="settings-tab-panel"
      id="settings-panel-data"
      role="tabpanel"
      aria-labelledby="settings-tab-data"
      tabIndex={0}
      hidden={activeTab !== 'data'}
    >
      <section className="settings-section" aria-labelledby="settings-backup-heading">
        <div className="settings-section-heading">
          <h2 className="ui-label" id="settings-backup-heading">სარეზერვო ასლი</h2>
          <p className="field-hint">შეინახე ჩანაწერების, ფოტოებისა და ვიდეოების ასლი.</p>
        </div>
        <div className="settings-section-body">
          <dl className="settings-summary" aria-label="შენახული ჩანაწერები">
            <div><dt><Check size={15} aria-hidden="true"/> სამედიცინო ჩანაწერები</dt><dd>{state.healthRecords.length}</dd></div>
            <div><dt><Check size={15} aria-hidden="true"/> დაგეგმილი მოვლენები</dt><dd>{state.reminders.length}</dd></div>
          </dl>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy} onClick={() => void exportData()}>
              {busy && !pending ? <LoaderCircle className="spin" size={16} aria-hidden="true"/> : <Download size={16} aria-hidden="true"/>} ასლის ჩამოტვირთვა
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-restore-heading">
        <div className="settings-section-heading">
          <h2 className="ui-label" id="settings-restore-heading">ასლის აღდგენა</h2>
          <p className="field-hint">დააბრუნე მონაცემები ადრე შენახული ასლიდან.</p>
        </div>
        <div className="settings-section-body">
          <label className={`btn btn-secondary${busy || demo ? ' is-disabled' : ''}`}>
            <Upload size={16} aria-hidden="true"/> ასლის არჩევა
            <input
              type="file"
              className="sr-only"
              aria-label="აღსადგენი სარეზერვო ასლი"
              accept="application/json,.json"
              disabled={busy || demo}
              onChange={event => { const file = event.target.files?.[0]; if (file) { setError(''); setBackupFile(file); setPending('restore'); } event.target.value = ''; }}
            />
          </label>
          {demo && <p className="field-hint">აღდგენა ხელმისაწვდომია პირად ანგარიშში.</p>}
        </div>
      </section>

      <section className="settings-section settings-danger" aria-labelledby="settings-delete-heading">
        <div className="settings-section-heading">
          <h2 className="ui-label" id="settings-delete-heading">მონაცემების წაშლა</h2>
          <p className="field-hint">პროფილი და ყველა ჩანაწერი სამუდამოდ წაიშლება.</p>
        </div>
        <div className="settings-section-body">
          <p className="field-hint">ანგარიში შენარჩუნდება. წაშლამდე შეინახე სარეზერვო ასლი.</p>
          <div className="form-actions">
            <button className="btn btn-danger" disabled={busy} onClick={() => { setError(''); setConfirmation(''); setPending('reset'); }}>
              <Trash2 size={16} aria-hidden="true"/> ყველა მონაცემის წაშლა
            </button>
          </div>
        </div>
      </section>
    </div>

    {error && !pending && <p className="form-error" role="alert">{error}</p>}
    <div className="privacy-note">
      <ShieldCheck size={17} aria-hidden="true"/>
      <p>{demo ? 'დემოში შესრულებული მოქმედებები შენს ანგარიშს არ ცვლის.' : 'შენი ინფორმაცია მხოლოდ შენს ანგარიშშია ხელმისაწვდომი.'}</p>
    </div>

    {pending && <Dialog title={pending === 'reset' ? 'ყველა მონაცემის წაშლა?' : 'სარეზერვო ასლის აღდგენა'} onClose={close} busy={busy} destructive={pending === 'reset'}>
      <p className="page-description">
        {pending === 'reset' ? 'პროფილი, სამედიცინო ისტორია, გეგმები, ფოტოები და ვიდეოები სამუდამოდ წაიშლება. ანგარიშის ელფოსტა და პაროლი შენარჩუნდება.' : `ფაილი „${backupFile?.name}“ ჩაანაცვლებს შესაბამის მიმდინარე მონაცემებს. ჯერ დარწმუნდი, რომ საჭირო ინფორმაცია შენახული გაქვს.`}
      </p>
      {pending === 'reset' && <label className="ui-label confirmation-field" htmlFor="settings-delete-confirmation">
        დასადასტურებლად ჩაწერე მეგობრის სახელი: {state.dog?.name}
        <input id="settings-delete-confirmation" className="ui-input" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" disabled={busy}/>
      </label>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions">
        <button className="btn btn-secondary" disabled={busy} onClick={close}>გაუქმება</button>
        <button className={`btn ${pending === 'reset' ? 'btn-danger' : 'btn-primary'}`} disabled={busy || (pending === 'reset' && confirmation !== state.dog?.name)} onClick={() => void confirm()}>
          {busy && <LoaderCircle className="spin" size={16} aria-hidden="true"/>} {pending === 'reset' ? 'მონაცემების წაშლა' : 'აღდგენა'}
        </button>
      </div>
    </Dialog>}
  </div>;
}
