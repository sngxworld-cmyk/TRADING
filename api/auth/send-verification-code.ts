import type { IncomingMessage, ServerResponse } from "http";
import nodemailer from "nodemailer";

type VercelReq = IncomingMessage & { body?: any; query?: any };
type VercelRes = ServerResponse & {
  status: (code: number) => VercelRes;
  json: (data: any) => void;
  send: (data: any) => void;
};

export default async function handler(req: VercelReq, res: VercelRes) {
  // CORS headers
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
    const { target, email, isRegistration } = req.body || {};
    const cleanEmail = (email || target || "").toString().trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ error: "A valid Gmail / email address is required." });
    }

    const rawCode = req.body?.code ? req.body.code.toString().trim() : "";
    const code = /^\d{6}$/.test(rawCode)
      ? rawCode
      : Math.floor(100000 + Math.random() * 900000).toString();

    const smtpUser = process.env.SMTP_USER || "sngxworld@gmail.com";
    const smtpPass = process.env.SMTP_PASS || "rpwhubpdxycunbrh";

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const mailOptions = {
      from: `TrackerX Pro <${smtpUser}>`,
      to: cleanEmail,
      subject: `Your TrackerX Verification Code: ${code}`,
      text: `Welcome to TrackerX Pro!\n\nYour 6-digit security verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this code, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f172a; border-radius: 12px; color: #f8fafc; border: 1px solid #334155;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #6366f1; margin: 0; font-size: 24px;">TrackerX Pro</h2>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Trader Account Security Verification</p>
          </div>
          <div style="background: #1e293b; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #475569;">
            <p style="color: #cbd5e1; font-size: 14px; margin-top: 0;">Your 6-digit verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; font-family: monospace; padding: 12px 0;">
              ${code}
            </div>
            <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">This code is valid for 10 minutes.</p>
          </div>
          <p style="color: #64748b; font-size: 11px; text-align: center; margin-top: 20px;">
            If you did not request this code, you can safely disregard this message.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: `6-digit security code delivered to your Gmail inbox!`,
      emailDelivered: true,
      expiresInSeconds: 600,
      channels: ["email"],
      destinations: [cleanEmail],
    });
  } catch (error: any) {
    console.error("Vercel mailer error:", error);
    return res.status(500).json({
      error: `Failed to deliver email: ${error?.message || "SMTP error"}`,
      emailDelivered: false,
    });
  }
}
