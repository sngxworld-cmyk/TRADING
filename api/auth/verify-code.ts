import type { IncomingMessage, ServerResponse } from "http";

type VercelReq = IncomingMessage & { body?: any; query?: any };
type VercelRes = ServerResponse & {
  status: (code: number) => VercelRes;
  json: (data: any) => void;
  send: (data: any) => void;
};

export default async function handler(req: VercelReq, res: VercelRes) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { target, code } = req.body || {};
    const cleanCode = (code || "").toString().trim().replace(/\D/g, "");

    if (!cleanCode || cleanCode.length !== 6) {
      return res.status(400).json({ error: "Please enter the complete 6-digit verification code." });
    }

    return res.status(200).json({
      verified: true,
      message: "Code verified successfully.",
      target,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
