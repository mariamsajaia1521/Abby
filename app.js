'use strict';

/* ============================================================
   PetLog — application logic
   Storage keys (all data persisted in localStorage as JSON /
   base64 data-URLs for photos, per the brief).
   ============================================================ */
const STORAGE_KEYS = {
  dog: 'petlog.dog',
  routine: 'petlog.routine',
  health: 'petlog.health',
  weight: 'petlog.weight',
  memories: 'petlog.memories',
  theme: 'petlog.theme'
};

const GENDER_LABELS = { male: 'მამრი', female: 'მდედრი' };
const HEALTH_TYPE_LABELS = { analysis: 'ანალიზი', vaccination: 'აცრა', document: 'დოკუმენტი' };

/* ============================================================
   Custom icon library — small, animated inline SVGs that replace
   plain emoji glyphs throughout entry lists and controls.
   ============================================================ */
const ICONS = {
  feeding: `<svg viewBox="0 0 24 24" class="icon-svg icon-feeding" aria-hidden="true">
    <path d="M4 13.5c0 3.6 3.6 6.3 8 6.3s8-2.7 8-6.3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="12" cy="13.5" rx="8" ry="2.7" stroke="currentColor" stroke-width="1.6" fill="none"/>
    <path class="steam-1" d="M9.5 9c-.6-1 .6-1.6 0-2.6" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path class="steam-2" d="M12.4 8.4c-.6-1 .6-1.6 0-2.6" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path class="steam-3" d="M15.2 9c-.6-1 .6-1.6 0-2.6" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  </svg>`,
  walk: `<svg viewBox="0 0 24 24" class="icon-svg icon-walk" aria-hidden="true">
    <path d="M12 13.6c-2.2 0-4.1 1.9-4.1 4.4 0 1.7 1.2 2.9 2.6 2.9.8 0 1.5-.3 1.5-.3s.7.3 1.5.3c1.4 0 2.6-1.2 2.6-2.9 0-2.5-1.9-4.4-4.1-4.4Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <ellipse cx="7.3" cy="10" rx="1.5" ry="2" stroke="currentColor" stroke-width="1.4" fill="none"/>
    <ellipse cx="10.4" cy="7.6" rx="1.5" ry="2" stroke="currentColor" stroke-width="1.4" fill="none"/>
    <ellipse cx="13.6" cy="7.6" rx="1.5" ry="2" stroke="currentColor" stroke-width="1.4" fill="none"/>
    <ellipse cx="16.7" cy="10" rx="1.5" ry="2" stroke="currentColor" stroke-width="1.4" fill="none"/>
    <circle class="step s1" cx="3" cy="19.2" r="1" fill="currentColor"/>
    <circle class="step s2" cx="6" cy="20" r="1" fill="currentColor"/>
    <circle class="step s3" cx="9.5" cy="19.4" r="1" fill="currentColor"/>
  </svg>`,
  vaccination: `<svg viewBox="0 0 24 24" class="icon-svg icon-vaccine" aria-hidden="true">
    <path d="M14.5 3.5 20 9M6.5 11.5l6-6M4 20l3-1 8.5-8.5-2-2L5 17l-1 3Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M12 6l2.5 2.5M9.5 8.5 12 11" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle class="vaccine-drop" cx="7.5" cy="15.5" r="1.1" fill="currentColor"/>
  </svg>`,
  document: `<svg viewBox="0 0 24 24" class="icon-svg icon-document" aria-hidden="true">
    <path d="M7 3.5h7l4 4v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
    <path d="M14 3.5V8h4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
    <path d="M8.5 12.5h7M8.5 15.5h7M8.5 18.5h4.5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <rect class="doc-scan" x="7.5" y="10.5" width="9" height="1.4" fill="currentColor"/>
  </svg>`,
  analysis: `<svg viewBox="0 0 24 24" class="icon-svg icon-analysis" aria-hidden="true">
    <path d="M9 3.5h6M10 3.5v7.7L5.8 18a2 2 0 0 0 1.7 3h9a2 2 0 0 0 1.7-3L14 11.2V3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M7.6 15.5h8.8" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle class="bubble b1" cx="10.5" cy="17.5" r="0.9" fill="currentColor"/>
    <circle class="bubble b2" cx="13" cy="18.3" r="0.7" fill="currentColor"/>
    <circle class="bubble b3" cx="12" cy="16.3" r="0.6" fill="currentColor"/>
  </svg>`,
  close: `<svg viewBox="0 0 24 24" class="icon-svg icon-delete-x" aria-hidden="true">
    <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  </svg>`,
  arrowUp: `<svg viewBox="0 0 24 24" class="weight-delta-arrow" aria-hidden="true"><path d="M12 18V6M6 11l6-6 6 6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  arrowDown: `<svg viewBox="0 0 24 24" class="weight-delta-arrow" aria-hidden="true"><path d="M12 6v12M18 13l-6 6-6-6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  weight: `<svg viewBox="0 0 24 24" class="icon-svg icon-weight" aria-hidden="true">
    <path d="M8.5 8h7l2.3 11.2a1.3 1.3 0 0 1-1.28 1.55H7.48A1.3 1.3 0 0 1 6.2 19.2L8.5 8Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
    <path d="M9.6 8a2.4 2.4 0 1 1 4.8 0" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <circle class="weight-tick" cx="12" cy="13.4" r="1.15" fill="currentColor"/>
  </svg>`
};

/* ---------- storage helpers ----------
   Some browsers/WebViews block persistent localStorage entirely
   (private mode, cross-origin iframes, restricted test shells) and
   throw on the very first write, regardless of size. Rather than
   fail the whole app, we transparently fall back to an in-memory
   store for the session and show a one-time, non-blocking notice. */
const memoryFallback = {};
let usingFallbackStorage = false;

function safeGetItem(key){
  try{
    return localStorage.getItem(key);
  }catch(err){
    return key in memoryFallback ? memoryFallback[key] : null;
  }
}

function safeSetItem(key, value){
  try{
    localStorage.setItem(key, value);
    return true;
  }catch(err){
    console.warn('PetLog: localStorage unavailable, using in-memory store for this session', err);
    memoryFallback[key] = value;
    if(!usingFallbackStorage){
      usingFallbackStorage = true;
      showStorageNotice();
    }
    return true;
  }
}

function safeRemoveItem(key){
  try{ localStorage.removeItem(key); }catch(err){ /* ignore */ }
  delete memoryFallback[key];
}

function showStorageNotice(){
  if(document.getElementById('storage-notice')) return;
  const banner = document.createElement('div');
  banner.id = 'storage-notice';
  banner.className = 'storage-notice';
  banner.innerHTML = '<span>ამ ბრაუზერში მუდმივი შენახვა შეზღუდულია — მონაცემები დარჩება მხოლოდ ამ სესიის განმავლობაში.</span>';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'storage-notice-close';
  closeBtn.innerHTML = ICONS.close;
  closeBtn.setAttribute('aria-label', 'დახურვა');
  closeBtn.addEventListener('click', () => banner.remove());
  banner.appendChild(closeBtn);
  document.body.prepend(banner);
}

function loadJSON(key, fallback){
  try{
    const raw = safeGetItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(err){
    console.error('PetLog: failed to read', key, err);
    return fallback;
  }
}

function saveJSON(key, value){
  return safeSetItem(key, JSON.stringify(value));
}

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* Compress + downscale photos before they're stored as base64.
   This keeps each entry small (a few dozen KB instead of several MB
   from a modern phone camera), so far more photos fit in whatever
   storage quota is actually available. */
function compressImage(file, maxDimension = 1000, quality = 0.72){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if(width > maxDimension || height > maxDimension){
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatDate(isoOrTimestamp){
  const d = typeof isoOrTimestamp === 'number' ? new Date(isoOrTimestamp) : new Date(isoOrTimestamp);
  if(isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ka-GE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(timestamp){
  const d = new Date(timestamp);
  return d.toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
}

/* ============================================================
   State
   ============================================================ */
let dog = loadJSON(STORAGE_KEYS.dog, null);
let routineEntries = loadJSON(STORAGE_KEYS.routine, []);
let healthRecords = loadJSON(STORAGE_KEYS.health, []);
let weightEntries = loadJSON(STORAGE_KEYS.weight, []);
let memories = loadJSON(STORAGE_KEYS.memories, []);

/* ============================================================
   DOM references
   ============================================================ */
const onboardingView = document.getElementById('onboarding-view');
const appView = document.getElementById('app-view');
const onboardingForm = document.getElementById('onboarding-form');

const headerAvatarImg = document.getElementById('header-avatar-img');
const headerAvatarFallback = document.getElementById('header-avatar-fallback');
const headerDogName = document.getElementById('header-dog-name');
const headerDogSub = document.getElementById('header-dog-sub');

const statGender = document.getElementById('stat-gender');

const routineForm = document.getElementById('routine-form');
const routineNoteInput = document.getElementById('routine-note');
const routineTypeRadios = Array.from(document.querySelectorAll('input[name="routine-type"]'));
const routineList = document.getElementById('routine-list');
const routineEmpty = document.getElementById('routine-empty');

const ROUTINE_NOTE_PLACEHOLDERS = {
  feeding: 'მაგ. საუზმე, 200გრ',
  walk: 'მაგ. 30 წუთი, პარკში'
};

function syncRoutineNotePlaceholder(){
  const checked = routineForm.querySelector('input[name="routine-type"]:checked');
  const type = checked ? checked.value : 'feeding';
  routineNoteInput.placeholder = ROUTINE_NOTE_PLACEHOLDERS[type] || '';
}

routineTypeRadios.forEach(radio => {
  radio.addEventListener('change', syncRoutineNotePlaceholder);
});

const healthForm = document.getElementById('health-form');
const healthList = document.getElementById('health-list');
const healthEmpty = document.getElementById('health-empty');

const weightForm = document.getElementById('weight-form');
const weightDateInput = document.getElementById('weight-date');
const weightValueInput = document.getElementById('weight-value');
const weightList = document.getElementById('weight-list');
const weightEmpty = document.getElementById('weight-empty');
const weightCurrentValue = document.getElementById('weight-current-value');
const weightDeltaEl = document.getElementById('weight-delta');
const weightSparklineLine = document.getElementById('weight-sparkline-line');
const weightSparklineDot = document.getElementById('weight-sparkline-dot');


const memoryForm = document.getElementById('memory-form');
const memoriesGrid = document.getElementById('memories-grid');
const memoriesEmpty = document.getElementById('memories-empty');

const exportBtn = document.getElementById('export-btn');
const resetBtn = document.getElementById('reset-btn');
const editProfileForm = document.getElementById('edit-profile-form');

const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
const navIndicator = document.getElementById('nav-indicator');
const tabPanels = {
  dashboard: document.getElementById('tab-dashboard'),
  health: document.getElementById('tab-health'),
  memories: document.getElementById('tab-memories'),
  settings: document.getElementById('tab-settings')
};

/* ============================================================
   View routing: onboarding vs app
   ============================================================ */
function renderRoot(){
  if(dog){
    onboardingView.classList.add('is-hidden');
    appView.classList.remove('is-hidden');
    renderDogHeader();
    renderDashboard();
    renderHealth();
    renderWeight();
    renderMemories();
    populateEditForm();
  }else{
    onboardingView.classList.remove('is-hidden');
    appView.classList.add('is-hidden');
  }
}

/* ============================================================
   Onboarding
   ============================================================ */
onboardingForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('dog-name').value.trim();
  const age = document.getElementById('dog-age').value.trim();
  const breed = document.getElementById('dog-breed').value.trim();
  const gender = document.getElementById('dog-gender').value;
  const photoInput = document.getElementById('dog-photo-input');

  if(!name || !age || !breed || !gender){
    return;
  }

  let photoDataUrl = '';
  if(photoInput.files && photoInput.files[0]){
    try{
      photoDataUrl = await compressImage(photoInput.files[0]);
    }catch(err){
      console.error('PetLog: photo read failed', err);
    }
  }

  dog = {
    name,
    age,
    breed,
    gender,
    photo: photoDataUrl,
    createdAt: Date.now()
  };

  if(saveJSON(STORAGE_KEYS.dog, dog)){
    renderRoot();
  }
});

/* ============================================================
   Header + dashboard rendering
   ============================================================ */
function renderDogHeader(){
  headerDogName.textContent = dog.name;
  headerDogSub.textContent = `${dog.breed} · ${dog.age} წლის`;
  statGender.textContent = GENDER_LABELS[dog.gender] || dog.gender;

  if(dog.photo){
    headerAvatarImg.src = dog.photo;
    headerAvatarImg.classList.remove('is-hidden');
    headerAvatarFallback.classList.add('is-hidden');
  }else{
    headerAvatarImg.classList.add('is-hidden');
    headerAvatarFallback.classList.remove('is-hidden');
  }
}

function renderDashboard(){
  renderRoutineList();
}

/* ============================================================
   Weekly Rhythm — new data feature.
   Looks at the last 7 days of routine entries and reports how
   many of them had BOTH a feeding and a walk logged, the current
   consecutive-day streak, and a day-by-day breakdown.
   ============================================================ */
const RHYTHM_RING_CIRCUMFERENCE = 2 * Math.PI * 52;
const RHYTHM_DAY_LABELS = ['კვ', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];

function dateKey(d){
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function computeWeeklyRhythm(){
  const today = new Date();
  const days = [];

  for(let i = 6; i >= 0; i--){
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);

    const dayEntries = routineEntries.filter(e => dateKey(new Date(e.timestamp)) === key);
    const hasFeeding = dayEntries.some(e => e.type === 'feeding');
    const hasWalk = dayEntries.some(e => e.type === 'walk');

    days.push({ date: d, complete: hasFeeding && hasWalk, hasFeeding, hasWalk });
  }

  const completeCount = days.filter(d => d.complete).length;
  const percent = Math.round((completeCount / days.length) * 100);

  // Streak counts consecutive complete days ending today. If today isn't
  // complete yet (the day may simply not be over), that alone shouldn't
  // zero out an otherwise ongoing streak, so we start counting from
  // yesterday in that case.
  let streak = 0;
  let cursor = days.length - 1;
  if(!days[cursor].complete) cursor -= 1;
  for(let i = cursor; i >= 0; i--){
    if(days[i].complete) streak++;
    else break;
  }

  return { days, completeCount, percent, streak };
}

function renderRhythm(){
  const ringEl = document.getElementById('rhythm-ring-progress');
  const percentEl = document.getElementById('rhythm-percent');
  const streakEl = document.getElementById('rhythm-streak');
  const daysEl = document.getElementById('rhythm-days');
  const weekEl = document.getElementById('rhythm-week');
  if(!ringEl || !weekEl) return;

  const { days, completeCount, percent, streak } = computeWeeklyRhythm();

  ringEl.style.strokeDasharray = `${RHYTHM_RING_CIRCUMFERENCE}`;
  // Start fully "empty" then animate to the real value on the next frame
  // so the ring draws in rather than snapping to its final state.
  ringEl.style.strokeDashoffset = `${RHYTHM_RING_CIRCUMFERENCE}`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const offset = RHYTHM_RING_CIRCUMFERENCE - (percent / 100) * RHYTHM_RING_CIRCUMFERENCE;
      ringEl.style.strokeDashoffset = `${offset}`;
    });
  });

  percentEl.textContent = `${percent}%`;
  streakEl.textContent = `${streak}`;
  daysEl.textContent = `${completeCount}/7`;

  weekEl.innerHTML = '';
  days.forEach(day => {
    const li = document.createElement('li');
    li.className = 'rhythm-day';
    if(day.complete){
      li.classList.add('is-complete');
    }else if(day.hasFeeding || day.hasWalk){
      li.classList.add('is-partial');
    }
    li.textContent = RHYTHM_DAY_LABELS[day.date.getDay()];
    li.title = formatDate(day.date.getTime());
    weekEl.appendChild(li);
  });
}

function renderRoutineList(){
  routineList.innerHTML = '';
  const sorted = [...routineEntries].sort((a, b) => b.timestamp - a.timestamp);

  if(sorted.length === 0){
    routineEmpty.classList.remove('is-hidden');
  }else{
    routineEmpty.classList.add('is-hidden');
    sorted.forEach(entry => {
      const li = document.createElement('li');

      const icon = document.createElement('span');
      icon.className = 'entry-icon';
      icon.innerHTML = entry.type === 'feeding' ? ICONS.feeding : ICONS.walk;

      const body = document.createElement('div');
      body.className = 'entry-body';
      const title = document.createElement('p');
      title.className = 'entry-title';
      title.textContent = entry.type === 'feeding' ? 'კვება' : 'გასეირნება';
      const meta = document.createElement('p');
      meta.className = 'entry-meta';
      meta.textContent = [entry.note, formatTime(entry.timestamp)].filter(Boolean).join(' · ');
      body.append(title, meta);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'entry-delete';
      del.setAttribute('aria-label', 'წაშლა');
      del.innerHTML = ICONS.close;
      del.addEventListener('click', () => {
        routineEntries = routineEntries.filter(r => r.id !== entry.id);
        saveJSON(STORAGE_KEYS.routine, routineEntries);
        renderRoutineList();
      });

      li.append(icon, body, del);
      routineList.appendChild(li);
    });
  }

  renderRhythm();
}

routineForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const type = routineForm.querySelector('input[name="routine-type"]:checked').value;
  const note = routineNoteInput.value.trim();

  routineEntries.push({ id: uid(), type, note, timestamp: Date.now() });
  if(saveJSON(STORAGE_KEYS.routine, routineEntries)){
    routineNoteInput.value = '';
    renderRoutineList();
  }
});

/* ============================================================
   Health records
   ============================================================ */
function renderHealth(){
  healthList.innerHTML = '';
  const sorted = [...healthRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

  if(sorted.length === 0){
    healthEmpty.classList.remove('is-hidden');
  }else{
    healthEmpty.classList.add('is-hidden');
    sorted.forEach(record => {
      const li = document.createElement('li');

      let iconEl;
      if(record.photo){
        iconEl = document.createElement('img');
        iconEl.className = 'entry-thumb';
        iconEl.src = record.photo;
        iconEl.alt = record.title;
      }else{
        iconEl = document.createElement('span');
        iconEl.className = 'entry-icon icon-health';
        iconEl.innerHTML = record.type === 'vaccination' ? ICONS.vaccination : (record.type === 'document' ? ICONS.document : ICONS.analysis);
      }

      const body = document.createElement('div');
      body.className = 'entry-body';
      const title = document.createElement('p');
      title.className = 'entry-title';
      title.textContent = record.title;
      const meta = document.createElement('p');
      meta.className = 'entry-meta';
      meta.textContent = [HEALTH_TYPE_LABELS[record.type], formatDate(record.date), record.note].filter(Boolean).join(' · ');
      body.append(title, meta);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'entry-delete';
      del.setAttribute('aria-label', 'წაშლა');
      del.innerHTML = ICONS.close;
      del.addEventListener('click', () => {
        healthRecords = healthRecords.filter(r => r.id !== record.id);
        saveJSON(STORAGE_KEYS.health, healthRecords);
        renderHealth();
      });

      li.append(iconEl, body, del);
      healthList.appendChild(li);
    });
  }
}

healthForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const type = document.getElementById('health-type').value;
  const title = document.getElementById('health-title').value.trim();
  const date = document.getElementById('health-date').value;
  const note = document.getElementById('health-note').value.trim();
  const fileInput = document.getElementById('health-file-input');

  if(!title || !date) return;

  let photoDataUrl = '';
  if(fileInput.files && fileInput.files[0]){
    try{
      photoDataUrl = await compressImage(fileInput.files[0]);
    }catch(err){
      console.error('PetLog: health photo read failed', err);
    }
  }

  healthRecords.push({ id: uid(), type, title, date, note, photo: photoDataUrl });
  if(saveJSON(STORAGE_KEYS.health, healthRecords)){
    healthForm.reset();
    renderHealth();
  }
});

/* ============================================================
   Weight tracking
   One entry per calendar day: saving again for a date that's
   already logged updates that day's value instead of creating a
   duplicate row. The summary shows the latest weight, its change
   vs the previous entry, and a small trend sparkline.
   ============================================================ */
function renderWeight(){
  const sorted = [...weightEntries].sort((a, b) => a.date.localeCompare(b.date));

  // ---- summary: latest value + delta vs previous entry ----
  if(sorted.length === 0){
    weightCurrentValue.textContent = '—';
    weightDeltaEl.className = 'weight-delta';
    weightDeltaEl.innerHTML = '<span class="weight-delta-text">ჯერ არ არის ჩანაწერი</span>';
  }else{
    const latest = sorted[sorted.length - 1];
    weightCurrentValue.textContent = latest.weightKg.toFixed(1).replace(/\.0$/, '');

    if(sorted.length === 1){
      weightDeltaEl.className = 'weight-delta';
      weightDeltaEl.innerHTML = `<span class="weight-delta-text">${formatDate(latest.date)}</span>`;
    }else{
      const prev = sorted[sorted.length - 2];
      const diff = latest.weightKg - prev.weightKg;
      const diffAbs = Math.abs(diff).toFixed(1);
      if(Math.abs(diff) < 0.05){
        weightDeltaEl.className = 'weight-delta';
        weightDeltaEl.innerHTML = '<span class="weight-delta-text">უცვლელი წინაზე</span>';
      }else if(diff > 0){
        weightDeltaEl.className = 'weight-delta is-up';
        weightDeltaEl.innerHTML = `${ICONS.arrowUp}<span class="weight-delta-text">${diffAbs} კგ წინაზე</span>`;
      }else{
        weightDeltaEl.className = 'weight-delta is-down';
        weightDeltaEl.innerHTML = `${ICONS.arrowDown}<span class="weight-delta-text">${diffAbs} კგ წინაზე</span>`;
      }
    }
  }

  // ---- sparkline: last up-to-14 entries, normalized into the viewBox ----
  const trend = sorted.slice(-14);
  if(trend.length < 2){
    weightSparklineLine.setAttribute('points', '');
    weightSparklineDot.setAttribute('cx', '-10');
  }else{
    const values = trend.map(e => e.weightKg);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = 240, h = 56, padY = 8;
    const points = trend.map((e, i) => {
      const x = trend.length === 1 ? 0 : (i / (trend.length - 1)) * w;
      const y = h - padY - ((e.weightKg - min) / range) * (h - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    weightSparklineLine.setAttribute('points', points.join(' '));
    const [lastX, lastY] = points[points.length - 1].split(',');
    weightSparklineDot.setAttribute('cx', lastX);
    weightSparklineDot.setAttribute('cy', lastY);
  }

  // ---- history list, most recent first ----
  weightList.innerHTML = '';
  const historyDesc = [...sorted].reverse();

  if(historyDesc.length === 0){
    weightEmpty.classList.remove('is-hidden');
  }else{
    weightEmpty.classList.add('is-hidden');
    historyDesc.forEach((entry, i) => {
      const li = document.createElement('li');

      const icon = document.createElement('span');
      icon.className = 'entry-icon';
      icon.innerHTML = ICONS.weight;

      const body = document.createElement('div');
      body.className = 'entry-body';
      const title = document.createElement('p');
      title.className = 'entry-title';
      title.textContent = `${entry.weightKg.toFixed(1).replace(/\.0$/, '')} კგ`;
      const meta = document.createElement('p');
      meta.className = 'entry-meta';

      const older = historyDesc[i + 1];
      let metaText = formatDate(entry.date);
      if(older){
        const diff = entry.weightKg - older.weightKg;
        if(Math.abs(diff) >= 0.05){
          metaText += ` · ${diff > 0 ? '+' : ''}${diff.toFixed(1)} კგ`;
        }
      }
      meta.textContent = metaText;
      body.append(title, meta);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'entry-delete';
      del.setAttribute('aria-label', 'წაშლა');
      del.innerHTML = ICONS.close;
      del.addEventListener('click', () => {
        weightEntries = weightEntries.filter(w => w.id !== entry.id);
        saveJSON(STORAGE_KEYS.weight, weightEntries);
        renderWeight();
      });

      li.append(icon, body, del);
      weightList.appendChild(li);
    });
  }
}

weightForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const date = weightDateInput.value;
  const weightKg = parseFloat(weightValueInput.value);

  if(!date || isNaN(weightKg)) return;

  const existing = weightEntries.find(w => w.date === date);
  if(existing){
    existing.weightKg = weightKg;
    existing.timestamp = Date.now();
  }else{
    weightEntries.push({ id: uid(), date, weightKg, timestamp: Date.now() });
  }

  if(saveJSON(STORAGE_KEYS.weight, weightEntries)){
    weightValueInput.value = '';
    renderWeight();
  }
});

/* ============================================================
   Memories gallery
   ============================================================ */
function renderMemories(){
  memoriesGrid.innerHTML = '';
  const sorted = [...memories].sort((a, b) => b.timestamp - a.timestamp);

  if(sorted.length === 0){
    memoriesEmpty.classList.remove('is-hidden');
  }else{
    memoriesEmpty.classList.add('is-hidden');
    sorted.forEach(mem => {
      const fig = document.createElement('figure');

      const img = document.createElement('img');
      img.src = mem.photo;
      img.alt = mem.caption || 'ძაღლის მოგონება';
      fig.appendChild(img);

      if(mem.caption){
        const cap = document.createElement('figcaption');
        cap.textContent = mem.caption;
        fig.appendChild(cap);
      }

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'memory-delete';
      del.setAttribute('aria-label', 'წაშლა');
      del.innerHTML = ICONS.close;
      del.addEventListener('click', () => {
        memories = memories.filter(m => m.id !== mem.id);
        saveJSON(STORAGE_KEYS.memories, memories);
        renderMemories();
      });

      fig.appendChild(del);
      memoriesGrid.appendChild(fig);
    });
  }
}

memoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById('memory-photo-input');
  const caption = document.getElementById('memory-caption').value.trim();

  if(!fileInput.files || !fileInput.files[0]) return;

  try{
    const photoDataUrl = await compressImage(fileInput.files[0]);
    memories.push({ id: uid(), photo: photoDataUrl, caption, timestamp: Date.now() });
    if(saveJSON(STORAGE_KEYS.memories, memories)){
      memoryForm.reset();
      renderMemories();
    }
  }catch(err){
    console.error('PetLog: memory photo read failed', err);
  }
});

/* ============================================================
   Settings — profile edit / export / reset
   ============================================================ */
function populateEditForm(){
  document.getElementById('edit-dog-name').value = dog.name;
  document.getElementById('edit-dog-age').value = dog.age;
  document.getElementById('edit-dog-breed').value = dog.breed;
  document.getElementById('edit-dog-gender').value = dog.gender;
}

editProfileForm.addEventListener('submit', (e) => {
  e.preventDefault();
  dog.name = document.getElementById('edit-dog-name').value.trim();
  dog.age = document.getElementById('edit-dog-age').value.trim();
  dog.breed = document.getElementById('edit-dog-breed').value.trim();
  dog.gender = document.getElementById('edit-dog-gender').value;

  if(saveJSON(STORAGE_KEYS.dog, dog)){
    renderDogHeader();
    renderDashboard();
  }
});

exportBtn.addEventListener('click', () => {
  const backup = {
    exportedAt: new Date().toISOString(),
    dog,
    routineEntries,
    healthRecords,
    weightEntries,
    memories
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (dog?.name || 'petlog').replace(/[^a-zA-Z0-9а-ჿ_-]/g, '_');
  a.href = url;
  a.download = `petlog-backup-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

resetBtn.addEventListener('click', () => {
  const confirmed = confirm('დარწმუნებული ხართ? ეს წაშლის ყველა ჩანაწერს, ფოტოსა და პროფილს სამუდამოდ.');
  if(!confirmed) return;

  Object.values(STORAGE_KEYS).forEach(key => safeRemoveItem(key));
  dog = null;
  routineEntries = [];
  healthRecords = [];
  weightEntries = [];
  memories = [];
  onboardingForm.reset();
  renderRoot();
});

/* ============================================================
   Bottom navigation
   ============================================================ */
function activateTab(tabName){
  Object.entries(tabPanels).forEach(([name, panel]) => {
    panel.classList.toggle('is-hidden', name !== tabName);
  });

  const index = navButtons.findIndex(btn => btn.dataset.tab === tabName);
  navButtons.forEach((btn, i) => btn.classList.toggle('is-active', i === index));

  if(index >= 0){
    navIndicator.style.transform = `translateX(${index * 100}%)`;
  }
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

/* ============================================================
   Service worker registration (offline support)
   ============================================================ */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.error('PetLog: service worker registration failed', err);
    });
  });
}

