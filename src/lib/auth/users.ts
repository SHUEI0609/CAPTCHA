import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'users.json');
const BCRYPT_ROUNDS = 12;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function ensureDatabase() {
  fs.mkdirSync(DB_DIR, { recursive: true });

  if (!fs.existsSync(DB_PATH)) {
    const defaultUser: UserRecord = {
      id: crypto.randomUUID(),
      email: 'test@gmail.com',
      passwordHash: bcrypt.hashSync('test', BCRYPT_ROUNDS),
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(DB_PATH, JSON.stringify([defaultUser], null, 2));
  }
}

function readUsers() {
  ensureDatabase();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw) as UserRecord[];
}

function writeUsers(users: UserRecord[]) {
  ensureDatabase();
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

export async function createUser(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();

  if (users.some((user) => user.email === normalizedEmail)) {
    return { ok: false as const, reason: 'duplicate' as const };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  users.push({
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
  });
  writeUsers(users);

  return { ok: true as const };
}

export async function verifyUserPassword(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const user = readUsers().find((record) => record.email === normalizedEmail);

  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;

  return {
    id: user.id,
    email: user.email,
  };
}
