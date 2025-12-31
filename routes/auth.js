const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const prisma = require("../prismaClient");

/* ===================== Nodemailer Setup ===================== */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ===================== Multer setup ===================== */
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

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ===================== Auth Middleware ===================== */
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token)
    return res.status(401).json({ message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(
      token.replace("Bearer ", ""),
      process.env.JWT_SECRET
    );
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

/* ===================== Check Email Exists ===================== */
router.post("/check-email", async (req, res) => {
  const { email } = req.body;
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user)
    return res
      .status(404)
      .json({ message: "No account found with this email address" });

  res.json({ exists: true });
});

/* ===================== Request OTP (Signup) ===================== */
router.post("/request-otp", async (req, res) => {
  const { email } = req.body;

  try {
    const otpCode = crypto.randomInt(1000, 9999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verification_codes.deleteMany({ where: { email } });

    await prisma.verification_codes.create({
      data: { email, code: otpCode, expires_at: otpExpiry, verified: 0 },
    });

    await transporter.sendMail({
      from: `"IFU App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your IFU OTP Code",
      text: `Your verification code is ${otpCode}. It expires in 10 minutes.`,
    });

    res.json({ message: "OTP sent to email" });
  } catch (err) {
    console.error("OTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== Request Password Reset OTP ===================== */
router.post("/request-password-reset-otp", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user)
      return res
        .status(404)
        .json({ message: "No account found with this email address" });

    const otpCode = crypto.randomInt(1000, 9999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verification_codes.deleteMany({ where: { email } });

    await prisma.verification_codes.create({
      data: { email, code: otpCode, expires_at: otpExpiry, verified: 0 },
    });

    await transporter.sendMail({
      from: `"IFU App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset OTP",
      text: `Your password reset verification code is ${otpCode}. It expires in 10 minutes.`,
    });

    res.json({ message: "Password reset OTP sent" });
  } catch (err) {
    console.error("Reset OTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== Verify OTP ===================== */
router.post("/verify-otp", async (req, res) => {
  const { email, code } = req.body;

  const record = await prisma.verification_codes.findFirst({
    where: { email, code, expires_at: { gt: new Date() } },
  });

  if (!record)
    return res.status(400).json({ message: "Invalid or expired OTP" });

  await prisma.verification_codes.updateMany({
    where: { email },
    data: { verified: 1 },
  });

  res.json({ message: "OTP verified" });
});

/* ===================== Reset Password ===================== */
router.post("/reset-password", async (req, res) => {
  const { email, password } = req.body;

  const verifiedOTP = await prisma.verification_codes.findFirst({
    where: { email, verified: 1 },
  });

  if (!verifiedOTP)
    return res.status(400).json({ message: "Verify OTP first" });

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.users.update({
    where: { email },
    data: { password: hashedPassword },
  });

  await prisma.verification_codes.deleteMany({ where: { email } });

  res.json({ message: "Password reset successful" });
});

/* ===================== Signup ===================== */
router.post("/signup", async (req, res) => {
  const { name, email, password, zip_code, gender, timezone } = req.body;

  const verifiedOTP = await prisma.verification_codes.findFirst({
    where: { email, verified: 1 },
  });

  if (!verifiedOTP)
    return res.status(400).json({ message: "Verify email first" });

  const existingUser = await prisma.users.findUnique({ where: { email } });
  if (existingUser)
    return res.status(400).json({ message: "User already exists" });

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

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.status(201).json({ token, user });
});

/* ===================== Login ===================== */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch)
    return res.status(400).json({ message: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.json({ token, user });
});

/* ===================== Profile Update ===================== */
router.put(
  "/profile",
  authMiddleware,
  upload.any(),
  async (req, res) => {
    try {
      const userId = Number(req.user.id);
      const data = { ...req.body, profile_completed: 1 };

      if (req.files?.length) {
        const img = req.files.find((f) => f.fieldname === "profile_image");
        if (img) data.profile_image = `/uploads/${img.filename}`;
      }

      const updated = await prisma.users.update({
        where: { id: userId },
        data,
      });

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ===================== Get Profile ===================== */
router.get("/profile", authMiddleware, async (req, res) => {
  const user = await prisma.users.findUnique({
    where: { id: req.user.id },
  });
  res.json(user);
});

router.get("/me", authMiddleware, async (req, res) => {
  const user = await prisma.users.findUnique({
    where: { id: req.user.id },
  });
  res.json(user);
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;





// const express = require("express");
// const router = express.Router();
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const multer = require("multer");
// const path = require("path");
// const sgMail = require("@sendgrid/mail");
// const crypto = require("crypto");
// const prisma = require("../prismaClient");

// // ========== Initialize SendGrid ==========
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// // ========== Multer setup for profile uploads ==========
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, "uploads/"),
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     const userId = req.user ? req.user.id : "temp";
//     cb(null, `${userId}_${Date.now()}${ext}`);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = /jpeg|jpg|png|gif/;
//   const extname = allowedTypes.test(
//     path.extname(file.originalname).toLowerCase()
//   );
//   const mimetype = allowedTypes.test(file.mimetype);
//   if (mimetype && extname) return cb(null, true);
//   cb(new Error("Only image files are allowed!"));
// };

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 5 * 1024 * 1024 },
// });

// // ========== Auth Middleware ==========
// const authMiddleware = (req, res, next) => {
//   const token = req.header("Authorization");
//   if (!token)
//     return res.status(401).json({ message: "No token, authorization denied" });

//   try {
//     const decoded = jwt.verify(
//       token.replace("Bearer ", ""),
//       process.env.JWT_SECRET
//     );
//     req.user = decoded;
//     next();
//   } catch {
//     res.status(401).json({ message: "Invalid token" });
//   }
// };

// // ========== Check Email Exists ==========
// router.post("/check-email", async (req, res) => {
//   const { email } = req.body;
//   const user = await prisma.users.findUnique({ where: { email } });

//   if (!user)
//     return res.status(404).json({ message: "No account found with this email address" });

//   res.status(200).json({ message: "Email exists", exists: true });
// });

// // ========== Request OTP (Signup) ==========
// router.post("/request-otp", async (req, res) => {
//   const { email } = req.body;

//   try {
//     const otpCode = crypto.randomInt(1000, 9999).toString();
//     const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

//     await prisma.verification_codes.deleteMany({ where: { email } });

//     await prisma.verification_codes.create({
//       data: { email, code: otpCode, expires_at: otpExpiry, verified: 0 },
//     });

//     const msg = {
//       to: email,
//       from: {
//         email: process.env.EMAIL_USER,
//         name: "IFU App",
//       },
//       subject: "Your IFU OTP Code",
//       text: `Your verification code is ${otpCode}. It expires in 10 minutes.`,
//     };

//     await sgMail.send(msg);

//     res.status(200).json({ message: "OTP sent to email", email });
//   } catch (err) {
//     console.error("Error in /request-otp:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

// // ========== Request Password Reset OTP ==========
// router.post("/request-password-reset-otp", async (req, res) => {
//   const { email } = req.body;

//   try {
//     const user = await prisma.users.findUnique({ where: { email } });
//     if (!user)
//       return res.status(404).json({ message: "No account found with this email address" });

//     const otpCode = crypto.randomInt(1000, 9999).toString();
//     const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

//     await prisma.verification_codes.deleteMany({ where: { email } });

//     await prisma.verification_codes.create({
//       data: { email, code: otpCode, expires_at: otpExpiry, verified: 0 },
//     });

//     const msg = {
//       to: email,
//       from: {
//         email: process.env.EMAIL_USER,
//         name: "IFU App",
//       },
//       subject: "Password Reset OTP",
//       text: `Your password reset verification code is ${otpCode}. It expires in 10 minutes.`,
//     };

//     await sgMail.send(msg);

//     res.status(200).json({ message: "Password reset OTP sent to email", email });
//   } catch (err) {
//     console.error("Error in /request-password-reset-otp:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

// // ========== Verify OTP ==========
// router.post("/verify-otp", async (req, res) => {
//   const { email, code } = req.body;

//   try {
//     const record = await prisma.verification_codes.findFirst({
//       where: { email, code, expires_at: { gt: new Date() } },
//     });

//     if (!record)
//       return res.status(400).json({ message: "Invalid or expired OTP" });

//     await prisma.verification_codes.updateMany({
//       where: { email },
//       data: { verified: 1 },
//     });

//     res.json({ message: "OTP verified successfully" });
//   } catch (err) {
//     console.error("Error in /verify-otp:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

// // ========== ✅ Verify Password Reset OTP (FOR APK) ==========
// router.post("/verify-password-reset-otp", async (req, res) => {
//   const { email, code } = req.body;

//   try {
//     const record = await prisma.verification_codes.findFirst({
//       where: {
//         email,
//         code,
//         expires_at: { gt: new Date() },
//       },
//     });

//     if (!record) {
//       return res.status(400).json({ message: "Invalid or expired OTP" });
//     }

//     await prisma.verification_codes.updateMany({
//       where: { email, code },
//       data: { verified: 1 },
//     });

//     res.json({ message: "OTP verified successfully" });
//   } catch (err) {
//     console.error("Error in /verify-password-reset-otp:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });


// // ========== Reset Password ==========
// router.post("/reset-password", async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const verifiedOTP = await prisma.verification_codes.findFirst({
//       where: { email, verified: 1 },
//     });

//     if (!verifiedOTP)
//       return res.status(400).json({ message: "Please verify your OTP first" });

//     const hashedPassword = await bcrypt.hash(password, 10);

//     await prisma.users.update({
//       where: { email },
//       data: { password: hashedPassword },
//     });

//     await prisma.verification_codes.deleteMany({ where: { email } });

//     res.status(200).json({ message: "Password reset successfully" });
//   } catch (err) {
//     console.error("Error in /reset-password:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

// // ========== Signup ==========
// router.post("/signup", async (req, res) => {
//   const { name, email, password, zip_code, gender, timezone } = req.body;

//   try {
//     const verifiedOTP = await prisma.verification_codes.findFirst({
//       where: { email, verified: 1 },
//     });

//     if (!verifiedOTP)
//       return res.status(400).json({ message: "Please verify your email first" });

//     const existingUser = await prisma.users.findUnique({ where: { email } });

//     if (existingUser) {
//       await prisma.verification_codes.deleteMany({ where: { email } });
//       return res.status(400).json({ message: "User already exists" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = await prisma.users.create({
//       data: {
//         name,
//         email,
//         password: hashedPassword,
//         zip_code,
//         gender,
//         timezone,
//         profile_completed: 0,
//       },
//     });

//     await prisma.verification_codes.deleteMany({ where: { email } });

//     const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
//       expiresIn: "1d",
//     });

//     res.status(201).json({
//       message: "User registered successfully",
//       token,
//       user: { id: user.id, name, email, gender, zip_code, timezone },
//     });
//   } catch (err) {
//     console.error("Error in /signup:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

// // ========== Login ==========
// router.post("/login", async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const user = await prisma.users.findUnique({ where: { email } });
//     if (!user) return res.status(400).json({ message: "Invalid credentials" });

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch)
//       return res.status(400).json({ message: "Invalid credentials" });

//     const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
//       expiresIn: "1d",
//     });

//     res.json({
//       token,
//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         profileCompleted: user.profile_completed,
//       },
//     });
//   } catch (err) {
//     console.error("Error in /login:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

// // ========== ✅ RESTORED UPDATE PROFILE ==========
// router.put(
//   "/profile",
//   authMiddleware,
//   (req, res, next) => {
//     upload.any()(req, res, (err) => {
//       if (err) return res.status(400).json({ message: err.message });
//       next();
//     });
//   },
//   async (req, res) => {
//     try {
//       const userId = Number(req.user.id);
//       const fields = { ...req.body };

//       const mapping = {
//         ageGroup: "age_group",
//         zipCode: "zip_code",
//         musicTaste: "music_taste",
//         phoneUsage: "phone_usage",
//         favMusician: "fav_musician",
//         favSports: "fav_sports",
//         indoorTime: "indoor_time",
//         outdoorTime: "outdoor_time",
//         favWork: "fav_work",
//         favPlace: "fav_place",
//         movieGenre: "movie_genre",
//         likesToTravel: "likes_to_travel",
//         profileImage: "profile_image",
//       };

//       const data = {};
//       for (const key in fields) {
//         const dbKey = mapping[key] || key;
//         data[dbKey] = fields[key];
//       }

//       ["interests", "goals"].forEach((k) => {
//         if (data[k]) {
//           try {
//             data[k] = JSON.stringify(JSON.parse(data[k]));
//           } catch {
//             data[k] = "[]";
//           }
//         }
//       });

//       if (data.likes_to_travel)
//         data.likes_to_travel =
//           data.likes_to_travel === "1" || data.likes_to_travel === "true" ? 1 : 0;

//       if (req.files?.length > 0) {
//         const imageFile = req.files.find(
//           (f) => f.fieldname === "profile_image"
//         );
//         if (imageFile)
//           data.profile_image = `/uploads/${imageFile.filename}`;
//       }

//       data.profile_completed = 1;

//       const updated = await prisma.users.update({
//         where: { id: userId },
//         data,
//       });

//       res.json(updated);
//     } catch (err) {
//       console.error("Error in /profile update:", err);
//       res.status(500).json({ message: "Server error", error: err.message });
//     }
//   }
// );

// // ========== Get Profile ==========
// router.get("/profile", authMiddleware, async (req, res) => {
//   try {
//     const user = await prisma.users.findUnique({
//       where: { id: req.user.id },
//     });
//     res.json(user);
//   } catch (err) {
//     console.error("Error in /profile get:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

// // ========== Get Current User ==========
// router.get("/me", authMiddleware, async (req, res) => {
//   try {
//     const user = await prisma.users.findUnique({
//       where: { id: req.user.id },
//     });
//     res.json(user);
//   } catch (err) {
//     console.error("Error in /me:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

// module.exports = router;
// module.exports.authMiddleware = authMiddleware;
