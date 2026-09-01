import React, { useState } from "react";
import { ShieldAlert, PhoneCall, CheckCircle2, AlertTriangle, X, Shield, Languages, DollarSign } from "lucide-react";

interface CommunityGuidelinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommunityGuidelinesModal: React.FC<CommunityGuidelinesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [lang, setLang] = useState<"en" | "si">("en");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-blue-950/40 to-purple-950/30 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                {lang === "en" ? "Community Guidelines & Safety Rules" : "ප්‍රජා මාර්ගෝපදේශ සහ ආරක්ෂක නීති"}
              </h2>
              <p className="text-xs text-blue-200/70">
                {lang === "en"
                  ? "Mandatory rules for all members, signal providers, and traders"
                  : "සියලුම සාමාජිකයන්, සිග්නල් සපයන්නන් සහ ට්‍රේඩර්ස්ලා සඳහා අනිවාර්ය නීති"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher Button */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-3 py-1 text-xs font-bold font-mono rounded-lg transition-colors ${
                  lang === "en"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang("si")}
                className={`px-3 py-1 text-xs font-bold font-mono rounded-lg transition-colors flex items-center gap-1 ${
                  lang === "si"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Languages className="w-3.5 h-3.5" />
                සිංහල
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
          {lang === "en" ? (
            <>
              {/* Section 1: Member & Pending Guidelines */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-purple-300 flex items-center gap-2 uppercase tracking-wide text-xs font-mono">
                  <AlertTriangle className="w-4 h-4 text-purple-400" /> 1. Member & Pending User Conduct
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>
                    <strong className="text-purple-300">Zero Tolerance for Harassment & Bullying:</strong> If you harass someone, use offensive or hateful language, or post inappropriate/sexual material in public chat, direct messages, or group discussions, that results in an <strong className="text-white font-bold uppercase tracking-wider">IMMEDIATE PERMANENT BAN</strong>.
                  </li>
                  <li>
                    <strong className="text-white">Reporting & Bug Bounty:</strong> If there is a system issue, bug, or security vulnerability, contact emergency support immediately at <strong className="text-blue-400 font-mono">+94 75 284 0841</strong>.
                  </li>
                  <li>
                    <strong className="text-white">Financial Risk Disclaimer:</strong> We are strictly not liable for your trading decisions or losses resulting from low win-rate signal groups, unverified groups, or scam providers. Always manage your position sizing and risk.
                  </li>
                </ul>
              </div>

              {/* Section 2: Signal Providers (Free & Normal) */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wide text-xs font-mono">
                  <Shield className="w-4 h-4" /> 2. Signal Providers (Free & Normal)
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>
                    <strong className="text-white">Daily Trade Limit:</strong> You <strong className="text-blue-300">cannot</strong> publish more than <strong className="text-white font-mono">10 signals per day</strong>.
                  </li>
                  <li>
                    <strong className="text-white">Concurrent Trades Limit:</strong> You <strong className="text-blue-300">cannot</strong> have more than <strong className="text-white font-mono">10 active signals running simultaneously</strong>. You must close trades once completed.
                  </li>
                  <li>
                    <strong className="text-white">Honest Feedback Integrity:</strong> You cannot manipulate or fake community feedback. Tampering with voting results leads to an immediate permanent ban.
                  </li>
                </ul>
              </div>

              {/* Section 3: Verified Signal Providers & Pricing */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wide text-xs font-mono">
                  <CheckCircle2 className="w-4 h-4" /> 3. Verified Signal Providers & Pricing Caps
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>
                    <strong className="text-white">Immediate Access Fulfillment:</strong> If you receive payment/subscription from a user, you must approve them into your group immediately. Failure to approve paid members results in an instant ban. The Host Admin retains emergency override access to protect subscriber rights.
                  </li>
                  <li>
                    <strong className="text-white">Maximum Price Ceiling:</strong> No signal group may charge more than <strong className="text-blue-400 font-mono font-bold">$17.00 USD</strong> (5,000 LKR equivalent). Any VIP offering above this ceiling requires direct prior authorization from the Host Master Admin.
                  </li>
                  <li>
                    <strong className="text-white">Verification Requirement:</strong> Verified status is automatically granted once a group reaches at least <strong className="text-white font-mono">30 closed signals</strong> with a documented win rate of <strong className="text-blue-400 font-mono">≥85.0%</strong>.
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Sinhala Guidelines Section 1 */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-purple-300 flex items-center gap-2 uppercase tracking-wide text-xs font-mono">
                  <AlertTriangle className="w-4 h-4 text-purple-400" /> 1. සාමාජිකයන් සහ යූසර්ස්ලාගේ හැසිරීම් නීති
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>
                    <strong className="text-purple-300">හිරිහැර කිරීම් සහ අපහාස සඳහා බිංදුවේ ඉවසීම (Zero Tolerance):</strong> Public Chat, Direct Messages (DMs), හෝ Groups ඇතුළේ කිසිම කෙනෙකුට අපහාස කිරීම, කුණුහරුප හෝ නුසුදුසු ලිංගික දර්ශන/ඡායාරූප දැමීම සිදු කළහොත් කිසිදු පූර්ව දැනුම්දීමකින් තොරව <strong className="text-white font-bold uppercase tracking-wider">ක්ෂණික ස්ථිර තහනමකට (Permanent Ban)</strong> ලක්වේ.
                  </li>
                  <li>
                    <strong className="text-white">පද්ධති දෝෂ සහ වාර්තා කිරීම (Bug Bounty):</strong> ඇප් එකේ කිසියම් දෝෂයක් හෝ ගැටලුවක් ඇත්නම්, වහාම හදිසි ආරක්ෂක සහාය අංකය වන <strong className="text-blue-400 font-mono">+94 75 284 0841</strong> අමතන්න.
                  </li>
                  <li>
                    <strong className="text-white">මූල්‍ය අවදානම් වගකීම් ප්‍රකාශය (Risk Disclaimer):</strong> අන්‍යයන්ගේ සිග්නල් හෝ නොතහවුරු කරන ලද ගෲප් නිසා සිදුවන පාඩු සඳහා TrackerX වගකීමක් නොදරයි. ඔබගේ Risk Management නිසි ලෙස පවත්වාගන්න.
                  </li>
                </ul>
              </div>

              {/* Sinhala Guidelines Section 2 */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wide text-xs font-mono">
                  <Shield className="w-4 h-4" /> 2. Signal Providers නීති (නොමිලේ සහ සාමාන්‍ය ගෲප්)
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>
                    <strong className="text-white">දෛනික Trade සීමාව:</strong> එක් දිනකට පළ කළ හැක්කේ <strong className="text-blue-300">උපරිම Signals 10ක්</strong> පමණි.
                  </li>
                  <li>
                    <strong className="text-white">එකවර Active Signals සීමාව:</strong> එකවර ක්‍රියාත්මක වන Active Signals <strong className="text-blue-300">උපරිම 10ක්</strong> පමණක් පවත්වාගත හැක. ට්‍රේඩ් එකක් අවසන් වූ පසු එය Close කළ යුතුය.
                  </li>
                  <li>
                    <strong className="text-white">සත්‍ය ප්‍රතිචාර අඛණ්ඩතාව (Feedback Integrity):</strong> Community Voting හෝ Feedback වෙනස් කිරීමට හෝ වංචා කිරීමට උත්සාහ කිරීම ස්ථිර තහනමකට හේතු වේ.
                  </li>
                </ul>
              </div>

              {/* Sinhala Guidelines Section 3 */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wide text-xs font-mono">
                  <CheckCircle2 className="w-4 h-4" /> 3. Verified Signal Providers සහ උපරිම මිල නීති
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>
                    <strong className="text-white">ක්ෂණික Access ලබා දීම:</strong> සාමාජිකයෙකු මුදල් ගෙවූ වහාම ප්‍රමාදයකින් තොරව ගෲප් එකට ඇතුළත් කළ යුතුය. මුදල් ලබාගෙන Access නොදුනහොත් ගෲප් එක සහ ගිණුම වහාම Ban කරනු ලැබේ.
                  </li>
                  <li>
                    <strong className="text-white">උපරිම මිල සීමාව (Price Cap):</strong> කිසිදු Signal Group එකකට <strong className="text-blue-400 font-mono font-bold">$17.00 USD (රු. 5,000 LKR)</strong> ට වඩා වැඩි මුදලක් අය කිරීමට අවසර නැත. මීට වඩා වැඩි මුදලක් අය කරන්නේ නම් Host Master Admin ගේ විශේෂ පූර්ව අනුමැතිය අවශ්‍ය වේ.
                  </li>
                  <li>
                    <strong className="text-white">Verified තත්ත්වය ලබා ගැනීම:</strong> ගෲප් එකක් අවම වශයෙන් <strong className="text-white font-mono">Closed Signals 30ක්</strong> සහ <strong className="text-blue-400 font-mono">≥85.0% Win Rate</strong> එකක් සපුරා ගත් විට ස්වයංක්‍රීයව Verified බැජ් එක ලැබේ.
                  </li>
                </ul>
              </div>
            </>
          )}

          {/* Emergency Support Line Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-slate-950 to-purple-950/30 border border-blue-500/30 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[10px] text-blue-300 uppercase tracking-widest font-mono block">
                {lang === "en" ? "Official Host Emergency Line" : "නිල හදිසි ආරක්ෂක සහාය දුරකථන අංකය"}
              </span>
              <span className="text-sm font-bold text-white font-mono flex items-center gap-1.5 mt-0.5">
                <PhoneCall className="w-4 h-4 text-blue-400" /> +94 75 284 0841
              </span>
            </div>
            <span className="text-[10px] text-blue-200/70 font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              24/7 Security Hotline
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
          <span className="text-[11px] text-slate-400 font-mono">
            {lang === "en" ? "TrackerX Safety Protocol v2.4" : "TrackerX ආරක්ෂක ප්‍රොටෝකෝලය v2.4"}
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/30"
          >
            {lang === "en" ? "I Understand & Agree" : "මම තේරුම් ගතිමි සහ එකඟ වෙමි"}
          </button>
        </div>
      </div>
    </div>
  );
};

