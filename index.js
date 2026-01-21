
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
const uploadPostRouter = require("./routes/uploadPostRoute");

const { v4: uuidv4 } = require('uuid'); // Import UUID package

// Middlewares
const cookieParser = require('cookie-parser');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const morgan = require('morgan');
const cors = require('cors');

// Connect to the database
dbConnect();

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow mobile/native
    const allowedOrigins = [
      'https://www.kupto.co',
      'https://kupto-admin.com',
      'http://localhost:5000',
      'http://localhost:3000',
      'https://api.kupto.co',
      'capacitor://localhost',
      'https://localhost'
    ];
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

// Apply CORS globally
app.use(cors(corsOptions));

// Apply CORS to preflight requests too
app.options('*', cors(corsOptions));

// Apply middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(cookieParser());








const momoHost = 'sandbox.momodeveloper.mtn.com';
const momoTokenUrl = `https://${momoHost}/collection/token/`;
const momoRequestToPayUrl = `https://${momoHost}/collection/v1_0/requesttopay`;
const XReferenceId = '0b6be0ed-f672-4383-8612-1246cfe8a236'; // Replace with your X-Reference-Id
const subscriptionKey = 'c532a3213f2b41e18c9cacd7be3d87cf'; // Replace with your subscription key
const username = '0b6be0ed-f672-4383-8612-1246cfe8a236'; // Replace with your MoMo API username
const password = 'b2dd1810897c4999aec21ee4ce64546f'; // Replace with your MoMo API password


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


// Fetch Airtel Access Token
const fetchAirtelToken = async () => {
  const clientId = process.env.AIRTEL_CLIENT_ID;
  const clientSecret = process.env.AIRTEL_CLIENT_SECRET;

  const base64Credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await axios.post(
    'https://openapi.airtel.africa/auth/oauth2/token',
    {
      grant_type: 'client_credentials',
    },
    {
      headers: {
        Authorization: `Basic ${base64Credentials}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.access_token;
};

// Airtel Token API route
app.post('/api/airtel/token', async (req, res) => {
  try {
    const token = await fetchAirtelToken();
    res.json({ accessToken: token });
  } catch (error) {
    console.error('Error fetching Airtel token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Airtel token' });
  }
});



const makeAirtelPayment = async (accessToken, paymentBody) => {
  const response = await axios.post(
    'https://openapi.airtel.africa/merchant/v1/payments/',
    paymentBody,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Country': 'UG',
        'X-Currency': 'UGX',
      },
    }
  );

  return response.data;
};

app.post('/api/airtel/pay', async (req, res) => {
  try {
    console.log('➡️ Airtel /pay received payload:', req.body);
    const { amount, phone, reference } = req.body;

    const accessToken = await fetchAirtelToken();
    console.log('🔑 Airtel access token:', accessToken);

    const paymentBody = {
      reference,
      subscriber: {
        country: 'UG',
        currency: 'UGX',
        msisdn: phone.startsWith('256') ? phone : `256${phone}`
      },
      transaction: { amount, country: 'UG', currency: 'UGX', id: reference },
    };
    console.log('📦 Airtel request body:', paymentBody);

    const airtelResponse = await makeAirtelPayment(accessToken, paymentBody);
    console.log('✅ Airtel API success:', airtelResponse);

    res.json({ success: true, data: airtelResponse });
  } catch (error) {
    console.error('❌ Airtel payment failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Airtel payment failed', details: error.response?.data || error.message });
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
app.use("/api/upload/post", uploadPostRouter);


// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the homepage!');
});



// Not Found and Error Handler
app.use(notFound);
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at PORT ${PORT}`);
});