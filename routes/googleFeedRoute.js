// routes/googleFeedRoute.js
const express = require("express");
const router = express.Router();
const Product = require("../models/productModel");

const escapeXml = (v = "") =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const stripHtml = (html = "") =>
  String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

router.get("/google-feed.xml", async (req, res) => {
  try {
    const products = await Product.find({})
      .populate("brand")
      .populate("category")
      .lean();

    const items = products
      .filter((p) => p?.slug && p?.title && Number(p?.price) > 0)
      .map((p) => {
        const image =
          typeof p.images?.[0] === "string"
            ? p.images[0]
            : p.images?.[0]?.url || "";

        const brand =
          typeof p.brand === "object"
            ? p.brand?.title || p.brand?.name || "Kupto"
            : p.brand || "Kupto";

        const desc =
          stripHtml(p.description) ||
          `${p.title} available for order from Kupto Uganda.`;

        const availability =
          Number(p.quantity || 0) > 0 ? "in stock" : "out of stock";

        return `
          <item>
            <g:id>${escapeXml(p._id)}</g:id>
            <g:title>${escapeXml(p.title)}</g:title>
            <g:description>${escapeXml(desc.slice(0, 5000))}</g:description>
            <g:link>https://www.kupto.co/product/${escapeXml(p.slug)}</g:link>
            <g:image_link>${escapeXml(image)}</g:image_link>
            <g:availability>${availability}</g:availability>
            <g:price>${Number(p.price || 0).toFixed(0)} UGX</g:price>
            <g:condition>new</g:condition>
            <g:brand>${escapeXml(brand)}</g:brand>
          </item>`;
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Kupto Uganda Product Feed</title>
    <link>https://www.kupto.co</link>
    <description>Kupto product feed for Google Merchant Center</description>
    ${items}
  </channel>
</rss>`;

    res.set("Content-Type", "application/xml");
    res.status(200).send(xml);
  } catch (error) {
    console.error("Google feed error:", error);
    res.status(500).send("Feed error");
  }
});

module.exports = router;