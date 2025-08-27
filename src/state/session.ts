import { SessionValidationResult } from '@/types';
import { create } from 'zustand';
import { combine } from 'zustand/middleware';

/**
 * Session store without team functionality.
 *
 * This Zustand store tracks the current session, a loading state,
 * and the last fetch time.  Team selectors have been removed
 * because the application no longer supports teams.  Instead, simple
 * helpers like `isAdmin` and `getCredits` are provided to access
 * common session properties.
 */

interface SessionState {
  session: SessionValidationResult | null;
  isLoading: boolean;
  lastFetched: Date | null;
  fetchSession?: () => Promise<void>;
}

interface SessionActions {
  setSession: (session: SessionValidationResult) => void;
  clearSession: () => void;
  refetchSession: () => void;
  /**
   * Returns true if the current user is an administrator.  The role
   * comparison is case‑sensitive and matches the `admin` literal from
   * ROLES_ENUM in the schema.
   */
  isAdmin: () => boolean;
  /**
   * Returns the current credit balance for the logged‑in user.  If
   * no session is present or the user has no credits field, undefined
   * is returned.
   */
  getCredits: () => number | undefined;
}

export const useSessionStore = create(
  combine(
    {
      session: null as SessionValidationResult | null,
      isLoading: true,
      lastFetched: null as Date | null,
      fetchSession: undefined,
    } as SessionState,
    (set, get) => ({
      setSession: (session: SessionValidationResult) => set({ session, isLoading: false, lastFetched: new Date() }),
      clearSession: () => set({ session: null, isLoading: false, lastFetched: null }),
      refetchSession: () => set({ isLoading: true }),
      isAdmin: () => get().session?.user?.role === 'admin',
      getCredits: () => get().session?.user?.currentCredits,
    } as SessionActions),
  ),
);