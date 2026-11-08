import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// Disposable in-memory PostgreSQL. This suite never connects to Supabase or a user database.
const pg = new PGlite();
const owner = randomUUID();
const other = randomUUID();
const unverified = randomUUID();
let petId = "";
let secondPetId = "";
before(async () => {
  await pg.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant select,insert,delete on storage.objects to authenticated;
    grant execute on function auth.uid(),storage.foldername(text) to anon,authenticated;
  `);
  const migration = await readFile(
    new URL("../supabase/schema.sql", import.meta.url),
    "utf8",
  );
  await pg.exec(migration);
  // Re-running the exact deliverable must be safe.
  await pg.exec(migration);
});
after(async () => {
  await pg.close();
});
async function asUser(id: string) {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await pg.exec("set role authenticated");
}
async function createOwnedPet(id: string): Promise<string> {
  const photo = `${id}/pets/${randomUUID()}.jpg`;
  await pg.query("insert into storage.objects(bucket_id,name) values ($1,$2)", [
    "pet-media",
    photo,
  ]);
  const result = await pg.query<{ id: string }>(
    "insert into public.pets(name,species,gender,breed,birth_date,weight_kg,photo_path) values ($1,$2,$3,$4,current_date,1,$5) returning id",
    [randomUUID(), "dog", "female", randomUUID(), photo],
  );
  return result.rows[0].id;
}

test("a fresh schema contains no pets, medical records, memories, walks or partner offers", async () => {
  for (const table of [
    "pets",
    "vaccinations",
    "vet_contacts",
    "memories",
    "walk_sessions",
    "partner_booths",
    "user_vouchers",
    "partner_applications",
  ]) {
    const result = await pg.query<{ count: number }>(
      `select count(*)::int as count from public.${table}`,
    );
    assert.equal(result.rows[0].count, 0);
  }
  const tables = await pg.query<{ relrowsecurity: boolean }>(
    "select relrowsecurity from pg_class join pg_namespace ns on ns.oid=relnamespace where ns.nspname='public' and relkind='r'",
  );
  assert.equal(tables.rows.length, 9);
  assert.ok(tables.rows.every((table) => table.relrowsecurity));
});
test("anonymous requests cannot access any personal or partner tables", async () => {
  await pg.exec("set role anon");
  try {
    for (const table of [
      "profiles",
      "pets",
      "vaccinations",
      "vet_contacts",
      "memories",
      "walk_sessions",
      "partner_booths",
      "user_vouchers",
      "partner_applications",
    ]) {
      await assert.rejects(
        pg.query(`select * from public.${table}`),
        /permission denied/i,
      );
    }
  } finally {
    await pg.exec("reset role");
  }
});
test("verified owners can save their own real-upload reference, and other accounts cannot read it", async () => {
  await pg.query(
    "insert into auth.users values ($1,now()),($2,now()),($3,null)",
    [owner, other, unverified],
  );
  await asUser(owner);
  petId = await createOwnedPet(owner);
  assert.equal((await pg.query("select * from public.pets")).rows.length, 1);
  await asUser(other);
  assert.equal((await pg.query("select * from public.pets")).rows.length, 0);
  assert.equal(
    (await pg.query("select * from storage.objects")).rows.length,
    0,
  );
  secondPetId = await createOwnedPet(other);
  await assert.rejects(
    pg.query(
      "insert into public.vaccinations(pet_id,name,administered_on) values ($1,$2,current_date)",
      [petId, randomUUID()],
    ),
    /foreign key/i,
  );
});
test("unverified sessions cannot read or create personal records or upload photos", async () => {
  await asUser(unverified);
  assert.equal((await pg.query("select * from public.pets")).rows.length, 0);
  assert.equal(
    (await pg.query("select * from public.profiles")).rows.length,
    0,
  );
  await assert.rejects(
    pg.query("insert into storage.objects(bucket_id,name) values ($1,$2)", [
      "pet-media",
      `${unverified}/pets/${randomUUID()}.jpg`,
    ]),
    /row-level security/i,
  );
  await assert.rejects(
    pg.query("insert into public.walk_sessions(pet_id,mood) values ($1,$2)", [
      petId,
      "friendly",
    ]),
    /row-level security/i,
  );
});
test("vaccinations, vet contacts and uploaded memories support owner CRUD and remain isolated", async () => {
  await asUser(owner);
  const vaccine = await pg.query<{ id: string }>(
    "insert into public.vaccinations(pet_id,name,administered_on,due_on) values ($1,$2,current_date,current_date+30) returning id",
    [petId, randomUUID()],
  );
  const vet = await pg.query<{ id: string }>(
    "insert into public.vet_contacts(pet_id,name,phone) values ($1,$2,$3) returning id",
    [
      petId,
      randomUUID(),
      String(Math.floor(100000000 + Math.random() * 900000000)),
    ],
  );
  const photo = `${owner}/memories/${randomUUID()}.jpg`;
  await pg.query("insert into storage.objects(bucket_id,name) values ($1,$2)", [
    "pet-media",
    photo,
  ]);
  const memory = await pg.query<{ id: string }>(
    "insert into public.memories(pet_id,caption,photo_path,taken_on) values ($1,$2,$3,current_date) returning id",
    [petId, randomUUID(), photo],
  );
  const records = [
    ["vaccinations", vaccine.rows[0].id, "notes"],
    ["vet_contacts", vet.rows[0].id, "notes"],
    ["memories", memory.rows[0].id, "caption"],
  ];
  await asUser(other);
  for (const [table, id, column] of records) {
    assert.equal(
      (await pg.query(`select * from public.${table} where id=$1`, [id])).rows
        .length,
      0,
    );
    assert.equal(
      (
        await pg.query(
          `update public.${table} set ${column}=$1 where id=$2 returning id`,
          [randomUUID(), id],
        )
      ).rows.length,
      0,
    );
  }
  await asUser(owner);
  for (const [table, id, column] of records) {
    assert.equal(
      (
        await pg.query(
          `update public.${table} set ${column}=$1 where id=$2 returning id`,
          [randomUUID(), id],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await pg.query(`delete from public.${table} where id=$1 returning id`, [
          id,
        ])
      ).rows.length,
      1,
    );
  }
  await pg.query("delete from storage.objects where name=$1", [photo]);
});
test("a saved pet cannot use an absent photo, and referenced photos cannot be deleted", async () => {
  await asUser(owner);
  await assert.rejects(
    pg.query("update public.pets set photo_path=$1 where id=$2", [
      `${owner}/pets/${randomUUID()}.jpg`,
      petId,
    ]),
    /real photo/i,
  );
  const removed = await pg.query(
    "delete from storage.objects where bucket_id=$1 returning id",
    ["pet-media"],
  );
  assert.equal(removed.rows.length, 0);
  await assert.rejects(
    pg.query("update public.pets set owner_id=$1 where id=$2", [other, petId]),
    /row-level security|check constraint/i,
  );
});
test("walk rewards are calculated from GPS, cannot be injected, and finished routes cannot be rewritten", async () => {
  await asUser(owner);
  const start = await pg.query<{ id: string }>(
    "insert into public.walk_sessions(pet_id,mood,distance_m) values ($1,$2,9999) returning id",
    [petId, "friendly"],
  );
  const id = start.rows[0].id;
  assert.equal(
    (
      await pg.query<{ distance_m: string }>(
        "select distance_m from public.walk_sessions where id=$1",
        [id],
      )
    ).rows[0].distance_m,
    "0.00",
  );
  const time = Date.now();
  const path = [
    { lat: 0, lng: 0, timestamp: time, accuracy: 5 },
    { lat: 0, lng: 0.0001, timestamp: time + 10000, accuracy: 5 },
  ];
  await assert.rejects(
    pg.query("update public.walk_sessions set route=$1::jsonb where id=$2", [
      JSON.stringify([path[0], { ...path[1], lng: 1 }]),
      id,
    ]),
    /walking speed/i,
  );
  await pg.query(
    "update public.walk_sessions set route=$1::jsonb,distance_m=999999 where id=$2",
    [JSON.stringify(path), id],
  );
  const saved = await pg.query<{ distance_m: string; paw_coins: number }>(
    "select distance_m,paw_coins from public.walk_sessions where id=$1",
    [id],
  );
  assert.ok(Math.abs(Number(saved.rows[0].distance_m) - 11.11) < 0.02);
  assert.equal(saved.rows[0].paw_coins, 0);
  await assert.rejects(
    pg.query("update public.walk_sessions set route=$1::jsonb where id=$2", [
      JSON.stringify([]),
      id,
    ]),
    /append only/i,
  );
  await pg.query(
    "update public.walk_sessions set route=$1::jsonb where id=$2",
    [
      JSON.stringify([
        ...path,
        {
          lat: 0,
          lng: 1,
          timestamp: time + 15000,
          accuracy: 5,
          segment_start: true,
        },
      ]),
      id,
    ],
  );
  assert.ok(
    Number(
      (
        await pg.query<{ distance_m: string }>(
          "select distance_m from public.walk_sessions where id=$1",
          [id],
        )
      ).rows[0].distance_m,
    ) < 12,
    "paused movement does not earn distance",
  );
  await pg.query("update public.walk_sessions set ended_at=now() where id=$1", [
    id,
  ]);
  assert.equal(
    (
      await pg.query<{ paw_coins: number }>(
        "select paw_coins from public.walk_sessions where id=$1",
        [id],
      )
    ).rows[0].paw_coins,
    1,
  );
  await assert.rejects(
    pg.query("update public.walk_sessions set distance_m=99999 where id=$1", [
      id,
    ]),
    /immutable/i,
  );
  await assert.rejects(
    pg.query("update public.walk_sessions set paw_coins=99999 where id=$1", [
      id,
    ]),
    /generated|only be updated to DEFAULT/i,
  );
});
test("vouchers can only be claimed through RPC and redeemed by the assigned booth operator once", async () => {
  await pg.exec("reset role");
  const booth = await pg.query<{ id: string }>(
    "insert into public.partner_booths(owner_id,name,category,title,description,is_active,voucher_limit) values ($1,$2,$3,$4,$5,true,1) returning id",
    [other, randomUUID(), "clinic", randomUUID(), ""],
  );
  const boothId = booth.rows[0].id;
  await asUser(owner);
  await assert.rejects(
    pg.query(
      "insert into public.user_vouchers(pet_id,booth_id) values ($1,$2)",
      [petId, boothId],
    ),
    /permission denied/i,
  );
  const claimed = await pg.query<{ id: string; code: string }>(
    "select * from public.claim_voucher($1,$2)",
    [boothId, petId],
  );
  const again = await pg.query<{ id: string }>(
    "select * from public.claim_voucher($1,$2)",
    [boothId, petId],
  );
  assert.equal(claimed.rows[0].id, again.rows[0].id);
  await assert.rejects(
    pg.query("select public.redeem_voucher($1)", [claimed.rows[0].code]),
    /unavailable/i,
  );
  await asUser(other);
  await assert.rejects(
    pg.query("select * from public.claim_voucher($1,$2)", [
      boothId,
      secondPetId,
    ]),
    /limit/i,
  );
  await pg.query("select public.redeem_voucher($1)", [claimed.rows[0].code]);
  await assert.rejects(
    pg.query("select public.redeem_voucher($1)", [claimed.rows[0].code]),
    /unavailable/i,
  );
  await asUser(owner);
  assert.equal(
    (
      await pg.query<{ status: string }>(
        "select status from public.user_vouchers where id=$1",
        [claimed.rows[0].id],
      )
    ).rows[0].status,
    "redeemed",
  );
});
