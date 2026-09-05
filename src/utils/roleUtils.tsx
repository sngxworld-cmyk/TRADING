import React from "react";
import { PlatformRole, UserProfile } from "../types";
import { Crown, ShieldCheck, Shield, CheckCircle2, User, Clock, Star, Award } from "lucide-react";

export function isPendingUser(user?: Partial<UserProfile> | null): boolean {
  if (!user) return true;
  const emailLower = (user.email || "").toLowerCase();
  if (emailLower === "sngxworld@gmail.com" || user.role === "admin" || user.platformRole === "owner") {
    return false;
  }
  return user.status !== "approved" || user.platformRole === "pending_user";
}

export function isSubOwnerExpired(user?: Partial<UserProfile> | null): boolean {
  if (!user || user.platformRole !== "sub_owner") return false;
  if (!user.subOwnerExpiresAt) return false;
  const expiry = new Date(user.subOwnerExpiresAt).getTime();
  return !isNaN(expiry) && Date.now() > expiry;
}

export function getSubOwnerTimeRemaining(user?: Partial<UserProfile> | null): {
  isExpired: boolean;
  text: string;
  days: number;
  hours: number;
  minutes: number;
} {
  if (!user || user.platformRole !== "sub_owner" || !user.subOwnerExpiresAt) {
    return { isExpired: false, text: "Permanent / Unlimited", days: 999, hours: 0, minutes: 0 };
  }
  const expiry = new Date(user.subOwnerExpiresAt).getTime();
  if (isNaN(expiry)) {
    return { isExpired: false, text: "Unlimited", days: 999, hours: 0, minutes: 0 };
  }
  const diffMs = expiry - Date.now();
  if (diffMs <= 0) {
    return { isExpired: true, text: "Expired", days: 0, hours: 0, minutes: 0 };
  }
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return {
    isExpired: false,
    text: days > 0 ? `${days}d ${hours}h left` : `${hours}h ${minutes}m left`,
    days,
    hours,
    minutes,
  };
}

export function normalizePlatformRole(raw?: any): PlatformRole {
  if (!raw) return "member";
  if (typeof raw !== "string") return "member";
  const lower = raw.trim().toLowerCase();

  // 1. Owner (Root)
  if (
    lower.includes("owner (root)") ||
    lower === "owner" ||
    lower.startsWith("1.") ||
    lower === "1" ||
    lower.includes("master root") ||
    lower.includes("master owner")
  ) {
    return "owner";
  }

  // 2. Sub-Owner (Co-Admin)
  if (
    lower.includes("sub-owner") ||
    lower.includes("sub_owner") ||
    lower.includes("co-admin") ||
    lower.startsWith("2.") ||
    lower === "2"
  ) {
    return "sub_owner";
  }

  // 3. Verified Signal Provider (≥85% WR)
  if (
    lower.includes("verified signal provider") ||
    lower.includes("verified_signal_provider") ||
    lower.includes("≥85%") ||
    lower.includes("85%") ||
    lower.startsWith("3.") ||
    lower === "3"
  ) {
    return "verified_signal_provider";
  }

  // 4. Moderator (Bug / Chat)
  if (
    lower.includes("moderator") ||
    lower.includes("bug / chat") ||
    lower.startsWith("4.") ||
    lower === "4"
  ) {
    return "moderator";
  }

  // 5. Signal Provider (Free)
  if (
    lower.includes("signal provider") ||
    lower.includes("signal_provider") ||
    lower.startsWith("5.") ||
    lower === "5"
  ) {
    return "signal_provider";
  }

  // 6. Member (Approved)
  if (
    lower.includes("member") ||
    lower.startsWith("6.") ||
    lower === "6"
  ) {
    return "member";
  }

  // 7. Pending User (Trial)
  if (
    lower.includes("pending") ||
    lower.includes("trial") ||
    lower.startsWith("7.") ||
    lower === "7"
  ) {
    return "pending_user";
  }

  return "member";
}

// In-memory cache of live roles
const userRoleCache = new Map<string, PlatformRole>();

export function cacheUserRole(email?: string | null, role?: any): void {
  if (!email || !role) return;
  const clean = email.trim().toLowerCase();
  const normalized = normalizePlatformRole(role);
  userRoleCache.set(clean, normalized);

  try {
    localStorage.setItem(`sngx_role_${clean}`, normalized);
    window.dispatchEvent(new CustomEvent("sngx_role_changed", { detail: { email: clean, role: normalized } }));
  } catch (e) {}
}

export function getUserLiveRole(email?: string | null): PlatformRole | null {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  if (clean === "sngxworld@gmail.com") return "owner";

  if (userRoleCache.has(clean)) {
    return userRoleCache.get(clean)!;
  }

  try {
    const directStored = localStorage.getItem(`sngx_role_${clean}`);
    if (directStored) {
      const norm = normalizePlatformRole(directStored);
      userRoleCache.set(clean, norm);
      return norm;
    }

    const raw = localStorage.getItem("sngx_local_users");
    if (raw) {
      const users = JSON.parse(raw);
      const found = users.find((u: any) => u.email && u.email.trim().toLowerCase() === clean);
      if (found && (found.platformRole || found.role)) {
        const norm = normalizePlatformRole(found.platformRole || (found.role === "admin" ? "owner" : "member"));
        userRoleCache.set(clean, norm);
        return norm;
      }
    }
  } catch (e) {}

  return null;
}

