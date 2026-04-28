// controllers/userCtrl.js
const User = require("../models/userModel");
const Product = require("../models/productModel");
const Cart = require("../models/cartModel");
const Coupon = require("../models/couponModel");
const Order = require("../models/order.model");

const uniqid = require("uniqid");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");

const { generateToken } = require("../config/jwtToken");
const { generateRefreshToken } = require("../config/refreshToken");
const validateMongoDbId = require("../utils/validateMongodbid");

const sendEmail = require("./emailCtrl");

const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* =========================================================
   ✅ HELPERS
========================================================= */
const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

// ✅ Uganda E.164 normalization (+2567xxxxxxxx)
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

  if (/^\d+$/.test(s) && s.length >= 7 && s.length <= 9) return `+256${s}`;
  if (s.startsWith("+")) return s;

  return "";
};

const normalizeMinQty = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
};

const isMongoDupError = (err) =>
  err && (err.code === 11000 || err?.name === "MongoServerError");

const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  const isCrossSite =
    String(process.env.CROSS_SITE_COOKIES || "").toLowerCase() === "true";
  const cookieDomain = process.env.COOKIE_DOMAIN; // e.g. ".kupto.co"

  const base = {
    httpOnly: true,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };

  if (isProd && isCrossSite) return { ...base, secure: true, sameSite: "none" };
  return { ...base, secure: isProd, sameSite: "lax" };
};

const getClearCookieOptions = () => {
  const opts = getCookieOptions();
  return {
    httpOnly: opts.httpOnly,
    path: opts.path,
    secure: opts.secure,
    sameSite: opts.sameSite,
    ...(opts.domain ? { domain: opts.domain } : {}),
  };
};

const invalidCreds = (res) => {
  res.status(401);
  throw new Error("Invalid Credentials");
};

const toId = (v) => (v && typeof v === "object" ? v._id : v);

const ORDER_STATUSES = ["Ordered", "Shipped", "Delivered", "Cancelled"];

const toMoney = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const requireNonNegativeMoney = (v, fieldName = "amount") => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error(`${fieldName} must be a valid non-negative number`);
    err.statusCode = 400;
    throw err;
  }
  return n;
};

const escapeHtml = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatUGX = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return "UGX 0";
  return `UGX ${num.toLocaleString()}`;
};

const getAdminOrderEmail = () =>
  process.env.ADMIN_ORDER_EMAIL || "kupto2020@gmail.com";

const getEmailLogoUrl = () =>
  String(
    process.env.EMAIL_LOGO_URL ||
      process.env.KUPTO_EMAIL_LOGO_URL ||
      process.env.LOGO_URL ||
      ""
  ).trim();

const getEmailBrandHeaderHtml = ({
  logoUrl = "",
  brandText = "KUPTO",
  align = "left",
  logoHeight = 52,
  brandSize = 34,
}) => {
  const safeLogo = escapeHtml(logoUrl || "");
  const safeBrand = escapeHtml(brandText || "KUPTO");

  if (safeLogo) {
    return `
      <div style="text-align:center;">
        <img
          src="${safeLogo}"
          alt="${safeBrand}"
          style="display:block; margin:0 auto; height:${Number(logoHeight) || 52}px; width:auto; max-width:220px;"
        />
      </div>
    `;
  }

  return `
    <div style="text-align:${align}; font-size:${Number(brandSize) || 34}px; font-weight:800; letter-spacing:0.5px; color:#111;">
      ${safeBrand}
    </div>
  `;
};

