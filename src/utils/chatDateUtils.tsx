import React from "react";
import { Calendar } from "lucide-react";

/**
 * Returns formatted date divider string WhatsApp-style:
 * - Today -> "Today"
 * - Yesterday -> "Yesterday"
 * - If month === 0 (January / first month) or not current year -> "DD/MM/YYYY" (e.g. 01/01/2026)
 * - If middle of year (Feb - Dec) in current year -> "DD/MM" (e.g. 24/08, 16/08)
 */
export function formatChatDividerDate(dateInput: string | number | Date): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const isSameYear = d.getFullYear() === now.getFullYear();
  const isSameMonth = isSameYear && d.getMonth() === now.getMonth();
  const isSameDay = isSameMonth && d.getDate() === now.getDate();

  // Check Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  const dayStr = String(d.getDate()).padStart(2, "0");
  const monthStr = String(d.getMonth() + 1).padStart(2, "0");
  const yearStr = d.getFullYear();

  // Today
  if (isSameDay) {
    return `Today (${dayStr}/${monthStr})`;
  }

  // Yesterday
  if (isYesterday) {
    return `Yesterday (${dayStr}/${monthStr})`;
  }

  // First month of the year (January, month === 0) or different year -> full DD/MM/YYYY
  if (d.getMonth() === 0 || !isSameYear) {
    return `${dayStr}/${monthStr}/${yearStr}`;
  }

  // Middle of the year -> DD/MM (or e.g. 24/08)
  return `${dayStr}/${monthStr}`;
}

/**
 * Check if two messages occurred on different calendar days
 */
export function isDifferentChatDay(
  prevDateInput?: string | number | Date | null,
  currDateInput?: string | number | Date | null
): boolean {
  if (!prevDateInput || !currDateInput) return true;
  const d1 = new Date(prevDateInput);
  const d2 = new Date(currDateInput);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return true;

  return (
    d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate()
  );
}

/**
 * Formats time like WhatsApp: "09:42 AM", "02:57 PM"
 */
export function formatMessageTime(dateInput: string | number | Date): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";

  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Returns full date-time string e.g. "24/08 • 09:42 AM" or "01/01/2026 • 09:42 AM"
 */
export function formatMessageDateTimeShort(dateInput: string | number | Date): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";

  const timeStr = formatMessageTime(d);
  const dayStr = String(d.getDate()).padStart(2, "0");
  const monthStr = String(d.getMonth() + 1).padStart(2, "0");
  const yearStr = d.getFullYear();

  const now = new Date();
  const isSameYear = d.getFullYear() === now.getFullYear();

  if (d.getMonth() === 0 || !isSameYear) {
    return `${dayStr}/${monthStr}/${yearStr} ${timeStr}`;
  }
  return `${dayStr}/${monthStr} ${timeStr}`;
}

/**
 * WhatsApp-style centered Date Divider Badge
 */
export const ChatDateDivider: React.FC<{ date: string | number | Date }> = ({ date }) => {
  const label = formatChatDividerDate(date);
  if (!label) return null;

  return (
    <div className="flex items-center justify-center my-3 relative select-none">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-800/80" />
      </div>
      <div className="relative px-3 py-1 rounded-full bg-slate-900 border border-slate-700/80 text-[10px] font-mono text-slate-300 shadow-md flex items-center gap-1.5 backdrop-blur-md">
        <Calendar className="w-3 h-3 text-indigo-400" />
        <span>{label}</span>
      </div>
    </div>
  );
};
