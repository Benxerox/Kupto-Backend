
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
const printPriceRouter = require('./routes/printPriceRoute');
const expenseRouter = require('./routes/expenseRoute');
const couponRouter = require('./routes/couponRoute');
const enquiryRouter = require('./routes/enqRoute');
const uploadRouter = require('./routes/uploadRoute');
const uploadFileRouter = require('./routes/uploadFileRoute');
const { v4: uuidv4 } = require('uuid'); // Import UUID package

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




// CORS settings
app.use(cors({
  origin: ['https://www.kupto.co', 'https://kupto-admin.com', 'http://localhost:5000', 'http://localhost:3000'], // Add other origins as needed
  credentials: true, // Allow credentials (cookies, headers)
  allowedHeaders: ['Content-Type', 'Authorization'], // Explicitly allow the Authorization header
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly specify allowed HTTP methods
}));

// Allow preflight requests for all routes (especially needed for non-standard headers like Authorization)
app.options('*', cors());

const momoHost = 'sandbox.momodeveloper.mtn.com';
const momoTokenUrl = `https://${momoHost}/collection/token/`;
const momoRequestToPayUrl = `https://${momoHost}/collection/v1_0/requesttopay`;
const XReferenceId = 'c3bcdce0-e11e-4ee6-8131-d7a791bc38f6'; // Replace with your X-Reference-Id
const subscriptionKey = 'c532a3213f2b41e18c9cacd7be3d87cf'; // Replace with your subscription key
const username = 'c3bcdce0-e11e-4ee6-8131-d7a791bc38f6'; // Replace with your MoMo API username
const password = 'f301b979f4bf49f083d8202ee33c3e0e'; // Replace with your MoMo API password

//'9d14d8c8532a4afe8c9fde5736cb45a4'
//const momoHost = 'api.momodeveloper.mtn.com';

const authHeader = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

// Store token globally (in-memory for simplicity)
let momoToken = null;
let tokenTimestamp = null; // Timestamp for token expiration check

// Function to refresh the token if expired
const refreshMoMoToken = async () => {
  try {
    const momoTokenResponse = await axios.post(
      momoTokenUrl,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Reference-Id': XReferenceId, // MoMo Reference ID
          'Ocp-Apim-Subscription-Key': subscriptionKey, // Subscription Key
          Authorization: authHeader, // Basic Auth header with base64 encoded credentials
        },
      }
    );

    momoToken = momoTokenResponse.data.access_token; // Store the token globally
    tokenTimestamp = Date.now(); // Store the timestamp of when the token was fetched
    console.log('MoMo Token fetched at:', tokenTimestamp);
  } catch (error) {
    console.error('Error fetching MoMo token:', error.response ? error.response.data : error.message);
  }
};

// Fetch MoMo token (called initially and whenever needed)
app.post('/api/get-momo-token', async (req, res) => {
  try {
    // If the token is expired or not available, refresh it
    if (!momoToken || (Date.now() - tokenTimestamp > 3600 * 1000)) {  // Token expires in 1 hour (3600 seconds)
      await refreshMoMoToken();
    }
    res.json({ momoToken }); // Send token back in the response
  } catch (error) {
    console.error('Error fetching MoMo token:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'An error occurred while fetching MoMo token', details: error.response ? error.response.data : error.message });
  }
});

// MoMo payment request
app.post('/api/request-to-pay', async (req, res) => {
  console.log('Request Body:', req.body); // Debugging line, remove in production
  try {
    if (!momoToken) {
      return res.status(400).json({ error: 'MoMo token not available' });
    }

    const { amount, phone } = req.body;

    // Change totalAmount to amount here
    if (!amount || !phone) {
      return res.status(400).json({ error: 'Missing required fields: amount or phone' });
    }

    const externalId = uuidv4();
    const xReferenceId = uuidv4();

    const body = {
      amount: amount,
      currency: 'EUR',
      externalId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: phone,
      },
      payerMessage: 'Payment for order',
      payeeNote: 'Payment for order',
    };

    const momoResponse = await axios.post(momoRequestToPayUrl, body, {
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'X-Reference-Id': xReferenceId,
        'Authorization': `Bearer ${momoToken}`,
        'X-Target-Environment': 'sandbox',
      },
    });
    
    //'X-Target-Environment': 'production',

    res.json({ momoResponse: momoResponse.data });
  } catch (error) {
    console.error('Error during MoMo payment request:', error.response ? error.response.data : error.message);
    res.status(500).json({
      error: 'Error during payment request',
      details: error.response ? error.response.data : error.message,
    });
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
app.use('/api/printPrice', printPriceRouter);
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