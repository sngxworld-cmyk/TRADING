import React from "react";
import { UserProfile } from "../types";
import { ShieldCheck, UserCheck, Clock, HelpCircle, User } from "lucide-react";
import { getEffectiveRole } from "../utils/roleUtils";

interface NavbarProps {
  user: UserProfile | null;
  onLogout: () => void;
  onRefreshStatus?: () => void;
  onReplayTutorial?: () => void;
  onOpenProfile?: () => void;
  activeView?: "journal" | "community";
  onToggleView?: (view: "journal" | "community") => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  onReplayTutorial,
  onOpenProfile,
  activeView = "journal",
  onToggleView,
}) => {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const effectiveRole = user ? getEffectiveRole(user) : "pending_user";
  const isOwner =
    effectiveRole === "owner" ||
    user?.email.toLowerCase() === "sngxworld@gmail.com" ||
    user?.username.toLowerCase() === "sngxadmin009";
  const isApproved = user?.status === "approved" || isOwner;
  const createdTime = user?.createdAt ? new Date(user.createdAt).getTime() : Date.now();
  const remainingMs = Math.max(0, 5 * 24 * 60 * 60 * 1000 - (now - createdTime));
  const isTrialActive = !isApproved && remainingMs > 0;

  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

  return (
    <nav className="min-h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex flex-wrap items-center justify-between px-2.5 sm:px-6 lg:px-8 py-2 gap-2 shrink-0 z-30 sticky top-0">
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30 text-xs sm:text-sm shrink-0">
          TJ
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-base md:text-lg font-bold tracking-tight text-slate-100 truncate">
              Trade Journal <span className="text-indigo-400 font-extrabold">Pro</span>
            </span>
            <span className="hidden lg:inline-block text-[10px] bg-slate-800 text-indigo-400 border border-slate-700 px-2 py-0.5 rounded font-mono">
              v2.4 CORE
            </span>
          </div>
          <span className="hidden sm:block text-[10px] text-slate-500 font-mono tracking-wider uppercase truncate">
            SNGxJOURNAL Ecosystem Matrix
          </span>
        </div>

        {/* View Switcher Tabs - Responsive on iPad Portrait & Landscape */}
        {onToggleView && (
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 ml-1 sm:ml-2 lg:ml-4 font-mono text-[11px] sm:text-xs shrink-0">
            <button
              onClick={() => onToggleView("journal")}
              className={`px-2 sm:px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeView === "journal"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="hidden xs:inline">Trading </span>Journal
            </button>
            <button
              onClick={() => onToggleView("community")}
              className={`px-2 sm:px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeView === "community"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Community<span className="hidden md:inline"> & Signals</span></span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Status & Trial Countdown Indicator */}
        {user && (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] sm:text-xs shadow-inner shrink-0">
            {isOwner ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span className="text-amber-400 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3 h-3 text-amber-400" /> <span className="hidden sm:inline">Host </span>Master Admin
                </span>
              </>
            ) : user.status === "approved" ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-emerald-400 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1 font-mono">
                  <UserCheck className="w-3 h-3" /> Full Access
                </span>
              </>
            ) : isTrialActive ? (
              <div className="flex items-center gap-1 sm:gap-1.5 text-amber-400 font-mono text-[10px] sm:text-[11px] font-semibold">
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                <span>
                  Trial: <span className="text-white font-bold">{days}d {hours}h {minutes}m</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-rose-400 font-mono text-[10px] font-semibold uppercase">
                <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Trial Expired</span>
              </div>
            )}
          </div>
        )}

        {/* User Gmail badge & tutorial & Profile Button */}
        {user ? (
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {onReplayTutorial && (
              <button
                onClick={onReplayTutorial}
                title="Replay 3D AI Tutorial / 3D නිබන්ධනය බලන්න"
                className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-300 border border-indigo-500/30 text-xs font-mono flex items-center gap-1.5 transition-colors shrink-0"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">3D Tutorial</span>
              </button>
            )}

            <div className="text-right hidden xl:block">
              <p className="text-xs font-semibold text-slate-200 font-mono truncate max-w-[120px] sm:max-w-[150px]">
                {user.displayName || user.email}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-tighter truncate">
                @{user.username}
              </p>
            </div>

            {/* Profile Button */}
            <button
              onClick={onOpenProfile}
              title="Profile Editor & Settings"
              className="group p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-indigo-500/50 transition-all flex items-center gap-2 shrink-0 shadow-sm"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.username}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-indigo-500/80 shadow-md group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-300 shadow-inner overflow-hidden shrink-0">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-slate-600/70 mb-[-6px] flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-slate-200" />
                  </div>
                </div>
              )}
              <span className="text-xs font-semibold text-slate-200 hidden md:inline-block">
                Profile
              </span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-lg font-mono">
            Auth Required
          </div>
        )}
      </div>
    </nav>
  );
};
