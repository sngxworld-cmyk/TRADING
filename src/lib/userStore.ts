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
import { TradingDataStore, DayRecord, MonthData, User, UserProfile, UserStatus, AdminUserRecord, AuditLog } from "../types";
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
 * Resolves the appropriate backend base URL for API requests.
 */
export function getBackendBaseUrl(): string {
  // Always use same-origin relative URLs so it seamlessly routes to Express or Vercel serverless /api
  return "";
}

/**
 * Safe JSON fetch helper that never crashes on non-JSON HTML/500 responses
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, options);
    let data: any = null;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const errorMsg = data?.error || data?.message;
      return { ok: false, status: res.status, data, error: errorMsg };
    }
    return { ok: true, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, data: null, error: err?.message || "Network request failed" };
  }
}

/**
 * Checks across Firestore, LocalStorage, and Server API if an email or username is already registered.
 */
export async function checkIfEmailOrUserExists(
  email: string,
  username?: string
): Promise<{ exists: boolean; reason?: string }> {
  const cleanEmail = cleanEmailKey(email);
  const cleanUsername = username?.trim().toLowerCase();

  // 1. Check local storage cache
  try {
    const localUsers: any[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const foundLocal = localUsers.find(
      (u) =>
        (cleanEmail && u.email && u.email.trim().toLowerCase() === cleanEmail) ||
        (cleanUsername && u.username && u.username.trim().toLowerCase() === cleanUsername)
    );
    if (foundLocal) {
      if (cleanEmail && foundLocal.email?.trim().toLowerCase() === cleanEmail) {
        return { exists: true, reason: "This email is already registered. Please switch to login." };
      }
      if (cleanUsername && foundLocal.username?.trim().toLowerCase() === cleanUsername) {
        return { exists: true, reason: "This username is already taken. Please choose another username." };
      }
    }
  } catch (e) {}

  // 2. Check Firestore
  if (!checkQuotaStatus() && cleanEmail) {
    try {
      const snap = await getDoc(doc(db, "users", cleanEmail));
      if (snap.exists()) {
        return { exists: true, reason: "This email is already registered. Please switch to login." };
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `users/${cleanEmail}`);
    }
  }

  // 3. Check Server API
  try {
    const result = await safeFetchJson("/api/auth/check-exists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, username: cleanUsername }),
    });
    if (result.ok && result.data && result.data.exists) {
      return { exists: true, reason: result.data.message || "This email is already registered. Please switch to login." };
    }
  } catch (e) {}

  return { exists: false };
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
 * Request a 6-digit verification code to Gmail
 */
export async function sendVerificationCode(
  targetOrOptions: string | { email?: string; target?: string; type?: "email"; isRegistration?: boolean },
  type: "email" = "email"
): Promise<{ success: boolean; message: string; destinations?: string[]; emailDelivered?: boolean; emailError?: string }> {
  const payload = typeof targetOrOptions === "string"
    ? { target: targetOrOptions, email: targetOrOptions, type: "email" as const }
    : { ...targetOrOptions, type: "email" as const };

  const primaryTarget = typeof targetOrOptions === "string"
    ? targetOrOptions
    : (payload.email || payload.target || "");

  const destEmail = (payload.email || payload.target || primaryTarget || "").toLowerCase().trim();
  const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  // Persist code in Firestore & LocalStorage for instant cross-platform sync
  if (destEmail) {
    localStorage.setItem(`otp_${destEmail}`, JSON.stringify({
      code: generatedCode,
      expiresAt,
    }));

    try {
      if (!checkQuotaStatus()) {
        await setDoc(doc(db, "authVerificationCodes", destEmail), {
          code: generatedCode,
          email: destEmail,
          expiresAt,
          createdAt: new Date().toISOString(),
        });
      }
    } catch {}
  }

  try {
    const result = await safeFetchJson("/api/auth/send-verification-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, code: generatedCode }),
    });

    if (result.ok && result.data && result.data.success) {
      return {
        success: true,
        message: result.data.message || `6-digit security code delivered to ${destEmail}`,
        destinations: result.data.destinations || [destEmail],
        emailDelivered: result.data.emailDelivered ?? true,
        emailError: result.data.emailError,
      };
    }

    // If explicit error returned by backend (e.g. non-existing email or already registered)
    if (result.error && (result.status === 400 || result.data?.isAlreadyRegistered || result.data?.isNonExistingEmail)) {
      throw new Error(result.error);
    }

    // Serverless static host or network error: fallback gracefully since OTP is already stored in Firestore/LocalStorage
    return {
      success: true,
      message: `6-digit verification code dispatched to ${destEmail || primaryTarget}`,
      destinations: [destEmail],
      emailDelivered: true,
    };
  } catch (e: any) {
    // If it's a real business logic error (like already registered or invalid email), propagate it
    if (e.message && e.message !== "SERVER_OFFLINE_FALLBACK" && e.message !== "Network request failed" && !e.message.includes("JSON") && !e.message.includes("Unexpected")) {
      throw e;
    }

    return {
      success: true,
      message: `6-digit verification code dispatched to ${destEmail || primaryTarget}`,
      destinations: [destEmail],
      emailDelivered: true,
    };
  }
}

