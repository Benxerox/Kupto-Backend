// controller/paymentCtrl.js
const Paypal = require("paypal-rest-sdk");
const asyncHandler = require("express-async-handler");

// ---- PayPal config ----
Paypal.configure({
  mode: process.env.PAYPAL_MODE || "sandbox", // "sandbox" | "live"
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

// ---- helpers ----
const toMoneyString = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return null;
  // PayPal expects string with 2 decimals for most currencies
  return num.toFixed(2);
};

const safeGet = (obj, path, fallback = null) => {
  try {
    return path.split(".").reduce((acc, k) => acc?.[k], obj) ?? fallback;
  } catch {
    return fallback;
  }
};

// Extract sale id if present (common in intent:"sale")
const extractSaleId = (payment) => {
  const related = safeGet(payment, "transactions.0.related_resources", []);
  if (!Array.isArray(related)) return null;

  // Typical shape: related_resources: [{ sale: { id } }]
  const sale = related.find((r) => r?.sale?.id)?.sale?.id;
  return sale || null;
};

/**
 * =========================
 * CHECKOUT (CREATE PAYMENT)
 * =========================
 * Creates a PayPal payment and returns approvalUrl + paymentId.
 *
 * Frontend flow:
 * 1) Call /order/checkout with amount + currency (USD recommended)
 * 2) Redirect user to approvalUrl
 * 3) PayPal redirects back to your return_url with ?paymentId=...&PayerID=...
 * 4) Call /order/paymentVerification with paymentId + payerId + expectedTotal + currency
 * 5) IF verified => call /cart/create-order with paymentInfo containing paypal IDs
 */
const checkout = asyncHandler(async (req, res) => {
  const {
    total, // number (recommended)
    currency = "USD", // PayPal-supported currency
    description = "Kupto Order Payment",
  } = req.body;

  // ✅ validate
  const totalStr = toMoneyString(total);
  if (!totalStr) {
    return res.status(400).json({ success: false, message: "Valid total amount is required" });
  }

  // ✅ NOTE: UGX is not supported on classic PayPal payments
  // Charge in USD and convert your UGX totals on your side if needed.
  const payCurrency = String(currency || "USD").toUpperCase();

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const returnUrl = `${baseUrl}/paypal/success`;
  const cancelUrl = `${baseUrl}/paypal/cancel`;

  const paymentPayload = {
    intent: "sale",
    payer: { payment_method: "paypal" },
    redirect_urls: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
    transactions: [
      {
        amount: {
          total: totalStr,
          currency: payCurrency,
        },
        description,
      },
    ],
  };

  // Wrap callback API into promise
  const created = await new Promise((resolve, reject) => {
    Paypal.payment.create(paymentPayload, (error, payment) => {
      if (error) return reject(error);
      return resolve(payment);
    });
  }).catch((err) => {
    console.error("PayPal create error:", err?.response || err);
    return null;
  });

  if (!created) {
    return res.status(500).json({ success: false, message: "Payment creation failed" });
  }

  const approvalUrl = Array.isArray(created?.links)
    ? created.links.find((l) => l?.rel === "approval_url")?.href
    : null;

  if (!approvalUrl) {
    return res.status(500).json({
      success: false,
      message: "PayPal approval URL not found",
      payment: created,
    });
  }

  return res.status(200).json({
    success: true,
    approvalUrl,
    paymentId: created.id, // ✅ important (this is what PayPal returns as paymentId)
    currency: payCurrency,
    total: totalStr,
  });
});

/**
 * =================================
 * PAYMENT VERIFICATION (EXECUTE)
 * =================================
 * Executes the approved payment and verifies:
 * - payment.state is "approved"
 * - amount/currency match what YOU expect
 *
 * Request body:
 * {
 *   paymentId: "...",   // from PayPal redirect query param
 *   payerId: "...",     // from PayPal redirect query param (PayerID)
 *   expectedTotal: 12.34,
 *   currency: "USD"
 * }
 */
const paymentVerification = asyncHandler(async (req, res) => {
  const {
    paymentId,
    payerId, // PayerID from PayPal redirect
    expectedTotal,
    currency = "USD",
  } = req.body;

  if (!paymentId || !payerId) {
    return res.status(400).json({
      success: false,
      message: "paymentId and payerId are required",
    });
  }

  const expectedTotalStr = toMoneyString(expectedTotal);
  if (!expectedTotalStr) {
    return res.status(400).json({
      success: false,
      message: "expectedTotal must be a valid number",
    });
  }

  const expectedCurrency = String(currency || "USD").toUpperCase();

  const executePayload = { payer_id: payerId };

  const executed = await new Promise((resolve, reject) => {
    Paypal.payment.execute(paymentId, executePayload, (error, payment) => {
      if (error) return reject(error);
      return resolve(payment);
    });
  }).catch((err) => {
    console.error("PayPal execute error:", err?.response || err);
    return null;
  });

  if (!executed) {
    return res.status(500).json({
      success: false,
      message: "Payment execution failed",
    });
  }

  // ✅ verify state
  const state = String(executed?.state || "").toLowerCase();
  if (state !== "approved") {
    return res.status(400).json({
      success: false,
      message: `Payment not approved (state: ${executed?.state || "unknown"})`,
      payment: executed,
    });
  }

  // ✅ verify amount + currency match your expected values
  const paidTotal = safeGet(executed, "transactions.0.amount.total", null);
  const paidCurrency = safeGet(executed, "transactions.0.amount.currency", null);

  if (String(paidCurrency || "").toUpperCase() !== expectedCurrency) {
    return res.status(400).json({
      success: false,
      message: `Currency mismatch. Expected ${expectedCurrency}, got ${paidCurrency}`,
      payment: executed,
    });
  }

  // Compare as strings (PayPal totals are strings)
  if (String(paidTotal) !== String(expectedTotalStr)) {
    return res.status(400).json({
      success: false,
      message: `Amount mismatch. Expected ${expectedTotalStr}, got ${paidTotal}`,
      payment: executed,
    });
  }

  // ✅ extract ids you can store in your Order.paymentInfo
  const paypalOrderID = executed.id; // paymentId
  const paypalPaymentID = extractSaleId(executed); // sale id (often what people call "payment id")
  // Note: you can also store payerId if you want:
  const paypalPayerID = payerId;

  return res.status(200).json({
    success: true,
    verified: true,
    paypalOrderID,
    paypalPaymentID: paypalPaymentID || null,
    paypalPayerID,
    payment: executed,
  });
});

module.exports = {
  checkout,
  paymentVerification,
};
