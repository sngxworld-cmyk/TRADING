import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { TradingDataStore, User, UserProfile, UserStatus, AdminUserRecord, AuditLog } from "../types";
import { verifyDeviceRegistrationPermission, recordDeviceRegistration, getDeviceId, isHostMasterDevice } from "../utils/deviceUtils";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

let isQuotaExceeded = false;
let quotaExceededTime = 0;

export function checkQuotaStatus(): boolean {
  if (isQuotaExceeded && Date.now() - quotaExceededTime < 120000) {
    return true;
  }
  if (isQuotaExceeded) {
    isQuotaExceeded = false;
  }
  return false;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errStr = error instanceof Error ? error.message : String(error);

  if (
    errStr.includes("Quota exceeded") ||
    errStr.includes("RESOURCE_EXHAUSTED") ||
    errStr.includes("quota-exceeded") ||
    errStr.includes("quota") ||
    errStr.includes("429")
  ) {
    isQuotaExceeded = true;
    quotaExceededTime = Date.now();
    console.warn(
      `[Firestore Quota Notice] ${operationType} on ${path}. Operating seamlessly via Local & Server DB.`
    );
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path,
  };
  console.warn("Firestore Notice: ", JSON.stringify(errInfo));
}

// Normalize email key for Firestore document ID
export function cleanEmailKey(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Add an audit log into Firestore /logs
 */
export async function addAuditLogToFirestore(message: string, type: "info" | "success" | "warning" = "info") {
  if (checkQuotaStatus()) return;
  try {
    const id = "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    await setDoc(doc(db, "logs", id), {
      id,
      timestamp: new Date().toISOString(),
      message,
      type,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "logs");
  }
}

/**
 * Register a new user in Firestore /users/{cleanEmail}
 */
export async function registerUserInFirestore(params: {
  email: string;
  username: string;
  password?: string;
  displayName?: string;
  photoURL?: string;
  phone?: string;
  dob?: string;
  bio?: string;
  tradingPair?: string;
  tradingMarket?: string;
  startingCapital?: string;
}): Promise<User> {
  const cleanEmail = cleanEmailKey(params.email);
  if (!cleanEmail) throw new Error("Email address is required.");

  // 0. Verify only one registration per device is allowed
  const devCheck = await verifyDeviceRegistrationPermission(cleanEmail);
  if (!devCheck.allowed) {
    throw new Error(devCheck.reason || "Only 1 account registration is allowed per device. Please log in or complete payment.");
  }

  const docPath = `users/${cleanEmail}`;

  // 1. Check if user document already exists
  try {
    if (!checkQuotaStatus()) {
      const existingSnap = await getDoc(doc(db, "users", cleanEmail));
      if (existingSnap.exists()) {
        throw new Error("This email address is already registered.");
      }
    }
  } catch (err: any) {
    if (err.message?.includes("already registered")) throw err;
    handleFirestoreError(err, OperationType.GET, docPath);
  }

  // 2. Check if pre-approved or master admin
  const isMasterAdmin = cleanEmail === "sngxworld@gmail.com";
  let isPreApproved = isMasterAdmin;

  if (!isPreApproved && !checkQuotaStatus()) {
    try {
      const preSnap = await getDoc(doc(db, "preApprovedEmails", cleanEmail));
      if (preSnap.exists()) {
        isPreApproved = true;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `preApprovedEmails/${cleanEmail}`);
    }
  }

  const role = isMasterAdmin ? "admin" : "client";
  const status = isPreApproved ? "approved" : "pending";

  const newUser: User = {
    id: "usr_" + Date.now(),
    email: cleanEmail,
    username: params.username.trim(),
    displayName: params.displayName?.trim() || params.username.trim(),
    photoURL: params.photoURL || "",
    phone: params.phone?.trim() || "",
    dob: params.dob?.trim() || "",
    bio: params.bio?.trim() || "",
    tradingPair: params.tradingMarket || params.tradingPair?.trim() || "Crypto Market",
    tradingMarket: params.tradingMarket || params.tradingPair?.trim() || "Crypto Market",
    startingCapital: params.startingCapital?.trim() || "",
    role,
    status,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  const firestoreRecord: Record<string, any> = {
    ...newUser,
    password: params.password || "",
    deviceId: getDeviceId(),
    tradingData: {},
  };

  if (!checkQuotaStatus()) {
    try {
      await setDoc(doc(db, "users", cleanEmail), firestoreRecord);
      await addAuditLogToFirestore(
        `New user registered: ${cleanEmail} (${status.toUpperCase()})`,
        status === "approved" ? "success" : "info"
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  }

  // Bind device to this registered account permanently
  try {
    await recordDeviceRegistration(cleanEmail, newUser.createdAt);
  } catch (e) {}

  // Also register via Server API
  try {
    await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...params,
        deviceId: getDeviceId(),
        isMasterDevice: isHostMasterDevice(),
      }),
    });
  } catch (e) {}

  // Local backup
  try {
    const localUsers = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    localUsers.push(firestoreRecord);
    localStorage.setItem("sngx_local_users", JSON.stringify(localUsers));
  } catch (e) {}

  return newUser;
}