const EMAIL_FONT_FAMILY = `"TT Travels Next", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

const PAYMENT_METHODS = ["cashOnDelivery", "dpo"];

const getPaymentMethodLabel = (method = "") => {
  const m = String(method || "").trim();

  if (m === "cashOnDelivery") return "Cash on Delivery";
  if (m === "dpo") return "DPO Pay";

  return m || "Not specified";
};

const getPaymentProviderFromMethod = (method = "") => {
  const m = String(method || "").trim();

  if (m === "dpo") return "DPO";
  if (m === "cashOnDelivery") return null;

  return null;
};

const formatOrderDatePretty = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatOrderDateRange = (startValue, endValue) => {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;

  if (start && !Number.isNaN(start.getTime()) && end && !Number.isNaN(end.getTime())) {
    const s = start.toLocaleDateString("en-GB");
    const e = end.toLocaleDateString("en-GB");
    return `${s} and ${e}`;
  }

  if (start && !Number.isNaN(start.getTime())) {
    return start.toLocaleDateString("en-GB");
  }

  return "soon";
};

const buildOrderNumber = (order) => {
  return String(order?.orderNumber || order?._id || "").toUpperCase();
};

const buildTrackingNumber = (order) => {
  if (order?.trackingNumber) return String(order.trackingNumber);

  const shortId = String(order?._id || "").slice(-6).toUpperCase();
  const orderNo = String(order?.orderNumber || order?._id || "")
    .slice(-8)
    .toUpperCase();

  if (!orderNo && !shortId) return "";
  return `KP-${orderNo || "ORDER"}-${shortId || "000000"}`;
};

const getEmailItemImage = (item) => {
  if (item?.variantImage) return String(item.variantImage);

  const product = item?.product;
  if (!product || typeof product !== "object") return "";

  const imgs = Array.isArray(product.images) ? product.images : [];
  if (!imgs.length) return "";

  const first = imgs[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object") return first.url || "";

  return "";
};

const getEmailItemTitle = (item) => {
  const product = item?.product;
  if (!product) return "Product";
  if (typeof product === "object") return product.title || product.name || "Product";
  return "Product";
};

const getVariantText = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.title || value.name || value.label || "";
  return String(value);
};

/* =========================================================
   ✅ REFRESH TOKEN HELPERS (MULTI-DEVICE SAFE)
========================================================= */

/**
 * Supports:
 * - new schema: refreshTokens: [String]
 * - legacy schema: refreshToken: String
 */

const MAX_REFRESH_TOKENS_PER_USER = 10;

const getUserRefreshTokens = (user) => {
  if (!user) return [];
  if (Array.isArray(user.refreshTokens)) {
    return user.refreshTokens.filter(Boolean).map(String);
  }
  return [];
};

const setUserRefreshTokens = (user, tokens = []) => {
  user.refreshTokens = [...new Set((tokens || []).filter(Boolean).map(String))];
};

const addRefreshTokenToUser = (user, token) => {
  const existing = getUserRefreshTokens(user).filter((t) => t !== String(token));
  existing.push(String(token));

  const trimmed =
    existing.length > MAX_REFRESH_TOKENS_PER_USER
      ? existing.slice(existing.length - MAX_REFRESH_TOKENS_PER_USER)
      : existing;

  setUserRefreshTokens(user, trimmed);

  if ("refreshToken" in user) user.refreshToken = "";
};

const removeRefreshTokenFromUser = (user, token) => {
  const remaining = getUserRefreshTokens(user).filter((t) => t !== String(token));
  setUserRefreshTokens(user, remaining);

  if (String(user.refreshToken || "") === String(token)) {
    user.refreshToken = "";
  }
};

const hasRefreshToken = (user, token) => {
  const target = String(token || "");
  if (!target || !user) return false;

  if (getUserRefreshTokens(user).includes(target)) return true;

  return String(user.refreshToken || "") === target;
};

const findUserByRefreshToken = async (token) => {
  const found = await User.findOne({
    $or: [{ refreshTokens: token }, { refreshToken: token }],
  }).select("+refreshToken");

  return found;
};

const issueSession = async (res, user) => {
  const refreshToken = generateRefreshToken(user._id);
  addRefreshTokenToUser(user, refreshToken);
  await user.save();

  res.cookie("refreshToken", refreshToken, getCookieOptions());

  return {
    success: true,
    id: user._id,
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    mobile: user.mobile,
    token: generateToken(user._id),
  };
};

const generateAdminOrderNotificationHtml = (
  order,
  shippingInfo = {},
  orderItems = [],
  totalPrice = 0,
  paymentInfo = {},
  note = ""
) => {
  const paymentMethod = escapeHtml(
    getPaymentMethodLabel(paymentInfo?.paymentMethod || "")
  );
  const payStatus = escapeHtml(paymentInfo?.status || "Pending");
  const provider = paymentInfo?.provider
    ? escapeHtml(paymentInfo.provider)
    : "";
  const transactionId = paymentInfo?.transactionId
    ? escapeHtml(paymentInfo.transactionId)
    : "";
  const logoUrl = getEmailLogoUrl();

  const itemsHtml = (Array.isArray(orderItems) ? orderItems : [])
    .map((item) => {
      const productTitle = escapeHtml(
        item?.product?.title || item?.product?.name || "Product"
      );
      const qty = Number(item?.quantity || 1);
      const unitPrice = formatUGX(item?.unitPrice || 0);
      const colorLabel = escapeHtml(
        item?.color?.title || item?.color?.name || item?.color || "Not specified"
      );
      const sizeLabel = escapeHtml(
        item?.size?.title || item?.size?.name || item?.size || "Not specified"
      );
      const instruction = escapeHtml(item?.instruction || "None");
      const printPricingTitle = escapeHtml(item?.printPricingTitle || "");
      const printSide =
        item?.printSide === "oneSide"
          ? "One-side"
          : item?.printSide === "twoSide"
          ? "Two-side"
          : "";

      return `
        <tr>
          <td style="padding:10px; border:1px solid #eee;">${productTitle}</td>
          <td style="padding:10px; border:1px solid #eee; text-align:center;">${qty}</td>
          <td style="padding:10px; border:1px solid #eee;">${escapeHtml(unitPrice)}</td>
          <td style="padding:10px; border:1px solid #eee;">${colorLabel}</td>
          <td style="padding:10px; border:1px solid #eee;">${sizeLabel}</td>
          <td style="padding:10px; border:1px solid #eee;">
            ${instruction}
            ${
              printPricingTitle || printSide
                ? `<div style="margin-top:6px; color:#666;">
                     <strong>Print:</strong> ${printPricingTitle || "—"}${
                    printSide ? ` • ${escapeHtml(printSide)}` : ""
                  }
                   </div>`
                : ""
            }
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family:${EMAIL_FONT_FAMILY}; color:#111; max-width:760px; margin:0 auto; padding:18px; background:#f7f7f7;">
      <div style="background:#ffffff; padding:18px; border:1px solid #eee; border-radius:12px;">
        <div style="padding-bottom:16px; border-bottom:1px solid #f0f0f0; margin-bottom:16px;">
          ${getEmailBrandHeaderHtml({
            logoUrl,
            brandText: "KUPTO",
            align: "center",
            logoHeight: 54,
            brandSize: 34,
          })}
        </div>

          <h1 style="margin:0 0 12px; font-size:22px;">
            Order Created - Awaiting Payment
          </h1>

        <div style="font-size:13px; color:#222; line-height:1.8;">
          <div><strong>Order ID:</strong> ${escapeHtml(order?._id || "")}</div>
          <div><strong>Order Number:</strong> ${escapeHtml(buildOrderNumber(order))}</div>
          <div><strong>Customer:</strong> ${escapeHtml(
            shippingInfo?.firstName || ""
          )} ${escapeHtml(shippingInfo?.lastName || "")}</div>
          <div><strong>Email:</strong> ${escapeHtml(shippingInfo?.email || "")}</div>
          <div><strong>Phone:</strong> ${escapeHtml(shippingInfo?.phone || "")}</div>
          <div><strong>Address:</strong> ${escapeHtml(
            shippingInfo?.address || ""
          )}, ${escapeHtml(shippingInfo?.region || "")}${
    shippingInfo?.subRegion ? `, ${escapeHtml(shippingInfo.subRegion)}` : ""
  }</div>
          <div><strong>Delivery Method:</strong> ${escapeHtml(
            shippingInfo?.deliveryMethod === "pickup" ? "Pick Up" : "Delivery"
          )}</div>
          ${
            shippingInfo?.pickupStation
              ? `<div><strong>Pick Up Station:</strong> ${escapeHtml(
                  shippingInfo.pickupStation
                )}</div>`
              : ""
          }
          <div><strong>Payment Method:</strong> ${paymentMethod}</div>
          <div><strong>Payment Status:</strong> ${payStatus}</div>
          ${provider ? `<div><strong>Provider:</strong> ${provider}</div>` : ""}
          ${
            transactionId
              ? `<div><strong>Transaction ID:</strong> ${transactionId}</div>`
              : ""
          }
          <div><strong>Total Amount:</strong> ${escapeHtml(formatUGX(totalPrice))}</div>
          ${
            note
              ? `<div><strong>Customer Note:</strong> ${escapeHtml(note)}</div>`
              : ""
          }
        </div>

        <hr style="border:none; border-top:1px solid #eee; margin:16px 0;" />

        <h3 style="margin:0 0 10px; font-size:16px;">Ordered Items</h3>

        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#fafafa;">
              <th style="padding:10px; border:1px solid #eee; text-align:left;">Product</th>
              <th style="padding:10px; border:1px solid #eee; text-align:center;">Qty</th>
              <th style="padding:10px; border:1px solid #eee; text-align:left;">Unit Price</th>
              <th style="padding:10px; border:1px solid #eee; text-align:left;">Color</th>
              <th style="padding:10px; border:1px solid #eee; text-align:left;">Size</th>
              <th style="padding:10px; border:1px solid #eee; text-align:left;">Instruction</th>
            </tr>
          </thead>
          <tbody>
            ${
              itemsHtml ||
              `<tr><td colspan="6" style="padding:10px; border:1px solid #eee; color:#777;">No items found.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
};

/* =========================================================
   ✅ ORDER CONFIRMATION HTML (CLIENT EMAIL)
========================================================= */
const generateOrderConfirmationHtml = (
  order,
  shippingInfo = {},
  orderItems = [],
  totalPrice = 0,
  paymentInfo = {}
) => {
  const orderNumber = escapeHtml(buildOrderNumber(order));
  const trackingNumber = escapeHtml(buildTrackingNumber(order));

  const customerName = escapeHtml(
    `${shippingInfo?.firstName || ""} ${shippingInfo?.lastName || ""}`.trim() || "Customer"
  );

  const deliveryText = escapeHtml(
    formatOrderDateRange(
      order?.deliveryEstimateStart || order?.estimatedDeliveryDate || order?.createdAt,
      order?.deliveryEstimateEnd || order?.estimatedDeliveryDate || order?.createdAt
    )
  );

  const expectedByText = escapeHtml(
    formatOrderDatePretty(
      order?.deliveryEstimateEnd || order?.estimatedDeliveryDate || order?.createdAt
    )
  );

  const paymentLabel = escapeHtml(
    getPaymentMethodLabel(paymentInfo?.paymentMethod || "")
  );

  const itemsTotal = Array.isArray(orderItems)
    ? orderItems.reduce((sum, item) => {
        const qty = Math.max(1, Number(item?.quantity || 1));
        const unit = Number(item?.unitPrice || 0);
        return sum + qty * unit;
      }, 0)
    : 0;

  const shippingFee = Math.max(0, Number(order?.shippingPrice || 0));
  const discountAmount = 0;

  const firstItem = Array.isArray(orderItems) && orderItems.length ? orderItems[0] : null;
  const firstItemImage = getEmailItemImage(firstItem);
  const firstItemTitle = escapeHtml(getEmailItemTitle(firstItem));
  const totalItems = Array.isArray(orderItems) ? orderItems.length : 0;
  const logoUrl = getEmailLogoUrl();

  const itemRows = (Array.isArray(orderItems) ? orderItems : [])
    .map((item) => {
      const title = escapeHtml(getEmailItemTitle(item));
      const qty = Math.max(1, Number(item?.quantity || 1));
      const unitPrice = Number(item?.unitPrice || 0);
      const color = escapeHtml(getVariantText(item?.color) || "");
      const size = escapeHtml(getVariantText(item?.size) || "");
      const instruction = escapeHtml(item?.instruction || "");
      const printSide =
        item?.printSide === "oneSide"
          ? "One side"
          : item?.printSide === "twoSide"
          ? "Two side"
          : "";
      const printPricingTitle = escapeHtml(item?.printPricingTitle || "");
      const imageUrl = getEmailItemImage(item);

      return `
        <tr>
          <td style="padding:16px 12px; border-bottom:1px solid #eee; vertical-align:top;">
            <div style="display:flex; gap:12px; align-items:flex-start;">
             <div style="width:88px; min-width:88px; height:88px; margin-right:12px; border-radius:8px; overflow:hidden; border:1px solid #eee; background:#fff;">
                ${
                  imageUrl
                    ? `<img src="${escapeHtml(imageUrl)}" alt="${title}" style="width:100%; height:100%; object-fit:contain; display:block;" />`
                    : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:12px; color:#999;">No image</div>`
                }
              </div>

              <div style="flex:1;">
                <div style="font-size:16px; font-weight:700; color:#111; margin-bottom:6px;">
                  ${title}
                </div>

                ${
                  color || size || instruction || printPricingTitle || printSide
                    ? `<div style="font-size:13px; color:#666; line-height:1.6;">
                        ${color ? `<div><strong>Color:</strong> ${color}</div>` : ""}
                        ${size ? `<div><strong>Size:</strong> ${size}</div>` : ""}
                        ${
                          printPricingTitle || printSide
                            ? `<div><strong>Printing:</strong> ${printPricingTitle || "Print"}${
                                printSide ? ` • ${printSide}` : ""
                              }</div>`
                            : ""
                        }
                        ${
                          instruction
                            ? `<div><strong>Instructions:</strong> ${instruction}</div>`
                            : ""
                        }
                      </div>`
                    : ""
                }
              </div>
            </div>
          </td>

          <td style="padding:16px 12px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle; font-size:16px; color:#111;">
            ${qty}
          </td>

          <td style="padding:16px 12px; border-bottom:1px solid #eee; text-align:right; vertical-align:middle; font-size:16px; font-weight:700; color:#111;">
            ${escapeHtml(formatUGX(unitPrice))}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
  <div style="margin:0; padding:0; background:#f5f5f5;">
    <div style="max-width:760px; margin:0 auto; padding:24px 12px; font-family:${EMAIL_FONT_FAMILY}; color:#111;">
      <div style="background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #ececec;">

        <div style="padding:28px 28px 18px; border-bottom:1px solid #f0f0f0;">
          ${getEmailBrandHeaderHtml({
            logoUrl,
            brandText: "KUPTO",
            align: "left",
            logoHeight: 54,
            brandSize: 34,
          })}
        </div>

        <div style="padding:28px;">
          <div style="font-size:18px; color:#222; margin-bottom:10px;">
            Hi ${customerName},
          </div>

          <div style="font-size:14px; line-height:1.2; font-weight:700; color:#111; margin-bottom:14px;">
            Your order has been created and is awaiting payment.
          </div>

          <div style="font-size:14px; line-height:1.7; color:#333; margin-bottom:24px;">
            Thank you for shopping with Kupto. Your order
            <strong>${orderNumber}</strong> has been created and is currently awaiting payment confirmation.<br />
            We'll deliver your package to your address between
            <strong>${deliveryText}</strong>. You'll get a notification when it's out for delivery.
          </div>

          

          <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
            <thead>
              <tr style="background:#f2e4cf;">
                <th style="padding:14px 12px; text-align:left; font-size:14px; color:#222;">ITEM</th>
                <th style="padding:14px 12px; text-align:center; font-size:14px; color:#222; width:90px;">QTY</th>
                <th style="padding:14px 12px; text-align:right; font-size:14px; color:#222; width:140px;">PRICE</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows || `
                <tr>
                  <td colspan="3" style="padding:18px; border-bottom:1px solid #eee; color:#777;">
                    No items found.
                  </td>
                </tr>
              `}
            </tbody>
          </table>

          <table style="width:100%; border-collapse:collapse; margin-bottom:26px;">
            <tr>
              <td style="padding:12px 16px; border:1px solid #eee; border-bottom:none; font-size:15px; color:#222;">Delivery Fees</td>
              <td style="padding:12px 16px; border:1px solid #eee; border-bottom:none; text-align:right; font-size:15px; color:#222;">${escapeHtml(formatUGX(shippingFee))}</td>
            </tr>

            <tr>
              <td style="padding:12px 16px; border-left:1px solid #eee; border-right:1px solid #eee; border-bottom:none; font-size:15px; color:#222;">Discount</td>
              <td style="padding:12px 16px; border-left:1px solid #eee; border-right:1px solid #eee; border-bottom:none; text-align:right; font-size:15px; color:#d28b00;">- ${escapeHtml(formatUGX(discountAmount))}</td>
            </tr>

            <tr>
              <td style="padding:14px 16px; border:1px solid #eee; font-size:18px; font-weight:800; color:#111;">Total</td>
              <td style="padding:14px 16px; border:1px solid #eee; text-align:right; font-size:20px; font-weight:800; color:#16a34a;">${escapeHtml(formatUGX(totalPrice || (itemsTotal + shippingFee)))}</td>
            </tr>

            <tr>
              <td style="padding:14px 16px; border:1px solid #eee; border-top:none; font-size:15px; color:#222;">Payment Method</td>
              <td style="padding:14px 16px; border:1px solid #eee; border-top:none; text-align:right; font-size:15px; color:#222;">${paymentLabel}</td>
            </tr>
          </table>

          <div style="font-size:15px; color:#444; margin-bottom:10px;">
            If you need help, please contact our support team.
          </div>

          <div style="font-size:15px; color:#444; margin-bottom:18px;">
            Thanks for choosing Kupto!
          </div>

          <div style="font-size:28px; font-weight:700; color:#111; margin-bottom:20px;">
            Kupto Team
          </div>

          <div style="font-size:12px; color:#888; line-height:1.7; border-top:1px solid #f0f0f0; padding-top:18px;">
            
            This is an order status email for order <strong>${orderNumber}</strong>.
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
};

