// routes/userRoute.js
const express = require("express");

const {
  createUser,
  loginUserCtrl,
  loginAdmin,
  handleRefreshToken,
  logout,
  updatePassword,
  forgotPasswordToken,
  resetPassword,

  updatedUser,
  saveAddress,

  getWishlist,
  removeProductFromWishlist,

  userCart,
  getUserCart,
  updateProductQuantityFromCart,
  removeProductFromCart,
  emptyCart,

  createOrder,
  getMyOrders,

  // admin/order
  getAllOrders,
  getSingleOrders,
  updateOrder,

  // admin/users
  getallUser,
  getaUser,
  deleteaUser,
  blockUser,
  unblockUser,

  // analytics
  getMonthWiseOrderIncome,
  getYearlyTotalOrders,
  googleLoginCtrl,
  identifyUserCtrl,
} = require("../controller/userCtrl");

const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const { checkout, paymentVerification } = require("../controller/paymentCtrl");

const router = express.Router();

/* =========================
   AUTH
========================= */
router.post("/google", googleLoginCtrl);
router.post("/identify", identifyUserCtrl);
router.post("/register", createUser);
router.post("/login", loginUserCtrl);
router.post("/admin-login", loginAdmin);

router.get("/refresh", handleRefreshToken);
router.get("/logout", logout);

router.post("/forgot-password-token", forgotPasswordToken);
router.put("/reset-password/:token", resetPassword);
router.put("/password", authMiddleware, updatePassword);

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
router.get("/getMonthWiseOrderIncome", authMiddleware, getMonthWiseOrderIncome);
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
