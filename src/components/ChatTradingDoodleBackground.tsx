import React from "react";

export const ChatTradingDoodleBackground: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 select-none overflow-hidden ${className}`}
    >
      {/* Soft Ambient Neon Glow Behind Wallpaper */}
      <div className="absolute inset-0 bg-slate-950/95" />
      <div className="absolute top-1/4 left-1/6 w-72 h-72 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/6 w-80 h-80 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
      <div className="absolute top-2/3 left-1/2 w-64 h-64 rounded-full bg-purple-500/3 blur-3xl pointer-events-none" />

      {/* Repeating Crisp Neon Trading Doodle Pattern - 50% White, 45% Blue, 5% Purple */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.16] mix-blend-screen"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id="trading-neon-doodles"
            width="340"
            height="340"
            patternUnits="userSpaceOnUse"
          >
            {/* 1. Candlestick Trio (50% White & 45% Blue) */}
            <g stroke="#ffffff" strokeWidth="1.4" fill="none" opacity="0.95">
              {/* Candle 1 (White Bull) */}
              <line x1="28" y1="20" x2="28" y2="70" />
              <rect x="23" y="32" width="10" height="24" rx="1.5" fill="#ffffff" fillOpacity="0.25" stroke="#ffffff" />
              {/* Candle 2 (Deep Blue) */}
              <line x1="46" y1="28" x2="46" y2="78" stroke="#3b82f6" />
              <rect x="41" y="40" width="10" height="20" rx="1.5" fill="#3b82f6" fillOpacity="0.25" stroke="#3b82f6" />
              {/* Candle 3 (Cyan / Sky Blue Breakout) */}
              <line x1="64" y1="12" x2="64" y2="65" stroke="#38bdf8" />
              <rect x="59" y="18" width="10" height="34" rx="1.5" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" />
            </g>

            {/* 2. Upward Trendline & Breakout Target (Blue & White) */}
            <g stroke="#60a5fa" strokeWidth="1.3" fill="none">
              <path d="M110 65 L135 48 L155 58 L185 24 L205 32 L225 15" strokeLinecap="round" strokeLinejoin="round" />
              {/* Breakout target circle */}
              <circle cx="225" cy="15" r="3.5" fill="#ffffff" />
              <circle cx="225" cy="15" r="7" stroke="#38bdf8" strokeDasharray="2 2" />
              {/* Support trendline */}
              <line x1="105" y1="72" x2="220" y2="38" stroke="#ffffff" strokeDasharray="3 3" opacity="0.8" />
            </g>

            {/* 3. Currency Symbols (5% Purple Accent) */}
            <g fill="#c084fc" opacity="0.9" transform="translate(255, 30)">
              {/* Bitcoin B */}
              <path
                d="M8 2 H18 C21 2 23 3.5 23 6 C23 7.8 21.8 9.2 20 9.7 C22.2 10.3 23.5 12 23.5 14.2 C23.5 17 21 18.5 17.5 18.5 H8 V2 Z M12 5.5 V8.5 H17 C18 8.5 19 8 19 7 C19 6 18 5.5 17 5.5 H12 Z M12 11.5 V15 H17.5 C18.8 15 19.8 14.2 19.8 13.2 C19.8 12.2 18.8 11.5 17.5 11.5 H12 Z"
                fill="none"
                stroke="#c084fc"
                strokeWidth="1.3"
              />
              <line x1="13" y1="0" x2="13" y2="21" stroke="#c084fc" strokeWidth="1.2" />
              <line x1="17" y1="0" x2="17" y2="21" stroke="#c084fc" strokeWidth="1.2" />
            </g>

            {/* Dollar Sign (White) */}
            <g transform="translate(18, 115)">
              <text x="0" y="16" fill="#ffffff" fontSize="18" fontFamily="monospace" fontWeight="bold">
                $
              </text>
            </g>

            {/* 4. Bull Horns / Momentum Surge (White & Blue) */}
            <g stroke="#ffffff" strokeWidth="1.4" fill="none" opacity="0.9" transform="translate(60, 105)">
              <path d="M5 25 C10 10 22 5 32 15 C38 8 48 6 55 25" strokeLinecap="round" />
              <circle cx="30" cy="20" r="3" fill="#38bdf8" />
              {/* Lightning streak */}
              <path d="M30 0 L24 10 L31 10 L26 22" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* 5. Risk-to-Reward / Order Tag (Blue & White) */}
            <g transform="translate(160, 95)">
              <rect x="0" y="0" width="58" height="20" rx="4" fill="#38bdf8" fillOpacity="0.15" stroke="#38bdf8" strokeWidth="1.2" />
              <text x="8" y="14" fill="#ffffff" fontSize="10" fontFamily="monospace" fontWeight="bold">
                1:3.5 RR
              </text>
            </g>
            <g transform="translate(245, 95)">
              <rect x="0" y="0" width="48" height="20" rx="4" fill="#ffffff" fillOpacity="0.1" stroke="#ffffff" strokeWidth="1.2" />
              <text x="6" y="14" fill="#60a5fa" fontSize="10" fontFamily="monospace" fontWeight="bold">
                +100%
              </text>
            </g>

            {/* 6. Double Bottom "W" Breakout Pattern (Blue & White) */}
            <g stroke="#60a5fa" strokeWidth="1.4" fill="none" transform="translate(20, 160)">
              <path d="M5 5 L18 28 L32 14 L46 28 L60 2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Neckline */}
              <line x1="0" y1="14" x2="68" y2="14" stroke="#ffffff" strokeDasharray="3 3" strokeWidth="1.1" />
              {/* Target arrow */}
              <path d="M60 2 L60 -8 M56 -4 L60 -8 L64 -4" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* 7. RSI Oscillator / Sine Wave (Blue, White, 5% Purple) */}
            <g transform="translate(125, 155)">
              {/* Thresholds */}
              <line x1="0" y1="5" x2="80" y2="5" stroke="#c084fc" strokeDasharray="2 3" strokeWidth="0.9" opacity="0.8" />
              <line x1="0" y1="35" x2="80" y2="35" stroke="#38bdf8" strokeDasharray="2 3" strokeWidth="0.9" opacity="0.8" />
              {/* RSI wave */}
              <path
                d="M0 22 Q15 2 30 18 T60 8 T80 26"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <text x="85" y="24" fill="#ffffff" fontSize="8" fontFamily="monospace">
                RSI
              </text>
            </g>

            {/* 8. Rocket Taking Off (White & Blue) */}
            <g stroke="#ffffff" strokeWidth="1.3" fill="none" transform="translate(255, 150)">
              <path d="M12 2 C18 6 22 14 22 22 L14 22 L12 28 L10 22 L2 22 C2 14 6 6 12 2 Z" fill="#38bdf8" fillOpacity="0.2" />
              <circle cx="12" cy="12" r="3" fill="#ffffff" />
              {/* Thrust flames */}
              <path d="M8 24 L12 32 L16 24" stroke="#38bdf8" strokeWidth="1.3" />
            </g>

            {/* 9. Volume Histogram Bars (White & Blue) */}
            <g transform="translate(20, 235)">
              <rect x="0" y="20" width="6" height="15" fill="#ffffff" fillOpacity="0.4" stroke="#ffffff" strokeWidth="1" />
              <rect x="9" y="10" width="6" height="25" fill="#38bdf8" fillOpacity="0.5" stroke="#38bdf8" strokeWidth="1" />
              <rect x="18" y="25" width="6" height="10" fill="#2563eb" fillOpacity="0.4" stroke="#2563eb" strokeWidth="1" />
              <rect x="27" y="5" width="6" height="30" fill="#ffffff" fillOpacity="0.6" stroke="#ffffff" strokeWidth="1" />
              <rect x="36" y="15" width="6" height="20" fill="#60a5fa" fillOpacity="0.5" stroke="#60a5fa" strokeWidth="1" />
              <rect x="45" y="0" width="6" height="35" fill="#38bdf8" fillOpacity="0.7" stroke="#38bdf8" strokeWidth="1" />
            </g>

            {/* 10. Fibonacci Retracement Fan & Target Nodes (Blue & Purple) */}
            <g stroke="#60a5fa" strokeWidth="1.1" fill="none" transform="translate(115, 230)">
              <line x1="0" y1="35" x2="85" y2="5" stroke="#ffffff" strokeWidth="1.4" />
              <line x1="0" y1="35" x2="85" y2="15" strokeDasharray="3 3" />
              <line x1="0" y1="35" x2="85" y2="25" strokeDasharray="3 3" />
              <text x="88" y="8" fill="#ffffff" fontSize="7" fontFamily="monospace">61.8%</text>
              <text x="88" y="18" fill="#38bdf8" fontSize="7" fontFamily="monospace">50.0%</text>
              <text x="88" y="28" fill="#c084fc" fontSize="7" fontFamily="monospace">38.2%</text>
            </g>

            {/* 11. Diamond Icon (Diamond Hands - White & Sky Blue) */}
            <g stroke="#ffffff" strokeWidth="1.3" fill="#38bdf8" fillOpacity="0.25" transform="translate(240, 235)">
              <polygon points="12,0 24,10 12,24 0,10" />
              <line x1="0" y1="10" x2="24" y2="10" stroke="#ffffff" strokeWidth="1" />
              <line x1="12" y1="0" x2="12" y2="24" stroke="#ffffff" strokeWidth="1" />
            </g>

            {/* 12. Buy & Sell Signal Markers (Blue & White) */}
            <g transform="translate(295, 235)">
              <rect x="0" y="0" width="34" height="16" rx="3" fill="#2563eb" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="1" />
              <text x="6" y="12" fill="#ffffff" fontSize="9" fontFamily="monospace" fontWeight="bold">BUY</text>
              <rect x="0" y="22" width="34" height="16" rx="3" fill="#1e3a8a" fillOpacity="0.4" stroke="#60a5fa" strokeWidth="1" />
              <text x="4" y="34" fill="#93c5fd" fontSize="9" fontFamily="monospace" fontWeight="bold">SELL</text>
            </g>

            {/* 13. Order Book Depth Grid / Ticks (White & Blue) */}
            <g stroke="#38bdf8" strokeWidth="1" opacity="0.6" transform="translate(30, 290)">
              <path d="M0 25 L20 25 L20 18 L45 18 L45 10 L70 10 L70 0" fill="none" stroke="#ffffff" strokeWidth="1.2" />
              <path d="M70 0 L95 0 L95 10 L120 10 L120 18 L145 18 L145 25" fill="none" stroke="#60a5fa" strokeWidth="1.2" />
            </g>

            {/* 14. High-Frequency Ticker Sparklines (White & Sky Blue) */}
            <g stroke="#38bdf8" strokeWidth="1.2" fill="none" transform="translate(195, 295)">
              <path d="M0 12 L15 16 L25 4 L40 22 L55 2 L70 14 L85 6" strokeLinecap="round" stroke="#ffffff" />
              <circle cx="85" cy="6" r="2.5" fill="#38bdf8" />
            </g>
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#trading-neon-doodles)" />
      </svg>
    </div>
  );
};
