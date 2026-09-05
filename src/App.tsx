import React, { useState, useEffect } from "react";
import { UserProfile } from "./types";
import { Navbar } from "./components/Navbar";
import { GatewayScreen } from "./components/GatewayScreen";
import { TrialExpiredModal } from "./components/TrialExpiredModal";
import { AccountSuspendedModal } from "./components/AccountSuspendedModal";
import { TradingApp } from "./components/TradingApp";
import { RobotTutorialOverlay } from "./components/RobotTutorialOverlay";
import { ProfileEditorModal } from "./components/ProfileEditorModal";
import { MandatorySetupModal } from "./components/MandatorySetupModal";
import { CommunityChatHub } from "./components/CommunityChatHub";
import { checkIsTrialExpired, getTrialRemainingMs, isUserExemptFromTrial } from "./utils/deviceUtils";
import {
  markTutorialCompletedInFirestore,
  saveJournalConfigInFirestore,
  fetchUserStatusFromFirestore,
  cleanEmailKey,
} from "./lib/userStore";

export default function App() {
  const [activeView, setActiveView] = useState<"journal" | "community">("journal");
  const [communityTab, setCommunityTab] = useState<"chat" | "groups" | "dms">("chat");
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);

  // Ephemeral active session: Always requires login on page refresh or tab close
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      localStorage.removeItem("tradeplan_active_user");
      sessionStorage.removeItem("tradeplan_active_user");
    } catch {}
    return null;
  });

  // Profile Editor Modal State
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Mandatory / Optional Setup Modal State
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isSetupMandatory, setIsSetupMandatory] = useState(false);

  // Tutorial overlay state
  const [showTutorial, setShowTutorial] = useState(false);

  // Ensure active session is never persisted across browser refresh/reopen
  useEffect(() => {
    try {
      localStorage.removeItem("tradeplan_active_user");
      sessionStorage.removeItem("tradeplan_active_user");
    } catch {}
  }, []);

  // Check tutorial status and mandatory journal configuration status whenever an approved user logs in
  useEffect(() => {
    if (currentUser && isApprovedUser) {
      const cleanEmail = currentUser.email.toLowerCase();
      const tutorialKey = "sngx_tutorial_seen_" + cleanEmail;
      const localSeen = localStorage.getItem(tutorialKey) === "true";
      const cloudSeen = !!currentUser.hasSeenTutorial;

      const configuredKey = "sngx_journal_configured_" + cleanEmail;
      const localConfigured = localStorage.getItem(configuredKey) === "true";
      const cloudConfigured =
        currentUser.hasConfiguredJournal === true ||
        (!!currentUser.startingCapital && currentUser.startingCapital.trim() !== "") ||
        (currentUser.tradingData && Object.keys(currentUser.tradingData).length > 0);

      if (cloudSeen) {
        try {
          localStorage.setItem(tutorialKey, "true");
        } catch {}
      }

      if (cloudConfigured) {
        try {
          localStorage.setItem(configuredKey, "true");
        } catch {}
      }

      // If user has never seen tutorial (neither on this device nor in cloud user account)
      if (!localSeen && !cloudSeen) {
        setShowTutorial(true);
      } else {
        setShowTutorial(false);

        // If tutorial is already completed, check if mandatory configuration is needed.
        // ONLY show on first login if NEVER configured on this device or in cloud.
        if (!localConfigured && !cloudConfigured) {
          setIsSetupMandatory(true);
          setIsSetupModalOpen(true);
        } else {
          setIsSetupMandatory(false);
          setIsSetupModalOpen(false);
        }
      }
    }
  }, [
    currentUser?.email,
    currentUser?.status,
    currentUser?.hasSeenTutorial,
    currentUser?.hasConfiguredJournal,
    currentUser?.startingCapital,
  ]);

  // Complete / Skip Tutorial -> If journal is not configured yet, immediately trigger mandatory setup
  const handleFinishTutorial = async () => {
    if (currentUser) {
      const cleanEmail = currentUser.email.toLowerCase();
      const tutorialKey = "sngx_tutorial_seen_" + cleanEmail;
      try {
        localStorage.setItem(tutorialKey, "true");
      } catch {}

      // Persist across all devices to Firestore and server DB
      try {
        await markTutorialCompletedInFirestore(cleanEmail);
      } catch (err) {
        console.warn("Notice: tutorial persistence synced locally", err);
      }

      setCurrentUser((prev) => (prev ? { ...prev, hasSeenTutorial: true } : null));

      // After tutorial, if journal is not configured anywhere, show mandatory setup
      const configuredKey = "sngx_journal_configured_" + cleanEmail;
      const localConfigured = localStorage.getItem(configuredKey) === "true";
      const cloudConfigured =
        currentUser.hasConfiguredJournal === true ||
        (!!currentUser.startingCapital && currentUser.startingCapital.trim() !== "") ||
        (currentUser.tradingData && Object.keys(currentUser.tradingData).length > 0);

      if (!localConfigured && !cloudConfigured) {
        setIsSetupMandatory(true);
        setIsSetupModalOpen(true);
      } else {
        setIsSetupMandatory(false);
        setIsSetupModalOpen(false);
      }
    }
    setShowTutorial(false);
  };

  // Save Journal Configuration (Starting Capital, Year, Month)
  const handleSaveJournalSetup = async (config: {
    startingCapital: string;
    yearRange: string;
    startMonth: number;
  }) => {
    if (!currentUser) return;
    const cleanEmail = currentUser.email.toLowerCase();
    const configuredKey = "sngx_journal_configured_" + cleanEmail;
    const tutorialKey = "sngx_tutorial_seen_" + cleanEmail;

    try {
      localStorage.setItem(configuredKey, "true");
      localStorage.setItem(tutorialKey, "true");
      localStorage.setItem(`trading_capital_${cleanEmail}`, config.startingCapital);
      localStorage.setItem(
        `trading_settings_${cleanEmail}`,
        JSON.stringify({
          yearRange: config.yearRange,
          startMonth: config.startMonth,
          selectedMonth: config.startMonth,
          startingCapital: config.startingCapital,
        })
      );
    } catch {}

    try {
      await saveJournalConfigInFirestore(cleanEmail, {
        ...config,
        hasConfiguredJournal: true,
      });
    } catch (err) {
      console.warn("Notice: journal config saved locally", err);
    }

    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            startingCapital: config.startingCapital,
            yearRange: config.yearRange,
            startMonth: config.startMonth,
            hasConfiguredJournal: true,
            hasSeenTutorial: true,
          }
        : null
    );

    setIsSetupModalOpen(false);
    setIsSetupMandatory(false);
  };

  // Replay Tutorial
  const handleReplayTutorial = () => {
    setShowTutorial(true);
  };

  // Refresh review status from local state, Firestore & server
  const handleRefreshStatus = async () => {
    if (!currentUser) return;
    const cleanEmail = currentUser.email.trim().toLowerCase();

    // Check local stored users cache
    const localUsers: any[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const matchedLocal = localUsers.find((u) => u.email && u.email.trim().toLowerCase() === cleanEmail);

    const isLocallyBanned = localStorage.getItem(`sngx_banned_${cleanEmail}`) === "true";
    let newStatus = isLocallyBanned ? "banned" : matchedLocal?.status || currentUser.status;
    let newRole = matchedLocal?.role;
    let newPlatformRole = matchedLocal?.platformRole;
    let newHasSeenTutorial = matchedLocal?.hasSeenTutorial;
    let newHasConfiguredJournal = matchedLocal?.hasConfiguredJournal;
    let newYearRange = matchedLocal?.yearRange;
    let newStartMonth = matchedLocal?.startMonth;
    let newStartingCapital = matchedLocal?.startingCapital;
    let newSubscribed = matchedLocal?.subscribed;
    let newWasApproved = matchedLocal?.wasApproved;
    let newBannedReason = matchedLocal?.bannedReason;
    let newBanAppeal = matchedLocal?.banAppeal;

    // Master Host Admin is always approved
    if (cleanEmail === "sngxworld@gmail.com") {
      newStatus = "approved";
    }

    // 1. Fetch live ground-truth status from Firestore
    try {
      const liveFsUser = await fetchUserStatusFromFirestore(cleanEmail);
      if (liveFsUser) {
        if (liveFsUser.status) {
          newStatus = liveFsUser.status;
          if (newStatus === "banned") {
            localStorage.setItem(`sngx_banned_${cleanEmail}`, "true");
          } else if (newStatus === "approved") {
            localStorage.removeItem(`sngx_banned_${cleanEmail}`);
            localStorage.setItem(`sngx_was_approved_${cleanEmail}`, "true");
          }
        }
        if (liveFsUser.role) newRole = liveFsUser.role;
        if (liveFsUser.platformRole) newPlatformRole = liveFsUser.platformRole;
        if (liveFsUser.hasSeenTutorial !== undefined) newHasSeenTutorial = liveFsUser.hasSeenTutorial;
        if (liveFsUser.hasConfiguredJournal !== undefined) newHasConfiguredJournal = liveFsUser.hasConfiguredJournal;
        if (liveFsUser.yearRange) newYearRange = liveFsUser.yearRange;
        if (liveFsUser.startMonth !== undefined) newStartMonth = liveFsUser.startMonth;
        if (liveFsUser.startingCapital) newStartingCapital = liveFsUser.startingCapital;
        if (liveFsUser.subscribed !== undefined) newSubscribed = liveFsUser.subscribed;
        if (liveFsUser.wasApproved !== undefined) newWasApproved = liveFsUser.wasApproved;
        if (liveFsUser.bannedReason !== undefined) newBannedReason = liveFsUser.bannedReason;
        if (liveFsUser.banAppeal !== undefined) newBanAppeal = liveFsUser.banAppeal;
      }
    } catch (e) {}

    // 2. Fetch from backend /api/auth/status
    try {
      const res = await fetch(`/api/auth/status/${encodeURIComponent(currentUser.email)}`);
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const data = await res.json();
        if (data.status) {
          if (data.status === "banned") {
            newStatus = "banned";
            localStorage.setItem(`sngx_banned_${cleanEmail}`, "true");
          } else if (data.status === "approved") {
            newStatus = "approved";
            localStorage.removeItem(`sngx_banned_${cleanEmail}`);
            localStorage.setItem(`sngx_was_approved_${cleanEmail}`, "true");
          } else if (newStatus !== "banned") {
            newStatus = data.status;
          }
          if (data.role) newRole = data.role;
          if (data.platformRole) newPlatformRole = data.platformRole;
          if (data.user?.hasSeenTutorial !== undefined) {
            newHasSeenTutorial = data.user.hasSeenTutorial;
          }
          if (data.user?.hasConfiguredJournal !== undefined) {
            newHasConfiguredJournal = data.user.hasConfiguredJournal;
          }
          if (data.user?.yearRange) newYearRange = data.user.yearRange;
          if (data.user?.startMonth !== undefined) newStartMonth = data.user.startMonth;
          if (data.user?.startingCapital) newStartingCapital = data.user.startingCapital;
          if (data.user?.subscribed !== undefined) newSubscribed = data.user.subscribed;
          if (data.user?.bannedReason !== undefined) newBannedReason = data.user.bannedReason;
        }
      }
    } catch (err) {
      console.warn("Server status refresh notice:", err);
    }

    // Safety: If user is suspended (revoked/banned/rejected), purge from pre-approved local storage cache
    if (newStatus === "revoked" || newStatus === "banned" || newStatus === "rejected") {
      try {
        const preList: string[] = JSON.parse(localStorage.getItem("sngx_preapproved_emails") || "[]");
        const filtered = preList.filter((e) => e.trim().toLowerCase() !== cleanEmail);
        localStorage.setItem("sngx_preapproved_emails", JSON.stringify(filtered));
      } catch (e) {}
    }

    // Update cached user in sngx_local_users to prevent desync
    try {
      const idx = localUsers.findIndex((u) => u.email && u.email.trim().toLowerCase() === cleanEmail);
      if (idx !== -1) {
        localUsers[idx] = {
          ...localUsers[idx],
          status: newStatus,
          role: newRole || localUsers[idx].role,
          platformRole: newPlatformRole || localUsers[idx].platformRole,
          subscribed: newSubscribed !== undefined ? newSubscribed : localUsers[idx].subscribed,
          wasApproved: newWasApproved !== undefined ? newWasApproved : localUsers[idx].wasApproved,
          bannedReason: newBannedReason || localUsers[idx].bannedReason,
          banAppeal: newBanAppeal || localUsers[idx].banAppeal,
        };
        localStorage.setItem("sngx_local_users", JSON.stringify(localUsers));
      }
    } catch (e) {}

    if (
      newStatus &&
      (newStatus !== currentUser.status ||
        (newRole && newRole !== currentUser.role) ||
        (newPlatformRole && newPlatformRole !== currentUser.platformRole) ||
        (newHasSeenTutorial !== undefined && newHasSeenTutorial !== currentUser.hasSeenTutorial) ||
        (newHasConfiguredJournal !== undefined && newHasConfiguredJournal !== currentUser.hasConfiguredJournal) ||
        (newYearRange && newYearRange !== currentUser.yearRange) ||
        (newStartMonth !== undefined && newStartMonth !== currentUser.startMonth) ||
        (newStartingCapital && newStartingCapital !== currentUser.startingCapital) ||
        (newSubscribed !== undefined && newSubscribed !== currentUser.subscribed) ||
        (newBannedReason !== undefined && newBannedReason !== currentUser.bannedReason) ||
        (newBanAppeal !== undefined && newBanAppeal !== currentUser.banAppeal))
    ) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              role: newRole || prev.role,
              platformRole: newPlatformRole || prev.platformRole,
              hasSeenTutorial: newHasSeenTutorial !== undefined ? newHasSeenTutorial : prev.hasSeenTutorial,
              hasConfiguredJournal:
                newHasConfiguredJournal !== undefined ? newHasConfiguredJournal : prev.hasConfiguredJournal,
              yearRange: newYearRange || prev.yearRange,
              startMonth: newStartMonth !== undefined ? newStartMonth : prev.startMonth,
              startingCapital: newStartingCapital || prev.startingCapital,
              subscribed: newSubscribed !== undefined ? newSubscribed : prev.subscribed,
              wasApproved: newWasApproved !== undefined ? newWasApproved : prev.wasApproved,
              bannedReason: newBannedReason || prev.bannedReason,
              banAppeal: newBanAppeal || prev.banAppeal,
            }
          : null
      );
    }
  };

  const cleanEmail = cleanEmailKey(currentUser?.email || "");
  const isMasterOwner = cleanEmail === "sngxworld@gmail.com";
  const isExemptUser = currentUser ? isUserExemptFromTrial(currentUser) : false;

  // Calculate trial remaining time in ms (only for non-exempt users)
  const trialRemainingMs = currentUser && !isExemptUser ? getTrialRemainingMs(currentUser) : 0;

  // Subscribed flag (explicit subscription or previously approved in history)
  const isSubscribedUser = Boolean(
    currentUser?.subscribed ||
      currentUser?.isSubscribed ||
      currentUser?.hasSubscribed ||
      currentUser?.wasApproved ||
      (typeof window !== "undefined" && localStorage.getItem(`sngx_was_approved_${cleanEmail}`) === "true")
  );

  // 1. Strict Ban Gate (IMG 3: Cannot be bypassed, persists permanently, unmounts entire app)
  const isBannedUser =
    !isMasterOwner &&
    Boolean(
      currentUser?.status === "banned" ||
        (typeof window !== "undefined" && localStorage.getItem(`sngx_banned_${cleanEmail}`) === "true")
    );

  // 2. Strict Revoked Subscribed Gate (IMG 1: Revoked a person who already subscribed -> "UR ACCESS HAS BEEN REVOKED CONTACT THE OWNER OR AN MODERATOR")
  const isRevokedSubscribedUser =
    !isMasterOwner && !isBannedUser && currentUser?.status === "revoked" && isSubscribedUser;

  // 3. Revoked Trial User (IMG 1: Revoked access of user who has time on trial -> THEY DON'T GET FULLY REVOKED UNTIL TIME GOES 0)
  // If currentUser.status === "revoked" and !isSubscribedUser:
  // - If trialRemainingMs > 0: user continues on trial! (isSuspendedUser is FALSE, isTrialExpired is FALSE)
  // - If trialRemainingMs <= 0: user gets Trial Ended screen! (isTrialExpired is TRUE)

  // 4. Rejected Gate
  const isRejectedUser = !isMasterOwner && !isBannedUser && currentUser?.status === "rejected";

  // 5. Approved User (IMG 2: Subscribed / granted access -> logs in normally)
  const isApprovedUser =
    !isBannedUser &&
    !isRevokedSubscribedUser &&
    !isRejectedUser &&
    (isMasterOwner ||
      currentUser?.status === "approved" ||
      currentUser?.role === "admin" ||
      currentUser?.platformRole === "owner" ||
      isSubscribedUser ||
      isExemptUser);

  // 6. Trial Expired Check
  // Expired if not approved, not banned, not revoked-subscribed, and trial remaining <= 0!
  const isTrialExpired =
    !isApprovedUser &&
    !isBannedUser &&
    !isRevokedSubscribedUser &&
    !isRejectedUser &&
    trialRemainingMs <= 0;

  // Is Suspended User (for rendering the suspension/revocation screen)
  const isSuspendedUser = isBannedUser || isRevokedSubscribedUser || isRejectedUser;

  // Auto-poll approval status every 4 seconds if user is awaiting host admin approval, suspended, or trial expired
  useEffect(() => {
    if (!currentUser || isApprovedUser) return;
    const interval = setInterval(handleRefreshStatus, 4000);
    return () => clearInterval(interval);
  }, [currentUser?.email, currentUser?.status, isApprovedUser]);

  const handleLogout = () => {
    try {
      localStorage.removeItem("tradeplan_active_user");
      sessionStorage.removeItem("tradeplan_active_user");
    } catch (e) {}
    setCurrentUser(null);
  };

  // 1. If user is not logged in -> Show Gateway Screen
  if (!currentUser) {
    return (
      <GatewayScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
        onRegisteredPending={(user) => setCurrentUser(user)}
      />
    );
  }

  // 2. Render Primary Application with TradingApp
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans selection:bg-blue-600 selection:text-white relative">
      {/* Top Navbar */}
      <Navbar
        user={currentUser}
        onLogout={handleLogout}
        onRefreshStatus={handleRefreshStatus}
        onReplayTutorial={handleReplayTutorial}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenSetup={() => {
          setIsSetupMandatory(false);
          setIsSetupModalOpen(true);
        }}
        onExportExcel={() => {
          window.dispatchEvent(new CustomEvent("trackerx:export-excel"));
        }}
        onResetJournal={() => {
          window.dispatchEvent(new CustomEvent("trackerx:reset-journal"));
        }}
        activeView={activeView}
        onToggleView={(v) => setActiveView(v)}
        communityTab={communityTab}
        onSelectCommunityTab={(tab) => {
          setCommunityTab(tab);
          if (activeView !== "community") {
            setActiveView("community");
          }
        }}
        onOpenGuidelines={() => {
          if (activeView !== "community") {
            setActiveView("community");
          }
          setIsGuidelinesOpen(true);
        }}
      />

      {/* Profile Editor Modal */}
      {isProfileOpen && currentUser && (
        <ProfileEditorModal
          user={currentUser}
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
          onLogout={() => {
            setIsProfileOpen(false);
            handleLogout();
          }}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* If account is Revoked / Banned by Host Admin, show AccountSuspendedModal gate */}
        {isSuspendedUser && currentUser ? (
          <AccountSuspendedModal
            user={currentUser}
            onRefreshStatus={handleRefreshStatus}
            onLogout={handleLogout}
            mode={isBannedUser ? "banned" : isRevokedSubscribedUser ? "revoked-subscribed" : "generic"}
          />
        ) : isTrialExpired && currentUser ? (
          /* If 5-Day trial is expired and user is not approved/suspended, show TrialExpiredModal */
          <TrialExpiredModal
            user={currentUser}
            onRefreshStatus={handleRefreshStatus}
            onLogout={handleLogout}
          />
        ) : (
          <div
            className={`transition-all duration-300 ${
              isSetupMandatory && isSetupModalOpen
                ? "opacity-25 blur-md pointer-events-none select-none overflow-hidden max-h-[calc(100vh-64px)]"
                : "opacity-100"
            }`}
          >
            {activeView === "community" ? (
              <CommunityChatHub
                currentUser={currentUser}
                onBackToApp={() => setActiveView("journal")}
                activeTab={communityTab}
                onTabChange={(tab) => setCommunityTab(tab)}
                isGuidelinesOpen={isGuidelinesOpen}
                onOpenGuidelines={() => setIsGuidelinesOpen(true)}
                onCloseGuidelines={() => setIsGuidelinesOpen(false)}
              />
            ) : (
              <main className="container max-w-7xl mx-auto px-2 sm:px-6 py-3 sm:py-6">
                <TradingApp
                  user={currentUser}
                  onSaveDataToServer={(newData) => {
                    setCurrentUser((prev) => (prev ? { ...prev, tradingData: newData } : null));
                  }}
                  onOpenSetup={() => {
                    setIsSetupMandatory(false);
                    setIsSetupModalOpen(true);
                  }}
                />
              </main>
            )}
          </div>
        )}
      </div>

      {/* 3D Robot First-Login Interactive Tutorial Overlay */}
      {showTutorial && !isTrialExpired && !isSuspendedUser && (
        <RobotTutorialOverlay
          onComplete={handleFinishTutorial}
          onSkip={handleFinishTutorial}
        />
      )}

      {/* Mandatory / Timeline Setup Modal */}
      {isSetupModalOpen && currentUser && !showTutorial && !isTrialExpired && !isSuspendedUser && (
        <MandatorySetupModal
          isOpen={isSetupModalOpen}
          isMandatory={isSetupMandatory}
          initialCapital={currentUser.startingCapital || "100"}
          initialYear={currentUser.yearRange || "2026"}
          initialMonth={currentUser.startMonth !== undefined ? currentUser.startMonth : 0}
          onSave={handleSaveJournalSetup}
          onClose={() => {
            if (!isSetupMandatory) setIsSetupModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
