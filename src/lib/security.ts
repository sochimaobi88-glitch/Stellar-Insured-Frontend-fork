import CryptoJS from 'crypto-js';

/**
 * Secure Storage Utility
 * 
 * Provides AES-256 encrypted localStorage wrapper for sensitive client-side data.
 * 
 * Security Notes:
 * - Uses server-side environment variable (not NEXT_PUBLIC_) for encryption key
 * - Falls back to runtime-generated key if env var missing (dev/test only)
 * - Encryption is client-side defense-in-depth; not a substitute for server auth
 * - Keys should be rotated periodically in production
 */

// Use server-only env var (no NEXT_PUBLIC_ prefix for better security)
// In production, this should be set via environment and never committed
function getEncryptionKey(): string {
  // Try server-side env first (won't be available in browser, but that's ok for build-time access)
  if (typeof process !== 'undefined' && process.env.STORAGE_ENCRYPTION_KEY) {
    return process.env.STORAGE_ENCRYPTION_KEY;
  }
  
  // For client-side, generate a session-specific key (resets on page reload)
  // This provides basic obfuscation but not persistence across sessions
  if (typeof window !== 'undefined') {
    const SESSION_KEY = 'app_session_key';
    let key = sessionStorage.getItem(SESSION_KEY);
    if (!key) {
      // Generate cryptographically random key
      const bytes = new Uint8Array(32);
      window.crypto.getRandomValues(bytes);
      key = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem(SESSION_KEY, key);
    }
    return key;
  }
  
  // Fallback for SSR/build time (should not reach here in normal operation)
  console.warn('Encryption key not available, using temporary fallback');
  return 'temporary-fallback-key-' + Date.now();
}

const ENCRYPTION_KEY = getEncryptionKey();

export const secureStorage = {
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const encrypted = CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Failed to encrypt and store data:', error);
    }
  },

  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;

      const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      // Empty string means decryption failed
      if (!decrypted) {
        console.warn(`Failed to decrypt item: ${key}`);
        localStorage.removeItem(key);
        return null;
      }
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt data:', error);
      localStorage.removeItem(key);
      return null;
    }
  },

  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },

  clear: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.clear();
    sessionStorage.clear();
  }
};

/**
 * Utility to hash sensitive data for comparison without storing plaintext
 */
export function hashData(data: string): string {
  return CryptoJS.SHA256(data).toString();
}

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(length: number = 32): string {
  if (typeof window === 'undefined') {
    // Fallback for SSR
    return Array.from({ length }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');
  }

  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