/* =========================================================
   ✅ AUTH
========================================================= */

// ✅ REGISTER
const registerUserCtrl = asyncHandler(async (req, res) => {
  const { firstname, lastname, email, mobile, dob, password } = req.body;

  if (!firstname || !lastname || !mobile || !dob || !password) {
    res.status(400);
    throw new Error("firstname, lastname, mobile, dob and password are required");
  }

  const cleanEmail = email ? normalizeEmail(email) : undefined;
  const cleanMobile = normalizeMobile(mobile);

  if (!cleanMobile) {
    res.status(400);
    throw new Error("mobile is not valid");
  }

  const or = [{ mobile: cleanMobile }];
  if (cleanEmail) or.push({ email: cleanEmail });

  const exists = await User.findOne({ $or: or });
  if (exists) {
    res.status(409);
    throw new Error("User already exists with this email or phone");
  }

  try {
    const newUser = await User.create({
      firstname: String(firstname).trim(),
      lastname: String(lastname).trim(),
      email: cleanEmail,
      mobile: cleanMobile,
      dob: new Date(dob),
      password,
      provider: "local",
      refreshTokens: [],
    });

    const sessionPayload = await issueSession(res, newUser);

    return res.status(201).json(sessionPayload);
  } catch (err) {
    if (isMongoDupError(err)) {
      res.status(409);
      throw new Error("Email or phone already exists");
    }
    throw err;
  }
});

