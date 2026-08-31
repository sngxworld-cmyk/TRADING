import React, { useMemo } from "react";
import { motion } from "motion/react";

interface Particle {
  id: number;
  colorType: "white" | "blue" | "purple";
  color: string;
  glow: string;
  size: number;
  left: number;
  top: number;
  duration: number;
  delay: number;
  yOffset: number;
  xOffset: number;
}

export const JournalAmbientBackground: React.FC<{ className?: string }> = ({ className = "" }) => {
  // Generate particles adhering strictly to: 50% White, 45% Blue, 5% Purple
  const particles = useMemo<Particle[]>(() => {
    const list: Particle[] = [];
    const totalCount = 40;
    const whiteCount = 20;  // 50%
    const blueCount = 18;   // 45%
    const purpleCount = 2;  // 5%

    // 1. 50% White Particles
    for (let i = 0; i < whiteCount; i++) {
      list.push({
        id: i,
        colorType: "white",
        color: "#ffffff",
        glow: "0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.4)",
        size: 2 + (i % 3) * 1.2,
        left: (i * 17 + 7) % 96,
        top: (i * 23 + 11) % 94,
        duration: 4 + (i % 4) * 1.5,
        delay: (i * 0.4) % 3,
        yOffset: -25 - (i % 3) * 15,
        xOffset: ((i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 6)),
      });
    }

    // 2. 45% Blue Particles
    for (let i = 0; i < blueCount; i++) {
      const isCyan = i % 2 === 0;
      list.push({
        id: whiteCount + i,
        colorType: "blue",
        color: isCyan ? "#38bdf8" : "#60a5fa",
        glow: isCyan
          ? "0 0 12px rgba(56,189,248,0.9), 0 0 24px rgba(56,189,248,0.5)"
          : "0 0 12px rgba(96,165,250,0.9), 0 0 24px rgba(96,165,250,0.5)",
        size: 2.5 + (i % 3) * 1.5,
        left: (i * 19 + 13) % 95,
        top: (i * 29 + 17) % 93,
        duration: 5 + (i % 4) * 1.8,
        delay: (i * 0.5) % 4,
        yOffset: -30 - (i % 3) * 18,
        xOffset: ((i % 2 === 0 ? -1 : 1) * (12 + (i % 4) * 8)),
      });
    }

    // 3. 5% Purple Particles
    for (let i = 0; i < purpleCount; i++) {
      list.push({
        id: whiteCount + blueCount + i,
        colorType: "purple",
        color: "#c084fc",
        glow: "0 0 14px rgba(192,132,252,0.9), 0 0 28px rgba(192,132,252,0.6)",
        size: 3.5 + i * 1.5,
        left: (i * 45 + 35) % 90,
        top: (i * 40 + 45) % 85,
        duration: 6 + i * 2,
        delay: i * 1.2,
        yOffset: -35 - i * 15,
        xOffset: (i === 0 ? 18 : -18),
      });
    }

    return list;
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden select-none ${className}`}
    >
      {/* Dynamic Animated Ambient Nebulae & Lighting Meshes */}
      {/* 50% White Shimmer High-Frequency Core */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.08, 0.16, 0.08],
          x: [0, 20, 0],
          y: [0, -15, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-10 left-1/3 w-96 h-96 rounded-full bg-white blur-[100px]"
      />

      <motion.div
        animate={{
          scale: [1.1, 0.9, 1.1],
          opacity: [0.06, 0.14, 0.06],
          x: [0, -25, 0],
          y: [0, 20, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-20 right-1/4 w-[28rem] h-[28rem] rounded-full bg-white blur-[110px]"
      />

      {/* 45% Blue Atmospheric Pulse */}
      <motion.div
        animate={{
          scale: [0.9, 1.25, 0.9],
          opacity: [0.12, 0.22, 0.12],
          x: [0, 40, 0],
        }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 right-10 w-[32rem] h-[32rem] rounded-full bg-blue-500 blur-[120px]"
      />

      <motion.div
        animate={{
          scale: [1.1, 0.85, 1.1],
          opacity: [0.1, 0.2, 0.1],
          y: [0, -30, 0],
        }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-10 left-10 w-[30rem] h-[30rem] rounded-full bg-sky-500 blur-[120px]"
      />

      {/* 5% Purple Radiant Accent Pulse */}
      <motion.div
        animate={{
          scale: [0.8, 1.3, 0.8],
          opacity: [0.06, 0.14, 0.06],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-purple-600 blur-[130px]"
      />

      {/* Animated Subtle Grid Flow Waves */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grid-grad-wave" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="1" />
          </linearGradient>
        </defs>
        <motion.path
          d="M-100 200 C300 100, 600 350, 1400 150 C1800 50, 2200 300, 2600 180"
          fill="none"
          stroke="url(#grid-grad-wave)"
          strokeWidth="2"
          animate={{
            d: [
              "M-100 200 C300 100, 600 350, 1400 150 C1800 50, 2200 300, 2600 180",
              "M-100 240 C300 180, 600 280, 1400 220 C1800 120, 2200 240, 2600 210",
              "M-100 200 C300 100, 600 350, 1400 150 C1800 50, 2200 300, 2600 180",
            ],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M-100 650 C400 500, 800 750, 1500 550 C1900 450, 2300 700, 2700 600"
          fill="none"
          stroke="url(#grid-grad-wave)"
          strokeWidth="1.5"
          strokeDasharray="8 8"
          animate={{
            d: [
              "M-100 650 C400 500, 800 750, 1500 550 C1900 450, 2300 700, 2700 600",
              "M-100 600 C400 700, 800 600, 1500 680 C1900 580, 2300 620, 2700 650",
              "M-100 650 C400 500, 800 750, 1500 550 C1900 450, 2300 700, 2700 600",
            ],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </svg>

      {/* Floating Animated Constellation Particles (50% White, 45% Blue, 5% Purple) */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            boxShadow: p.glow,
          }}
          animate={{
            y: [0, p.yOffset, 0],
            x: [0, p.xOffset, 0],
            opacity: p.colorType === "white" ? [0.3, 0.9, 0.3] : p.colorType === "blue" ? [0.4, 1, 0.4] : [0.5, 1, 0.5],
            scale: [1, 1.4, 1],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};
