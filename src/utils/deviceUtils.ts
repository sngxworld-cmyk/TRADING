import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile } from "../types";

const DEVICE_ID_KEY = "sngx_device_id_v2";
const DEVICE_REG_EMAIL_KEY = "sngx_device_registered_email";
const DEVICE_REG_TIME_KEY = "sngx_device_registered_at";
const DEVICE_REG_FINGERPRINT_KEY = "sngx_device_fingerprint_v2";
const DEVICE_IS_MASTER_KEY = "sngx_is_admin_master_device";

/**
 * Generate a consistent browser/device fingerprint string
 */
function generateBrowserFingerprint(): string {
  try {
    const nav = window.navigator;
    const screen = window.screen;
    const components = [
      nav.userAgent || "",
      nav.language || "",
      nav.hardwareConcurrency || 4,
      screen.width + "x" + screen.height,
      screen.colorDepth || 24,
      Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    ];
    
    // Simple fast hash
    let hash = 0;
    const str = components.join("###");
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return "fp_" + Math.abs(hash).toString(36);
  } catch {
    return "fp_fallback_" + Math.random().toString(36).substring(2, 8);
  }
}

export const HOST_MASTER_KEY = "2009sng123@#";

/**
 * Check if the current device has Host Master Device status (unlimited registrations allowed)
 * Unlocked exclusively via the Master Key (2009sng123@#)
 */
export function isHostMasterDevice(): boolean {
  try {
    if (localStorage.getItem(DEVICE_IS_MASTER_KEY) === "true") return true;
  } catch {}
  return false;
}

/**
 * Mark or unmark this device as an unlimited master host device
 */
export function setHostMasterDevice(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(DEVICE_IS_MASTER_KEY, "true");
    } else {
      localStorage.removeItem(DEVICE_IS_MASTER_KEY);
    }
  } catch {}
}

/**
 * Get or create persistent unique device ID
 */
export function getDeviceId(): string {
  try {
    let devId = localStorage.getItem(DEVICE_ID_KEY);
    const fingerprint = generateBrowserFingerprint();
    
    if (!devId) {
      devId = "dev_" + fingerprint + "_" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(DEVICE_ID_KEY, devId);
      localStorage.setItem(DEVICE_REG_FINGERPRINT_KEY, fingerprint);
    }
    return devId;
  } catch {
    return "dev_default_" + generateBrowserFingerprint();
  }
}

export interface DeviceRegistrationInfo {
  deviceId: string;
  registeredEmail: string | null;
  registeredAt: string | null;
  isRegistered: boolean;
  isMasterDevice: boolean;
}

/**
 * Get locally cached device registration information
 */
export function getLocalDeviceRegistration(): DeviceRegistrationInfo {
  const deviceId = getDeviceId();
  const isMaster = isHostMasterDevice();
  try {
    const registeredEmail = localStorage.getItem(DEVICE_REG_EMAIL_KEY);
    const registeredAt = localStorage.getItem(DEVICE_REG_TIME_KEY);
    return {
      deviceId,
      registeredEmail: registeredEmail ? registeredEmail.trim().toLowerCase() : null,
      registeredAt,
      isRegistered: !!registeredEmail,
      isMasterDevice: isMaster,
    };
  } catch {
    return {
      deviceId,
      registeredEmail: null,
      registeredAt: null,
      isRegistered: false,
      isMasterDevice: isMaster,
    };
  }
}

/**
 * Record a device registration locally and in Firestore / server
 */
