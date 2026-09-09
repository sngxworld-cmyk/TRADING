import React, { useState, useEffect, useRef } from "react";
import { createChart, CandlestickSeries, IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { Eye, EyeOff, Lock, Mail, User, ShieldCheck, Flame, TrendingUp, PhoneCall, ArrowRight, KeyRound, Camera, Phone, Tag, Calendar, MessageSquare, Sparkles, AlertCircle, Smartphone, CheckCircle, Unlock, RefreshCw, Send } from "lucide-react";
import { UserProfile } from "../types";
import { registerUserInFirestore, loginUserInFirestore, sendVerificationCode, verifyAuthCode, changeUserPassword, checkIfEmailOrUserExists, safeFetchJson } from "../lib/userStore";
import { getLocalDeviceRegistration, verifyDeviceRegistrationPermission, isHostMasterDevice, setHostMasterDevice, checkIsTrialExpired } from "../utils/deviceUtils";
import { AuthLottieAnimation } from "./AuthLottieAnimation";
import { CountryPhoneInput } from "./CountryPhoneInput";

interface GatewayScreenProps {
  onLoginSuccess: (user: UserProfile, isNewRegistration?: boolean) => void;
  onRegisteredPending: (user: UserProfile) => void;
}

export const GatewayScreen: React.FC<GatewayScreenProps> = ({
  onLoginSuccess,
  onRegisteredPending,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(() => getLocalDeviceRegistration());
  const [showAdminUnlockModal, setShowAdminUnlockModal] = useState(false);
  const [adminUnlockPin, setAdminUnlockPin] = useState("");
  const [adminUnlockMsg, setAdminUnlockMsg] = useState<string | null>(null);
  const [email, setEmail] = useState(() => {
    const dev = getLocalDeviceRegistration();
    return dev.registeredEmail || "";
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [bio, setBio] = useState("");
  const [tradingPair, setTradingPair] = useState("BTC/USDT");

  // 6-digit Verification Code state (Gmail only)
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationTarget, setVerificationTarget] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [isVerifiedSuccess, setIsVerifiedSuccess] = useState(false);

  // Forgot / Change Password Modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdent, setForgotIdent] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotStep, setForgotStep] = useState<"request" | "verify">("request");
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const regFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dev = getLocalDeviceRegistration();
    setDeviceInfo(dev);
    if (dev.registeredEmail && !email) {
      setEmail(dev.registeredEmail);
    }
  }, []);

  // Host Admin Master Device PIN / Code verification
  const handleUnlockMasterDevice = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = adminUnlockPin.trim();
    if (cleanPin === "2009sng123@#") {
      setHostMasterDevice(true);
      setDeviceInfo(getLocalDeviceRegistration());
      setAdminUnlockMsg("✅ Master Key Verified! This device is now marked as a Master Device with unlimited account registrations.");
      setTimeout(() => {
        setShowAdminUnlockModal(false);
        setAdminUnlockMsg(null);
        setAdminUnlockPin("");
      }, 1200);
    } else {
      setAdminUnlockMsg("❌ Invalid Master Key. Please enter the valid key.");
    }
  };

  // Handle Photo Upload during Registration
  const handleRegPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage("Image file must be under 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
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
          setPhotoURL(canvas.toDataURL("image/jpeg", 0.85));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Asset selection & Live Tickers
  const [selectedAsset, setSelectedAsset] = useState<"BTC" | "ETH" | "SOL">("BTC");
  const [liveTickers, setLiveTickers] = useState<{
    BTC: { price: number; change: number };
    ETH: { price: number; change: number };
    SOL: { price: number; change: number };
  }>({
    BTC: { price: 64050, change: 1.2 },
    ETH: { price: 3420, change: 0.8 },
    SOL: { price: 148, change: 2.5 },
  });

  // Chart refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);

  // Fetch Live Ticker Prices
  useEffect(() => {
    let isMounted = true;
    const fetchTickers = async () => {
      try {
        const res = await fetch("/api/market/tickers");
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && isMounted) {
          const newMap: any = {};
          data.data.forEach((t: any) => {
            const sym = t.symbol.replace("USDT", "") as "BTC" | "ETH" | "SOL";
            if (sym === "BTC" || sym === "ETH" || sym === "SOL") {
              newMap[sym] = {
                price: parseFloat(t.lastPrice) || 0,
                change: parseFloat(t.priceChangePercent) || 0,
              };
            }
          });
          if (Object.keys(newMap).length > 0) {
            setLiveTickers((prev) => ({ ...prev, ...newMap }));
          }
        }
      } catch (e) {}
    };

    fetchTickers();
    const interval = setInterval(fetchTickers, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Live Real Market Chart Stream
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart if present
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 320,
      height: container.clientHeight || 224,
      layout: {
        background: { color: "#0f172a" },
        textColor: "#94a3b8",
        attributionLogo: false,
      } as any,
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: { borderColor: "#334155", timeVisible: true },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    let ws: WebSocket | null = null;
    let isSubscribed = true;

    // Load initial 150 real market candles from backend / Binance API
    const loadRealKlines = async () => {
      const symbol = `${selectedAsset}USDT`;
      let historyData: any[] = [];

      try {
        const res = await fetch(`/api/market/klines?symbol=${symbol}`);
        const result = await res.json();

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          historyData = result.data.map((item: any) => ({
            time: Math.floor(item[0] / 1000) as UTCTimestamp,
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
          }));
        }
      } catch (err) {
        console.warn("Proxy klines error, fallback to direct fetch:", err);
      }

      if (historyData.length === 0) {
        try {
          const directRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=150`);
          const directData = await directRes.json();
          if (Array.isArray(directData) && directData.length > 0) {
            historyData = directData.map((item: any) => ({
              time: Math.floor(item[0] / 1000) as UTCTimestamp,
              open: parseFloat(item[1]),
              high: parseFloat(item[2]),
              low: parseFloat(item[3]),
              close: parseFloat(item[4]),
            }));
          }
        } catch (e) {}
      }

      // Guaranteed fallback generator if API call failed
      if (historyData.length === 0) {
        const now = Math.floor(Date.now() / 1000);
        let basePrice = selectedAsset === "BTC" ? 64000 : selectedAsset === "ETH" ? 3400 : 145;
        for (let i = 120; i >= 0; i--) {
          const time = (now - i * 60) as UTCTimestamp;
          const delta = (Math.random() - 0.49) * (basePrice * 0.002);
          const open = basePrice;
          const close = open + delta;
          const high = Math.max(open, close) + Math.random() * (basePrice * 0.001);
          const low = Math.min(open, close) - Math.random() * (basePrice * 0.001);
          basePrice = close;
          historyData.push({ time, open, high, low, close });
        }
      }

      if (!isSubscribed) return;

      if (historyData.length > 0) {
        series.setData(historyData);
        chart.timeScale().fitContent();

        const lastCandle = historyData[historyData.length - 1];
        setLiveTickers((prev) => ({
          ...prev,
          [selectedAsset]: {
            ...prev[selectedAsset],
            price: lastCandle.close,
          },
        }));
      }

      // Real-Time Live WebSocket Stream
      try {
        const wsUrl = `wss://stream.binance.com:9443/ws/${selectedAsset.toLowerCase()}usdt@kline_1m`;
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg && msg.k) {
              const k = msg.k;
              const candle = {
                time: Math.floor(k.t / 1000) as UTCTimestamp,
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
              };
              if (seriesRef.current) {
                seriesRef.current.update(candle);
              }
              setLiveTickers((prev) => ({
                ...prev,
                [selectedAsset]: {
                  ...prev[selectedAsset],
                  price: parseFloat(k.c),
                },
              }));
            }
          } catch (e) {}
        };
      } catch (e) {
        console.warn("WebSocket connection error:", e);
      }
    };

    loadRealKlines();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const width = chartContainerRef.current.clientWidth || 320;
        const height = chartContainerRef.current.clientHeight || 250;
        chartRef.current.applyOptions({
          width,
          height,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    // Initial resize check after layout renders
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      isSubscribed = false;
      if (ws) {
        ws.close();
      }
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [selectedAsset]);

  // Step 1: Trigger 6-digit code dispatch for Registration (Gmail only)
  const handleInitiateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMessage("Username must be at least 3 characters long.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address (e.g. name@gmail.com).");
      return;
    }

    if (!password || password.length < 4) {
      setErrorMessage("Password must be at least 4 characters.");
      return;
    }

    const cleanPhone = phone.trim();
    if (cleanPhone) {
      const phoneDigits = cleanPhone.replace(/\D/g, "");
      if (phoneDigits.length < 7 || phoneDigits.length > 15) {
        setErrorMessage("Please enter a valid phone number with 7 to 15 digits (e.g. +94 75 284 0841).");
        return;
      }
    }

    setLoading(true);

    try {
      // 0. Verify if this email or username is already registered before sending OTP
      const existCheck = await checkIfEmailOrUserExists(cleanEmail, cleanUsername);
      if (existCheck.exists) {
        setErrorMessage(existCheck.reason || "This email is already registered. Please switch to login.");
        setLoading(false);
        return;
      }

      // Enforce 1 registration per device check
      const devCheck = await verifyDeviceRegistrationPermission(cleanEmail);
      if (!devCheck.allowed) {
        setErrorMessage(devCheck.reason || "Registration Limit: Only 1 account registration is permitted per device.");
        setLoading(false);
        return;
      }

      setVerificationTarget(cleanEmail);

      // Send 6-digit OTP to Gmail with registration verification flag
      const res = await sendVerificationCode({ target: cleanEmail, email: cleanEmail, type: "email" as const, isRegistration: true });
      setIsVerifying(true);
      
      if (res.emailDelivered) {
        setSuccessMessage(`✅ 6-digit security code delivered to your Gmail (${cleanEmail}). Check your inbox & spam folder.`);
      } else if (res.emailError) {
        setErrorMessage(`Email dispatch notice: ${res.emailError}`);
      } else {
        setSuccessMessage(`A 6-digit code has been dispatched to your Gmail (${cleanEmail}).`);
      }
    } catch (err: any) {
      const msg = err?.message || "";
      const displayMsg = (msg && !msg.includes("JSON") && !msg.includes("Unexpected") && !msg.includes("token") && !msg.includes("SERVER_OFFLINE"))
        ? msg
        : "Failed to dispatch verification code. Please check your Gmail address and try again.";
      setErrorMessage(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirm 6-digit code and complete Firestore / Server registration
  const handleConfirmVerificationAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!verificationCode || verificationCode.trim().length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      
      // Verify code against server endpoint or Firestore
      let verified = false;
      try {
        const ok = await verifyAuthCode(cleanEmail, verificationCode.trim());
        if (ok) verified = true;
      } catch (e: any) {
        if (e.message && !e.message.includes("JSON") && !e.message.includes("Unexpected")) {
          throw e;
        }
      }

      if (!verified) {
        throw new Error("Invalid 6-digit verification code. Please check your Gmail inbox and try again.");
      }

      // Code is valid! Proceed with registration
      const newUser = await registerUserInFirestore({
        email,
        username,
        password,
        displayName: displayName || username,
        photoURL,
        phone,
        dob,
        bio,
        tradingPair,
      });

      // Also sync with server endpoint if backend is available
      safeFetchJson("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, displayName, photoURL, phone, dob, bio, tradingPair }),
      }).catch(() => {});

      setIsVerifiedSuccess(true);
      setSuccessMessage("✅ Verified! Account registered. Entering TrackerX...");
      setTimeout(() => {
        setIsVerifying(false);
        setIsVerifiedSuccess(false);
        onLoginSuccess(newUser, true);
      }, 1600);
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid 6-digit verification code. Please check your Gmail or click Resend Code.");
    } finally {
      setLoading(false);
    }
  };

  // Resend 6-digit OTP
  const handleResendCode = async () => {
    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setVerificationCode("");
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await sendVerificationCode({ target: cleanEmail, email: cleanEmail, type: "email" as const });
      if (res.emailDelivered) {
        setSuccessMessage(`✅ Fresh 6-digit code delivered to your Gmail (${cleanEmail}). Please check your inbox and spam folder.`);
      } else {
        setSuccessMessage(`A fresh 6-digit verification code has been dispatched to your Gmail (${cleanEmail}).`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Could not resend verification code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  // Login Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter your Gmail/Username and Password.");
      return;
    }

    setLoading(true);

    try {
      // Direct Firestore login
      const { user: loggedInUser } = await loginUserInFirestore(email, password);

      // Also sync with server endpoint if backend is available
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      }).catch(() => {});

      const isSuspended =
        loggedInUser.email.toLowerCase() !== "sngxworld@gmail.com" &&
        (loggedInUser.status === "revoked" ||
          loggedInUser.status === "banned" ||
          loggedInUser.status === "rejected");

      const isTrialOver =
        !isSuspended &&
        loggedInUser.status !== "approved" &&
        loggedInUser.role !== "admin" &&
        loggedInUser.platformRole !== "owner" &&
        checkIsTrialExpired(loggedInUser);

      if (isSuspended) {
        setSuccessMessage("Account access suspended / under review. Loading status portal...");
      } else if (isTrialOver) {
        setSuccessMessage("5-Day trial ended. Loading subscription portal...");
      } else {
        setSuccessMessage("Login successful! Entering TrackerX...");
      }
      setTimeout(() => onLoginSuccess(loggedInUser, false), 600);
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  // Request Forgot / Change Password Code
  const handleForgotRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    if (!forgotIdent.trim()) {
      setForgotMsg("Please enter your Gmail or Username.");
      return;
    }

    setLoading(true);
    try {
      await sendVerificationCode(forgotIdent.trim(), "email");
      setForgotStep("verify");
      setForgotMsg(`✅ 6-digit code sent to ${forgotIdent.trim()}`);
    } catch (err: any) {
      setForgotMsg(err.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Confirm Forgot Password & Apply New Password
  const handleForgotSubmitNewPass = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);

    if (!forgotCode || forgotCode.trim().length !== 6) {
      setForgotMsg("Please enter the 6-digit verification code.");
      return;
    }
    if (!forgotNewPass || forgotNewPass.trim().length < 6) {
      setForgotMsg("New password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await changeUserPassword({
        identifier: forgotIdent,
        newPassword: forgotNewPass,
        verificationCode: forgotCode,
      });

      setForgotSuccess(true);
      setForgotMsg("✅ Password reset successfully! You can now log in with your new password.");
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotSuccess(false);
        setForgotStep("request");
        setForgotCode("");
        setForgotNewPass("");
        setPassword(forgotNewPass);
      }, 1500);
    } catch (err: any) {
      setForgotMsg(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Glows (45% Blue, 5% Purple) */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-6xl z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Brand, Candlestick Chart & Market Tickers */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Header Title */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight text-white mb-2 inline-flex items-baseline font-mono select-none">
              <span>Tracker</span>
              <span className="text-5xl sm:text-7xl lg:text-8xl xl:text-9xl font-black text-blue-500 inline-block leading-none ml-1 sm:ml-1.5">
                X
              </span>
              <sub className="text-sm sm:text-xl lg:text-2xl xl:text-3xl font-bold text-slate-400 lowercase tracking-normal ml-1 sm:ml-2 relative -bottom-[2px] sm:-bottom-[6px]">
                journal
              </sub>
            </h1>
          </div>

          {/* Chart Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                  Live Market Stream
                </span>
              </div>

              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="BTC">BTC / USDT Live</option>
                <option value="ETH">ETH / USDT Live</option>
                <option value="SOL">SOL / USDT Live</option>
              </select>
            </div>

            {/* Candle Container */}
            <div
              ref={chartContainerRef}
              className="w-full h-56 sm:h-64 rounded-xl overflow-hidden border border-slate-800/80"
            ></div>

            {/* Market Tickers Strip */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {(["BTC", "ETH", "SOL"] as const).map((asset) => {
                const info = liveTickers[asset];
                const isPos = info.change >= 0;
                return (
                  <div key={asset} className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-blue-200/70 block font-mono">{asset} / USDT</span>
                    <span className={`text-xs font-bold font-mono ${isPos ? "text-blue-400" : "text-purple-300"}`}>
                      ${info.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`block text-[9px] font-mono ${isPos ? "text-blue-400" : "text-purple-400"}`}>
                      {isPos ? "+" : ""}{info.change.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>


        </div>

        {/* Right Column: Geometric Balance Auth Card */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
            
            {/* --- VIEW A: 6-Digit Verification Code Screen with Lottie Animation --- */}
            {isVerifying ? (
              <div className="text-center">
                {isVerifiedSuccess ? (
                  <div className="py-8 space-y-4 animate-in fade-in zoom-in duration-300">
                    <AuthLottieAnimation type="success" className="w-24 h-24 mx-auto" loop={false} />
                    <div className="space-y-1">
                      <h2 className="text-2xl font-bold text-blue-400 font-mono tracking-wide">
                        Verified Successfully!
                      </h2>
                      <p className="text-sm text-white/90">
                        Preparing your secure workspace...
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono">
                      <CheckCircle className="w-4 h-4 text-blue-400" />
                      <span className="inline-flex items-baseline">
                        Welcome to Tracker<span className="text-[1.25em] font-black text-blue-400 leading-none ml-[0.5px]">X</span>
                        <sub className="text-[11px] font-bold text-slate-300 lowercase ml-0.5 relative -bottom-[1px]">journal</sub>
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <AuthLottieAnimation type="verify" className="w-20 h-20 mx-auto mb-2" />
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                      Enter 6-Digit Code
                    </h2>
                    
                    {/* Dynamic Destination Badges */}
                    <div className="max-w-sm mx-auto mb-4 space-y-1.5 text-xs text-slate-300">
                      <p className="text-blue-200/70 text-xs">
                        We've dispatched a 6-digit verification code to:
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-950/80 border border-blue-500/40 text-blue-200 font-mono text-xs shadow-inner">
                          <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="font-semibold">{verificationTarget || email}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 pt-1 font-mono">
                        Please check your Gmail inbox (or spam folder) for the 6-digit security code.
                      </p>
                    </div>

                    {errorMessage && (
                      <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                        {errorMessage}
                      </div>
                    )}

                    {successMessage && (
                      <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium">
                        {successMessage}
                      </div>
                    )}

                    <form onSubmit={handleConfirmVerificationAndRegister} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-blue-200 uppercase tracking-widest mb-2 font-mono">
                          6-Digit Security Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="000000"
                          autoFocus
                          required
                          className="w-full bg-slate-950 border-2 border-blue-500/60 rounded-xl py-3 px-4 text-2xl text-center text-white font-mono tracking-[0.5em] placeholder-slate-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || verificationCode.length !== 6}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all text-sm flex items-center justify-center gap-2 font-mono uppercase tracking-wider cursor-pointer"
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <AuthLottieAnimation type="button-loader" className="w-5 h-5" />
                            <span>Verifying Code...</span>
                          </div>
                        ) : (
                          <>
                            <span>Verify & Complete Registration</span>
                            <CheckCircle className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => {
                          setIsVerifying(false);
                          setVerificationCode("");
                          setErrorMessage(null);
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        &larr; Back to Form
                      </button>

                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={isResending}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                        <span>Resend Code</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* --- VIEW B: Standard Login / Registration Screen --- */
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                    {isRegisterMode ? "Create Client Account" : "Welcome Back"}
                  </h2>
                  <p className="text-xs text-blue-200/70">
                    {isRegisterMode
                      ? "Enter your Gmail to request access to Trade Journal Tracker"
                      : "Login with your Gmail or Username to access app"}
                  </p>
                  {isRegisterMode && (
                    <div className="mt-2.5 space-y-2">
                      {deviceInfo.isMasterDevice ? (
                        <div className="p-3 rounded-xl bg-purple-950/50 border border-purple-500/40 text-left flex items-start gap-2.5">
                          <Sparkles className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
                          <div className="text-[11px] text-purple-200/90 leading-relaxed font-mono">
                            <strong className="text-white font-sans block">👑 Host Admin Master Device Active:</strong>
                            Unlimited device registrations and test account creation are permitted on this device without restrictions.
                          </div>
                        </div>
                      ) : deviceInfo.isRegistered && deviceInfo.registeredEmail ? (
                        <div className="p-3 rounded-xl bg-slate-950 border border-blue-500/30 text-left">
                          <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold font-mono mb-1">
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>1 Device / 1 Account Limit</span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-normal mb-2">
                            This device is already linked to <strong className="text-white font-mono">{deviceInfo.registeredEmail}</strong>. Creating a new account from this device is restricted. If your 5-day trial has expired, log into your registered account to clear the review page via subscription payment.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsRegisterMode(false);
                              setEmail(deviceInfo.registeredEmail || "");
                              setErrorMessage(null);
                            }}
                            className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 text-xs font-mono font-bold transition-all text-center"
                          >
                            Switch to Login ({deviceInfo.registeredEmail})
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {errorMessage && (
                  <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium">
                    {successMessage}
                  </div>
                )}

                <form onSubmit={isRegisterMode ? handleInitiateRegistration : handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                      {isRegisterMode ? "Gmail / Email Address" : "Gmail or Username"}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-blue-400 absolute left-3.5 top-3.5" />
                      <input
                        type={isRegisterMode ? "email" : "text"}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={isRegisterMode ? "Enter your real Gmail" : "Enter Gmail or Username"}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-sm sm:text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {isRegisterMode && (
                    <>
                      {/* Profile Picture Upload Header */}
                      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                        <div className="relative group shrink-0">
                          {photoURL ? (
                            <img
                              src={photoURL}
                              alt="Profile preview"
                              className="w-12 h-12 aspect-square rounded-full object-cover border-2 border-blue-500 shadow-md"
                            />
                          ) : (
                            <div className="w-12 h-12 aspect-square rounded-full bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-slate-400 shrink-0">
                              <div className="w-7 h-7 aspect-square rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-blue-300 shrink-0 -translate-y-[0.5px]" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">Upload Profile Photo</p>
                          <p className="text-[10px] text-blue-200/70">Essential for Chat & Host Admin Inspector</p>
                          <input
                            type="file"
                            ref={regFileInputRef}
                            onChange={handleRegPhotoUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => regFileInputRef.current?.click()}
                            className="mt-1 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-[10px] font-mono flex items-center gap-1"
                          >
                            <Camera className="w-3 h-3" /> Select Photo
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                          Unique Username
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-blue-400 absolute left-3.5 top-3.5" />
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="trader_pro"
                            required={isRegisterMode}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-sm sm:text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                          Full Name / Display Name
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g. Alex Morgan"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono flex items-center justify-between">
                          <span>Phone Number <span className="text-slate-500 font-normal text-[10px]">(Optional)</span></span>
                          <span className="text-[10px] text-blue-400 font-mono">Select Country & Dial Code</span>
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
                        <input
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none cursor-pointer"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                        Security Password
                      </label>
                      {!isRegisterMode && (
                        <button
                          type="button"
                          onClick={() => {
                            setForgotIdent(email);
                            setShowForgotModal(true);
                            setForgotMsg(null);
                            setForgotStep("request");
                          }}
                          className="text-[11px] font-mono text-blue-400 hover:text-blue-300 underline"
                        >
                          Change / Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-blue-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm sm:text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-white p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all text-sm flex items-center justify-center gap-2 mt-2 font-mono uppercase tracking-wider cursor-pointer active:scale-[0.99]"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2.5">
                        <AuthLottieAnimation type="button-loader" className="w-5 h-5" />
                        <span>{isRegisterMode ? "Sending 6-Digit Code..." : "Authenticating Terminal..."}</span>
                      </div>
                    ) : (
                      <>
                        <span>{isRegisterMode ? "Send 6-Digit Code & Register" : "Log In to Trading App"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    onClick={() => {
                      setIsRegisterMode(!isRegisterMode);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs text-blue-200/70 hover:text-white transition-colors font-mono"
                  >
                    {isRegisterMode ? (
                      <span>Already registered? <strong className="text-blue-400 underline">Log in here</strong></span>
                    ) : (
                      <span>Don't have an account? <strong className="text-blue-400 underline">Register here</strong></span>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Emergency Support Line Badge */}
            <div className="mt-6 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-[10px] text-blue-200/60 uppercase tracking-widest font-mono block">
                Direct Support Line
              </span>
              <span className="text-xs font-bold text-purple-300 font-mono flex items-center justify-center gap-1.5 mt-0.5">
                <PhoneCall className="w-3.5 h-3.5 text-purple-400" /> +94 75 284 0841
              </span>
            </div>

            {/* Community Chat & Signal Groups Registration Prompt */}
            <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-purple-950/60 border border-blue-500/40 shadow-lg shadow-blue-950/50">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-white font-mono">
                      Community Chat & Signals
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                      Registration Required
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-200/70 block mt-0.5">
                    Register with your true Gmail profile to unlock public chat, direct messages, and VIP signal groups.
                  </span>
                </div>
              </div>

              {!isRegisterMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setErrorMessage(null);
                    setSuccessMessage("Please fill out the registration form to unlock Community Chat & Signals.");
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-600/30"
                >
                  <span>Register Now to Access Community</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="text-center py-1 text-[11px] font-mono text-blue-300 flex items-center justify-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                  <span>Fill in the details above to complete your registration</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col items-center gap-1.5 text-center">
              <div className="flex items-center justify-center gap-2 text-[10px] font-mono">
                {deviceInfo.isMasterDevice ? (
                  <span className="text-purple-300 font-bold flex items-center gap-1 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/30">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>👑 Host Master Device: Unlimited Registrations Active</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAdminUnlockModal(true)}
                    className="text-blue-300/70 hover:text-white flex items-center gap-1 transition-colors group cursor-pointer"
                  >
                    <Smartphone className="w-3 h-3 text-blue-400 group-hover:text-white" />
                    <span>Device Security Active &bull; <span className="underline decoration-blue-500/50 group-hover:decoration-white">Host Master Unlock</span></span>
                  </button>
                )}
              </div>
              <div className="text-[10px] text-blue-200/40 font-mono">
                TrackerX Ecosystem Systems Hub v4.2
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Host Admin Master Device Quick-Unlock Modal */}
      {showAdminUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-purple-500/40 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative">
            <div className="flex items-center gap-2.5 mb-3 text-purple-400">
              <Unlock className="w-5 h-5" />
              <h3 className="font-bold text-white text-base font-mono">Master Device Key Unlock</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Enter the Master Key to unlock unlimited device registrations, setup client devices, and remove device limits on this terminal.
            </p>

            <form onSubmit={handleUnlockMasterDevice} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-300 mb-1">
                  Master Key (for unlimited device registration)
                </label>
                <input
                  type="password"
                  value={adminUnlockPin}
                  onChange={(e) => setAdminUnlockPin(e.target.value)}
                  placeholder="Enter Master Key"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                  autoFocus
                  required
                />
              </div>

              {adminUnlockMsg && (
                <div className={`p-2.5 rounded-lg text-xs font-mono ${adminUnlockMsg.startsWith("✅") ? "bg-blue-500/10 text-blue-300 border border-blue-500/30" : "bg-rose-500/10 text-rose-300 border border-rose-500/30"}`}>
                  {adminUnlockMsg}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminUnlockModal(false);
                    setAdminUnlockMsg(null);
                    setAdminUnlockPin("");
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold transition-all shadow-md shadow-purple-600/25"
                >
                  Activate Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot / Change Password Modal with 6-digit Code & Lottie */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-blue-500/40 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative text-center">
            {forgotSuccess ? (
              <AuthLottieAnimation type="success" className="w-20 h-20 mx-auto mb-2" />
            ) : (
              <AuthLottieAnimation type="lock" className="w-16 h-16 mx-auto mb-2" />
            )}

            <h3 className="font-bold text-white text-lg mb-1">
              {forgotStep === "request" ? "Reset / Change Password" : "Verify & Set New Password"}
            </h3>
            <p className="text-xs text-blue-200/70 mb-4">
              {forgotStep === "request"
                ? "Enter your Gmail or Username to receive a 6-digit verification code."
                : `Enter the 6-digit verification code sent to ${forgotIdent} and your new password.`}
            </p>

            {forgotMsg && (
              <div className={`p-2.5 rounded-lg text-xs font-mono mb-3 ${forgotMsg.startsWith("✅") ? "bg-blue-500/10 text-blue-300 border border-blue-500/30" : "bg-rose-500/10 text-rose-300 border border-rose-500/30"}`}>
                {forgotMsg}
              </div>
            )}

            {forgotStep === "request" ? (
              <form onSubmit={handleForgotRequestCode} className="space-y-3 text-left">
                <div>
                  <label className="block text-[11px] font-mono text-slate-300 mb-1">
                    Gmail / Username
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-blue-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={forgotIdent}
                      onChange={(e) => setForgotIdent(e.target.value)}
                      placeholder="Enter registered Gmail"
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotMsg(null);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{loading ? "Sending..." : "Send Code"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotSubmitNewPass} className="space-y-3 text-left">
                <div>
                  <label className="block text-[11px] font-mono text-slate-300 mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    required
                    autoFocus
                    className="w-full bg-slate-950 border border-blue-500/60 rounded-xl py-2 px-3 text-lg text-center font-mono tracking-widest text-white focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-blue-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      value={forgotNewPass}
                      onChange={(e) => setForgotNewPass(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      minLength={6}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep("request");
                      setForgotMsg(null);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || forgotCode.length !== 6}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold transition-all shadow-md shadow-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{loading ? "Updating..." : "Set Password"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
