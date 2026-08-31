import React from "react";
import { motion } from "motion/react";

export type LottieAnimationType =
  | "verify"
  | "success"
  | "lock"
  | "loader"
  | "button-loader"
  | "community-signal"
  | "signal-radar"
  | "entering-portal"
  | "chart-wave";

interface LottieAnimationProps {
  type: LottieAnimationType;
  className?: string;
  loop?: boolean;
}

export const AuthLottieAnimation: React.FC<LottieAnimationProps> = ({
  type,
  className = "w-16 h-16",
  loop = true,
}) => {
  // 1. Interactive Button / Action Loader
  if (type === "button-loader" || type === "loader") {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        {/* Pulsing Core Aura */}
        <motion.div
          animate={{ scale: [0.85, 1.2, 0.85], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-blue-500/25 blur-sm"
        />

        <svg viewBox="0 0 50 50" className="w-full h-full" fill="none">
          {/* Outer Track Ring */}
          <circle
            cx="25"
            cy="25"
            r="19"
            stroke="rgba(59, 130, 246, 0.2)"
            strokeWidth="3.5"
          />

          {/* Primary High-Speed Orbit Arc */}
          <motion.circle
            cx="25"
            cy="25"
            r="19"
            stroke="url(#btnLoaderGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="60 120"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "25px 25px" }}
          />

          {/* Inner Counter-Rotating Pulsing Spark */}
          <motion.circle
            cx="25"
            cy="25"
            r="12"
            stroke="rgba(56, 189, 248, 0.7)"
            strokeWidth="2"
            strokeDasharray="25 60"
            animate={{ rotate: -360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "25px 25px" }}
          />

          {/* Center Glowing Particle Core */}
          <motion.circle
            cx="25"
            cy="25"
            r="3.5"
            fill="#38bdf8"
            animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "25px 25px" }}
          />

          <defs>
            <linearGradient id="btnLoaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 2. Success Animation
  if (type === "success") {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.8, 1.25, 1], opacity: [0, 0.7, 0.25] }}
          transition={{ duration: 1.4, repeat: loop ? Infinity : 0, repeatType: "reverse" }}
          className="absolute inset-0 rounded-full bg-emerald-500/30 blur-md pointer-events-none"
        />

        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_0_18px_rgba(16,185,129,0.6)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            fill="url(#greenVerifiedGrad)"
            stroke="#10b981"
            strokeWidth="3"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
          />

          <motion.path
            d="M28 50 L43 65 L73 34"
            fill="none"
            stroke="#ffffff"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.55, delay: 0.2, ease: "easeOut" }}
          />

          <defs>
            <linearGradient id="greenVerifiedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 3. Verification Code Radar Animation
  if (type === "verify") {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full border-2 border-blue-500/40 bg-blue-500/10"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="w-full h-full p-2"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full text-blue-400" fill="none">
            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" strokeDasharray="6 8" />
          </svg>
        </motion.div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
    );
  }

  // 4. Community Live Signals Broadcast (Scalable & Responsive)
  if (type === "community-signal") {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        {/* Subtle Outer Glow Wave */}
        <motion.div
          animate={{ scale: [0.9, 1.25, 0.9], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-xl bg-emerald-500/20 blur-[3px]"
        />

        {/* Outer Frame with Lightning Signal */}
        <div className="relative z-10 w-full h-full rounded-xl bg-slate-900 border border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.35)] flex items-center justify-center text-emerald-400 p-1">
          <motion.svg
            viewBox="0 0 24 24"
            className="w-full h-full text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]"
            fill="currentColor"
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </motion.svg>
        </div>
      </div>
    );
  }

  // 5. High-Tech Signal Radar Sweep (For Empty States & Large Hero Visuals)
  if (type === "signal-radar") {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        {/* Radial Waves */}
        <motion.div
          animate={{ scale: [0.6, 1.4, 1.8], opacity: [0.6, 0.2, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
          className="absolute inset-0 rounded-full border border-emerald-400/40 bg-emerald-500/10 pointer-events-none"
        />

        {/* Rotating Radar Sweep */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="w-full h-full absolute inset-0 flex items-center justify-center"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full text-emerald-400" fill="none">
            <circle cx="50" cy="50" r="38" stroke="rgba(16, 185, 129, 0.25)" strokeWidth="1.5" strokeDasharray="4 6" />
            <path
              d="M50 50 L88 50"
              stroke="url(#radarSweepGrad)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="radarSweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(16, 185, 129, 0)" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        {/* Center Satellite Core */}
        <div className="relative z-10 w-1/2 h-1/2 rounded-xl bg-slate-900 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center justify-center text-emerald-400 p-2">
          <motion.svg
            viewBox="0 0 24 24"
            className="w-full h-full"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </motion.svg>
        </div>
      </div>
    );
  }

  // 6. Entering Portal Warp Transition
  if (type === "entering-portal") {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <motion.div
          animate={{ scale: [0.8, 1.3, 0.8], rotate: [0, 180, 360] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-blue-600/40 via-purple-500/30 to-blue-400/40 blur-lg"
        />
        <svg viewBox="0 0 100 100" className="w-full h-full relative z-10" fill="none">
          <motion.circle
            cx="50"
            cy="50"
            r="36"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeDasharray="18 10"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50px 50px" }}
          />
          <motion.circle
            cx="50"
            cy="50"
            r="24"
            stroke="#a855f7"
            strokeWidth="2.5"
            strokeDasharray="10 8"
            animate={{ rotate: -360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50px 50px" }}
          />
        </svg>
      </div>
    );
  }

  // 7. Lock Animation
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-full h-full flex items-center justify-center text-amber-400"
      >
        <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </motion.div>
    </div>
  );
};
