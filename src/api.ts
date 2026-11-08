import { ageMonths } from "./dates";
import { db } from "./supabase";
import type {
  Booth,
  Memory,
  Mood,
  Pet,
  PetData,
  PetInput,
  Profile,
  RoutePoint,
  Vaccination,
  VetContact,
  Voucher,
  WalkSession,
} from "./types";

async function ownerId(): Promise<string> {
  const { data, error } = await db().auth.getUser();
  if (error) throw error;
  if (!data.user?.email_confirmed_at)
    throw new Error("USER:ჯერ დაადასტურე შენი ელფოსტა.");
  return data.user.id;
}
async function readAll<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query(offset, offset + 499);
    if (error) throw error;
    rows.push(...((data || []) as T[]));
    if (!data || data.length < 500) return rows;
  }
}
export async function getPets(): Promise<Pet[]> {
  const owner = await ownerId();
  return readAll<Pet>((from, to) =>
    db()
      .from("pets")
      .select("*")
      .eq("owner_id", owner)
      .order("created_at")
      .order("id")
      .range(from, to),
  );
}
export async function getProfile(): Promise<Profile | null> {
  const owner = await ownerId();
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .eq("id", owner)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}
export async function saveProfile(displayName: string): Promise<void> {
  const owner = await ownerId();
  const { error } = await db()
    .from("profiles")
    .upsert({ id: owner, display_name: displayName.trim() });
  if (error) throw error;
}
export async function uploadPhoto(
  file: File,
  folder: "pets" | "memories",
): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024 ||
    file.size === 0
  )
    throw new Error("USER:აირჩიე JPG, PNG ან WebP ფოტო, მაქსიმუმ 8 მბ.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("USER:სურათი ვერ გაიხსნა. აირჩიე სხვა ფოტო.");
  }
  const valid =
    bitmap.width > 0 &&
    bitmap.height > 0 &&
    bitmap.width * bitmap.height <= 64_000_000;
  bitmap.close();
  if (!valid)
    throw new Error(
      "USER:ფოტოს ზომა მეტისმეტად დიდია. აირჩიე 64 მეგაპიქსელზე მცირე ფოტო.",
    );
  const owner = await ownerId();
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
    file.type
  ];
  const path = `${owner}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db().storage.from("pet-media").upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}
export async function removePhoto(path: string): Promise<void> {
  const { error } = await db().storage.from("pet-media").remove([path]);
  if (error) throw error;
}
export async function signedPhoto(path: string): Promise<string> {
  const { data, error } = await db()
    .storage.from("pet-media")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function savePet(
  input: PetInput,
  file: File | null,
  previous?: Pet,
): Promise<Pet> {
  const owner = await ownerId();
  const path = file ? await uploadPhoto(file, "pets") : previous?.photo_path;
  if (!path) throw new Error("USER:დაამატე შენი მეგობრის რეალური ფოტო.");
  const payload = {
    ...input,
    name: input.name.trim(),
    breed: input.breed.trim(),
    microchip: input.microchip?.trim() || null,
    owner_id: owner,
    photo_path: path,
  };
  const query = previous
    ? db()
        .from("pets")
        .update(payload)
        .eq("id", previous.id)
        .eq("owner_id", owner)
    : db().from("pets").insert(payload);
  const { data, error } = await query.select().single();
  if (error) {
    if (file) await removePhoto(path).catch(() => undefined);
    throw error;
  }
  if (file && previous?.photo_path)
    await removePhoto(previous.photo_path).catch(() => undefined);
  return data as Pet;
}
export async function deletePet(pet: Pet): Promise<void> {
  const owner = await ownerId();
  const memories = await readAll<{ photo_path: string }>((from, to) =>
    db()
      .from("memories")
      .select("photo_path")
      .eq("pet_id", pet.id)
      .eq("owner_id", owner)
      .order("id")
      .range(from, to),
  );
  const { data, error } = await db()
    .from("pets")
    .delete()
    .eq("id", pet.id)
    .eq("owner_id", owner)
    .select("id")
    .single();
  if (error || !data) throw error || new Error("USER:ჩანაწერი ვერ მოიძებნა.");
  await Promise.all(
    [
      pet.photo_path,
      ...(memories || []).map((item) => item.photo_path as string),
    ].map((path) => removePhoto(path).catch(() => undefined)),
  );
}
export async function getPetData(petId: string): Promise<PetData> {
  const owner = await ownerId();
  const results = await Promise.all([
    readAll<Vaccination>((from, to) =>
      db()
        .from("vaccinations")
        .select("*")
        .eq("owner_id", owner)
        .eq("pet_id", petId)
        .order("administered_on", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    readAll<VetContact>((from, to) =>
      db()
        .from("vet_contacts")
        .select("*")
        .eq("owner_id", owner)
        .eq("pet_id", petId)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    readAll<Memory>((from, to) =>
      db()
        .from("memories")
        .select("*")
        .eq("owner_id", owner)
        .eq("pet_id", petId)
        .order("taken_on", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    readAll<Omit<WalkSession, "route">>((from, to) =>
      db()
        .from("walk_sessions")
        .select(
          "id,owner_id,pet_id,mood,started_at,ended_at,distance_m,paw_coins",
        )
        .eq("owner_id", owner)
        .eq("pet_id", petId)
        .order("started_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    readAll<Voucher>((from, to) =>
      db()
        .from("user_vouchers")
        .select("*")
        .eq("owner_id", owner)
        .eq("pet_id", petId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    db()
      .from("walk_sessions")
      .select("*")
      .eq("owner_id", owner)
      .is("ended_at", null)
      .maybeSingle(),
  ]);
  if (results[5].error) throw results[5].error;
  const activeWalk = results[5].data as WalkSession | null;
  return {
    vaccinations: results[0],
    vets: results[1],
    memories: results[2],
    walks: results[3].map((walk) => ({
      ...walk,
      route: activeWalk?.id === walk.id ? activeWalk.route : [],
    })),
    vouchers: results[4],
    activeWalk,
  };
}
export async function getWalk(id: string): Promise<WalkSession> {
  const owner = await ownerId();
  const { data, error } = await db()
    .from("walk_sessions")
    .select("*")
    .eq("id", id)
    .eq("owner_id", owner)
    .single();
  if (error) throw error;
  return data as WalkSession;
}
type HealthInput = Omit<Vaccination, "id" | "owner_id" | "created_at">;
type VetInput = Omit<VetContact, "id" | "owner_id" | "created_at">;
export async function saveVaccination(
  input: HealthInput,
  id?: string,
): Promise<void> {
  const owner = await ownerId();
  const payload = { ...input, owner_id: owner };
  const query = id
    ? db()
        .from("vaccinations")
        .update(payload)
        .eq("id", id)
        .eq("owner_id", owner)
    : db().from("vaccinations").insert(payload);
  const { error } = await query.select("id").single();
  if (error) throw error;
}
export async function saveVet(input: VetInput, id?: string): Promise<void> {
  const owner = await ownerId();
  const payload = { ...input, owner_id: owner };
  const query = id
    ? db()
        .from("vet_contacts")
        .update(payload)
        .eq("id", id)
        .eq("owner_id", owner)
    : db().from("vet_contacts").insert(payload);
  const { error } = await query.select("id").single();
  if (error) throw error;
}
export async function deleteRecord(
  table: "vaccinations" | "vet_contacts" | "memories",
  id: string,
): Promise<void> {
  const owner = await ownerId();
  const { error } = await db()
    .from(table)
    .delete()
    .eq("id", id)
    .eq("owner_id", owner)
    .select("id")
    .single();
  if (error) throw error;
}
export async function saveMemory(
  input: { pet_id: string; caption: string; taken_on: string },
  file: File | null,
  previous?: Memory,
): Promise<void> {
  const owner = await ownerId();
  const path = file
    ? await uploadPhoto(file, "memories")
    : previous?.photo_path;
  if (!path) throw new Error("USER:ჯერ აირჩიე ფოტო.");
  const payload = { ...input, owner_id: owner, photo_path: path };
  const query = previous
    ? db()
        .from("memories")
        .update(payload)
        .eq("id", previous.id)
        .eq("owner_id", owner)
    : db().from("memories").insert(payload);
  const { error } = await query.select("id").single();
  if (error) {
    if (file) await removePhoto(path).catch(() => undefined);
    throw error;
  }
  if (file && previous?.photo_path)
    await removePhoto(previous.photo_path).catch(() => undefined);
}
export async function getBooths(pet: Pet): Promise<Booth[]> {
  await ownerId();
  const data = await readAll<Booth>((from, to) =>
    db()
      .from("partner_booths")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
  const age = ageMonths(pet.birth_date);
  const now = Date.now();
  return (data as Booth[]).filter(
    (booth) =>
      (!booth.species.length || booth.species.includes(pet.species)) &&
      (!booth.breeds.length ||
        booth.breeds.some(
          (breed) =>
            breed.toLocaleLowerCase("ka-GE") ===
            pet.breed.toLocaleLowerCase("ka-GE"),
        )) &&
      age >= booth.min_age_months &&
      (booth.max_age_months === null || age <= booth.max_age_months) &&
      Date.parse(booth.starts_at) <= now &&
      (!booth.expires_at || Date.parse(booth.expires_at) > now),
  );
}
export async function claimVoucher(
  boothId: string,
  petId: string,
): Promise<Voucher> {
  await ownerId();
  const { data, error } = await db().rpc("claim_voucher", {
    p_booth_id: boothId,
    p_pet_id: petId,
  });
  if (error) throw error;
  const voucher = Array.isArray(data) ? data[0] : data;
  if (!voucher?.id || typeof voucher.code !== "string")
    throw new Error("Voucher response is incomplete");
  return voucher as Voucher;
}
export async function cancelVoucher(id: string): Promise<void> {
  const owner = await ownerId();
  const { error } = await db()
    .from("user_vouchers")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("owner_id", owner)
    .eq("status", "active")
    .select("id")
    .single();
  if (error) throw error;
}
export async function applyForBooth(input: {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  category: "clinic" | "shop";
  message: string;
}): Promise<void> {
  const owner = await ownerId();
  const { error } = await db()
    .from("partner_applications")
    .insert({ ...input, owner_id: owner });
  if (error) throw error;
}
export async function startWalk(
  petId: string,
  mood: Mood,
): Promise<WalkSession> {
  const owner = await ownerId();
  const { data, error } = await db()
    .from("walk_sessions")
    .insert({ owner_id: owner, pet_id: petId, mood })
    .select()
    .single();
  if (error) throw error;
  return data as WalkSession;
}
export async function updateWalk(
  id: string,
  route: RoutePoint[],
  finish = false,
): Promise<WalkSession> {
  const owner = await ownerId();
  const { data, error } = await db()
    .from("walk_sessions")
    .update({
      route,
      ...(finish ? { ended_at: new Date().toISOString() } : {}),
    })
    .eq("id", id)
    .eq("owner_id", owner)
    .is("ended_at", null)
    .select()
    .single();
  if (error) throw error;
  return data as WalkSession;
}
export async function deleteWalk(id: string): Promise<void> {
  const owner = await ownerId();
  const { error } = await db()
    .from("walk_sessions")
    .delete()
    .eq("id", id)
    .eq("owner_id", owner)
    .select("id")
    .single();
  if (error) throw error;
}
