import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, FileText, HeartPulse, Phone, Plus, ShieldCheck, Stethoscope, Syringe, Weight } from './components/icons';
import { PetAvatar } from './components/UI';
import { WeightChart } from './components/WeightChart';
import { addDays, ageLabel, calendarDate, dateKey, formatDate, monthLabel, weekdayLabel } from './dates';
import { phoneHref } from './api';
import { today, type Health, type Navigate, type Reminder, type State } from './types';

const labels: Record<Health['type'], string> = {
  analysis: 'ანალიზი', vaccination: 'ვაქცინაცია', document: 'დოკუმენტი',
  visit: 'ვიზიტი', medication: 'მედიკამენტი', prevention: 'პრევენცია', surgery: 'ოპერაცია'
};
const reminderLabels: Record<Reminder['category'], string> = {
  appointment: 'ვიზიტი', vaccination: 'ვაქცინაცია', medication: 'მედიკამენტი',
  prevention: 'პრევენცია', followup: 'განმეორებითი ვიზიტი'
};
const weekdays = ['ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა', 'კვ'];

function MonthAgenda({ reminders, go }: { reminders: Reminder[]; go: Navigate }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(today);
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const leading = (month.getDay() + 6) % 7;
  const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const events = reminders.filter(item => item.status === 'open' && item.date === selected);
  const eventDates = new Set(reminders.filter(item => item.status === 'open').map(item => item.date));

  function changeMonth(direction: number) {
    const target = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    setOffset(value => value + direction);
    setSelected(dateKey(target));
  }

  return <section className="surface month-panel" aria-labelledby="calendar-title">
    <div className="section-bar">
      <h2 id="calendar-title" className="section-title">კალენდარი</h2>
      {(offset !== 0 || selected !== today()) && <button className="calendar-today" onClick={() => { setOffset(0); setSelected(today()); }}>დღეს</button>}
    </div>
    <div className="calendar-month">
      <strong>{monthLabel(month)}</strong>
      <div>
        <button className="icon-button" aria-label="წინა თვე" onClick={() => changeMonth(-1)}><ChevronLeft size={16}/></button>
        <button className="icon-button" aria-label="შემდეგი თვე" onClick={() => changeMonth(1)}><ChevronRight size={16}/></button>
      </div>
    </div>
    <div className="month-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
    <div className="month-grid">
      {Array.from({ length: leading }, (_, index) => <span key={'empty-' + index} aria-hidden="true"/>)}
      {Array.from({ length: totalDays }, (_, index) => {
        const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
        const key = dateKey(date);
        const hasEvent = eventDates.has(key);
        return <button key={key}
          className={(selected === key ? 'is-selected ' : '') + (key === today() ? 'is-today' : '')}
          aria-label={[weekdayLabel(date), formatDate(key), hasEvent ? 'დაგეგმილი ზრუნვა' : ''].filter(Boolean).join(', ')}
          aria-pressed={selected === key}
          aria-current={key === today() ? 'date' : undefined}
          onClick={() => setSelected(key)}>
          <span>{index + 1}</span><i className={hasEvent ? 'has-event' : ''} aria-hidden="true"/>
        </button>;
      })}
    </div>
    <div className="calendar-agenda">
      <div className="calendar-agenda-label"><time dateTime={selected}>{formatDate(selected)}</time><span>{events.length} მოვლენა</span></div>
      {events.length ? events.map(item => <button key={item.id} className="agenda-event" onClick={() => go('plan')}>
        <span className="event-marker"/><span><strong>{item.title}</strong><small>{reminderLabels[item.category]}</small></span><ArrowUpRight size={14}/>
      </button>) : <p className="calendar-empty">ამ დღეს მოვლენა არ არის დაგეგმილი.</p>}
    </div>
  </section>;
}

function RecordIcon({ type }: { type: Health['type'] }) {
  const Icon = type === 'vaccination' ? Syringe : type === 'visit' ? Stethoscope : type === 'analysis' ? HeartPulse : FileText;
  return <Icon size={18} aria-hidden="true"/>;
}

