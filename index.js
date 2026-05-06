// server.js (or index.js)
const express = require("express");
const dbConnect = require("./config/dbconnect");
const app = express();
const dotenv = require("dotenv");
dotenv.config();

const PORT = process.env.PORT || 4000;

// Importing routes
const authRouter = require("./routes/authRoute");
const productRouter = require("./routes/productRoute");
const posterRouter = require("./routes/posterRoute");
const postRouter = require("./routes/otherPostRoute");
const printRouter = require("./routes/printRoute");
const categoryRouter = require("./routes/categoryRoute");
const brandRouter = require("./routes/brandRoute");
const colorRouter = require("./routes/colorRoute");
const sizeRouter = require("./routes/sizeRoute");
const printPriceRouter = require("./routes/printPriceRoute");
const expenseRouter = require("./routes/expenseRoute");
const couponRouter = require("./routes/couponRoute");
const enquiryRouter = require("./routes/enqRoute");
const uploadRouter = require("./routes/uploadRoute");
const uploadFileRouter = require("./routes/uploadFileRoute");
const uploadPostRouter = require("./routes/uploadPostRoute");
const otpRouter = require("./routes/otpRoute");
const dpoRouter = require("./routes/dpoRoute");
const Product = require("./models/productModel");
const googleFeedRouter = require("./routes/googleFeedRoute");

// Middlewares
const cookieParser = require("cookie-parser");
const { notFound, errorHandler } = require("./middlewares/errorHandler");
const morgan = require("morgan");
const cors = require("cors");
const dns = require("dns");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

// Connect to the database
dbConnect();
app.set("trust proxy", 1);

/* =========================
   ✅ CORS
========================= */

const allowedOrigins = [
  "https://kupto-admin.com",
  "https://www.kupto-admin.com",

  "https://kupto.co",
  "https://www.kupto.co",
  "http://kupto.co",

  "https://kupto2020.com",
  "https://www.kupto2020.com",

  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5000",

  "capacitor://localhost",
  "https://localhost",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const ok = allowedOrigins.includes(origin);

    if (!ok) {
      console.log("❌ CORS blocked origin:", origin);
      return callback(null, false);
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* =========================
   MIDDLEWARES
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cookieParser());

/* =========================
   ROUTES
========================= */
app.use("/api/user", authRouter);
app.use("/api/product", productRouter);
app.use("/api/poster", posterRouter);
app.use("/api/post", postRouter);
app.use("/api/print", printRouter);
app.use("/api/category", categoryRouter);
app.use("/api/brand", brandRouter);
app.use("/api/expense", expenseRouter);
app.use("/api/color", colorRouter);
app.use("/api/size", sizeRouter);
app.use("/api/printPrice", printPriceRouter);
app.use("/api/coupon", couponRouter);
app.use("/api/enquiry", enquiryRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/uploadFile", uploadFileRouter);
app.use("/api/upload/post", uploadPostRouter);
app.use("/api/otp", otpRouter);

// ✅ DPO payment route
app.use("/api/dpo", dpoRouter);

app.use("/", googleFeedRouter);

// Root route
app.get("/", (req, res) => {
  res.send("Welcome to the homepage!");
});

app.get("/api/sitemap.xml", async (req, res) => {
  try {
    const products = await Product.find({}).select("slug updatedAt");

    const urls = products
      .filter((p) => p.slug)
      .map(
        (p) => `<url>
  <loc>https://www.kupto.co/product/${p.slug}</loc>
  <lastmod>${new Date(p.updatedAt || Date.now()).toISOString()}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>`
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
  <loc>https://www.kupto.co/</loc>
  <changefreq>daily</changefreq>
  <priority>1.0</priority>
</url>
${urls}
</urlset>`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    return res.status(200).send(xml.trim());
  } catch (error) {
    console.error("Sitemap error:", error);
    return res.status(500).send("Sitemap generation failed");
  }
});

// Not Found and Error Handler
app.use(notFound);
app.use(errorHandler);



// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at PORT ${PORT}`);
});