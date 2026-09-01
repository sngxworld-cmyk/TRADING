import React, { useState, useEffect } from "react";
import { UserProfile } from "./types";
import { Navbar } from "./components/Navbar";
import { GatewayScreen } from "./components/GatewayScreen";
import { UnderReviewModal } from "./components/UnderReviewModal";
import { TradingApp } from "./components/TradingApp";
import { RobotTutorialOverlay } from "./components/RobotTutorialOverlay";
import { ProfileEditorModal } from "./components/ProfileEditorModal";
import { MandatorySetupModal } from "./components/MandatorySetupModal";
import { CommunityChatHub } from "./components/CommunityChatHub";
import { checkIsTrialExpired } from "./utils/deviceUtils";
import { markTutorialCompletedInFirestore, saveJournalConfigInFirestore } from "./lib/userStore";

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
    if (currentUser && (currentUser.status === "approved" || currentUser.role === "admin")) {
      const cleanEmail = currentUser.email.toLowerCase();
      const tutorialKey = "sngx_tutorial_seen_" + cleanEmail;
      const localSeen = localStorage.getItem(tutorialKey) === "true";
      const cloudSeen = !!currentUser.hasSeenTutorial;

      const configuredKey = "sngx_journal_configured_" + cleanEmail;
      const localConfigured = localStorage.getItem(configuredKey) === "true";
      const cloudConfigured = !!currentUser.hasConfiguredJournal;

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

        // If tutorial is already completed, check if mandatory configuration is needed
        if (!localConfigured && !cloudConfigured) {
          setIsSetupMandatory(true);
          setIsSetupModalOpen(true);
        }
      }
    }
  }, [currentUser?.email, currentUser?.status, currentUser?.hasSeenTutorial, currentUser?.hasConfiguredJournal]);

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

      // After tutorial, if journal is not configured, show mandatory setup
      const configuredKey = "sngx_journal_configured_" + cleanEmail;
      const localConfigured = localStorage.getItem(configuredKey) === "true";
      const cloudConfigured = !!currentUser.hasConfiguredJournal;

      if (!localConfigured && !cloudConfigured) {
        setIsSetupMandatory(true);
        setIsSetupModalOpen(true);
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

  // Refresh review status from local state & server
  const handleRefreshStatus = async () => {
    if (!currentUser) return;
    const cleanEmail = currentUser.email.trim().toLowerCase();

    // Check local pre-approved list & stored users
    const localUsers: any[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const matchedLocal = localUsers.find((u) => u.email && u.email.trim().toLowerCase() === cleanEmail);

    let newStatus = matchedLocal?.status;
    let newRole = matchedLocal?.role;
    let newPlatformRole = matchedLocal?.platformRole;
    let newHasSeenTutorial = matchedLocal?.hasSeenTutorial;
    let newHasConfiguredJournal = matchedLocal?.hasConfiguredJournal;
    let newYearRange = matchedLocal?.yearRange;
    let newStartMonth = matchedLocal?.startMonth;
    let newStartingCapital = matchedLocal?.startingCapital;

    const preApprovedList: string[] = JSON.parse(localStorage.getItem("sngx_preapproved_emails") || "[]");
    if (cleanEmail === "sngxworld@gmail.com" || preApprovedList.some((e: string) => e.toLowerCase() === cleanEmail)) {
      newStatus = "approved";
    }

    try {
      const res = await fetch(`/api/auth/status/${encodeURIComponent(currentUser.email)}`);
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const data = await res.json();
        if (data.status) {
          newStatus = data.status;
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
        }
      }
    } catch (err) {
      console.warn("Server status refresh notice:", err);
    }

    if (
      newStatus &&
      (newStatus !== currentUser.status ||
        (newRole && newRole !== currentUser.role) ||
        (newPlatformRole && newPlatformRole !== currentUser.platformRole) ||
        (newHasSeenTutorial !== undefined && newHasSeenTutorial !== currentUser.hasSeenTutorial) ||
        (newHasConfiguredJournal !== undefined && newHasConfiguredJournal !== currentUser.hasConfiguredJournal) ||
        (newYearRange && newYearRange !== currentUser.yearRange) ||
        (newStartMonth !== undefined && newStartMonth !== currentUser.startMonth) ||
        (newStartingCapital && newStartingCapital !== currentUser.startingCapital))
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
            }
          : null
      );
    }
  };

  // Calculate 5-Day Trial Status (strict device & user account check)
  const isApprovedUser =
    currentUser?.status === "approved" ||
    currentUser?.role === "admin" ||
    currentUser?.platformRole === "owner" ||
    currentUser?.platformRole === "sub_owner" ||
    currentUser?.email?.toLowerCase() === "sngxworld@gmail.com";
  const isTrialExpired = !isApprovedUser && checkIsTrialExpired(currentUser);

  // Auto-poll approval status every 4 seconds if user is awaiting host admin approval
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
      {/* 3D Robot First-Login Interactive Tutorial Overlay */}
      {showTutorial && !isTrialExpired && (
        <RobotTutorialOverlay
          onComplete={handleFinishTutorial}
          onSkip={handleFinishTutorial}
        />
      )}

      {/* Mandatory / Timeline Setup Modal */}
      {isSetupModalOpen && currentUser && !showTutorial && (
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
        {/* If 5-Day trial is expired and user is not approved, show Modal overlay over blurred background */}
        {isTrialExpired && (
          <UnderReviewModal
            user={currentUser}
            onRefreshStatus={handleRefreshStatus}
            onLogout={handleLogout}
            isTrialExpired={true}
          />
        )}

        <div
          className={`transition-all duration-300 ${
            isTrialExpired || (isSetupMandatory && isSetupModalOpen)
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
            <main className="container max-w-7xl mx-auto px-4 sm:px-6 py-6">
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
      </div>
    </div>
  );
}
