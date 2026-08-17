import { ChatMessage, GroupChatMessage, SignalGroup, SignalItem, DirectMessage, PlatformRole, UserProfile } from "../types";
import { getEffectiveRole, isPendingUser } from "../utils/roleUtils";

const CHAT_STORAGE_KEY = "sngx_community_chat_v2";
const GROUPS_STORAGE_KEY = "sngx_signal_groups_v2";
const SIGNALS_STORAGE_KEY = "sngx_group_signals_v2";
const DMS_STORAGE_KEY = "sngx_direct_messages_v2";
const GROUP_CHAT_STORAGE_PREFIX = "sngx_group_chat_";

// Helper to format trade counter string e.g. "03/08 TRADE 01"
export function generateTradeCounterStr(existingSignalsForGroup: SignalItem[]): {
  tradeDateStr: string;
  tradeNumberStr: string;
  countToday: number;
} {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const tradeDateStr = `${day}/${month}/${now.getFullYear()}`;
  const dayPrefix = `${day}/${month}`;

  const todaySignals = existingSignalsForGroup.filter((s) => s.tradeDateStr === tradeDateStr);
  const countToday = todaySignals.length + 1;
  const tradeNumFormatted = String(countToday).padStart(2, "0");
  const tradeNumberStr = `${dayPrefix} TRADE ${tradeNumFormatted}`;

  return { tradeDateStr, tradeNumberStr, countToday };
}

// Clean Real Human Stores - No Fake Accounts
const DEFAULT_SIGNAL_GROUPS: SignalGroup[] = [];

// Initial Seed Signals
const DEFAULT_SIGNALS: SignalItem[] = [];

// Initial Real Chat Welcome Message from Host Admin
const DEFAULT_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "msg_host_welcome",
    senderId: "usr_host_master",
    senderEmail: "sngxworld@gmail.com",
    senderUsername: "Sng",
    senderDisplayName: "Sng (Host Admin)",
    senderRole: "owner",
    content: "Welcome to SNGxJOURNAL Real Community Hub! Share your trade analyses, create your signal group, and connect with real fellow traders. All new signal groups start free, and VIP subscriptions unlock after 30 verified trades with 75%–85%+ win rate.",
    createdAt: new Date().toISOString(),
  },
];

// Initial Direct Messages
const DEFAULT_DMS: DirectMessage[] = [];

// --- PUBLIC ACCESSORS & MUTATORS ---

export function getChatMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(DEFAULT_CHAT_MESSAGES));
      return DEFAULT_CHAT_MESSAGES;
    }
    const msgs: ChatMessage[] = JSON.parse(raw);
    // Lifetime permanent archive: No auto-deletion or expiration of messages, photos, or media
    return msgs;
  } catch {
    return DEFAULT_CHAT_MESSAGES;
  }
}

export function sendChatMessage(
  sender: UserProfile,
  content: string,
  photoUrl?: string,
  audioUrl?: string
): { success: boolean; error?: string; message?: ChatMessage } {
  // Restriction: PENDING / TRIAL USERS CANNOT TEXT OR CHAT IN ANYWHERE
  if (isPendingUser(sender)) {
    return {
      success: false,
      error: "Pending & 5-Day Trial users cannot text or send media in public chat. Upgrade or wait for Host Approval to unlock texting privileges!",
    };
  }

  const role = getEffectiveRole(sender);

  if (!content.trim() && !photoUrl && !audioUrl) {
    return { success: false, error: "Please enter a message or attach media." };
  }

  const newMsg: ChatMessage = {
    id: "msg_" + Math.random().toString(36).substring(2, 9),
    senderId: sender.id,
    senderEmail: sender.email,
    senderUsername: sender.username,
    senderDisplayName: sender.displayName || sender.username,
    senderPhotoURL: sender.photoURL || "",
    senderRole: role,
    content: content.trim(),
    photoUrl,
    audioUrl,
    createdAt: new Date().toISOString(),
  };

  const msgs = getChatMessages();
  msgs.push(newMsg);
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs));

  // Sync with backend API silently
  fetch("/api/community/chat/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newMsg),
  }).catch(() => {});

  return { success: true, message: newMsg };
}

