import React, { useState, useRef } from "react";
import { UserProfile } from "../types";
import { updateUserProfileInFirestore } from "../lib/userStore";
import { RoleBadge } from "../utils/roleUtils";
import { User, Camera, Trash2, Check, X, LogOut, Phone, ShieldCheck, Sparkles, Tag, DollarSign, BookOpen, Calendar } from "lucide-react";
import { CountryPhoneInput } from "./CountryPhoneInput";

interface ProfileEditorModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: UserProfile) => void;
  onLogout: () => void;
}

export const ProfileEditorModal: React.FC<ProfileEditorModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
  onLogout,
}) => {
  const [displayName, setDisplayName] = useState(user.displayName || user.username || "");
  const [username, setUsername] = useState(user.username || "");
  const [photoURL, setPhotoURL] = useState(user.photoURL || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [dob, setDob] = useState(user.dob || "");
  const [bio, setBio] = useState(user.bio || "");
  const [tradingMarket, setTradingMarket] = useState(
    user.tradingMarket ||
    (["Crypto Market", "Forex Market", "Futures Market", "Stock Market"].includes(user.tradingPair || "")
      ? user.tradingPair!
      : "Crypto Market")
  );
  const [startingCapital, setStartingCapital] = useState(user.startingCapital || "$25,000");

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Photo File Upload & Compression to Base64
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg("Image file size must be less than 8MB.");
      return;
    }

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress image to 250x250 max for light footprint
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 250;
        const MAX_HEIGHT = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setPhotoURL(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(false);

    try {
      const updated = await updateUserProfileInFirestore(user.email, {
        username: username.trim(),
        displayName: displayName.trim(),
        photoURL,
        phone: phone.trim(),
        dob: dob.trim(),
        bio: bio.trim(),
        tradingMarket: tradingMarket,
        tradingPair: tradingMarket,
        startingCapital: startingCapital.trim(),
      });

      onUserUpdated(updated);
      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Trader Profile & Account Settings
              </h2>
              <p className="text-xs text-blue-200/70">
                Manage your profile picture, bio, contact details & trading preferences
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSave} className="overflow-y-auto space-y-5 py-4 pr-1 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 text-blue-400" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {/* Profile Picture Upload Section (Concentric circular avatar) */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div className="relative group shrink-0">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={username}
                  className="w-20 h-20 aspect-square rounded-full object-cover border-2 border-blue-500 shadow-xl"
                />
              ) : (
                /* Perfectly Concentric Default Profile Logo */
                <div className="w-20 h-20 aspect-square rounded-full bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-slate-400 shadow-inner shrink-0">
                  <div className="w-12 h-12 aspect-square rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-blue-300 shrink-0 -translate-y-[0.5px]" />
                  </div>
                </div>
              )}

              {/* Upload Overlay Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium gap-1 cursor-pointer"
                title="Change Photo"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-sm font-bold text-white">{displayName || username}</span>
                <RoleBadge email={user.email} role={user.platformRole} size="xs" hideOnCompact={true} />
                {user.role === "admin" && (
                  <span className="text-[10px] bg-purple-950/50 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-purple-400" /> Host Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-200/70">
                Upload your picture for chat & Host Admin inspection.
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" /> Upload Photo
                </button>

                {photoURL && (
                  <button
                    type="button"
                    onClick={() => setPhotoURL("")}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Input Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                Full Name / Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                Username (@handle)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="trader_pro"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                Phone Number / Mobile
              </label>
              <CountryPhoneInput
                value={phone}
                onChange={setPhone}
                placeholder="e.g. 555-019-2834"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Date of Birth (DOB)
                </span>
                {dob && (
                  <span className="text-[10px] font-mono text-purple-300">
                    {new Date(dob + "T00:00:00").toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                )}
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-blue-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                Trading Market
              </label>
              <div className="relative">
                <Tag className="w-3.5 h-3.5 text-blue-400 absolute left-3 top-3 pointer-events-none" />
                <select
                  value={tradingMarket}
                  onChange={(e) => setTradingMarket(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono appearance-none cursor-pointer"
                >
                  <option value="Crypto Market">Crypto Market</option>
                  <option value="Forex Market">Forex Market</option>
                  <option value="Futures Market">Futures Market</option>
                  <option value="Stock Market">Stock Market</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
              Starting Capital Goal
            </label>
            <div className="relative">
              <DollarSign className="w-3.5 h-3.5 text-blue-400 absolute left-3 top-3" />
              <input
                type="text"
                value={startingCapital}
                onChange={(e) => setStartingCapital(e.target.value)}
                placeholder="$25,000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
              Trading Bio & Strategy Notes
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Price Action & ICT Judas Swing model. 1% max risk per setup. Focus on NY Morning Session."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Account Meta Badges */}
          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-blue-200/60 uppercase tracking-wider block text-[10px]">Email Account</span>
              <span className="text-white">{user.email}</span>
            </div>
            <div>
              <span className="text-blue-200/60 uppercase tracking-wider block text-[10px]">Access Status</span>
              <span className="text-purple-300 uppercase font-bold">{user.status}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700 transition-colors text-xs font-medium flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Log Out Session
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              >
                {saving ? "Saving..." : "Save Profile Details"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
