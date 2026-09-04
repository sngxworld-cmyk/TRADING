import React, { useState, useEffect, useRef } from "react";
import { UserProfile } from "../types";
import { AuthLottieAnimation } from "./AuthLottieAnimation";
import {
  CreditCard,
  MessageCircle,
  RefreshCw,
  LogOut,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Copy,
  Check,
  Send,
  Building,
  AlertCircle
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
  const [copiedBank, setCopiedBank] = useState<string | null>(null);
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

  const bankDetails = {
    bankName: "Commercial Bank of Ceylon",
    accountName: "S N G X WORLD PVT LTD",
    accountNumber: "8014529140",
    branch: "Colombo Main Branch",
    feeLkr: "350 LKR",
    feeUsd: "~$1.20 USD",
    planType: "Lifetime Access",
  };

  const copyToClipboard = (text: string, key: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedBank(key);
      setTimeout(() => setCopiedBank(null), 2500);
    } catch (e) {}
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshFeedback(null);
    try {
      await onRefreshStatus();
      setRefreshFeedback("Checked: Still awaiting Host Admin approval. If receipt is sent, wait a moment.");
    } catch {
      setRefreshFeedback("Network check completed.");
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  const whatsappMessage = `Hello Host Admin,\n\nMy 5-Day Trial has ended on TrackerX and I have made the lifetime subscription bank payment.\n\n👤 Account Email: ${user.email}\n🏷️ Username: ${user.username}\n💰 Amount Paid: 350 LKR (~$1.20 USD) - Lifetime Plan\n\nAttached is my payment receipt. Please verify and grant access from the Host Admin App. Thank you!`;

  const whatsappLink = `https://wa.me/94752840841?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div
      ref={gateRef}
      id="trial-expired-fullscreen-gate"
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/98 backdrop-blur-2xl p-3 sm:p-5 overflow-y-auto select-none"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      <div className="w-full max-w-xl bg-slate-900 border border-amber-500/40 shadow-2xl rounded-3xl overflow-hidden p-6 sm:p-8 flex flex-col items-center text-center relative max-h-[94vh] overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-300">
        {/* Top Decorative Ambient Glow Bar */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-2 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600 rounded-b-full shadow-lg shadow-amber-500/50" />

        {/* Lottie Animation for Trial Period Ended */}
        <div className="mb-4 mt-2">
          <AuthLottieAnimation type="trial-expired" className="w-24 h-24 sm:w-28 sm:h-28 mx-auto" />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono mb-3">
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>Trial Period Has Ended &bull; Lifetime Subscription Required</span>
        </div>

        {/* Headline */}
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2 font-mono">
          Your Trial Period Has Ended
        </h2>

        {/* Core Description */}
        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-5 bg-slate-950/80 border border-slate-800/90 p-4 rounded-2xl text-left">
          Thank you for trading with <span className="font-bold text-amber-400">TrackerX</span>! Your 5-day free access trial for <span className="text-white font-mono font-semibold">{user.email}</span> is now completed. Subscribe via bank payment and send your transfer receipt to the owner on WhatsApp to unlock your lifetime trading journal and signal channels instantly.
        </p>

        {/* Subscription Price Banner - 350 LKR (~$1.20 USD) Lifetime */}
        <div className="w-full bg-gradient-to-r from-amber-950/60 via-slate-900 to-yellow-950/50 border border-amber-500/50 rounded-2xl p-4 sm:p-5 mb-5 text-left relative overflow-hidden shadow-lg shadow-amber-950/40">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-mono font-bold uppercase tracking-wider border border-amber-500/40">
                Lifetime Plan
              </span>
              <span className="text-xs text-slate-400 font-sans">One-time payment &bull; No recurring fees</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                350 LKR
              </span>
              <span className="text-xs text-amber-200/80 font-mono font-medium">
                (~$1.20 USD)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-300 font-sans">
            <div className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Full Journal Suite</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Signals & VIP Hub</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300 col-span-2 sm:col-span-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Lifetime Updates</span>
            </div>
          </div>
        </div>

        {/* Bank Transfer Details Card */}
        <div className="w-full bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-5 text-left space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2 text-white text-xs font-bold font-mono uppercase tracking-wider">
              <Building className="w-4 h-4 text-amber-400" />
              <span>Bank Payment Details</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Direct Bank Deposit / Online Banking</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {/* Bank Name */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 text-[11px]">Bank:</span>
              <span className="text-slate-100 font-semibold text-right">{bankDetails.bankName}</span>
            </div>

            {/* Account Name */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 text-[11px]">Account Name:</span>
              <span className="text-slate-100 font-semibold text-right">{bankDetails.accountName}</span>
            </div>

            {/* Account Number with 1-Click Copy */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40">
              <div>
                <span className="text-[10px] text-amber-300 block uppercase">Account Number:</span>
                <span className="text-white font-black text-sm tracking-wider">{bankDetails.accountNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(bankDetails.accountNumber, "acc")}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
              >
                {copiedBank === "acc" ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Branch */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 text-[11px]">Branch:</span>
              <span className="text-slate-200 font-medium text-right">{bankDetails.branch}</span>
            </div>
          </div>
        </div>

        {/* WhatsApp Receipt Submission Button */}
        <div className="w-full space-y-2 mb-5">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-950/60 transition-all font-mono hover:scale-[1.01] active:scale-[0.99]"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Send Receipt on WhatsApp (+94 75 284 0841)</span>
          </a>
          <p className="text-[11px] text-slate-400 font-sans">
            Once sent, the owner will grant lifetime access directly from the Host Admin app.
          </p>
        </div>

        {/* Feedback Message */}
        {refreshFeedback && (
          <div className="text-[11px] text-amber-300 font-mono mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-in fade-in w-full text-center">
            {refreshFeedback}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-xl transition-all text-xs border border-slate-700 flex items-center justify-center gap-2 font-mono"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Sign Out / Switch Account</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl transition-all text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 font-mono"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Verifying..." : "I've Paid — Check Status"}</span>
          </button>
        </div>

        <p className="mt-4 text-[10px] text-slate-500 font-mono">
          Auto-polling active: Your screen will unlock instantly the moment the Host Admin approves your subscription.
        </p>
      </div>
    </div>
  );
};