export async function recordDeviceRegistration(email: string, registeredAt?: string): Promise<void> {
  if (!email) return;
  const cleanEmail = email.trim().toLowerCase();
  const deviceId = getDeviceId();
  const regTimestamp = registeredAt || new Date().toISOString();
  const isMaster = isHostMasterDevice();

  if (isMaster) {
    setHostMasterDevice(true);
  }

  // Save locally
  try {
    localStorage.setItem(DEVICE_REG_EMAIL_KEY, cleanEmail);
    if (!localStorage.getItem(DEVICE_REG_TIME_KEY)) {
      localStorage.setItem(DEVICE_REG_TIME_KEY, regTimestamp);
    }
    if (isMaster) {
      localStorage.setItem(DEVICE_IS_MASTER_KEY, "true");
    }
  } catch (e) {
    console.warn("Local device save notice:", e);
  }

  // Save to Firestore /devices/{deviceId}
  try {
    await setDoc(
      doc(db, "devices", deviceId),
      {
        deviceId,
        email: cleanEmail,
        firstRegisteredAt: regTimestamp,
        updatedAt: new Date().toISOString(),
        fingerprint: generateBrowserFingerprint(),
        isMasterDevice: isMaster,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Firestore device sync notice:", err);
  }

  // Save to server API
  try {
    fetch("/api/device/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        email: cleanEmail,
        registeredAt: regTimestamp,
        isMasterDevice: isMaster,
      }),
    }).catch(() => {});
  } catch {}
}

/**
 * Verify if device is permitted to register with attemptEmail.
 * Strictly blocks multiple registrations on client devices, but grants UNLIMITED registrations for Host Master Devices (unlocked with key 2009sng123@#).
 */
export async function verifyDeviceRegistrationPermission(
  attemptEmail: string
): Promise<{ allowed: boolean; registeredEmail?: string; reason?: string; isMasterDevice?: boolean }> {
  const cleanAttempt = (attemptEmail || "").trim().toLowerCase();
  const isMasterDev = isHostMasterDevice();

  // Host Master Device (unlocked with Master Key 2009sng123@#) has UNLIMITED registration support
  if (isMasterDev) {
    setHostMasterDevice(true);
    return { allowed: true, isMasterDevice: true };
  }

  const deviceId = getDeviceId();
  const localReg = getLocalDeviceRegistration();

  // 1. Local check
  if (localReg.isRegistered && localReg.registeredEmail) {
    if (localReg.registeredEmail !== cleanAttempt) {
      return {
        allowed: false,
        registeredEmail: localReg.registeredEmail,
        reason: `Registration Limit: This device has already registered account (${localReg.registeredEmail}). Only 1 registration is allowed per device. Please log in or unlock device with Master Key.`,
      };
    }
  }

  // 2. Cloud Firestore check (protects against cleared local storage on same device fingerprint)
  try {
    const devSnap = await getDoc(doc(db, "devices", deviceId));
    if (devSnap.exists()) {
      const data = devSnap.data();
      if (data?.isMasterDevice) {
        setHostMasterDevice(true);
        return { allowed: true, isMasterDevice: true };
      }
      const boundEmail = (data?.email || "").trim().toLowerCase();
      if (boundEmail && boundEmail !== cleanAttempt) {
        // Cache locally for faster next rejection
        try {
          localStorage.setItem(DEVICE_REG_EMAIL_KEY, boundEmail);
          if (data.firstRegisteredAt) {
            localStorage.setItem(DEVICE_REG_TIME_KEY, data.firstRegisteredAt);
          }
        } catch {}

        return {
          allowed: false,
          registeredEmail: boundEmail,
          reason: `Registration Limit: This device is already linked to registered account (${boundEmail}). Only 1 registration is allowed per device.`,
        };
      }
    }
  } catch (e) {
    console.warn("Cloud device check notice:", e);
  }

  return { allowed: true };
}

/**
 * Check if the 5-day trial is expired for a given user or this device
 */
export function checkIsTrialExpired(user?: Partial<UserProfile> | null): boolean {
  if (!user) return false;
  // Admin role, approved accounts, or Host Master Device never expire
  if (
    user.role === "admin" ||
    user.status === "approved" ||
    isHostMasterDevice()
  ) {
    return false;
  }

  const trialDurationMs = 5 * 24 * 60 * 60 * 1000; // 5 days in ms
  const localReg = getLocalDeviceRegistration();

  // Pick the oldest known registration date between user object and device record
  let regTime = user.createdAt ? new Date(user.createdAt).getTime() : 0;
  if (localReg.registeredAt) {
    const devTime = new Date(localReg.registeredAt).getTime();
    if (!isNaN(devTime) && (regTime === 0 || devTime < regTime)) {
      regTime = devTime;
    }
  }

  if (regTime === 0) {
    regTime = Date.now();
  }

  return Date.now() - regTime >= trialDurationMs;
}
