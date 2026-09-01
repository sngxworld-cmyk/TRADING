import React, { useState } from "react";
import { DollarSign, Calendar, Layers, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, X } from "lucide-react";

interface MandatorySetupModalProps {
  isOpen: boolean;
  isMandatory?: boolean;
  initialCapital?: string;
  initialYear?: string;
  initialMonth?: number;
  onSave: (config: { startingCapital: string; yearRange: string; startMonth: number }) => void;
  onClose?: () => void;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DEFAULT_YEARS = [
  "2024",
  "2025",
  "2026",
  "2027",
  "2028",
  "2029",
  "2030",
  "2031",
  "2032",
  "2033",
  "2034",
  "2035",
];

export const MandatorySetupModal: React.FC<MandatorySetupModalProps> = ({
  isOpen,
  isMandatory = true,
  initialCapital = "100",
  initialYear = "2026",
  initialMonth = 0,
  onSave,
  onClose,
}) => {
  const [capital, setCapital] = useState<string>(() => initialCapital || "100");
  const [year, setYear] = useState<string>(() => initialYear || "2026");
  const [month, setMonth] = useState<number>(() => (initialMonth !== undefined ? initialMonth : 0));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numCap = parseFloat(capital);
    if (isNaN(numCap) || numCap <= 0) {
      setError("Please provide a valid starting capital greater than $0.");
      return;
    }
    if (!year || !year.trim()) {
      setError("Please select a starting year.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      onSave({
        startingCapital: String(numCap),
        yearRange: year.trim(),
        startMonth: Number(month),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="mandatory-setup-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-300"
    >
      <div
        id="mandatory-setup-card"
        className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col bg-slate-900 border border-blue-500/40 rounded-2xl sm:rounded-3xl shadow-2xl shadow-blue-950/50 relative overflow-hidden text-white animate-in zoom-in-95 duration-300 my-auto"
      >
        {/* Glow blur in background */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Optional Close Button if NOT mandatory edit mode */}
        {!isMandatory && onClose && (
          <button
            id="close-setup-modal-btn"
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors z-20"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto overscroll-contain p-5 sm:p-7 sm:px-8 space-y-5 custom-scrollbar relative z-10">
          {/* Header Branding */}
          <div className="relative z-10 pr-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                {isMandatory ? "Required Account Configuration" : "Journal Timeline Settings"}
              </span>
            </div>

            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              {isMandatory ? "Set Up Your Journal Parameters" : "Edit Starting Capital, Year & Month"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
              {isMandatory
                ? "Please fill in your starting account details to initialize your personalized trading journal."
                : "Update your baseline trading capital and the starting month & year of your journal."}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 relative z-10">
            {/* Question 1: Starting Capital */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-blue-400" />
                1. Starting Capital (Deposit in USDT)
              </label>
              <div className="relative flex items-center bg-slate-950 border border-slate-700 focus-within:border-blue-500 rounded-2xl px-4 py-2.5 sm:py-3 transition-colors shadow-inner">
                <span className="text-blue-400 font-bold font-mono text-base mr-2">$</span>
                <input
                  id="setup-starting-capital-input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  required
                  value={capital}
                  onChange={(e) => {
                    setCapital(e.target.value);
                    setError("");
                  }}
                  placeholder="100.00"
                  className="bg-transparent border-none text-white font-mono font-bold text-base w-full focus:outline-none placeholder:text-slate-600"
                />
                <span className="text-xs font-mono text-slate-400 ml-2">USDT</span>
              </div>

              {/* Quick Select Presets */}
              <div className="flex items-center gap-1.5 sm:gap-2 pt-1 overflow-x-auto pb-1 no-scrollbar">
                {["100", "500", "1000", "5000", "10000"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCapital(preset)}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-mono border transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
                      capital === preset
                        ? "bg-blue-600 border-blue-400 text-white font-bold shadow-md shadow-blue-600/30"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                    }`}
                  >
                    ${Number(preset).toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Question 2: Starting Year */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-400" />
                2. Starting Year of the Journal
              </label>
              <select
                id="setup-starting-year-select"
                value={year}
                onChange={(e) => {
                  if (e.target.value === "CUSTOM") {
                    const custom = prompt("Enter target year (e.g. 2026 or 2027):", "2026");
                    if (custom && custom.trim()) {
                      setYear(custom.trim());
                    }
                  } else {
                    setYear(e.target.value);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-2xl px-4 py-2.5 sm:py-3 text-sm font-mono text-white focus:outline-none transition-colors cursor-pointer"
              >
                {DEFAULT_YEARS.concat(year && !DEFAULT_YEARS.includes(year) ? [year] : []).map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
                <option value="CUSTOM">+ Enter Custom Year...</option>
              </select>
            </div>

            {/* Question 3: Starting Month */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-400" />
                3. Starting Month of the Journal
              </label>
              <select
                id="setup-starting-month-select"
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-2xl px-4 py-2.5 sm:py-3 text-sm font-mono text-white focus:outline-none transition-colors cursor-pointer"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview timeline helper note */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 sm:p-3.5 text-xs font-mono text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                Your journal will begin tracking from{" "}
                <strong className="text-white">
                  {MONTH_NAMES[month]} {year}
                </strong>
                .
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="submit-journal-setup-btn"
                type="submit"
                disabled={isSaving}
                className="w-full py-3 sm:py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <span>Saving Setup...</span>
                ) : (
                  <>
                    <span>{isMandatory ? "Initialize Journal & Continue" : "Save Journal Parameters"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
