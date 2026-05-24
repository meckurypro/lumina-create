import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
});

function FeedPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return (
    <div className="min-h-dvh p-8" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-black tracking-tight mb-2">Discover</h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          You're signed in as <strong>@{profile?.username ?? "…"}</strong> ({user.email}). Feed migration coming next.
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/login" });
          }}
          className="px-5 py-3 rounded-2xl text-sm font-bold"
          style={{ background: "var(--text-primary)", color: "var(--text-inverse)" }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}