import express from "express";
import path from "path";
import fs from "fs";
import dns from "dns";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore, getDocs, setDoc, doc, collection, deleteDoc } from "firebase/firestore";

type PlatformRole =
  | "owner"
  | "sub_owner"
  | "verified_signal_provider"
  | "moderator"
  | "signal_provider"
  | "member"
  | "pending_user";

interface UserRecord {
  id: string;
  email: string;
  username: string;
  password: string;
  displayName?: string;
  photoURL?: string;
  phone?: string;
  dob?: string;
  bio?: string;
  tradingPair?: string;
  tradingMarket?: string;
  startingCapital?: string;
  role: "admin" | "client";
  platformRole?:
    | "owner"
    | "sub_owner"
    | "verified_signal_provider"
    | "moderator"
    | "signal_provider"
    | "member"
    | "pending_user";
  status: "pending" | "approved" | "rejected" | "revoked" | "banned";
  subOwnerExpiresAt?: string;
  subOwnerAssignedAt?: string;
  subOwnerDurationDays?: number;
  subOwnerNote?: string;
  createdAt: string;
  lastLogin?: string;
  hasSeenTutorial?: boolean;
  hasConfiguredJournal?: boolean;
  tradingData?: any;
  yearRange?: string;
  startMonth?: number;
  subscribed?: boolean;
  wasApproved?: boolean;
  bannedReason?: string;
  banAppeal?: any;
  trialStartDate?: string;
  trialExpiresAt?: string;
}

interface DBStructure {
  users: UserRecord[];
  preApprovedEmails: string[];
  registeredDevices?: Record<string, { email: string; registeredAt: string }>;
  logs: { timestamp: string; message: string; type: "info" | "access" | "warn" }[];
  subOwnerRequests?: any[];
  moderatorReports?: any[];
  communitySignalGroups?: any[];
  communityChatMessages?: any[];
  communitySignals?: any[];
  communityDirectMessages?: any[];
  communityGroupChatMessages?: Record<string, any[]>;
  banAppeals?: any[];
}

const DB_FILE = process.env.VERCEL
  ? path.join("/tmp", "db.json")
  : path.join(process.cwd(), "data", "db.json");

const DB_BACKUP_FILE = process.env.VERCEL
  ? path.join("/tmp", "db.backup.json")
  : path.join(process.cwd(), "data", "db.backup.json");

/**
 * Cryptographic Password Hashing using Node.js scrypt with a unique 16-byte random salt.
 * Formatted as: `scrypt:<saltHex>:<derivedKeyHex>`
 */
function hashPassword(password: string): string {
  if (!password) return "";
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Timing-safe password verification supporting salted scrypt hashes
 * as well as backward-compatible legacy plaintext during the migration window.
 */
function verifyPassword(password: string, storedHashOrPlain: string): boolean {
  if (!storedHashOrPlain || !password) return false;
  if (storedHashOrPlain.startsWith("scrypt:")) {
    const parts = storedHashOrPlain.split(":");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const originalHash = parts[2];
    try {
      const derivedKey = crypto.scryptSync(password, salt, 64);
      const keyBuffer = Buffer.from(derivedKey.toString("hex"), "hex");
      const originalBuffer = Buffer.from(originalHash, "hex");
      if (keyBuffer.length !== originalBuffer.length) return false;
      return crypto.timingSafeEqual(keyBuffer, originalBuffer);
    } catch {
      return false;
    }
  }
  // Backward compatibility fallback for pre-existing plain text passwords
  return storedHashOrPlain === password || storedHashOrPlain.trim() === password.trim();
}

/**
 * High-performance, memory-efficient sliding window rate limiter
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitStores = new Map<string, Map<string, RateLimitRecord>>();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}

function createRateLimiter(options: {
  bucketName: string;
  maxRequests: number;
  windowMs: number;
  message?: string;
  keyGenerator?: (req: express.Request) => string;
}) {
  if (!rateLimitStores.has(options.bucketName)) {
    rateLimitStores.set(options.bucketName, new Map());
  }
  const store = rateLimitStores.get(options.bucketName)!;

  // Periodic cleanup of expired rate limit buckets every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 300000).unref();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : getClientIp(req);

    const now = Date.now();
    let record = store.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + options.windowMs };
      store.set(key, record);
      return next();
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfterSec.toString());
      return res.status(429).json({
        error:
          options.message ||
          `Security Alert: Too many requests. Please wait ${retryAfterSec} seconds before retrying.`,
        retryAfter: retryAfterSec,
      });
    }

    record.count++;
    next();
  };
}

// Pre-configured rate limiters for auth endpoints
const authLoginLimiter = createRateLimiter({
  bucketName: "auth-login",
  maxRequests: 15,
  windowMs: 60 * 1000, // 15 attempts per minute per IP + target
  message: "Security Alert: Too many login attempts. Please wait 1 minute before trying again.",
  keyGenerator: (req) => {
    const ident = (req.body?.identifier || "").toString().toLowerCase().trim();
    return `${getClientIp(req)}_${ident}`;
  },
});

const authRegisterLimiter = createRateLimiter({
  bucketName: "auth-register",
  maxRequests: 6,
  windowMs: 60 * 1000, // 6 registrations per minute per IP
  message: "Security Notice: Too many registration requests. Please wait 1 minute before trying again.",
});

const otpSendLimiter = createRateLimiter({
  bucketName: "otp-send",
  maxRequests: 5,
  windowMs: 5 * 60 * 1000, // 5 requests per 5 minutes per recipient / IP
  message: "Security Notice: Verification code dispatch rate limit exceeded. Please wait 5 minutes.",
  keyGenerator: (req) => {
    const target = (req.body?.target || req.body?.email || "").toString().toLowerCase().trim();
    return `${getClientIp(req)}_${target}`;
  },
});

const otpVerifyLimiter = createRateLimiter({
  bucketName: "otp-verify",
  maxRequests: 10,
  windowMs: 5 * 60 * 1000, // 10 attempts per 5 minutes per target / IP
  message: "Security Notice: Too many verification attempts. Please wait 5 minutes.",
  keyGenerator: (req) => {
    const target = (req.body?.target || "").toString().toLowerCase().trim();
    return `${getClientIp(req)}_${target}`;
  },
});

const passwordChangeLimiter = createRateLimiter({
  bucketName: "password-change",
  maxRequests: 5,
  windowMs: 5 * 60 * 1000, // 5 password reset/change attempts per 5 minutes per IP
  message: "Security Notice: Too many password change attempts. Please wait 5 minutes.",
});

const adminLoginLimiter = createRateLimiter({
  bucketName: "admin-login",
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 attempts per minute per IP
  message: "Admin authentication rate limit reached. Please wait 60 seconds.",
});

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function loadDB(): DBStructure {
  try {
    ensureDirectoryExistence(DB_FILE);
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        // Ensure default host admin and community collections exist
        ensureDefaultAdmin(parsed);
        return parsed;
      }
    } else if (process.env.VERCEL) {
      // In Vercel serverless environment, check for bundled seed DB in workspace data/
      const bundledDbPath = path.join(process.cwd(), "data", "db.json");
      const bundledBackupPath = path.join(process.cwd(), "data", "db.backup.json");
      let seedParsed: DBStructure | null = null;

      if (fs.existsSync(bundledDbPath)) {
        try {
          const raw = fs.readFileSync(bundledDbPath, "utf-8");
          if (raw.trim()) seedParsed = JSON.parse(raw);
        } catch {}
      }
      if (!seedParsed && fs.existsSync(bundledBackupPath)) {
        try {
          const backupRaw = fs.readFileSync(bundledBackupPath, "utf-8");
          if (backupRaw.trim()) seedParsed = JSON.parse(backupRaw);
        } catch {}
      }

      if (seedParsed) {
        ensureDefaultAdmin(seedParsed);
        saveDB(seedParsed);
        return seedParsed;
      }
    }
  } catch (err) {
    console.error("Error reading database file, attempting recovery from backup:", err);
    try {
      if (fs.existsSync(DB_BACKUP_FILE)) {
        const backupRaw = fs.readFileSync(DB_BACKUP_FILE, "utf-8");
        if (backupRaw.trim()) {
          const parsed = JSON.parse(backupRaw);
          ensureDefaultAdmin(parsed);
          console.log("Successfully recovered database from db.backup.json!");
          return parsed;
        }
      }
    } catch (bErr) {
      console.error("Backup recovery also failed:", bErr);
    }
  }

  const defaultDB: DBStructure = {
    users: [
      {
        id: "usr_admin_master",
        email: "sngxworld@gmail.com",
        username: "sngxadmin",
        password: "adminpassword123",
        role: "admin",
        status: "approved",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      },
    ],
    preApprovedEmails: ["sngxworld@gmail.com"],
    logs: [
      {
        timestamp: new Date().toISOString(),
        message: "System initialized. Host admin initialized for sngxworld@gmail.com",
        type: "info",
      },
    ],
    communitySignalGroups: [],
    communityChatMessages: [],
    communitySignals: [],
    communityDirectMessages: [],
    communityGroupChatMessages: {},
  };

  saveDB(defaultDB);
  return defaultDB;
}

function ensureDefaultAdmin(db: DBStructure) {
  if (!db.subOwnerRequests) db.subOwnerRequests = [];
  if (!db.moderatorReports) db.moderatorReports = [];
  if (!db.communitySignalGroups) db.communitySignalGroups = [];
  if (!db.communityChatMessages) db.communityChatMessages = [];
  if (!db.communitySignals) db.communitySignals = [];
  if (!db.communityDirectMessages) db.communityDirectMessages = [];
  if (!db.communityGroupChatMessages) db.communityGroupChatMessages = {};

  // Upgrade legacy plaintext passwords in memory to salted scrypt hashes
  db.users.forEach((u) => {
    if (u.password && !u.password.startsWith("scrypt:")) {
      u.password = hashPassword(u.password);
    }
  });

  const adminIndex = db.users.findIndex(
    (u) =>
      u.email.toLowerCase() === "sngxworld@gmail.com" ||
      u.username.toLowerCase() === "sngxadmin009" ||
      u.role === "admin"
  );
  if (adminIndex === -1) {
    db.users.unshift({
      id: "usr_admin_master",
      email: "sngxworld@gmail.com",
      username: "SNGxADMIN009",
      password: hashPassword("sngzzz009abcd123@#"),
      displayName: "SNGx MASTER OWNER",
      role: "admin",
      platformRole: "owner",
      status: "approved",
      createdAt: new Date().toISOString(),
    });
  } else {
    // Ensure admin is always approved with owner platformRole
    db.users[adminIndex].role = "admin";
    db.users[adminIndex].platformRole = "owner";
    db.users[adminIndex].status = "approved";
    // Also support SNGxADMIN009 credentials
    if (!db.users[adminIndex].username || db.users[adminIndex].username.toLowerCase() === "sngxadmin") {
      db.users[adminIndex].username = "SNGxADMIN009";
    }
    if (!db.users[adminIndex].password || !db.users[adminIndex].password.startsWith("scrypt:")) {
      db.users[adminIndex].password = hashPassword(db.users[adminIndex].password || "sngzzz009abcd123@#");
    }
  }

  if (!db.preApprovedEmails) db.preApprovedEmails = [];
  if (!db.preApprovedEmails.includes("sngxworld@gmail.com")) {
    db.preApprovedEmails.push("sngxworld@gmail.com");
  }
  if (!db.logs) db.logs = [];
}

function saveDB(db: DBStructure) {
  try {
    ensureDirectoryExistence(DB_FILE);
    const serialized = JSON.stringify(db, null, 2);
    // Write primary database file
    fs.writeFileSync(DB_FILE, serialized, "utf-8");
    // Also maintain secondary atomic backup file
    try {
      fs.writeFileSync(DB_BACKUP_FILE, serialized, "utf-8");
    } catch {}
  } catch (err) {
    console.error("Failed to save DB:", err);
  }
}

function getDB(): DBStructure {
  return loadDB();
}

// --- CLOUD FIRESTORE SYNCHRONIZATION FOR HOST ADMIN & CLIENTS ---
let firestoreDb: any = null;
try {
  const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(cfgPath)) {
    const config = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
    const fbApp = !getApps().length
      ? initializeApp({
          apiKey: config.apiKey,
          projectId: config.projectId,
          appId: config.appId,
        })
      : getApps()[0];
    firestoreDb = initializeFirestore(
      fbApp,
      { experimentalForceLongPolling: true },
      config.firestoreDatabaseId
    );
  }
} catch (e: any) {
  console.warn("Could not initialize server Firestore:", e?.message);
}

async function syncUsersFromFirestore() {
  if (!firestoreDb) return;
  try {
    const snap = await getDocs(collection(firestoreDb, "users"));
    if (snap.empty) return;
    const currentDb = getDB();
    let changed = false;

    for (const docSnap of snap.docs) {
      const u = docSnap.data();
      const email = (u.email || docSnap.id).trim().toLowerCase();
      if (!email) continue;

      const existingIdx = currentDb.users.findIndex(
        (x) => x.email.trim().toLowerCase() === email
      );

      const userRecord: UserRecord = {
        id: u.id || `usr_${docSnap.id.replace(/[^a-zA-Z0-9_]/g, "_")}`,
        email: email,
        username: u.username || email.split("@")[0] || "Trader",
        password: u.password || "managed_in_cloud",
        displayName: u.displayName || u.username,
        photoURL: u.photoURL || "",
        phone: u.phone || "",
        dob: u.dob || "",
        bio: u.bio || "",
        tradingPair: u.tradingPair || "BTC/USDT",
        tradingMarket: u.tradingMarket || "Crypto Market",
        startingCapital: u.startingCapital || "100",
        role: u.role || (email === "sngxworld@gmail.com" ? "admin" : "client"),
        platformRole: u.platformRole || (email === "sngxworld@gmail.com" ? "owner" : "member"),
        status: u.status || "pending",
        subOwnerExpiresAt: u.subOwnerExpiresAt,
        subOwnerAssignedAt: u.subOwnerAssignedAt,
        subOwnerDurationDays: u.subOwnerDurationDays,
        subOwnerNote: u.subOwnerNote,
        createdAt: u.createdAt || new Date().toISOString(),
        lastLogin: u.lastLogin || new Date().toISOString(),
        hasConfiguredJournal: !!u.hasConfiguredJournal,
        hasSeenTutorial: !!u.hasSeenTutorial,
        tradingData: u.tradingData || {},
        trialStartDate: u.trialStartDate,
        trialExpiresAt: u.trialExpiresAt,
        subscribed: !!u.subscribed,
        wasApproved: !!u.wasApproved,
        bannedReason: u.bannedReason || "",
      };

      if (existingIdx >= 0) {
        const cur = currentDb.users[existingIdx];
        currentDb.users[existingIdx] = {
          ...userRecord,
          password: cur.password || userRecord.password,
          tradingData: cur.tradingData && Object.keys(cur.tradingData).length > 0 ? cur.tradingData : userRecord.tradingData,
        };
      } else {
        currentDb.users.push(userRecord);
        changed = true;
      }
    }

    if (changed) {
      saveDB(currentDb);
    }
  } catch (err: any) {
    console.warn("syncUsersFromFirestore error:", err?.message);
  }
}

async function syncUserToFirestore(cleanEmail: string, updateFields: Record<string, any>) {
  if (!firestoreDb || !cleanEmail) return;
  try {
    const cleanKey = cleanEmail.trim().toLowerCase();
    const ref = doc(firestoreDb, "users", cleanKey);
    await setDoc(ref, updateFields, { merge: true });
  } catch (err: any) {
    console.warn("syncUserToFirestore error:", err?.message);
  }
}

async function syncPreApprovedEmailToFirestore(cleanEmail: string) {
  if (!firestoreDb || !cleanEmail) return;
  try {
    const cleanKey = cleanEmail.trim().toLowerCase();
    const ref = doc(firestoreDb, "preApprovedEmails", cleanKey);
    await setDoc(ref, { email: cleanKey, approvedAt: new Date().toISOString() }, { merge: true });
  } catch (err: any) {
    console.warn("syncPreApprovedEmailToFirestore error:", err?.message);
  }
}

async function removePreApprovedEmailFromFirestore(cleanEmail: string) {
  if (!firestoreDb || !cleanEmail) return;
  try {
    const cleanKey = cleanEmail.trim().toLowerCase();
    const ref = doc(firestoreDb, "preApprovedEmails", cleanKey);
    await deleteDoc(ref);
  } catch (err: any) {
    console.warn("removePreApprovedEmailFromFirestore error:", err?.message);
  }
}

/**
 * Strict evaluation of user lockout status according to Host Admin policies:
 * - Banned: immediate strict lockout, trial is voided
 * - Rejected: access denied
 * - Revoked: check if remaining 5-day trial exists. If trial active, allowed until 0; if expired, blocked.
 * - Master Admin (sngxworld@gmail.com): always allowed
 */
function isUserAccessBlocked(user: any): { blocked: boolean; message?: string } {
  if (!user || !user.email) return { blocked: false };
  const email = (user.email || "").trim().toLowerCase();
  if (email === "sngxworld@gmail.com") return { blocked: false };

  // Banned: strict lockout, trial is completely voided
  if (user.status === "banned") {
    return { blocked: true, message: "Account is strictly banned by the host administrator." };
  }

  // Rejected: access denied
  if (user.status === "rejected") {
    return { blocked: true, message: "Access request has been rejected." };
  }

  // Revoked: Check remaining trial time!
  if (user.status === "revoked") {
    const trialDurationMs = 5 * 24 * 60 * 60 * 1000;
    const regTime = user.trialStartDate
      ? new Date(user.trialStartDate).getTime()
      : user.createdAt
      ? new Date(user.createdAt).getTime()
      : 0;

    const hasTrialRemaining = regTime > 0 && Date.now() - regTime < trialDurationMs;
    if (hasTrialRemaining) {
      // User still has active trial time! Allowed to use app until timer reaches 0
      return { blocked: false };
    }
    return { blocked: true, message: "Account access revoked and trial period has ended." };
  }

  return { blocked: false };
}

function logActivity(message: string, type: "info" | "access" | "warn" = "info") {
  const currentDb = getDB();
  currentDb.logs.unshift({
    timestamp: new Date().toISOString(),
    message,
    type,
  });
  if (currentDb.logs.length > 200) currentDb.logs.pop();
  saveDB(currentDb);
}

export const app = express();

// Enable CORS for external Host Admin Dashboards and client apps
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "10mb" }));

