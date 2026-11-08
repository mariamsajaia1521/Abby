export type Species = "dog" | "cat";
export type Gender = "female" | "male";
export type Mood = "friendly" | "cautious";
export type Page =
  "overview" | "health" | "memories" | "club" | "walk" | "profile";
export type Pet = {
  id: string;
  owner_id: string;
  name: string;
  species: Species;
  gender: Gender;
  breed: string;
  birth_date: string;
  weight_kg: number;
  microchip: string | null;
  photo_path: string;
  created_at: string;
};
export type PetInput = Omit<
  Pet,
  "id" | "owner_id" | "photo_path" | "created_at"
>;
export type Vaccination = {
  id: string;
  owner_id: string;
  pet_id: string;
  name: string;
  administered_on: string;
  due_on: string | null;
  clinic: string;
  notes: string;
  created_at: string;
};
export type VetContact = {
  id: string;
  owner_id: string;
  pet_id: string;
  name: string;
  clinic: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
};
export type Memory = {
  id: string;
  owner_id: string;
  pet_id: string;
  caption: string;
  photo_path: string;
  taken_on: string;
  created_at: string;
};
export type Booth = {
  id: string;
  name: string;
  category: "clinic" | "shop";
  title: string;
  description: string;
  image_url: string | null;
  website: string | null;
  address: string;
  offer_label: string;
  species: Species[];
  breeds: string[];
  min_age_months: number;
  max_age_months: number | null;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  voucher_limit: number | null;
};
export type Voucher = {
  id: string;
  owner_id: string;
  pet_id: string;
  booth_id: string;
  code: string;
  status: "active" | "redeemed" | "cancelled";
  expires_at: string | null;
  created_at: string;
};
export type RoutePoint = {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
  segment_start?: boolean;
};
export type WalkSession = {
  id: string;
  owner_id: string;
  pet_id: string;
  mood: Mood;
  started_at: string;
  ended_at: string | null;
  route: RoutePoint[];
  distance_m: number;
  paw_coins: number;
};
export type Profile = { id: string; display_name: string; created_at: string };
export type PetData = {
  vaccinations: Vaccination[];
  vets: VetContact[];
  memories: Memory[];
  walks: WalkSession[];
  vouchers: Voucher[];
  activeWalk: WalkSession | null;
};
export const emptyPetData = (): PetData => ({
  vaccinations: [],
  vets: [],
  memories: [],
  walks: [],
  vouchers: [],
  activeWalk: null,
});
