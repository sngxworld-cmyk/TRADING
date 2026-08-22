import React, { useState, useEffect, useRef } from "react";
import { UserProfile, ChatMessage, SignalGroup, DirectMessage } from "../types";
import { RoleBadge, getEffectiveRole, isPendingUser } from "../utils/roleUtils";
import {
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
  getSignalGroups,
  getDirectMessages,
  sendDirectMessage,
  deleteDirectMessage,
  createSignalGroup,
  deleteSignalGroup,
} from "../lib/communityStore";
import { downloadImageToLocal } from "../utils/fileUtils";
import {
  MessageSquare,
  TrendingUp,
  Shield,
  Send,
  Image as ImageIcon,
  Mic,
  Lock,
  Plus,
  Users,
  CheckCircle2,
  ShieldAlert,
  Search,
  ExternalLink,
  ChevronRight,
  User,
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  Award,
  Download,
  Trash2,
  Maximize2,
  X,
  Check,
  ArrowDown,
  Database,
} from "lucide-react";
import { CommunityGuidelinesModal } from "./CommunityGuidelinesModal";
import { UserProfileModal } from "./UserProfileModal";
import { CreateGroupModal } from "./CreateGroupModal";
import { SignalGroupDetailView } from "./SignalGroupDetailView";
import { ChatDateDivider, isDifferentChatDay, formatMessageTime } from "../utils/chatDateUtils";

interface CommunityChatHubProps {
  currentUser: UserProfile;
  onBackToApp?: () => void;
}

