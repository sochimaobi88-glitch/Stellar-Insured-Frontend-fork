"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useWalletStore } from "@/store";
import { AuthSession, RegisteredUser } from "@/store/types";
import { secureStorage } from "@/lib/security";
import { isConnected } from "@stellar/freighter-api";
import { validateSessionWallet, validateWalletFunded, validateSessionFields } from "@/lib/walletValidation";

/**
 * Unified Authentication Provider
 * 
 * This provider consolidates:
 * - Secure encrypted storage via src/lib/security.js
 * - Freighter wallet integration via src/lib/freighter.ts
 * - Session state management via walletStore
 * - Periodic validation of wallet connection and funding
 * - Cookie sync for middleware/SSR auth checks
 * 
 * Single source of truth for authentication state across the application.
 */

export type WalletWarning = "mismatch" | "unfunded" | null;

type AuthContextValue = {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  signOut: () => void;
  isAddressRegistered: (address: string) => boolean;
  registerAddress: (address: string, user?: RegisteredUser) => void;
  getRegisteredUser: (address: string) => RegisteredUser | null;
  walletWarning: WalletWarning;
  isInitializing: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const VALIDATION_INTERVAL_MS = 60_000; // Validate every 60 seconds
const SESSION_KEY = "stellar_insured_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const {
    session: storeSession,
    setSession: setStoreSession,
    signOut: storeSignOut,
    isAddressRegistered,
    registerAddress,
    getRegisteredUser,
  } = useWalletStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const [walletWarning, setWalletWarning] = useState<WalletWarning>(null);
  const sessionRef = useRef<AuthSession | null>(null);

  // ─── 1. Initialize session from secure storage ───────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = secureStorage.getItem(SESSION_KEY);
        if (!stored) {
          setIsInitializing(false);
          return;
        }

        const session = JSON.parse(stored) as AuthSession;

        // Validate session fields and expiry
        if (!validateSessionFields(session)) {
          secureStorage.removeItem(SESSION_KEY);
          storeSignOut();
          setIsInitializing(false);
          return;
        }

        // Validate Freighter connection
        const connected = await isConnected();
        if (!connected.isConnected || connected.error) {
          secureStorage.removeItem(SESSION_KEY);
          storeSignOut();
          setIsInitializing(false);
          return;
        }

        // Restore valid session
        setStoreSession(session);
        sessionRef.current = session;
      } catch (error) {
        console.error("Failed to restore session:", error);
        secureStorage.removeItem(SESSION_KEY);
        storeSignOut();
      } finally {
        setIsInitializing(false);
      }
    };

    restoreSession();
  }, [setStoreSession, storeSignOut]);

  // ─── 2. Sync session to cookies and secure storage ──────────────────────
  useEffect(() => {
    if (isInitializing) return;

    if (storeSession) {
      // Persist to secure storage (encrypted)
      secureStorage.setItem(SESSION_KEY, JSON.stringify(storeSession));

      // Sync to cookie for middleware (HttpOnly would be better but requires server-side cookie setting)
      const cookieValue = encodeURIComponent(JSON.stringify(storeSession));
      const expires = new Date(Date.now() + SESSION_TTL_MS).toUTCString();
      document.cookie = `${SESSION_KEY}=${cookieValue}; path=/; expires=${expires}; SameSite=Strict; Secure`;
    } else {
      // Clear session from storage and cookies
      secureStorage.removeItem(SESSION_KEY);
      document.cookie = `${SESSION_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }

    sessionRef.current = storeSession;
  }, [storeSession, isInitializing]);

  // ─── 3. Periodic validation: wallet match, funding, expiry ──────────────
  useEffect(() => {
    async function runValidation() {
      const s = sessionRef.current;
      if (!s) return;

      // Check session expiry
      if (!validateSessionFields(s)) {
        console.warn("Session expired or invalid, signing out");
        storeSignOut();
        setWalletWarning(null);
        return;
      }

      // Check wallet mismatch
      const walletResult = await validateSessionWallet(s);
      if (!walletResult.valid) {
        console.warn("Wallet validation failed:", walletResult.error);
        setWalletWarning("mismatch");
        return;
      }

      // Check funded status
      const fundedResult = await validateWalletFunded(s.address);
      setWalletWarning(fundedResult.funded ? null : "unfunded");
    }

    if (!storeSession) {
      setWalletWarning(null);
      return;
    }

    // Run validation immediately on session change
    runValidation();

    // Then periodically
    const intervalId = setInterval(runValidation, VALIDATION_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [storeSession, storeSignOut]);

  // ─── 4. Context API ──────────────────────────────────────────────────────
  const setSession = useCallback(
    (next: AuthSession | null) => {
      if (next) {
        setStoreSession(next);
        setWalletWarning(null);
      } else {
        storeSignOut();
        setWalletWarning(null);
      }
    },
    [setStoreSession, storeSignOut]
  );

  const signOut = useCallback(() => {
    storeSignOut();
    setWalletWarning(null);
  }, [storeSignOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: storeSession,
      setSession,
      signOut,
      isAddressRegistered,
      registerAddress,
      getRegisteredUser,
      walletWarning,
      isInitializing,
    }),
    [
      storeSession,
      setSession,
      signOut,
      isAddressRegistered,
      registerAddress,
      getRegisteredUser,
      walletWarning,
      isInitializing,
    ]
  );

  // Prevent hydration mismatch by showing nothing during initialization
  if (isInitializing) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