/* ============================================================
   Theme toggle — logo as the master dark/light switch
   A saved choice is already applied to <html> by the tiny inline
   script in <head> (so there's no flash-of-wrong-theme on load);
   this block just keeps that in sync going forward and wires the
   click targets. Preference is persisted via the same safe
   storage helpers as the rest of the app's data, so it degrades
   the same way (in-memory only) if localStorage is unavailable.
   ============================================================ */
function getStoredTheme(){
  const value = safeGetItem(STORAGE_KEYS.theme);
  return (value === 'light' || value === 'dark') ? value : null;
}

function currentTheme(){
  return getStoredTheme() ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function applyTheme(theme, { persist = true } = {}){
  document.documentElement.setAttribute('data-theme', theme);
  if(persist) safeSetItem(STORAGE_KEYS.theme, theme);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  if(toggleBtn) toggleBtn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');

  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', theme === 'dark' ? '#1B1C22' : '#7C5CFC');
}

function toggleTheme(){
  const next = currentTheme() === 'dark' ? 'light' : 'dark';

  // Briefly widen every element's transition so the whole UI
  // crossfades together, then drop it again so normal hover/press
  // transitions aren't permanently affected.
  document.documentElement.classList.add('theme-transition');
  window.clearTimeout(toggleTheme._cleanupTimer);
  toggleTheme._cleanupTimer = window.setTimeout(() => {
    document.documentElement.classList.remove('theme-transition');
  }, 500);

  applyTheme(next);
}

function wireThemeToggle(){
  // Make sure whatever the inline <head> script (or OS default)
  // landed on is fully reflected — including the toggle-button
  // icon state and the theme-color meta tag — once the DOM exists.
  applyTheme(currentTheme(), { persist: false });

  const toggleBtn = document.getElementById('theme-toggle-btn');
  if(toggleBtn) toggleBtn.addEventListener('click', toggleTheme);

  // The onboarding logo doubles as the same switch before a profile
  // has been created yet (the splash logo is on-screen too briefly
  // to be worth wiring).
  const onboardingLogo = document.querySelector('#onboarding-view .logo-figure');
  if(onboardingLogo) onboardingLogo.addEventListener('click', toggleTheme);

  // If the OS theme changes while no manual choice has been saved,
  // follow it live instead of freezing on whatever it was at load.
  if(window.matchMedia){
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if(!getStoredTheme()) applyTheme(e.matches ? 'dark' : 'light', { persist: false });
    });
  }
}

