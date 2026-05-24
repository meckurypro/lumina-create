import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

type ReelItem = { id: number; colors: [string, string, string]; label: string };

const REEL_ITEMS: ReelItem[] = [
  { id: 1, colors: ["#1a0a00", "#f97316", "#7c2d12"], label: "Office Handover" },
  { id: 2, colors: ["#000000", "#1c1c1c", "#2d2d2d"], label: "Memory Lane" },
  { id: 3, colors: ["#0a0a1a", "#1e3a5f", "#0ea5e9"], label: "AI Portrait" },
  { id: 4, colors: ["#0a1a0a", "#14532d", "#16a34a"], label: "Brand Video" },
  { id: 5, colors: ["#1a0a1a", "#6b21a8", "#a855f7"], label: "Cinematic" },
  { id: 6, colors: ["#1a1000", "#92400e", "#d97706"], label: "History" },
];

function ReelCard({ item, index }: { item: ReelItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 + index * 0.08, duration: 0.5, ease: "easeOut" }}
      className="relative flex-shrink-0 rounded-2xl overflow-hidden"
      style={{
        width: "160px",
        height: "220px",
        background: `linear-gradient(160deg, ${item.colors[0]}, ${item.colors[1]}, ${item.colors[2]})`,
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7) 100%)" }}
      />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white text-xs font-semibold leading-tight" style={{ opacity: 0.85 }}>
          {item.label}
        </p>
      </div>
      <div
        className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
      >
        <div
          className="w-0 h-0 ml-0.5"
          style={{
            borderTop: "4px solid transparent",
            borderBottom: "4px solid transparent",
            borderLeft: "6px solid white",
          }}
        />
      </div>
    </motion.div>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const goAuth = () => navigate({ to: "/login" });

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-14"
        style={{
          background: "var(--bg-primary)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
          >
            <Zap size={14} fill="white" className="text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">Meckury AI</span>
        </div>
        <button
          onClick={goAuth}
          className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
          style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
        >
          Sign in
        </button>
      </motion.header>

      <main className="flex-1 flex flex-col pt-14">
        <div className="w-full max-w-screen-xl mx-auto px-8 pt-20 pb-16 flex flex-col lg:flex-row lg:items-start lg:gap-20">
          <div className="flex-1 min-w-0">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="text-xs font-semibold uppercase tracking-widest mb-5"
              style={{ color: "var(--brand)" }}
            >
              AI Content Studio
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
              className="font-black leading-none tracking-tight mb-6"
              style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", letterSpacing: "-0.04em" }}
            >
              Create.
              <br />
              <span style={{ color: "var(--text-muted)" }}>Go viral.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-base leading-relaxed mb-10"
              style={{ color: "var(--text-muted)", maxWidth: "380px" }}
            >
              Cinematic AI videos and images in seconds. No skills required.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="flex flex-col sm:flex-row gap-3"
              style={{ maxWidth: "380px" }}
            >
              <button
                onClick={goAuth}
                className="flex-1 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
                style={{ background: "var(--text-primary)", color: "var(--text-inverse)" }}
              >
                Get started free →
              </button>
              <button
                onClick={goAuth}
                className="flex-1 py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                Sign in
              </button>
            </motion.div>
          </div>

          <div className="hidden lg:flex flex-col gap-3">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Made with Meckury AI
            </motion.p>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45, duration: 0.6, ease: "easeOut" }}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 160px)",
                gridTemplateRows: "repeat(2, 220px)",
                gap: "12px",
              }}
            >
              {REEL_ITEMS.map((item, i) => (
                <ReelCard key={item.id} item={item} index={i} />
              ))}
            </motion.div>
          </div>
        </div>

        <div className="lg:hidden pb-12">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="px-8 text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Made with Meckury AI
          </motion.p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-8 pb-2">
            {REEL_ITEMS.map((item, i) => (
              <ReelCard key={item.id} item={item} index={i} />
            ))}
            <div className="flex-shrink-0 w-1" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
          className="px-8 pb-8 flex items-center justify-between mt-auto"
          style={{ borderTop: "1px solid var(--border)", paddingTop: "20px" }}
        >
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            By LinkAI
          </p>
          <div className="flex items-center gap-4">
            <button onClick={goAuth} className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Terms
            </button>
            <button onClick={goAuth} className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Privacy
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
