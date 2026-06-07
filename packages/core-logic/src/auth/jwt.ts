import { EncryptJWT, jwtDecrypt } from 'jose';
import { UserRole } from '../types/database.types';

export interface UserSessionPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export type VerifiedSessionPayload = UserSessionPayload & {
  exp: number; // Expiration timestamp in seconds
  iat: number; // Issued-at timestamp in seconds
};

export interface SessionCookieConfig {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

/**
 * Standard cookie configuration helper.
 */
export function getSessionCookieConfig(isSecure: boolean, maxAge: number = 86400): SessionCookieConfig {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

let cachedKey: CryptoKey | null = null;

/**
 * Clears the derived key cache (primarily for unit testing key derivation state).
 */
export function clearKeyCache(): void {
  cachedKey = null;
}

/**
 * Derives a 256-bit symmetric AES-GCM encryption key from JWT_SECRET using HKDF.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const rawKey = new TextEncoder().encode(secret);
  
  // Use globalThis.crypto which is available in Node 18+ and Next.js Edge Runtime
  const cryptoInstance = globalThis.crypto;
  if (!cryptoInstance || !cryptoInstance.subtle) {
    throw new Error('Web Crypto API is not supported in this environment');
  }

  const baseKey = await cryptoInstance.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const derivedKey = await cryptoInstance.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: new TextEncoder().encode('printing-store-session-encryption-key-v1'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  cachedKey = derivedKey;
  return derivedKey;
}

/**
 * Signs a cryptographically secure JWE token (encrypted JWT) with user session payload.
 */
export async function signSessionToken(payload: UserSessionPayload, durationSec: number = 86400): Promise<string> {
  const key = await getEncryptionKey();
  return new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${durationSec}s`)
    .encrypt(key);
}

/**
 * Verifies and decrypts a JWE token, returning the payload if valid.
 */
export async function verifySessionToken(token: string): Promise<VerifiedSessionPayload | null> {
  try {
    const key = await getEncryptionKey();
    const { payload } = await jwtDecrypt(token, key);
    return payload as unknown as VerifiedSessionPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Checks if a token is valid but falls within the rolling threshold (e.g. less than 6 hours left).
 */
export function shouldRollToken(expSec: number, thresholdHours: number = 6): boolean {
  const remainingTimeMs = expSec * 1000 - Date.now();
  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  return remainingTimeMs > 0 && remainingTimeMs < thresholdMs;
}