/**
 * Update user profile details in Firestore /users/{cleanEmail}
 */
export async function updateUserProfileInFirestore(
  email: string,
  updates: Partial<UserProfile>
): Promise<User> {
  const cleanEmail = cleanEmailKey(email);
  if (!cleanEmail) throw new Error("Email address is required.");

  const docPath = `users/${cleanEmail}`;
  const localUsers: any[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
  const existingLocalIndex = localUsers.findIndex(
    (u) => u.email && u.email.trim().toLowerCase() === cleanEmail
  );

  let currentUserData: any = existingLocalIndex !== -1 ? localUsers[existingLocalIndex] : {};

  if (!checkQuotaStatus()) {
    try {
      const snap = await getDoc(doc(db, "users", cleanEmail));
      if (snap.exists()) {
        currentUserData = { ...currentUserData, ...snap.data() };
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, docPath);
    }
  }

  const updatedRecord = {
    ...currentUserData,
    ...updates,
    email: cleanEmail,
    updatedAt: new Date().toISOString(),
  };

  if (!checkQuotaStatus()) {
    try {
      await setDoc(doc(db, "users", cleanEmail), updatedRecord, { merge: true });
      await addAuditLogToFirestore(`User profile updated for: ${cleanEmail}`, "info");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  }

  // Update local backup and active session
  try {
    if (existingLocalIndex !== -1) {
      localUsers[existingLocalIndex] = updatedRecord;
    } else {
      localUsers.push(updatedRecord);
    }
    localStorage.setItem("sngx_local_users", JSON.stringify(localUsers));
  } catch (e) {}

  // Sync profile updates with Server API
  try {
    await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, updates }),
    });
  } catch (e) {}

  const updatedUser: User = {
    id: updatedRecord.id || "usr_" + Date.now(),
    email: cleanEmail,
    username: updatedRecord.username || cleanEmail.split("@")[0],
    displayName: updatedRecord.displayName || updatedRecord.username || cleanEmail.split("@")[0],
    photoURL: updatedRecord.photoURL || "",
    phone: updatedRecord.phone || "",
    dob: updatedRecord.dob || "",
    bio: updatedRecord.bio || "",
    tradingPair: updatedRecord.tradingMarket || updatedRecord.tradingPair || "Crypto Market",
    tradingMarket: updatedRecord.tradingMarket || updatedRecord.tradingPair || "Crypto Market",
    startingCapital: updatedRecord.startingCapital || "",
    role: updatedRecord.role || "client",
    status: updatedRecord.status || "approved",
    createdAt: updatedRecord.createdAt,
    lastLogin: updatedRecord.lastLogin || new Date().toISOString(),
    tradingData: updatedRecord.tradingData || null,
  };

  // Update record
  return updatedUser;
}

/**
 * Login user via Firestore /users
 */