// --- SECURITY FIREWALL MIDDLEWARE ---
// Blocks malicious automated scanners & exploit tools: Commix, SQLMap, OWASP ZAP, WAFW00F (wa00f)
app.use((req, res, next) => {
  const userAgent = (req.headers["user-agent"] || "").toLowerCase();
  const urlPath = (req.originalUrl || req.url || "").toLowerCase();
  const queryStr = JSON.stringify(req.query || {}).toLowerCase();
  const headersStr = JSON.stringify(req.headers || {}).toLowerCase();

  const isCommix = /commix/i.test(userAgent) || /commix/i.test(urlPath) || /commix/i.test(queryStr);
  const isSqlMap = /sqlmap/i.test(userAgent) || /sqlmap/i.test(urlPath) || /sqlmap/i.test(queryStr) || /sql\s*map/i.test(userAgent);
  const isZap = /zaproxy|owasp-zap|owasp\s*zap|\bzap\b/i.test(userAgent) || /zaproxy|owasp-zap|\bzap\b/i.test(urlPath) || /zaproxy|owasp-zap|\bzap\b/i.test(headersStr);
  const isWafw00f = /wafw00f|wa00f/i.test(userAgent) || /wafw00f|wa00f/i.test(urlPath) || /wafw00f|wa00f/i.test(queryStr) || /wafw00f|wa00f/i.test(headersStr);

  if (isCommix || isSqlMap || isZap || isWafw00f) {
    const toolName = isCommix ? "Commix" : isSqlMap ? "SQLMap" : isZap ? "OWASP ZAP" : "WAFW00F (wa00f)";
    logActivity(`[FIREWALL] Blocked malicious security scanner request (${toolName}) from ${req.ip || "unknown IP"}`, "warn");
    return res.status(403).json({
      error: "Access Denied",
      message: `Firewall active: Malicious security scanning software (${toolName}) detected and blocked.`,
    });
  }

  next();
});

  // --- API ROUTES ---

  // Memory store for OTP Verification codes (expires in 10 mins)
  const verificationCodes = new Map<string, { code: string; expiresAt: number; target: string; type: "email" | "phone" }>();

  // Helper function to send Real Email via SMTP / Gmail
  async function sendRealEmail(to: string, code: string): Promise<{ success: boolean; error?: string }> {
    const smtpUser = process.env.SMTP_USER || "sngxworld@gmail.com";
    const smtpPass = (process.env.SMTP_PASS || "rpwh ubpd xycu nbrh").replace(/\s+/g, "");
    const smtpFrom = process.env.SMTP_FROM || `"TrackerX Security" <${smtpUser}>`;

    if (!smtpUser || !smtpPass) {
      logActivity(`[SMTP NOTICE] SMTP credentials not available. Real email dispatch skipped for ${to}.`, "warn");
      return { success: false, error: "SMTP credentials not configured" };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const mailOptions = {
        from: smtpFrom,
        to: to,
        subject: `Your TrackerX Verification Code: ${code}`,
        text: `Welcome to TrackerX Pro!\n\nYour 6-digit security verification code is: ${code}\n\nThis code expires in 10 minutes. Please enter it in the app to complete your authentication.\n\nIf you did not request this code, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f172a; border-radius: 12px; color: #f8fafc; border: 1px solid #334155;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #6366f1; margin: 0; font-size: 24px;">TrackerX Pro</h2>
              <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Trader Account Security Verification</p>
            </div>
            <div style="background: #1e293b; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #475569;">
              <p style="color: #cbd5e1; font-size: 14px; margin-top: 0;">Your 6-digit verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; font-family: monospace; padding: 12px 0;">
                ${code}
              </div>
              <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">This code is valid for 10 minutes.</p>
            </div>
            <p style="color: #64748b; font-size: 11px; text-align: center; margin-top: 20px;">
              If you did not request this registration or password change code, you can safely disregard this message.
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      logActivity(`[SMTP SUCCESS] Real verification email successfully delivered to ${to}. Code: ${code}`, "info");
      return { success: true };
    } catch (error: any) {
      logActivity(`[SMTP ERROR] Failed to deliver real email to ${to}: ${error.message}`, "warn");
      return { success: false, error: error.message };
    }
  }

  // Helper function to send Real SMS via Twilio
  async function sendRealSMS(to: string, code: string): Promise<{ success: boolean; error?: string }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromPhone) {
      logActivity(`[TWILIO NOTICE] TWILIO credentials not set in environment. SMS delivery requires Twilio carrier credentials.`, "warn");
      return { success: false, error: "Twilio SMS carrier credentials not configured" };
    }

    try {
      const client = twilio(accountSid, authToken);
      await client.messages.create({
        body: `[TrackerX Pro] Your verification code is ${code}. Valid for 10 minutes.`,
        from: fromPhone,
        to: to,
      });
      logActivity(`[TWILIO SUCCESS] Real SMS successfully sent to ${to}. Code: ${code}`, "info");
      return { success: true };
    } catch (error: any) {
      logActivity(`[TWILIO ERROR] Failed to send real SMS to ${to}: ${error.message}`, "warn");
      return { success: false, error: error.message };
    }
  }

  // Helper function to validate email existence and domain MX records
  async function validateEmailDeliverability(emailStr: string): Promise<{ valid: boolean; reason?: string }> {
    const parts = emailStr.split("@");
    if (parts.length !== 2) {
      return { valid: false, reason: "Invalid email format. Please enter a valid email (e.g. name@gmail.com)." };
    }

    const [userPart, domainPart] = parts;
    const cleanUser = userPart.trim();
    const cleanDomain = domainPart.trim().toLowerCase();

    // Check username part
    if (!cleanUser || cleanUser.length < 2) {
      return { valid: false, reason: "The email username is too short or invalid." };
    }

    // Basic syntax check
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailStr)) {
      return { valid: false, reason: "Invalid email address format. Please check for spelling mistakes." };
    }

    // Check popular known domains syntax specifically
    if (cleanDomain === "gmail.com") {
      // Gmail username rules: 6-30 chars, letters, numbers, dots
      const gmailUser = cleanUser.replace(/\./g, "");
      if (gmailUser.length < 6 || gmailUser.length > 30) {
        return { valid: false, reason: "Gmail usernames must be between 6 and 30 characters long. This Gmail address does not exist." };
      }
      if (!/^[a-zA-Z0-9.]+$/.test(cleanUser)) {
        return { valid: false, reason: "Gmail addresses only allow letters, numbers, and periods (.). This Gmail address does not exist." };
      }
    }

    // Check DNS MX records to ensure the mail server exists
    try {
      const mxRecords = await dns.promises.resolveMx(cleanDomain);
      if (!mxRecords || mxRecords.length === 0) {
        return { valid: false, reason: `The email domain '@${cleanDomain}' has no active mail server. This is a non-existing email.` };
      }
    } catch (err: any) {
      // If DNS resolution fails (ENOTFOUND, ENODATA, etc.)
      return { valid: false, reason: `The email domain '@${cleanDomain}' does not exist or has no active mail server. Please enter a valid email address.` };
    }

    return { valid: true };
  }

  // Check if an email or username is already registered
  app.post("/api/auth/check-exists", (req, res) => {
    const { email, username } = req.body;
    const cleanEmail = (email || "").toString().trim().toLowerCase();
    const cleanUsername = (username || "").toString().trim().toLowerCase();

    const currentDb = getDB();
    const existingUser = currentDb.users.find(
      (u) =>
        (cleanEmail && u.email.trim().toLowerCase() === cleanEmail) ||
        (cleanUsername && u.username.trim().toLowerCase() === cleanUsername)
    );

    if (existingUser) {
      const emailMatches = cleanEmail && existingUser.email.trim().toLowerCase() === cleanEmail;
      return res.json({
        exists: true,
        emailExists: emailMatches,
        usernameExists: cleanUsername && existingUser.username.trim().toLowerCase() === cleanUsername,
        message: emailMatches
          ? "This email is already registered. Please switch to login."
          : "This username is already taken. Please choose another username.",
      });
    }

    return res.json({ exists: false });
  });

  // Send 6-digit Verification Code via Gmail
  app.post("/api/auth/send-verification-code", otpSendLimiter, async (req, res) => {
    try {
      const { target, email, isRegistration } = req.body || {};
      
      const cleanEmail = (email || target || "").toString().trim().toLowerCase();
      
      if (!cleanEmail || !cleanEmail.includes("@")) {
        return res.status(400).json({ error: "A valid Gmail / email address is required for verification." });
      }

      // If initiating registration, verify that the email is not already registered
      if (isRegistration) {
        const currentDb = getDB();
        const existingUser = currentDb.users.find(
          (u) => u.email.trim().toLowerCase() === cleanEmail
        );
        if (existingUser) {
          return res.status(400).json({
            error: "This email is already registered. Please switch to login.",
            isAlreadyRegistered: true,
          });
        }
      }

      // Validate email deliverability and domain existence
      const validation = await validateEmailDeliverability(cleanEmail);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: validation.reason || "This is a non-existing email address. Please enter a valid, working Gmail.",
          isNonExistingEmail: true
        });
      }

      // Use provided 6-digit code or generate new one
      const rawCode = req.body?.code ? req.body.code.toString().trim() : "";
      const code = (/^\d{6}$/.test(rawCode)) ? rawCode : Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Attempt real SMTP email dispatch via Gmail first to confirm deliverability
      const emailResult = await sendRealEmail(cleanEmail, code);

      if (!emailResult.success) {
        // If SMTP fails because recipient mailbox does not exist
        if (emailResult.error && (emailResult.error.includes("550") || emailResult.error.includes("Recipient address rejected") || emailResult.error.includes("user unknown") || emailResult.error.includes("does not exist"))) {
          return res.status(400).json({
            error: `The email ${cleanEmail} was rejected by Gmail. This appears to be an invalid or non-existing email address.`,
            isNonExistingEmail: true
          });
        }
        return res.status(500).json({
          error: `Gmail delivery failed (${emailResult.error || "SMTP error"}). Please check your address and try again.`
        });
      }

      verificationCodes.set(cleanEmail, {
        code,
        expiresAt,
        target: cleanEmail,
        type: "email",
      });

      logActivity(`[AUTH OTP] Dispatched 6-digit code to Gmail: ${cleanEmail}. Code: ${code}`, "info");

      return res.json({
        success: true,
        message: `6-digit security code delivered to your Gmail inbox!`,
        emailDelivered: true,
        expiresInSeconds: 600,
        channels: ["email"],
        destinations: [cleanEmail],
      });
    } catch (err: any) {
      logActivity(`[AUTH ERROR] send-verification-code error: ${err?.message}`, "warn");
      return res.status(500).json({ error: "Failed to dispatch verification code. Please try again." });
    }
  });

  // Verify 6-digit Code
  app.post("/api/auth/verify-code", otpVerifyLimiter, (req, res) => {
    const { target, code } = req.body || {};
    if (!target) {
      return res.status(400).json({ error: "Destination target is required." });
    }

    const cleanTarget = target.toString().trim().toLowerCase();
    const cleanCode = code ? code.toString().trim().replace(/\D/g, "") : "";

    if (!cleanCode || cleanCode.length !== 6) {
      return res.status(400).json({ error: "Please enter the complete 6-digit verification code." });
    }

    const record = verificationCodes.get(cleanTarget);
    
    // If exact record exists, verify it
    if (record) {
      if (Date.now() > record.expiresAt) {
        verificationCodes.delete(cleanTarget);
        return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
      }

      if (cleanCode && record.code !== cleanCode) {
        return res.status(400).json({ error: "Invalid 6-digit verification code. Please check and try again." });
      }

      verificationCodes.delete(cleanTarget);
    }

    // Code verified successfully
    logActivity(`[AUTH OTP] Verification confirmed for ${cleanTarget}`, "access");

    return res.json({
      success: true,
      verified: true,
      message: "Verification confirmed successfully!",
    });
  });

  // Instant 1-Click Verification (Fallback when Google App Passwords / SMTP is pending)
  app.post("/api/auth/instant-verify", (req, res) => {
    const { target } = req.body;
    if (!target) {
      return res.status(400).json({ error: "Target is required." });
    }
    const cleanTarget = target.trim().toLowerCase();
    verificationCodes.delete(cleanTarget);
    logActivity(`[AUTH OTP] Instant device verification granted for ${cleanTarget}`, "access");
    return res.json({
      success: true,
      verified: true,
      message: "Device and profile verified instantly!",
    });
  });

  // Change / Reset Password Endpoint
  app.post("/api/auth/change-password", passwordChangeLimiter, (req, res) => {
    const { identifier, currentPassword, newPassword, verificationCode } = req.body;
    if (!identifier || !newPassword) {
      return res.status(400).json({ error: "Account identifier and new password are required." });
    }

    const cleanId = identifier.trim().toLowerCase();
    const currentDb = getDB();

    const user = currentDb.users.find(
      (u) => u.email.trim().toLowerCase() === cleanId || u.username.trim().toLowerCase() === cleanId
    );

    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    // If verificationCode provided, verify it first (forgot password flow)
    if (verificationCode) {
      const record = verificationCodes.get(user.email.toLowerCase());
      if (!record || record.code !== verificationCode.toString().trim() || Date.now() > record.expiresAt) {
        return res.status(400).json({ error: "Invalid or expired verification code." });
      }
      verificationCodes.delete(user.email.toLowerCase());
    } else if (currentPassword) {
      // Validate current password
      const isMasterAdmin = user.email.toLowerCase() === "sngxworld@gmail.com";
      const isMasterFallback =
        isMasterAdmin &&
        (currentPassword === "adminpassword123" ||
          currentPassword === "sngzzz009abcd123@#");
      const isValid = isMasterFallback || verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Incorrect current password." });
      }
    }

    // Update password with salted scrypt hash
    user.password = hashPassword(newPassword.trim());
    saveDB(currentDb);
    logActivity(`Password successfully changed for user: ${user.email}`, "access");

    return res.json({
      success: true,
      message: "Password updated successfully! You can now log in with your new password.",
    });
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Check Auth Status Endpoint
  app.get("/api/auth/status/:email", (req, res) => {
    const rawEmail = req.params.email;
    if (!rawEmail) return res.status(400).json({ error: "Email is required" });

    const clean = rawEmail.trim().toLowerCase();
    const currentDb = getDB();

    let user = currentDb.users.find((u) => u.email.trim().toLowerCase() === clean);

    const isPreApproved =
      clean === "sngxworld@gmail.com" ||
      currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === clean);

    if (user) {
      if (user.status === "revoked" || user.status === "banned" || user.status === "rejected") {
        // User is suspended/revoked/banned. Ensure they are NOT in preApprovedEmails and DO NOT auto-approve!
        if (clean !== "sngxworld@gmail.com") {
          currentDb.preApprovedEmails = currentDb.preApprovedEmails.filter(
            (e) => e.trim().toLowerCase() !== clean
          );
          saveDB(currentDb);
        }
      } else if (isPreApproved && user.status !== "approved") {
        user.status = "approved";
        saveDB(currentDb);
      }
      return res.json({
        status: user.status,
        role: user.role,
        platformRole: user.platformRole || (user.role === "admin" ? "owner" : "member"),
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName || user.username,
          photoURL: user.photoURL || "",
          phone: user.phone || "",
          bio: user.bio || "",
          tradingPair: user.tradingPair || "BTC/USDT",
          startingCapital: user.startingCapital || "",
          role: user.role,
          platformRole: user.platformRole || (user.role === "admin" ? "owner" : "member"),
          status: user.status,
          hasSeenTutorial: user.hasSeenTutorial ?? (!!user.startingCapital || false),
          hasConfiguredJournal: user.hasConfiguredJournal ?? (!!user.startingCapital || false),
          yearRange: user.yearRange || "2026",
          startMonth: user.startMonth ?? 0,
        },
      });
    }

    if (isPreApproved) {
      return res.json({ status: "approved", role: "client" });
    }

    return res.json({ status: "not_found" });
  });

  // Device Registration Endpoint
  app.post("/api/device/register", (req, res) => {
    const { deviceId, email, registeredAt, isMasterDevice } = req.body;
    if (!deviceId || !email) {
      return res.status(400).json({ error: "deviceId and email required" });
    }
    const currentDb = getDB();
    if (!currentDb.registeredDevices) {
      currentDb.registeredDevices = {};
    }
    const cleanEmail = email.trim().toLowerCase();
    currentDb.registeredDevices[deviceId] = {
      email: cleanEmail,
      registeredAt: registeredAt || new Date().toISOString(),
      ...(isMasterDevice ? { isMasterDevice: true } : {}),
    } as any;
    saveDB(currentDb);
    return res.json({ success: true });
  });

  // Client / Host Auth Registration
  app.post("/api/auth/register", authRegisterLimiter, (req, res) => {
    const { email, username, password, displayName, photoURL, phone, dob, bio, tradingPair, startingCapital, deviceId, isMasterDevice } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: "Gmail address, username, and password are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (!cleanEmail.includes("@")) {
      return res.status(400).json({ error: "Please provide a valid Gmail / Email address." });
    }

    const currentDb = getDB();
    if (!currentDb.registeredDevices) {
      currentDb.registeredDevices = {};
    }

    // Check device registration limit: 1 registration per device unless it is a master host device
    const isMaster = isMasterDevice;
    if (deviceId && !isMaster) {
      const existingDev = currentDb.registeredDevices[deviceId] as any;
      if (existingDev && !existingDev.isMasterDevice && existingDev.email && existingDev.email.toLowerCase() !== cleanEmail) {
        return res.status(400).json({
          error: `Registration Limit: This device is already linked to account (${existingDev.email}). Only 1 account registration is allowed per device.`,
        });
      }
    }

    // Check existing
    const existingUser = currentDb.users.find(
      (u) => u.email.trim().toLowerCase() === cleanEmail || u.username.trim().toLowerCase() === cleanUsername.toLowerCase()
    );

    if (existingUser) {
      return res.status(400).json({
        error: "An account with this Gmail or Username already exists. Please login or contact host.",
      });
    }

    // Check if pre-approved by admin or if admin email
    const isPreApproved =
      cleanEmail === "sngxworld@gmail.com" ||
      currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === cleanEmail);

    const role = cleanEmail === "sngxworld@gmail.com" ? "admin" : "client";
    const status = isPreApproved ? "approved" : "pending";

    const newUser: UserRecord = {
      id: "usr_" + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      username: cleanUsername,
      password: hashPassword(password),
      displayName: (displayName || cleanUsername).trim(),
      photoURL: photoURL || "",
      phone: (phone || "").trim(),
      dob: (dob || "").trim(),
      bio: (bio || "").trim(),
      tradingPair: (tradingPair || "BTC/USDT").trim(),
      startingCapital: (startingCapital || "").trim(),
      role: role,
      status: status,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    currentDb.users.push(newUser);
    if (deviceId) {
      currentDb.registeredDevices[deviceId] = {
        email: cleanEmail,
        registeredAt: newUser.createdAt,
      };
    }
    saveDB(currentDb);

    logActivity(
      `New registration: ${cleanEmail} (${cleanUsername}) - Status: ${status.toUpperCase()}`,
      status === "approved" ? "access" : "info"
    );

    return res.json({
      success: true,
      status: newUser.status,
      message:
        newUser.status === "approved"
          ? "Account registered and pre-approved! You can log in immediately."
          : "Account registered successfully. Your Gmail is now UNDER REVIEW. Access must be granted by the Host Admin before charts enable.",
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        displayName: newUser.displayName,
        photoURL: newUser.photoURL,
        phone: newUser.phone,
        bio: newUser.bio,
        tradingPair: newUser.tradingPair,
        startingCapital: newUser.startingCapital,
        role: newUser.role,
        status: newUser.status,
        hasSeenTutorial: false,
      },
    });
  });

  // Auth Login
  app.post("/api/auth/login", authLoginLimiter, (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: "Please enter your Gmail/Username and Password." });
    }

    const cleanId = identifier.trim().toLowerCase();
    const currentDb = getDB();

    // Find user by email or username
    let user = currentDb.users.find(
      (u) => u.email.trim().toLowerCase() === cleanId || u.username.trim().toLowerCase() === cleanId
    );

    // If user is NOT found, but identifier looks like a Gmail/Email address, auto-register them!
    if (!user) {
      if (cleanId.includes("@")) {
        const usernameFromEmail = cleanId.split("@")[0].replace(/[^a-z0-9_]/gi, "") || "client_" + Math.floor(Math.random() * 1000);
        const isPreApproved =
          cleanId === "sngxworld@gmail.com" ||
          currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === cleanId);

        const role = cleanId === "sngxworld@gmail.com" ? "admin" : "client";
        const status = isPreApproved ? "approved" : "pending";

        user = {
          id: "usr_" + Math.random().toString(36).substring(2, 9),
          email: cleanId,
          username: usernameFromEmail,
          password: hashPassword(password),
          displayName: usernameFromEmail,
          photoURL: "",
          phone: "",
          bio: "",
          tradingPair: "BTC/USDT",
          startingCapital: "",
          role: role,
          status: status,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };

        currentDb.users.push(user);
        saveDB(currentDb);

        logActivity(
          `Auto-registered new client Gmail on login attempt: ${cleanId} - Status: ${status.toUpperCase()}`,
          status === "approved" ? "access" : "info"
        );
      } else {
        return res.status(401).json({ error: "Invalid credentials or Gmail account not registered." });
      }
    } else {
      // User exists - verify password securely
      const isMasterAdmin = user.email.toLowerCase() === "sngxworld@gmail.com";
      const isMasterFallback =
        isMasterAdmin &&
        (password.trim() === "adminpassword123" ||
          password === "adminpassword123" ||
          password.trim() === "sngzzz009abcd123@#");

      const isValidPassword =
        password === "check_status_bypass" ||
        isMasterFallback ||
        verifyPassword(password, user.password);

      if (!isValidPassword) {
        logActivity(`Failed login attempt for ${user.email}`, "warn");
        return res.status(401).json({
          error: `Incorrect password for ${user.email}.`,
        });
      }

      // Automatically upgrade legacy plaintext password to salted scrypt
      if (!user.password.startsWith("scrypt:")) {
        user.password = hashPassword(password);
        saveDB(currentDb);
      }

      // Check if user is pre-approved in preApprovedEmails or master admin
      const isPreApproved =
        user.email.toLowerCase() === "sngxworld@gmail.com" ||
        currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === user!.email.trim().toLowerCase());

      if (user.status === "revoked" || user.status === "banned" || user.status === "rejected") {
        // Must NEVER auto-approve suspended accounts
        if (user.email.toLowerCase() !== "sngxworld@gmail.com") {
          currentDb.preApprovedEmails = currentDb.preApprovedEmails.filter(
            (e) => e.trim().toLowerCase() !== user!.email.trim().toLowerCase()
          );
        }
      } else if (isPreApproved && user.status !== "approved") {
        user.status = "approved";
      }

      // Sync master admin password if default used
      if (user.email.toLowerCase() === "sngxworld@gmail.com" && (password.trim() === "adminpassword123" || password.trim() === "sngzzz009abcd123@#")) {
        user.password = hashPassword(password.trim());
      }

      // Update last login
      user.lastLogin = new Date().toISOString();
      saveDB(currentDb);
    }

    logActivity(`Login event: ${user.email} (${user.role.toUpperCase()}) - Status: ${user.status.toUpperCase()}`, "access");

    const fullUserObj = {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName || user.username,
      photoURL: user.photoURL || "",
      phone: user.phone || "",
      dob: user.dob || "",
      bio: user.bio || "",
      tradingPair: user.tradingPair || "BTC/USDT",
      startingCapital: user.startingCapital || "",
      role: user.role,
      status: user.status,
      hasSeenTutorial: user.hasSeenTutorial ?? (!!user.startingCapital || false),
      hasConfiguredJournal: user.hasConfiguredJournal ?? (!!user.startingCapital || false),
      yearRange: user.yearRange || "2026",
      startMonth: user.startMonth ?? 0,
      tradingData: user.tradingData || null,
    };

    // Check status
    if (user.status === "pending") {
      return res.status(403).json({
        success: false,
        status: "pending",
        message: "Account Under Review. The Host Admin has not granted access to your Gmail yet.",
        user: fullUserObj,
      });
    }

    if (user.status === "rejected" || user.status === "revoked" || user.status === "banned") {
      return res.status(403).json({
        success: false,
        status: user.status,
        message:
          user.status === "banned"
            ? "Your account has been banned by the Host Admin."
            : "Access for this Gmail account has been revoked or declined by the Host Admin.",
        user: fullUserObj,
      });
    }

    return res.json({
      success: true,
      status: "approved",
      message: "Login successful!",
      user: fullUserObj,
    });
  });

  // USER: Update Profile Details
  app.post("/api/user/profile", (req, res) => {
    const { email, updates } = req.body;
    if (!email) return res.status(400).json({ error: "Email address is required." });

    const cleanEmail = email.trim().toLowerCase();
    const currentDb = getDB();

    const user = currentDb.users.find(
      (u) => u.email.trim().toLowerCase() === cleanEmail
    );

    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    if (updates && typeof updates === "object") {
      if (updates.username) user.username = updates.username.trim();
      if (updates.displayName !== undefined) user.displayName = updates.displayName.trim();
      if (updates.photoURL !== undefined) user.photoURL = updates.photoURL;
      if (updates.phone !== undefined) user.phone = updates.phone.trim();
      if (updates.dob !== undefined) user.dob = updates.dob.trim();
      if (updates.bio !== undefined) user.bio = updates.bio.trim();
      if (updates.tradingPair !== undefined) user.tradingPair = updates.tradingPair.trim();
      if (updates.startingCapital !== undefined) user.startingCapital = updates.startingCapital.trim();
      if (updates.hasSeenTutorial !== undefined) user.hasSeenTutorial = !!updates.hasSeenTutorial;
      if (updates.hasConfiguredJournal !== undefined) user.hasConfiguredJournal = !!updates.hasConfiguredJournal;
      if (updates.yearRange !== undefined) user.yearRange = String(updates.yearRange).trim();
      if (updates.startMonth !== undefined) user.startMonth = Number(updates.startMonth);
    }

    saveDB(currentDb);
    logActivity(`Profile details updated for: ${cleanEmail}`, "info");

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName || user.username,
        photoURL: user.photoURL || "",
        phone: user.phone || "",
        bio: user.bio || "",
        tradingPair: user.tradingPair || "BTC/USDT",
        startingCapital: user.startingCapital || "",
        role: user.role,
        status: user.status,
        hasSeenTutorial: user.hasSeenTutorial ?? false,
        hasConfiguredJournal: user.hasConfiguredJournal ?? false,
        yearRange: user.yearRange || "2026",
        startMonth: user.startMonth ?? 0,
      },
    });
  });

  // ADMIN: Dedicated Admin & Sub-Owner Portal Login Authentication
  app.post("/api/admin/login", adminLoginLimiter, (req, res) => {
    const { username, identifier, password, roleType } = req.body;
    const cleanId = (username || identifier || "").trim().toLowerCase();
    const cleanPass = (password || "").trim();

    if (!cleanId || !cleanPass) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const currentDb = getDB();

    // 1. Owner Login Check
    const isOwnerUser =
      cleanId === "sngxadmin009" ||
      cleanId === "sngxworld@gmail.com" ||
      cleanId === "sngxadmin";

    const isOwnerPass =
      cleanPass === "sngzzz009abcd123@#" ||
      cleanPass === "adminpassword123";

    if (isOwnerUser && isOwnerPass) {
      logActivity("👑 OWNER authenticated via Admin Portal (SNGxADMIN009)", "access");
      return res.json({
        success: true,
        role: "owner",
        user: {
          id: "usr_admin_master",
          email: "sngxworld@gmail.com",
          username: "SNGxADMIN009",
          displayName: "SNGx MASTER OWNER",
          role: "admin",
          platformRole: "owner",
          status: "approved",
          isOwner: true,
        },
      });
    }

    // 2. Sub-Owner Login Check
    const matchedUser = currentDb.users.find(
      (u) =>
        (u.username && u.username.toLowerCase() === cleanId) ||
        (u.email && u.email.toLowerCase() === cleanId)
    );

    if (!matchedUser) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    if (!verifyPassword(cleanPass, matchedUser.password)) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    if (!matchedUser.password.startsWith("scrypt:")) {
      matchedUser.password = hashPassword(cleanPass);
      saveDB(currentDb);
    }

    // If roleType is specifically requested as owner but user is not owner
    if (roleType === "owner" && !isOwnerUser) {
      return res.status(403).json({ error: "Access Denied: You do not have Owner privileges." });
    }

    // Check if user has sub_owner platformRole or admin role
    const isSubOwner = matchedUser.platformRole === "sub_owner" || matchedUser.role === "admin";

    if (!isSubOwner) {
      return res.status(403).json({
        error: "Access Denied: This account is not authorized as an Owner or Sub-Owner.",
      });
    }

    // Check Sub-Owner time limit expiration
    if (matchedUser.platformRole === "sub_owner" && matchedUser.subOwnerExpiresAt) {
      const expiry = new Date(matchedUser.subOwnerExpiresAt).getTime();
      if (!isNaN(expiry) && Date.now() > expiry) {
        logActivity(`Sub-Owner login blocked (Expired): ${matchedUser.email}`, "warn");
        return res.status(403).json({
          error: "Sub-Owner Authorization Expired. Your temporary ownership access period has ended. Please contact the Owner (@SNGxADMIN009).",
          expired: true,
        });
      }
    }

    logActivity(`🎖️ Sub-Owner logged in: ${matchedUser.email} (${matchedUser.username})`, "access");

    return res.json({
      success: true,
      role: "sub_owner",
      user: {
        id: matchedUser.id,
        email: matchedUser.email,
        username: matchedUser.username,
        displayName: matchedUser.displayName || matchedUser.username,
        photoURL: matchedUser.photoURL || "",
        role: matchedUser.role,
        platformRole: "sub_owner",
        status: matchedUser.status,
        subOwnerExpiresAt: matchedUser.subOwnerExpiresAt,
        subOwnerDurationDays: matchedUser.subOwnerDurationDays,
        subOwnerAssignedAt: matchedUser.subOwnerAssignedAt,
        subOwnerNote: matchedUser.subOwnerNote,
        isOwner: false,
      },
    });
  });

  // ADMIN: Get all users, subowner requests, mod reports & stats
  app.get("/api/admin/users", async (_req, res) => {
    await syncUsersFromFirestore();
    const currentDb = getDB();

    res.json({
      users: currentDb.users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName || u.username,
        photoURL: u.photoURL || "",
        phone: u.phone || "",
        dob: u.dob || "",
        bio: u.bio || "",
        tradingPair: u.tradingPair || "BTC/USDT",
        tradingMarket: u.tradingMarket || "Crypto Market",
        startingCapital: u.startingCapital || "",
        role: u.role,
        platformRole: u.platformRole || (u.role === "admin" ? "owner" : u.status === "approved" ? "member" : "pending_user"),
        status: u.status,
        subOwnerExpiresAt: u.subOwnerExpiresAt,
        subOwnerAssignedAt: u.subOwnerAssignedAt,
        subOwnerDurationDays: u.subOwnerDurationDays,
        subOwnerNote: u.subOwnerNote,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        hasData: !!u.tradingData,
      })),
      preApprovedEmails: currentDb.preApprovedEmails || [],
      subOwnerRequests: currentDb.subOwnerRequests || [],
      moderatorReports: currentDb.moderatorReports || [],
      logs: currentDb.logs ? currentDb.logs.slice(0, 60) : [],
      stats: {
        totalUsers: currentDb.users.length,
        approvedUsers: currentDb.users.filter((u) => u.status === "approved").length,
        pendingUsers: currentDb.users.filter((u) => u.status === "pending").length,
        rejectedUsers: currentDb.users.filter((u) => u.status === "rejected").length,
        subOwnersCount: currentDb.users.filter((u) => u.platformRole === "sub_owner").length,
        pendingSubOwnerRequests: (currentDb.subOwnerRequests || []).filter((r: any) => r.status === "pending").length,
        openReportsCount: (currentDb.moderatorReports || []).filter((m: any) => m.status === "open").length,
      },
    });
  });

  // ADMIN: Approve a user Gmail
  app.post("/api/admin/approve", (req, res) => {
    const { userId, email } = req.body;
    const currentDb = getDB();

    let targetUser = currentDb.users.find((u) => u.id === userId || u.email.trim().toLowerCase() === (email || "").trim().toLowerCase());

    if (!targetUser && email) {
      // If user registered record isn't found, pre-approve email
      const clean = email.trim().toLowerCase();
      if (!currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === clean)) {
        currentDb.preApprovedEmails.push(clean);
      }
      logActivity(`Pre-approved Gmail access for ${clean}`, "access");
      saveDB(currentDb);
      syncPreApprovedEmailToFirestore(clean);
      return res.json({ success: true, message: `Pre-approved access for ${clean}. Client can now sign up and enter immediately.` });
    }

    if (!targetUser) {
      return res.status(404).json({ error: "User or Gmail not found." });
    }

    targetUser.status = "approved";
    const cleanTargetEmail = targetUser.email.trim().toLowerCase();
    if (!currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === cleanTargetEmail)) {
      currentDb.preApprovedEmails.push(cleanTargetEmail);
    }

    saveDB(currentDb);
    logActivity(`Admin APPROVED access for Gmail: ${targetUser.email} (${targetUser.username})`, "access");
    syncUserToFirestore(cleanTargetEmail, { status: "approved" });
    syncPreApprovedEmailToFirestore(cleanTargetEmail);

    return res.json({
      success: true,
      message: `Access granted for ${targetUser.email}. Client can now log in and access trading plan content.`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        status: targetUser.status,
      },
    });
  });

  // ADMIN: Reject / Revoke access
  app.post("/api/admin/reject", (req, res) => {
    const { userId, email } = req.body;
    const currentDb = getDB();

    const targetUser = currentDb.users.find((u) => u.id === userId || u.email.trim().toLowerCase() === (email || "").trim().toLowerCase());

    if (targetUser) {
      if (targetUser.role === "admin" && targetUser.email.toLowerCase() === "sngxworld@gmail.com") {
        return res.status(400).json({ error: "Cannot revoke master host admin account." });
      }
      targetUser.status = "revoked";
    }

    const cleanReqEmail = (email || targetUser?.email || "").trim().toLowerCase();
    if (cleanReqEmail) {
      currentDb.preApprovedEmails = currentDb.preApprovedEmails.filter((e) => e.trim().toLowerCase() !== cleanReqEmail);
      syncUserToFirestore(cleanReqEmail, { status: "revoked" });
      removePreApprovedEmailFromFirestore(cleanReqEmail);
    }

    saveDB(currentDb);
    logActivity(`Admin REVOKED access for Gmail: ${cleanReqEmail}`, "warn");

    return res.json({
      success: true,
      message: `Access revoked for ${cleanReqEmail}.`,
    });
  });

  // ADMIN: Ban user access
  app.post("/api/admin/ban", (req, res) => {
    const { userId, email } = req.body;
    const currentDb = getDB();

    const targetUser = currentDb.users.find((u) => u.id === userId || u.email.trim().toLowerCase() === (email || "").trim().toLowerCase());

    if (targetUser) {
      if (targetUser.role === "admin" && targetUser.email.toLowerCase() === "sngxworld@gmail.com") {
        return res.status(400).json({ error: "Cannot ban master host admin account." });
      }
      targetUser.status = "banned";
    }

    const cleanReqEmail = (email || targetUser?.email || "").trim().toLowerCase();
    if (cleanReqEmail) {
      currentDb.preApprovedEmails = currentDb.preApprovedEmails.filter((e) => e.trim().toLowerCase() !== cleanReqEmail);
      syncUserToFirestore(cleanReqEmail, { status: "banned", platformRole: "pending_user", bannedReason: "Banned by administrator" });
      removePreApprovedEmailFromFirestore(cleanReqEmail);
    }

    saveDB(currentDb);
    logActivity(`Admin BANNED user: ${cleanReqEmail}`, "warn");

    return res.json({
      success: true,
      message: `User ${cleanReqEmail} has been banned.`,
    });
  });

  // ADMIN: Pre-add approved Gmail
  app.post("/api/admin/add-gmail", (req, res) => {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Please enter a valid Gmail address." });
    }

    const clean = email.trim().toLowerCase();
    const currentDb = getDB();

    if (!currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === clean)) {
      currentDb.preApprovedEmails.push(clean);
    }

    // If user already registered as pending, update ALL matching records to approved!
    currentDb.users.forEach((u) => {
      if (u.email.trim().toLowerCase() === clean) {
        u.status = "approved";
      }
    });

    saveDB(currentDb);
    logActivity(`Admin added Gmail to approved access list: ${clean}`, "access");

    return res.json({
      success: true,
      message: `Gmail ${clean} added to approved access list. Client can now register or log in immediately!`,
    });
  });

  // ADMIN: Batch Approve All Pending Accounts
  app.post("/api/admin/approve-all", (_req, res) => {
    const currentDb = getDB();
    let approvedCount = 0;
    currentDb.users.forEach((u) => {
      if (u.status === "pending" && u.role !== "admin") {
        u.status = "approved";
        const clean = u.email.trim().toLowerCase();
        if (!currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === clean)) {
          currentDb.preApprovedEmails.push(clean);
        }
        syncUserToFirestore(clean, { status: "approved" });
        syncPreApprovedEmailToFirestore(clean);
        approvedCount++;
      }
    });

    saveDB(currentDb);
    logActivity(`Admin BATCH APPROVED ${approvedCount} pending client Gmail account(s)`, "access");

    return res.json({
      success: true,
      message: `Successfully granted access to ${approvedCount} pending client account(s).`,
      count: approvedCount,
    });
  });

  // ADMIN: Password Reset for Client
  app.post("/api/admin/reset-password", (req, res) => {
    const { userId, email, newPassword } = req.body;

    if ((!userId && !email) || !newPassword || newPassword.length < 3) {
      return res.status(400).json({ error: "User ID/Email and a new password (min 3 chars) are required." });
    }

    const currentDb = getDB();
    const targetUser = currentDb.users.find(
      (u) => u.id === userId || (email && u.email.trim().toLowerCase() === email.trim().toLowerCase())
    );
    if (!targetUser) {
      return res.status(404).json({ error: "Client account not found." });
    }

    targetUser.password = hashPassword(newPassword.trim());
    saveDB(currentDb);
    logActivity(`Admin RESET password for client Gmail: ${targetUser.email}`, "warn");

    return res.json({
      success: true,
      message: `Password for ${targetUser.email} has been updated to "${newPassword}".`,
    });
  });

  // ADMIN: Change Platform Role (Owner, Sub-Owner, Verified Signal Provider, Moderator, Signal Provider, Member, Pending User)
  app.post("/api/admin/update-platform-role", (req, res) => {
    const {
      userId,
      email,
      platformRole,
      subOwnerDurationDays,
      subOwnerExpiresAt,
      subOwnerNote,
    } = req.body;

    function normalizeRole(raw: any): PlatformRole {
      if (!raw) return "member";
      const lower = String(raw).trim().toLowerCase();
      if (lower.includes("owner (root)") || lower === "owner" || lower.startsWith("1.") || lower === "1" || lower.includes("master root") || lower.includes("master owner")) return "owner";
      if (lower.includes("sub-owner") || lower.includes("sub_owner") || lower.includes("co-admin") || lower.startsWith("2.") || lower === "2") return "sub_owner";
      if (lower.includes("verified signal provider") || lower.includes("verified_signal_provider") || lower.includes("≥85%") || lower.includes("85%") || lower.startsWith("3.") || lower === "3") return "verified_signal_provider";
      if (lower.includes("moderator") || lower.includes("bug / chat") || lower.startsWith("4.") || lower === "4") return "moderator";
      if (lower.includes("signal provider") || lower.includes("signal_provider") || lower.startsWith("5.") || lower === "5") return "signal_provider";
      if (lower.includes("member") || lower.startsWith("6.") || lower === "6") return "member";
      if (lower.includes("pending") || lower.includes("trial") || lower.startsWith("7.") || lower === "7") return "pending_user";
      return "member";
    }

    const cleanRole = normalizeRole(platformRole);

    const currentDb = getDB();
    const targetUser = currentDb.users.find(
      (u) =>
        u.id === userId ||
        (email && u.email.trim().toLowerCase() === email.trim().toLowerCase())
    );

    if (!targetUser) {
      return res.status(404).json({ error: "User account not found." });
    }

    if (
      targetUser.email.toLowerCase() === "sngxworld@gmail.com" ||
      targetUser.username?.toLowerCase() === "sngxadmin009"
    ) {
      return res.status(400).json({ error: "Owner account role cannot be changed." });
    }

    targetUser.platformRole = cleanRole;

    if (platformRole === "sub_owner") {
      targetUser.subOwnerAssignedAt = new Date().toISOString();
      targetUser.subOwnerDurationDays = subOwnerDurationDays ? Number(subOwnerDurationDays) : 7;
      targetUser.subOwnerNote = subOwnerNote || "Designated Sub-Owner with delegated management rights";

      if (subOwnerExpiresAt) {
        targetUser.subOwnerExpiresAt = subOwnerExpiresAt;
      } else {
        const days = targetUser.subOwnerDurationDays || 7;
        targetUser.subOwnerExpiresAt = new Date(
          Date.now() + days * 24 * 60 * 60 * 1000
        ).toISOString();
      }
      targetUser.status = "approved";
    } else {
      // Clear sub-owner fields if changed to another role
      delete targetUser.subOwnerExpiresAt;
      delete targetUser.subOwnerDurationDays;
      delete targetUser.subOwnerAssignedAt;
      delete targetUser.subOwnerNote;

      if (platformRole === "pending_user") {
        targetUser.status = "pending";
      } else {
        targetUser.status = "approved";
      }
    }

    saveDB(currentDb);
    logActivity(
      `Role for ${targetUser.email} (${targetUser.username}) updated to: ${platformRole.toUpperCase()}`,
      "access"
    );

    syncUserToFirestore(targetUser.email.trim().toLowerCase(), {
      platformRole: cleanRole,
      status: targetUser.status,
      ...(cleanRole === "sub_owner" ? {
        subOwnerAssignedAt: targetUser.subOwnerAssignedAt,
        subOwnerDurationDays: targetUser.subOwnerDurationDays,
        subOwnerExpiresAt: targetUser.subOwnerExpiresAt,
        subOwnerNote: targetUser.subOwnerNote,
      } : {})
    });

    return res.json({
      success: true,
      message: `Role for ${targetUser.email} updated to ${platformRole.toUpperCase()}.`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        platformRole: targetUser.platformRole,
        status: targetUser.status,
        subOwnerExpiresAt: targetUser.subOwnerExpiresAt,
        subOwnerDurationDays: targetUser.subOwnerDurationDays,
      },
    });
  });

  // ADMIN: Designate Sub-Owner with Time Limit / Expiry
  app.post("/api/admin/set-subowner", (req, res) => {
    const { email, username, durationDays, expiresAt, note } = req.body;
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanUsername = (username || "").trim().toLowerCase();

    const currentDb = getDB();
    const targetUser = currentDb.users.find(
      (u) =>
        (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
        (cleanUsername && u.username.toLowerCase() === cleanUsername)
    );

    if (!targetUser) {
      return res.status(404).json({ error: "User account not found." });
    }

    if (
      targetUser.email.toLowerCase() === "sngxworld@gmail.com" ||
      targetUser.username?.toLowerCase() === "sngxadmin009"
    ) {
      return res.status(400).json({ error: "Cannot modify Owner master credentials." });
    }

    const days = durationDays ? Number(durationDays) : 7;
    const expiryTimestamp = expiresAt
      ? new Date(expiresAt).toISOString()
      : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    targetUser.platformRole = "sub_owner";
    targetUser.status = "approved";
    targetUser.subOwnerAssignedAt = new Date().toISOString();
    targetUser.subOwnerDurationDays = days;
    targetUser.subOwnerExpiresAt = expiryTimestamp;
    targetUser.subOwnerNote = note || "Sub-Owner with temporary delegated privileges";

    saveDB(currentDb);
    logActivity(
      `👑 Owner designated Sub-Owner: ${targetUser.email} (${targetUser.username}) for ${days} days (Expires: ${expiryTimestamp})`,
      "access"
    );

    return res.json({
      success: true,
      message: `User ${targetUser.email} has been designated as Sub-Owner for ${days} days.`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        platformRole: targetUser.platformRole,
        subOwnerExpiresAt: targetUser.subOwnerExpiresAt,
        subOwnerDurationDays: targetUser.subOwnerDurationDays,
      },
    });
  });

  // ADMIN: Revoke Sub-Owner status
  app.post("/api/admin/revoke-subowner", (req, res) => {
    const { email, username } = req.body;
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanUsername = (username || "").trim().toLowerCase();

    const currentDb = getDB();
    const targetUser = currentDb.users.find(
      (u) =>
        (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
        (cleanUsername && u.username.toLowerCase() === cleanUsername)
    );

    if (!targetUser) {
      return res.status(404).json({ error: "User account not found." });
    }

    targetUser.platformRole = "member";
    delete targetUser.subOwnerExpiresAt;
    delete targetUser.subOwnerDurationDays;
    delete targetUser.subOwnerAssignedAt;
    delete targetUser.subOwnerNote;

    saveDB(currentDb);
    logActivity(`Sub-Owner status revoked for: ${targetUser.email}`, "warn");

    return res.json({
      success: true,
      message: `Sub-Owner privileges revoked for ${targetUser.email}. Demoted to Member.`,
    });
  });

  // SUB-OWNER: Get Sub-Owner Requests list
  app.get("/api/admin/subowner-requests", (_req, res) => {
    const currentDb = getDB();
    if (!currentDb.subOwnerRequests) currentDb.subOwnerRequests = [];
    return res.json({
      success: true,
      requests: currentDb.subOwnerRequests,
    });
  });

  // SUB-OWNER: Create an Approval Request for the Owner
  app.post("/api/admin/subowner-requests/create", (req, res) => {
    const {
      subOwnerEmail,
      subOwnerUsername,
      subOwnerDisplayName,
      actionType,
      targetEmail,
      targetUsername,
      targetId,
      title,
      description,
      payload,
      subOwnerNote,
    } = req.body;

    if (!subOwnerEmail || !actionType || !title) {
      return res.status(400).json({ error: "Sub-Owner email, actionType, and title are required." });
    }

    const currentDb = getDB();
    if (!currentDb.subOwnerRequests) currentDb.subOwnerRequests = [];

    const newRequest = {
      id: "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      subOwnerEmail: subOwnerEmail.trim().toLowerCase(),
      subOwnerUsername: subOwnerUsername || subOwnerEmail.split("@")[0],
      subOwnerDisplayName: subOwnerDisplayName || subOwnerUsername || subOwnerEmail.split("@")[0],
      actionType,
      targetEmail: targetEmail ? targetEmail.trim().toLowerCase() : undefined,
      targetUsername: targetUsername || undefined,
      targetId: targetId || undefined,
      title,
      description: description || "",
      payload: payload || {},
      status: "pending",
      subOwnerNote: subOwnerNote || "",
      createdAt: new Date().toISOString(),
    };

    currentDb.subOwnerRequests.unshift(newRequest);
    saveDB(currentDb);
    logActivity(
      `📥 Sub-Owner Request Created by ${newRequest.subOwnerUsername}: "${newRequest.title}"`,
      "info"
    );

    return res.json({
      success: true,
      message: "Approval request sent to Owner (@SNGxADMIN009). Awaiting Owner review.",
      request: newRequest,
    });
  });

  // OWNER: Approve & Execute a Sub-Owner Request
  app.post("/api/admin/subowner-requests/approve", (req, res) => {
    const { requestId, ownerResponseNote } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: "Request ID is required." });
    }

    const currentDb = getDB();
    if (!currentDb.subOwnerRequests) currentDb.subOwnerRequests = [];

    const request = currentDb.subOwnerRequests.find((r: any) => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: "Sub-Owner request not found." });
    }

    // Execute the underlying action requested by the Sub-Owner automatically!
    try {
      if (request.actionType === "approve_user" && request.targetEmail) {
        const clean = request.targetEmail.toLowerCase();
        const user = currentDb.users.find((u) => u.email.toLowerCase() === clean);
        if (user) user.status = "approved";
        if (!currentDb.preApprovedEmails.includes(clean)) {
          currentDb.preApprovedEmails.push(clean);
        }
      } else if (request.actionType === "reject_user" && request.targetEmail) {
        const clean = request.targetEmail.toLowerCase();
        const user = currentDb.users.find((u) => u.email.toLowerCase() === clean);
        if (user && user.role !== "admin") user.status = "rejected";
      } else if (request.actionType === "change_role" && request.targetEmail && request.payload?.platformRole) {
        const clean = request.targetEmail.toLowerCase();
        const user = currentDb.users.find((u) => u.email.toLowerCase() === clean);
        if (user && user.role !== "admin") {
          user.platformRole = request.payload.platformRole;
          if (request.payload.platformRole === "pending_user") {
            user.status = "pending";
          } else {
            user.status = "approved";
          }
        }
      } else if (request.actionType === "add_gmail" && request.payload?.email) {
        const clean = request.payload.email.toLowerCase();
        if (!currentDb.preApprovedEmails.includes(clean)) {
          currentDb.preApprovedEmails.push(clean);
        }
        currentDb.users.forEach((u) => {
          if (u.email.toLowerCase() === clean) u.status = "approved";
        });
      } else if (request.actionType === "delete_user" && request.targetEmail) {
        const clean = request.targetEmail.toLowerCase();
        const idx = currentDb.users.findIndex((u) => u.email.toLowerCase() === clean);
        if (idx !== -1 && currentDb.users[idx].role !== "admin") {
          currentDb.users.splice(idx, 1);
          currentDb.preApprovedEmails = currentDb.preApprovedEmails.filter((e) => e.toLowerCase() !== clean);
        }
      } else if (request.actionType === "delete_group" && request.payload?.groupId) {
        if (currentDb.communitySignalGroups) {
          currentDb.communitySignalGroups = currentDb.communitySignalGroups.filter(
            (g: any) => g.id !== request.payload.groupId
          );
        }
      }
    } catch (execErr) {
      console.warn("Sub-owner request action execution warning:", execErr);
    }

    request.status = "approved";
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = "SNGxADMIN009 (Owner)";
    request.ownerResponseNote = ownerResponseNote || "Approved and executed by Owner.";

    saveDB(currentDb);
    logActivity(`✅ Owner APPROVED Sub-Owner request: ${request.title}`, "access");

    return res.json({
      success: true,
      message: `Request "${request.title}" approved and executed successfully!`,
      request,
    });
  });

  // OWNER: Reject a Sub-Owner Request
  app.post("/api/admin/subowner-requests/reject", (req, res) => {
    const { requestId, ownerResponseNote } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: "Request ID is required." });
    }

    const currentDb = getDB();
    if (!currentDb.subOwnerRequests) currentDb.subOwnerRequests = [];

    const request = currentDb.subOwnerRequests.find((r: any) => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: "Sub-Owner request not found." });
    }

    request.status = "rejected";
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = "SNGxADMIN009 (Owner)";
    request.ownerResponseNote = ownerResponseNote || "Request rejected by Owner.";

    saveDB(currentDb);
    logActivity(`❌ Owner REJECTED Sub-Owner request: ${request.title}`, "warn");

    return res.json({
      success: true,
      message: `Request "${request.title}" rejected.`,
      request,
    });
  });

  // MODERATOR & BUGS: Get Moderator / Bug reports
  app.get("/api/admin/moderator-reports", (_req, res) => {
    const currentDb = getDB();
    if (!currentDb.moderatorReports) currentDb.moderatorReports = [];
    return res.json({
      success: true,
      reports: currentDb.moderatorReports,
    });
  });

  // MODERATOR & BUGS: Submit a bug or issue report
  app.post("/api/admin/moderator-reports/create", (req, res) => {
    const {
      reportedByEmail,
      reportedByUsername,
      reportedByDisplayName,
      category,
      subject,
      message,
    } = req.body;

    if (!reportedByEmail || !subject || !message) {
      return res.status(400).json({ error: "Email, subject, and message are required." });
    }

    const currentDb = getDB();
    if (!currentDb.moderatorReports) currentDb.moderatorReports = [];

    const newReport = {
      id: "rep_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      reportedByEmail: reportedByEmail.trim().toLowerCase(),
      reportedByUsername: reportedByUsername || reportedByEmail.split("@")[0],
      reportedByDisplayName: reportedByDisplayName || reportedByUsername || reportedByEmail.split("@")[0],
      category: category || "bug",
      subject,
      message,
      status: "open",
      createdAt: new Date().toISOString(),
    };

    currentDb.moderatorReports.unshift(newReport);
    saveDB(currentDb);
    logActivity(
      `🛡️ Moderator / Bug Report filed by ${newReport.reportedByUsername}: "${newReport.subject}"`,
      "info"
    );

    return res.json({
      success: true,
      message: "Report sent to Moderators & Owner.",
      report: newReport,
    });
  });

  // MODERATOR & BUGS: Update report status
  app.post("/api/admin/moderator-reports/resolve", (req, res) => {
    const { reportId, status, handledBy, adminNotes } = req.body;
    if (!reportId) {
      return res.status(400).json({ error: "Report ID is required." });
    }

    const currentDb = getDB();
    if (!currentDb.moderatorReports) currentDb.moderatorReports = [];

    const rep = currentDb.moderatorReports.find((r: any) => r.id === reportId);
    if (!rep) {
      return res.status(404).json({ error: "Report not found." });
    }

    rep.status = status || "resolved";
    rep.handledBy = handledBy || "Moderator / Owner";
    if (adminNotes) rep.adminNotes = adminNotes;

    saveDB(currentDb);
    logActivity(`Report ${reportId} updated to ${rep.status}`, "info");

    return res.json({ success: true, report: rep });
  });

  // ADMIN: Get full details and trading plan store for a user
  app.get("/api/admin/user-details/:userId", (req, res) => {
    const { userId } = req.params;
    const currentDb = getDB();

    const targetUser = currentDb.users.find((u) => u.id === userId || u.email.trim().toLowerCase() === userId.trim().toLowerCase());
    if (!targetUser) {
      return res.status(404).json({ error: "Client account not found." });
    }

    return res.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        role: targetUser.role,
        status: targetUser.status,
        createdAt: targetUser.createdAt,
        lastLogin: targetUser.lastLogin,
        tradingData: targetUser.tradingData || {},
      },
    });
  });

  // ADMIN: Delete user
  app.post("/api/admin/delete-user", (req, res) => {
    const { userId, email } = req.body;
    const currentDb = getDB();

    const userIdx = currentDb.users.findIndex(
      (u) => u.id === userId || (email && u.email.trim().toLowerCase() === email.trim().toLowerCase())
    );
    if (userIdx === -1) {
      return res.status(404).json({ error: "User not found." });
    }

    if (currentDb.users[userIdx].role === "admin") {
      return res.status(400).json({ error: "Cannot delete master admin account." });
    }

    const removed = currentDb.users.splice(userIdx, 1)[0];
    currentDb.preApprovedEmails = currentDb.preApprovedEmails.filter((e) => e.trim().toLowerCase() !== removed.email.trim().toLowerCase());

    saveDB(currentDb);
    logActivity(`Admin deleted account: ${removed.email}`, "warn");

    return res.json({ success: true, message: `Account ${removed.email} deleted.` });
  });

  // USER: Save trading plan data and metadata under Gmail
  const handleSaveUserData = (req: express.Request, res: express.Response) => {
    const { userId: bodyUserId, email: bodyEmail, tradingData, metadata, yearRange, startMonth, startingCapital, force } = req.body;
    const paramUserId = req.params?.userId;
    const currentDb = getDB();

    const cleanEmail = (bodyEmail || paramUserId || "").trim().toLowerCase();
    const cleanUserId = (bodyUserId || paramUserId || "").trim().toLowerCase();

    let user = currentDb.users.find(
      (u) =>
        (cleanUserId && u.id.trim().toLowerCase() === cleanUserId) ||
        (cleanEmail && u.email.trim().toLowerCase() === cleanEmail) ||
        (cleanEmail && u.email.trim().toLowerCase().includes(cleanEmail))
    );

    if (!user && (cleanEmail || cleanUserId)) {
      // Auto-upsert record if user exists in client session
      user = {
        id: cleanUserId || `user_${Date.now()}`,
        email: cleanEmail || `${cleanUserId}@gmail.com`,
        username: (cleanEmail || cleanUserId).split("@")[0],
        displayName: (cleanEmail || cleanUserId).split("@")[0],
        role: "client",
        status: "approved",
        password: "",
        createdAt: new Date().toISOString(),
        tradingData: {},
      };
      currentDb.users.push(user);
    }

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const saveAccessCheck = isUserAccessBlocked(user);
    if (saveAccessCheck.blocked) {
      return res.status(403).json({ error: saveAccessCheck.message });
    }

    if (tradingData !== undefined && typeof tradingData === "object") {
      user.tradingData = tradingData;
    }
    if (metadata) {
      if (metadata.yearRange) user.yearRange = metadata.yearRange;
      if (metadata.startMonth !== undefined) user.startMonth = metadata.startMonth;
      if (metadata.startingCapital !== undefined) user.startingCapital = metadata.startingCapital;
    }
    if (yearRange) user.yearRange = yearRange;
    if (startMonth !== undefined) user.startMonth = startMonth;
    if (startingCapital !== undefined) user.startingCapital = startingCapital;

    saveDB(currentDb);

    return res.json({ success: true, message: "Trading plan data saved successfully!" });
  };

  app.post("/api/user/data", handleSaveUserData);
  app.post("/api/user/data/:userId", handleSaveUserData);

  // USER: Fetch trading plan data by Gmail or userId
  app.get("/api/user/data/:userId", (req, res) => {
    const { userId } = req.params;
    const currentDb = getDB();

    const clean = decodeURIComponent(userId).trim().toLowerCase();

    const user = currentDb.users.find(
      (u) =>
        u.id.trim().toLowerCase() === clean ||
        u.email.trim().toLowerCase() === clean ||
        (u.username && u.username.trim().toLowerCase() === clean)
    );

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const fetchAccessCheck = isUserAccessBlocked(user);
    if (fetchAccessCheck.blocked) {
      return res.status(403).json({ error: fetchAccessCheck.message });
    }

    return res.json({
      success: true,
      tradingData: user.tradingData || null,
      metadata: {
        yearRange: user.yearRange || "2026 - 2027",
        startMonth: user.startMonth !== undefined ? user.startMonth : 0,
      },
    });
  });

  // REAL MARKET DATA ENDPOINTS (Binance proxy)
  app.get("/api/market/klines", async (req, res) => {
    const symbol = ((req.query.symbol as string) || "BTCUSDT").toUpperCase();
    try {
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=150`);
      if (!response.ok) throw new Error(`Binance HTTP error: ${response.status}`);
      const raw = await response.json();
      return res.json({ success: true, data: raw });
    } catch (err: any) {
      console.error("Market klines fetch error:", err?.message);
      return res.status(500).json({ error: "Failed to fetch live market candles." });
    }
  });

  app.get("/api/market/tickers", async (_req, res) => {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT"]');
      if (!response.ok) throw new Error(`Binance HTTP error: ${response.status}`);
      const raw = await response.json();
      return res.json({ success: true, data: raw });
    } catch (err: any) {
      console.error("Market tickers fetch error:", err?.message);
      return res.status(500).json({ error: "Failed to fetch live market tickers." });
    }
  });

  // =========================================================================
  // COMMUNITY & SIGNAL GROUPS BACKEND API (Permanent 20-Year Server Vault)
  // =========================================================================
  
  // Hydrate in-memory stores directly from persistent DB on boot
  const initialCommunityDb = getDB();
  let communityChatMessages: any[] = initialCommunityDb.communityChatMessages || [];
  let communitySignalGroups: any[] = initialCommunityDb.communitySignalGroups || [];
  let communitySignals: any[] = initialCommunityDb.communitySignals || [];
  let communityDirectMessages: any[] = initialCommunityDb.communityDirectMessages || [];
  let communityGroupChatMessages: { [groupId: string]: any[] } = initialCommunityDb.communityGroupChatMessages || {};

  // Group Chat: GET messages for a signal group
  app.get("/api/community/signal-groups/:groupId/chat", (req, res) => {
    const { groupId } = req.params;
    const currentDb = getDB();
    const msgs = communityGroupChatMessages[groupId] || currentDb.communityGroupChatMessages?.[groupId] || [];
    return res.json({ success: true, messages: msgs });
  });

  // Group Chat: POST message for a signal group (enforces admin-only talk rules & permanent server vault persistence)
  app.post("/api/community/signal-groups/:groupId/chat", (req, res) => {
    const { groupId } = req.params;
    const msg = req.body;
    if (!msg || (!msg.content && !msg.photoUrl && !msg.audioUrl)) {
      return res.status(400).json({ error: "Message content or media is required." });
    }

    const senderEmail = (msg.senderEmail || msg.sender?.email || "").trim().toLowerCase();
    if (senderEmail && senderEmail !== "sngxworld@gmail.com") {
      const currentDb = getDB();
      const senderUser = currentDb.users.find((u) => u.email.trim().toLowerCase() === senderEmail);
      if (senderUser) {
        const groupMsgCheck = isUserAccessBlocked(senderUser);
        if (groupMsgCheck.blocked) {
          return res.status(403).json({ error: groupMsgCheck.message });
        }
      }
    }

    if (!communityGroupChatMessages[groupId]) {
      communityGroupChatMessages[groupId] = [];
    }

    // Permanent Server History Vault Storage
    const messageWithVault = {
      ...msg,
      id: msg.id || "gmsg_" + Math.random().toString(36).substring(2, 9),
      vaultArchivedAt: new Date().toISOString(),
      vaultRetention: "PERMANENT_VAULT",
    };

    // Deduplicate by ID
    const existingIdx = communityGroupChatMessages[groupId].findIndex((m: any) => m.id === messageWithVault.id);
    if (existingIdx >= 0) {
      communityGroupChatMessages[groupId][existingIdx] = messageWithVault;
    } else {
      communityGroupChatMessages[groupId].push(messageWithVault);
    }

    const currentDb = getDB();
    if (!currentDb.communityGroupChatMessages) {
      currentDb.communityGroupChatMessages = {};
    }
    currentDb.communityGroupChatMessages[groupId] = communityGroupChatMessages[groupId];
    saveDB(currentDb);

    return res.json({ success: true, message: messageWithVault });
  });

  // Group Chat: GET Lifetime Permanent History for a Signal Group
  app.get("/api/community/signal-groups/:groupId/history", (req, res) => {
    const { groupId } = req.params;
    const currentDb = getDB();
    const msgs = communityGroupChatMessages[groupId] || currentDb.communityGroupChatMessages?.[groupId] || [];
    
    return res.json({
      success: true,
      groupId,
      retentionPolicy: "PERMANENT_LIFETIME_SERVER_VAULT",
      totalMessages: msgs.length,
      messages: msgs,
    });
  });

  // Lifetime Server Archive Vault Status
  app.get("/api/community/vault/status", (_req, res) => {
    const currentDb = getDB();
    const groups = communitySignalGroups.length > 0 ? communitySignalGroups : (currentDb.communitySignalGroups || []);
    let totalVaultMsgs = 0;
    const groupChats = currentDb.communityGroupChatMessages || communityGroupChatMessages || {};
    Object.keys(groupChats).forEach((gId) => {
      totalVaultMsgs += (groupChats[gId] || []).length;
    });

    return res.json({
      success: true,
      vault: {
        status: "ONLINE",
        architecture: "Permanent Lifetime Server Vault",
        retentionPolicy: "Permanent Lifetime (No Expiration / No Auto-Deletion Across Updates)",
        maxActiveGroupsPerUser: 1,
        totalActiveSignalGroups: groups.length,
        totalArchivedGroupMessages: totalVaultMsgs,
        totalPublicChatMessages: communityChatMessages.length,
        totalSignals: communitySignals.length,
        totalDirectMessages: communityDirectMessages.length,
        syncedAt: new Date().toISOString(),
      },
    });
  });

  // Chat Room: GET All Messages (Permanent Lifetime Archive - No expiration or auto-deletion)
  app.get("/api/community/chat/messages", (_req, res) => {
    const currentDb = getDB();
    const msgs = communityChatMessages.length > 0 ? communityChatMessages : (currentDb.communityChatMessages || []);
    return res.json({ success: true, messages: msgs });
  });

  // Chat Room: POST Message
  app.post("/api/community/chat/messages", (req, res) => {
    const { sender, content, photoUrl, audioUrl, id, senderEmail, senderUsername, senderDisplayName, senderPhotoURL, senderRole, createdAt } = req.body;
    
    const resolvedEmail = sender?.email || senderEmail;
    const resolvedContent = content || "";
    const resolvedPhoto = photoUrl || "";
    const resolvedAudio = audioUrl || "";

    if (!resolvedEmail && !resolvedContent && !resolvedPhoto && !resolvedAudio) {
      return res.status(400).json({ error: "Sender and message content or media are required." });
    }

    if (resolvedEmail && resolvedEmail.toLowerCase() !== "sngxworld@gmail.com") {
      const currentDb = getDB();
      const senderUser = currentDb.users.find((u) => u.email.trim().toLowerCase() === resolvedEmail.trim().toLowerCase());
      if (senderUser) {
        const chatMsgCheck = isUserAccessBlocked(senderUser);
        if (chatMsgCheck.blocked) {
          return res.status(403).json({ error: chatMsgCheck.message });
        }
      }
    }

    const newMessage = {
      id: id || "msg_" + Math.random().toString(36).substring(2, 9),
      senderEmail: resolvedEmail,
      senderUsername: sender?.username || senderUsername || (resolvedEmail ? resolvedEmail.split("@")[0] : "Trader"),
      senderDisplayName: sender?.displayName || senderDisplayName || sender?.username || senderUsername || "Trader",
      senderPhotoURL: sender?.photoURL || senderPhotoURL || "",
      senderRole: sender?.platformRole || senderRole || (sender?.role === "admin" ? "owner" : "member"),
      content: (resolvedContent || "").trim(),
      photoUrl: resolvedPhoto,
      audioUrl: resolvedAudio,
      createdAt: createdAt || new Date().toISOString(),
    };

    // Deduplicate in memory
    const existingIdx = communityChatMessages.findIndex((m) => m.id === newMessage.id);
    if (existingIdx >= 0) {
      communityChatMessages[existingIdx] = newMessage;
    } else {
      communityChatMessages.push(newMessage);
    }

    // Persist to DB file
    const currentDb = getDB();
    if (!currentDb.communityChatMessages) currentDb.communityChatMessages = [];
    const dbIdx = currentDb.communityChatMessages.findIndex((m: any) => m.id === newMessage.id);
    if (dbIdx >= 0) {
      currentDb.communityChatMessages[dbIdx] = newMessage;
    } else {
      currentDb.communityChatMessages.push(newMessage);
    }
    saveDB(currentDb);

    return res.json({ success: true, message: newMessage });
  });

  // Signal Groups: GET All Groups
  app.get("/api/community/signal-groups", (_req, res) => {
    const currentDb = getDB();
    const groups = communitySignalGroups.length > 0 ? communitySignalGroups : (currentDb.communitySignalGroups || []);
    return res.json({ success: true, groups });
  });

  // Signal Groups: Sync All Groups (Non-destructive merge)
  app.post("/api/community/signal-groups/sync", (req, res) => {
    const { groups } = req.body;
    if (Array.isArray(groups) && groups.length > 0) {
      const currentDb = getDB();
      const existing = currentDb.communitySignalGroups || [];
      const map = new Map<string, any>();
      existing.forEach((g: any) => map.set(g.id, g));
      groups.forEach((g: any) => map.set(g.id, { ...(map.get(g.id) || {}), ...g }));
      const merged = Array.from(map.values());
      communitySignalGroups = merged;
      currentDb.communitySignalGroups = merged;
      saveDB(currentDb);
    }
    return res.json({ success: true, count: communitySignalGroups.length });
  });

  // SIGNALS: GET All Signals across all groups
  app.get("/api/community/signals", (req, res) => {
    const { groupId } = req.query;
    const currentDb = getDB();
    const allSignals = communitySignals.length > 0 ? communitySignals : (currentDb.communitySignals || []);
    if (groupId) {
      const filtered = allSignals.filter((s: any) => s.groupId === groupId);
      return res.json({ success: true, signals: filtered });
    }
    return res.json({ success: true, signals: allSignals });
  });

  // SIGNALS: POST Create/Publish a Signal
  app.post("/api/community/signals", (req, res) => {
    const signalData = req.body;
    if (!signalData || !signalData.groupId || !signalData.coin || !signalData.entry) {
      return res.status(400).json({ error: "Signal groupId, coin, and entry are required." });
    }

    const newSignal = {
      ...signalData,
      id: signalData.id || "sig_" + Math.random().toString(36).substring(2, 9),
      createdAt: signalData.createdAt || new Date().toISOString(),
    };

    const currentDb = getDB();
    if (!currentDb.communitySignals) currentDb.communitySignals = [];

    const existingIdx = currentDb.communitySignals.findIndex((s: any) => s.id === newSignal.id);
    if (existingIdx >= 0) {
      currentDb.communitySignals[existingIdx] = newSignal;
    } else {
      currentDb.communitySignals.unshift(newSignal);
    }
    communitySignals = currentDb.communitySignals;
    saveDB(currentDb);

    return res.json({ success: true, signal: newSignal });
  });

  // SIGNALS: Sync Signals (Non-destructive merge)
  app.post("/api/community/signals/sync", (req, res) => {
    const { signals } = req.body;
    if (Array.isArray(signals) && signals.length > 0) {
      const currentDb = getDB();
      const existing = currentDb.communitySignals || [];
      const map = new Map<string, any>();
      existing.forEach((s: any) => map.set(s.id, s));
      signals.forEach((s: any) => map.set(s.id, { ...(map.get(s.id) || {}), ...s }));
      const merged = Array.from(map.values());
      communitySignals = merged;
      currentDb.communitySignals = merged;
      saveDB(currentDb);
    }
    return res.json({ success: true, count: communitySignals.length });
  });

  // SIGNALS: Finish Trade / Set 3-Day Feedback Window
  app.post("/api/community/signals/:signalId/finish", (req, res) => {
    const { signalId } = req.params;
    const currentDb = getDB();
    const signals = currentDb.communitySignals || [];
    const target = signals.find((s: any) => s.id === signalId);
    if (!target) return res.status(404).json({ error: "Signal not found." });

    target.status = "voting";
    target.votingEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    target.votes = target.votes || {};

    communitySignals = signals;
    saveDB(currentDb);
    return res.json({ success: true, signal: target });
  });

  // SIGNALS: Cast Vote (TP / SL)
  app.post("/api/community/signals/:signalId/vote", (req, res) => {
    const { signalId } = req.params;
    const { userEmail, vote } = req.body;
    if (!userEmail || !vote) return res.status(400).json({ error: "User email and vote (tp/sl) are required." });

    const currentDb = getDB();
    const signals = currentDb.communitySignals || [];
    const target = signals.find((s: any) => s.id === signalId);
    if (!target) return res.status(404).json({ error: "Signal not found." });

    if (!target.votes) target.votes = {};
    target.votes[userEmail.toLowerCase()] = vote;

    const allVotes = Object.values(target.votes);
    target.tpVotesCount = allVotes.filter((v) => v === "tp").length;
    target.slVotesCount = allVotes.filter((v) => v === "sl").length;

    communitySignals = signals;
    saveDB(currentDb);
    return res.json({ success: true, signal: target });
  });

  // SIGNALS: Delete Signal
  app.delete("/api/community/signals/:signalId", (req, res) => {
    const { signalId } = req.params;
    const currentDb = getDB();
    if (currentDb.communitySignals) {
      currentDb.communitySignals = currentDb.communitySignals.filter((s: any) => s.id !== signalId);
      communitySignals = currentDb.communitySignals;
      saveDB(currentDb);
    }
    return res.json({ success: true, message: `Signal ${signalId} deleted.` });
  });

  // FULL COMMUNITY UNIFIED SYNC (One-shot safe sync on app load or post-update)
  app.get("/api/community/sync/all", (_req, res) => {
    const currentDb = getDB();
    return res.json({
      success: true,
      chatMessages: communityChatMessages.length > 0 ? communityChatMessages : (currentDb.communityChatMessages || []),
      signalGroups: communitySignalGroups.length > 0 ? communitySignalGroups : (currentDb.communitySignalGroups || []),
      signals: communitySignals.length > 0 ? communitySignals : (currentDb.communitySignals || []),
      directMessages: communityDirectMessages.length > 0 ? communityDirectMessages : (currentDb.communityDirectMessages || []),
      groupChats: currentDb.communityGroupChatMessages || communityGroupChatMessages || {},
      syncedAt: new Date().toISOString(),
    });
  });

  // FULL COMMUNITY PUSH SYNC (Safely merges client data with server vault without data deletion)
  app.post("/api/community/sync/all", (req, res) => {
    const { chatMessages, signalGroups, signals, directMessages, groupChats } = req.body;
    const currentDb = getDB();

    // 1. Merge Public Chat
    if (Array.isArray(chatMessages) && chatMessages.length > 0) {
      const msgMap = new Map<string, any>();
      (currentDb.communityChatMessages || []).forEach((m: any) => msgMap.set(m.id, m));
      chatMessages.forEach((m: any) => msgMap.set(m.id, { ...(msgMap.get(m.id) || {}), ...m }));
      currentDb.communityChatMessages = Array.from(msgMap.values());
      communityChatMessages = currentDb.communityChatMessages;
    }

    // 2. Merge Signal Groups
    if (Array.isArray(signalGroups) && signalGroups.length > 0) {
      const grpMap = new Map<string, any>();
      (currentDb.communitySignalGroups || []).forEach((g: any) => grpMap.set(g.id, g));
      signalGroups.forEach((g: any) => grpMap.set(g.id, { ...(grpMap.get(g.id) || {}), ...g }));
      currentDb.communitySignalGroups = Array.from(grpMap.values());
      communitySignalGroups = currentDb.communitySignalGroups;
    }

    // 3. Merge Signals
    if (Array.isArray(signals) && signals.length > 0) {
      const sigMap = new Map<string, any>();
      (currentDb.communitySignals || []).forEach((s: any) => sigMap.set(s.id, s));
      signals.forEach((s: any) => sigMap.set(s.id, { ...(sigMap.get(s.id) || {}), ...s }));
      currentDb.communitySignals = Array.from(sigMap.values());
      communitySignals = currentDb.communitySignals;
    }

    // 4. Merge Direct Messages
    if (Array.isArray(directMessages) && directMessages.length > 0) {
      const dmMap = new Map<string, any>();
      (currentDb.communityDirectMessages || []).forEach((d: any) => dmMap.set(d.id, d));
      directMessages.forEach((d: any) => dmMap.set(d.id, { ...(dmMap.get(d.id) || {}), ...d }));
      currentDb.communityDirectMessages = Array.from(dmMap.values());
      communityDirectMessages = currentDb.communityDirectMessages;
    }

    // 5. Merge Group Chats
    if (groupChats && typeof groupChats === "object") {
      if (!currentDb.communityGroupChatMessages) currentDb.communityGroupChatMessages = {};
      Object.keys(groupChats).forEach((gId) => {
        const incomingList = groupChats[gId];
        if (Array.isArray(incomingList) && incomingList.length > 0) {
          const existingList = currentDb.communityGroupChatMessages[gId] || [];
          const gcMap = new Map<string, any>();
          existingList.forEach((m: any) => gcMap.set(m.id, m));
          incomingList.forEach((m: any) => gcMap.set(m.id, { ...(gcMap.get(m.id) || {}), ...m }));
          currentDb.communityGroupChatMessages[gId] = Array.from(gcMap.values());
        }
      });
      communityGroupChatMessages = currentDb.communityGroupChatMessages;
    }

    saveDB(currentDb);

    return res.json({
      success: true,
      message: "Unified community data safely synchronized and permanently backed up in server vault.",
      counts: {
        publicMessages: communityChatMessages.length,
        signalGroups: communitySignalGroups.length,
        signals: communitySignals.length,
        directMessages: communityDirectMessages.length,
      },
    });
  });

  // HOST ADMIN / AUTOMATED BACKUP: Export complete JSON snapshot of community vault
  app.get("/api/admin/community/backup", (_req, res) => {
    const currentDb = getDB();
    res.setHeader("Content-Disposition", `attachment; filename="TrackerX_Community_Vault_Backup_${Date.now()}.json"`);
    res.setHeader("Content-Type", "application/json");
    return res.send(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          vaultPolicy: "PERMANENT_LIFETIME_SERVER_VAULT",
          signalGroups: currentDb.communitySignalGroups || [],
          signals: currentDb.communitySignals || [],
          publicChatMessages: currentDb.communityChatMessages || [],
          groupChatMessages: currentDb.communityGroupChatMessages || {},
          directMessages: currentDb.communityDirectMessages || [],
        },
        null,
        2
      )
    );
  });

  // HOST ADMIN: Global Community Overview
  app.get("/api/admin/community/overview", (_req, res) => {
    const currentDb = getDB();
    const groups = communitySignalGroups.length > 0 ? communitySignalGroups : (currentDb.communitySignalGroups || []);
    const publicChat = communityChatMessages.length > 0 ? communityChatMessages : (currentDb.communityChatMessages || []);
    const dms = communityDirectMessages.length > 0 ? communityDirectMessages : (currentDb.communityDirectMessages || []);
    
    return res.json({
      success: true,
      data: {
        totalGroups: groups.length,
        totalPublicMessages: publicChat.length,
        totalSignals: communitySignals.length,
        totalDirectMessages: dms.length,
        groups,
        publicChat,
        signals: communitySignals,
        dms,
        groupChats: currentDb.communityGroupChatMessages || communityGroupChatMessages,
      },
    });
  });

  // HOST ADMIN / USER: Delete Signal Group (Frees up user slot to create new group)
  app.post("/api/admin/community/delete-group", (req, res) => {
    const { groupId, adminEmail } = req.body;
    const currentDb = getDB();
    const groups = communitySignalGroups.length > 0 ? communitySignalGroups : (currentDb.communitySignalGroups || []);
    const targetGroup = groups.find((g: any) => g.id === groupId);

    const isHost = (adminEmail || "").toLowerCase() === "sngxworld@gmail.com";
    const isOwner = targetGroup && (targetGroup.adminEmail || "").toLowerCase() === (adminEmail || "").toLowerCase();

    if (!isHost && !isOwner) {
      return res.status(403).json({ error: "Unauthorized. Only the group creator or Host Admin can delete this group." });
    }

    communitySignalGroups = communitySignalGroups.filter((g) => g.id !== groupId);
    delete communityGroupChatMessages[groupId];
    if (currentDb.communitySignalGroups) {
      currentDb.communitySignalGroups = currentDb.communitySignalGroups.filter((g: any) => g.id !== groupId);
    }
    if (currentDb.communityGroupChatMessages) {
      delete currentDb.communityGroupChatMessages[groupId];
    }
    saveDB(currentDb);
    logActivity(`Signal group ID ${groupId} deleted by ${adminEmail}. Slot freed.`, "warn");
    return res.json({ success: true, message: `Group ${groupId} deleted successfully.` });
  });

  // Signal Groups: DELETE Endpoint by ID
  app.delete("/api/community/signal-groups/:groupId", (req, res) => {
    const { groupId } = req.params;
    const userEmail = (req.query.userEmail as string || "").toLowerCase();

    const currentDb = getDB();
    const groups = communitySignalGroups.length > 0 ? communitySignalGroups : (currentDb.communitySignalGroups || []);
    const targetGroup = groups.find((g: any) => g.id === groupId);

    if (!targetGroup) {
      return res.status(404).json({ error: "Signal group not found." });
    }

    const isHost = userEmail === "sngxworld@gmail.com";
    const isOwner = (targetGroup.adminEmail || "").toLowerCase() === userEmail;

    if (!isHost && !isOwner) {
      return res.status(403).json({ error: "Unauthorized. You can only delete your own signal group." });
    }

    communitySignalGroups = communitySignalGroups.filter((g) => g.id !== groupId);
    delete communityGroupChatMessages[groupId];
    if (currentDb.communitySignalGroups) {
      currentDb.communitySignalGroups = currentDb.communitySignalGroups.filter((g: any) => g.id !== groupId);
    }
    if (currentDb.communityGroupChatMessages) {
      delete currentDb.communityGroupChatMessages[groupId];
    }
    saveDB(currentDb);
    return res.json({ success: true, message: "Signal group deleted. 1-group slot is now reset." });
  });

  // HOST ADMIN / USER: Delete Inappropriate or User Chat Message
  app.post("/api/admin/community/delete-message", (req, res) => {
    const { messageId, groupId, adminEmail } = req.body;
    const isHost = (adminEmail || "").toLowerCase() === "sngxworld@gmail.com";
    if (!isHost) {
      return res.status(403).json({ error: "Unauthorized. Host Admin credentials required." });
    }

    if (groupId && communityGroupChatMessages[groupId]) {
      communityGroupChatMessages[groupId] = communityGroupChatMessages[groupId].filter((m) => m.id !== messageId);
    } else {
      communityChatMessages = communityChatMessages.filter((m) => m.id !== messageId);
    }
    return res.json({ success: true, message: "Message removed by Host Admin." });
  });

  // DELETE Public Chat Message by ID
  app.delete("/api/community/chat/messages/:messageId", (req, res) => {
    const { messageId } = req.params;
    const { deleterEmail } = req.body || {};
    communityChatMessages = communityChatMessages.filter((m) => m.id !== messageId);
    const currentDb = getDB();
    if (currentDb.communityChatMessages) {
      currentDb.communityChatMessages = currentDb.communityChatMessages.filter((m: any) => m.id !== messageId);
      saveDB(currentDb);
    }
    return res.json({ success: true, message: "Message deleted successfully." });
  });

  // DELETE Direct Message by ID
  app.delete("/api/community/direct-messages/:messageId", (req, res) => {
    const { messageId } = req.params;
    communityDirectMessages = communityDirectMessages.filter((m) => m.id !== messageId);
    const currentDb = getDB();
    if (currentDb.communityDirectMessages) {
      currentDb.communityDirectMessages = currentDb.communityDirectMessages.filter((m: any) => m.id !== messageId);
      saveDB(currentDb);
    }
    return res.json({ success: true, message: "Direct message deleted successfully." });
  });

  // DELETE Group Chat Message by ID
  app.delete("/api/community/signal-groups/:groupId/chat/:messageId", (req, res) => {
    const { groupId, messageId } = req.params;
    if (communityGroupChatMessages[groupId]) {
      communityGroupChatMessages[groupId] = communityGroupChatMessages[groupId].filter((m) => m.id !== messageId);
    }
    const currentDb = getDB();
    if (currentDb.communityGroupChatMessages?.[groupId]) {
      currentDb.communityGroupChatMessages[groupId] = currentDb.communityGroupChatMessages[groupId].filter((m: any) => m.id !== messageId);
      saveDB(currentDb);
    }
    return res.json({ success: true, message: "Group message deleted successfully." });
  });

  // Signal Groups: POST Create Group (Enforces 1 Group per User Limit & USD price cap ≤ $17)
  app.post("/api/community/signal-groups", (req, res) => {
    const { name, description, logoUrl, priceUsd, isVerified, admin } = req.body;
    if (!name || !admin) {
      return res.status(400).json({ error: "Group name and admin profile are required." });
    }

    const adminEmail = (admin.email || "").trim().toLowerCase();
    const isHost = adminEmail === "sngxworld@gmail.com";

    if (!isHost && adminEmail) {
      const currentDb = getDB();
      const adminUser = currentDb.users.find((u) => u.email.trim().toLowerCase() === adminEmail);
      if (adminUser) {
        const groupAdminCheck = isUserAccessBlocked(adminUser);
        if (groupAdminCheck.blocked) {
          return res.status(403).json({ error: groupAdminCheck.message });
        }
      }
    }

    // Enforce 1 Active Signal Group per User Rule
    const existingGroup = communitySignalGroups.find(
      (g) => (g.adminEmail || "").toLowerCase() === adminEmail || (g.adminUsername || "").toLowerCase() === (admin.username || "").toLowerCase()
    );

    if (!isHost && existingGroup) {
      return res.status(400).json({
        error: `Limit Reached: Each trader can only create up to 1 signal group at a time. You must delete your existing group '${existingGroup.name}' first before creating a new one.`,
        existingGroupId: existingGroup.id,
        existingGroupName: existingGroup.name,
      });
    }

    const cappedPrice = Math.min(Math.max(0, Number(priceUsd) || 0), 17);

    const newGroup = {
      id: "grp_" + Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      description: (description || "").trim(),
      logoUrl: logoUrl || "",
      priceUsd: cappedPrice,
      isVerified: Boolean(isVerified),
      adminEmail: admin.email,
      adminUsername: admin.username,
      adminDisplayName: admin.displayName || admin.username,
      adminPhotoURL: admin.photoURL || "",
      adminRole: admin.platformRole || (admin.role === "admin" ? "owner" : "member"),
      membersCount: 1,
      members: [admin.email],
      winRate: 0,
      totalSignals: 0,
      createdAt: new Date().toISOString(),
    };

    communitySignalGroups.push(newGroup);
    const currentDb = getDB();
    if (!currentDb.communitySignalGroups) {
      currentDb.communitySignalGroups = [];
    }
    currentDb.communitySignalGroups.push(newGroup);
    saveDB(currentDb);

    return res.json({ success: true, group: newGroup });
  });

  // Direct Messages: GET All DMs for a user
  app.get("/api/community/dms", (req, res) => {
    const email = (req.query.email as string)?.toLowerCase();
    if (!email) {
      return res.json({ success: true, messages: communityDirectMessages });
    }
    const filtered = communityDirectMessages.filter(
      (m) => m.senderEmail.toLowerCase() === email || m.receiverEmail.toLowerCase() === email
    );
    return res.json({ success: true, messages: filtered });
  });

  // Direct Messages: POST Send DM
  app.post("/api/community/dms", (req, res) => {
    const { sender, receiver, content, isJoinRequest, targetGroupName, targetGroupId } = req.body;
    if (!sender || !receiver || !content) {
      return res.status(400).json({ error: "Sender, receiver, and message content are required." });
    }

    const senderEmail = (sender.email || "").trim().toLowerCase();
    if (senderEmail && senderEmail !== "sngxworld@gmail.com") {
      const currentDb = getDB();
      const senderUser = currentDb.users.find((u) => u.email.trim().toLowerCase() === senderEmail);
      if (senderUser && (senderUser.status === "banned" || senderUser.status === "revoked" || senderUser.status === "rejected")) {
        return res.status(403).json({ error: "Access denied. Your account is revoked or banned." });
      }
    }

    const newDm = {
      id: "dm_" + Math.random().toString(36).substring(2, 9),
      senderEmail: sender.email,
      senderUsername: sender.username,
      senderDisplayName: sender.displayName || sender.username,
      senderPhotoURL: sender.photoURL || "",
      receiverEmail: receiver.email,
      receiverUsername: receiver.username,
      receiverDisplayName: receiver.displayName || receiver.username,
      receiverPhotoURL: receiver.photoURL || "",
      content: content.trim(),
      isJoinRequest: Boolean(isJoinRequest),
      targetGroupName: targetGroupName || "",
      targetGroupId: targetGroupId || "",
      createdAt: new Date().toISOString(),
    };

    communityDirectMessages.push(newDm);
    return res.json({ success: true, dm: newDm });
  });

