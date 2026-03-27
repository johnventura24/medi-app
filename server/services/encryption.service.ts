import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn('WARNING: ENCRYPTION_KEY not set. Using random key - encrypted data will not survive restarts!');
    return crypto.randomBytes(32);
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext; // Not encrypted, return as-is (backward compat)
  const [ivHex, authTagHex, encryptedHex] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// For JSONB fields - encrypt the JSON string
export function encryptJson(data: any): string {
  return encrypt(JSON.stringify(data));
}

export function decryptJson(ciphertext: string): any {
  try {
    const decrypted = decrypt(ciphertext);
    return JSON.parse(decrypted);
  } catch {
    // If decryption fails, data might be unencrypted JSON
    try { return JSON.parse(ciphertext); } catch { return ciphertext; }
  }
}