// ✅ LOGIN (email OR phone)
const loginUserCtrl = asyncHandler(async (req, res) => {
  const { identity, type, email, mobile, password } = req.body;

  const incomingIdentity = identity || email || mobile;
  const incomingType =
    type ||
    (identity && String(identity).includes("@") ? "email" : "phone") ||
    (email ? "email" : "phone");

  if (!incomingIdentity || !password) {
    res.status(400);
    throw new Error("identity and password are required");
  }

  const query =
    incomingType === "email"
      ? { email: normalizeEmail(incomingIdentity) }
      : { mobile: normalizeMobile(incomingIdentity) };

  const user = await User.findOne(query).select("+password");
  if (!user) return invalidCreds(res);

  if (user.isBlocked) {
    res.status(403);
    throw new Error("Account is blocked");
  }

  const ok = await user.isPasswordMatched(password);
  if (!ok) return invalidCreds(res);

  const sessionPayload = await issueSession(res, user);

  res.json(sessionPayload);
});

// ✅ GOOGLE LOGIN
const googleLoginCtrl = asyncHandler(async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    res.status(400);
    throw new Error("Missing Google credential");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  const googleId = payload?.sub;
  const email = payload?.email;
  const emailVerified = payload?.email_verified;
  const fullName = payload?.name || "";
  const picture = payload?.picture || "";

  if (!email || !emailVerified) {
    res.status(401);
    throw new Error("Google email is not verified");
  }

  const cleanEmail = normalizeEmail(email);
  let user = await User.findOne({ email: cleanEmail });

  if (!user) {
    const parts = String(fullName).trim().split(" ");
    const firstname = parts[0] || "Kupto";
    const lastname = parts.slice(1).join(" ") || "User";

    return res.status(200).json({
      success: true,
      profileRequired: true,
      message: "Complete profile to finish signup",
      googleProfile: {
        googleId,
        email: cleanEmail,
        firstname,
        lastname,
        picture,
      },
    });
  }

  if (user.isBlocked) {
    res.status(403);
    throw new Error("Account is blocked");
  }

  let changed = false;
  if (googleId && !user.googleId) {
    user.googleId = googleId;
    changed = true;
  }
  if ((!user.provider || user.provider === "local") && googleId) {
    user.provider = "google";
    changed = true;
  }
  if (picture && !user.picture) {
    user.picture = picture;
    changed = true;
  }
  if (changed) {
    await user.save();
  }

  const sessionPayload = await issueSession(res, user);

  res.json({
    ...sessionPayload,
    profileRequired: false,
  });
});

// ✅ GOOGLE COMPLETE PROFILE
const completeGoogleProfileCtrl = asyncHandler(async (req, res) => {
  const {
    firstname,
    lastname,
    mobile,
    dob,
    email,
    picture,
    provider,
    googleId,
  } = req.body;

  if (!firstname || !lastname || !mobile || !dob || !email) {
    res.status(400);
    throw new Error("firstname, lastname, mobile, dob and email are required");
  }

  const cleanEmail = normalizeEmail(email);
  const cleanMobile = normalizeMobile(mobile);

  if (!cleanEmail) {
    res.status(400);
    throw new Error("email is not valid");
  }

  if (!cleanMobile) {
    res.status(400);
    throw new Error("mobile is not valid");
  }

  const dobDate = new Date(dob);
  if (Number.isNaN(dobDate.getTime())) {
    res.status(400);
    throw new Error("dob is not valid");
  }

  const existingByEmail = await User.findOne({ email: cleanEmail });

  if (existingByEmail) {
    if (existingByEmail.isBlocked) {
      res.status(403);
      throw new Error("Account is blocked");
    }

    const anotherWithMobile =
      existingByEmail.mobile && existingByEmail.mobile !== cleanMobile
        ? await User.findOne({
            mobile: cleanMobile,
            _id: { $ne: existingByEmail._id },
          })
        : null;

    if (anotherWithMobile) {
      res.status(409);
      throw new Error("Phone number is already used by another account");
    }

    existingByEmail.firstname = String(firstname).trim();
    existingByEmail.lastname = String(lastname).trim();
    existingByEmail.mobile = cleanMobile;
    existingByEmail.dob = dobDate;

    if (googleId && !existingByEmail.googleId) {
      existingByEmail.googleId = googleId;
    }

    if (picture && !existingByEmail.picture) {
      existingByEmail.picture = picture;
    }

    existingByEmail.provider = provider || "google";

    await existingByEmail.save();

    const sessionPayload = await issueSession(res, existingByEmail);

    return res.status(200).json({
      ...sessionPayload,
      user: {
        _id: existingByEmail._id,
        firstname: existingByEmail.firstname,
        lastname: existingByEmail.lastname,
        email: existingByEmail.email,
        mobile: existingByEmail.mobile,
        dob: existingByEmail.dob,
        provider: existingByEmail.provider,
        googleId: existingByEmail.googleId || "",
        picture: existingByEmail.picture || "",
      },
    });
  }

  const existingByMobile = await User.findOne({ mobile: cleanMobile });
  if (existingByMobile) {
    res.status(409);
    throw new Error("User already exists with this phone");
  }

  try {
    const newUser = await User.create({
      firstname: String(firstname).trim(),
      lastname: String(lastname).trim(),
      email: cleanEmail,
      mobile: cleanMobile,
      dob: dobDate,
      provider: provider || "google",
      googleId: googleId || "",
      picture: picture || "",
      refreshTokens: [],
    });

    const sessionPayload = await issueSession(res, newUser);

    return res.status(201).json({
      ...sessionPayload,
      user: {
        _id: newUser._id,
        firstname: newUser.firstname,
        lastname: newUser.lastname,
        email: newUser.email,
        mobile: newUser.mobile,
        dob: newUser.dob,
        provider: newUser.provider,
        googleId: newUser.googleId || "",
        picture: newUser.picture || "",
      },
    });
  } catch (err) {
    if (isMongoDupError(err)) {
      res.status(409);
      throw new Error("Email or phone already exists");
    }
    throw err;
  }
});

