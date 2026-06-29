import bcrypt from 'bcryptjs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
}

const BCRYPT_ROUNDS = 12;
const USERS_TABLE = 'app_users';

let supabase: SupabaseClient | null = null;
let defaultUserReady = false;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getSupabase() {
  if (supabase) return supabase;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase environment variables are missing.');
  }

  supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabase;
}

async function ensureDefaultUser() {
  if (defaultUserReady) return;

  const client = getSupabase();
  const email = 'test@gmail.com';
  const passwordHash = await bcrypt.hash('test', BCRYPT_ROUNDS);
  const { error } = await client
    .from(USERS_TABLE)
    .upsert(
      { email, password_hash: passwordHash },
      { onConflict: 'email', ignoreDuplicates: true }
    );

  if (error) {
    throw new Error(`Failed to seed default user: ${error.message}`);
  }

  defaultUserReady = true;
}

export async function createUser(email: string, password: string) {
  await ensureDefaultUser();

  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { error } = await getSupabase()
    .from(USERS_TABLE)
    .insert({
      email: normalizedEmail,
      password_hash: passwordHash,
    });

  if (!error) {
    return { ok: true as const };
  }

  if (error.code === '23505') {
    return { ok: false as const, reason: 'duplicate' as const };
  }

  throw new Error(`Failed to create user: ${error.message}`);
}

export async function verifyUserPassword(email: string, password: string) {
  await ensureDefaultUser();

  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await getSupabase()
    .from(USERS_TABLE)
    .select('id, email, password_hash')
    .eq('email', normalizedEmail)
    .maybeSingle<UserRecord>();

  if (error) {
    throw new Error(`Failed to find user: ${error.message}`);
  }

  if (!data) return null;

  const isValid = await bcrypt.compare(password, data.password_hash);
  if (!isValid) return null;

  return {
    id: data.id,
    email: data.email,
  };
}
