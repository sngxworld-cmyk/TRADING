import React, { useState, useEffect, useRef } from "react";
import { UserProfile } from "../types";
import {
  ShieldCheck,
  UserCheck,
  Clock,
  HelpCircle,
  User,
  MoreVertical,
  Settings,
  FileSpreadsheet,
  RotateCcw,
  Repeat,
  Sparkles,
  LogOut,
  Sliders,
  Radio,
  BookOpen,
  Users,
  MessageSquare,
  TrendingUp,
  ShieldAlert,
  Check,
  UserX,
} from "lucide-react";
import { getEffectiveRole } from "../utils/roleUtils";
import { getTrialRemainingMs, isUserExemptFromTrial } from "../utils/deviceUtils";
import { cleanEmailKey } from "../lib/userStore";

interface NavbarProps {
  user: UserProfile | null;
  onLogout: () => void;
  onRefreshStatus?: () => void;
  onReplayTutorial?: () => void;
  onOpenProfile?: () => void;
  onOpenSetup?: () => void;
  onExportExcel?: () => void;
  onResetJournal?: () => void;
  activeView?: "journal" | "community";
  onToggleView?: (view: "journal" | "community") => void;
  communityTab?: "chat" | "groups" | "dms";
  onSelectCommunityTab?: (tab: "chat" | "groups" | "dms") => void;
  onOpenGuidelines?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  onReplayTutorial,
  onOpenProfile,
  onOpenSetup,
  onExportExcel,
  onResetJournal,
  activeView = "journal",
  onToggleView,
  communityTab = "chat",
  onSelectCommunityTab,
  onOpenGuidelines,
}) => {
  const [now, setNow] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Close 3-dots menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  const effectiveRole = user ? getEffectiveRole(user) : "pending_user";
  const isOwner =
    effectiveRole === "owner" ||
    user?.email.toLowerCase() === "sngxworld@gmail.com" ||
    user?.username.toLowerCase() === "sngxadmin009";

  const cleanEmail = cleanEmailKey(user?.email || "");
  const isSubscribedUser = Boolean(
    user?.subscribed ||
      user?.isSubscribed ||
      user?.hasSubscribed ||
      user?.wasApproved ||
      (typeof window !== "undefined" && localStorage.getItem(`sngx_was_approved_${cleanEmail}`) === "true")
  );

  const isExempt = user ? isUserExemptFromTrial(user) : false;
  const remainingMs = user && !isExempt ? getTrialRemainingMs(user) : 0;
  const isBanned = !isOwner && user?.status === "banned";
  const isRevokedSubscribed = !isOwner && !isBanned && user?.status === "revoked" && isSubscribedUser;
  const isSuspended = isBanned || isRevokedSubscribed || (!isOwner && user?.status === "rejected");
  const isApproved = (user?.status === "approved" || isOwner || isExempt || isSubscribedUser) && !isSuspended;
  const isRevokedTrialActive = !isOwner && !isBanned && user?.status === "revoked" && !isSubscribedUser && remainingMs > 0;
  const isTrialActive = !isOwner && !isExempt && !isBanned && !isSuspended && !isApproved && remainingMs > 0;

  const validMs = isFinite(remainingMs) && remainingMs > 0 ? remainingMs : 0;
  const days = Math.floor(validMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((validMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((validMs % (1000 * 60)) / (1000 * 60));
  const seconds = Math.floor((validMs % (1000 * 60)) / 1000);

  return (
    <nav
      id="main-navbar"
      className="min-h-16 border-b border-slate-800/90 bg-slate-900/95 backdrop-blur-md flex flex-wrap items-center justify-between px-3 sm:px-6 lg:px-8 py-2.5 gap-2 shrink-0 z-50 sticky top-0 shadow-lg shadow-black/40"
    >
      {/* Left: TrackerX Branding */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-1.5 cursor-pointer select-none">
          <span className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono flex items-center">
            Tracker<span className="text-blue-400">X</span>
          </span>
          <span className="text-[10px] bg-blue-950/60 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-md font-mono font-bold tracking-widest uppercase">
            PRO
          </span>
        </div>

        {/* View Switcher Tabs (Only available when account is active) */}
        {onToggleView && !isSuspended && (isApproved || isTrialActive) && (
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 ml-1 sm:ml-2 font-mono text-[11px] sm:text-xs shrink-0">
            <button
              id="nav-tab-journal"
              onClick={() => onToggleView("journal")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeView === "journal"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Trading </span>Journal
            </button>
            <button
              id="nav-tab-community"
              onClick={() => onToggleView("community")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeView === "community"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Community</span>
              {activeView === "community" ? (
                <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Status & Trial Countdown Indicator */}
        {user && (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] sm:text-xs shadow-inner shrink-0">
            {isOwner ? (
              <>
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-purple-300 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3 h-3 text-purple-400" /> <span className="hidden sm:inline">Host </span>Master Admin
                </span>
              </>
            ) : user.role === "admin" || effectiveRole === "sub_owner" || effectiveRole === "moderator" ? (
              <>
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-blue-300 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3 h-3 text-blue-400" /> Admin
                </span>
              </>
            ) : isBanned ? (
              <div className="flex items-center gap-1.5 text-rose-400 font-mono text-[10px] font-semibold uppercase">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Account Banned</span>
              </div>
            ) : isRevokedSubscribed ? (
              <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[10px] font-semibold uppercase">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Access Revoked</span>
              </div>
            ) : isRevokedTrialActive ? (
              <div className="flex items-center gap-1 sm:gap-1.5 text-amber-300 font-mono text-[10px] sm:text-[11px] font-semibold">
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                <span>
                  Revoked (Trial: <span className="text-white font-bold">{days}d {hours}h</span>)
                </span>
              </div>
            ) : isApproved || user.status === "approved" || isSubscribedUser || isExempt ? (
              <>
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-blue-300 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1 font-mono">
                  <UserCheck className="w-3 h-3" /> Full Access
                </span>
              </>
            ) : user.status === "rejected" ? (
              <div className="flex items-center gap-1.5 text-rose-400 font-mono text-[10px] font-semibold uppercase">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Access Declined</span>
              </div>
            ) : isTrialActive ? (
              <div className="flex items-center gap-1 sm:gap-1.5 text-blue-300 font-mono text-[10px] sm:text-[11px] font-semibold">
                <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse shrink-0" />
                <span>
                  Trial: <span className="text-white font-bold">{days}d {hours}h {minutes}m</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[10px] font-semibold uppercase">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Trial Expired</span>
              </div>
            )}
          </div>
        )}

        {/* Profile Button */}
        {user && (
          <button
            id="nav-profile-btn"
            onClick={onOpenProfile}
            title="Profile Editor & Settings"
            className="group p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-white border border-slate-700/80 hover:border-blue-500/50 transition-all flex items-center gap-2 shrink-0 shadow-sm"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.username}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-blue-500/80 shadow-md group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-300 shadow-inner overflow-hidden shrink-0">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-blue-900/60 mb-[-6px] flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            )}
            <span className="text-xs font-semibold text-white hidden md:inline-block">
              {user.displayName || user.username}
            </span>
          </button>
        )}

        {/* THREE DOTS MENU BUTTON (`...`) */}
        <div className="relative" ref={menuRef}>
          <button
            id="nav-three-dots-btn"
            onClick={() => setMenuOpen((prev) => !prev)}
            title="More Options & Settings"
            className={`p-2 rounded-xl border transition-all ${
              menuOpen
                ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/40"
                : "bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:border-slate-600"
            }`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div
              id="nav-three-dots-dropdown"
              className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-900/98 border border-slate-700 rounded-2xl shadow-2xl shadow-black/90 backdrop-blur-2xl p-2.5 z-[100] text-white animate-in fade-in zoom-in-95 duration-150 space-y-1.5 font-mono text-xs max-h-[calc(100vh-80px)] overflow-y-auto"
            >
              {/* Account Access / Trial Status */}
              <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-300 font-bold text-[11px]">Account Access</span>
                </div>
                <div>
                  {isOwner ? (
                    <span className="text-[10px] font-bold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                      Master Admin
                    </span>
                  ) : user?.status === "approved" ? (
                    <span className="text-[10px] font-bold text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-500/30">
                      Full Access
                    </span>
                  ) : user?.status === "banned" ? (
                    <span className="text-[10px] font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                      Banned
                    </span>
                  ) : user?.status === "revoked" ? (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                      Revoked
                    </span>
                  ) : user?.status === "rejected" ? (
                    <span className="text-[10px] font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                      Declined
                    </span>
                  ) : isTrialActive ? (
                    <span className="text-[10px] font-bold text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-500/30">
                      {days}d {hours}h {minutes}m
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                      Trial Ended
                    </span>
                  )}
                </div>
              </div>

              {/* Only show navigation and actions if account is active */}
              {!isSuspended && (isApproved || isTrialActive) && (
                <>
                  {/* ========================================================= */}
                  {/* COMMUNITY HUB SPECIFIC 3-DOTS OPTIONS                      */}
                  {/* ========================================================= */}
                  {activeView === "community" ? (
                <>
                  <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                    Community Navigation
                  </div>

                  {/* 1. Chat Room View */}
                  <button
                    id="menu-community-chat-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      onSelectCommunityTab?.("chat");
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors ${
                      communityTab === "chat"
                        ? "bg-blue-600/20 text-blue-300 border border-blue-500/40 font-bold"
                        : "hover:bg-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">Live Chat Room</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Public trader discussions & news
                        </div>
                      </div>
                    </div>
                    {communityTab === "chat" && <Check className="w-4 h-4 text-blue-400" />}
                  </button>

                  {/* 2. Signal Groups View */}
                  <button
                    id="menu-community-groups-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      onSelectCommunityTab?.("groups");
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors ${
                      communityTab === "groups"
                        ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 font-bold"
                        : "hover:bg-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">Signal Groups</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Free & Verified VIP Signals
                        </div>
                      </div>
                    </div>
                    {communityTab === "groups" && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>

                  {/* 3. Direct Messages View */}
                  <button
                    id="menu-community-dms-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      onSelectCommunityTab?.("dms");
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors ${
                      communityTab === "dms"
                        ? "bg-purple-600/20 text-purple-300 border border-purple-500/40 font-bold"
                        : "hover:bg-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">Direct Messages</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Private 1-on-1 conversations
                        </div>
                      </div>
                    </div>
                    {communityTab === "dms" && <Check className="w-4 h-4 text-purple-400" />}
                  </button>

                  {/* 4. Community Guidelines */}
                  <button
                    id="menu-community-guidelines-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      if (onOpenGuidelines) {
                        onOpenGuidelines();
                      } else {
                        window.dispatchEvent(new CustomEvent("trackerx:open-guidelines"));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors border-t border-slate-800/80 pt-2 mt-1"
                  >
                    <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">Community Guidelines</div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        Conduct rules, safety & provider policies
                      </div>
                    </div>
                  </button>

                  {/* 5. Switch to Trading Journal */}
                  {onToggleView && (
                    <button
                      id="menu-switch-to-journal-btn"
                      onClick={() => {
                        setMenuOpen(false);
                        onToggleView("journal");
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                    >
                      <BookOpen className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">Switch to Trading Journal</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Daily compounding grid & trade log
                        </div>
                      </div>
                    </button>
                  )}
                </>
              ) : (
                /* ========================================================= */
                /* TRADING JOURNAL SPECIFIC 3-DOTS OPTIONS                   */
                /* ========================================================= */
                <>
                  {/* Edit Starting Months & Years */}
                  {onOpenSetup && (
                    <button
                      id="menu-edit-setup-btn"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenSetup();
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                    >
                      <Sliders className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">Edit Starting Months & Years</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Change baseline capital, starting year and month
                        </div>
                      </div>
                    </button>
                  )}

                  {/* 3D AI Robot Intro Walkthrough */}
                  {onReplayTutorial && (
                    <button
                      id="menu-replay-tutorial-btn"
                      onClick={() => {
                        setMenuOpen(false);
                        onReplayTutorial();
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                    >
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">3D AI Robot Intro</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Replay 3D mentor interactive walkthrough
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Switch to Community */}
                  {onToggleView && (
                    <button
                      id="menu-switch-view-btn"
                      onClick={() => {
                        setMenuOpen(false);
                        onToggleView("community");
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                    >
                      <Repeat className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">Switch to Community Hub</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Live chat, signals & trader network
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Excel Export */}
                  {onExportExcel && (
                    <button
                      id="menu-export-excel-btn"
                      onClick={() => {
                        setMenuOpen(false);
                        onExportExcel();
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">Export Excel Workbook</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Download formatted .xlsx trade report
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Reset Journal */}
                  {onResetJournal && (
                    <button
                      id="menu-reset-journal-btn"
                      onClick={() => {
                        setMenuOpen(false);
                        onResetJournal();
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-rose-950/40 text-left flex items-center gap-2.5 text-rose-300 hover:text-rose-200 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">Reset Trade Journal</div>
                        <div className="text-[10px] text-rose-300/70 font-sans">
                          Clear journal records across all 4 tiers
                        </div>
                      </div>
                    </button>
                  )}
                </>
              )}

              {/* Profile Editor */}
              {onOpenProfile && (
                <button
                  id="menu-profile-btn"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors border-t border-slate-800"
                >
                  <User className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <div className="font-bold text-xs">Your Trader Profile</div>
                    <div className="text-[10px] text-slate-400 font-sans">
                      Manage avatar, username, bio, and settings
                    </div>
                  </div>
                </button>
              )}
            </>
          )}

              {/* Logout */}
              <button
                id="menu-logout-btn"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left flex items-center gap-2.5 text-slate-400 hover:text-rose-300 transition-colors"
              >
                <LogOut className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="font-bold text-xs">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
