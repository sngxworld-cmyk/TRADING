import React, { useState } from "react";
import { Robot3D } from "./Robot3D";
import { Sparkles, ChevronRight, ChevronLeft, X, CheckCircle2, Globe, DollarSign, Calendar, BarChart3, Download, ShieldCheck, Cpu } from "lucide-react";

interface RobotTutorialOverlayProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const RobotTutorialOverlay: React.FC<RobotTutorialOverlayProps> = ({
  onComplete,
  onSkip,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<"sinhala" | "english" | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);

  const stepsSinhala = [
    {
      title: "1. Starting Capital (ආරම්භක ප්‍රාග්ධනය සකස් කිරීම)",
      subtitle: "Initial Trading Account Deposit",
      icon: DollarSign,
      description:
        "මෙහි ඔබගේ ආරම්භක Trading Deposit එක ($100, $500, $1000, $5000 හෝ වෙනත් ඕනෑම අගයක්) ඇතුළත් කරන්න. මෙම අගය මත පදනම්ව සමස්ත වසරේ PnL, ROI, සහ Account Equity ගණනය වේ.",
      highlightHint: "Top Starting Capital Input & Quick Presets",
    },
    {
      title: "2. Daily Win / Loss Logging (දිනපතා PnL සහ Trade සටහන)",
      subtitle: "Daily Trade Entry & Touch Buttons",
      icon: Calendar,
      description:
        "සෑම දිනයක් සඳහාම + (Win Day) හෝ - (Loss Day) ඔබන්න. ඉන්පසු ශුද්ධ Profit/Loss ප්‍රමාණය ($), ROI (%) සහ Trade Note / Strategy Description (උදා: BTC 1h OB retest, TP hit) සටහන් කරන්න.",
      highlightHint: "Daily Grid Row: + / - Buttons, Amount, ROI, Notes",
    },
    {
      title: "3. Mobile & Desktop Responsive Views (මොබයිල් සහ ඩෙස්ක්ටොප් පෙනුම)",
      subtitle: "Optimized for Mobile & Desktop",
      icon: Cpu,
      description:
        "Mobile තිර සඳහා විශේෂ Touch Cards layout එකක් සහ Desktop තිර සඳහා full Data Table view එකක් ඇත. ඕනෑම උපාංගයකින් පහසුවෙන් සටහන් තැබිය හැක.",
      highlightHint: "Mobile Touch Cards & Desktop Popover Table",
    },
    {
      title: "4. Monthly & Yearly Summaries (මාසික සහ වාර්ෂික සාරාංශ)",
      subtitle: "Comprehensive Account Breakdown",
      icon: BarChart3,
      description:
        "Monthly සහ Yearly Tabs මගින් මසින් මස ප්‍රගතිය, Total Win Days, Loss Days, Win Rate %, Profit Factor, Best Win Day, සහ Worst Loss Day පරීක්ෂා කළ හැක.",
      highlightHint: "Tabs: Monthly Summary & Yearly Breakdown",
    },
    {
      title: "5. Visual Analytics & Charts (විශ්ලේෂණ සහ ප්‍රස්ථාර)",
      subtitle: "Real-time Equity Growth & Metrics",
      icon: Sparkles,
      description:
        "Analytics Tab එක මගින් ඔබගේ Account Equity Growth Curve, Win/Loss Ratio Pie Chart, Daily PnL Bar Chart, සහ Consecutive Streaks සජීවීව නැරඹිය හැක.",
      highlightHint: "Analytics Tab: Interactive Recharts Visualizer",
    },
    {
      title: "6. Full Professional Excel Export (සම්පූර්ණ Excel වාර්තා බාගත කිරීම)",
      subtitle: "Download Complete Journal Records",
      icon: Download,
      description:
        "Excel Export බොත්තම මගින් Account Overview, Monthly Summary, සහ Daily Trade Log (එදින තෙක් මාසික Profit, YTD PnL, Win Rate) අඩංගු Excel (.xlsx) ගොනුවක් බාගත කරගත හැක.",
      highlightHint: "Top Header Excel Export Button",
    },
    {
      title: "7. Multi-Year & Start Month Selector (වසර සහ මාස තේරීම)",
      subtitle: "Flexible Trading Period Setup",
      icon: Calendar,
      description:
        "2024 සිට 2035 දක්වා ඕනෑම වසරක් හෝ Custom Year එකක් තෝරාගත හැක. එසේම ඔබගේ වෙළඳ වසර ආරම්භ වන මාසය (Start Month) වෙනස් කිරීමටද හැක.",
      highlightHint: "Year Range Dropdown & Start Month Config",
    },
    {
      title: "8. Host Admin Approvals & Polling (පරිපාලක අනුමැතිය)",
      subtitle: "Real-time Approval Status Verification",
      icon: ShieldCheck,
      description:
        "නව ගිණුම් අනුමැතිය සඳහා තත්පර 3 කට වරක් සජීවීව පරීක්ෂා වේ. Host Admin විසින් ඔබගේ Gmail එක අනුමත කළ සැනින් App එක ස්වයංක්‍රීයව විවෘත වේ.",
      highlightHint: "Automatic Approval Status Polling",
    },
    {
      title: "9. 3D AI Robot Tutorial Mentor (3D AI උපදේශක)",
      subtitle: "Interactive 3D Walkthrough Guidance",
      icon: Cpu,
      description:
        "3D AI Robot උපදේශක එක මගින් SNGxJOURNAL Trading Plan App එකෙහි සියලුම විශේෂාංග පිළිබඳ සවිස්තරාත්මක 3D නිබන්ධන මඟපෙන්වීමක් ලබාදේ.",
      highlightHint: "3D Interactive AI Tutorial Overlay",
    },
  ];

  const stepsEnglish = [
    {
      title: "1. Starting Capital Configuration",
      subtitle: "Initial Account Balance Setup",
      icon: DollarSign,
      description:
        "Set your starting trading capital ($100, $500, $1000, $5000, or custom). Your entire year's net PnL, monthly ROI, and current total equity update dynamically from this baseline.",
      highlightHint: "Starting Capital Input & Quick Presets",
    },
    {
      title: "2. Daily Win / Loss Performance Log",
      subtitle: "Record Daily PnL & Strategy Notes",
      icon: Calendar,
      description:
        "Click + for Win Day or - for Loss Day. Enter your net profit/loss ($), ROI (%), and trading setup notes (e.g., BTC 1h OB retest, TP hit) for every single day.",
      highlightHint: "Daily Grid Row: + / - Buttons, Amount, ROI, Notes",
    },
    {
      title: "3. Mobile & Desktop Responsive Layouts",
      subtitle: "Touch Cards & Full Data Grid",
      icon: Cpu,
      description:
        "On mobile devices, a touch-optimized card layout allows fast logging. On desktop screens, an expanded table view with popover controls gives complete journal oversight.",
      highlightHint: "Mobile Touch Cards & Desktop Popover Table",
    },
    {
      title: "4. Monthly & Yearly Summaries",
      subtitle: "In-Depth Account Metrics",
      icon: BarChart3,
      description:
        "Switch to Monthly Summary or Yearly Breakdown to evaluate month-by-month progress, total win/loss days, win rate %, profit factor, best day, and worst day.",
      highlightHint: "Tabs: Monthly Summary & Yearly Breakdown",
    },
    {
      title: "5. Visual Analytics & Equity Charts",
      subtitle: "Interactive Performance Metrics",
      icon: Sparkles,
      description:
        "The Analytics view renders interactive visual equity growth curves, win/loss ratio pie charts, daily PnL distribution bars, and consecutive win/loss streak trends.",
      highlightHint: "Analytics Tab: Interactive Recharts Visualizer",
    },
    {
      title: "6. Full Professional Excel Export",
      subtitle: "Export Complete Journal Records",
      icon: Download,
      description:
        "Click Excel Export to generate an formatted Excel (.xlsx) file containing Account Overview, Monthly Summary, and Daily Logs (including Month's Profit Till That Day & YTD PnL).",
      highlightHint: "Top Header Excel Export Button",
    },
    {
      title: "7. Multi-Year & Start Month Selection",
      subtitle: "Flexible Trading Periods",
      icon: Calendar,
      description:
        "Select any trading year from 2024 to 2035 or configure a custom year. Customize your 12-month rolling start month to match your custom trading plan schedule.",
      highlightHint: "Year Range Dropdown & Start Month Config",
    },
    {
      title: "8. Real-time Host Admin Approvals",
      subtitle: "Instant Account Status Polling",
      icon: ShieldCheck,
      description:
        "Pending registration accounts auto-poll approval status every 3 seconds. Once approved by the Host Admin or pre-approved Gmail list, the app unlocks seamlessly.",
      highlightHint: "Automatic Approval Status Polling",
    },
    {
      title: "9. 3D AI Robot Tutorial Mentor",
      subtitle: "Interactive 3D Walkthrough Guidance",
      icon: Cpu,
      description:
        "The 3D AI Robot Assistant provides this comprehensive interactive walkthrough tutorial covering all features of your SNGxJOURNAL Trading Plan.",
      highlightHint: "3D Interactive AI Tutorial Overlay",
    },
  ];

  const currentSteps = selectedLanguage === "english" ? stepsEnglish : stepsSinhala;

  // Render Language Selector First
  if (!selectedLanguage) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="max-w-md w-full bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center space-y-6">
          {/* Top Decorative Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />

          {/* 3D Robot Floating Avatar */}
          <div className="relative group">
            <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-2xl animate-pulse" />
            <Robot3D size={180} isTalking={true} className="relative z-10" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-mono mb-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              SNGxJOURNAL 3D AI Mentor
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              සාදරයෙන් පිළිගනිමු! / Welcome!
            </h2>
            <p className="text-xs text-slate-400 mt-2 font-mono leading-relaxed">
              කරුණාකර ඔබගේ නිබන්ධන උපදෙස් භාෂාව තෝරන්න
              <br />
              Please select your tutorial guidance language:
            </p>
          </div>

          {/* Language Choice Buttons */}
          <div className="w-full space-y-3 pt-1">
            <button
              onClick={() => setSelectedLanguage("sinhala")}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 border border-indigo-400/30 transition-all flex items-center justify-between group active:scale-95"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-indigo-200" />
                <span className="text-left font-sans">සිංහල (Sinhala Guidance)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-indigo-200 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => setSelectedLanguage("english")}
              className="w-full py-3.5 px-5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-sm border border-slate-800 transition-all flex items-center justify-between group active:scale-95"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-slate-400" />
                <span className="text-left">English (English Guidance)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <button
            onClick={onSkip}
            className="text-xs text-slate-500 hover:text-slate-300 font-mono underline transition-colors pt-1"
          >
            Skip Tutorial & Start Trading ✕
          </button>
        </div>
      </div>
    );
  }

  const step = currentSteps[currentStep];
  const StepIcon = step?.icon || Sparkles;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="max-w-xl w-full bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col space-y-5 animate-in slide-in-from-bottom-4 duration-300">
        {/* Top bar with Step Counter & Skip */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-wider">
              {selectedLanguage === "sinhala"
                ? `3D AI නිබන්ධනය: පියවර ${currentStep + 1} / ${currentSteps.length}`
                : `3D AI Tutorial: Step ${currentStep + 1} of ${currentSteps.length}`}
            </span>
          </div>

          <button
            onClick={onSkip}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Skip</span>
          </button>
        </div>

        {/* Center Content: Floating 3D Robot & Explanation Text */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 py-2">
          {/* 3D Robot Avatar */}
          <div className="shrink-0 flex flex-col items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-600/20 rounded-full blur-xl animate-pulse" />
              <Robot3D size={150} isTalking={true} className="relative z-10" />
            </div>
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 mt-1">
              SNGxJOURNAL AI
            </span>
          </div>

          {/* Explanation Text */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-indigo-300">
              <StepIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>{step.highlightHint}</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
              {step.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans pt-1">
              {step.description}
            </p>
          </div>
        </div>

        {/* Progress indicators bar */}
        <div className="flex items-center gap-1.5 pt-1">
          {currentSteps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 flex-1 ${
                idx === currentStep
                  ? "bg-indigo-500"
                  : idx < currentStep
                  ? "bg-emerald-500/80"
                  : "bg-slate-800"
              }`}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              currentStep === 0
                ? "opacity-30 cursor-not-allowed text-slate-600"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{selectedLanguage === "sinhala" ? "නැවත" : "Back"}</span>
          </button>

          {currentStep < currentSteps.length - 1 ? (
            <button
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 border border-indigo-400/30 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <span>{selectedLanguage === "sinhala" ? "ඊළඟ පියවර" : "Next Step"}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 border border-emerald-400/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{selectedLanguage === "sinhala" ? "අවසන් කර ආරම්භ කරන්න" : "Finish & Start"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
