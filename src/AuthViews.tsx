import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle, Eye, EyeOff, Loading02, LogOut01, Play, Upload01 } from '@untitledui/icons';
import { clearLegacy, json, legacyState, request, restoreBackup } from './api';
import { Brand } from './components/UI';
import type { Dog, State, User } from './types';

function WelcomePanel() {
  return <aside className="auth-aside" aria-labelledby="auth-aside-title">
    <div className="auth-aside-content">
      <span className="auth-aside-label">PetLog Workspace</span>
      <h2 id="auth-aside-title" className="section-title">ჯანმრთელობის ისტორია.<br/>საჭირო ინფორმაცია, საჭირო დროს.</h2>
      <p className="auth-aside-description">ჩანაწერები, კონტაქტები და დაგეგმილი ზრუნვა — შენი მეგობრის პირად სივრცეში.</p>
      <ul className="auth-benefits">
        <li><CheckCircle size={20} aria-hidden="true"/><span>ვიზიტებისა და აცრების ისტორია</span></li>
        <li><CheckCircle size={20} aria-hidden="true"/><span>მოვლის გეგმები და შეხსენებები</span></li>
        <li><CheckCircle size={20} aria-hidden="true"/><span>წონის ცვლილების ისტორია</span></li>
      </ul>
      <p className="auth-aside-caption">ყველა ჩანაწერი ერთ ანგარიშში.</p>
    </div>
  </aside>;
}

export function Auth({ onSuccess, onDemo }: { onSuccess: (user: User, state: State, warning?: string) => void; onDemo: () => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const snapshot = mode === 'register' ? legacyState() : null;
      const result = await request<{ user: User; state: State }>(`/api/auth/${mode}`, json('POST', { email: email.trim(), password }));
      let state = result.state;
      let warning = '';
      if (snapshot) {
        try { state = (await request<{ state: State }>('/api/state/import', json('POST', { state: snapshot }))).state; clearLegacy(); }
        catch { warning = 'ძველი მონაცემების გადმოტანა ვერ მოხერხდა. ბრაუზერში არსებული ასლი შენარჩუნებულია.'; }
      }
      setPassword('');
      onSuccess(result.user, state, warning);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'შესვლა ვერ მოხერხდა. სცადე ხელახლა.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <main className="auth-page auth-layout">
    <section className="auth-form-wrap" aria-labelledby="auth-title">
      <div className="auth-form">
        <div className="auth-brand"><Brand/></div>
        <header className="auth-heading">
          <h1 id="auth-title" className="auth-title text-3xl">{mode === 'register' ? 'შექმენი ანგარიში' : 'შედი ანგარიშში'}</h1>
          <p className="auth-description page-description text-sm">{mode === 'register' ? 'რეგისტრაციისთვის მიუთითე ელფოსტა და პაროლი.' : 'შეიყვანე შენი ელფოსტა და პაროლი.'}</p>
        </header>
        <form className="auth-fields" onSubmit={event => void submit(event)} aria-busy={busy} aria-describedby={error ? 'auth-error' : undefined}>
          <label className="ui-label" htmlFor="auth-email">
            ელფოსტა
            <input id="auth-email" name="email" className="ui-input" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" maxLength={254} required placeholder="name@example.com" disabled={busy}/>
          </label>
          <div>
            <label className="ui-label" htmlFor="auth-password">პაროლი</label>
            <div className="password-field">
              <input id="auth-password" name="password" className="ui-input" type={visible ? 'text' : 'password'} minLength={mode === 'register' ? 12 : undefined} maxLength={256} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required placeholder="შეიყვანე პაროლი" disabled={busy} aria-describedby={mode === 'register' ? 'password-hint' : undefined}/>
              <button type="button" className="icon-button" disabled={busy} aria-label={visible ? 'პაროლის დამალვა' : 'პაროლის ჩვენება'} aria-pressed={visible} aria-controls="auth-password" onClick={() => setVisible(!visible)}>
                {visible ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}
              </button>
            </div>
            {mode === 'register' && <p id="password-hint" className="field-hint">გამოიყენე მინიმუმ 12 სიმბოლო.</p>}
          </div>
          {error && <p id="auth-error" role="alert" className="form-error">{error}</p>}
          <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
            {busy ? <><Loading02 className="spin" size={18} aria-hidden="true"/> მიმდინარეობს…</> : mode === 'register' ? 'ანგარიშის შექმნა' : 'შესვლა'}
          </button>
        </form>
        <div className="auth-divider" aria-hidden="true"><span/>ან<span/></div>
        <button className="btn btn-secondary auth-demo" type="button" disabled={busy} onClick={onDemo}><Play size={18} aria-hidden="true"/> დემოს ნახვა</button>
        <p className="demo-caption">სადემონსტრაციო მონაცემები · ანგარიშის გარეშე</p>
        <p className="auth-switch">
          <span>{mode === 'login' ? 'ჯერ არ გაქვს ანგარიში?' : 'უკვე გაქვს ანგარიში?'}</span>{' '}
          <button className="text-link" type="button" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setPassword(''); setVisible(false); }}>{mode === 'login' ? 'რეგისტრაცია' : 'შესვლა'}</button>
        </p>
      </div>
      <footer className="auth-form-footer"><span>© {new Date().getFullYear()} PetLog</span></footer>
    </section>
    <WelcomePanel/>
  </main>;
}

