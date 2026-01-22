const express = require("express");
const router = express.Router();
const { sendOtp, verifyOtp } = require("../controller/otpCtrl"); // <-- must match filename exactly

router.post("/send", sendOtp);
router.post("/verify", verifyOtp);

module.exports = router;