// ✅ IDENTIFY USER
const identifyUserCtrl = asyncHandler(async (req, res) => {
  const { identity, type } = req.body;

  if (!identity) {
    return res.status(400).json({ exists: false, message: "identity is required" });
  }

  const v = String(identity).trim();

  let user = null;
  let normalized = "";
  let outType = "phone";

  if (type === "email" || v.includes("@")) {
    outType = "email";
    normalized = normalizeEmail(v);
    user = await User.findOne({ email: normalized }).select("_id email mobile");
  } else {
    outType = "phone";
    normalized = normalizeMobile(v);

    const digits = normalized.replace(/[^\d]/g, "");
    const national = digits.startsWith("256") ? digits.slice(3) : digits;
    const legacy0 = national ? "0" + national : "";

    const candidates = [
      normalized,
      digits,
      national,
      legacy0,
      v.replace(/[^\d+]/g, ""),
    ].filter(Boolean);

    user = await User.findOne({ mobile: { $in: candidates } }).select(
      "_id email mobile"
    );
  }

  return res.status(200).json({
    exists: Boolean(user),
    type: outType,
    normalized,
  });
});

// ✅ ADMIN LOGIN
const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const findAdmin = await User.findOne({ email: normalizeEmail(email) }).select(
    "+password"
  );

  if (!findAdmin || findAdmin.role !== "admin") {
    res.status(403);
    throw new Error("Not Authorized");
  }

  if (findAdmin.isBlocked) {
    res.status(403);
    throw new Error("Account is blocked");
  }

  const passwordMatch = await findAdmin.isPasswordMatched(password);
  if (!passwordMatch) return invalidCreds(res);

  const sessionPayload = await issueSession(res, findAdmin);

  res.json(sessionPayload);
});

// ✅ HANDLE REFRESH TOKEN
const handleRefreshToken = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) {
    res.status(401);
    throw new Error("No Refresh Token in Cookies");
  }

  const refreshToken = String(cookie.refreshToken || "");
  const user = await findUserByRefreshToken(refreshToken);

  if (!user || !hasRefreshToken(user, refreshToken)) {
    res.status(401);
    throw new Error("No Refresh Token Present in DB or not matched");
  }

  try {
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret) {
      res.status(500);
      throw new Error("JWT refresh secret is missing on server");
    }

    const decoded = jwt.verify(refreshToken, refreshSecret);

    if (String(user._id) !== String(decoded.id)) {
      res.status(401);
      throw new Error("There is something wrong with the refresh token");
    }

    removeRefreshTokenFromUser(user, refreshToken);

    const newRefreshToken = generateRefreshToken(user._id);
    addRefreshTokenToUser(user, newRefreshToken);

    await user.save();

    res.cookie("refreshToken", newRefreshToken, getCookieOptions());

    const accessToken = generateToken(user._id);
    res.json({ token: accessToken, accessToken });
  } catch (err) {
    removeRefreshTokenFromUser(user, refreshToken);
    await user.save();

    res.clearCookie("refreshToken", getClearCookieOptions());
    res.status(401);
    throw new Error("Invalid or expired refresh token");
  }
});

// ✅ LOGOUT
const logout = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) return res.sendStatus(204);

  const refreshToken = String(cookie.refreshToken || "");
  const user = await findUserByRefreshToken(refreshToken);

  if (!user) {
    res.clearCookie("refreshToken", getClearCookieOptions());
    return res.sendStatus(204);
  }

  removeRefreshTokenFromUser(user, refreshToken);
  await user.save();

  res.clearCookie("refreshToken", getClearCookieOptions());
  res.sendStatus(204);
});

/* =========================================================
   ✅ PROFILE
========================================================= */
const updatedUser = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    const payload = {
      firstname: req?.body?.firstname,
      lastname: req?.body?.lastname,
      email: req?.body?.email ? normalizeEmail(req.body.email) : undefined,
      mobile: req?.body?.mobile ? normalizeMobile(req.body.mobile) : undefined,
    };

    if (req?.body?.mobile && !payload.mobile) {
      res.status(400);
      throw new Error("mobile is not valid");
    }

    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const user = await User.findByIdAndUpdate(_id, payload, { new: true }).select(
      "-password -refreshToken -refreshTokens"
    );

    res.json(user);
  } catch (error) {
    if (isMongoDupError(error)) {
      res.status(409);
      throw new Error("Email or phone already exists");
    }
    throw new Error(error);
  }
});

const saveAddress = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  const user = await User.findByIdAndUpdate(
    _id,
    { address: req?.body?.address },
    { new: true }
  ).select("-password -refreshToken -refreshTokens");

  res.json(user);
});

/* =========================================================
   ✅ ADMIN: USERS
========================================================= */
const getallUser = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password -refreshToken -refreshTokens");
  res.json(users);
});

const getaUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const user = await User.findById(id).select("-password -refreshToken -refreshTokens");
  res.json({ getaUser: user });
});

const deleteaUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const user = await User.findByIdAndDelete(id).select(
    "-password -refreshToken -refreshTokens"
  );
  res.json({ deleteaUser: user });
});

const blockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const user = await User.findByIdAndUpdate(id, { isBlocked: true }, { new: true });
  res.json(user);
});

const unblockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  await User.findByIdAndUpdate(id, { isBlocked: false }, { new: true });
  res.json({ message: "User UnBlocked" });
});

/* =========================================================
   ✅ PASSWORD
========================================================= */
const updatePassword = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { password } = req.body;
  validateMongoDbId(_id);

  const user = await User.findById(_id).select("+password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (password) {
    user.password = password;
    const updatedPassword = await user.save();
    res.json({ success: true, message: "Password updated", id: updatedPassword._id });
  } else {
    res.json({ success: true, message: "No password provided" });
  }
});

/* =========================================================
   ✅ WISHLIST
========================================================= */
const getWishlist = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const user = await User.findById(_id).populate("wishlist");
  res.json(user);
});

const removeProductFromWishlist = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { prodId } = req.params;

  validateMongoDbId(_id);
  validateMongoDbId(prodId);

  const user = await User.findByIdAndUpdate(
    _id,
    { $pull: { wishlist: prodId } },
    { new: true }
  ).populate("wishlist");

  res.json(user);
});