export async function loginUserInFirestore(
  identifier: string,
  passwordInput: string
): Promise<{ user: User; status: UserStatus }> {
  const cleanIdent = identifier.trim().toLowerCase();

  // Special Master Admin fallback
  if (
    (cleanIdent === "sngxworld@gmail.com" || cleanIdent === "sngxadmin") &&
    passwordInput === "adminpassword123"
  ) {
    const masterAdmin: User = {
      id: "usr_admin_master",
      email: "sngxworld@gmail.com",
      username: "sngxadmin",
      role: "admin",
      status: "approved",
      lastLogin: new Date().toISOString(),
    };
    if (!checkQuotaStatus()) {
      try {
        await setDoc(
          doc(db, "users", "sngxworld@gmail.com"),
          {
            id: masterAdmin.id,
            email: masterAdmin.email,
            username: masterAdmin.username,
            role: "admin",
            status: "approved",
            password: "adminpassword123",
            lastLogin: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, "users/sngxworld@gmail.com");
      }
    }
    return { user: masterAdmin, status: "approved" };
  }

  let matchedData: any = null;

  // Try direct lookup by email in Firestore
  if (!checkQuotaStatus()) {
    try {
      const docSnap = await getDoc(doc(db, "users", cleanIdent));
      if (docSnap.exists()) {
        matchedData = docSnap.data();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${cleanIdent}`);
    }
  }

  // If not found by email key, try querying all users to match username
  if (!matchedData && !checkQuotaStatus()) {
    try {
      const snap = await getDocs(collection(db, "users"));
      snap.forEach((d) => {
        const u = d.data();
        if (
          u.email?.toLowerCase() === cleanIdent ||
          u.username?.toLowerCase() === cleanIdent
        ) {
          matchedData = u;
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "users");
    }
  }

  // Fallback check in local storage if offline/error/quota exceeded
  if (!matchedData) {
    try {
      const localUsers = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
      matchedData = localUsers.find(
        (u: any) =>
          u.email?.toLowerCase() === cleanIdent || u.username?.toLowerCase() === cleanIdent
      );
    } catch (e) {}
  }

  // Final fallback to Server API
  if (!matchedData) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cleanIdent, password: passwordInput }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          matchedData = data.user;
        }
      }
    } catch (e) {}
  }

  if (!matchedData) {
    throw new Error("Invalid credentials. Please check your username/email and password.");
  }

  if (matchedData.password && matchedData.password !== passwordInput) {
    throw new Error("Invalid credentials. Password does not match.");
  }

  const user: User = {
    id: matchedData.id || "usr_" + Date.now(),
    email: matchedData.email,
    username: matchedData.username,
    displayName: matchedData.displayName || matchedData.username,
    photoURL: matchedData.photoURL || "",
    phone: matchedData.phone || "",
    dob: matchedData.dob || "",
    bio: matchedData.bio || "",
    tradingPair: matchedData.tradingPair || "BTC/USDT",
    startingCapital: matchedData.startingCapital || "",
    role: matchedData.role || "client",
    status: matchedData.status || "pending",
    createdAt: matchedData.createdAt,
    lastLogin: new Date().toISOString(),
    tradingData: matchedData.tradingData || {},
  };

  // Update last login in Firestore if active
  if (!checkQuotaStatus()) {
    try {
      await setDoc(
        doc(db, "users", cleanEmailKey(user.email)),
        { lastLogin: user.lastLogin },
        { merge: true }
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${cleanEmailKey(user.email)}`);
    }
  }

  // Device registration check (transient active session)
  try {
    recordDeviceRegistration(user.email, user.createdAt);
  } catch (e) {}

  if (user.status === "revoked") {
    throw new Error("Access Revoked. Your access to this portal has been revoked by Host Admin.");
  }

  return { user, status: user.status };
}

/**
 * Save user trading data & metadata directly to Firestore under their Gmail
 */
export async function saveUserDataToFirestore(
  email: string,
  tradingData: TradingDataStore,
  metadata?: { yearRange?: string; startMonth?: number; startingCapital?: string }
) {
  const key = cleanEmailKey(email);
  if (!key) return;

  // Always back up to localStorage
  try {
    if (tradingData && Object.keys(tradingData).length > 0) {
      localStorage.setItem(`sngx_trading_data_${key}`, JSON.stringify(tradingData));
    }
  } catch (e) {}

  // Save to Server API
  try {
    await fetch(`/api/user/data/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradingData, ...metadata }),
    });
  } catch (e) {}

  if (checkQuotaStatus()) return;

  const docPath = `users/${key}`;
  try {
    const payload: Record<string, any> = {
      email: key,
      updatedAt: new Date().toISOString(),
    };

    if (tradingData && Object.keys(tradingData).length > 0) {
      payload.tradingData = tradingData;
    }

    if (metadata?.yearRange !== undefined) {
      payload.yearRange = metadata.yearRange;
    }
    if (metadata?.startMonth !== undefined) {
      payload.startMonth = metadata.startMonth;
    }
    if (metadata?.startingCapital !== undefined) {
      payload.startingCapital = metadata.startingCapital;
    }

    await setDoc(doc(db, "users", key), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Get user trading data & metadata directly from Firestore under their Gmail
 */
export async function getUserDataFromFirestore(email: string) {
  const key = cleanEmailKey(email);
  if (!key) return null;

  if (!checkQuotaStatus()) {
    const docPath = `users/${key}`;
    try {
      const docRef = doc(db, "users", key);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, docPath);
    }
  }

  // Try Server API fallback
  try {
    const res = await fetch(`/api/user/data/${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.tradingData || data.startingCapital)) {
        return data;
      }
    }
  } catch (e) {}

  // Local fallback
  try {
    const local = localStorage.getItem(`sngx_trading_data_${key}`);
    if (local) {
      return { tradingData: JSON.parse(local) };
    }
  } catch (e) {}

  return null;
}

