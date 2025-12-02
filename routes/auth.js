const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const sgMail = require("@sendgrid/mail");
const crypto = require("crypto");
const prisma = require("../prismaClient");

// ========== Initialize SendGrid ==========
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ========== Multer setup ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const userId = req.user ? req.user.id : "temp";
    cb(null, `${userId}_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (mimetype && extname) return cb(null, true);
  cb(new Error("Only image files are allowed!"));
};

const upload = multer({ storage, fileFilter });

// ========== Auth Middleware ==========
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

// ========== Check Email Exists ==========
router.post("/check-email", async (req, res) => {
  const { email } = req.body;
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ message: "No account found" });
  res.json({ exists: true });
});

// ========== SEND OTP (Signup) ==========
router.post("/request-otp", async (req, res) => {
  const { email } = req.body;

  try {
    const otpCode = crypto.randomInt(1000, 9999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verification_codes.deleteMany({ where: { email } });

    await prisma.verification_codes.create({
      data: { email, code: otpCode, expires_at: otpExpiry, verified: 0 },
    });

    const msg = {
      to: email,
      from: { email: process.env.EMAIL_USER, name: "IFU App" },
      subject: "Your Signup OTP",
      text: `Your verification code is ${otpCode}`,
    };

    await sgMail.send(msg);
    res.json({ message: "OTP sent", email });
  } catch (err) {
    res.status(500).json({ message: "OTP send failed", error: err.message });
  }
});

// ========== SEND RESET OTP ==========
router.post("/request-password-reset-otp", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "No account found" });

    const otpCode = crypto.randomInt(1000, 9999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verification_codes.deleteMany({ where: { email } });

    await prisma.verification_codes.create({
      data: { email, code: otpCode, expires_at: otpExpiry, verified: 0 },
    });

    const msg = {
      to: email,
      from: { email: process.env.EMAIL_USER, name: "IFU App" },
      subject: "Password Reset OTP",
      text: `Your password reset OTP is ${otpCode}`,
    };

    await sgMail.send(msg);
    res.json({ message: "Password reset OTP sent", email });
  } catch (err) {
    res.status(500).json({ message: "OTP send failed", error: err.message });
  }
});

// ========== VERIFY OTP ==========
router.post("/verify-otp", async (req, res) => {
  const { email, code } = req.body;

  const record = await prisma.verification_codes.findFirst({
    where: { email, code, expires_at: { gt: new Date() } },
  });

  if (!record) return res.status(400).json({ message: "Invalid OTP" });

  await prisma.verification_codes.updateMany({
    where: { email },
    data: { verified: 1 },
  });

  res.json({ message: "OTP verified" });
});

// ========== RESET PASSWORD ==========
router.post("/reset-password", async (req, res) => {
  const { email, password } = req.body;

  const verifiedOTP = await prisma.verification_codes.findFirst({
    where: { email, verified: 1 },
  });

  if (!verifiedOTP) return res.status(400).json({ message: "Verify OTP first" });

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.users.update({
    where: { email },
    data: { password: hashedPassword },
  });

  await prisma.verification_codes.deleteMany({ where: { email } });

  res.json({ message: "Password reset successful" });
});

// ========== SIGNUP ==========
router.post("/signup", async (req, res) => {
  const { name, email, password, zip_code, gender, timezone } = req.body;

  const verifiedOTP = await prisma.verification_codes.findFirst({
    where: { email, verified: 1 },
  });

  if (!verifiedOTP) return res.status(400).json({ message: "Verify OTP first" });

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.users.create({
    data: {
      name,
      email,
      password: hashedPassword,
      zip_code,
      gender,
      timezone,
      profile_completed: 0,
    },
  });

  await prisma.verification_codes.deleteMany({ where: { email } });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1d" });

  res.json({ token, user });
});

// ========== LOGIN ==========
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1d" });

  res.json({ token, user });
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
