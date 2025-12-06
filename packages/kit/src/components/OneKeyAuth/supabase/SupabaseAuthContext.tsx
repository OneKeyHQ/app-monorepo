import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Session } from '@supabase/supabase-js';

export type ISupabaseAuthData = {
  session?: Session | null;
  // profile?: any | null;
  isLoading: boolean;
  isLoggedIn: boolean;
};
export const SupabaseAuthContext = createContext<ISupabaseAuthData>({
  session: undefined,
  // profile: undefined,
  isLoading: true,
  isLoggedIn: false,
});
export const useSupabaseAuthContext = () => useContext(SupabaseAuthContext);
