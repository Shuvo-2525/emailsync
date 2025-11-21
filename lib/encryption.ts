import crypto from 'crypto';
import 'server-only'; // This ensures this file NEVER bundles to the client side

// CONFIGURATION
// This key must be in your .env.local file.
// It MUST be exactly 32 characters long for AES-256.
const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.ENCRYPTION_KEY || '';

// Validation to prevent starting the app with weak security
if (SECRET_KEY.length !== 32) {
  // Only throw this error if we are actually running on the server (prevents build errors)
  if (process.env.NODE_ENV !== 'production') {
     console.warn('WARNING: ENCRYPTION_KEY is not set or not 32 chars. Check .env.local');
  }
}

export interface EncryptedData {
  iv: string;
  content: string;
  tag: string; // GCM tag for authentication (prevents tampering)
}

// ENCRYPTION FUNCTION
// Use this when the User submits the form to add an account
export const encryptPassword = (text: string): EncryptedData => {
  // 1. Generate a random initialization vector (IV)
  const iv = crypto.randomBytes(16);

  // 2. Create the cipher
  // We use Buffer.from to ensure the key is treated correctly
  const cipher = crypto.createCipheriv(
    ALGORITHM, 
    Buffer.from(SECRET_KEY), 
    iv
  );

  // 3. Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 4. Get the auth tag (GCM specific ensures data wasn't modified)
  const tag = cipher.getAuthTag();

  // 5. Return everything needed to decrypt later
  return {
    iv: iv.toString('hex'),
    content: encrypted,
    tag: tag.toString('hex'),
  };
};

// DECRYPTION FUNCTION
// Use this inside your API Route before connecting to IMAP
export const decryptPassword = (data: EncryptedData): string => {
  if (!SECRET_KEY || SECRET_KEY.length !== 32) {
    throw new Error('Server Misconfiguration: Invalid Encryption Key');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(SECRET_KEY),
    Buffer.from(data.iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(data.tag, 'hex'));

  let decrypted = decipher.update(data.content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};