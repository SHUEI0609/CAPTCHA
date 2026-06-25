import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const KEY_LENGTH = 32;

// Get key from environment, or use a stable fallback for development
const SECRET_INPUT = process.env.CAPTCHA_SECRET || 'shape-matrix-captcha-default-secret-key-12345';
const KEY = crypto.scryptSync(SECRET_INPUT, 'shape-captcha-salt', KEY_LENGTH);

export interface CaptchaTokenPayload {
  correctChoiceId: number;
  level: number;
  expiresAt: number;
  issuedAt: number;
  salt: string;
}

export interface CaptchaProofPayload {
  purpose: 'captcha-proof';
  level: number;
  expiresAt: number;
  issuedAt: number;
  salt: string;
}

/**
 * Encrypts the CAPTCHA payload into a URL-safe encrypted token.
 */
export function encryptToken(payload: CaptchaTokenPayload | CaptchaProofPayload): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  const text = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  // Package as IV (12B) + Tag (16B) + Encrypted Data
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64url');
}

/**
 * Decrypts a CAPTCHA token and returns the payload, or null if invalid/tampered.
 */
export function decryptToken(token: string): CaptchaTokenPayload | CaptchaProofPayload | null {
  try {
    const buffer = Buffer.from(token, 'base64url');
    
    // Validate minimum buffer size (12 bytes IV + 16 bytes Tag)
    if (buffer.length < IV_LENGTH + 16) {
      return null;
    }
    
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = buffer.subarray(IV_LENGTH + 16);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (error) {
    console.error('Failed to decrypt captcha token:', error);
    return null;
  }
}

export function encryptCaptchaProof(level: number): string {
  const now = Date.now();
  return encryptToken({
    purpose: 'captcha-proof',
    level,
    expiresAt: now + 2 * 60 * 1000,
    issuedAt: now,
    salt: crypto.randomBytes(8).toString('hex'),
  });
}