export function deleteChatMessage(
  deleter: UserProfile,
  messageId: string
): { success: boolean; error?: string } {
  const msgs = getChatMessages();
  const target = msgs.find((m) => m.id === messageId);
  if (!target) return { success: false, error: "Message not found." };

  const deleterEmail = (deleter.email || "").toLowerCase();
  const isHost =
    deleterEmail === "sngxworld@gmail.com" ||
    deleter.role === "admin" ||
    deleter.platformRole === "owner" ||
    deleter.platformRole === "sub_owner" ||
    deleter.platformRole === "moderator";
  const isAuthor =
    (target.senderEmail || "").toLowerCase() === deleterEmail ||
    (target.senderUsername || "").toLowerCase() === (deleter.username || "").toLowerCase();

  if (!isHost && !isAuthor) {
    return { success: false, error: "You can only delete your own messages." };
  }

  const filtered = msgs.filter((m) => m.id !== messageId);
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(filtered));

  // Sync delete with server API
  fetch(`/api/community/chat/messages/${messageId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deleterEmail }),
  }).catch(() => {});

  return { success: true };
}

export function getSignalGroups(): SignalGroup[] {
  try {
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(DEFAULT_SIGNAL_GROUPS));
      return DEFAULT_SIGNAL_GROUPS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SIGNAL_GROUPS;
  }
}

export function saveSignalGroups(groups: SignalGroup[]) {
  localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  fetch("/api/community/signal-groups/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groups }),
  }).catch(() => {});
}

// 20-Year WhatsApp-like Server History Retention Constant (20 years in milliseconds)
export const SERVER_HISTORY_RETENTION_YEARS = 20;
export const SERVER_HISTORY_RETENTION_MS = 20 * 365.25 * 24 * 60 * 60 * 1000;

// Helper: Get active signal group owned by this user
export function getUserOwnedSignalGroup(user?: Partial<UserProfile> | null): SignalGroup | undefined {
  if (!user) return undefined;
  const groups = getSignalGroups();
  const uEmail = (user.email || "").trim().toLowerCase();
  const uName = (user.username || "").trim().toLowerCase();
  return groups.find((g) => {
    const gEmail = (g.adminEmail || "").trim().toLowerCase();
    const gName = (g.adminUsername || "").trim().toLowerCase();
    return (uEmail && gEmail === uEmail) || (uName && gName === uName);
  });
}

// Helper: Verify if user can create a signal group (Enforces strict 1 Group Limit)
export function canUserCreateSignalGroup(user?: Partial<UserProfile> | null): {
  allowed: boolean;
  reason?: string;
  existingGroup?: SignalGroup;
} {
  if (!user) {
    return { allowed: false, reason: "You must be logged in to create a signal group." };
  }
  if (isPendingUser(user)) {
    return {
      allowed: false,
      reason: "Pending accounts cannot create signal groups until approved by Host Admin.",
    };
  }

  const userEmail = (user.email || "").trim().toLowerCase();
  const isHost = userEmail === "sngxworld@gmail.com";
  const existing = getUserOwnedSignalGroup(user);

  if (!isHost && existing) {
    return {
      allowed: false,
      reason: `1 Group Limit Reached: You are already the administrator of '${existing.name}'. You can only create up to 1 signal group at a time. Delete your existing group first to create a new one.`,
      existingGroup: existing,
    };
  }

  return { allowed: true };
}

export function createSignalGroup(
  creator: UserProfile,
  groupData: {
    name: string;
    logoUrl?: string;
    description: string;
    hideMembers: boolean;
    adminOnlyChat?: boolean;
    allowMemberChat?: boolean;
  }
): { success: boolean; error?: string; group?: SignalGroup } {
  // Restriction 1: PENDING USERS CANNOT CREATE SIGNAL GROUPS
  if (isPendingUser(creator)) {
    return {
      success: false,
      error: "Pending users cannot create signal groups until account approval by Host Admin.",
    };
  }

  // Restriction 2: STRICT 1 GROUP PER USER LIMIT (Must delete previous group first)
  const userEmail = (creator.email || "").trim().toLowerCase();
  const isHost = userEmail === "sngxworld@gmail.com";
  const existing = getUserOwnedSignalGroup(creator);
  if (!isHost && existing) {
    return {
      success: false,
      error: `1 Group Limit Reached: You already have an active signal group '${existing.name}'. Each trader can only create 1 signal group at a time. Delete your current group first to create a new one.`,
    };
  }

  if (!groupData.name.trim()) {
    return { success: false, error: "Group name is required." };
  }
  if (!groupData.description.trim()) {
    return { success: false, error: "Group description is required." };
  }

  const role = getEffectiveRole(creator);
  const newGroup: SignalGroup = {
    id: "grp_" + Math.random().toString(36).substring(2, 9),
    name: groupData.name.trim(),
    logoUrl: groupData.logoUrl || "",
    description: groupData.description.trim(),
    adminEmail: creator.email,
    adminUsername: creator.username,
    adminDisplayName: creator.displayName || creator.username,
    adminPhotoURL: creator.photoURL || "",
    adminRole: role === "owner" ? "owner" : "signal_provider",
    isVerified: false,
    isPaid: false, // Subscription strictly disabled at creation; only unlocked for VIP traders (30 trades & 75%-85%+ win rate)
    priceUsd: 0,
    membersCount: 1,
    members: [creator.email],
    allowMemberChat: groupData.allowMemberChat ?? false, // Default admin-only chat until toggled
    adminOnlyChat: groupData.adminOnlyChat ?? true, // Admin-only talk mode default
    allowedChatMembers: [creator.email], // Creator always has access
    hideMembers: groupData.hideMembers,
    totalSignals: 0,
    wonSignals: 0,
    lostSignals: 0,
    winRate: 0,
    createdAt: new Date().toISOString(),
  };

  const groups = getSignalGroups();
  groups.unshift(newGroup);
  saveSignalGroups(groups);

  return { success: true, group: newGroup };
}

// VIP Trader Subscription Pricing Management
export function updateGroupSubscriptionPricing(
  user: UserProfile,
  groupId: string,
  settings: {
    isPaid: boolean;
    priceUsd: number;
  }
): { success: boolean; error?: string; group?: SignalGroup } {
  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);

  if (!group) return { success: false, error: "Signal group not found." };

  const isHost = user.email.toLowerCase() === "sngxworld@gmail.com";
  const isGroupAdmin = group.adminEmail.toLowerCase() === user.email.toLowerCase();

  if (!isHost && !isGroupAdmin) {
    return { success: false, error: "Only the group creator or Host Admin can update subscription settings." };
  }

  // Verification threshold check: 30 closed trades with 75%-85%+ win rate (or Host override)
  const isEligibleVip = group.isVerified || (group.totalSignals >= 30 && group.winRate >= 75.0) || isHost;

  if (settings.isPaid && !isEligibleVip) {
    return {
      success: false,
      error: `Subscription monetization is locked. You need at least 30 closed trades with an audited 75%–85%+ win rate (Current: ${group.totalSignals}/30 trades, ${group.winRate}% win rate).`,
    };
  }

  // Price cap check: Max $17 USD (5000 LKR equivalent)
  if (settings.isPaid && settings.priceUsd > 17) {
    return { success: false, error: "Maximum group price cannot exceed $17.00 USD (5000 LKR equivalent)." };
  }

  group.isPaid = settings.isPaid && settings.priceUsd > 0;
  group.priceUsd = group.isPaid ? Math.min(Math.max(0, settings.priceUsd), 17) : 0;

  saveSignalGroups(groups);
  return { success: true, group };
}

// Group Admin Add Member directly to group (Point 2 inside group settings)
export function addMemberToSignalGroup(
  admin: UserProfile,
  groupId: string,
  memberEmailOrUsername: string,
  grantChatAccess: boolean = false
): { success: boolean; error?: string; group?: SignalGroup; addedMember?: string } {
  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);

  if (!group) return { success: false, error: "Signal group not found." };

  const adminEmail = admin.email.toLowerCase();
  const isHost = adminEmail === "sngxworld@gmail.com" || admin.role === "admin";
  const isGroupAdmin = group.adminEmail.toLowerCase() === adminEmail;

  if (!isHost && !isGroupAdmin) {
    return { success: false, error: "Only the Group Admin can add members to this group." };
  }

  const cleanInput = (memberEmailOrUsername || "").trim().toLowerCase();
  if (!cleanInput) {
    return { success: false, error: "Please provide a valid member email or username." };
  }

  // Check if target is already in group.members
  const existingLower = (group.members || []).map((m) => m.toLowerCase());
  if (existingLower.includes(cleanInput)) {
    return { success: false, error: `${cleanInput} is already a member of this group.` };
  }

  // Add to members list
  group.members = [...(group.members || []), cleanInput];
  group.membersCount = group.members.length;

  // If chat permission granted
  if (grantChatAccess) {
    const chatAllowed = (group.allowedChatMembers || []).map((m) => m.toLowerCase());
    if (!chatAllowed.includes(cleanInput)) {
      group.allowedChatMembers = [...chatAllowed, cleanInput];
    }
  }

  saveSignalGroups(groups);

  // Send system announcement in group chat
  const memberName = cleanInput.split("@")[0].toUpperCase();
  const systemMsg: GroupChatMessage = {
    id: "gmsg_sys_" + Math.random().toString(36).substring(2, 9),
    groupId,
    senderId: "system",
    senderEmail: group.adminEmail,
    senderUsername: "System",
    senderDisplayName: "Group Security Bot",
    senderPhotoURL: "",
    senderRole: "moderator",
    content: `🎉 Welcome @${memberName}! You have been added to ${group.name} by the Group Admin.`,
    createdAt: new Date().toISOString(),
    isAnnouncement: true,
  };

  const key = getGroupChatStorageKey(groupId);
  const msgs = getGroupChatMessages(groupId);
  msgs.push(systemMsg);
  localStorage.setItem(key, JSON.stringify(msgs));

  return { success: true, group, addedMember: cleanInput };
}

// Group Admin Remove Member from group
export function removeMemberFromSignalGroup(
  admin: UserProfile,
  groupId: string,
  memberEmail: string
): { success: boolean; error?: string; group?: SignalGroup } {
  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);

  if (!group) return { success: false, error: "Signal group not found." };

  const adminEmail = (admin.email || "").toLowerCase();
  const adminRole = getEffectiveRole(admin);
  const isHost =
    adminEmail === "sngxworld@gmail.com" ||
    admin.role === "admin" ||
    adminRole === "owner" ||
    adminRole === "sub_owner";
  const isGroupAdmin =
    (group.adminEmail || "").toLowerCase() === adminEmail ||
    (group.adminUsername || "").toLowerCase() === (admin.username || "").toLowerCase();

  if (!isHost && !isGroupAdmin) {
    return { success: false, error: "Only the Group Admin or Host can remove members from this group." };
  }

  const cleanTarget = memberEmail.trim().toLowerCase();
  if (
    cleanTarget === (group.adminEmail || "").toLowerCase() ||
    cleanTarget === (group.adminUsername || "").toLowerCase()
  ) {
    return { success: false, error: "Cannot remove the Group Administrator." };
  }

  // Filter out target by exact match, username prefix, or @ prefix
  group.members = (group.members || []).filter((m) => {
    const mLower = m.trim().toLowerCase();
    return (
      mLower !== cleanTarget &&
      mLower !== cleanTarget.split("@")[0] &&
      mLower.replace(/^@/, "") !== cleanTarget.replace(/^@/, "")
    );
  });
  group.membersCount = group.members.length;

  if (group.allowedChatMembers) {
    group.allowedChatMembers = group.allowedChatMembers.filter((m) => {
      const mLower = m.trim().toLowerCase();
      return (
        mLower !== cleanTarget &&
        mLower !== cleanTarget.split("@")[0] &&
        mLower.replace(/^@/, "") !== cleanTarget.replace(/^@/, "")
      );
    });
  }

  // Save to persistence
  saveSignalGroups(groups);

  // System notification in group chat
  const systemMsg: GroupChatMessage = {
    id: `msg_sys_rem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    groupId: group.id,
    senderId: "usr_sys_notify",
    senderEmail: "system@community.net",
    senderUsername: "System Notification",
    senderDisplayName: "Group Moderation",
    senderRole: "owner",
    content: `📢 [MEMBER REMOVED] Member '${memberEmail}' was removed from ${group.name} by the administrator.`,
    isAnnouncement: true,
    createdAt: new Date().toISOString(),
  };
  const key = `${GROUP_CHAT_STORAGE_PREFIX}${groupId}`;
  const msgs = getGroupChatMessages(groupId);
  msgs.push(systemMsg);
  localStorage.setItem(key, JSON.stringify(msgs));

  return { success: true, group };
}

