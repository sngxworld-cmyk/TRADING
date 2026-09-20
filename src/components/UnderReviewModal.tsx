import React, { useState } from "react";
import { UserProfile } from "../types";
import { Clock, CheckCircle2, RefreshCw, LogOut, ShieldAlert, CreditCard, MessageCircle, Smartphone, Lock } from "lucide-react";

interface UnderReviewModalProps {
  user: UserProfile;
  onRefreshStatus: () => void;
  onLogout: () => void;
  isTrialExpired?: boolean;
}

export const UnderReviewModal: React.FC<UnderReviewModalProps> = ({
  user,
  onRefreshStatus,
  onLogout,
  isTrialExpired = true,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshFeedback(null);
    try {
      await onRefreshStatus();
      setRefreshFeedback("Checked: Still awaiting Host Admin payment clearance.");
    } catch {
      setRefreshFeedback("Network check completed.");
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  const whatsappLink = `https://wa.me/94752840841?text=${encodeURIComponent(
    `Hello Host Admin, I am requesting full account activation for TrackerX journal.\n\nAccount Email: ${user.email}\nUsername: ${user.username}\nPayment verification requested.`
  )}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-2.5 sm:p-4 animate-in fade-in duration-300 select-none">
      <div className="w-full max-w-[540px] bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl overflow-x-hidden p-4 sm:p-6 md:p-8 flex flex-col items-center text-center relative max-h-[92vh] overflow-y-auto">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-2 bg-gradient-to-r from-blue-500 via-white to-purple-500 rounded-b-full shadow-lg shadow-blue-500/50"></div>

        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center mb-3 mt-1 shadow-inner shadow-blue-500/20">
          <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-blue-400 animate-pulse" />
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1.5 font-mono">
          {isTrialExpired ? "5-Day Trial Period Expired" : "Account Under Review"}
        </h2>

        <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-purple-500/30 text-purple-300 text-[11px] sm:text-xs font-mono mb-3 max-w-full flex-wrap text-center">
          <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>Single Device Policy Active &bull; Payment Required</span>
        </div>

        {/* Respectful Core Message */}
        <p className="w-full text-slate-300 text-xs sm:text-sm leading-relaxed mb-4 bg-slate-950/70 border border-slate-800 p-3.5 sm:p-4 rounded-xl text-left break-words">
          Thank you for trying <span className="font-bold text-white inline-flex items-baseline font-mono"><span>Tracker</span><span className="text-[1.25em] text-blue-400 font-black leading-none ml-[0.5px]">X</span><sub className="text-[11px] font-bold text-slate-400 lowercase tracking-normal ml-0.5 relative -bottom-[1px]">journal</sub></span>! Your 5-day trial period has expired. To continue enjoying full access to your trading workspace for <span className="text-white font-mono font-semibold break-all">{user.email}</span>, please complete your payment subscription and log into your account. We appreciate your partnership!
        </p>

        {/* Strict 1-Registration Device Policy Banner */}
        <div className="w-full bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 mb-4 text-left flex items-start gap-3">
          <Smartphone className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-200/90 leading-relaxed font-mono break-words">
            <strong className="text-white block font-sans">1 Device = 1 Registration Limit:</strong>
            This device is permanently linked to <span className="text-white font-semibold break-all">{user.email}</span>. New trial registrations from this device are blocked. Complete payment to clear this page and unlock full access.
          </div>
        </div>

        {/* Stepper Status Indicator */}
        <div className="w-full space-y-2 mb-4">
          <div className="bg-slate-800/60 rounded-xl p-3 flex items-center justify-between text-left border border-slate-700/50">
            <div>
              <p className="text-[10px] text-blue-200/60 uppercase tracking-widest font-mono">
                Step 1: Trial Period
              </p>
              <p className="text-xs font-semibold text-blue-400">
                5-Day Free Access Trial Completed
              </p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
          </div>

          <div className="bg-purple-950/40 rounded-xl p-3 flex items-center justify-between text-left border border-purple-500/30">
            <div>
              <p className="text-[10px] text-purple-300/80 uppercase tracking-widest font-mono">
                Step 2: Subscription Clearance
              </p>
              <p className="text-xs font-semibold text-purple-300">
                Awaiting Payment Confirmation & Host Clearance
              </p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping shrink-0"></div>
          </div>
        </div>

        {/* Payment & Contact Action */}
        <div className="bg-slate-950 border border-blue-500/30 p-3.5 sm:p-4 rounded-xl w-full mb-4 text-left">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-blue-300 text-xs font-bold font-mono uppercase">
              <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Lifetime Plan Payment</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-mono font-bold border border-amber-500/40">
              350 LKR (~$1.20 USD)
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-normal mb-3">
            Contact the Host Admin directly on WhatsApp to complete your one-time 350 LKR payment for lifetime access. Once confirmed, your trading workspace will unlock immediately.
          </p>

          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all font-mono text-center"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span className="break-words">Pay via WhatsApp (+94 75 284 0841)</span>
          </a>
        </div>

        {refreshFeedback && (
          <div className="text-[11px] text-blue-200/70 font-mono mb-3 animate-in fade-in">
            {refreshFeedback}
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 w-full mb-2">
          <button
            type="button"
            onClick={onLogout}
            className="w-full sm:flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-xl transition-all text-xs border border-slate-700 flex items-center justify-center gap-2 font-mono"
          >
            <LogOut className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Switch Account</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 font-mono"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Verifying..." : "Refresh Access Status"}</span>
          </button>
        </div>

        <p className="mt-3 text-[10px] text-slate-500 font-mono">
          Auto-polling active: Your screen will unlock automatically the moment the Host Admin approves your payment.
        </p>
      </div>
    </div>
  );
};
