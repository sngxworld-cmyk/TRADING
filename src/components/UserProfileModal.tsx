import React, { useState } from "react";
import { UserProfile, SignalGroup } from "../types";
import { RoleBadge, getEffectiveRole, isPendingUser } from "../utils/roleUtils";
import { X, MessageSquare, UserPlus, EyeOff, Eye, Calendar, Shield, Sparkles, Check, Lock } from "lucide-react";
import { getSignalGroups } from "../lib/communityStore";

interface UserProfileModalProps {
  targetUser: {
    email: string;
    username: string;
    displayName?: string;
    photoURL?: string;
    role?: any;
    platformRole?: any;
    status?: any;
    createdAt?: string;
    bio?: string;
    tradingPair?: string;
    tradingMarket?: string;
    hideIdentity?: boolean;
  };
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onStartDM: (targetUser: { email: string; username: string; displayName?: string }) => void;
  onSendJoinRequest?: (group: SignalGroup) => void;
  onUpdateCurrentUser?: (updated: UserProfile) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  targetUser,
  currentUser,
  isOpen,
  onClose,
  onStartDM,
  onSendJoinRequest,
  onUpdateCurrentUser,
}) => {
  if (!isOpen) return null;

  const isSelf = targetUser.email.toLowerCase() === currentUser.email.toLowerCase();
  const [hideIdentity, setHideIdentity] = useState(currentUser.hideIdentity || false);
  const [savedNotice, setSavedNotice] = useState(false);

  // Calculate platform account age (Slide 13)
  const createdDate = targetUser.createdAt ? new Date(targetUser.createdAt) : new Date();
  const diffDays = Math.max(1, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
  const ageString = diffDays === 1 ? "1 day old" : `${diffDays} days old`;

  // Find if this target user owns a signal group
  const allGroups = getSignalGroups();
  const ownedGroup = allGroups.find(
    (g) => g.adminEmail.toLowerCase() === targetUser.email.toLowerCase()
  );

  const handleToggleHideIdentity = () => {
    const newVal = !hideIdentity;
    setHideIdentity(newVal);
    const updated = { ...currentUser, hideIdentity: newVal };
    if (onUpdateCurrentUser) onUpdateCurrentUser(updated);

    // Save to server
    fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentUser.email, updates: { hideIdentity: newVal } }),
    }).catch(() => {});

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header with decorative background */}
        <div className="h-24 bg-gradient-to-r from-indigo-900 via-slate-800 to-slate-900 relative p-4 flex justify-end">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-950/60 hover:bg-slate-900 text-slate-300 flex items-center justify-center transition-colors border border-slate-700/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Card Content */}
        <div className="px-6 pb-6 pt-0 relative">
          {/* Avatar Photo */}
          <div className="-mt-12 mb-3 flex items-end justify-between">
            <div className="w-20 h-20 rounded-2xl bg-slate-800 border-4 border-slate-900 overflow-hidden shadow-xl flex items-center justify-center text-slate-400 font-bold text-2xl font-mono">
              {targetUser.photoURL ? (
                <img
                  src={targetUser.photoURL}
                  alt={targetUser.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-indigo-400 uppercase">
                  {targetUser.username.substring(0, 2)}
                </span>
              )}
            </div>

            <RoleBadge
              role={targetUser.platformRole || getEffectiveRole(targetUser as any)}
              size="sm"
            />
          </div>

          {/* Name & Username */}
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-100 font-mono flex items-center gap-2">
              {targetUser.displayName || targetUser.username}
              {targetUser.hideIdentity && !isSelf && (
                <span className="text-[10px] text-slate-500 font-normal font-sans bg-slate-800 px-2 py-0.5 rounded">
                  (Anonymous)
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 font-mono">@{targetUser.username}</p>
          </div>

          {/* User Bio / Stats */}
          {targetUser.bio && (
            <p className="mt-3 text-xs text-slate-300 italic bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
              "{targetUser.bio}"
            </p>
          )}

          {/* Platform Age & Trading Pair */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Platform Age</span>
                <strong className="text-slate-200">{ageString}</strong>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Trading Market</span>
                <strong className="text-slate-200">{targetUser.tradingMarket || targetUser.tradingPair || "Crypto Market"}</strong>
              </div>
            </div>
          </div>

          {/* Guideline Banner for Harassment / Conduct */}
          <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center gap-2 text-[11px] text-rose-300 font-sans">
            <Shield className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong className="font-semibold text-rose-200">Community Safety Rule:</strong> Harassment of any user leads to an <strong>immediate permanent ban</strong>.
            </span>
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-2">
            {!isSelf && (
              <>
                <button
                  onClick={() => {
                    onClose();
                    onStartDM({
                      email: targetUser.email,
                      username: targetUser.username,
                      displayName: targetUser.displayName,
                    });
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all font-mono"
                >
                  <MessageSquare className="w-4 h-4" /> Direct Message
                </button>

                {ownedGroup && (
                  <button
                    onClick={() => {
                      if (onSendJoinRequest) onSendJoinRequest(ownedGroup);
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all font-mono"
                  >
                    <UserPlus className="w-4 h-4" /> Send Join {ownedGroup.name} Request
                  </button>
                )}
              </>
            )}

            {/* Privacy Feature: Hide Identity (Slide 13) */}
            {isSelf && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                    <EyeOff className="w-3.5 h-3.5 text-indigo-400" /> Hide My Identity
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Mask your name & email from public users in the web app
                  </span>
                </div>
                <button
                  onClick={handleToggleHideIdentity}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                    hideIdentity
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {hideIdentity ? "HIDDEN" : "PUBLIC"}
                </button>
              </div>
            )}

            {savedNotice && (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs text-center font-mono flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5" /> Privacy preference updated!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