/**
 * Subscribe to real-time Firestore updates for a given user Gmail
 */
export function subscribeUserDataFromFirestore(
  email: string,
  onData: (data: any) => void
) {
  const key = cleanEmailKey(email);
  if (!key) return () => {};

  if (checkQuotaStatus()) {
    // Provide initial data from localStorage
    try {
      const local = localStorage.getItem(`sngx_trading_data_${key}`);
      if (local) {
        onData({ tradingData: JSON.parse(local) });
      }
    } catch (e) {}
    return () => {};
  }

  const docPath = `users/${key}`;
  const docRef = doc(db, "users", key);

  try {
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onData(snapshot.data());
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, docPath);
        try {
          const local = localStorage.getItem(`sngx_trading_data_${key}`);
          if (local) {
            onData({ tradingData: JSON.parse(local) });
          }
        } catch (e) {}
      }
    );

    return unsubscribe;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, docPath);
    return () => {};
  }
}

/**
 * Fetch all admin users, pre-approved emails, and audit logs from Firestore
 */
export async function fetchAllAdminDataFromFirestore() {
  const users: AdminUserRecord[] = [];
  const preApprovedGmails: string[] = [];
  const logs: AuditLog[] = [];

  if (!checkQuotaStatus()) {
    // 1. Fetch Users
    try {
      const snap = await getDocs(collection(db, "users"));
      snap.forEach((d) => {
        const u = d.data();
        if (u.email) {
          users.push({
            id: u.id || "usr_" + d.id,
            email: u.email,
            username: u.username || u.email.split("@")[0],
            role: u.role || "client",
            status: u.status || "approved",
            createdAt: u.createdAt || new Date().toISOString(),
            lastLogin: u.lastLogin,
          });
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "users");
    }

    // 2. Fetch Preapproved Emails
    if (!checkQuotaStatus()) {
      try {
        const snap = await getDocs(collection(db, "preApprovedEmails"));
        snap.forEach((d) => {
          if (d.data()?.email) {
            preApprovedGmails.push(d.data().email);
          } else {
            preApprovedGmails.push(d.id);
          }
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "preApprovedEmails");
      }
    }

    // 3. Fetch Audit Logs
    if (!checkQuotaStatus()) {
      try {
        const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(50));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          logs.push(d.data() as AuditLog);
        });
      } catch (err) {
        try {
          const snap = await getDocs(collection(db, "logs"));
          snap.forEach((d) => logs.push(d.data() as AuditLog));
        } catch (e) {}
      }
    }
  }

  // Always include master admin email in preapproved list
  if (!preApprovedGmails.includes("sngxworld@gmail.com")) {
    preApprovedGmails.push("sngxworld@gmail.com");
  }

  return { users, preApprovedGmails, logs };
}

/**
 * Grant access to a user in Firestore
 */
