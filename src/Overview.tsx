import { useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarCheck2, CalendarDays, ChevronLeft, ChevronRight, FileText, HeartPulse, Phone, Plus, ShieldCheck, Stethoscope, Syringe, Weight } from './components/icons';
import { PetAvatar } from './components/UI';
import { addDays, ageLabel, calendarDate, dateKey, formatDate, monthLabel, weekdayLabel } from './dates';
import { phoneHref } from './api';
import { today, type Health, type Navigate, type Reminder, type State } from './types';

const labels: Record<string, string> = { analysis: 'ანალიზი', vaccination: 'ვაქცინაცია', document: 'დოკუმენტი', visit: 'ვიზიტი', medication: 'მედიკამენტი', prevention: 'პრევენცია', surgery: 'ოპერაცია' };
const reminderLabels: Record<Reminder['category'], string> = { appointment: 'ვიზიტი', vaccination: 'ვაქცინაცია', medication: 'მედიკამენტი', prevention: 'პრევენცია', followup: 'განმეორებითი ვიზიტი' };

function WeekAgenda({ reminders, go }: { reminders: Reminder[]; go: Navigate }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(today);
  const now = new Date();
  const monday = addDays(now, -((now.getDay() + 6) % 7) + offset * 7);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const events = reminders.filter(item => item.status === 'open' && item.date === selected);
  function changeWeek(value: number) {
    setOffset(current => current + value);
    setSelected(dateKey(addDays(calendarDate(selected) ?? now, value * 7)));
  }
  return <section className="surface agenda-panel" aria-labelledby="agenda-title">
    <div className="section-bar"><h2 id="agenda-title" className="section-title">კალენდარი</h2><button className="icon-button" aria-label="შეხსენების დამატება" onClick={() => go('plan', 'reminder')}><Plus size={19}/></button></div>
    <div className="calendar-month"><strong>{monthLabel(days[3])}</strong><div>{offset !== 0 && <button className="calendar-today" onClick={() => { setOffset(0); setSelected(today()); }}>დღეს</button>}<button className="icon-button" aria-label="წინა კვირა" onClick={() => changeWeek(-1)}><ChevronLeft size={18}/></button><button className="icon-button" aria-label="შემდეგი კვირა" onClick={() => changeWeek(1)}><ChevronRight size={18}/></button></div></div>
    <div className="week-grid">{days.map(date => {
      const key = dateKey(date);
      const hasEvent = reminders.some(item => item.date === key && item.status === 'open');
      return <button key={key} aria-pressed={selected === key} aria-current={key === today() ? 'date' : undefined} aria-label={`${weekdayLabel(date)}, ${formatDate(key)}${hasEvent ? ', დაგეგმილი ზრუნვა' : ''}`} className={selected === key ? 'selected' : ''} onClick={() => setSelected(key)}><span>{weekdayLabel(date, true)}</span><strong>{date.getDate()}</strong><i className={hasEvent ? 'has-event' : ''}/></button>;
    })}</div>
    <div className="agenda-date"><span>{formatDate(selected)}</span>{selected === today() && <span className="badge">დღეს</span>}<small>{events.length} მოვლენა</small></div>
    <div>{events.length ? events.map(item => <button key={item.id} className="agenda-event" onClick={() => go('plan')}><span className="event-marker"/><span><strong>{item.title}</strong><small>{reminderLabels[item.category]}</small></span><ArrowUpRight size={16}/></button>) : <div className="agenda-empty"><CalendarCheck2 size={26} aria-hidden="true"/><strong>მოვლენები არ არის</strong><p>ამ თარიღზე ზრუნვა არ დაგიგეგმავს.</p></div>}</div>
    <button className="text-link agenda-link" onClick={() => go('plan')}>სრული გეგმის ნახვა <ArrowRight size={16}/></button>
  </section>;
}

function RecordIcon({ type }: { type: Health['type'] }) {
  const Icon = type === 'vaccination' ? Syringe : type === 'visit' ? Stethoscope : type === 'analysis' ? HeartPulse : FileText;
  return <Icon size={20} aria-hidden="true"/>;
}

