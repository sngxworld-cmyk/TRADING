import React from "react";
import { ShieldAlert, PhoneCall, CheckCircle2, AlertTriangle, X, Shield, Lock, DollarSign } from "lucide-react";

interface CommunityGuidelinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommunityGuidelinesModal: React.FC<CommunityGuidelinesModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-mono">
                Community Guidelines & Safety Rules
              </h2>
              <p className="text-xs text-slate-400">
                Mandatory rules for all members, signal providers, and traders
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
          {/* Section 1: Member & Pending Guidelines */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-rose-400 flex items-center gap-2 uppercase tracking-wide text-xs font-mono">
              <AlertTriangle className="w-4 h-4" /> 1. Member & Pending User Conduct
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong className="text-rose-300">Zero Tolerance for Harassment & Bullying:</strong> If you harass someone, use offensive or hateful language, or post inappropriate/sexual material in public chat, direct messages, or group discussions, that results in an <strong className="text-rose-400 font-bold uppercase tracking-wider">IMMEDIATE PERMANENT BAN</strong>.
              </li>
              <li>
                <strong className="text-slate-100">Reporting & Bug Bounty:</strong> If there is a system issue, bug, or security vulnerability, contact emergency support immediately at <strong className="text-amber-400 font-mono">+94 75 284 0841</strong>.
              </li>
              <li>
                <strong className="text-slate-100">Financial Risk Disclaimer:</strong> We are strictly not liable for your trading decisions or losses resulting from low win-rate signal groups, unverified groups, or scam providers. Always manage your position sizing and risk.
              </li>
            </ul>
          </div>

          {/* Section 2: Signal Providers (Free & Normal) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wide text-xs font-mono">
              <Shield className="w-4 h-4" /> 2. Signal Providers (Free & Normal)
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong className="text-slate-100">Daily Trade Limit:</strong> You <strong className="text-amber-400">cannot</strong> publish more than <strong className="text-white font-mono">10 signals per day</strong>.
              </li>
              <li>
                <strong className="text-slate-100">Concurrent Trades Limit:</strong> You <strong className="text-amber-400">cannot</strong> have more than <strong className="text-white font-mono">10 active signals running simultaneously</strong>. You must close trades once completed.
              </li>
              <li>
                <strong className="text-slate-100">Honest Feedback Integrity:</strong> You cannot manipulate or fake community feedback. Tampering with voting results leads to an immediate permanent ban.
              </li>
            </ul>
          </div>

          {/* Section 3: Verified Signal Providers & Pricing */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wide text-xs font-mono">
              <CheckCircle2 className="w-4 h-4" /> 3. Verified Signal Providers & Pricing Caps
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong className="text-slate-100">Immediate Access Fulfillment:</strong> If you receive payment/subscription from a user, you must approve them into your group immediately. Failure to approve paid members results in an instant ban. The Host Admin retains emergency override access to protect subscriber rights.
              </li>
              <li>
                <strong className="text-slate-100">Maximum Price Ceiling:</strong> No signal group may charge more than <strong className="text-emerald-400 font-mono font-bold">$17.00 USD</strong> (5,000 LKR equivalent). Any VIP offering above this ceiling requires direct prior authorization from the Host Master Admin.
              </li>
              <li>
                <strong className="text-slate-100">Verification Requirement:</strong> Verified status is automatically granted once a group reaches at least <strong className="text-white font-mono">30 closed signals</strong> with a documented win rate of <strong className="text-emerald-400 font-mono">≥85.0%</strong>.
              </li>
            </ul>
          </div>

          {/* Emergency Support Line Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 to-slate-950 border border-amber-500/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-amber-400 uppercase tracking-widest font-mono block">
                Official Host Emergency Line
              </span>
              <span className="text-sm font-bold text-slate-100 font-mono flex items-center gap-1.5 mt-0.5">
                <PhoneCall className="w-4 h-4 text-amber-400" /> +94 75 284 0841
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              24/7 Security Hotline
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/30"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
};