// Group Admin Update Group Settings (Name, Description, Logo, Chat Mode, Visibility)
export function updateSignalGroupDetails(
  admin: UserProfile,
  groupId: string,
  updates: {
    name?: string;
    description?: string;
    logoUrl?: string;
    adminOnlyChat?: boolean;
    hideMembers?: boolean;
  }
): { success: boolean; error?: string; group?: SignalGroup } {
  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);

  if (!group) return { success: false, error: "Signal group not found." };

  const adminEmail = admin.email.toLowerCase();
  const isHost = adminEmail === "sngxworld@gmail.com" || admin.role === "admin";
  const isGroupAdmin = group.adminEmail.toLowerCase() === adminEmail;

  if (!isHost && !isGroupAdmin) {
    return { success: false, error: "Only the Group Admin can edit group settings." };
  }

  if (updates.name && updates.name.trim()) {
    group.name = updates.name.trim();
  }
  if (updates.description && updates.description.trim()) {
    group.description = updates.description.trim();
  }
  if (updates.logoUrl !== undefined) {
    group.logoUrl = updates.logoUrl;
  }
  if (updates.adminOnlyChat !== undefined) {
    group.adminOnlyChat = updates.adminOnlyChat;
    group.allowMemberChat = !updates.adminOnlyChat;
  }
  if (updates.hideMembers !== undefined) {
    group.hideMembers = updates.hideMembers;
  }

  saveSignalGroups(groups);
  return { success: true, group };
}