export function getEffectiveRole(user?: Partial<UserProfile> | null): PlatformRole {
  if (!user) return "pending_user";
  const emailLower = (user.email || "").toLowerCase().trim();
  const usernameLower = (user.username || "").toLowerCase().trim();
  if (emailLower === "sngxworld@gmail.com" || usernameLower === "sngxadmin009") {
    return "owner";
  }

  if (user.platformRole) {
    const norm = normalizePlatformRole(user.platformRole);
    if (norm === "sub_owner") {
      if (isSubOwnerExpired(user)) {
        return "member"; // Downgrades gracefully if sub-owner time limit elapsed
      }
      return "sub_owner";
    }
    return norm;
  }

  if (user.role === "admin") {
    return "owner";
  }
  if (user.status === "approved" || (user as any).subscribed || (user as any).isSubscribed || (user as any).wasApproved) {
    return "member";
  }
  return "pending_user";
}

export function getRoleConfig(role: PlatformRole) {
  switch (role) {
    case "owner":
      return {
        label: "OWNER",
        rankNumber: 1,
        badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-amber-500/10",
        pillClass: "bg-amber-500 text-slate-950",
        icon: Crown,
        iconColor: "text-amber-400",
        description: "Primary Host & System Owner",
      };
    case "sub_owner":
      return {
        label: "SUB OWNER",
        rankNumber: 2,
        badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-purple-500/10",
        pillClass: "bg-purple-500 text-white",
        icon: Award,
        iconColor: "text-purple-400",
        description: "Ecosystem Co-Owner & Administrator",
      };
    case "verified_signal_provider":
      return {
        label: "VERIFIED SIGNAL PROVIDER",
        rankNumber: 3,
        badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10",
        pillClass: "bg-emerald-500 text-slate-950",
        icon: CheckCircle2,
        iconColor: "text-emerald-400",
        description: "Top-Tier Signal Provider (≥85% Verified Win Rate)",
      };
    case "moderator":
      return {
        label: "MODERATOR",
        rankNumber: 4,
        badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-sky-500/10",
        pillClass: "bg-sky-500 text-slate-950",
        icon: Shield,
        iconColor: "text-sky-400",
        description: "Community Moderator & Security Officer",
      };
    case "signal_provider":
      return {
        label: "SIGNAL PROVIDER",
        rankNumber: 5,
        badgeClass: "bg-blue-500/15 text-blue-300 border-blue-500/40 shadow-blue-500/10",
        pillClass: "bg-blue-500 text-white",
        icon: Star,
        iconColor: "text-blue-400",
        description: "Public / Free Signal Group Creator",
      };
    case "member":
      return {
        label: "MEMBER",
        rankNumber: 6,
        badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
        pillClass: "bg-slate-700 text-slate-200",
        icon: User,
        iconColor: "text-slate-400",
        description: "Active Approved Trader",
      };
    case "pending_user":
    default:
      return {
        label: "PENDING USER",
        rankNumber: 7,
        badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
        pillClass: "bg-rose-500 text-white",
        icon: Clock,
        iconColor: "text-rose-400",
        description: "5-Day Trial / Pending Approval",
      };
  }
}

export const RoleBadge: React.FC<{
  role?: PlatformRole | string;
  user?: Partial<UserProfile> | null;
  email?: string;
  size?: "xs" | "sm" | "md";
  showIcon?: boolean;
  className?: string;
  hideOnCompact?: boolean;
}> = ({ role, user, email, size = "xs", showIcon = true, className = "", hideOnCompact = false }) => {
  const targetEmail = (email || user?.email)?.trim().toLowerCase();
  
  const [liveRole, setLiveRole] = React.useState<PlatformRole | null>(() => {
    return targetEmail ? getUserLiveRole(targetEmail) : null;
  });

  React.useEffect(() => {
    if (!targetEmail) return;

    // Set initial
    const initial = getUserLiveRole(targetEmail);
    if (initial) setLiveRole(initial);

    const handler = (e: any) => {
      const changedEmail = e.detail?.email?.trim().toLowerCase();
      if (!changedEmail || changedEmail === targetEmail) {
        setLiveRole(getUserLiveRole(targetEmail));
      }
    };

    window.addEventListener("sngx_role_changed", handler);
    return () => window.removeEventListener("sngx_role_changed", handler);
  }, [targetEmail]);

  const effectiveRole = liveRole
    ? liveRole
    : role
    ? normalizePlatformRole(role)
    : getEffectiveRole(user);

  const cfg = getRoleConfig(effectiveRole);
  const Icon = cfg.icon;

  const sizeClasses = {
    xs: "text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 gap-1",
    sm: "text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 gap-1.5",
    md: "text-sm px-2.5 sm:px-3 py-1 sm:py-1.5 gap-2",
  }[size];

  const iconSizes = {
    xs: "w-2.5 h-2.5 sm:w-3 sm:h-3",
    sm: "w-3 h-3 sm:w-3.5 sm:h-3.5",
    md: "w-3.5 h-3.5 sm:w-4 sm:h-4",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-mono font-bold uppercase rounded-md border tracking-wider shadow-sm whitespace-nowrap shrink-0 ${
        hideOnCompact ? "hidden sm:inline-flex" : ""
      } ${cfg.badgeClass} ${sizeClasses} ${className}`}
      title={cfg.description}
    >
      {showIcon && <Icon className={`${iconSizes} ${cfg.iconColor} shrink-0`} />}
      <span>({cfg.label})</span>
    </span>
  );
};
