// routes/dpoRoute.js
const express = require("express");
const router = express.Router();

const {
  createDpoToken,
  verifyDpoToken,
} = require("../controller/dpoCtrl");

const { authMiddleware } = require("../middlewares/authMiddleware");



router.post("/create-token", authMiddleware, createDpoToken);
router.post("/verify-token", verifyDpoToken);

module.exports = router;