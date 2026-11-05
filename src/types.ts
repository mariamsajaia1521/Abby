import { formatDate } from './dates';

export type Dog = { name: string; breed: string; age: string; gender: 'male' | 'female'; photo?: string; createdAt?: number; species?: string; birthDate?: string; microchip?: string; sterilization?: 'unknown' | 'yes' | 'no'; sterilizationDate?: string; allergies?: string; conditions?: string; emergencyContact?: string };
export type Vet = { name: string; clinic: string; phone: string; emergencyPhone: string; address: string; email: string; notes: string };
export type Reminder = { id: string; title: string; category: 'appointment' | 'vaccination' | 'medication' | 'prevention' | 'followup'; date: string; notes: string; status: 'open' | 'done'; recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'; createdAt: number; anchorDay?: number };
export type Routine = { id: string; type: 'feeding' | 'walk'; note: string; timestamp: number };
export type Health = { id: string; type: 'analysis' | 'vaccination' | 'document' | 'visit' | 'medication' | 'prevention' | 'surgery'; title: string; date: string; note: string; photo?: string };
export type Weight = { id: string; date: string; weightKg: number; timestamp: number };
export type Memory = { id: string; caption: string; timestamp: number; photo?: string; videoUrl?: string };
export type WalkSpot = { id: string; name: string; lat: number; lng: number; createdAt: number };
export type State = {
  dog: Dog | null;
  routineEntries: Routine[];
  healthRecords: Health[];
  weightEntries: Weight[];
  memories: Memory[];
  walkSpots: WalkSpot[];
  vet: Vet | null;
  reminders: Reminder[];
};
export type Collection = keyof State;
export type User = { id: string; email: string };
export type Page = 'overview' | 'profile' | 'health' | 'plan' | 'vet' | 'emergency' | 'settings';
export type PageIntent = 'health-record' | 'weight' | 'reminder';
export type Navigate = (page: Page, intent?: PageIntent) => void;
export const emptyState = (): State => ({ dog: null, routineEntries: [], healthRecords: [], weightEntries: [], memories: [], walkSpots: [], vet: null, reminders: [] });
export const uid = () => crypto.randomUUID();
export const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
export const dateLabel = (date: string | number) => formatDate(date, { short: true });