// Host Admin or Group Admin Delete Signal Group (verified or free)
export function deleteSignalGroup(
  user: UserProfile,
  groupId: string
): { success: boolean; error?: string } {
  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);
  if (!group) return { success: false, error: "Signal group not found." };

  const userEmail = user.email.toLowerCase();
  const isHost = userEmail === "sngxworld@gmail.com" || user.role === "admin" || user.platformRole === "owner";
  const isGroupAdmin = group.adminEmail.toLowerCase() === userEmail;

  if (!isHost && !isGroupAdmin) {
    return { success: false, error: "Only Host Admin or the Group Creator can delete this signal group." };
  }

  // Remove group
  const updatedGroups = groups.filter((g) => g.id !== groupId);
  saveSignalGroups(updatedGroups);

  // Remove all signals belonging to this group
  const allSignals = getSignals();
  const updatedSignals = allSignals.filter((s) => s.groupId !== groupId);
  saveSignals(updatedSignals);

  // Clean up group chat storage
  try {
    const chatKey = getGroupChatStorageKey(groupId);
    localStorage.removeItem(chatKey);
  } catch {}

  return { success: true };
}

// Host Admin Toggle Group VIP Verification
export function adminToggleGroupVerification(
  admin: UserProfile,
  groupId: string,
  isVerified: boolean
): { success: boolean; error?: string; group?: SignalGroup } {
  if (admin.email.toLowerCase() !== "sngxworld@gmail.com" && admin.role !== "admin") {
    return { success: false, error: "Only Host Admin can verify or revoke VIP trader status." };
  }

  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);
  if (!group) return { success: false, error: "Group not found." };

  group.isVerified = isVerified;
  if (isVerified) {
    group.adminRole = "verified_signal_provider";
  }

  saveSignalGroups(groups);
  return { success: true, group };
}