/* =========================================================
   ✅ CART
========================================================= */
const userCart = asyncHandler(async (req, res) => {
  const {
    productId,
    color,
    quantity,
    size,
    price,
    uploadedFiles,
    instruction,
    variantImage,
    printSide,
    printUnitPrice,
    printKey,
    printPricingTitle,
    preparePriceOnce,
    preparePriceApplied,
    printDiscountMinQty,
  } = req.body;

  const { _id } = req.user;
  validateMongoDbId(_id);
  validateMongoDbId(productId);

  const qty = Math.max(1, Number(quantity || 1));

  const cleanPrintDiscountMinQty =
    printDiscountMinQty !== undefined ? normalizeMinQty(printDiscountMinQty) : undefined;

  const existing = await Cart.findOne({
    userId: _id,
    productId,
    color: color || null,
    size: size || null,
    printSide: printSide || "",
    printKey: printKey || "",
  });

  if (existing) {
    existing.quantity = Number(existing.quantity || 0) + qty;

    if (price != null) existing.price = Number(price);
    if (variantImage != null) existing.variantImage = variantImage;

    existing.instruction = instruction ?? existing.instruction ?? null;

    existing.printSide = printSide ?? existing.printSide ?? "";
    existing.printUnitPrice =
      printUnitPrice != null
        ? Number(printUnitPrice)
        : Number(existing.printUnitPrice || 0);

    existing.printKey = printKey ?? existing.printKey ?? "";
    existing.printPricingTitle =
      printPricingTitle ?? existing.printPricingTitle ?? "";

    existing.preparePriceOnce =
      preparePriceOnce != null
        ? Number(preparePriceOnce)
        : Number(existing.preparePriceOnce || 0);

    existing.preparePriceApplied =
      preparePriceApplied != null
        ? Boolean(preparePriceApplied)
        : Boolean(existing.preparePriceApplied);

    if (cleanPrintDiscountMinQty !== undefined) {
      existing.printDiscountMinQty = cleanPrintDiscountMinQty;
    }

    if (Array.isArray(uploadedFiles) && uploadedFiles.length) {
      existing.uploadedFiles = [...(existing.uploadedFiles || []), ...uploadedFiles];
    }

    await existing.save();
    return res.json(existing);
  }

  const newCart = await Cart.create({
    userId: _id,
    productId,
    color: color || null,
    size: size || null,
    price: Number(price),
    quantity: qty,
    uploadedFiles: Array.isArray(uploadedFiles) ? uploadedFiles : [],
    instruction: instruction ?? null,

    variantImage: variantImage ?? "",
    printSide: printSide ?? "",
    printUnitPrice: Number(printUnitPrice || 0),
    printKey: printKey ?? "",
    printPricingTitle: printPricingTitle ?? "",
    preparePriceOnce: Number(preparePriceOnce || 0),
    preparePriceApplied: Boolean(preparePriceApplied || false),

    printDiscountMinQty: normalizeMinQty(printDiscountMinQty),
  });

  return res.json(newCart);
});

const getUserCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  const cart = await Cart.find({ userId: _id })
    .populate("productId")
    .populate("color")
    .populate("size");

  return res.status(200).json(cart || []);
});

const removeProductFromCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { cartItemId } = req.params;

  validateMongoDbId(_id);
  validateMongoDbId(cartItemId);

  const deleted = await Cart.deleteOne({ userId: _id, _id: cartItemId });
  res.json(deleted);
});

const updateProductQuantityFromCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { cartItemId, newQuantity } = req.params;

  validateMongoDbId(_id);
  validateMongoDbId(cartItemId);

  const cartItem = await Cart.findOne({ userId: _id, _id: cartItemId });
  if (!cartItem) {
    res.status(404);
    throw new Error("Cart item not found");
  }

  cartItem.quantity = Math.max(1, Number(newQuantity || 1));
  await cartItem.save();

  res.json(cartItem);
});

const emptyCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  const deleted = await Cart.deleteMany({ userId: _id });
  res.json(deleted);
});

