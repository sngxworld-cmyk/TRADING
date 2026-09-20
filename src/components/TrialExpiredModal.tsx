import React, { useState, useEffect, useRef } from "react";
import { UserProfile } from "../types";
import { AuthLottieAnimation } from "./AuthLottieAnimation";
import {
  MessageCircle,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Lock
} from "lucide-react";

interface TrialExpiredModalProps {
  user: UserProfile;
  onRefreshStatus: () => void;
  onLogout: () => void;
}

export const TrialExpiredModal: React.FC<TrialExpiredModalProps> = ({
  user,
  onRefreshStatus,
  onLogout,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);
  const gateRef = useRef<HTMLDivElement>(null);

  // Anti-tamper DOM Integrity Watchdog
  useEffect(() => {
    const target = gateRef.current;
    if (!target) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.metaKey && e.altKey && (e.key === "i" || e.key === "j" || e.key === "c"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    target.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown, true);

    const observer = new MutationObserver(() => {
      if (!document.body.contains(target)) {
        window.location.reload();
      } else {
        if (target.style.display === "none" || target.style.visibility === "hidden" || target.style.opacity === "0") {
          target.style.display = "flex";
          target.style.visibility = "visible";
          target.style.opacity = "1";
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      target.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown, true);
      observer.disconnect();
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshFeedback(null);
    try {
      await onRefreshStatus();
      setRefreshFeedback("Checked: Still awaiting Host Admin approval. If you messaged on WhatsApp, please wait a moment.");
    } catch {
      setRefreshFeedback("Network check completed.");
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  const whatsappMessage = `Hello Host Admin,\n\nMy 5-Day Trial has ended on TrackerX and I would like to pay for the Lifetime Access plan.\n\n👤 Account Email: ${user.email}\n🏷️ Username: ${user.username}\n💰 Plan: 350 LKR (~$1.20 USD) - Lifetime Plan\n\nPlease let me know the payment instructions to complete payment via WhatsApp and activate my account. Thank you!`;

  const whatsappLink = `https://wa.me/94752840841?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div
      ref={gateRef}
      id="trial-expired-fullscreen-gate"
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/98 backdrop-blur-2xl p-2.5 sm:p-5 overflow-y-auto select-none"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-amber-500/40 shadow-2xl rounded-2xl sm:rounded-3xl overflow-x-hidden p-4 sm:p-6 md:p-8 flex flex-col items-center text-center relative max-h-[92vh] overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-300">
        {/* Top Decorative Ambient Glow Bar */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 sm:w-64 h-2 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600 rounded-b-full shadow-lg shadow-amber-500/50" />

        {/* Lottie Animation for Trial Period Ended */}
        <div className="mb-3 mt-1">
          <AuthLottieAnimation type="trial-expired" className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 mx-auto" />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-mono mb-3 max-w-full flex-wrap text-center">
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Trial Period Has Ended &bull; Lifetime Plan Required</span>
        </div>

        {/* Headline */}
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight mb-2 font-mono">
          Your Trial Period Has Ended
        </h2>

        {/* Core Description */}
        <p className="w-full text-slate-300 text-xs sm:text-sm leading-relaxed mb-4 bg-slate-950/80 border border-slate-800/90 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-left break-words">
          Thank you for trading with <span className="font-bold text-white inline-flex items-baseline font-mono"><span>Tracker</span><span className="text-[1.25em] text-amber-400 font-black leading-none ml-[0.5px]">X</span><sub className="text-[11px] font-bold text-slate-400 lowercase tracking-normal ml-0.5 relative -bottom-[1px]">journal</sub></span>! Your 5-day free access trial for <span className="text-white font-mono font-semibold break-all">{user.email}</span> is now completed. Complete your payment directly via WhatsApp to the owner to unlock your lifetime trading journal workspace instantly.
        </p>

        {/* Subscription Price Banner - 350 LKR (~$1.20 USD) Lifetime Plan */}
        <div className="w-full bg-slate-950/90 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 mb-4 text-left shadow-xl shadow-amber-950/40">
          {/* Header row: Badge and One-time label */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-800">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider border border-amber-500/50">
              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Lifetime Plan</span>
            </span>
            <span className="text-xs text-slate-400 font-sans">
              One-time fee &bull; Never expires
            </span>
          </div>

          {/* Price display block - bold, impossible to miss */}
          <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-3.5 mb-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div>
              <div className="flex items-baseline justify-center sm:justify-start gap-2">
                <span className="text-3xl sm:text-4xl font-black text-amber-400 font-mono tracking-tight">
                  350 LKR
                </span>
                <span className="text-xs sm:text-sm text-amber-200/90 font-mono font-semibold">
                  (~$1.20 USD)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Pay once for unlimited permanent access
              </p>
            </div>
            <span className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30 shrink-0">
              Lifetime Access
            </span>
          </div>

          {/* Feature checklist */}
          <div className="text-xs text-slate-300 font-sans pt-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Complete Trading Journal Suite &amp; PnL Analytics</span>
            </div>
          </div>
        </div>

        {/* WhatsApp Direct Payment CTA Button */}
        <div className="w-full space-y-2 mb-4">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-950/60 transition-all font-mono hover:scale-[1.01] active:scale-[0.99] text-center"
          >
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="break-words">Pay via WhatsApp (+94 75 284 0841)</span>
          </a>
          <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
            Message the owner on WhatsApp to complete payment and unlock your account instantly.
          </p>
        </div>

        {/* Feedback Message */}
        {refreshFeedback && (
          <div className="text-[11px] text-amber-300 font-mono mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-in fade-in w-full text-center">
            {refreshFeedback}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5 w-full">
          <button
            type="button"
            onClick={onLogout}
            className="w-full sm:flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-3 rounded-xl transition-all text-xs border border-slate-700 flex items-center justify-center gap-2 font-mono"
          >
            <LogOut className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Sign Out / Switch</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-3 rounded-xl transition-all text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 font-mono"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Verifying..." : "I've Paid — Check Status"}</span>
          </button>
        </div>

        <p className="mt-3 text-[10px] text-slate-500 font-mono leading-tight">
          Auto-polling active: Your screen will unlock instantly the moment the Host Admin approves your subscription.
        </p>
      </div>
    </div>
  );
};