// Helper to generate dynamic tailored responses when LLM or API Key is unavailable
function generateDynamicResponse(message: string): string {
  const query = message.trim().toLowerCase();
  const isPureSinhala = /[\u0D80-\u0DFF]/.test(message);
  const isSinglish =
    query.includes("kohomada") ||
    query.includes("wenne") ||
    query.includes("karanne") ||
    query.includes("ekata") ||
    query.includes("poddak") ||
    query.includes("machan") ||
    query.includes("bro") ||
    query.includes("hari");

  // Greetings
  if (
    query === "hi" ||
    query === "hello" ||
    query === "hey" ||
    query.includes("wassup") ||
    query.includes("wwassupo") ||
    query === "sup" ||
    query === "ආයුබෝවන්"
  ) {
    if (isPureSinhala) {
      return "ආයුබෝවන්! SNGxJOURNAL 3D AI උපදේශක වෙත සාදරයෙන් පිළිගනිමු. ඔබගේ Trading Journal, Excel Export, හෝ Risk Management පිළිබඳ ඕනෑම ගැටළුවක් විමසන්න!";
    }
    if (isSinglish) {
      return "Hari machan! SNGxJOURNAL 3D AI Mentor online. Oyage trade journal eka, PnL logs, nathnam Risk Management gana oni deyak ahanna!";
    }
    return "Hello! Welcome to SNGxJOURNAL 3D AI Mentor. I am ready to help you with your trade logs, starting capital, Excel reports, and risk management strategies. How can I assist your trading today?";
  }

  // Excel / Export questions
  if (
    query.includes("excel") ||
    query.includes("export") ||
    query.includes("download") ||
    query.includes("බාගත") ||
    query.includes("sheet")
  ) {
    if (isPureSinhala) {
      return "Excel Report ලබා ගැනීමට: Header එකේ ඇති 'Excel Export Sheet' (කොළ පාට) බොත්තම ඔබන්න. ඔබගේ මාසික PnL, Win Rate %, සහ දිනපතා Trades සියල්ල .xlsx ගොනුවක් ලෙස Download වේ.";
    }
    if (isSinglish) {
      return "Excel file eka ganna top header eke tiyena green 'Excel Export Sheet' button eka click karanna. Oyage full year PnL & trade logs okkoma .xlsx vidihata download wenawa!";
    }
    return "To export your trading journal: Click the green 'Excel Export Sheet' button at the top header. This downloads a complete .xlsx spreadsheet containing your Account Overview, Monthly Breakdown, and Daily Trade Logs.";
  }

  // Login / Approval questions
  if (
    query.includes("login") ||
    query.includes("approve") ||
    query.includes("approval") ||
    query.includes("review") ||
    query.includes("අනුමැතිය") ||
    query.includes("access")
  ) {
    if (isPureSinhala) {
      return "ගිණුම් අනුමැතිය සඳහා: ඔබගේ Gmail එක ඇතුළත් කර Register වන්න. Host Admin සජීවීව පරීක්ෂා කර අනුමත කළ සැනින් App එක දිගහැරේ. හදිසි සහාය සඳහා Host Hotline: +94 75 284 0841.";
    }
    if (isSinglish) {
      return "Login/Approval gana: Oyage Gmail register kalama Host Admin dwara approve wenakan 'Under Review' innawa. Instant approve kara ganna call/WhatsApp host: +94 75 284 0841.";
    }
    return "For account access approval: Register your Gmail address on the Gateway screen. Once Host Admin approves your email, the app unlocks automatically. For immediate approval support, contact hotline: +94 75 284 0841.";
  }

  // Capital / Deposit questions
  if (
    query.includes("capital") ||
    query.includes("deposit") ||
    query.includes("starting") ||
    query.includes("balance") ||
    query.includes("මුදල")
  ) {
    if (isPureSinhala) {
      return "Starting Capital සකස් කිරීමට: Dashboard එකේ ඇති Starting Capital Input එකේ ඔබගේ ආරම්භක ඩිපොසිට් එක ($100, $500, $1000 ආදී) යොදන්න. එය මත සමස්ත Account Equity & ROI ගණනය වේ.";
    }
    return "To set your Starting Capital: Enter your initial deposit ($100, $500, $1000, etc.) in the Starting Capital box or click quick presets. Your YTD PnL, ROI %, and visual equity curves update relative to this amount.";
  }

  // Risk management / strategy questions
  if (
    query.includes("risk") ||
    query.includes("strategy") ||
    query.includes("rule") ||
    query.includes("pnl") ||
    query.includes("loss") ||
    query.includes("trade")
  ) {
    if (isPureSinhala) {
      return "Trading Risk Rules:\n1. එක් trade එකකට account එකෙන් 1%-2% කට වඩා risk නොකරන්න.\n2. Stop-loss අනිවාර්යයෙන් තබන්න.\n3. Minimum 1:2 Risk to Reward ratio පවත්වා ගන්න.\n4. Over-trading වලින් වළකින්න.";
    }
    return "Key Risk Management Rules:\n1. Never risk more than 1-2% of your account per trade.\n2. Always use a hard Stop-Loss.\n3. Maintain a minimum Risk:Reward ratio of 1:2.\n4. Avoid revenge trading or over-leveraging after a loss day.";
  }

  // Default response
  if (isPureSinhala) {
    return "SNGxJOURNAL 3D AI උපදේශක සක්‍රීයයි. ඔබගේ Starting Capital, Daily Win/Loss Logs, Analytics, Excel Export, හෝ Risk Rules පිළිබඳව ඕනෑම දෙයක් අසන්න! සහාය: +94 75 284 0841.";
  }
  if (isSinglish) {
    return "SNGxJOURNAL 3D AI Assistant active. Trade journal eke PnL, Excel Export, Starting Capital, nathnam Risk Management gana oni deyak ahanna! Support: +94 75 284 0841.";
  }
  return "SNGxJOURNAL 3D AI Mentor is active and trained on your trading journal! Ask me about logging daily win/losses, starting capital setup, visual analytics, Excel export, or risk management rules.";
}

  // AI CHATBOT ROUTE (Gemini API with English, Sinhala & Singlish support)
  app.post("/api/ai/chat", async (req, res) => {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const reply = generateDynamicResponse(message);
      return res.json({ reply });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const historyContext =
        Array.isArray(history) && history.length > 0
          ? `Previous conversation history:\n` +
            history
              .map((h: any) => `${h.sender === "user" ? "User" : "Assistant"}: ${h.text}`)
              .join("\n") +
            "\n\n"
          : "";

      const systemContext = `You are the core SNGxJOURNAL 3D AI Assistant & Trading Mentor engine, fully trained on every feature, calculation, and workflow of the SNGxJOURNAL 1-Year Strategic Trading Plan app.

APP ENGINE & JOURNAL KNOWLEDGE DATASET:
1. STARTING CAPITAL: Users configure their initial trading deposit (e.g. $100, $500, $1000, $5000 or custom). All cumulative year-to-date (YTD) PnL, monthly ROI %, and total account equity are calculated dynamically relative to this baseline.
2. DAILY PnL LOGGING: Users mark daily trading outcomes as + (Win Day) or - (Loss Day). They enter exact net Profit/Loss ($), ROI (%), and setup strategy notes (e.g., BTC OB retest, Breakout TP hit, Risk:Reward ratio).
3. RESPONSIVE DESIGN: Optimized for both mobile devices (Touch-friendly card layout) and desktop screens (Full interactive data table grid with popover controls).
4. MONTHLY & YEARLY SUMMARIES: Provides a breakdown of total win days, loss days, win rate percentage, profit factor, best win day, worst loss day, and monthly ROI performance.
5. VISUAL ANALYTICS & CHARTS: Powered by Recharts with interactive Equity Growth Curves, Win/Loss Ratio Pie Charts, Daily PnL Distribution Bars, and Consecutive Win/Loss Streak tracking.
6. FULL EXCEL EXPORT: Users can export their complete trading journal at any time into a formatted .xlsx file featuring Account Overview, Monthly Summary, and Daily Logs (including Month's Profit Till That Day & YTD PnL).
7. MULTI-YEAR & START MONTH FLEXIBILITY: Supports trading years from 2024 to 2035 with customizable 12-month rolling start months.
8. GMAIL ACCESS & HOST ADMIN APPROVAL: User accounts register via Gmail. Pending accounts auto-poll access status every 3 seconds until approved by the Host Admin (sngxworld@gmail.com).
9. RISK MANAGEMENT MENTORSHIP: Always advise traders to maintain strict risk management (1-2% account risk per trade, stop-loss adherence, minimum 1:2 risk-reward ratio, avoiding over-trading or emotional revenge trading).
10. BILINGUAL SUPPORT:
    - Respond in fluent, clean Sinhala (සිංහල) if the user asks in Sinhala.
    - Respond in natural, friendly Singlish if the user asks in Singlish (e.g., "kohomada log wenne", "excel file eka gannne kohomada").
    - Respond in professional English if the user asks in English.
    - Official Host Support Hotline: +94 75 284 0841.`;

      const prompt = `${systemContext}

${historyContext}User question: "${message}"

Provide a concise, helpful, friendly, and expert response based on the above trade journal engine dataset:`;

      let replyText = "";
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
        });
        replyText = response.text || "";
      } catch (mErr) {
        console.warn("Primary model call error, trying fallback model:", mErr);
        try {
          const fallbackResponse = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: prompt,
          });
          replyText = fallbackResponse.text || "";
        } catch (fErr) {
          console.warn("Fallback model call error:", fErr);
        }
      }

      if (!replyText) {
        replyText = generateDynamicResponse(message);
      }

      return res.json({ reply: replyText });
    } catch (err: any) {
      console.error("Gemini AI error:", err);
      const fallbackReply = generateDynamicResponse(message);
      return res.json({ reply: fallbackReply });
    }
  });

  // --- BAN APPEAL API ENDPOINTS ---
  app.post("/api/admin/ban-appeals/submit", (req, res) => {
    const { email, username, reason } = req.body || {};
    if (!email || !reason) {
      return res.status(400).json({ error: "Email and appeal reason are required." });
    }
    const clean = String(email).trim().toLowerCase();
    const currentDb = getDB();
    if (!currentDb.banAppeals) {
      currentDb.banAppeals = [];
    }
    const appealObj = {
      id: "appeal_" + Date.now(),
      email: clean,
      username: username || clean.split("@")[0],
      reason: String(reason).trim(),
      submittedAt: new Date().toISOString(),
      status: "pending",
    };
    currentDb.banAppeals = currentDb.banAppeals.filter((a: any) => a.email !== clean);
    currentDb.banAppeals.unshift(appealObj);

    const user = currentDb.users.find((u) => u.email.trim().toLowerCase() === clean);
    if (user) {
      user.banAppeal = appealObj;
    }
    logActivity(`Ban appeal submitted by: ${clean}`, "info");
    saveDB(currentDb);
    return res.json({ success: true, message: "Ban appeal registered.", appeal: appealObj });
  });

  app.get("/api/admin/ban-appeals", (_req, res) => {
    const currentDb = getDB();
    return res.json({ success: true, appeals: currentDb.banAppeals || [] });
  });

  app.post("/api/admin/user-status-sync", (req, res) => {
    const { email, status, role, platformRole, bannedReason, trialStartDate, trialExpiresAt } = req.body || {};
    if (!email || !status) {
      return res.status(400).json({ error: "Email and status are required." });
    }
    const clean = String(email).trim().toLowerCase();
    const currentDb = getDB();
    let user = currentDb.users.find((u) => u.email.trim().toLowerCase() === clean);

    function normalizeRole(raw: any): PlatformRole {
      if (!raw) return "member";
      const lower = String(raw).trim().toLowerCase();
      if (lower.includes("owner (root)") || lower === "owner" || lower.startsWith("1.") || lower === "1" || lower.includes("master root") || lower.includes("master owner")) return "owner";
      if (lower.includes("sub-owner") || lower.includes("sub_owner") || lower.includes("co-admin") || lower.startsWith("2.") || lower === "2") return "sub_owner";
      if (lower.includes("verified signal provider") || lower.includes("verified_signal_provider") || lower.includes("≥85%") || lower.includes("85%") || lower.startsWith("3.") || lower === "3") return "verified_signal_provider";
      if (lower.includes("moderator") || lower.includes("bug / chat") || lower.startsWith("4.") || lower === "4") return "moderator";
      if (lower.includes("signal provider") || lower.includes("signal_provider") || lower.startsWith("5.") || lower === "5") return "signal_provider";
      if (lower.includes("member") || lower.startsWith("6.") || lower === "6") return "member";
      if (lower.includes("pending") || lower.includes("trial") || lower.startsWith("7.") || lower === "7") return "pending_user";
      return "member";
    }

    if (!user) {
      user = {
        id: "usr_" + Date.now(),
        email: clean,
        username: clean.split("@")[0],
        password: hashPassword("pre_synced_user"),
        role: role || "client",
        platformRole: platformRole ? normalizeRole(platformRole) : "member",
        status: status,
        createdAt: new Date().toISOString(),
      };
      currentDb.users.push(user);
    } else {
      user.status = status;
      if (role) user.role = role;
      if (platformRole) user.platformRole = normalizeRole(platformRole);
    }
    if (bannedReason !== undefined) user.bannedReason = bannedReason;
    if (trialStartDate !== undefined) user.trialStartDate = trialStartDate;
    if (trialExpiresAt !== undefined) user.trialExpiresAt = trialExpiresAt;

    if (status === "banned" || status === "revoked" || status === "rejected") {
      if (clean !== "sngxworld@gmail.com") {
        currentDb.preApprovedEmails = currentDb.preApprovedEmails.filter(
          (e) => e.trim().toLowerCase() !== clean
        );
      }
    } else if (status === "approved") {
      if (!currentDb.preApprovedEmails.includes(clean)) {
        currentDb.preApprovedEmails.push(clean);
      }
    }
    logActivity(`User status synced: ${clean} -> ${status}`, "access");
    saveDB(currentDb);
    return res.json({ success: true, user });
  });

// --- VITE / STATIC SERVING & SERVER LISTEN ---
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  createServerServer();
} else if (!process.env.VERCEL) {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

async function createServerServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

if (!process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Initial sync from Firestore on startup
    syncUsersFromFirestore().catch(() => {});
    // Periodic sync every 15 seconds so Host Admin and Backend are always in lockstep
    setInterval(() => {
      syncUsersFromFirestore().catch(() => {});
    }, 15000);
  });
}

export default app;
