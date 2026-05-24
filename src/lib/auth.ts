import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  credits: number;
  role: "user" | "staff" | "admin";
  is_staff: boolean;
  onboarding_completed: boolean;
};

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Module-level cache so route beforeLoad guards can read auth synchronously
// after the initial hydration.
export const authCache: { isAuthenticated: boolean; ready: Promise<void> | null } = {
  isAuthenticated: false,
  ready: null,
};