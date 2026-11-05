import { emptyState, type State } from './types';

// Accept only validated phone numbers in actionable contact links.
export function phoneHref(value: string): string | null {
  const match = /^(\+?[\d\s().-]+?)(?:\s*(?:ext\.?|x|#)\s*(\d{1,6}))?$/i.exec(value.trim());
  if (!match) return null;
  const number = match[1].replace(/[\s().-]/g, '');
  return /^\+?\d{3,15}$/.test(number) ? `tel:${number}${match[2] ? `;ext=${match[2]}` : ''}` : null;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || 'მოთხოვნა ვერ შესრულდა. სცადე ხელახლა.');
  return result;
}
export const json = (method: string, value: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });

export async function restoreBackup(file: File, restore: (state: State) => Promise<void>) {
  const backup = JSON.parse(await file.text()) as { state?: State; media?: { url: string; data: string }[] } & Partial<State>;
  const source = backup.state || (Object.hasOwn(backup, 'dog') ? Object.fromEntries(Object.keys(emptyState()).filter(key => Object.hasOwn(backup, key)).map(key => [key, backup[key as keyof State]])) as Partial<State> : null);
  if (!source || typeof source !== 'object' || (source.memories !== undefined && !Array.isArray(source.memories)) || !Array.isArray(backup.media || [])) throw new Error('სარეზერვო ფაილი არასწორია.');
  const state = structuredClone(source) as State;
  const uploaded: string[] = [];
  try {
    for (const item of backup.media || []) {
      if (!/^\/api\/media\/[a-f0-9]{32}$/.test(item.url) || !/^data:video\/(mp4|webm);base64,/.test(item.data)) throw new Error('ვიდეოს მონაცემები არასწორია.');
      const blob = await (await fetch(item.data)).blob();
      const result = await request<{ url: string }>('/api/media', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
      uploaded.push(result.url);
      state.memories = (state.memories || []).map(memory => memory.videoUrl === item.url ? { ...memory, videoUrl: result.url } : memory);
    }
    await restore(state);
  } catch (error) {
    await Promise.all(uploaded.map(url => request(url, { method: 'DELETE' }).catch(() => undefined)));
    throw error;
  }
}

export function legacyState(): State | null {
  const mapping: Partial<Record<keyof State, string>> = {
    dog: 'petlog.dog', routineEntries: 'petlog.routine', healthRecords: 'petlog.health',
    weightEntries: 'petlog.weight', memories: 'petlog.memories', walkSpots: 'petlog.walk-spots'
  };
  const state = emptyState();
  try {
    for (const [collection, key] of Object.entries(mapping) as [keyof State, string][]) {
      const raw = localStorage.getItem(key);
      if (raw) Object.assign(state, { [collection]: JSON.parse(raw) });
    }
    return state.dog || Object.entries(state).some(([key, value]) => key !== 'dog' && Array.isArray(value) && value.length) ? state : null;
  } catch { return null; }
}
export function clearLegacy() {
  for (const key of ['petlog.dog','petlog.routine','petlog.health','petlog.weight','petlog.memories','petlog.walk-spots']) {
    try { localStorage.removeItem(key); } catch { /* optional cache */ }
  }
}

export async function imageData(file: File, size = 1200): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('აირჩიე სურათი.');
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, size / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const context = canvas.getContext('2d');
      if (!context) { URL.revokeObjectURL(url); reject(new Error('სურათი ვერ დამუშავდა.')); return; }
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', .72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('სურათი ვერ ჩაიტვირთა.')); };
    img.src = url;
  });
}
