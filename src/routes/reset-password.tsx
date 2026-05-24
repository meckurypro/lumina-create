import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Supabase parses the recovery token from the URL hash on load
  // (detectSessionInUrl). We just wait for the recovery event, then
  // allow the user to set a new password.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Fallback: if already in a recovery session, allow immediately.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("At least 8 characters");
    if (password !== confirm) return setError("Passwords do not match");

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) return setError(err.message);
    toast.success("Password updated");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-10 cursor-pointer" onClick={() => navigate({ to: "/" })}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
            <Zap size={14} fill="white" className="text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">Meckury AI</span>
        </div>

        <h1 className="font-black tracking-tight mb-2" style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", letterSpacing: "-0.04em" }}>
          Set a new password
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          {ready ? "Choose a strong password you'll remember." : "Verifying your reset link…"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
              <Lock size={18} />
            </div>
            <input
              className="input-base"
              style={{ paddingLeft: 44 }}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              disabled={!ready}
              autoFocus
            />
          </div>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
              <Lock size={18} />
            </div>
            <input
              className="input-base"
              style={{ paddingLeft: 44 }}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              disabled={!ready}
            />
          </div>
          {error && <p className="text-xs font-medium" style={{ color: "#ef4444" }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !ready}
            className="w-full py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: "var(--text-primary)", color: "var(--text-inverse)" }}
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}