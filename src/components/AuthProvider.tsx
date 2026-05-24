import { useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext, authCache, type Profile } from "@/lib/auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, credits, role, is_staff, onboarding_completed")
      .eq("id", uid)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }

  async function refresh() {
    if (user) await loadProfile(user.id);
  }

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      authCache.isAuthenticated = !!s;
      if (s?.user) {
        // Defer to avoid recursive auth calls
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    const init = supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      authCache.isAuthenticated = !!data.session;
      if (data.session?.user) return loadProfile(data.session.user.id);
    }).finally(() => mounted && setLoading(false));

    authCache.ready = init.then(() => undefined);

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    profile,
    loading,
    isAuthenticated: !!session,
    refresh,
    signOut: async () => { await supabase.auth.signOut(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}