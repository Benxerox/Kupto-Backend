// routes/userRoute.js
const express = require("express");
const router = express.Router();

const {
  // AUTH
  registerUserCtrl,
  loginUserCtrl,
  googleLoginCtrl,
  identifyUserCtrl,
  loginAdmin,
  handleRefreshToken,
  logout,
  updatePassword,

  // PASSWORD RESET (CODE FLOW)
  forgotPasswordCode,
  verifyResetCode, // ✅ NEW (fixes POST /verify-reset-code 404)
  resetPasswordWithCode,

  // PROFILE
  updatedUser,
  saveAddress,

  // WISHLIST
  getWishlist,
  removeProductFromWishlist,

  // CART
  userCart,
  getUserCart,
  updateProductQuantityFromCart,
  removeProductFromCart,
  emptyCart,

  // ORDERS (USER)
  createOrder,
  getMyOrders,

  // ADMIN: ORDERS
  getAllOrders,
  getSingleOrders,
  updateOrder,

  // ADMIN: USERS
  getallUser,
  getaUser,
  deleteaUser,
  blockUser,
  unblockUser,

  // ANALYTICS
  getMonthWiseOrderIncome,
  getYearlyTotalOrders,

  // OTP
  sendVerificationCodeCtrl,
  verifyCodeCtrl,
} = require("../controller/userCtrl");

const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const { checkout, paymentVerification } = require("../controller/paymentCtrl");

/* =========================
   AUTH
========================= */
router.post("/google", googleLoginCtrl);
router.post("/identify", identifyUserCtrl);
router.post("/register", registerUserCtrl);
router.post("/login", loginUserCtrl);
router.post("/admin-login", loginAdmin);

router.get("/refresh", handleRefreshToken);
router.get("/logout", logout);

// ✅ Password reset by code (email)
router.post("/forgot-password-code", forgotPasswordCode);
router.post("/verify-reset-code", verifyResetCode); // ✅ ADD THIS
router.put("/reset-password-code", resetPasswordWithCode);

// ✅ Logged-in password change
router.put("/password", authMiddleware, updatePassword);

/* =========================
   OTP (NO AUTH)
========================= */
router.post("/send-verification-code", sendVerificationCodeCtrl);
router.post("/verify-code", verifyCodeCtrl);

/* =========================
   PROFILE
========================= */
router.put("/edit-user", authMiddleware, updatedUser);
router.put("/save-address", authMiddleware, saveAddress);

/* =========================
   WISHLIST
========================= */
router.get("/wishlist", authMiddleware, getWishlist);
router.delete("/wishlist/:prodId", authMiddleware, removeProductFromWishlist);

/* =========================
   CART
========================= */
router.post("/cart", authMiddleware, userCart);
router.get("/cart", authMiddleware, getUserCart);

router.put(
  "/update-product-cart/:cartItemId/:newQuantity",
  authMiddleware,
  updateProductQuantityFromCart
);

router.delete(
  "/delete-product-cart/:cartItemId",
  authMiddleware,
  removeProductFromCart
);

router.delete("/empty-cart", authMiddleware, emptyCart);

/* =========================
   PAYMENTS + ORDERS (USER)
========================= */
router.post("/order/checkout", authMiddleware, checkout);
router.post("/order/paymentVerification", authMiddleware, paymentVerification);

router.post("/cart/create-order", authMiddleware, createOrder);
router.get("/getmyorders", authMiddleware, getMyOrders);

/* =========================
   ANALYTICS
========================= */
router.get(
  "/getMonthWiseOrderIncome",
  authMiddleware,
  getMonthWiseOrderIncome
);
router.get("/getyearlyorders", authMiddleware, getYearlyTotalOrders);

/* =========================
   ADMIN: USERS
   ✅ put BEFORE "/:id"
========================= */
router.get("/all-users", authMiddleware, isAdmin, getallUser);
router.put("/block-user/:id", authMiddleware, isAdmin, blockUser);
router.put("/unblock-user/:id", authMiddleware, isAdmin, unblockUser);

/* =========================
   ADMIN: ORDERS
========================= */
router.get("/getallorders", authMiddleware, isAdmin, getAllOrders);
router.get("/getOrder/:id", authMiddleware, isAdmin, getSingleOrders);
router.put("/updateOrder/:id", authMiddleware, isAdmin, updateOrder);

/* =========================
   DYNAMIC ROUTES (MUST BE LAST)
========================= */
router.get("/:id", authMiddleware, isAdmin, getaUser);
router.delete("/:id", authMiddleware, isAdmin, deleteaUser);

module.exports = router;