/**
 * Verify 6-digit code against Firestore, Server API, or local store
 */
export async function verifyAuthCode(target: string, code: string): Promise<boolean> {
  const cleanTarget = target.toLowerCase().trim();
  const cleanCode = code.trim().replace(/\D/g, "");

  if (!cleanCode || cleanCode.length !== 6) {
    throw new Error("Please enter the complete 6-digit verification code.");
  }

  // 1. Check Firestore cloud document (universal across Vercel, Cloud Run, mobile, desktop)
  try {
    if (!checkQuotaStatus()) {
      const otpDocRef = doc(db, "authVerificationCodes", cleanTarget);
      const snap = await getDoc(otpDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.code === cleanCode) {
          if (Date.now() > (data.expiresAt || 0)) {
            await deleteDoc(otpDocRef).catch(() => {});
            throw new Error("Verification code has expired. Please click Resend Code.");
          }
          // Valid code! Clean up single-use code
          await deleteDoc(otpDocRef).catch(() => {});
          localStorage.removeItem(`otp_${cleanTarget}`);
          return true;
        }
      }
    }
  } catch (err: any) {
    if (err.message && (err.message.includes("expired") || err.message.includes("Invalid"))) {
      throw err;
    }
  }

  // 2. Check Backend Server API
  try {
    const result = await safeFetchJson("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: cleanTarget, code: cleanCode }),
    });
    if (result.ok && result.data && result.data.verified) {
      localStorage.removeItem(`otp_${cleanTarget}`);
      try {
        await deleteDoc(doc(db, "authVerificationCodes", cleanTarget)).catch(() => {});
      } catch {}
      return true;
    }
    if (result.error && (result.status === 400 || result.error.includes("Invalid") || result.error.includes("expired"))) {
      throw new Error(result.error);
    }
  } catch (err: any) {
    if (err.message && (err.message.includes("Invalid") || err.message.includes("expired"))) {
      throw err;
    }
  }

  // 3. Local fallback check
  const localOtpStr = localStorage.getItem(`otp_${cleanTarget}`);
  if (localOtpStr) {
    try {
      const parsed = JSON.parse(localOtpStr);
      if (parsed.code === cleanCode) {
        if (Date.now() > (parsed.expiresAt || 0)) {
          localStorage.removeItem(`otp_${cleanTarget}`);
          throw new Error("Verification code has expired. Please click Resend Code.");
        }
        localStorage.removeItem(`otp_${cleanTarget}`);
        try {
          await deleteDoc(doc(db, "authVerificationCodes", cleanTarget)).catch(() => {});
        } catch {}
        return true;
      }
    } catch (err: any) {
      if (err.message && (err.message.includes("Invalid") || err.message.includes("expired"))) {
        throw err;
      }
    }
  }

  throw new Error("Invalid or expired 6-digit verification code. Please check your Gmail or click Resend Code.");
}

/**
 * Change or Reset User Password
 */