/* =========================================================
   ✅ ORDERS
========================================================= */
const createOrder = asyncHandler(async (req, res) => {
  const {
    shippingInfo,
    orderItems,
    itemsTotal,
    shippingPrice,
    setupFeeTotal,
    totalPrice,
    totalPriceAfterDiscount,
    paymentInfo,
    note,
  } = req.body;

  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  if (!shippingInfo) {
    return res.status(400).json({ message: "shippingInfo is required" });
  }

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return res
      .status(400)
      .json({ message: "orderItems must be a non-empty array" });
  }

  if (!paymentInfo || typeof paymentInfo !== "object") {
    return res.status(400).json({ message: "paymentInfo is required" });
  }

  const deliveryMethod =
    String(shippingInfo.deliveryMethod || "").trim() === "pickup"
      ? "pickup"
      : "delivery";

  const safeShipping = {
    firstName: String(shippingInfo.firstName || "").trim(),
    lastName: String(shippingInfo.lastName || "").trim(),
    phone:
      normalizeMobile(shippingInfo.phone || "") ||
      String(shippingInfo.phone || "").trim(),
    email: normalizeEmail(shippingInfo.email || ""),
    address: String(shippingInfo.address || "").trim(),
    region: String(shippingInfo.region || "").trim(),
    subRegion: String(shippingInfo.subRegion || "").trim(),
    deliveryMethod,
    pickupStation: String(shippingInfo.pickupStation || "").trim(),
  };

  if (!safeShipping.firstName || !safeShipping.lastName) {
    return res
      .status(400)
      .json({ message: "shippingInfo firstName and lastName are required" });
  }

  if (!safeShipping.phone) {
    return res.status(400).json({ message: "shippingInfo.phone is required" });
  }

  if (!safeShipping.email) {
    return res.status(400).json({ message: "shippingInfo.email is required" });
  }

  if (deliveryMethod === "pickup") {
    if (!safeShipping.pickupStation) {
      return res
        .status(400)
        .json({ message: "pickupStation is required for pickup orders" });
    }

    if (!safeShipping.address) {
      safeShipping.address = safeShipping.pickupStation;
    }

    if (!safeShipping.region) {
      safeShipping.region = "Pick Up Station";
    }

    if (!safeShipping.subRegion) {
      safeShipping.subRegion = "";
    }
  } else {
    if (!safeShipping.address || !safeShipping.region) {
      return res
        .status(400)
        .json({ message: "shippingInfo is missing required delivery fields" });
    }
  }

  const paymentMethod = String(paymentInfo.paymentMethod || "").trim();
  if (!paymentMethod) {
    return res.status(400).json({ message: "Payment method is required" });
  }

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ message: "Invalid payment method" });
  }

  const detectedProvider = getPaymentProviderFromMethod(paymentMethod);

  const safePaymentInfo = {
    paymentMethod,
    status: paymentInfo.status || "Pending",
    provider:
      detectedProvider ||
      (paymentInfo.provider ? String(paymentInfo.provider).trim() : null),
    transactionId:
      paymentMethod === "cashOnDelivery"
        ? null
        : paymentInfo.transactionId
        ? String(paymentInfo.transactionId).trim()
        : null,
  };

  let computedItemsTotal = 0;

  const safeOrderItems = orderItems.map((it, idx) => {
    const prodId = toId(it.product);
    if (!prodId) {
      const e = new Error(`orderItems[${idx}].product is required`);
      e.statusCode = 400;
      throw e;
    }
    validateMongoDbId(prodId);

    const qty = Math.max(1, Number(it.quantity || 1));
    const unitPrice = requireNonNegativeMoney(
      it.unitPrice,
      `orderItems[${idx}].unitPrice`
    );
    computedItemsTotal += unitPrice * qty;

    const colorId = toId(it.color);
    const sizeId = toId(it.size);
    if (colorId) validateMongoDbId(colorId);
    if (sizeId) validateMongoDbId(sizeId);

    const printSide = String(it.printSide || "").trim();
    const normalizedPrintSide =
      printSide === "oneSide" || printSide === "twoSide" ? printSide : "";

    return {
      product: prodId,
      color: colorId || null,
      size: sizeId || null,
      uploadedFiles: Array.isArray(it.uploadedFiles) ? it.uploadedFiles : [],
      quantity: qty,
      unitPrice,
      printUnitPrice: Math.max(0, toMoney(it.printUnitPrice || 0)),
      printPricingTitle: it.printPricingTitle ? String(it.printPricingTitle).trim() : null,
      printSide: normalizedPrintSide,
      instruction: it.instruction ?? null,
    };
  });

  const safeShippingPrice = Math.max(0, toMoney(shippingPrice));
  const safeSetupFeeTotal = Math.max(0, toMoney(setupFeeTotal));
  const computedTotalPrice = computedItemsTotal + safeShippingPrice + safeSetupFeeTotal;

  if (itemsTotal != null && Math.abs(toMoney(itemsTotal) - computedItemsTotal) > 0.01) {
    return res.status(400).json({ message: "itemsTotal mismatch" });
  }

  if (totalPrice != null && Math.abs(toMoney(totalPrice) - computedTotalPrice) > 0.01) {
    return res.status(400).json({ message: "totalPrice mismatch" });
  }

  const safeTotalPriceAfterDiscount =
    totalPriceAfterDiscount != null
      ? Math.max(0, toMoney(totalPriceAfterDiscount))
      : computedTotalPrice;

  const now = new Date();

    // ✅ Delivery estimate can start the same day the order is placed
  const deliveryEstimateStart = new Date(now);

  const deliveryEstimateEnd = new Date(now);
  deliveryEstimateEnd.setDate(deliveryEstimateEnd.getDate() + 2);

  const order = await Order.create({
    user: userId,
    guestInfo: null,
    shippingInfo: safeShipping,
    orderItems: safeOrderItems,

    itemsTotal: computedItemsTotal,
    shippingPrice: safeShippingPrice,
    setupFeeTotal: safeSetupFeeTotal,

    totalPrice: computedTotalPrice,
    totalPriceAfterDiscount: safeTotalPriceAfterDiscount,

    paymentInfo: safePaymentInfo,
    note: note ?? null,

    orderNumber: uniqid().toUpperCase(),
    trackingNumber: `KP-${uniqid().toUpperCase()}`,
    deliveryEstimateStart,
    deliveryEstimateEnd,
  });

  const receiptTo = (await User.findById(userId).select("email"))?.email || null;
  const adminEmail = getAdminOrderEmail();

  try {
    const fullOrder = await Order.findById(order._id)
      .populate("orderItems.product")
      .populate("orderItems.color")
      .populate("orderItems.size")
      .populate("user");

    const populatedOrder = fullOrder || order;
    const populatedItems = populatedOrder?.orderItems || safeOrderItems;

    const confirmationHtml = generateOrderConfirmationHtml(
      populatedOrder,
      safeShipping,
      populatedItems,
      computedTotalPrice,
      safePaymentInfo
    );

    const isDpoPending =
  safePaymentInfo.paymentMethod === "dpo" &&
  String(safePaymentInfo.status || "").toLowerCase() === "pending";

if (receiptTo) {
  await sendEmail({
    to: receiptTo,
    subject: isDpoPending
      ? `Kupto Order ${buildOrderNumber(populatedOrder)} Created - Awaiting Payment`
      : `Your Kupto Order ${buildOrderNumber(populatedOrder)} has been Confirmed`,
    text: isDpoPending
      ? `Your Kupto order ${buildOrderNumber(populatedOrder)} has been created and is awaiting payment.`
      : `Thank you for shopping with Kupto. Your order ${buildOrderNumber(populatedOrder)} has been confirmed.`,
    html: confirmationHtml,
  });
}

await sendEmail({
  to: adminEmail,
  subject: isDpoPending
    ? `Order Created - Awaiting Payment - ${order._id}`
    : `New Order Received - ${order._id}`,
  text: isDpoPending
    ? `A pending DPO order was created by ${safeShipping.firstName} ${safeShipping.lastName}. Total: ${formatUGX(
        computedTotalPrice
      )}. Awaiting payment.`
    : `A new order has been placed by ${safeShipping.firstName} ${safeShipping.lastName}. Total: ${formatUGX(
        computedTotalPrice
      )}. Payment Method: ${getPaymentMethodLabel(safePaymentInfo.paymentMethod)}.`,
  html: generateAdminOrderNotificationHtml(
    populatedOrder,
    safeShipping,
    populatedItems,
    computedTotalPrice,
    safePaymentInfo,
    note
  ),
});
  } catch (e) {
    console.error("Order email sending failed:", e);
  }

  return res.status(201).json({ success: true, order });
});

const getMyOrders = asyncHandler(async (req, res) => {
  const { _id } = req.user;

  const orders = await Order.find({ user: _id })
    .populate("user")
    .populate("orderItems.product")
    .populate("orderItems.color")
    .populate("orderItems.size");

  res.json({ orders });
});

const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().populate("user");
  res.json({ orders });
});

const getSingleOrders = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const order = await Order.findOne({ _id: id })
    .populate("orderItems.product")
    .populate("orderItems.color")
    .populate("orderItems.size")
    .populate("user");

  res.json({ order });
});

const updateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  validateMongoDbId(id);

  const nextStatus = String(status || "").trim();
  if (!nextStatus) return res.status(400).json({ message: "status is required" });
  if (!ORDER_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ message: "Invalid order status" });
  }

  const order = await Order.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  const current = String(order.orderStatus || "Ordered");
  if (current === "Delivered") {
    return res.status(400).json({ message: "Delivered orders cannot be updated" });
  }

  const isCancelled =
    Boolean(order.isCancelled) ||
    String(order.orderStatus || "").toLowerCase() === "cancelled";

  if (isCancelled && nextStatus !== "Cancelled") {
    return res.status(400).json({ message: "Cancelled orders cannot be re-opened" });
  }

  if (nextStatus === "Cancelled") {
    order.isCancelled = true;
    order.cancelledAt = order.cancelledAt || new Date();
    order.cancelledBy = order.cancelledBy || "admin";
  }

  order.orderStatus = nextStatus;
  await order.save();

  res.json({ order });
});

/* =========================================================
   ✅ ANALYTICS
========================================================= */
const getMonthWiseOrderIncome = asyncHandler(async (req, res) => {
  let d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 11);

  const data = await Order.aggregate([
    { $match: { createdAt: { $gte: d, $lte: new Date() } } },
    {
      $project: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        totalPriceAfterDiscount: 1,
      },
    },
    {
      $group: {
        _id: { year: "$year", month: "$month" },
        amount: { $sum: "$totalPriceAfterDiscount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
    {
      $project: {
        _id: 0,
        month: "$_id.month",
        year: "$_id.year",
        amount: 1,
        count: 1,
      },
    },
  ]);

  res.json(data);
});

const getYearlyTotalOrders = asyncHandler(async (req, res) => {
  let d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 11);

  const startDate = new Date(d);

  const data = await Order.aggregate([
    { $match: { createdAt: { $lte: new Date(), $gte: startDate } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        amount: { $sum: "$totalPriceAfterDiscount" },
      },
    },
  ]);

  res.json(data);
});