wireThemeToggle();

/* ============================================================
   Splash screen
   A short orchestrated loading sequence: the wordmark reveals
   letter-by-letter, a status line steps through a couple of stages,
   and a determinate progress bar fills in step with them — instead
   of a generic infinite spinner.
   ============================================================ */
const splashScreen = document.getElementById('splash-screen');
const splashTitle = document.getElementById('splash-title');
const splashStatus = document.getElementById('splash-status');
const splashFill = document.getElementById('splash-progress-fill');

if(splashTitle){
  const word = splashTitle.textContent.trim();
  splashTitle.textContent = '';
  splashTitle.setAttribute('aria-label', word);
  word.split('').forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'letter';
    span.textContent = ch;
    span.style.animationDelay = `${0.35 + i * 0.05}s`;
    splashTitle.appendChild(span);
  });
}

const SPLASH_STAGES = [
  { at: 0,    pct: 18,  text: 'თქვენი ძაღლის სივრცე იტვირთება' },
  { at: 700,  pct: 55,  text: 'პროფილის მონაცემები მზადდება' },
  { at: 1400, pct: 88,  text: 'თითქმის მზადაა' },
  { at: 1900, pct: 100, text: 'მზადაა' }
];

SPLASH_STAGES.forEach((stage) => {
  window.setTimeout(() => {
    if(splashFill) splashFill.style.width = stage.pct + '%';
    if(splashStatus) splashStatus.textContent = stage.text;
  }, stage.at);
});

