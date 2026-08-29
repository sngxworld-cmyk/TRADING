import React from "react";
import { motion } from "motion/react";

interface LottieAnimationProps {
  type: "verify" | "success" | "lock";
  className?: string;
  loop?: boolean;
}

export const AuthLottieAnimation: React.FC<LottieAnimationProps> = ({
  type,
  className = "w-16 h-16",
  loop = true,
}) => {
  if (type === "success") {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        {/* Ambient Glowing Aura */}
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
          {/* Animated Green Badge Background */}
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

          {/* Crisp White Checkmark Path with Smooth Draw Transition */}
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

  if (type === "verify") {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        {/* Pulsing radar waves */}
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full border-2 border-indigo-500/40 bg-indigo-500/10"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="w-full h-full p-2"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full text-indigo-400" fill="none">
            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" strokeDasharray="6 8" />
          </svg>
        </motion.div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
    );
  }

  // Lock animation
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
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
