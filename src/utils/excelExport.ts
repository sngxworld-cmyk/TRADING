import * as XLSX from "xlsx";
import { TradingDataStore, DayRecord } from "../types";

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

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function getDaysInMonth(mIdx: number, yearStr: string): number {
  if (mIdx === 1) {
    const match = yearStr.match(/\d{4}/);
    const year = match ? parseInt(match[0]) : 2026;
    if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) return 29;
    return 28;
  }
  return MONTH_DAYS[mIdx] || 30;
}

export function exportTradingPlanToExcel(
  tradingData: TradingDataStore,
  yearRange: string,
  userEmail: string,
  startMonth: number = 0,
  startingCapitalNum: number = 100
) {
  const yearData = tradingData[yearRange] || {};

  let totalWinDays = 0;
  let totalLossDays = 0;
  let totalNeutralDays = 0;
  let totalLoggedDays = 0;

  let totalWinProfit = 0;
  let totalLossAmount = 0;

  let maxWinDay = 0;
  let maxLossDay = 0;

  let cumulativePnL = 0;
  let cumulativeRoi = 0;

  const monthlyRows: any[] = [];
  const dailyRows: any[] = [];

  let runningCapital = startingCapitalNum;

  for (let m = 0; m < 12; m++) {
    const actualMonthIndex = (startMonth + m) % 12;
    const monthName = MONTH_NAMES[actualMonthIndex];
    const daysInMonth = getDaysInMonth(actualMonthIndex, yearRange);
    const monthData = yearData[actualMonthIndex] || {};

    const monthStartCapital = runningCapital;

    let mWins = 0;
    let mLosses = 0;
    let mNeutrals = 0;
    let mLogged = 0;

    let mPnL = 0;
    let mRoi = 0;

    let mWinProfit = 0;
    let mLossAmount = 0;

    let mMaxWin = 0;
    let mMaxLoss = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayRecord: DayRecord = monthData[d] || { state: "", amount: "", roi: "", notes: "", description: "" };
      const rawAmt = parseFloat(dayRecord.amount) || 0;
      const rawRoi = parseFloat(dayRecord.roi) || 0;

      let status = "Not Logged";
      let netAmt = 0;
      let netRoi = 0;

      if (dayRecord.state === "green") {
        status = "Win (+ Green)";
        mWins++;
        totalWinDays++;
        mLogged++;
        totalLoggedDays++;
        netAmt = rawAmt;
        netRoi = rawRoi;

        mWinProfit += netAmt;
        totalWinProfit += netAmt;

        if (netAmt > mMaxWin) mMaxWin = netAmt;
        if (netAmt > maxWinDay) maxWinDay = netAmt;
      } else if (dayRecord.state === "red") {
        status = "Loss (- Red)";
        mLosses++;
        totalLossDays++;
        mLogged++;
        totalLoggedDays++;
        netAmt = -rawAmt;
        netRoi = -rawRoi;

        mLossAmount += rawAmt;
        totalLossAmount += rawAmt;

        if (-netAmt > mMaxLoss) mMaxLoss = -netAmt;
        if (-netAmt > maxLossDay) maxLossDay = -netAmt;
      } else if (dayRecord.state === "neutral" || dayRecord.amount || dayRecord.roi) {
        status = "Neutral / Break-even";
        mNeutrals++;
        totalNeutralDays++;
        mLogged++;
        totalLoggedDays++;
      } else {
        mNeutrals++;
        totalNeutralDays++;
      }

      mPnL += netAmt;
      mRoi += netRoi;

      cumulativePnL += netAmt;
      cumulativeRoi += netRoi;
      runningCapital += netAmt;

      const currentTotalLogged = totalWinDays + totalLossDays;
      const currentWinRate =
        currentTotalLogged > 0
          ? ((totalWinDays / currentTotalLogged) * 100).toFixed(1) + "%"
          : "0.0%";

      const notesText = dayRecord.notes || dayRecord.description || "";

      dailyRows.push({
        "Year": yearRange,
        "Month": monthName,
        "Day": `Day ${d}`,
        "Date": `${monthName} ${d}, ${yearRange}`,
        "Result Status": status,
        "Daily Net PnL ($)": Math.round(netAmt * 100) / 100,
        "Daily ROI (%)": Math.round(netRoi * 100) / 100,
        "Month's Profit Till That Day ($)": Math.round(mPnL * 100) / 100,
        "Month's ROI Till That Day (%)": Math.round(mRoi * 100) / 100,
        "Year's Cumulative PnL Till That Day ($)": Math.round(cumulativePnL * 100) / 100,
        "Year's Cumulative ROI Till That Day (%)": Math.round(cumulativeRoi * 100) / 100,
        "Running Account Balance ($)": Math.round(runningCapital * 100) / 100,
        "Win Rate Till That Day": currentWinRate,
        "Strategy Notes / Setups": notesText,
      });
    }

    const monthRecordedDays = mWins + mLosses;
    const mWinRate =
      monthRecordedDays > 0 ? ((mWins / monthRecordedDays) * 100).toFixed(1) + "%" : "0.0%";

    const mProfitFactor =
      mLossAmount > 0
        ? (mWinProfit / mLossAmount).toFixed(2)
        : mWinProfit > 0
        ? "∞ (No Losses)"
        : "0.00";

    monthlyRows.push({
      "Month Name": monthName,
      "Total Month Days": daysInMonth,
      "Starting Capital ($)": Math.round(monthStartCapital * 100) / 100,
      "Ending Capital ($)": Math.round(runningCapital * 100) / 100,
      "Monthly Net PnL ($)": Math.round(mPnL * 100) / 100,
      "Monthly ROI (%)": Math.round(mRoi * 100) / 100,
      "Cumulative YTD PnL ($)": Math.round(cumulativePnL * 100) / 100,
      "Winning Days": mWins,
      "Losing Days": mLosses,
      "Logged Trade Days": mLogged,
      "Win Rate (%)": mWinRate,
      "Profit Factor": mProfitFactor,
      "Best Day ($)": Math.round(mMaxWin * 100) / 100,
      "Worst Day ($)": Math.round(-mMaxLoss * 100) / 100,
    });
  }

  const recordedTotalDays = totalWinDays + totalLossDays;
  const overallWinRate =
    recordedTotalDays > 0 ? ((totalWinDays / recordedTotalDays) * 100).toFixed(1) + "%" : "0.0%";

  const overallProfitFactor =
    totalLossAmount > 0
      ? (totalWinProfit / totalLossAmount).toFixed(2)
      : totalWinProfit > 0
      ? "∞ (No Losses)"
      : "0.00";

  const avgWinDay = totalWinDays > 0 ? (totalWinProfit / totalWinDays).toFixed(2) : "0.00";
  const avgLossDay = totalLossDays > 0 ? (totalLossAmount / totalLossDays).toFixed(2) : "0.00";

  // Sheet 1: Account Overview
  const overviewRows = [
    { "Account Metric": "Account Owner (Gmail)", "Value": userEmail || "Anonymous Trader" },
    { "Account Metric": "Trade Journal Period", "Value": yearRange },
    { "Account Metric": "Initial Starting Capital ($)", "Value": `$${startingCapitalNum.toFixed(2)}` },
    { "Account Metric": "Current Total Equity ($)", "Value": `$${runningCapital.toFixed(2)}` },
    { "Account Metric": "Annual Net PnL ($)", "Value": `$${cumulativePnL.toFixed(2)}` },
    { "Account Metric": "Annual Net ROI (%)", "Value": `${cumulativeRoi >= 0 ? "+" : ""}${cumulativeRoi.toFixed(2)}%` },
    { "Account Metric": "Total Logged Days", "Value": totalLoggedDays },
    { "Account Metric": "Total Winning Days", "Value": totalWinDays },
    { "Account Metric": "Total Losing Days", "Value": totalLossDays },
    { "Account Metric": "Overall Win Rate", "Value": overallWinRate },
    { "Account Metric": "Profit Factor", "Value": overallProfitFactor },
    { "Account Metric": "Total Win Earnings ($)", "Value": `$${totalWinProfit.toFixed(2)}` },
    { "Account Metric": "Total Loss Amount ($)", "Value": `-$${totalLossAmount.toFixed(2)}` },
    { "Account Metric": "Average Win Day ($)", "Value": `$${avgWinDay}` },
    { "Account Metric": "Average Loss Day ($)", "Value": `-$${avgLossDay}` },
    { "Account Metric": "Best Win Day ($)", "Value": `$${maxWinDay.toFixed(2)}` },
    { "Account Metric": "Worst Loss Day ($)", "Value": `-$${maxLossDay.toFixed(2)}` },
    { "Account Metric": "Export Date & Time", "Value": new Date().toLocaleString() },
  ];

  const workbook = XLSX.utils.book_new();

  // Create worksheets
  const wsOverview = XLSX.utils.json_to_sheet(overviewRows);
  const wsMonthly = XLSX.utils.json_to_sheet(monthlyRows);
  const wsDaily = XLSX.utils.json_to_sheet(dailyRows);

  // Auto-fit column widths for readability
  const autoFitColumns = (ws: XLSX.WorkSheet, data: any[]) => {
    if (!data || data.length === 0) return;
    const colKeys = Object.keys(data[0]);
    ws["!cols"] = colKeys.map((key) => {
      let maxLen = key.length;
      data.forEach((row) => {
        const valStr = row[key] !== undefined && row[key] !== null ? String(row[key]) : "";
        if (valStr.length > maxLen) maxLen = valStr.length;
      });
      return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
    });
  };

  autoFitColumns(wsOverview, overviewRows);
  autoFitColumns(wsMonthly, monthlyRows);
  autoFitColumns(wsDaily, dailyRows);

  // Add worksheets to workbook
  XLSX.utils.book_append_sheet(workbook, wsOverview, "Account Overview");
  XLSX.utils.book_append_sheet(workbook, wsMonthly, "Monthly Summary");
  XLSX.utils.book_append_sheet(workbook, wsDaily, "Daily Trade Log");

  // Format clean filename
  const cleanGmail = (userEmail || "Trader").split("@")[0].replace(/[^a-zA-Z0-9]/g, "_");
  const cleanPeriod = yearRange.replace(/\s/g, "");
  const filename = `SNGxJOURNAL_Trade_Journal_${cleanGmail}_${cleanPeriod}.xlsx`;

  // Trigger Excel file download
  XLSX.writeFile(workbook, filename);
}