/* =========================================================
   ✅ OTP (NO AUTH)
========================================================= */
const OTP_STORE = new Map();
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationCodeCtrl = asyncHandler(async (req, res) => {
  const { identity, type } = req.body;

  if (!identity || !type) {
    return res.status(400).json({ message: "identity and type are required" });
  }

  const normalized =
    type === "email" ? normalizeEmail(identity) : normalizeMobile(identity);

  if (!normalized) return res.status(400).json({ message: "identity is not valid" });

  const code = generateOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  const key = `${type}:${normalized}`;
  OTP_STORE.set(key, { code, expiresAt });

  if (type === "email") {
    await sendEmail({
      to: normalized,
      subject: "Kupto verification code",
      text: `Your Kupto verification code is ${code}. It expires in 10 minutes.`,
      html: `<div style="font-family:${EMAIL_FONT_FAMILY};"><p>Your Kupto verification code is <b>${code}</b>. It expires in 10 minutes.</p></div>`,
    });

    return res.status(200).json({
      success: true,
      message: "Verification code sent to email",
      type,
      normalized,
    });
  }

  return res.status(200).json({
    success: true,
    message: "Verification code generated. (SMS sending not configured yet)",
    type,
    normalized,
    debugCode: code,
  });
});

const verifyCodeCtrl = asyncHandler(async (req, res) => {
  const { identity, type, code } = req.body;

  if (!identity || !type || !code) {
    return res.status(400).json({ message: "identity, type and code are required" });
  }

  const normalized =
    type === "email" ? normalizeEmail(identity) : normalizeMobile(identity);

  if (!normalized) return res.status(400).json({ message: "identity is not valid" });

  const key = `${type}:${normalized}`;
  const saved = OTP_STORE.get(key);

  if (!saved) return res.status(400).json({ message: "Code not found. Please resend." });
  if (Date.now() > saved.expiresAt) {
    OTP_STORE.delete(key);
    return res.status(400).json({ message: "Code expired. Please resend." });
  }
  if (String(code).trim() !== saved.code) {
    return res.status(400).json({ message: "Invalid code" });
  }

  OTP_STORE.delete(key);

  return res.status(200).json({
    success: true,
    message: "Code verified",
    next: "signup",
    type,
    normalized,
  });
});

/* =========================================================
   ✅ PASSWORD RESET VIA EMAIL CODE
========================================================= */
const PW_RESET_STORE = new Map();
const generateResetCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const okGenericForgotResponse = (res) =>
  res.status(200).json({
    success: true,
    message: "If an account exists for this email, a verification code was sent.",
  });

const forgotPasswordCode = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    res.status(400);
    throw new Error("email is required");
  }

  const user = await User.findOne({ email });
  if (!user) return okGenericForgotResponse(res);

  const code = generateResetCode();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  PW_RESET_STORE.set(email, { code, expiresAt });

  await sendEmail({
    to: email,
    subject: "Kupto password reset code",
    text: `Your Kupto password reset code is ${code}. It expires in 10 minutes.`,
    html: `<div style="font-family:${EMAIL_FONT_FAMILY};"><p>Your Kupto password reset code is <b>${code}</b>. It expires in 10 minutes.</p></div>`,
  });

  return okGenericForgotResponse(res);
});

const verifyResetCode = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();

  if (!email || !code) {
    res.status(400);
    throw new Error("email and code are required");
  }

  const saved = PW_RESET_STORE.get(email);

  if (!saved) {
    res.status(400);
    throw new Error("Code not found. Please request a new code.");
  }

  if (Date.now() > saved.expiresAt) {
    PW_RESET_STORE.delete(email);
    res.status(400);
    throw new Error("Code expired. Please request a new code.");
  }

  if (code !== saved.code) {
    res.status(400);
    throw new Error("Invalid code");
  }

  return res.status(200).json({ success: true, message: "Code verified", email });
});

const resetPasswordWithCode = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();
  const password = req.body?.password;

  if (!email || !code || !password) {
    res.status(400);
    throw new Error("email, code and password are required");
  }

  const saved = PW_RESET_STORE.get(email);

  if (!saved) {
    res.status(400);
    throw new Error("Code not found. Please request a new code.");
  }

  if (Date.now() > saved.expiresAt) {
    PW_RESET_STORE.delete(email);
    res.status(400);
    throw new Error("Code expired. Please request a new code.");
  }

  if (code !== saved.code) {
    res.status(400);
    throw new Error("Invalid code");
  }

  PW_RESET_STORE.delete(email);

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    res.status(400);
    throw new Error("Unable to reset password. Please request a new code.");
  }

  user.password = password;
  user.provider = user.provider || "local";
  await user.save();

  return res.status(200).json({ success: true, message: "Password reset successful" });
});

/* =========================================================
   ✅ ORDER CANCELLATION
========================================================= */
const cancelMyOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  validateMongoDbId(id);

  const order = await Order.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (!order.user || String(order.user) !== String(userId)) {
    res.status(403);
    throw new Error("Not allowed to cancel this order");
  }

  if (order.isCancelled || String(order.orderStatus).toLowerCase() === "cancelled") {
    return res.status(200).json({ success: true, message: "Order already cancelled", order });
  }

  const status = String(order.orderStatus || "Ordered").toLowerCase();
  if (status !== "ordered") {
    res.status(400);
    throw new Error("This order can no longer be cancelled");
  }

  order.isCancelled = true;
  order.cancelledAt = new Date();
  order.cancelReason = reason ? String(reason).trim().slice(0, 300) : null;
  order.cancelledBy = "user";
  order.orderStatus = "Cancelled";

  await order.save();

  return res.status(200).json({ success: true, message: "Order cancelled successfully", order });
});

const cancelOrderAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  validateMongoDbId(id);

  const order = await Order.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (order.isCancelled || String(order.orderStatus).toLowerCase() === "cancelled") {
    return res.status(200).json({ success: true, message: "Order already cancelled", order });
  }

  const status = String(order.orderStatus || "Ordered").toLowerCase();
  if (status === "delivered") {
    res.status(400);
    throw new Error("Delivered orders cannot be cancelled");
  }

  order.isCancelled = true;
  order.cancelledAt = new Date();
  order.cancelReason = reason ? String(reason).trim().slice(0, 300) : null;
  order.cancelledBy = "admin";
  order.orderStatus = "Cancelled";

  await order.save();

  return res.status(200).json({ success: true, message: "Order cancelled", order });
});

/* =========================================================
   ✅ EXPORTS
========================================================= */
module.exports = {
  // auth
  registerUserCtrl,
  loginUserCtrl,
  googleLoginCtrl,
  completeGoogleProfileCtrl,
  identifyUserCtrl,
  loginAdmin,
  handleRefreshToken,
  logout,

  // profile
  updatedUser,
  saveAddress,

  // admin users
  getallUser,
  getaUser,
  deleteaUser,
  blockUser,
  unblockUser,

  // password
  updatePassword,

  // password reset
  forgotPasswordCode,
  verifyResetCode,
  resetPasswordWithCode,

  // wishlist
  getWishlist,
  removeProductFromWishlist,

  // cart
  userCart,
  getUserCart,
  removeProductFromCart,
  updateProductQuantityFromCart,
  emptyCart,

  // orders
  createOrder,
  getMyOrders,
  getAllOrders,
  getSingleOrders,
  updateOrder,

  // analytics
  getMonthWiseOrderIncome,
  getYearlyTotalOrders,

  // otp
  sendVerificationCodeCtrl,
  verifyCodeCtrl,

  // cancellation
  cancelMyOrder,
  cancelOrderAdmin,
};