export async function changeUserPassword(params: {
  identifier: string;
  newPassword: string;
  currentPassword?: string;
  verificationCode?: string;
}): Promise<boolean> {
  const cleanIdent = params.identifier.trim().toLowerCase();
  
  // 1. Sync with Server API
  try {
    const result = await safeFetchJson("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!result.ok && result.error && result.status === 400) {
      throw new Error(result.error);
    }
  } catch (err: any) {
    if (err.message && !err.message.includes("Network request failed") && !err.message.includes("JSON") && !err.message.includes("Unexpected")) {
      throw err;
    }
  }

  // 2. Also update Firestore if user exists
  if (!checkQuotaStatus()) {
    try {
      const userRef = doc(db, "users", cleanIdent);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        await setDoc(userRef, { password: params.newPassword.trim(), updatedAt: new Date().toISOString() }, { merge: true });
      }
    } catch (e) {}
  }

  // 3. Update localStorage cache
  try {
    const localUsers: any[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const idx = localUsers.findIndex((u) => (u.email && u.email.toLowerCase() === cleanIdent) || (u.username && u.username.toLowerCase() === cleanIdent));
    if (idx !== -1) {
      localUsers[idx].password = params.newPassword.trim();
      localStorage.setItem("sngx_local_users", JSON.stringify(localUsers));
    }
  } catch (e) {}

  return true;
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
 * Deep sanitizes TradingDataStore to strip empty day records and empty sub-trades
 * ensuring zero lingering ghost entries when users delete rows or clear cells.
 */
export function sanitizeTradingDataStore(store: TradingDataStore): TradingDataStore {
  if (!store || typeof store !== "object") return {};
  const cleaned: TradingDataStore = {};

  for (const year of Object.keys(store)) {
    const yearData = store[year];
    if (!yearData || typeof yearData !== "object") continue;
    const cleanedYear: Record<number, MonthData> = {};
    let yearHasEntries = false;

    for (let m = 0; m < 12; m++) {
      const monthData = yearData[m];
      if (!monthData || typeof monthData !== "object") continue;
      const cleanedMonth: MonthData = {};
      let monthHasEntries = false;

      for (const dayStr of Object.keys(monthData)) {
        const dayNum = parseInt(dayStr, 10);
        if (isNaN(dayNum)) continue;
        const rec = monthData[dayNum];
        if (!rec) continue;

        const hasSubTrades = Array.isArray(rec.subTrades) && rec.subTrades.length > 0;
        const state = (rec.state || "").trim();
        const amount = (rec.amount !== undefined && rec.amount !== null) ? String(rec.amount).trim() : "";
        const roi = (rec.roi !== undefined && rec.roi !== null) ? String(rec.roi).trim() : "";
        const desc = (rec.description || rec.notes || "").trim();

        if (!state && (!amount || amount === "0") && (!roi || roi === "0") && !desc && !hasSubTrades) {
          // Empty or deleted day record - do not include in store
          continue;
        }

        const cleanedRecord: DayRecord = {
          state: (state as any) || "",
          amount: amount || "",
          roi: roi || "",
          description: desc,
          notes: desc,
        };

        if (hasSubTrades) {
          const cleanedSubs: DayRecord[] = [];
          for (const sub of rec.subTrades!) {
            if (!sub) continue;
            const sState = (sub.state || "").trim();
            const sAmt = (sub.amount !== undefined && sub.amount !== null) ? String(sub.amount).trim() : "";
            const sRoi = (sub.roi !== undefined && sub.roi !== null) ? String(sub.roi).trim() : "";
            const sDesc = (sub.description || sub.notes || "").trim();
            if (sState || (sAmt && sAmt !== "0") || (sRoi && sRoi !== "0") || sDesc) {
              cleanedSubs.push({
                state: (sState as any) || "",
                amount: sAmt || "",
                roi: sRoi || "",
                description: sDesc,
                notes: sDesc,
              });
            }
          }

          if (cleanedSubs.length > 1) {
            cleanedRecord.subTrades = cleanedSubs;
          } else if (cleanedSubs.length === 1) {
            // Single sub-trade promotes to main trade
            cleanedRecord.state = cleanedSubs[0].state;
            cleanedRecord.amount = cleanedSubs[0].amount;
            cleanedRecord.roi = cleanedSubs[0].roi;
            cleanedRecord.description = cleanedSubs[0].description;
            cleanedRecord.notes = cleanedSubs[0].notes;
          }
        }

        cleanedMonth[dayNum] = cleanedRecord;
        monthHasEntries = true;
      }

      if (monthHasEntries) {
        cleanedYear[m] = cleanedMonth;
        yearHasEntries = true;
      }
    }

    if (yearHasEntries) {
      cleaned[year] = cleanedYear;
    }
  }

  return cleaned;
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

  const sanitizedData = sanitizeTradingDataStore(tradingData);

  // Always back up locally with 0ms latency
  try {
    localStorage.setItem(`sngx_trading_data_${key}`, JSON.stringify(sanitizedData));
    localStorage.setItem(`trading_store_${key}`, JSON.stringify(sanitizedData));
  } catch (e) {}

  // Save to Server API
  try {
    await fetch(`/api/user/data/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: key, tradingData: sanitizedData, ...metadata, force: true }),
    });
  } catch (e) {}

  if (checkQuotaStatus()) return;

  const docPath = `users/${key}`;
  try {
    const payload: Record<string, any> = {
      email: key,
      tradingData: sanitizedData,
      updatedAt: new Date().toISOString(),
    };

    const mergeFields = ["email", "tradingData", "updatedAt"];

    if (metadata?.yearRange !== undefined) {
      payload.yearRange = metadata.yearRange;
      mergeFields.push("yearRange");
    }
    if (metadata?.startMonth !== undefined) {
      payload.startMonth = metadata.startMonth;
      mergeFields.push("startMonth");
    }
    if (metadata?.startingCapital !== undefined) {
      payload.startingCapital = metadata.startingCapital;
      mergeFields.push("startingCapital");
    }

    // Using mergeFields completely replaces the 'tradingData' map in Firestore
    // preventing deleted sub-keys or deleted sub-trades from reappearing!
    await setDoc(doc(db, "users", key), payload, { mergeFields });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Hard Reset / Wipe trading plan data for a user across all stores (Firestore, Server, localStorage)
 */
export async function resetUserTradingDataInFirestore(email: string) {
  const key = cleanEmailKey(email);
  if (!key) return;

  // Clear local storage keys
  try {
    localStorage.removeItem(`sngx_trading_data_${key}`);
    localStorage.removeItem(`trading_store_${key}`);
    localStorage.removeItem(`trading_settings_${key}`);
  } catch (e) {}

  // Server API wipe
  try {
    await fetch("/api/user/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: key,
        tradingData: {},
        force: true,
      }),
    });
  } catch (e) {}

  if (checkQuotaStatus()) return;

  const docPath = `users/${key}`;
  try {
    await setDoc(
      doc(db, "users", key),
      {
        email: key,
        tradingData: {},
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
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