export const CommunityChatHub: React.FC<CommunityChatHubProps> = ({
  currentUser,
  onBackToApp,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"chat" | "groups" | "dms">("chat");
  const [groupsSubTab, setGroupsSubTab] = useState<"free" | "verified">("free");

  // Public Chat Room State & Scroll Control
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(getChatMessages);
  const [messageInput, setMessageInput] = useState("");
  const [photoAttachmentUrl, setPhotoAttachmentUrl] = useState("");
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [voiceMemoActive, setVoiceMemoActive] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Chat scroll refs
  const publicChatContainerRef = useRef<HTMLDivElement>(null);
  const isPublicNearBottomRef = useRef(true);
  const [showPublicScrollBtn, setShowPublicScrollBtn] = useState(false);
  const prevPublicLatestIdRef = useRef<string | null>(null);

  // Direct Messages State & Scroll Control
  const [dms, setDms] = useState<DirectMessage[]>(getDirectMessages);
  const [activeDmUser, setActiveDmUser] = useState<{ email: string; username: string; displayName?: string } | null>(null);
  const [dmInput, setDmInput] = useState("");
  const dmContainerRef = useRef<HTMLDivElement>(null);
  const isDmNearBottomRef = useRef(true);
  const [showDmScrollBtn, setShowDmScrollBtn] = useState(false);
  const prevDmLatestIdRef = useRef<string | null>(null);

  // Signal Groups State
  const [signalGroups, setSignalGroups] = useState<SignalGroup[]>(getSignalGroups);
  const [selectedGroup, setSelectedGroup] = useState<SignalGroup | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Modals & Popups
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<any | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<SignalGroup | null>(null);
  const [deleteGroupError, setDeleteGroupError] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const userRole = getEffectiveRole(currentUser);
  const isTrialOrPending = isPendingUser(currentUser);
  const isHostAdmin =
    currentUser.email.toLowerCase() === "sngxworld@gmail.com" || currentUser.role === "admin";

  // Scroll helpers
  const scrollPublicToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = publicChatContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      isPublicNearBottomRef.current = true;
      setShowPublicScrollBtn(false);
    }
  };

  const handlePublicScroll = () => {
    const el = publicChatContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const isNear = distanceFromBottom < 100;
    isPublicNearBottomRef.current = isNear;
    setShowPublicScrollBtn(!isNear);
  };

  const scrollDmToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = dmContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      isDmNearBottomRef.current = true;
      setShowDmScrollBtn(false);
    }
  };

  const handleDmScroll = () => {
    const el = dmContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const isNear = distanceFromBottom < 100;
    isDmNearBottomRef.current = isNear;
    setShowDmScrollBtn(!isNear);
  };

  // Polling / Auto-refresh for lively chat & DM feel
  useEffect(() => {
    const interval = setInterval(() => {
      setChatMessages(getChatMessages());
      setSignalGroups(getSignalGroups());
      setDms(getDirectMessages());
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Smart Public Chat Scroll: Only scroll on tab open or when a new message arrives AND user is near bottom (or sent it)
  useEffect(() => {
    if (activeTab !== "chat") return;
    const latestMsg = chatMessages[chatMessages.length - 1];
    const latestId = latestMsg?.id || null;

    // First time entering chat tab
    if (!prevPublicLatestIdRef.current) {
      prevPublicLatestIdRef.current = latestId;
      setTimeout(() => scrollPublicToBottom("auto"), 50);
      return;
    }

    // Check if a brand new message was actually appended
    if (latestId && latestId !== prevPublicLatestIdRef.current) {
      prevPublicLatestIdRef.current = latestId;
      const isSentByMe = latestMsg.senderEmail.toLowerCase() === currentUser.email.toLowerCase();
      if (isSentByMe || isPublicNearBottomRef.current) {
        scrollPublicToBottom("smooth");
      }
    }
  }, [chatMessages, activeTab, currentUser.email]);

  // When switching to activeTab === "chat", initialize position
  useEffect(() => {
    if (activeTab === "chat") {
      setTimeout(() => scrollPublicToBottom("auto"), 50);
    }
  }, [activeTab]);

  // When opening or switching DM user, scroll to bottom once
  useEffect(() => {
    if (activeTab === "dms" && activeDmUser) {
      setTimeout(() => scrollDmToBottom("auto"), 50);
    }
  }, [activeTab, activeDmUser?.email]);

  // Send Public Chat Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    setChatError(null);

    const res = sendChatMessage(currentUser, messageInput, photoAttachmentUrl);
    if (!res.success) {
      setChatError(res.error || "Cannot send message.");
      return;
    }

    setMessageInput("");
    setPhotoAttachmentUrl("");
    setShowPhotoInput(false);
    setChatMessages(getChatMessages());
    setTimeout(() => scrollPublicToBottom("smooth"), 40);
  };

  // Upload Photo from Local Storage
  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setChatError("Image size must be less than 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPhotoAttachmentUrl(reader.result);
          setShowPhotoInput(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteGroupFromHub = () => {
    if (!groupToDelete) return;
    setDeleteGroupError(null);
    const res = deleteSignalGroup(currentUser, groupToDelete.id);
    if (res.success) {
      setSignalGroups(getSignalGroups());
      setGroupToDelete(null);
      if (selectedGroup?.id === groupToDelete.id) {
        setSelectedGroup(null);
      }
    } else {
      setDeleteGroupError(res.error || "Failed to delete group.");
    }
  };

  const handleDeletePublicMessage = (msgId: string) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    const res = deleteChatMessage(currentUser, msgId);
    if (res.success) {
      setChatMessages(getChatMessages());
    } else {
      setChatError(res.error || "Cannot delete message.");
    }
  };

  const handleDeleteDmMessage = (dmId: string) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    const res = deleteDirectMessage(currentUser, dmId);
    if (res.success) {
      setDms(getDirectMessages());
    }
  };

  // Send Direct Message
  const handleSendDM = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDmUser || !dmInput.trim()) return;

    const res = sendDirectMessage(currentUser, activeDmUser, dmInput);
    if (res.success) {
      setDmInput("");
      setDms(getDirectMessages());
      setTimeout(() => scrollDmToBottom("smooth"), 40);
    }
  };

  const handleStartDMFromProfile = (target: { email: string; username: string; displayName?: string }) => {
    setActiveDmUser(target);
    setActiveTab("dms");
  };

  const handleSendJoinRequestFromGroup = (group: SignalGroup) => {
    // Send subscription join request DM
    sendDirectMessage(
      currentUser,
      { email: group.adminEmail, username: group.adminUsername, displayName: group.adminDisplayName },
      `Hi ${group.adminDisplayName || group.adminUsername}, I would like to subscribe to your ${group.name} VIP Signals (${group.priceUsd > 0 ? `$${group.priceUsd}/mo` : "Free"})! Please send me payment details or access authorization.`,
      true,
      group.name,
      group.id
    );

    // Refresh DMs and switch immediately to this conversation
    const updatedDms = getDirectMessages();
    setDms(updatedDms);
    setActiveDmUser({
      email: group.adminEmail,
      username: group.adminUsername,
      displayName: group.adminDisplayName || group.adminUsername,
    });
    setActiveTab("dms");
    setTimeout(() => scrollDmToBottom("smooth"), 50);
  };

  // Filter groups
  const freeGroups = signalGroups.filter(
    (g) => !g.isVerified && g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );
  const verifiedGroups = signalGroups.filter(
    (g) => g.isVerified && g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );

  // Active DM conversation messages
  const activeConversation = dms.filter(
    (m) =>
      activeDmUser &&
      ((m.senderEmail.toLowerCase() === currentUser.email.toLowerCase() &&
        m.receiverEmail.toLowerCase() === activeDmUser.email.toLowerCase()) ||
        (m.senderEmail.toLowerCase() === activeDmUser.email.toLowerCase() &&
          m.receiverEmail.toLowerCase() === currentUser.email.toLowerCase()))
  );

  // Unique DM users list
  const uniqueDmUsers = Array.from(
    new Set(
      dms
        .filter(
          (m) =>
            m.senderEmail.toLowerCase() === currentUser.email.toLowerCase() ||
            m.receiverEmail.toLowerCase() === currentUser.email.toLowerCase()
        )
        .map((m) =>
          m.senderEmail.toLowerCase() === currentUser.email.toLowerCase()
            ? JSON.stringify({ email: m.receiverEmail, username: m.receiverUsername, displayName: m.receiverDisplayName })
            : JSON.stringify({ email: m.senderEmail, username: m.senderUsername, displayName: m.senderDisplayName })
        )
    )
  ).map((s: string) => JSON.parse(s));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header / Bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Trading Journal
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100 font-mono tracking-tight flex items-center gap-2">
                TRACKERX COMMUNITY HUB
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">
                Real-Time Trading Signals & Trader Network
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Responsive Scroll/Wrap */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => {
              setActiveTab("chat");
              setSelectedGroup(null);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === "chat"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Main </span>Chat Room
          </button>

          <button
            onClick={() => setActiveTab("groups")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === "groups"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Signal Groups
          </button>

          <button
            onClick={() => {
              setActiveTab("dms");
              setSelectedGroup(null);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === "dms"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="w-3.5 h-3.5" /> Direct Messages
          </button>
        </div>

        {/* Current User Info & Guidelines */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsGuidelinesOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-amber-400" /> Guidelines
          </button>

          <button
            onClick={() => setSelectedProfileUser(currentUser)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <span className="text-xs text-slate-300 font-mono font-bold">
              {currentUser.displayName || currentUser.username}
            </span>
            <RoleBadge role={userRole} size="xs" />
          </button>
        </div>
      </header>

      {/* Main Hub Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {/* ============================================================ */}
        {/* 1. MAIN PUBLIC CHAT ROOM VIEW (Slide 1, 2, 10, 14)           */}
        {/* ============================================================ */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[calc(100vh-140px)]">
            {/* Chat Room Subheader */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">LIVE PUBLIC CHAT</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">All registered traders & verified providers</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-700/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Community Chat</span>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
              <div
                ref={publicChatContainerRef}
                onScroll={handlePublicScroll}
                className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 font-sans"
              >
                {chatMessages.map((msg, index) => {
                  const isSelf = msg.senderEmail.toLowerCase() === currentUser.email.toLowerCase();
                  const prevMsg = index > 0 ? chatMessages[index - 1] : null;
                  const showDateDivider = isDifferentChatDay(prevMsg?.createdAt, msg.createdAt);

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateDivider && <ChatDateDivider date={msg.createdAt} />}
                      <div
                        className={`flex items-start gap-3 ${isSelf ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {/* Avatar */}
                        <button
                          onClick={() =>
                            setSelectedProfileUser({
                              email: msg.senderEmail,
                              username: msg.senderUsername,
                              displayName: msg.senderDisplayName,
                              photoURL: msg.senderPhotoURL,
                              platformRole: msg.senderRole,
                            })
                          }
                          className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0 hover:border-indigo-500 transition-colors"
                        >
                          {msg.senderPhotoURL ? (
                            <img
                              src={msg.senderPhotoURL}
                              alt={msg.senderUsername}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-mono font-bold text-slate-300 uppercase">
                              {msg.senderUsername.substring(0, 2)}
                            </span>
                          )}
                        </button>

                        {/* Message Bubble & Role Badge In Front of Name */}
                        <div className={`max-w-xl space-y-1.5 ${isSelf ? "items-end text-right" : "items-start text-left"}`}>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                            {/* ROLE BADGE IN FRONT OF NAME */}
                            <RoleBadge role={msg.senderRole} size="xs" />
                            <button
                              onClick={() =>
                                setSelectedProfileUser({
                                  email: msg.senderEmail,
                                  username: msg.senderUsername,
                                  displayName: msg.senderDisplayName,
                                  photoURL: msg.senderPhotoURL,
                                  platformRole: msg.senderRole,
                                })
                              }
                              className="font-bold text-slate-200 hover:text-indigo-400"
                            >
                              {msg.senderDisplayName || msg.senderUsername}
                            </button>
                            <span className="text-[10px] text-slate-500">
                              {formatMessageTime(msg.createdAt)}
                            </span>

                            {(isSelf || isHostAdmin || userRole === "owner" || userRole === "sub_owner" || userRole === "moderator") && (
                              <button
                                type="button"
                                onClick={() => handleDeletePublicMessage(msg.id)}
                                className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                                title="Delete Message"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <div
                            className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                              isSelf
                                ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20"
                                : "bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none"
                            }`}
                          >
                            <p className="break-words">{msg.content}</p>

                            {/* Image Attachment with Download & Zoom */}
                            {msg.photoUrl && (
                              <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-800 max-w-sm relative group bg-slate-950">
                                <img
                                  src={msg.photoUrl}
                                  alt="Attached Chart"
                                  className="w-full h-auto object-cover max-h-60 cursor-pointer hover:opacity-95 transition-opacity"
                                  onClick={() => setZoomedImage(msg.photoUrl || null)}
                                />
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadImageToLocal(msg.photoUrl!, `public_chat_${msg.id}.png`);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-slate-950/90 hover:bg-indigo-600 text-slate-200 text-[10px] font-mono flex items-center gap-1 shadow-lg transition-all border border-slate-800 hover:border-indigo-500"
                                    title="Download Photo to Device"
                                  >
                                    <Download className="w-3 h-3 text-indigo-300" />
                                    <span>Download</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Floating Jump to Latest Button for Public Chat */}
              {showPublicScrollBtn && (
                <button
                  type="button"
                  onClick={() => scrollPublicToBottom("smooth")}
                  className="absolute bottom-4 right-6 z-20 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow-xl shadow-indigo-600/40 border border-indigo-400/40 transition-all hover:scale-105 active:scale-95"
                >
                  <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                  <span>Jump to latest</span>
                </button>
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="p-4 bg-slate-950/90 border-t border-slate-800">
              {chatError && (
                <div className="mb-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {chatError}
                </div>
              )}

              {/* Hidden file input for Local Device storage */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleChatImageUpload}
                className="hidden"
              />

              {/* Pending / 5-Day Trial User Notice (Slide 2) */}
              {isTrialOrPending ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong className="text-amber-400">Pending / 5-Day Trial Accounts:</strong> You can view all live chat messages, but cannot send text/media until approved.
                    </span>
                  </div>
                  <button
                    onClick={() => setIsGuidelinesOpen(true)}
                    className="text-indigo-400 underline text-xs whitespace-nowrap"
                  >
                    View Terms
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="space-y-2">
                  {showPhotoInput && photoAttachmentUrl && (
                    <div className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <div className="w-12 h-12 rounded-lg bg-slate-950 border border-indigo-500/40 overflow-hidden shrink-0">
                        <img src={photoAttachmentUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-indigo-300 font-mono font-semibold block">
                          Photo Selected from Device
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Ready to attach to chat
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoAttachmentUrl("");
                          setShowPhotoInput(false);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 transition-colors"
                        title="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-2.5 rounded-xl border transition-colors ${
                        photoAttachmentUrl
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                      title="Upload Photo from Local Storage"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVoiceMemoActive(!voiceMemoActive);
                        if (!voiceMemoActive) {
                          setMessageInput("🎙️ [Voice Audio Analysis Note: 0:14s]");
                        }
                      }}
                      className={`p-2.5 rounded-xl border transition-colors ${
                        voiceMemoActive
                          ? "bg-rose-600 text-white border-rose-500"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                      title="Simulate Voice Note"
                    >
                      <Mic className="w-4 h-4" />
                    </button>

                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type your trade idea or analysis..."
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none font-sans"
                    />

                    <button
                      type="submit"
                      disabled={!messageInput.trim() && !photoAttachmentUrl}
                      className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/30 transition-all font-mono"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. SIGNAL GROUPS HUB (Slides 4, 5, 6, 7, 8, 9, 10, 11, 12)    */}
        {/* ============================================================ */}
        {activeTab === "groups" && (
          <div className="flex-1 flex flex-col space-y-6">
            {selectedGroup ? (
              <SignalGroupDetailView
                group={selectedGroup}
                currentUser={currentUser}
                onBack={() => setSelectedGroup(null)}
                onOpenProfile={(u) => setSelectedProfileUser(u)}
              />
            ) : (
              <>
                {/* Hub Navigation Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGroupsSubTab("free")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 ${
                        groupsSubTab === "free"
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                          : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" /> Free Tier Signals ({freeGroups.length})
                    </button>

                    <button
                      onClick={() => setGroupsSubTab("verified")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 ${
                        groupsSubTab === "verified"
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                          : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Verified Signal Groups ({verifiedGroups.length})
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        placeholder="Search signal groups..."
                        className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none font-mono"
                      />
                    </div>

                    <button
                      onClick={() => setIsCreateGroupOpen(true)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
                    >
                      <Plus className="w-4 h-4" /> + Create a Signal Group for Free
                    </button>
                  </div>
                </div>

                {/* SubTab 1: FREE TIER SIGNAL GROUPS (Slides 4, 5, 6) */}
                {groupsSubTab === "free" && (
                  <div className="space-y-4">
                    {/* Slide 4 Disclaimer Alert */}
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-300 font-mono shadow-xl">
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                        <span className="font-bold">
                          ALERT: THESE AREN'T VERIFIED SIGNALS SO TAKE YOUR OWN RISK
                        </span>
                      </div>
                      <button
                        onClick={() => setIsGuidelinesOpen(true)}
                        className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[10px]"
                      >
                        Read Guidelines
                      </button>
                    </div>

                    {/* Free Groups Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {freeGroups.map((group) => (
                        <div
                          key={group.id}
                          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-indigo-500/60 transition-all flex flex-col justify-between space-y-4 group"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center font-bold font-mono text-indigo-400">
                                  {group.logoUrl ? (
                                    <img
                                      src={group.logoUrl}
                                      alt={group.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    group.name.substring(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <h3 className="text-sm font-bold text-slate-100 font-mono group-hover:text-indigo-400 transition-colors">
                                    {group.name}
                                  </h3>
                                  <span className="text-[10px] text-slate-500 font-mono block">
                                    Admin: {group.adminDisplayName || group.adminUsername}
                                  </span>
                                </div>
                              </div>

                              <RoleBadge role={group.adminRole} size="xs" />
                            </div>

                            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                              {group.description}
                            </p>

                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                <span className="text-slate-500 block">MEMBERS</span>
                                <strong className="text-slate-200">{group.membersCount} traders</strong>
                              </div>
                              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                <span className="text-slate-500 block">WIN RATE</span>
                                <strong className="text-amber-400">
                                  {group.winRate > 0 ? `${group.winRate}%` : "In Progress"}
                                </strong>
                              </div>
                            </div>
                          </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedGroup(group)}
                                className="flex-1 py-2.5 rounded-xl bg-slate-950 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-800 hover:border-indigo-500 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md"
                              >
                                <span>Open Signal Feed</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>

                              {(isHostAdmin || group.adminEmail.toLowerCase() === currentUser.email.toLowerCase()) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGroupToDelete(group);
                                  }}
                                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-rose-900/40 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-700/60 transition-colors"
                                  title={isHostAdmin ? "Host Admin: Delete Any Group" : "Delete My Group"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SubTab 2: VERIFIED SIGNAL GROUPS (Slides 4, 11, 12) */}
                  {groupsSubTab === "verified" && (
                    <div className="space-y-4">
                      {/* Slide 4 Verified Banner */}
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-300 font-mono shadow-xl">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          <span className="font-bold">
                            CONTACT A SIGNAL GROUP OWNER TO GET SIGNALS. EVERY SIGNAL GROUP HAS MORE THAN 85% OF WIN RATE BUT BE CAREFUL, MANAGE YOUR RISK.
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                          MAX $17 USD CAP
                        </span>
                      </div>

                      {/* Verified Groups Grid with Blur Overlay (Slide 12) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {verifiedGroups.map((group) => {
                          const isMember =
                            group.members.includes(currentUser.email) ||
                            group.adminEmail.toLowerCase() === currentUser.email.toLowerCase() ||
                            currentUser.email.toLowerCase() === "sngxworld@gmail.com";

                          return (
                            <div
                              key={group.id}
                              className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-2xl flex flex-col justify-between space-y-4 relative overflow-hidden"
                            >
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/40 overflow-hidden flex items-center justify-center font-bold font-mono text-emerald-400">
                                      {group.logoUrl ? (
                                        <img
                                          src={group.logoUrl}
                                          alt={group.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        group.name.substring(0, 2).toUpperCase()
                                      )}
                                    </div>
                                    <div>
                                      <h3 className="text-sm font-bold text-slate-100 font-mono">
                                        {group.name}
                                      </h3>
                                      <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> VERIFIED ≥85% WIN RATE
                                      </span>
                                    </div>
                                  </div>

                                  <RoleBadge role="verified_signal_provider" size="xs" />
                                </div>

                                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                                  {group.description}
                                </p>

                                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                    <span className="text-slate-500 block">WIN RATE</span>
                                    <strong className="text-emerald-400 font-bold">{group.winRate}%</strong>
                                  </div>
                                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                    <span className="text-slate-500 block">SIGNALS</span>
                                    <strong className="text-slate-200">{group.totalSignals}</strong>
                                  </div>
                                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                    <span className="text-slate-500 block">PRICE</span>
                                    <strong className="text-emerald-300 font-bold">
                                      ${group.priceUsd > 0 ? `${group.priceUsd}/mo` : "Free"}
                                    </strong>
                                  </div>
                                </div>
                              </div>

                              {/* Actions based on Membership */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  {isMember ? (
                                    <button
                                      onClick={() => setSelectedGroup(group)}
                                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-600/30"
                                    >
                                      <span>Enter Verified VIP Feed</span>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleSendJoinRequestFromGroup(group)}
                                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-indigo-600/30"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" /> Message Owner to Subscribe
                                    </button>
                                  )}

                                  {(isHostAdmin || group.adminEmail.toLowerCase() === currentUser.email.toLowerCase()) && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setGroupToDelete(group);
                                      }}
                                      className="p-2.5 rounded-xl bg-slate-950 hover:bg-rose-900/40 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-700/60 transition-colors"
                                      title={isHostAdmin ? "Host Admin: Delete Any Group" : "Delete My Group"}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>

                                {!isMember && (
                                  <p className="text-[10px] text-slate-500 text-center font-mono">
                                    Fee: ${group.priceUsd}.00 USD / mo (Capped under $17 max)
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. DIRECT MESSAGES VIEW (Slides 4, 10, 12, 13)                */}
        {/* ============================================================ */}
        {activeTab === "dms" && (
          <div className="flex-1 flex bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[calc(100vh-140px)]">
            {/* DM Threads Sidebar */}
            <div className={`${activeDmUser ? "hidden md:flex" : "flex"} w-full md:w-1/3 md:min-w-[240px] md:max-w-sm bg-slate-950 border-r border-slate-800 flex flex-col shrink-0`}>
              <div className="p-4 border-b border-slate-800">
                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" /> Direct Messages ({uniqueDmUsers.length})
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-850">
                {uniqueDmUsers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 font-mono">
                    No active conversations. Start a DM from any User Profile or Verified Group.
                  </div>
                ) : (
                  uniqueDmUsers.map((u) => {
                    const isSelected = activeDmUser?.email.toLowerCase() === u.email.toLowerCase();

                    return (
                      <button
                        key={u.email}
                        onClick={() => setActiveDmUser(u)}
                        className={`w-full p-3.5 text-left flex items-center gap-3 transition-colors ${
                          isSelected ? "bg-indigo-950/50 border-l-4 border-indigo-500" : "hover:bg-slate-900"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs font-mono text-indigo-300 shrink-0">
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="text-xs font-bold text-slate-200 font-mono truncate">
                            {u.displayName || u.username}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono truncate block">
                            @{u.username}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* DM Chat Conversation Area */}
            <div className={`${activeDmUser ? "flex" : "hidden md:flex"} flex-1 flex flex-col bg-slate-900`}>
              {activeDmUser ? (
                <>
                  {/* DM Header */}
                  <div className="p-3.5 sm:p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => setActiveDmUser(null)}
                        className="md:hidden p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                        title="Back to Conversations"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs font-mono text-indigo-300 shrink-0">
                        {activeDmUser.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-100 font-mono truncate">
                          {activeDmUser.displayName || activeDmUser.username}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-mono">
                          1-on-1 Encrypted Channel
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        setSelectedProfileUser({
                          email: activeDmUser.email,
                          username: activeDmUser.username,
                          displayName: activeDmUser.displayName,
                        })
                      }
                      className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] sm:text-xs font-mono text-slate-300 shrink-0"
                    >
                      View Profile
                    </button>
                  </div>

                  {/* DM Messages Feed */}
                  <div className="flex-1 relative overflow-hidden flex flex-col">
                    <div
                      ref={dmContainerRef}
                      onScroll={handleDmScroll}
                      className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 font-sans"
                    >
                      {activeConversation.length === 0 ? (
                        <div className="text-center py-12 text-xs text-slate-500 font-mono">
                          Say hello to start the conversation!
                        </div>
                      ) : (
                        activeConversation.map((dm, index) => {
                          const isSelf = dm.senderEmail.toLowerCase() === currentUser.email.toLowerCase();
                          const prevDm = index > 0 ? activeConversation[index - 1] : null;
                          const showDateDivider = isDifferentChatDay(prevDm?.createdAt, dm.createdAt);

                          return (
                            <React.Fragment key={dm.id}>
                              {showDateDivider && <ChatDateDivider date={dm.createdAt} />}
                              <div
                                className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                              >
                                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 mb-1">
                                  <span>{dm.senderDisplayName || dm.senderUsername}</span>
                                  <span>•</span>
                                  <span>
                                    {formatMessageTime(dm.createdAt)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDmMessage(dm.id)}
                                    className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors ml-1"
                                    title="Delete Message"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>

                                <div
                                  className={`p-3.5 rounded-2xl max-w-md text-xs sm:text-sm leading-relaxed ${
                                    isSelf
                                      ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20"
                                      : "bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none"
                                  }`}
                                >
                                  {dm.isJoinRequest && (
                                    <div className="mb-2 p-2 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-[10px] font-mono text-indigo-300 flex items-center gap-1.5">
                                      <Sparkles className="w-3 h-3 text-amber-400" />
                                      <span>SIGNAL GROUP JOIN REQUEST: {dm.targetGroupName}</span>
                                    </div>
                                  )}
                                  <p className="break-words">{dm.content}</p>
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })
                      )}
                    </div>

                    {/* Floating Jump to Latest Button for DMs */}
                    {showDmScrollBtn && (
                      <button
                        type="button"
                        onClick={() => scrollDmToBottom("smooth")}
                        className="absolute bottom-4 right-6 z-20 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow-xl shadow-indigo-600/40 border border-indigo-400/40 transition-all hover:scale-105 active:scale-95"
                      >
                        <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                        <span>Jump to latest</span>
                      </button>
                    )}
                  </div>

                  {/* DM Input Bar */}
                  <form onSubmit={handleSendDM} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                    <input
                      type="text"
                      value={dmInput}
                      onChange={(e) => setDmInput(e.target.value)}
                      placeholder={`Message ${activeDmUser.displayName || activeDmUser.username}...`}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none font-sans"
                    />
                    <button
                      type="submit"
                      disabled={!dmInput.trim()}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                    >
                      <Send className="w-3.5 h-3.5" /> Send
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 font-mono space-y-2">
                  <User className="w-10 h-10 text-slate-700" />
                  <p className="text-xs">Select a direct message conversation on the left</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {isGuidelinesOpen && (
        <CommunityGuidelinesModal
          isOpen={isGuidelinesOpen}
          onClose={() => setIsGuidelinesOpen(false)}
        />
      )}

      {selectedProfileUser && (
        <UserProfileModal
          targetUser={selectedProfileUser}
          currentUser={currentUser}
          isOpen={!!selectedProfileUser}
          onClose={() => setSelectedProfileUser(null)}
          onStartDM={handleStartDMFromProfile}
          onSendJoinRequest={handleSendJoinRequestFromGroup}
          onUpdateCurrentUser={() => {}}
        />
      )}

      {isCreateGroupOpen && (
        <CreateGroupModal
          currentUser={currentUser}
          isOpen={isCreateGroupOpen}
          onClose={() => setIsCreateGroupOpen(false)}
          onGroupCreated={(newGroup) => {
            setSignalGroups(getSignalGroups());
            setSelectedGroup(newGroup);
            setActiveTab("groups");
          }}
        />
      )}

      {/* Delete Group Confirmation Modal */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold font-mono text-slate-100">
                Delete Signal Group?
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Are you sure you want to permanently delete{" "}
              <strong className="text-rose-400 font-mono">
                "{groupToDelete.name}"
              </strong>
              ? All signal postings, member lists, and discussion history will be immediately and irreversibly removed.
            </p>

            {isHostAdmin && groupToDelete.adminEmail.toLowerCase() !== currentUser.email.toLowerCase() && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-mono">
                🛡️ Host Admin Override: You are deleting this group under master host privileges.
              </div>
            )}

            {deleteGroupError && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-mono">
                {deleteGroupError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setGroupToDelete(null);
                  setDeleteGroupError(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteGroupFromHub}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Delete Group</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom with Local Download Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden p-2 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between p-2 mb-2 border-b border-slate-800 text-xs font-mono text-slate-400">
              <span>Attached Chart View</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadImageToLocal(zoomedImage, "chat_chart.png")}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-mono flex items-center gap-1.5 shadow-md transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download to Device</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoomedImage(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[75vh] w-full flex items-center justify-center">
              <img
                src={zoomedImage}
                alt="Zoomed Chart"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