export function getSignals(): SignalItem[] {
  try {
    const raw = localStorage.getItem(SIGNALS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SIGNALS_STORAGE_KEY, JSON.stringify(DEFAULT_SIGNALS));
      return DEFAULT_SIGNALS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SIGNALS;
  }
}

export function saveSignals(signals: SignalItem[]) {
  localStorage.setItem(SIGNALS_STORAGE_KEY, JSON.stringify(signals));
}

export function postSignal(
  author: UserProfile,
  groupId: string,
  signalData: {
    coin: string;
    entry: string;
    tp1: string;
    tp2?: string;
    sl: string;
    leverage: string;
    riskPercent?: string;
    description: string;
    chartPhotoUrl: string;
  }
): { success: boolean; error?: string; signal?: SignalItem } {
  if (isPendingUser(author)) {
    return { success: false, error: "Pending users cannot post trade signals." };
  }

  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);

  if (!group) return { success: false, error: "Signal group not found." };
  if (group.adminEmail.toLowerCase() !== author.email.toLowerCase() && author.email.toLowerCase() !== "sngxworld@gmail.com") {
    return { success: false, error: "Only the single Group Admin can give signals in this group." };
  }

  // Slide 8 validation rules
  if (!signalData.chartPhotoUrl) {
    return { success: false, error: "Upload a photo of the chart analysis (Mandatory)." };
  }
  if (!signalData.coin.trim()) return { success: false, error: "Coin symbol is mandatory (e.g. BTCUSDT.P)." };
  if (!signalData.entry.trim()) return { success: false, error: "Entry price is mandatory." };
  if (!signalData.tp1.trim()) return { success: false, error: "TP1 price is mandatory." };
  if (!signalData.sl.trim()) return { success: false, error: "SL price is mandatory." };
  if (!signalData.leverage.trim()) return { success: false, error: "Leverage is mandatory." };
  if (!signalData.description.trim()) return { success: false, error: "Trade description is mandatory." };

  const allSignals = getSignals();
  const groupSignals = allSignals.filter((s) => s.groupId === groupId);

  // Slide 11 rules: Max 10 signals a day & max 10 signals running at once
  const { tradeDateStr, tradeNumberStr, countToday } = generateTradeCounterStr(groupSignals);
  if (countToday > 10) {
    return { success: false, error: "Daily limit reached: Maximum 10 signals per day allowed for any group." };
  }

  const activeRunning = groupSignals.filter((s) => s.status === "open");
  if (activeRunning.length >= 10) {
    return { success: false, error: "Maximum 10 active signals running at once. Please finish existing trades before adding more." };
  }

  const newSignal: SignalItem = {
    id: "sig_" + Math.random().toString(36).substring(2, 9),
    groupId: group.id,
    groupName: group.name,
    tradeNumberStr,
    tradeDateStr,
    coin: signalData.coin.trim().toUpperCase(),
    entry: signalData.entry.trim(),
    tp1: signalData.tp1.trim(),
    tp2: signalData.tp2?.trim(),
    sl: signalData.sl.trim(),
    leverage: signalData.leverage.trim(),
    riskPercent: signalData.riskPercent?.trim(),
    description: signalData.description.trim(),
    chartPhotoUrl: signalData.chartPhotoUrl,
    status: "open",
    adminEmail: group.adminEmail,
    createdAt: new Date().toISOString(),
    votes: {},
    tpVotesCount: 0,
    slVotesCount: 0,
  };

  allSignals.unshift(newSignal);
  saveSignals(allSignals);

  return { success: true, signal: newSignal };
}

// Slide 7 & 10: Finish Trade -> Start 3-day feedback voting window
export function finishTradeStartFeedback(
  admin: UserProfile,
  signalId: string
): { success: boolean; error?: string; signal?: SignalItem } {
  const allSignals = getSignals();
  const sig = allSignals.find((s) => s.id === signalId);

  if (!sig) return { success: false, error: "Signal not found." };
  if (sig.adminEmail.toLowerCase() !== admin.email.toLowerCase() && admin.email.toLowerCase() !== "sngxworld@gmail.com") {
    return { success: false, error: "Only the group admin can mark this trade as finished." };
  }

  // 3-day feedback window
  sig.status = "voting";
  sig.votingEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  sig.votes = sig.votes || {};

  saveSignals(allSignals);
  return { success: true, signal: sig };
}