export function Onboarding({ save, restore, logout }: { save: (dog: Dog) => Promise<void>; restore: (state: State) => Promise<void>; logout: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState<Dog['gender']>('female');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const backupInput = useRef<HTMLInputElement>(null);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'შენახვა ვერ მოხერხდა.'); }
    finally { lock.current = false; setBusy(false); }
  }

  return <main className="auth-page auth-layout">
    <section className="auth-form-wrap" aria-labelledby="onboarding-title">
      <div className="auth-form">
        <div className="auth-brand"><Brand/></div>
        <header className="auth-heading">
          <h1 id="onboarding-title" className="auth-title text-3xl">შექმენი ძაღლის პროფილი</h1>
          <p className="auth-description page-description text-sm">მიუთითე ძირითადი ინფორმაცია. სხვა დეტალებს მოგვიანებით დაამატებ.</p>
        </header>
        <form className="auth-fields" aria-busy={busy} aria-describedby={error ? 'onboarding-error' : undefined} onSubmit={event => { event.preventDefault(); if (!name.trim()) { setError('მიუთითე შენი ძაღლის სახელი.'); return; } void run(() => save({ name: name.trim(), breed: breed.trim(), gender, age: '', species: 'ძაღლი', sterilization: 'unknown', createdAt: Date.now() })); }}>
          <label className="ui-label" htmlFor="onboarding-name">
            სახელი
            <input id="onboarding-name" name="name" className="ui-input" value={name} maxLength={40} onChange={event => setName(event.target.value)} required disabled={busy} placeholder="მაგ. აბი" autoComplete="off"/>
          </label>
          <label className="ui-label" htmlFor="onboarding-breed">
            <span>ჯიში <span className="field-optional">(არასავალდებულო)</span></span>
            <input id="onboarding-breed" name="breed" className="ui-input" value={breed} maxLength={60} onChange={event => setBreed(event.target.value)} disabled={busy} placeholder="მაგ. ლაბრადორი" autoComplete="off"/>
          </label>
          <label className="ui-label" htmlFor="onboarding-gender">
            სქესი
            <select id="onboarding-gender" name="gender" className="ui-select" value={gender} onChange={event => setGender(event.target.value as Dog['gender'])} disabled={busy}><option value="female">მდედრი</option><option value="male">მამრი</option></select>
          </label>
          {error && <p id="onboarding-error" className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
            {busy ? <><Loading02 className="spin" size={18} aria-hidden="true"/> მიმდინარეობს…</> : <>პროფილის შექმნა <ArrowRight size={18} aria-hidden="true"/></>}
          </button>
        </form>
        <div className="onboarding-restore">
          <p id="onboarding-restore-hint">უკვე გაქვს PetLog-ის სარეზერვო ასლი?</p>
          <button className="btn btn-secondary" type="button" disabled={busy} aria-describedby="onboarding-restore-hint" onClick={() => backupInput.current?.click()}><Upload01 size={18} aria-hidden="true"/> ასლის აღდგენა</button>
          <input ref={backupInput} type="file" accept="application/json,.json" hidden disabled={busy} aria-label="სარეზერვო ასლის არჩევა" onChange={event => { const file = event.target.files?.[0]; if (file) void run(() => restoreBackup(file, restore)); event.target.value = ''; }}/>
        </div>
        <button className="text-link onboarding-logout" type="button" disabled={busy} onClick={() => void run(logout)}><LogOut01 size={16} aria-hidden="true"/> ანგარიშიდან გასვლა</button>
      </div>
      <footer className="auth-form-footer"><span>© {new Date().getFullYear()} PetLog</span></footer>
    </section>
    <WelcomePanel/>
  </main>;
}