export async function grantUserAccessInFirestore(email: string) {
  const cleanEmail = cleanEmailKey(email);
  if (!cleanEmail) return;

  if (!checkQuotaStatus()) {
    try {
      await setDoc(doc(db, "users", cleanEmail), { status: "approved" }, { merge: true });
      await addAuditLogToFirestore(`Access GRANTED for user: ${cleanEmail}`, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${cleanEmail}`);
    }
  }

  // Update local storage
  try {
    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updated = localUsers.map((u) =>
      u.email.toLowerCase() === cleanEmail ? { ...u, status: "approved" as const } : u
    );
    localStorage.setItem("sngx_local_users", JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Revoke access for a user in Firestore
 */
export async function revokeUserAccessInFirestore(email: string) {
  const cleanEmail = cleanEmailKey(email);
  if (!cleanEmail) return;

  if (!checkQuotaStatus()) {
    try {
      await setDoc(doc(db, "users", cleanEmail), { status: "revoked" }, { merge: true });
      await addAuditLogToFirestore(`Access REVOKED for user: ${cleanEmail}`, "warning");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${cleanEmail}`);
    }
  }

  // Update local storage
  try {
    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updated = localUsers.map((u) =>
      u.email.toLowerCase() === cleanEmail ? { ...u, status: "revoked" as const } : u
    );
    localStorage.setItem("sngx_local_users", JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Pre-approve a Gmail address in Firestore
 */
export async function preApproveGmailInFirestore(email: string) {
  const cleanEmail = cleanEmailKey(email);
  if (!cleanEmail) return;

  if (!checkQuotaStatus()) {
    try {
      await setDoc(doc(db, "preApprovedEmails", cleanEmail), {
        email: cleanEmail,
        addedAt: new Date().toISOString(),
      });

      // If user record already exists, update status to approved
      const userDocRef = doc(db, "users", cleanEmail);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        await setDoc(userDocRef, { status: "approved" }, { merge: true });
      }

      await addAuditLogToFirestore(`Gmail pre-approved: ${cleanEmail}`, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `preApprovedEmails/${cleanEmail}`);
    }
  }

  // Local storage backup
  try {
    const list: string[] = JSON.parse(localStorage.getItem("sngx_preapproved_emails") || "[]");
    if (!list.includes(cleanEmail)) {
      list.push(cleanEmail);
      localStorage.setItem("sngx_preapproved_emails", JSON.stringify(list));
    }
  } catch (e) {}
}

/**
 * Remove a pre-approved Gmail from Firestore
 */
export async function removePreApprovedGmailInFirestore(email: string) {
  const cleanEmail = cleanEmailKey(email);
  if (!cleanEmail) return;

  if (!checkQuotaStatus()) {
    try {
      await deleteDoc(doc(db, "preApprovedEmails", cleanEmail));
      await addAuditLogToFirestore(`Pre-approved Gmail removed: ${cleanEmail}`, "warning");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `preApprovedEmails/${cleanEmail}`);
    }
  }

  try {
    const list: string[] = JSON.parse(localStorage.getItem("sngx_preapproved_emails") || "[]");
    const updated = list.filter((e) => e.toLowerCase() !== cleanEmail);
    localStorage.setItem("sngx_preapproved_emails", JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Delete a user from Firestore
 */
export async function deleteUserInFirestore(email: string) {
  const cleanEmail = cleanEmailKey(email);
  if (!cleanEmail) return;

  if (!checkQuotaStatus()) {
    try {
      await deleteDoc(doc(db, "users", cleanEmail));
      await addAuditLogToFirestore(`User account deleted: ${cleanEmail}`, "warning");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${cleanEmail}`);
    }
  }

  try {
    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updated = localUsers.filter((u) => u.email.toLowerCase() !== cleanEmail);
    localStorage.setItem("sngx_local_users", JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Update Platform Role in Server and Firestore
 */
export async function updatePlatformRoleInStore(params: {
  userId?: string;
  email: string;
  platformRole:
    | "owner"
    | "sub_owner"
    | "verified_signal_provider"
    | "moderator"
    | "signal_provider"
    | "member"
    | "pending_user";
  subOwnerDurationDays?: number;
  subOwnerExpiresAt?: string;
  subOwnerNote?: string;
}) {
  const cleanEmail = cleanEmailKey(params.email);
  if (!cleanEmail) throw new Error("Email is required");

  // Call Server API
  try {
    const res = await fetch("/api/admin/update-platform-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: params.userId,
        email: cleanEmail,
        platformRole: params.platformRole,
        subOwnerDurationDays: params.subOwnerDurationDays,
        subOwnerExpiresAt: params.subOwnerExpiresAt,
        subOwnerNote: params.subOwnerNote,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update role on server");
    }
  } catch (err: any) {
    console.warn("Server update-platform-role error:", err.message);
  }

  // Update Firestore
  if (!checkQuotaStatus()) {
    try {
      const updateData: any = {
        platformRole: params.platformRole,
        status: params.platformRole === "pending_user" ? "pending" : "approved",
      };
      if (params.platformRole === "sub_owner") {
        updateData.subOwnerAssignedAt = new Date().toISOString();
        updateData.subOwnerDurationDays = params.subOwnerDurationDays || 7;
        updateData.subOwnerExpiresAt =
          params.subOwnerExpiresAt ||
          new Date(Date.now() + (params.subOwnerDurationDays || 7) * 24 * 60 * 60 * 1000).toISOString();
        updateData.subOwnerNote = params.subOwnerNote || "Sub-Owner";
      }

      await setDoc(doc(db, "users", cleanEmail), updateData, { merge: true });
      await addAuditLogToFirestore(`Platform role updated for ${cleanEmail}: ${params.platformRole.toUpperCase()}`, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${cleanEmail}`);
    }
  }
}

/**
 * Create a Sub-Owner Request for the Owner
 */
export async function createSubOwnerRequestInStore(params: {
  subOwnerEmail: string;
  subOwnerUsername: string;
  subOwnerDisplayName?: string;
  actionType:
    | "approve_user"
    | "reject_user"
    | "change_role"
    | "delete_user"
    | "add_gmail"
    | "delete_group"
    | "delete_message"
    | "reset_password"
    | "custom_action";
  targetEmail?: string;
  targetUsername?: string;
  targetId?: string;
  title: string;
  description: string;
  payload?: any;
  subOwnerNote?: string;
}) {
  const res = await fetch("/api/admin/subowner-requests/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to create approval request");
  }
  return data;
}

/**
 * Approve a Sub-Owner Request (Owner Only)
 */
export async function approveSubOwnerRequestInStore(requestId: string, ownerResponseNote?: string) {
  const res = await fetch("/api/admin/subowner-requests/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, ownerResponseNote }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to approve request");
  }
  return data;
}

/**
 * Reject a Sub-Owner Request (Owner Only)
 */
export async function rejectSubOwnerRequestInStore(requestId: string, ownerResponseNote?: string) {
  const res = await fetch("/api/admin/subowner-requests/reject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, ownerResponseNote }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to reject request");
  }
  return data;
}

