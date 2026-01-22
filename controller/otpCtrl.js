// controllers/otpCtrl.js (CommonJS)
const crypto = require("crypto");
const Otp = require("../models/otpModel");
const { sendSms } = require("../utils/atSms");

const TTL_MIN = Number(process.env.OTP_TTL_MINUTES || 10);

const hashCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

// ✅ Uganda phone normalize -> E.164 (+2567XXXXXXXX)
const normalizeMobile = (raw = "") => {
  let s = String(raw || "").trim().replace(/[^\d+]/g, "");
  if (!s) return "";

  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+256")) return s;
  if (s.startsWith("256")) return "+" + s;

  if (s.startsWith("0")) {
    const rest = s.replace(/^0+/, "");
    return `+256${rest}`;
  }

  // 7xxxxxxx typed without 0/256
  if (/^\d+$/.test(s) && s.length >= 7 && s.length <= 9) return `+256${s}`;

  if (s.startsWith("+")) return s;

  return ""; // ✅ reject unknown format instead of guessing
};

exports.sendOtp = async (req, res) => {
  try {
    const { identity, type, purpose = "signup" } = req.body;

    // ✅ MUST be phone
    if (type !== "phone") {
      return res.status(400).json({ message: "OTP is for phone numbers only" });
    }

    if (!identity) {
      return res.status(400).json({ message: "mobile number is required" });
    }

    // ✅ normalize + validate phone
    const phone = normalizeMobile(identity);
    if (!phone) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    const code = generateCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);

    // ✅ invalidate previous unused OTPs for same phone + purpose
    await Otp.updateMany(
      { identity: phone, purpose, used: false },
      { $set: { used: true } }
    );

    // ✅ store new OTP for normalized phone
    await Otp.create({ identity: phone, codeHash, purpose, expiresAt });

    const msg = `Kupto verification code: ${code}. Expires in ${TTL_MIN} minutes.`;

    await sendSms({ to: phone, message: msg });

    return res.json({ success: true, message: "OTP sent", identity: phone });
  } catch (err) {
    console.error("sendOtp error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { identity, type, code, purpose = "signup" } = req.body;

    // ✅ MUST be phone
    if (type !== "phone") {
      return res.status(400).json({ message: "OTP verification is for phone only" });
    }

    if (!identity || !code) {
      return res.status(400).json({ message: "mobile number and code are required" });
    }

    // ✅ normalize + validate phone
    const phone = normalizeMobile(identity);
    if (!phone) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    const otp = await Otp.findOne({
      identity: phone,
      purpose,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otp) {
      return res.status(400).json({ message: "Code is invalid or expired" });
    }

    if (otp.attempts >= 5) {
      otp.used = true;
      await otp.save();
      return res
        .status(429)
        .json({ message: "Too many attempts. Request a new code." });
    }

    const ok = otp.codeHash === hashCode(code);
    otp.attempts += 1;

    if (!ok) {
      await otp.save();
      return res.status(400).json({ message: "Code is invalid" });
    }

    otp.used = true;
    await otp.save();

    return res.json({ success: true, message: "OTP verified", identity: phone });
  } catch (err) {
    console.error("verifyOtp error:", err);
    return res.status(500).json({ message: "Failed to verify OTP" });
  }
};
