import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User as UserIcon, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: AuthPage,
});

const VIEWS = {
  LANDING: "landing",
  SIGNUP: "signup",
  OTP_VERIFY: "otp_verify",
  LOGIN: "login",
  FORGOT_PASSWORD: "forgot_password",
  RESET_SENT: "reset_sent",
} as const;
type View = (typeof VIEWS)[keyof typeof VIEWS];

const BACK_MAP: Record<View, View> = {
  [VIEWS.LANDING]: VIEWS.LANDING,
  [VIEWS.SIGNUP]: VIEWS.LANDING,
  [VIEWS.OTP_VERIFY]: VIEWS.SIGNUP,
  [VIEWS.LOGIN]: VIEWS.LANDING,
  [VIEWS.FORGOT_PASSWORD]: VIEWS.LOGIN,
  [VIEWS.RESET_SENT]: VIEWS.LOGIN,
};

type Reel = { id: number; colors: [string, string, string]; label: string };
const REEL_ITEMS: Reel[] = [
  { id: 1, colors: ["#1a0a00", "#f97316", "#7c2d12"], label: "Office Handover" },
  { id: 2, colors: ["#000000", "#1c1c1c", "#2d2d2d"], label: "Memory Lane" },
  { id: 3, colors: ["#0a0a1a", "#1e3a5f", "#0ea5e9"], label: "AI Portrait" },
  { id: 4, colors: ["#0a1a0a", "#14532d", "#16a34a"], label: "Brand Video" },
  { id: 5, colors: ["#1a0a1a", "#6b21a8", "#a855f7"], label: "Cinematic" },
  { id: 6, colors: ["#1a1000", "#92400e", "#d97706"], label: "History" },
];

const slideIn = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