// Slide 7 & 10: Member Casts Feedback Vote (TP or SL)
export function castSignalVote(
  user: UserProfile,
  signalId: string,
  vote: "tp" | "sl"
): { success: boolean; error?: string } {
  const allSignals = getSignals();
  const sig = allSignals.find((s) => s.id === signalId);

  if (!sig) return { success: false, error: "Signal not found." };
  if (sig.status !== "voting") {
    return { success: false, error: "Voting is not open for this trade." };
  }

  if (sig.votingEndsAt && new Date().getTime() > new Date(sig.votingEndsAt).getTime()) {
    // Process results if time has elapsed
    evaluateSignalResults(sig);
    saveSignals(allSignals);
    return { success: false, error: "The 3-day feedback voting window for this trade has concluded." };
  }

  if (!sig.votes) sig.votes = {};
  sig.votes[user.email.toLowerCase()] = vote;

  // Recount votes
  const allVotes = Object.values(sig.votes);
  sig.tpVotesCount = allVotes.filter((v) => v === "tp").length;
  sig.slVotesCount = allVotes.filter((v) => v === "sl").length;

  saveSignals(allSignals);
  return { success: true };
}

// Slide 10: Automated Win Rate & Voting Calculation Engine
export function evaluateSignalResults(sig: SignalItem): "tp" | "sl" | "inconclusive" {
  const votes = sig.votes || {};
  const totalVotes = Object.keys(votes).length;

  if (totalVotes === 0) {
    sig.status = "closed";
    sig.result = "inconclusive";
    return "inconclusive";
  }

  const tpVotes = Object.values(votes).filter((v) => v === "tp").length;
  const slVotes = Object.values(votes).filter((v) => v === "sl").length;
  const tpPercent = (tpVotes / totalVotes) * 100;
  const slPercent = (slVotes / totalVotes) * 100;

  sig.status = "closed";
  sig.closedAt = new Date().toISOString();

  // Slide 10: If >=80% voted TP -> TP Win. If >=80% voted SL -> SL Loss. Under 75% -> inconclusive.
  if (tpPercent >= 80) {
    sig.result = "tp";
  } else if (slPercent >= 80) {
    sig.result = "sl";
  } else {
    sig.result = "inconclusive";
  }

  // Recalculate parent group win rate
  recalculateGroupStats(sig.groupId);
  return sig.result;
}

export function recalculateGroupStats(groupId: string) {
  const allSignals = getSignals();
  const groupSignals = allSignals.filter((s) => s.groupId === groupId && s.status === "closed");

  const totalClosed = groupSignals.length;
  const won = groupSignals.filter((s) => s.result === "tp").length;
  const lost = groupSignals.filter((s) => s.result === "sl").length;
  const decisive = won + lost;
  const winRate = decisive > 0 ? parseFloat(((won / decisive) * 100).toFixed(2)) : 0;

  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);

  if (group) {
    group.totalSignals = totalClosed;
    group.wonSignals = won;
    group.lostSignals = lost;
    group.winRate = winRate;

    // VIP Qualification: When reached 30 signals and win rate is 75% - 85%+, grant VIP Verified Badge
    if (totalClosed >= 30 && winRate >= 75.0) {
      group.isVerified = true;
      group.adminRole = "verified_signal_provider";
    }

    saveSignalGroups(groups);
  }
}

// --- DIRECT MESSAGING STORE ---

export function getDirectMessages(): DirectMessage[] {
  try {
    const raw = localStorage.getItem(DMS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DMS_STORAGE_KEY, JSON.stringify(DEFAULT_DMS));
      return DEFAULT_DMS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_DMS;
  }
}

export function sendDirectMessage(
  sender: UserProfile,
  receiver: { email: string; username: string; displayName?: string },
  content: string,
  isJoinRequest?: boolean,
  targetGroupName?: string,
  targetGroupId?: string
): { success: boolean; error?: string; message?: DirectMessage } {
  if (!content.trim()) return { success: false, error: "Message cannot be empty." };

  const senderRole = getEffectiveRole(sender);
  const newDm: DirectMessage = {
    id: "dm_" + Math.random().toString(36).substring(2, 9),
    senderEmail: sender.email.toLowerCase(),
    senderUsername: sender.username,
    senderDisplayName: sender.displayName || sender.username,
    senderPhotoURL: sender.photoURL || "",
    senderRole,
    receiverEmail: receiver.email.toLowerCase(),
    receiverUsername: receiver.username,
    receiverDisplayName: receiver.displayName || receiver.username,
    content: content.trim(),
    createdAt: new Date().toISOString(),
    isJoinRequest,
    targetGroupName,
    targetGroupId,
  };

  const dms = getDirectMessages();
  dms.push(newDm);
  localStorage.setItem(DMS_STORAGE_KEY, JSON.stringify(dms));

  return { success: true, message: newDm };
}

export function deleteDirectMessage(
  deleter: UserProfile,
  messageId: string
): { success: boolean; error?: string } {
  const dms = getDirectMessages();
  const target = dms.find((m) => m.id === messageId);
  if (!target) return { success: false, error: "Direct message not found." };

  const deleterEmail = (deleter.email || "").toLowerCase();
  const isHost =
    deleterEmail === "sngxworld@gmail.com" ||
    deleter.role === "admin" ||
    deleter.platformRole === "owner" ||
    deleter.platformRole === "sub_owner";
  const isParticipant =
    target.senderEmail.toLowerCase() === deleterEmail ||
    target.receiverEmail.toLowerCase() === deleterEmail;

  if (!isHost && !isParticipant) {
    return { success: false, error: "You can only delete messages in your own direct conversations." };
  }

  const filtered = dms.filter((m) => m.id !== messageId);
  localStorage.setItem(DMS_STORAGE_KEY, JSON.stringify(filtered));

  return { success: true };
}

