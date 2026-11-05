import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Heart, HeartPulse, LayoutDashboard, Plus, Search, Settings, ShieldCheck, Stethoscope, UserRound, Weight, X } from './components/icons';
import { Auth, Onboarding } from './AuthViews';
import { EmergencyPage, SettingsPage } from './AccountPages';
import { json, request } from './api';
import { Brand, Dialog, PetAvatar } from './components/UI';
import { formatDate } from './dates';
import { createDemoState } from './demo';
import { Overview } from './Overview';
import { emptyState, today, type Collection, type Navigate, type Page, type PageIntent, type State, type User } from './types';

const HealthPage = lazy(() => import('./CarePages').then(module => ({ default: module.HealthPage })));
const PlanPage = lazy(() => import('./CarePages').then(module => ({ default: module.PlanPage })));
const ProfilePage = lazy(() => import('./ProfilePages').then(module => ({ default: module.ProfilePage })));
const VetPage = lazy(() => import('./ProfilePages').then(module => ({ default: module.VetPage })));

const navigation = [
  { id: 'overview' as const, label: 'მთავარი', icon: LayoutDashboard },
  { id: 'profile' as const, label: 'პროფილი', icon: UserRound },
  { id: 'health' as const, label: 'ჯანმრთელობა', icon: HeartPulse },
  { id: 'plan' as const, label: 'ზრუნვის გეგმა', icon: CalendarDays },
  { id: 'vet' as const, label: 'ვეტერინარი', icon: Stethoscope }
];
const pageNames: Record<Page, string> = { overview: 'მთავარი', profile: 'პროფილი', health: 'ჯანმრთელობა', plan: 'ზრუნვის გეგმა', vet: 'ვეტერინარი', emergency: 'გადაუდებელი ინფორმაცია', settings: 'პარამეტრები' };
const demoUser: User = { id: 'petlog-demo', email: 'demo@petlog.example' };
const isDemoRoute = () => location.hash.startsWith('#demo/');
function route(): Page {
  const value = location.hash.replace(/^#(?:demo\/)?\/?/, '');
  return Object.hasOwn(pageNames, value) ? value as Page : 'overview';
}

function CommandMenu({ go, close }: { go: Navigate; close: () => void }) {
  const [query, setQuery] = useState('');
  const actions: { label: string; detail: string; page: Page; intent?: PageIntent; icon: typeof Search }[] = [
    ...navigation.map(item => ({ ...item, page: item.id, detail: 'გვერდის გახსნა' })),
    { label: 'სამედიცინო ჩანაწერის დამატება', detail: 'სწრაფი მოქმედება', page: 'health', intent: 'health-record', icon: Plus },
    { label: 'წონის დამატება', detail: 'სწრაფი მოქმედება', page: 'health', intent: 'weight', icon: Weight },
    { label: 'შეხსენების დამატება', detail: 'სწრაფი მოქმედება', page: 'plan', intent: 'reminder', icon: Bell },
    { label: 'გადაუდებელი ინფორმაცია', detail: 'მნიშვნელოვანი კონტაქტები', page: 'emergency', icon: ShieldCheck },
    { label: 'პარამეტრები', detail: 'ანგარიში და სარეზერვო ასლი', page: 'settings', icon: Settings }
  ];
  const filtered = actions.filter(action => `${action.label} ${action.detail}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <Dialog title="სად გადავიდეთ?" onClose={close}><label className="ui-label command-search"><span className="sr-only">გვერდის ან მოქმედების ძიება</span><Search size={19} aria-hidden="true"/><input autoFocus className="ui-input" placeholder="მოძებნე გვერდი ან მოქმედება…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && filtered.length) { event.preventDefault(); close(); go(filtered[0].page, filtered[0].intent); } }}/></label><div className="command-results">{filtered.length ? filtered.map(action => <button type="button" key={action.label} onClick={() => { close(); go(action.page, action.intent); }}><span className="command-icon"><action.icon size={19}/></span><span><strong>{action.label}</strong><small>{action.detail}</small></span><ArrowUpRight size={16}/></button>) : <div className="empty-state compact-empty"><Search size={24}/><h3>შედეგი ვერ მოიძებნა</h3><p>სცადე „ჯანმრთელობა“, „წონა“ ან „გეგმა“.</p></div>}</div><p className="field-hint command-hint"><kbd>Esc</kbd> დასახურად <span>·</span> <kbd>Enter</kbd> პირველი შედეგის გასახსნელად</p></Dialog>;
}

export default function App() {
  const [demo, setDemo] = useState(isDemoRoute);
  const [user, setUser] = useState<User | null>(() => isDemoRoute() ? demoUser : null);
  const [state, setState] = useState<State>(() => isDemoRoute() ? createDemoState() : emptyState());
  const [tab, setTab] = useState<Page>(route);
  const [intent, setIntent] = useState<PageIntent | null>(null);
  const [loading, setLoading] = useState(() => !isDemoRoute());
  const [connectionError, setConnectionError] = useState(false);
  const [toast, setToast] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isDemoRoute()) return;
    const controller = new AbortController();
    fetch('/api/auth/me', { credentials: 'same-origin', signal: controller.signal }).then(async response => {
      if (response.status === 401) return;
      if (!response.ok) throw new Error('server');
      const result = await response.json() as { user: User; state: State };
      setUser(result.user); setState({ ...emptyState(), ...result.state });
    }).catch(cause => { if (!controller.signal.aborted && cause) setConnectionError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handler = () => { setTab(route()); setIntent(null); };
    window.addEventListener('hashchange', handler);
    window.addEventListener('popstate', handler);
    return () => { window.removeEventListener('hashchange', handler); window.removeEventListener('popstate', handler); };
  }, []);

  useEffect(() => {
    document.title = user ? `${pageNames[tab]} — PetLog` : 'PetLog — მეტი სიმშვიდე. უკეთესი ზრუნვა.';
  }, [tab, user]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!user || !state.dog) return;
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(value => !value); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [user, state.dog]);

  const weight = useMemo(() => [...state.weightEntries].sort((a, b) => b.date.localeCompare(a.date) || b.timestamp - a.timestamp)[0], [state.weightEntries]);
  const openCount = state.reminders.filter(item => item.status === 'open').length;
  const dueCount = state.reminders.filter(item => item.status === 'open' && item.date <= today()).length;

  function go(page: Page, action?: PageIntent) {
    setTab(page); setIntent(action ?? null);
    const hash = `#${demo ? 'demo/' : ''}${page}`;
    if (location.hash !== hash) history.pushState(null, '', hash);
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (!action) requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  }

  async function save<K extends Collection>(collection: K, value: State[K]) {
    if (!demo) await request(`/api/state/${collection}`, json('PUT', { value }));
    setState(previous => ({ ...previous, [collection]: value }));
  }

  async function restore(value: State) {
    const result = demo ? { state: { ...emptyState(), ...value } } : await request<{ state: State }>('/api/state/restore', json('POST', { state: value }));
    setState({ ...emptyState(), ...result.state }); go('overview');
  }

  async function reset() {
    const result = demo ? { state: emptyState() } : await request<{ state: State }>('/api/state/reset', { method: 'POST' });
    setState({ ...emptyState(), ...result.state }); go('overview'); setToast('მონაცემები წაიშალა.');
  }

  async function logout() {
    if (demo) { location.hash = ''; location.reload(); return; }
    await request('/api/auth/logout', { method: 'POST' });
    setUser(null); setState(emptyState()); setToast(''); setTab('overview'); history.replaceState(null, '', location.pathname);
  }

  function startDemo() {
    setDemo(true); setUser(demoUser); setState(createDemoState()); setTab('overview'); setConnectionError(false); setLoading(false);
    history.replaceState(null, '', '#demo/overview');
  }

  const toastView = toast && <div className="toast" role="status"><span className="toast-icon"><Check size={16}/></span><span>{toast}</span><button className="icon-button" onClick={() => setToast('')} aria-label="შეტყობინების დახურვა"><X size={17}/></button></div>;

  if (loading) return <main className="loading-screen"><Brand/><span className="loading-line"/><p>შენი ზრუნვის სივრცე იტვირთება…</p></main>;
  if (connectionError) return <main className="connection-screen"><Brand/><div className="surface connection-card"><span className="section-icon"><CircleHelp size={27}/></span><h1 className="section-title">დაკავშირება ვერ მოხერხდა</h1><p className="page-description">სერვერთან კავშირი დროებით მიუწვდომელია. შენახული ინფორმაცია არ შეცვლილა.</p><button className="btn btn-primary" onClick={() => location.reload()}>თავიდან ცდა <ArrowRight size={17}/></button><button className="text-link" onClick={startDemo}>მანამდე დემოს დათვალიერება <ArrowUpRight size={15}/></button></div></main>;
  if (!user) return <><Auth onDemo={startDemo} onSuccess={(account, data, warning) => { setUser(account); setState({ ...emptyState(), ...data }); if (warning) setToast(warning); }}/>{toastView}</>;
  if (!state.dog) return <><Onboarding save={value => save('dog', value)} restore={restore} logout={logout}/>{toastView}</>;

  const dog = state.dog;
  return <div className="app-shell"><a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); mainRef.current?.focus(); }}>მთავარ შინაარსზე გადასვლა</a>
    <aside className="app-sidebar"><button className="sidebar-brand" onClick={() => go('overview')} aria-label="PetLog — მთავარი"><Brand/></button>
      <button className="sidebar-search" onClick={() => setCommandOpen(true)} aria-label="გვერდის ან მოქმედების ძიება"><Search size={19}/><span>ძიება</span><kbd>⌘ K</kbd></button>
      <button className="sidebar-pet" onClick={() => go('profile')} aria-label={`${dog.name} — პროფილის გახსნა`}><PetAvatar name={dog.name} photo={dog.photo}/><span><strong>{dog.name}</strong><small>შენი ოთხფეხა მეგობარი</small></span><ChevronDown size={16}/></button>
      <p className="sidebar-label">ყოველდღიური ზრუნვა</p><nav className="desktop-nav" aria-label="მთავარი ნავიგაცია">{navigation.map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => go(item.id)}><item.icon size={19} strokeWidth={1.8} aria-hidden="true"/><span>{item.label}</span>{item.id === 'plan' && openCount > 0 && <small>{openCount}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><button className={`sidebar-emergency${tab === 'emergency' ? ' is-active' : ''}`} onClick={() => go('emergency')} aria-current={tab === 'emergency' ? 'page' : undefined}><span><ShieldCheck size={21} aria-hidden="true"/><ArrowUpRight size={15} aria-hidden="true"/></span><strong>ყოველთვის ხელთ</strong><small>გადაუდებელი ინფორმაცია<br/>და მნიშვნელოვანი კონტაქტები</small></button>
      <button className="sidebar-settings" aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => go('settings')}><Settings size={18} aria-hidden="true"/>პარამეტრები</button><button className="sidebar-settings" onClick={() => setHelpOpen(true)}><CircleHelp size={18} aria-hidden="true"/>PetLog-ის შესახებ</button>
      <button className="sidebar-account" onClick={() => go('settings')}><span className="account-initial">{user.email[0]?.toUpperCase()}</span><span><strong>{demo ? 'სადემონსტრაციო სივრცე' : 'ჩემი ანგარიში'}</strong><small>{demo ? 'მონაცემები არ ინახება' : user.email}</small></span><ChevronRight size={16}/></button></div>
    </aside>
    <div className="app-workspace">{demo && <div className="demo-banner"><span><span className="status-dot"/> დემო ვერსია <span className="demo-banner-detail">— შეგიძლია სცადო ყველა ძირითადი მოქმედება. შენი ანგარიში არ იცვლება.</span></span><button onClick={() => void logout()}>დემოდან გასვლა <ArrowRight size={14}/></button></div>}
      <header className="topbar"><div className="topbar-inner"><div className="workspace-crumb"><span>ჩემი სივრცე</span><ChevronRight size={13} aria-hidden="true"/><strong>{pageNames[tab]}</strong></div><button className="mobile-brand" onClick={() => go('overview')} aria-label="PetLog — მთავარი"><Brand/></button><div className="top-action"><button className="search-trigger" onClick={() => setCommandOpen(true)} aria-label="გვერდის ან მოქმედების ძიება"><Search size={17}/><span>ძიება</span><kbd>⌘ K</kbd></button><span className="date-chip"><CalendarDays size={16} aria-hidden="true"/>{formatDate(today(), { short: true })}</span><button className="icon-button notification-trigger" aria-label={dueCount ? `${dueCount} შესასრულებელი შეხსენება — გეგმის გახსნა` : 'ზრუნვის გეგმის გახსნა'} onClick={() => go('plan')}><Bell size={20}/>{dueCount > 0 && <span/>}</button><span className="topbar-divider"/><button className="active-pet" onClick={() => go('profile')} aria-label={`${dog.name} — პროფილის ნახვა`}><PetAvatar name={dog.name} photo={dog.photo}/><span>{dog.name}</span><ChevronDown size={14}/></button><button className="icon-button mobile-settings" aria-label="პარამეტრები" onClick={() => go('settings')}><Settings size={20}/></button></div></div></header>
      <main ref={mainRef} id="main-content" className="main-wrap" tabIndex={-1} aria-label={pageNames[tab]}>
        <Suspense fallback={<div className="page-loading" role="status"><span className="loading-line"/><p>გვერდი იტვირთება…</p></div>}>
        {tab === 'overview' && <Overview state={state} go={go}/>}
        {tab === 'profile' && <ProfilePage dog={dog} vet={state.vet} weight={weight} save={value => save('dog', value)} notify={setToast}/>}
        {tab === 'health' && <HealthPage entries={state.healthRecords} weights={state.weightEntries} saveEntries={value => save('healthRecords', value)} saveWeights={value => save('weightEntries', value)} notify={setToast} intent={intent ?? undefined} onIntentHandled={() => setIntent(null)}/>}
        {tab === 'plan' && <PlanPage reminders={state.reminders} save={value => save('reminders', value)} notify={setToast} intent={intent ?? undefined} onIntentHandled={() => setIntent(null)}/>}
        {tab === 'vet' && <VetPage vet={state.vet} save={value => save('vet', value)} notify={setToast}/>}
        {tab === 'emergency' && <EmergencyPage state={state} go={go}/>}
        {tab === 'settings' && <SettingsPage user={user} state={state} restore={restore} reset={reset} logout={logout} notify={setToast} demo={demo}/>}
        </Suspense>
        <footer className="workspace-footer"><span>PetLog · ზრუნვის პირადი სივრცე</span><span>{demo ? 'სადემონსტრაციო მონაცემები' : 'შენი ინფორმაცია დაცულია ანგარიშით'}</span></footer>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="მობილური ნავიგაცია">{navigation.map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => go(item.id)}><item.icon size={21} strokeWidth={1.8} aria-hidden="true"/><span>{item.id === 'plan' ? 'გეგმა' : item.label}</span></button>)}</nav>
    {toastView}{commandOpen && <CommandMenu go={go} close={() => setCommandOpen(false)}/>}{helpOpen && <Dialog title="პატარა მეგობარი. მთელი ზრუნვა." onClose={() => setHelpOpen(false)}><div className="help-intro"><Brand/><p className="page-description">PetLog შენი მეგობრის ჯანმრთელობის პირადი დღიურია. პროფილი, სამედიცინო ისტორია და მნიშვნელოვანი თარიღები ყოველთვის ერთ სივრცეშია.</p></div><div className="help-steps"><div><HeartPulse size={20}/><span><strong>შეინახე ისტორია</strong><p>დაამატე ვიზიტები, დოკუმენტები და წონის გაზომვები.</p></span></div><div><CalendarDays size={20}/><span><strong>დაგეგმე მომავალი ზრუნვა</strong><p>მოვლენები და შეხსენებები აპის გახსნისას ჩანს.</p></span></div><div><ShieldCheck size={20}/><span><strong>შეინარჩუნე ინფორმაცია</strong><p>პარამეტრებიდან ჩამოტვირთე სრული სარეზერვო ასლი.</p></span></div></div><button className="btn btn-primary w-full" onClick={() => setHelpOpen(false)}>გასაგებია <Check size={17}/></button></Dialog>}
  </div>;
}
