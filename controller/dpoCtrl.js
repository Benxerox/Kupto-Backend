// controllers/dpoCtrl.js
const axios = require("axios");
const asyncHandler = require("express-async-handler");
const { XMLParser } = require("fast-xml-parser");

const Order = require("../models/order.model");

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
});

const escapeXml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const normalizeDpoResult = (responseData) => {
  const parsed = parser.parse(responseData);
  return parsed?.API3G || parsed;
};

const getRequiredEnv = (key) => {
  const value = String(process.env[key] || "").trim();
  if (!value) throw new Error(`${key} is missing in .env`);
  return value;
};

const getFrontendUrl = () =>
  String(process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

const buildPaymentUrl = (token) => {
  const paymentUrl = getRequiredEnv("DPO_PAYMENT_URL");

  if (paymentUrl.includes("?ID=")) {
    return `${paymentUrl}${token}`;
  }

  if (paymentUrl.endsWith("=")) {
    return `${paymentUrl}${token}`;
  }

  return `${paymentUrl}?ID=${token}`;
};

/* =========================================================
   ✅ CREATE DPO TOKEN
   POST /api/dpo/create-token
========================================================= */
const createDpoToken = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "orderId is required",
    });
  }

  const order = await Order.findById(orderId);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  if (order.isCancelled || order.orderStatus === "Cancelled") {
    return res.status(400).json({
      success: false,
      message: "Cannot pay for a cancelled order",
    });
  }

  if (order.isPaid || order.paymentInfo?.status === "Paid") {
    return res.status(400).json({
      success: false,
      message: "Order is already paid",
    });
  }

  const amount = Number(order.totalPriceAfterDiscount || order.totalPrice || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid order amount",
    });
  }

  const shippingInfo = order.shippingInfo || {};
  const frontendUrl = getFrontendUrl();

  const redirectUrl = `${frontendUrl}/payment-success?orderId=${order._id}`;
  const backUrl = `${frontendUrl}/checkout`;
  const serviceDate = new Date().toISOString().slice(0, 10);

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(getRequiredEnv("DPO_COMPANY_TOKEN"))}</CompanyToken>
  <Request>createToken</Request>
  <Transaction>
    <PaymentAmount>${amount}</PaymentAmount>
    <PaymentCurrency>UGX</PaymentCurrency>
    <CompanyRef>${escapeXml(order._id)}</CompanyRef>
    <RedirectURL>${escapeXml(redirectUrl)}</RedirectURL>
    <BackURL>${escapeXml(backUrl)}</BackURL>
    <CompanyRefUnique>0</CompanyRefUnique>
    <PTL>5</PTL>
    <customerFirstName>${escapeXml(shippingInfo.firstName || "")}</customerFirstName>
    <customerLastName>${escapeXml(shippingInfo.lastName || "")}</customerLastName>
    <customerEmail>${escapeXml(shippingInfo.email || "")}</customerEmail>
    <customerPhone>${escapeXml(shippingInfo.phone || "")}</customerPhone>
  </Transaction>
  <Services>
    <Service>
      <ServiceType>${escapeXml(getRequiredEnv("DPO_SERVICE_TYPE"))}</ServiceType>
      <ServiceDescription>${escapeXml(
        `Kupto Order ${order.orderNumber || order._id}`
      )}</ServiceDescription>
      <ServiceDate>${serviceDate}</ServiceDate>
    </Service>
  </Services>
</API3G>`;

  const response = await axios.post(getRequiredEnv("DPO_API_URL"), xml, {
    headers: {
      "Content-Type": "application/xml",
    },
    timeout: 30000,
  });

  const result = normalizeDpoResult(response.data);

  if (String(result.Result) !== "000") {
    return res.status(400).json({
      success: false,
      message: result.ResultExplanation || "DPO token creation failed",
      result,
    });
  }

  const token = result.TransToken;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "DPO did not return a transaction token",
      result,
    });
  }

  order.paymentInfo = {
    ...(order.paymentInfo || {}),
    paymentMethod: "dpo",
    status: "Pending",
    provider: "DPO",
    transactionId: token,
  };

  order.isPaid = false;
  order.paidAt = null;

  await order.save();

  return res.status(200).json({
    success: true,
    message: "DPO token created successfully",
    token,
    orderId: order._id,
    paymentUrl: buildPaymentUrl(token),
  });
});

/* =========================================================
   ✅ VERIFY DPO TOKEN
   POST /api/dpo/verify-token
========================================================= */
const verifyDpoToken = asyncHandler(async (req, res) => {
  const { token, orderId } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "token is required",
    });
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(getRequiredEnv("DPO_COMPANY_TOKEN"))}</CompanyToken>
  <Request>verifyToken</Request>
  <TransactionToken>${escapeXml(token)}</TransactionToken>
</API3G>`;

  const response = await axios.post(getRequiredEnv("DPO_API_URL"), xml, {
    headers: {
      "Content-Type": "application/xml",
    },
    timeout: 30000,
  });

  const result = normalizeDpoResult(response.data);
  const paid = String(result.Result) === "000";

  let order = null;

  if (orderId) {
    order = await Order.findById(orderId);
  }

  if (!order) {
    order = await Order.findOne({
      "paymentInfo.transactionId": token,
    });
  }

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found for this DPO token",
      result,
    });
  }

  if (paid) {
    order.paymentInfo = {
      ...(order.paymentInfo || {}),
      paymentMethod: "dpo",
      status: "Paid",
      provider: "DPO",
      transactionId: token,
    };

    order.isPaid = true;
    order.paidAt = order.paidAt || new Date();

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order,
      result,
    });
  }

  order.paymentInfo = {
    ...(order.paymentInfo || {}),
    paymentMethod: "dpo",
    status: "Failed",
    provider: "DPO",
    transactionId: token,
  };

  order.isPaid = false;
  order.paidAt = null;

  await order.save();

  return res.status(400).json({
    success: false,
    message: result.ResultExplanation || "Payment not verified",
    order,
    result,
  });
});

module.exports = {
  createDpoToken,
  verifyDpoToken,
};