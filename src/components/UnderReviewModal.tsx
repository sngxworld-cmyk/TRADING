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
    `Hello Host Admin, I am requesting full account activation for Trading Plan Pro.\n\nAccount Email: ${user.email}\nUsername: ${user.username}\nPayment verification requested.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-[560px] bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl overflow-hidden p-6 sm:p-8 flex flex-col items-center text-center relative max-h-[92vh] overflow-y-auto">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-2 bg-amber-500 rounded-b-full shadow-lg shadow-amber-500/50"></div>

        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mb-4 mt-2 shadow-inner shadow-amber-500/20">
          <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-1.5 font-mono">
          {isTrialExpired ? "5-Day Trial Period Expired" : "Account Under Review"}
        </h2>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-amber-500/30 text-amber-300 text-xs font-mono mb-4">
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>Single Device Policy Active &bull; Payment Required</span>
        </div>

        {/* Respectful Core Message */}
        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-5 bg-slate-950/70 border border-slate-800 p-4 rounded-xl text-left">
          Thank you for trying <span className="font-bold text-indigo-400">Trading Plan Pro</span>! Your 5-day trial period has expired. To continue enjoying full access to your trading workspace for <span className="text-slate-200 font-mono font-semibold">{user.email}</span>, please complete your payment subscription and log into your account. We appreciate your partnership!
        </p>

        {/* Strict 1-Registration Device Policy Banner */}
        <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 mb-5 text-left flex items-start gap-3">
          <Smartphone className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-200/90 leading-relaxed font-mono">
            <strong className="text-white block font-sans">1 Device = 1 Registration Limit:</strong>
            This device is permanently linked to <span className="text-white font-semibold">{user.email}</span>. New trial registrations from this device are blocked. Complete payment to clear this page and unlock full access.
          </div>
        </div>

        {/* Stepper Status Indicator */}
        <div className="w-full space-y-2.5 mb-5">
          <div className="bg-slate-800/60 rounded-xl p-3 flex items-center justify-between text-left border border-slate-700/50">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                Step 1: Trial Period
              </p>
              <p className="text-xs font-semibold text-emerald-400">
                5-Day Free Access Trial Completed
              </p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          </div>

          <div className="bg-amber-500/10 rounded-xl p-3 flex items-center justify-between text-left border border-amber-500/30">
            <div>
              <p className="text-[10px] text-amber-400/80 uppercase tracking-widest font-mono">
                Step 2: Subscription Clearance
              </p>
              <p className="text-xs font-semibold text-amber-400">
                Awaiting Payment Confirmation & Host Clearance
              </p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0"></div>
          </div>
        </div>

        {/* Payment & Contact Action */}
        <div className="bg-slate-950 border border-indigo-500/30 p-4 rounded-xl w-full mb-5 text-left">
          <div className="flex items-center gap-2 mb-2 text-indigo-300 text-xs font-bold font-mono uppercase">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <span>How to Pay & Unlock Access</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-normal mb-3">
            Contact Host Admin directly on WhatsApp or phone to finalize your subscription payment. Once processed, the Host Admin will approve your account and your trading workspace will unlock immediately.
          </p>

          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all font-mono"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Contact Host on WhatsApp (+94 75 284 0841)</span>
          </a>
        </div>

        {refreshFeedback && (
          <div className="text-[11px] text-slate-400 font-mono mb-3 animate-in fade-in">
            {refreshFeedback}
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full mb-2">
          <button
            onClick={onLogout}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-xl transition-all text-xs border border-slate-700 flex items-center justify-center gap-2 font-mono"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Switch Account</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-all text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 font-mono"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
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
