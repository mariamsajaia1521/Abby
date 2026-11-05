import type { Dog } from './types';

const months = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const shortMonths = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const weekdays = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
const shortWeekdays = ['კვ', 'ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა'];

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return year > 0 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

// Explicit Georgian labels also work in browsers without Georgian ICU data.
export function formatDate(value: string | number, options: { year?: boolean; short?: boolean } = {}): string {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? calendarDate(value) : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return 'თარიღი უცნობია';
  return `${date.getDate()} ${(options.short ? shortMonths : months)[date.getMonth()]}${options.year ? `, ${date.getFullYear()}` : ''}`;
}

export const monthLabel = (date: Date): string => `${months[date.getMonth()]} ${date.getFullYear()}`;
export const weekdayLabel = (date: Date, short = false): string => (short ? shortWeekdays : weekdays)[date.getDay()];

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function ageLabel(dog: Dog): string {
  const birth = calendarDate(dog.birthDate ?? '');
  const now = new Date();
  if (!birth || birth > now) {
    const age = dog.age?.trim();
    return age ? (/^\d+(?:[.,]\d+)?$/.test(age) ? `${age} წლის` : age) : 'ასაკი დასამატებელია';
  }
  const monthsOld = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth() - (now.getDate() < birth.getDate() ? 1 : 0);
  if (monthsOld >= 12) return `${Math.floor(monthsOld / 12)} წლის${monthsOld % 12 ? ` · ${monthsOld % 12} თვის` : ''}`;
  if (monthsOld > 0) return `${monthsOld} თვის`;
  const days = Math.max(0, Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(birth.getFullYear(), birth.getMonth(), birth.getDate())) / 86_400_000));
  return days === 0 ? 'დღეს დაიბადა' : `${days} დღის`;
}