function ReelSlideshow() {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCurrent((p) => (p + 1) % REEL_ITEMS.length), 3000);
    return () => clearInterval(t);
  }, []);
  const item = REEL_ITEMS[current];
  return (
    <div className="relative w-full h-full overflow-hidden rounded-3xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, ${item.colors[0]}, ${item.colors[1]}, ${item.colors[2]})` }}
        />
      </AnimatePresence>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
      <div className="absolute bottom-0 left-0 right-0 p-8">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>
          Made with Meckury AI
        </p>
        <AnimatePresence mode="wait">
          <motion.h2
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-white text-3xl font-black tracking-tight"
          >
            {item.label}
          </motion.h2>
        </AnimatePresence>
      </div>
      <div className="absolute bottom-6 right-8 flex gap-1.5">
        {REEL_ITEMS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Slide ${i + 1}`}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === current ? "20px" : "6px",
              height: "6px",
              background: i === current ? "white" : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PrimaryButton({ onClick, loading, type = "button", children }: { onClick?: () => void; loading?: boolean; type?: "button" | "submit"; children: React.ReactNode }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      className="w-full py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98] disabled:opacity-50"
      style={{ background: "var(--text-primary)", color: "var(--text-inverse)" }}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

function SecondaryButton({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
      style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
    >
      {children}
    </button>
  );
}

function GoogleButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 35.5 24 35.5c-6.4 0-11.5-5.2-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.4 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.9 29.2 5 24 5 16.3 5 9.7 9.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 43c5.2 0 9.9-1.8 13.4-4.9l-6.2-5.2C29.3 34.4 26.8 35.5 24 35.5c-5.2 0-9.6-3-11.3-7.4l-6.5 5C9.6 38.7 16.2 43 24 43z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.5l6.2 5.2c-.4.4 6.6-4.8 6.6-14.7 0-1.2-.1-2.3-.4-3.5z" />
      </svg>
      Continue with Google
    </button>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>or</span>
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

type FieldProps = {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  error?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  maxLength?: number;
};
function Field({ type = "text", value, onChange, placeholder, icon: Icon, error, autoFocus, autoComplete, maxLength }: FieldProps) {
  return (
    <div>
      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
            <Icon size={18} />
          </div>
        )}
        <input
          className="input-base"
          style={{ paddingLeft: Icon ? 44 : undefined, borderColor: error ? "#ef4444" : undefined }}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          maxLength={maxLength}
        />
      </div>
      {error && <p className="mt-2 text-xs font-medium" style={{ color: "#ef4444" }}>{error}</p>}
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [view, setView] = useState<View>(VIEWS.LANDING);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/" });
  }, [user, authLoading, navigate]);

  const clearErrors = () => setErrors({});
  const back = useCallback(() => {
    clearErrors();
    setView((c) => BACK_MAP[c] ?? VIEWS.LANDING);
  }, []);

  async function handleSignup() {
    clearErrors();
    const errs: Record<string, string> = {};
    if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Enter a valid email";
    if (password.length < 8) errs.password = "At least 8 characters";
    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) errs.username = "3+ chars, letters/numbers/underscore";
    if (Object.keys(errs).length) return setErrors(errs);

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { username: username.toLowerCase() },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome to Meckury AI! 🎉");
  }

  async function handleLogin() {
    clearErrors();
    const errs: Record<string, string> = {};
    if (!email) errs.email = "Email is required";
    if (!password) errs.password = "Password is required";
    if (Object.keys(errs).length) return setErrors(errs);

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setErrors({ password: "Invalid email or password" });
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) toast.error("Google sign in failed");
  }

  async function handleForgot() {
    clearErrors();
    if (!email) return setErrors({ email: "Enter your email" });
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error("Failed to send reset email");
    setView(VIEWS.RESET_SENT);
  }

  const BackButton = () =>
    view !== VIEWS.LANDING ? (
      <button onClick={back} className="text-sm font-semibold mb-6" style={{ color: "var(--text-muted)" }}>
        ← Back
      </button>
    ) : null;

  return (
    <div className="min-h-dvh flex" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* LEFT: form */}
      <div className="flex-1 flex flex-col px-6 sm:px-10 lg:px-16 py-8 max-w-xl w-full mx-auto lg:mx-0">
        <div className="flex items-center gap-2 mb-12 cursor-pointer" onClick={() => navigate({ to: "/" })}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
            <Zap size={14} fill="white" className="text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">Meckury AI</span>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div key={view} {...slideIn} transition={{ duration: 0.25 }}>
              <BackButton />

              {view === VIEWS.LANDING && (
                <div className="space-y-8">
                  <div>
                    <h1 className="font-black tracking-tight mb-3" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.04em" }}>
                      Get started
                    </h1>
                    <p className="text-base" style={{ color: "var(--text-muted)" }}>
                      Create stunning AI content in seconds
                    </p>
                  </div>
                  <div className="space-y-3">
                    <PrimaryButton onClick={() => setView(VIEWS.SIGNUP)}>Get started free →</PrimaryButton>
                    <SecondaryButton onClick={() => setView(VIEWS.LOGIN)}>Sign in</SecondaryButton>
                    <OrDivider />
                    <GoogleButton onClick={handleGoogle} />
                  </div>
                  <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                    By continuing you agree to our Terms & Privacy Policy
                  </p>
                </div>
              )}

              {view === VIEWS.SIGNUP && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-black tracking-tight mb-2" style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", letterSpacing: "-0.04em" }}>
                      Create account
                    </h1>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>5 free credits, on the house</p>
                  </div>
                  <div className="space-y-3">
                    <Field value={username} onChange={(v) => setUsername(v.toLowerCase())} placeholder="username" icon={UserIcon} error={errors.username} maxLength={30} autoFocus />
                    <Field type="email" value={email} onChange={setEmail} placeholder="you@example.com" icon={Mail} error={errors.email} autoComplete="email" />
                    <Field type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" icon={Lock} error={errors.password} autoComplete="new-password" />
                    <PrimaryButton onClick={handleSignup} loading={loading}>Create account</PrimaryButton>
                    <OrDivider />
                    <GoogleButton onClick={handleGoogle} />
                  </div>
                  <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
                    Already have an account?{" "}
                    <button onClick={() => setView(VIEWS.LOGIN)} className="font-semibold" style={{ color: "var(--brand)" }}>Sign in</button>
                  </p>
                </div>
              )}

              {view === VIEWS.LOGIN && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-black tracking-tight mb-2" style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", letterSpacing: "-0.04em" }}>
                      Welcome back
                    </h1>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sign in to your account</p>
                  </div>
                  <div className="space-y-3">
                    <Field type="email" value={email} onChange={setEmail} placeholder="you@example.com" icon={Mail} error={errors.email} autoComplete="email" autoFocus />
                    <Field type="password" value={password} onChange={setPassword} placeholder="••••••••" icon={Lock} error={errors.password} autoComplete="current-password" />
                    <button onClick={() => setView(VIEWS.FORGOT_PASSWORD)} className="text-sm text-right font-medium block ml-auto -mt-1" style={{ color: "var(--brand)" }}>
                      Forgot password?
                    </button>
                    <PrimaryButton onClick={handleLogin} loading={loading}>Sign in</PrimaryButton>
                    <OrDivider />
                    <GoogleButton onClick={handleGoogle} />
                  </div>
                  <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
                    Don't have an account?{" "}
                    <button onClick={() => setView(VIEWS.SIGNUP)} className="font-semibold" style={{ color: "var(--brand)" }}>Sign up free</button>
                  </p>
                </div>
              )}

              {view === VIEWS.FORGOT_PASSWORD && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-black tracking-tight mb-2" style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", letterSpacing: "-0.04em" }}>
                      Reset password
                    </h1>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Enter your email and we'll send a reset link</p>
                  </div>
                  <div className="space-y-3">
                    <Field type="email" value={email} onChange={setEmail} placeholder="you@example.com" icon={Mail} error={errors.email} autoFocus />
                    <PrimaryButton onClick={handleForgot} loading={loading}>Send reset link</PrimaryButton>
                  </div>
                </div>
              )}

              {view === VIEWS.RESET_SENT && (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: "var(--brand-light)" }}>
                    <Mail size={28} style={{ color: "var(--brand)" }} />
                  </div>
                  <div>
                    <h1 className="font-black tracking-tight mb-2" style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", letterSpacing: "-0.04em" }}>
                      Check your email
                    </h1>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      We sent a reset link to <span style={{ color: "var(--text-primary)" }}>{email}</span>
                    </p>
                  </div>
                  <SecondaryButton onClick={() => setView(VIEWS.LOGIN)}>Back to sign in</SecondaryButton>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between pt-8" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>By LinkAI</p>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Terms</span>
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Privacy</span>
          </div>
        </div>
      </div>

      {/* RIGHT: reel slideshow (desktop only) */}
      <div className="hidden lg:block flex-1 p-6">
        <ReelSlideshow />
      </div>
    </div>
  );
}