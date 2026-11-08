import { createClient } from "@supabase/supabase-js";

// Supabase publishable keys are public browser credentials, protected by RLS.
const url =
  import.meta.env.VITE_SUPABASE_URL?.trim() ||
  "https://jrenzzdmqjpumsmmxsft.supabase.co";
const key =
  (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )?.trim() || "sb_publishable_O2sD4Y5MnT_gDTv8EEBcTQ_ETFI1IvR";
function browserKey(value: string): boolean {
  if (value.startsWith("sb_publishable_")) return true;
  try {
    return (
      JSON.parse(
        atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ).role === "anon"
    );
  } catch {
    return false;
  }
}
export const isConfigured = Boolean(
  url &&
  /^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url) &&
  key &&
  browserKey(key),
);
export const supabase = isConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;
export function db() {
  if (!supabase)
    throw new Error(
      "სერვისთან კავშირი ჯერ არ არის გამართული. გთხოვ, მოგვიანებით სცადო.",
    );
  return supabase;
}
export const authRedirect = () =>
  new URL(import.meta.env.BASE_URL, window.location.origin).href;

export function errorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "";
  if (/Invalid login credentials/i.test(message))
    return "ელფოსტა ან პაროლი არასწორია.";
  if (/Email not confirmed/i.test(message))
    return "ჯერ დაადასტურე შენი ელფოსტა.";
  if (/already registered|already been registered/i.test(message))
    return "ეს ელფოსტა უკვე რეგისტრირებულია. სცადე შესვლა.";
  if (/rate limit|too many requests|after .*seconds/i.test(message))
    return "მოთხოვნები ძალიან სწრაფად იგზავნება. ცოტა ხანში სცადე ხელახლა.";
  if (/expired|invalid.*token|token.*invalid|otp_expired/i.test(message))
    return "კოდი არასწორია ან ვადა გაუვიდა. მოითხოვე ახალი კოდი.";
  if (/weak.*password|password.*least/i.test(message))
    return "აირჩიე უფრო ძლიერი პაროლი, მინიმუმ 12 სიმბოლოთი.";
  if (/fetch|network|offline/i.test(message))
    return "კავშირი ვერ დამყარდა. გადაამოწმე ინტერნეტი და სცადე ხელახლა.";
  if (/one_active_walk_per_owner/i.test(message))
    return "შენს ანგარიშში მიმდინარე სეირნობა უკვე არის. განაახლე გვერდი და გააგრძელე შენახული მარშრუტი.";
  if (/duplicate key|23505/i.test(message))
    return "ეს ჩანაწერი უკვე შენახულია.";
  if (/row-level security|42501|permission denied/i.test(message))
    return "ამ მოქმედებისთვის საჭიროა დადასტურებული ანგარიში და შესაბამისი წვდომა.";
  if (/schema cache|relation .*does not exist|PGRST/i.test(message))
    return "სერვისი ჯერ მზად არ არის. გთხოვ, მოგვიანებით სცადო.";
  if (/voucher.*(expired|unavailable|limit)|offer unavailable/i.test(message))
    return "შეთავაზება ამოიწურა ან ამ მეგობრისთვის არ არის ხელმისაწვდომი.";
  if (error instanceof Error && message.startsWith("USER:"))
    return message.slice(5);
  return "მოქმედება ვერ შესრულდა. შენახული მონაცემები არ შეცვლილა. სცადე ხელახლა.";
}
