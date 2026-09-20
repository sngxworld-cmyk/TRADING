import React, { useState, useEffect, useRef } from "react";
import { UserProfile } from "../types";
import { AuthLottieAnimation } from "./AuthLottieAnimation";
import { submitBanAppealToFirestore, cleanEmailKey } from "../lib/userStore";
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
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserX
} from "lucide-react";

interface AccountSuspendedModalProps {
  user: UserProfile;
  onRefreshStatus: () => void;
  onLogout: () => void;
  mode?: "banned" | "revoked-subscribed" | "generic";
}

export const AccountSuspendedModal: React.FC<AccountSuspendedModalProps> = ({
  user,
  onRefreshStatus,
  onLogout,
  mode,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [appealNotes, setAppealNotes] = useState("");
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState<boolean>(() => {
    try {
      const clean = cleanEmailKey(user.email);
      return !!localStorage.getItem(`sngx_ban_appeal_${clean}`) || !!user.banAppeal;
    } catch {
      return false;
    }
  });
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);
  const gateRef = useRef<HTMLDivElement>(null);

  const clean = cleanEmailKey(user.email);
  const isSubscribedUser = Boolean(
    user.subscribed ||
      user.isSubscribed ||
      user.hasSubscribed ||
      user.wasApproved ||
      (typeof window !== "undefined" && localStorage.getItem(`sngx_was_approved_${clean}`) === "true")
  );

  const isBanned = user.status === "banned" || mode === "banned";
  const isRevokedSubscribed =
    !isBanned && (user.status === "revoked" || mode === "revoked-subscribed") && isSubscribedUser;

  const phoneContact = "+94 75 284 0841";
  const rawPhone = "+94752840841";

  // Anti-tamper DOM Integrity Watchdog:
  // If an attacker attempts to delete or hide this element via DevTools Elements Inspector,
  // immediately restore visibility or reload the page.
  useEffect(() => {
    const target = gateRef.current;
    if (!target) return;

    // Prevent context menu (Inspect Element) and DevTools shortcut keys on the gate
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

    // MutationObserver to detect DOM deletions/style hacks
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
      setRefreshFeedback(
        isBanned
          ? "Checked: Your account is still Banned. Awaiting Master Owner appeal decision."
          : "Checked: Access remains Revoked. Contact Master Owner or Moderator."
      );
    } catch {
      setRefreshFeedback("Status check completed.");
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealNotes.trim()) return;

    setIsSubmittingAppeal(true);
    try {
      await submitBanAppealToFirestore(user.email, user.username, appealNotes.trim());
      setAppealSubmitted(true);

      // Also construct WhatsApp message for rapid admin notification
      const whatsappMsg = `Hello Master Owner,\n\nI am submitting an Official Ban Appeal for my TrackerX account.\n\n👤 Account Email: ${user.email}\n🏷️ Username: ${user.username}\n📝 Reason / Appeal Details: ${appealNotes.trim()}\n\nPlease review my appeal from the Host Admin app. Thank you!`;
      const waLink = `https://wa.me/94752840841?text=${encodeURIComponent(whatsappMsg)}`;
      window.open(waLink, "_blank");

      setRefreshFeedback("Appeal submitted successfully! It is now pending review by the Master Owner.");
    } catch (err: any) {
      setRefreshFeedback("Failed to submit appeal. Please contact the owner directly.");
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  return (
    <div
      ref={gateRef}
      id="account-suspended-fullscreen-gate"
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/98 backdrop-blur-2xl p-2.5 sm:p-5 overflow-y-auto select-none"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      <div className={`w-full max-w-lg bg-slate-900 border ${isBanned ? "border-rose-600/70 shadow-rose-950/60" : "border-amber-500/50 shadow-amber-950/50"} shadow-2xl rounded-2xl sm:rounded-3xl overflow-x-hidden p-4 sm:p-6 md:p-8 flex flex-col items-center text-center relative max-h-[92vh] overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-300`}>
        {/* Top Glowing Header Accent Bar */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 sm:w-64 h-2 ${isBanned ? "bg-gradient-to-r from-red-600 via-rose-500 to-red-700 shadow-rose-500/60" : "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 shadow-amber-500/60"} rounded-b-full shadow-lg`} />

        {/* Lottie Animation */}
        <div className="mb-3 mt-1">
          <AuthLottieAnimation
            type={isBanned ? "account-suspended" : "trial-expired"}
            className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 mx-auto"
          />
        </div>

        {/* Status Badge */}
        {isBanned ? (
          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11px] sm:text-xs font-mono mb-3 max-w-full flex-wrap text-center">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />
            <span>Account Banned &bull; Strict Lockout</span>
          </div>
        ) : isRevokedSubscribed ? (
          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] sm:text-xs font-mono mb-3 max-w-full flex-wrap text-center">
            <UserX className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Access Revoked &bull; Subscribed Account</span>
          </div>
        ) : (
          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11px] sm:text-xs font-mono mb-3 max-w-full flex-wrap text-center">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Account Suspended</span>
          </div>
        )}

        {/* Title */}
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight mb-2 font-mono">
          {isBanned
            ? "Your Account Has Been Banned"
            : isRevokedSubscribed
            ? "Your Access Has Been Revoked"
            : "Your Account Has Been Suspended"}
        </h2>

        {/* Subtitle for Revoked Subscribed */}
        {isRevokedSubscribed && (
          <p className="text-amber-400 font-bold text-xs sm:text-sm font-mono mb-2">
            Contact the Owner or a Moderator
          </p>
        )}

        {/* Description Box */}
        <p className="w-full text-slate-300 text-xs sm:text-sm leading-relaxed mb-4 bg-slate-950/80 border border-slate-800/90 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-left break-words">
          {isBanned ? (
            <>
              Your account <span className="text-white font-mono font-semibold break-all">{user.email}</span> has been strictly banned by the Host Administrator. All trial privileges and workspace access are locked out. You cannot use TrackerX unless you submit a ban appeal and the Master Owner approves it.
            </>
          ) : isRevokedSubscribed ? (
            <>
              Your subscribed account access for <span className="text-white font-mono font-semibold break-all">{user.email}</span> has been revoked by administration. To restore your trading workspace and journal, please reach out directly to the Master Owner or an official Moderator.
            </>
          ) : (
            <>
              Access for <span className="text-white font-mono font-semibold break-all">{user.email}</span> has been suspended. Please contact the administrator.
            </>
          )}
        </p>

        {/* Ban Reason Box if provided */}
        {user.bannedReason && (
          <div className="w-full bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 sm:p-4 mb-4 text-left break-words">
            <span className="text-[10px] text-rose-300 uppercase font-mono font-bold tracking-wider block mb-1">
              Stated Reason from Host Admin:
            </span>
            <p className="text-xs text-rose-200 font-sans italic">"{user.bannedReason}"</p>
          </div>
        )}

        {/* Direct Contact Buttons */}
        <div className={`w-full ${isBanned ? "bg-rose-950/30 border-rose-500/30" : "bg-amber-950/30 border-amber-500/30"} border rounded-xl sm:rounded-2xl p-3.5 sm:p-4 mb-4 text-left space-y-2.5`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] ${isBanned ? "text-rose-300" : "text-amber-300"} uppercase font-mono font-bold tracking-wider`}>
              Official Hotline
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Master Owner Hotline</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              href={`tel:${rawPhone}`}
              className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-emerald-400 group-hover:animate-bounce shrink-0" />
                <span>Call Owner</span>
              </div>
              <span className="text-[10px] text-slate-400 font-sans">{phoneContact}</span>
            </a>

            <a
              href={`https://wa.me/94752840841?text=${encodeURIComponent(
                isBanned
                  ? `Hello Master Owner, my TrackerX account (${user.email}) was banned. I am reaching out to discuss my appeal.`
                  : `Hello Master Owner / Moderator, my subscribed TrackerX account (${user.email}) access was revoked. Please assist me in restoring access.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>WhatsApp Owner</span>
            </a>
          </div>
        </div>

        {/* Ban Appeal Section for Banned Users */}
        {isBanned && (
          <div className="w-full bg-slate-950/90 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 mb-4 text-left">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-white text-xs font-bold font-mono uppercase">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Submit Ban Appeal</span>
              </div>
              {appealSubmitted && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Pending Review</span>
                </span>
              )}
            </div>

            {appealSubmitted ? (
              <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl text-xs text-amber-200 font-sans leading-relaxed">
                Your ban appeal has been recorded and submitted to the Master Owner. If the appeal is accepted, the owner will unban your account and access will be immediately restored. You can click <span className="font-bold text-white font-mono">Check Status</span> below at any time.
              </div>
            ) : (
              <form onSubmit={handleAppealSubmit} className="space-y-2.5">
                <label className="text-[11px] text-slate-400 block font-sans">
                  Provide your appeal explanation for the Master Owner:
                </label>
                <textarea
                  rows={2}
                  value={appealNotes}
                  onChange={(e) => setAppealNotes(e.target.value)}
                  placeholder="Explain why your ban should be reviewed or lifted..."
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-2.5 sm:p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-sans transition-colors resize-none"
                  required
                />
                <button
                  type="submit"
                  disabled={isSubmittingAppeal || !appealNotes.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/60 transition-all font-mono"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingAppeal ? "Submitting Appeal..." : "Submit Ban Appeal to Master Owner"}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Feedback Message */}
        {refreshFeedback && (
          <div className="text-[11px] text-slate-300 font-mono mb-3 p-2.5 rounded-xl bg-slate-950 border border-slate-700/60 animate-in fade-in w-full text-center">
            {refreshFeedback}
          </div>
        )}

        {/* Bottom Actions */}
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
            className={`flex-1 ${
              isBanned ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30" : "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30"
            } text-white font-bold py-3 px-4 rounded-xl transition-all text-xs shadow-lg flex items-center justify-center gap-2 font-mono`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Checking..." : "Check Status"}</span>
          </button>
        </div>

        <p className="mt-4 text-[10px] text-slate-500 font-mono">
          Security Gate: App DOM is completely unmounted. Bypass attempts are permanently blocked.
        </p>
      </div>
    </div>
  );
};