export function Overview({ state, go }: { state: State; go: Navigate }) {
  const [period, setPeriod] = useState<30 | 90 | 'all'>(90);
  const dog = state.dog!;
  const vet = state.vet;
  const weights = useMemo(() => state.weightEntries
    .filter(item => Number.isFinite(item.weightKg) && item.weightKg > 0 && calendarDate(item.date))
    .sort((a, b) => b.date.localeCompare(a.date) || b.timestamp - a.timestamp), [state.weightEntries]);
  const weight = weights[0];
  const previousWeight = weights[1];
  const weightChange = weight && previousWeight ? Number((weight.weightKg - previousWeight.weightKg).toFixed(2)) : null;
  const cutoff = period === 'all' ? '' : dateKey(addDays(new Date(), -period));
  const chartWeights = useMemo(() => weights.filter(item => !cutoff || item.date >= cutoff), [weights, cutoff]);
  const records = [...state.healthRecords].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const upcoming = state.reminders.filter(item => item.status === 'open').sort((a, b) => a.date.localeCompare(b.date));
  const overdue = upcoming.filter(item => item.date < today()).length;
  const fields = [dog.name.trim(), dog.breed.trim(), dog.birthDate || dog.age, dog.gender, dog.microchip, dog.sterilization && dog.sterilization !== 'unknown', vet?.phone && phoneHref(vet.phone), dog.photo];
  const percent = Math.round(fields.filter(Boolean).length / fields.length * 100);
  const vetPhone = vet?.phone ? phoneHref(vet.phone) : null;

  return <div className="overview-page">
    <header className="page-top">
      <div><p className="eyebrow">შენი სივრცე</p><h1 className="page-title">ზრუნვის მიმოხილვა</h1><p className="page-description">ჯანმრთელობა, ჩანაწერები და დაგეგმილი ზრუნვა.</p></div>
      <div className="overview-actions">
        <button className="btn btn-secondary" onClick={() => go('health', 'weight')}><Weight size={16}/> წონის დამატება</button>
        <button className="btn btn-primary" onClick={() => go('health', 'health-record')}><Plus size={17}/> ჩანაწერის დამატება</button>
      </div>
    </header>

    <section className="profile-strip" aria-labelledby="overview-pet-name">
      <PetAvatar name={dog.name} photo={dog.photo}/>
      <div className="profile-strip-copy">
        <h2 id="overview-pet-name">{dog.name}<span>{dog.gender === 'female' ? 'მდედრი' : 'მამრი'}</span></h2>
        <p>{[dog.breed || dog.species || 'შინაური ცხოველი', ageLabel(dog)].join(' · ')}</p>
      </div>
      <button className="text-link" onClick={() => go('profile')}>პროფილის ნახვა <ArrowUpRight size={15}/></button>
    </section>

    <div className="summary-strip" aria-label="ძირითადი მაჩვენებლები">
      <button className="summary-metric" onClick={() => go('health', weight ? undefined : 'weight')}>
        <span className="summary-label">ბოლო წონა <Weight size={15}/></span>
        <strong>{weight ? <>{weight.weightKg}<small>კგ</small></> : '—'}</strong>
        <span className="summary-detail">{weightChange !== null ? <><span className="metric-delta">{weightChange > 0 ? '+' : ''}{weightChange} კგ</span> წინა გაზომვასთან</> : weight ? formatDate(weight.date, { short: true }) : 'გაზომვა არ არის'}</span>
      </button>
      <button className="summary-metric" onClick={() => go('health')}>
        <span className="summary-label">სამედიცინო ისტორია <FileText size={15}/></span>
        <strong>{state.healthRecords.length}<small>ჩანაწერი</small></strong>
        <span className="summary-detail">{records[0] ? 'ბოლო: ' + formatDate(records[0].date, { short: true }) : 'ჩანაწერები არ არის'}</span>
      </button>
      <button className="summary-metric" onClick={() => go('plan')}>
        <span className="summary-label">დაგეგმილი ზრუნვა <CalendarDays size={15}/></span>
        <strong>{upcoming.length}<small>მოვლენა</small></strong>
        <span className={'summary-detail' + (overdue ? ' overdue-text' : '')}>{overdue ? overdue + ' ვადაგადაცილებული' : upcoming[0] ? 'შემდეგი: ' + formatDate(upcoming[0].date, { short: true }) : 'მოვლენები არ არის'}</span>
      </button>
      <button className="summary-metric" onClick={() => go('profile')}>
        <span className="summary-label">პროფილის შევსება <ShieldCheck size={15}/></span>
        <strong>{percent}<small>%</small></strong>
        <span className="summary-detail"><span className="completion-track" role="progressbar" aria-label="პროფილის შევსება" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: percent + '%' }}/></span></span>
      </button>
    </div>

    <div className="dashboard-grid">
      <div className="dashboard-main">
        <section className="surface weight-overview" aria-labelledby="weight-overview-title">
          <div className="section-bar">
            <div><h2 id="weight-overview-title" className="section-title">წონის დინამიკა</h2><p className="section-description">შენახული გაზომვები დროთა მიხედვით</p></div>
            <div className="chart-ranges" role="group" aria-label="გრაფიკის პერიოდი">
              {([{ value: 30, label: '30 დღე' }, { value: 90, label: '90 დღე' }, { value: 'all', label: 'ყველა' }] as const).map(item =>
                <button key={item.value} aria-pressed={period === item.value} onClick={() => setPeriod(item.value)}>{item.label}</button>)}
            </div>
          </div>
          <div className="weight-overview-summary"><strong>{weight ? weight.weightKg : '—'}<small>კგ</small></strong><span>ბოლო გაზომვა<br/>{weight ? <time dateTime={weight.date}>{formatDate(weight.date, { year: true })}</time> : 'ჯერ არ დამატებულა'}</span><span className="chart-period">{chartWeights.length} გაზომვა</span></div>
          {chartWeights.length >= 2 ? <WeightChart weights={chartWeights} embedded/> : <div className="chart-empty">
            <Weight size={23} aria-hidden="true"/><p>{weights.length >= 2 ? 'ამ პერიოდში გრაფიკისთვის საკმარისი გაზომვა არ არის.' : 'გრაფიკისთვის მინიმუმ ორი დათარიღებული გაზომვაა საჭირო.'}</p>
            {weights.length >= 2 && period !== 'all' ? <button className="text-link" onClick={() => setPeriod('all')}>ყველა გაზომვის ჩვენება <ArrowRight size={14}/></button> : <button className="text-link" onClick={() => go('health', 'weight')}>გაზომვის დამატება <Plus size={14}/></button>}
          </div>}
          <div className="weight-overview-footer"><span><i className="chart-legend-dot"/> წონა · კგ</span><button className="text-link" onClick={() => go('health', 'weight')}>გაზომვის დამატება <Plus size={14}/></button></div>
        </section>

        <section className="surface history-panel" aria-labelledby="history-title">
          <div className="section-bar"><div><h2 id="history-title" className="section-title">ბოლო ჩანაწერები <span className="count-badge">{state.healthRecords.length}</span></h2><p className="section-description">ვიზიტები, კვლევები და სამედიცინო დოკუმენტები</p></div><button className="text-link" onClick={() => go('health')}>ყველას ნახვა <ArrowUpRight size={14}/></button></div>
          {records.length ? <>
            <div className="history-table-head" aria-hidden="true"><span>ჩანაწერი</span><span>კატეგორია</span><span>თარიღი</span></div>
            <div className="history-list">{records.map(item => <button key={item.id} onClick={() => go('health')}>
              <span className="history-record-icon"><RecordIcon type={item.type}/></span>
              <span className="history-record-copy"><strong title={item.title}>{item.title || 'სამედიცინო ჩანაწერი'}</strong><small>{labels[item.type] || 'სხვა'}</small></span>
              <span className="badge history-category">{labels[item.type] || 'სხვა'}</span><time dateTime={item.date}>{formatDate(item.date, { short: true })}</time><ChevronRight size={14}/>
            </button>)}</div>
          </> : <div className="empty-state"><span className="empty-state-icon"><FileText size={22}/></span><h3>ჩანაწერები ჯერ არ არის</h3><p>დაამატე ვიზიტი, კვლევა ან ვაქცინაცია.</p><button className="btn btn-secondary" onClick={() => go('health', 'health-record')}><Plus size={16}/> ჩანაწერის დამატება</button></div>}
        </section>
      </div>

      <aside className="care-rail" aria-label="დაგეგმილი ზრუნვა და კონტაქტები">
        <section className="surface upcoming-panel" aria-labelledby="upcoming-title">
          <div className="section-bar"><h2 id="upcoming-title" className="section-title">დაგეგმილი ზრუნვა</h2><button className="icon-button" onClick={() => go('plan', 'reminder')} aria-label="შეხსენების დამატება"><Plus size={17}/></button></div>
          {upcoming.length ? <div className="upcoming-list">{upcoming.slice(0, 3).map(item => <button key={item.id} onClick={() => go('plan')}>
            <span className="upcoming-date"><strong>{calendarDate(item.date)?.getDate()}</strong><small>{formatDate(item.date, { short: true }).split(' ')[1]}</small></span>
            <span><strong>{item.title}</strong><small className={item.date < today() ? 'overdue-text' : ''}>{item.date < today() ? 'ვადაგადაცილებული' : reminderLabels[item.category]}</small></span><ChevronRight size={14}/>
          </button>)}</div> : <p className="rail-empty">დაგეგმილი მოვლენები აქ გამოჩნდება.</p>}
          <button className="text-link rail-footer" onClick={() => go('plan', upcoming.length ? undefined : 'reminder')}>{upcoming.length ? 'ზრუნვის გეგმის ნახვა' : 'შეხსენების დამატება'}<ArrowRight size={14}/></button>
        </section>

        <MonthAgenda reminders={state.reminders} go={go}/>

        <section className="surface vet-compact">
          <div className="section-bar"><h2 className="section-title"><Stethoscope size={17} aria-hidden="true"/> ვეტერინარი</h2><button className="icon-button" onClick={() => go('vet')} aria-label="ვეტერინარის ბარათის გახსნა"><ArrowUpRight size={16}/></button></div>
          <h3>{vet?.name || vet?.clinic || 'კონტაქტი არ არის დამატებული'}</h3>
          {vet?.clinic && <p>{vet.clinic}</p>}
          {vetPhone ? <a className="text-link" href={vetPhone}><Phone size={14}/> დარეკვა</a> : <button className="text-link" onClick={() => go('vet')}>{vet ? 'კონტაქტის შევსება' : 'ვეტერინარის დამატება'}<ArrowRight size={14}/></button>}
        </section>
        <button className="emergency-link" onClick={() => go('emergency')}><ShieldCheck size={16}/><span>გადაუდებელი ინფორმაცია</span><ArrowUpRight size={14}/></button>
      </aside>
    </div>
  </div>;
}
