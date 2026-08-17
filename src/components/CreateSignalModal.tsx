import React, { useState } from "react";
import { UserProfile, SignalGroup, SignalItem } from "../types";
import { postSignal, generateTradeCounterStr, getSignals } from "../lib/communityStore";
import { X, Upload, AlertTriangle, Send, Sparkles, TrendingUp, DollarSign, ShieldAlert } from "lucide-react";

interface CreateSignalModalProps {
  group: SignalGroup;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSignalCreated: (signal: SignalItem) => void;
}

export const CreateSignalModal: React.FC<CreateSignalModalProps> = ({
  group,
  currentUser,
  isOpen,
  onClose,
  onSignalCreated,
}) => {
  if (!isOpen) return null;

  const allSignals = getSignals();
  const groupSignals = allSignals.filter((s) => s.groupId === group.id);
  const { tradeNumberStr, countToday } = generateTradeCounterStr(groupSignals);

  const [coin, setCoin] = useState("BTCUSDT.P");
  const [entry, setEntry] = useState("");
  const [tp1, setTp1] = useState("");
  const [tp2, setTp2] = useState("");
  const [sl, setSl] = useState("");
  const [leverage, setLeverage] = useState("20x");
  const [riskPercent, setRiskPercent] = useState("1-2%");
  const [description, setDescription] = useState("");
  const [chartPhotoUrl, setChartPhotoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick preset sample chart photos
  const SAMPLE_CHARTS = [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=800&auto=format&fit=crop&q=80",
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setChartPhotoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!chartPhotoUrl) {
      setErrorMessage("Please upload or provide a chart photo of the trade analysis (Mandatory).");
      return;
    }

    setLoading(true);
    const res = postSignal(currentUser, group.id, {
      coin,
      entry,
      tp1,
      tp2,
      sl,
      leverage,
      riskPercent,
      description,
      chartPhotoUrl,
    });

    setLoading(false);
    if (!res.success || !res.signal) {
      setErrorMessage(res.error || "Failed to publish signal.");
      return;
    }

    onSignalCreated(res.signal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                Give a Trade Signal ({group.name})
              </h2>
              <p className="text-xs text-indigo-300 font-mono">
                {tradeNumberStr} • #{countToday} of 10 today
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Slide 8 Warning Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200 leading-relaxed font-sans">
              <strong className="text-amber-400 uppercase tracking-wide block font-mono">
                Important Rule:
              </strong>
              Don't forget to click the <strong className="text-white">"Finish Trade Start Feedback"</strong> button once the trade closes so community voting can verify your win rate!
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
              {errorMessage}
            </div>
          )}

          {/* Chart Photo Upload (Mandatory) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              1. Chart Photo Analysis <span className="text-rose-400">* (Mandatory)</span>
            </label>
            {chartPhotoUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-video max-h-48 group">
                <img
                  src={chartPhotoUrl}
                  alt="Chart preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setChartPhotoUrl("")}
                  className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-500 text-white p-1.5 rounded-lg text-xs font-mono shadow-lg"
                >
                  Change Photo
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-5 flex flex-col items-center justify-center gap-2.5 cursor-pointer bg-slate-950/60 hover:bg-slate-900/60 transition-all text-center group">
                  <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-200 font-semibold font-mono block">
                      Choose Chart Screenshot from Device
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Upload directly from your local phone/PC storage (PNG, JPG)
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Trade Parameters Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                Coin Pair <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={coin}
                onChange={(e) => setCoin(e.target.value)}
                placeholder="e.g. BTCUSDT.P"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                Entry Price <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="e.g. 64,200.00"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1 font-mono">
                Take Profit 1 (TP1) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={tp1}
                onChange={(e) => setTp1(e.target.value)}
                placeholder="e.g. 65,800.00"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-400/80 uppercase tracking-wider mb-1 font-mono">
                Take Profit 2 (TP2) (Optional)
              </label>
              <input
                type="text"
                value={tp2}
                onChange={(e) => setTp2(e.target.value)}
                placeholder="e.g. 66,500.00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-300/80 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1 font-mono">
                Stop Loss (SL) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={sl}
                onChange={(e) => setSl(e.target.value)}
                placeholder="e.g. 63,400.00"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-rose-300 font-mono focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                Leverage <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                placeholder="e.g. 20x"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Risk Management %
            </label>
            <input
              type="text"
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
              placeholder="e.g. 1-2% Account Risk"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Trade Reasoning & Analysis Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Explain the technical setup (e.g. 4H Bullish FVG tap, sweep of London session lows)..."
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none resize-none font-sans"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all font-mono"
          >
            {loading ? (
              <span>Publishing Signal...</span>
            ) : (
              <>
                <Send className="w-4 h-4" /> Publish Signal to Group
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