/**
 * Fetch Sub-Owner Requests
 */
export async function fetchSubOwnerRequestsFromStore() {
  try {
    const res = await fetch("/api/admin/subowner-requests");
    if (res.ok) {
      const data = await res.json();
      return data.requests || [];
    }
  } catch (e) {
    console.warn("Could not fetch sub-owner requests:", e);
  }
  return [];
}

/**
 * Create Moderator or Bug Report
 */
export async function createModeratorReportInStore(params: {
  reportedByEmail: string;
  reportedByUsername: string;
  reportedByDisplayName?: string;
  category?: "bug" | "user_feedback" | "harassment" | "signal_inquiry" | "urgent_issue";
  subject: string;
  message: string;
}) {
  const res = await fetch("/api/admin/moderator-reports/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to submit report");
  }
  return data;
}

/**
 * Fetch Moderator Reports
 */
export async function fetchModeratorReportsFromStore() {
  try {
    const res = await fetch("/api/admin/moderator-reports");
    if (res.ok) {
      const data = await res.json();
      return data.reports || [];
    }
  } catch (e) {
    console.warn("Could not fetch moderator reports:", e);
  }
  return [];
}

/**
 * Resolve Moderator Report
 */
export async function resolveModeratorReportInStore(reportId: string, status: string, handledBy?: string, adminNotes?: string) {
  const res = await fetch("/api/admin/moderator-reports/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportId, status, handledBy, adminNotes }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to resolve report");
  }
  return data;
}

/**
 * Approve all pending users in Firestore
 */
export async function approveAllPendingInFirestore() {
  if (!checkQuotaStatus()) {
    try {
      const snap = await getDocs(collection(db, "users"));
      snap.forEach(async (d) => {
        const u = d.data();
        if (u.status === "pending") {
          await setDoc(doc(db, "users", d.id), { status: "approved" }, { merge: true });
        }
      });
      await addAuditLogToFirestore("Approved all pending accounts", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "users");
    }
  }
}
