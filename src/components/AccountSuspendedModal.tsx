import React, { useState } from "react";
import { UserProfile } from "../types";
import { AuthLottieAnimation } from "./AuthLottieAnimation";
import {
  ShieldAlert,
  PhoneCall,
  MessageSquare,
  LogOut,
  RefreshCw,
  AlertOctagon,
  Lock,
  Mail,
  Send,
  HelpCircle
} from "lucide-react";

interface AccountSuspendedModalProps {
  user: UserProfile;
  onRefreshStatus: () => void;
  onLogout: () => void;
}

export const AccountSuspendedModal: React.FC<AccountSuspendedModalProps> = ({
  user,
  onRefreshStatus,
  onLogout,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [appealNotes, setAppealNotes] = useState("");
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);

  const phoneContact = "+94 75 284 0841";
  const rawPhone = "+94752840841";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshFeedback(null);
    try {
      await onRefreshStatus();
      setRefreshFeedback("Checked: Account status is currently Suspended / Revoked.");
    } catch {
      setRefreshFeedback("Status check completed.");
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const whatsappAppealMessage = `Hello Host Admin,\n\nI am submitting a Ban Appeal for my suspended TrackerX account.\n\n👤 Account Email: ${user.email}\n🏷️ Username: ${user.username}\n📝 Reason / Appeal Details: ${appealNotes ? appealNotes.trim() : "Requesting account review and reinstatement."}\n\nPlease review my account. Thank you!`;

  const whatsappLink = `https://wa.me/94752840841?text=${encodeURIComponent(whatsappAppealMessage)}`;

  const handleQuickSubmitAppeal = (e: React.FormEvent) => {
    e.preventDefault();
    setAppealSubmitted(true);
    window.open(whatsappLink, "_blank");
  };

  return (
    <div
      id="account-suspended-fullscreen-gate"
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-3 sm:p-5 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-rose-500/50 shadow-2xl rounded-3xl overflow-hidden p-6 sm:p-8 flex flex-col items-center text-center relative max-h-[94vh] overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-300">
        {/* Top Crimson Accent Bar */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-2 bg-gradient-to-r from-rose-600 via-red-400 to-rose-600 rounded-b-full shadow-lg shadow-rose-500/50" />

        {/* Lottie Animation for Suspended / Banned Account */}
        <div className="mb-4 mt-2">
          <AuthLottieAnimation type="account-suspended" className="w-24 h-24 sm:w-28 sm:h-28 mx-auto" />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-mono mb-3">
          <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
          <span>Access Revoked &bull; Account Suspended</span>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2 font-mono">
          Your Account Has Been Suspended
        </h2>

        {/* Notice Description */}
        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-5 bg-slate-950/80 border border-slate-800/90 p-4 rounded-2xl text-left">
          Access to TrackerX for <span className="text-white font-mono font-semibold">{user.email}</span> has been suspended or revoked by the Host Admin. If you believe this is a mistake or wish to submit a ban appeal, please contact the administrator immediately.
        </p>

        {/* Direct Call / Contact Box */}
        <div className="w-full bg-rose-950/30 border border-rose-500/30 rounded-2xl p-4 sm:p-5 mb-5 text-left space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-rose-300 uppercase font-mono font-bold tracking-wider">
              Direct Contact Support
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Host Admin HotLine</span>
          </div>

          <a
            href={`tel:${rawPhone}`}
            className="w-full py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-rose-500/40 text-white font-mono font-bold text-sm flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                <PhoneCall className="w-4 h-4 group-hover:animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Call Host Admin Directly:</span>
                <span className="text-rose-300 font-bold">{phoneContact}</span>
              </div>
            </div>
            <span className="text-xs text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
              Call Now
            </span>
          </a>
        </div>

        {/* Ban Appeal Form & WhatsApp Action */}
        <form onSubmit={handleQuickSubmitAppeal} className="w-full bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-5 text-left space-y-3">
          <div className="flex items-center gap-2 text-white text-xs font-bold font-mono uppercase">
            <MessageSquare className="w-4 h-4 text-rose-400" />
            <span>Submit Ban Appeal</span>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1.5 font-sans">
              State your appeal details or explanation for the Host Admin:
            </label>
            <textarea
              rows={2}
              value={appealNotes}
              onChange={(e) => setAppealNotes(e.target.value)}
              placeholder="e.g. Please review my account suspension..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-sans transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/60 transition-all font-mono"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit Ban Appeal on WhatsApp (+94 75 284 0841)</span>
          </button>
        </form>

        {/* Refresh Feedback */}
        {refreshFeedback && (
          <div className="text-[11px] text-rose-300 font-mono mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 animate-in fade-in w-full text-center">
            {refreshFeedback}
          </div>
        )}

        {/* Action Buttons */}
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
            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl transition-all text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 font-mono"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Checking Status..." : "Check Status"}</span>
          </button>
        </div>

        <p className="mt-4 text-[10px] text-slate-500 font-mono">
          Single Device Invariant: Bypass attempts are strictly blocked on client and server.
        </p>
      </div>
    </div>
  );
};