// --- SIGNAL GROUP CHAT STORE & PERMISSION ENGINE ---

export function getGroupChatStorageKey(groupId: string): string {
  return `${GROUP_CHAT_STORAGE_PREFIX}${groupId}`;
}

export function getGroupChatMessages(groupId: string): GroupChatMessage[] {
  try {
    const key = getGroupChatStorageKey(groupId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Create initial welcoming announcement from the group admin if empty
      const groups = getSignalGroups();
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        const welcomeMsg: GroupChatMessage = {
          id: `gmsg_${groupId}_welcome`,
          groupId,
          senderId: `usr_${group.adminUsername}`,
          senderEmail: group.adminEmail,
          senderUsername: group.adminUsername,
          senderDisplayName: `${group.adminDisplayName || group.adminUsername} (Admin)`,
          senderPhotoURL: group.adminPhotoURL || "",
          senderRole: group.adminRole,
          content: `Welcome to ${group.name}! This is the official group channel for real-time trade signals, technical setups, and community discussion. ${group.adminOnlyChat ? "🔒 Admin-Only talk mode is currently enabled." : "💬 Open community chat is enabled."}`,
          createdAt: group.createdAt || new Date().toISOString(),
          isAnnouncement: true,
        };
        const initial = [welcomeMsg];
        localStorage.setItem(key, JSON.stringify(initial));
        return initial;
      }
      return [];
    }
    const msgs: GroupChatMessage[] = JSON.parse(raw);
    return msgs;
  } catch {
    return [];
  }
}

export function canUserChatInGroup(user: UserProfile, group: SignalGroup): {
  allowed: boolean;
  reason?: string;
  isAdmin: boolean;
} {
  const userEmail = (user.email || "").toLowerCase();
  const adminEmail = (group.adminEmail || "").toLowerCase();
  const isHost = userEmail === "sngxworld@gmail.com" || user.role === "admin";
  const isGroupAdmin = userEmail === adminEmail;
  const isEffectiveAdmin = isHost || isGroupAdmin;

  // Pending users can NEVER text or send messages anywhere until approved
  if (!isHost && isPendingUser(user)) {
    return {
      allowed: false,
      reason: "Pending accounts cannot send messages in signal group channels until approved by Host Admin.",
      isAdmin: false,
    };
  }

  if (isEffectiveAdmin) {
    return { allowed: true, isAdmin: true };
  }

  // Check if user is in group's custom allowed list
  const allowedList = (group.allowedChatMembers || []).map((e) => e.toLowerCase());
  const isExplicitlyAllowed = allowedList.includes(userEmail);

  // If Admin Only Talk mode is ON
  if (group.adminOnlyChat) {
    if (isExplicitlyAllowed) {
      return { allowed: true, isAdmin: false };
    }
    return {
      allowed: false,
      reason: "Admin-Only Talk mode is active. Only the group admin and members with granted message permissions can text.",
      isAdmin: false,
    };
  }

  // If Member Chat is allowed (adminOnlyChat is false)
  if (group.allowMemberChat || !group.adminOnlyChat) {
    return { allowed: true, isAdmin: false };
  }

  return {
    allowed: false,
    reason: "Group chat messaging is currently restricted by the administrator.",
    isAdmin: false,
  };
}