window.setTimeout(() => {
  if(splashScreen){
    splashScreen.classList.add('splash-screen--hidden');
  }
}, 2300);

function attachLogoFallback(img){
  if(!img) return;
  const reveal = () => {
    const wrap = img.closest('figure');
    if(wrap) wrap.classList.add('img-load-failed');
  };
  // If the image already failed before this listener attached (e.g. cached
  // 404), naturalWidth will be 0 once complete.
  if(img.complete && img.naturalWidth === 0){
    reveal();
  }else{
    img.addEventListener('error', reveal, { once: true });
  }
}

/* Custom file picker display — native file inputs render "Choose File /
   no file selected" with browser/OS chrome that can't be themed and
   clashes hard with a dark UI. The input itself is visually hidden (but
   still the real, functional control); this only keeps its label in
   sync with what's actually selected. */
function wireFilePicker(inputId){
  const input = document.getElementById(inputId);
  if(!input) return;
  const wrapper = input.closest('.field-photo');
  const textEl = wrapper ? wrapper.querySelector('.field-hint-text') : null;
  if(!wrapper || !textEl) return;
  const defaultText = textEl.dataset.default || textEl.textContent;

  input.addEventListener('change', () => {
    if(input.files && input.files[0]){
      wrapper.classList.add('has-file');
      textEl.textContent = input.files[0].name;
    }else{
      wrapper.classList.remove('has-file');
      textEl.textContent = defaultText;
    }
  });

  const form = input.closest('form');
  if(form){
    form.addEventListener('reset', () => {
      window.setTimeout(() => {
        wrapper.classList.remove('has-file');
        textEl.textContent = defaultText;
      }, 0);
    });
  }
}

/* ============================================================
   Init
   ============================================================ */
attachLogoFallback(document.getElementById('splash-logo-img'));
attachLogoFallback(document.getElementById('onboarding-logo-img'));
wireFilePicker('dog-photo-input');
wireFilePicker('health-file-input');
wireFilePicker('memory-photo-input');
document.getElementById('health-date').valueAsDate = new Date();
document.getElementById('weight-date').valueAsDate = new Date();
syncRoutineNotePlaceholder();
renderRoot();
activateTab('dashboard');