export function Overview({ state, go }: { state: State; go: Navigate }) {
  const dog = state.dog!;
  const vet = state.vet;
  const weights = [...state.weightEntries].sort((a, b) => b.date.localeCompare(a.date) || b.timestamp - a.timestamp);
  const weight = weights[0];
  const records = [...state.healthRecords].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const upcoming = state.reminders.filter(item => item.status === 'open').sort((a, b) => a.date.localeCompare(b.date));
  const overdue = upcoming.filter(item => item.date < today()).length;
  const fields = [dog.name.trim(), dog.breed.trim(), dog.birthDate || dog.age, dog.gender, dog.microchip, dog.sterilization && dog.sterilization !== 'unknown', vet?.phone && phoneHref(vet.phone), dog.photo];
  const percent = Math.round(fields.filter(Boolean).length / fields.length * 100);
  const vetPhone = vet?.phone ? phoneHref(vet.phone) : null;

  return <div className="overview-page">
    <header className="page-top"><div><h1 className="page-title">ზრუნვის მიმოხილვა</h1><p className="page-description">ჯანმრთელობის ისტორია და მომავალი ზრუნვა — ყველაფერი ერთ სივრცეში.</p></div><button className="btn btn-primary" onClick={() => go('health', 'health-record')}><Plus size={18}/> ჩანაწერის დამატება</button></header>

    <section className="surface overview-profile" aria-labelledby="overview-pet-name">
      <PetAvatar name={dog.name} photo={dog.photo}/>
      <div className="overview-profile-copy"><div><h2 id="overview-pet-name">{dog.name}</h2><span className="badge">{dog.gender === 'female' ? 'მდედრი' : 'მამრი'}</span></div><p>{dog.breed || dog.species || 'შენი მეგობარი'}<span>·</span>{ageLabel(dog)}</p></div>
      <div className="profile-completion"><span>პროფილის შევსება <strong>{percent}%</strong></span><span className="completion-track"><i style={{ width: `${percent}%` }}/></span></div>
      <button className="btn btn-secondary" onClick={() => go('profile')}>პროფილის ნახვა <ArrowUpRight size={16}/></button>
    </section>

    <div className="metric-grid">
      <button className="surface metric-card" onClick={() => go('health', weight ? undefined : 'weight')}><span className="metric-label">ბოლო წონა <Weight size={20}/></span><strong className="metric-value">{weight ? <>{weight.weightKg}<small>კგ</small></> : '—'}</strong><span className="metric-detail">{weight ? formatDate(weight.date, { year: true }) : 'დაამატე პირველი გაზომვა'}<ArrowUpRight size={15}/></span></button>
      <button className="surface metric-card" onClick={() => go('health')}><span className="metric-label">სამედიცინო ისტორია <FileText size={20}/></span><strong className="metric-value">{state.healthRecords.length}<small>ჩანაწერი</small></strong><span className="metric-detail">{records[0] ? `ბოლო ჩანაწერი: ${formatDate(records[0].date, { short: true })}` : 'შენახული ჩანაწერები ჯერ არ არის'}<ArrowUpRight size={15}/></span></button>
      <button className="surface metric-card" onClick={() => go('plan')}><span className="metric-label">დაგეგმილი ზრუნვა <CalendarDays size={20}/></span><strong className="metric-value">{upcoming.length}<small>მოვლენა</small></strong><span className={`metric-detail${overdue ? ' overdue-text' : ''}`}>{overdue ? `${overdue} ვადაგადაცილებული` : upcoming[0] ? `შემდეგი: ${formatDate(upcoming[0].date, { short: true })}` : 'დაგეგმე შემდეგი ნაბიჯი'}<ArrowUpRight size={15}/></span></button>
    </div>

    <div className="dashboard-grid"><div className="dashboard-main">
      <section className="surface history-panel" aria-labelledby="history-title"><div className="section-bar"><div><h2 id="history-title" className="section-title">სამედიცინო ჩანაწერები <span className="count-badge">{state.healthRecords.length}</span></h2><p className="section-description">ბოლო ვიზიტები, კვლევები და შენახული დოკუმენტები.</p></div><button className="text-link" onClick={() => go('health')}>ყველას ნახვა <ArrowUpRight size={16}/></button></div>
        {records.length ? <><div className="history-table-head"><span>ჩანაწერი</span><span>კატეგორია</span><span>თარიღი</span></div><div className="history-list">{records.map(item => <button key={item.id} onClick={() => go('health')}><span className="history-record-icon"><RecordIcon type={item.type}/></span><span className="history-record-copy"><strong>{item.title || 'სამედიცინო ჩანაწერი'}</strong><small>{labels[item.type] || 'სხვა'}</small></span><span className="badge history-category">{labels[item.type] || 'სხვა'}</span><time dateTime={item.date}>{formatDate(item.date, { short: true })}</time><ChevronRight size={15}/></button>)}</div></> : <div className="empty-state"><span className="empty-state-icon"><FileText size={25}/></span><h3>დაიწყე პირველი ჩანაწერით</h3><p>შეინახე ვიზიტის დეტალები, ანალიზი ან ვაქცინაცია.</p><button className="btn btn-secondary" onClick={() => go('health', 'health-record')}><Plus size={17}/> ჩანაწერის დამატება</button></div>}
      </section>

      <section className="surface upcoming-panel" aria-labelledby="upcoming-title"><div className="section-bar"><div><h2 id="upcoming-title" className="section-title">მომდევნო მოვლენები</h2><p className="section-description">მნიშვნელოვანი თარიღები, რომლებიც წინ გაქვს.</p></div><button className="icon-button" onClick={() => go('plan', 'reminder')} aria-label="შეხსენების დამატება"><Plus size={19}/></button></div>{upcoming.length ? <div className="upcoming-list">{upcoming.slice(0, 3).map(item => <button key={item.id} onClick={() => go('plan')}><span className="upcoming-date"><strong>{calendarDate(item.date)?.getDate()}</strong><small>{formatDate(item.date, { short: true }).split(' ')[1]}</small></span><span><strong>{item.title}</strong><small>{reminderLabels[item.category]}{item.recurrence !== 'none' ? ' · განმეორებადი' : ''}</small></span><span className={`badge${item.date < today() ? ' badge-warm' : ''}`}>{item.date < today() ? 'ვადაგადაცილებული' : item.date === today() ? 'დღეს' : formatDate(item.date, { short: true })}</span><ChevronRight size={16}/></button>)}</div> : <div className="empty-state compact-empty"><CalendarDays size={24}/><h3>ჯერ არაფერი დაგიგეგმავს</h3><p>დაამატე ვიზიტი ან შეხსენება.</p><button className="text-link" onClick={() => go('plan', 'reminder')}>შეხსენების დამატება <Plus size={16}/></button></div>}</section>

      <div className="quick-actions"><button onClick={() => go('health', 'weight')}><Weight size={21}/><span><strong>წონის დამატება</strong><small>შეინახე ახალი გაზომვა</small></span><Plus size={18}/></button><button onClick={() => go('plan', 'reminder')}><CalendarDays size={21}/><span><strong>ზრუნვის დაგეგმვა</strong><small>დაამატე მნიშვნელოვანი თარიღი</small></span><Plus size={18}/></button></div>
    </div>

    <aside className="care-rail" aria-label="კალენდარი და კონტაქტები"><WeekAgenda reminders={state.reminders} go={go}/>
      <section className="surface vet-compact"><div className="section-bar"><span className="section-icon"><Stethoscope size={22}/></span><span className="badge">ვეტერინარი</span></div><h2>{vet?.name || vet?.clinic || 'შენი ზრუნვის გუნდი'}</h2><p>{vet ? vet.clinic || 'საკონტაქტო ინფორმაცია შენახულია.' : 'შეინახე ვეტერინარის ნომერი, რომ საჭირო დროს მარტივად დაუკავშირდე.'}</p>{vetPhone ? <a className="btn btn-secondary w-full" href={vetPhone}><Phone size={17}/> დარეკვა</a> : <button className="btn btn-secondary w-full" onClick={() => go('vet')}>{vet ? 'კონტაქტის ნახვა' : 'ვეტერინარის დამატება'}<ArrowRight size={16}/></button>}</section>
      <button className="essential-banner" onClick={() => go('emergency')}><ShieldCheck size={22}/><span><strong>გადაუდებელი ინფორმაცია</strong><small>ალერგიები და მნიშვნელოვანი კონტაქტები</small></span><ArrowUpRight size={17}/></button>
    </aside></div>
  </div>;
}