export function sendGroupChatMessage(
  groupId: string,
  sender: UserProfile,
  content: string,
  photoUrl?: string,
  audioUrl?: string,
  isAnnouncement?: boolean
): { success: boolean; error?: string; message?: GroupChatMessage } {
  // Restriction: PENDING USERS CANNOT CHAT
  if (isPendingUser(sender)) {
    return {
      success: false,
      error: "Pending accounts cannot send messages in signal group channels until approved by Host Admin.",
    };
  }

  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);

  if (!group) {
    return { success: false, error: "Signal group not found." };
  }

  const permCheck = canUserChatInGroup(sender, group);
  if (!permCheck.allowed) {
    return {
      success: false,
      error: permCheck.reason || "You do not have permission to send messages in this group.",
    };
  }

  if (!content.trim() && !photoUrl && !audioUrl) {
    return { success: false, error: "Message content or attachment is required." };
  }

  const role = getEffectiveRole(sender);
  const newMsg: GroupChatMessage = {
    id: "gmsg_" + Math.random().toString(36).substring(2, 9),
    groupId,
    senderId: sender.id,
    senderEmail: sender.email.toLowerCase(),
    senderUsername: sender.username,
    senderDisplayName: sender.displayName || sender.username,
    senderPhotoURL: sender.photoURL || "",
    senderRole: permCheck.isAdmin ? (role === "owner" ? "owner" : "signal_provider") : role,
    content: content.trim(),
    photoUrl,
    audioUrl,
    createdAt: new Date().toISOString(),
    isAnnouncement: permCheck.isAdmin ? Boolean(isAnnouncement) : false,
  };

  const key = getGroupChatStorageKey(groupId);
  const messages = getGroupChatMessages(groupId);
  messages.push(newMsg);
  localStorage.setItem(key, JSON.stringify(messages));

  // Sync to server backend
  fetch(`/api/community/signal-groups/${groupId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newMsg),
  }).catch(() => {});

  return { success: true, message: newMsg };
}

export function updateGroupChatSettings(
  updater: UserProfile,
  groupId: string,
  settings: {
    adminOnlyChat: boolean;
    allowMemberChat: boolean;
    allowedChatMembers?: string[];
  }
): { success: boolean; error?: string; group?: SignalGroup } {
  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);

  if (!group) return { success: false, error: "Signal group not found." };

  const updaterEmail = updater.email.toLowerCase();
  const isHost = updaterEmail === "sngxworld@gmail.com" || updater.role === "admin";
  const isGroupAdmin = group.adminEmail.toLowerCase() === updaterEmail;

  if (!isHost && !isGroupAdmin) {
    return { success: false, error: "Only the group administrator or Host can modify chat permissions." };
  }

  group.adminOnlyChat = settings.adminOnlyChat;
  group.allowMemberChat = settings.allowMemberChat;
  if (settings.allowedChatMembers) {
    group.allowedChatMembers = Array.from(
      new Set([...(settings.allowedChatMembers || []), group.adminEmail])
    );
  }

  saveSignalGroups(groups);

  // Post a system announcement in group chat
  const statusText = settings.adminOnlyChat
    ? "🔒 The Group Administrator has switched chat to Admin-Only Talk mode. Only admins and authorized members can send messages."
    : "💬 The Group Administrator has enabled Open Community Chat! All members can now participate in discussion.";

  const systemMsg: GroupChatMessage = {
    id: "gmsg_sys_" + Math.random().toString(36).substring(2, 9),
    groupId,
    senderId: "system",
    senderEmail: group.adminEmail,
    senderUsername: "System",
    senderDisplayName: "Group Security Bot",
    senderPhotoURL: "",
    senderRole: "moderator",
    content: statusText,
    createdAt: new Date().toISOString(),
    isAnnouncement: true,
  };

  const key = getGroupChatStorageKey(groupId);
  const msgs = getGroupChatMessages(groupId);
  msgs.push(systemMsg);
  localStorage.setItem(key, JSON.stringify(msgs));

  return { success: true, group };
}

export function toggleMemberChatPermission(
  admin: UserProfile,
  groupId: string,
  targetMemberEmail: string
): { success: boolean; error?: string; group?: SignalGroup; isNowAllowed?: boolean } {
  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);

  if (!group) return { success: false, error: "Signal group not found." };

  const adminEmail = admin.email.toLowerCase();
  const isHost = adminEmail === "sngxworld@gmail.com" || admin.role === "admin";
  const isGroupAdmin = group.adminEmail.toLowerCase() === adminEmail;

  if (!isHost && !isGroupAdmin) {
    return { success: false, error: "Only the group administrator can manage member messaging privileges." };
  }

  const targetEmailLower = targetMemberEmail.toLowerCase();
  if (!group.allowedChatMembers) {
    group.allowedChatMembers = [group.adminEmail.toLowerCase()];
  }

  const currentList = group.allowedChatMembers.map((e) => e.toLowerCase());
  let isNowAllowed = false;

  if (currentList.includes(targetEmailLower)) {
    // Revoke
    group.allowedChatMembers = currentList.filter((e) => e !== targetEmailLower);
    isNowAllowed = false;
  } else {
    // Grant
    group.allowedChatMembers = [...currentList, targetEmailLower];
    isNowAllowed = true;
  }

  saveSignalGroups(groups);
  return { success: true, group, isNowAllowed };
}

export function deleteGroupChatMessage(
  deleter: UserProfile,
  groupId: string,
  messageId: string
): { success: boolean; error?: string } {
  const groups = getSignalGroups();
  const group = groups.find((g) => g.id === groupId);
  if (!group) return { success: false, error: "Signal group not found." };

  const key = getGroupChatStorageKey(groupId);
  const msgs = getGroupChatMessages(groupId);
  const targetMsg = msgs.find((m) => m.id === messageId);
  if (!targetMsg) return { success: false, error: "Message not found." };

  const deleterEmail = deleter.email.toLowerCase();
  const isHost = deleterEmail === "sngxworld@gmail.com" || deleter.role === "admin";
  const isGroupAdmin = group.adminEmail.toLowerCase() === deleterEmail;
  const isAuthor = targetMsg.senderEmail.toLowerCase() === deleterEmail;

  if (!isHost && !isGroupAdmin && !isAuthor) {
    return { success: false, error: "You do not have permission to delete this message." };
  }

  const filtered = msgs.filter((m) => m.id !== messageId);
  localStorage.setItem(key, JSON.stringify(filtered));

  // Sync delete with server backend
  fetch(`/api/community/signal-groups/${groupId}/chat/${messageId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deleterEmail }),
  }).catch(() => {});

  return { success: true };
}
