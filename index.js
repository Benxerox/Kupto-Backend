
const express = require('express');
const dbConnect = require('./config/dbconnect');
const app = express();
const dotenv = require('dotenv');
const axios = require('axios');
dotenv.config();

const PORT = process.env.PORT || 4000;

// Importing routes
const authRouter = require('./routes/authRoute');
const productRouter = require('./routes/productRoute');
const posterRouter = require('./routes/posterRoute');
const postRouter = require('./routes/otherPostRoute');
const printRouter = require('./routes/printRoute');
const categoryRouter = require('./routes/categoryRoute');
const brandRouter = require('./routes/brandRoute');
const colorRouter = require('./routes/colorRoute');
const sizeRouter = require('./routes/sizeRoute');
const expenseRouter = require('./routes/expenseRoute');
const couponRouter = require('./routes/couponRoute');
const enquiryRouter = require('./routes/enqRoute');
const uploadRouter = require('./routes/uploadRoute');
const uploadFileRouter = require('./routes/uploadFileRoute');

// Middlewares
const cookieParser = require('cookie-parser');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const morgan = require('morgan');
const cors = require('cors');

// Connect to the database
dbConnect();

// Apply middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(cookieParser());

// CORS settings


app.use(cors({
  origin: ['https://kupto2020.com', 'https://kupto-admin.com', 'http://localhost:5000', 'http://localhost:3000'], // Add other origins as needed
  credentials: true // Allow credentials if you need to send cookies or authentication headers
}));
const momoHost = 'sandbox.momodeveloper.mtn.com';
const momoTokenUrl = `https://${momoHost}/collection/token`;
const momoRequestToPayUrl = `https://${momoHost}/collection/v1_0/requesttopay`;
let momoToken = null;

app.post('/api/get-momo-token', async (req, res) => {
  try {
    const { apiKey, subscriptionKey } = req.body;  // Get data from frontend
    console.log(apiKey, subscriptionKey);

    const momoTokenResponse = await axios.post(
      momoTokenUrl,  // Your MoMo API endpoint
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
    
    const momoToken = momoTokenResponse.data.access_token;
    res.json({ momoToken });
  } catch (error) {
    console.error('Error fetching MoMo token:', error);
    res.status(500).json({ error: 'An error occurred while fetching MoMo token' });
  }
});

app.post('/request-to-pay', async (req, res) => {
  try {
    if (!momoToken) {
      return res.status(400).json({ error: 'Momo token not available' });
    }

    const { total, phone } = req.body; // Make sure these are passed in the request
    const body = {
      amount: total, 
      currency: 'EUR',
      externalId: 'ac40504da26e48b19c37f875c13febb9',
      payer: {
        partyType: 'MSISDN',
        partyId: phone,
      },
      payerMessage: 'Payment for order',
      payeeNote: 'Payment for order'
    };

    const momoResponse = await axios.post(
      momoRequestToPayUrl, 
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': 'f7dac286801540169b7355022aa06064',
          'X-Reference-Id': 'efdf38c5-85ca-4491-981d-1cb7f5a53429',
          'X-Target-Environment': 'sandbox',
          Authorization: `Bearer ${momoToken}`,
        },
      }
    );
    res.json({ momoResponse: momoResponse.data });
  } catch (error) {
    console.error('Error during payment request:', error); // Log error details for debugging
    res.status(500).json({ error: 'An error occurred during the payment process' });
  }
});

// Define API routes
app.use('/api/user', authRouter);
app.use('/api/product', productRouter);
app.use('/api/poster', posterRouter);
app.use('/api/post', postRouter);
app.use('/api/print', printRouter);
app.use('/api/category', categoryRouter);
app.use('/api/brand', brandRouter);
app.use('/api/expense', expenseRouter);
app.use('/api/color', colorRouter);
app.use('/api/size', sizeRouter);
app.use('/api/coupon', couponRouter);
app.use('/api/enquiry', enquiryRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/uploadFile', uploadFileRouter);


// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the homepage!');
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

// Not Found and Error Handler
app.use(notFound);
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at PORT ${PORT}`);
});