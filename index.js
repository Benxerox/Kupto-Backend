const bodyParser = require('body-parser');
const express = require('express');
const dbConnect = require('./config/dbconnect');
const app = express();
const dotenv = require('dotenv');
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
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// CORS settings


app.use(cors({
  origin: ['https://kupto2020.com', 'https://kupto-admin.com', 'http://localhost:5000', 'http://localhost:3000'], // Add other origins as needed
  credentials: true // Allow credentials if you need to send cookies or authentication headers
}));

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