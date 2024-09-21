const Paypal = require('paypal-rest-sdk');

Paypal.configure({
  'mode': process.env.ENVIRONMENT || 'sandbox', // Default to sandbox if ENVIRONMENT is not set
  'client_id': process.env.CLIENT_ID,
  'client_secret': process.env.CLIENT_SECRET,
});


const checkout = async (req, res) => {
  const payment = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal',
    },
    redirect_urls: {
      return_url: 'http://your-website.com/success',
      cancel_url: 'http://your-website.com/cancel',
    },
    transactions: [
      {
        amount: {
          total: '5000000', // Adjust this based on your currency requirements
          currency: 'UGX',
        },
        description: 'Payment description',
      },
    ],
  };

  Paypal.payment.create(payment, function (error, payment) {
    if (error) {
      console.error('Payment creation failed:', error);
      res.status(500).json({ success: false, error: 'Payment creation failed' });
    } else {
      const approvalUrl = payment.links.find((link) => link.rel === 'approval_url').href;
      res.json({
        success: true,
        approvalUrl,
      });
    }
  });
};

const paymentVerification = async (req, res) => {
  const { paypalOrderID, PayerID } = req.body;

  const executePaymentJson = {
    payer_id: PayerID,
  };

  Paypal.payment.execute(paypalOrderID, executePaymentJson, function (error, payment) {
    if (error) {
      console.error('Payment execution failed:', error.response);
      res.status(500).json({ success: false, error: 'Payment execution failed' });
    } else {
      res.json({
        success: true,
        payment,
      });
    }
  });
};

module.exports = {
  checkout,
  paymentVerification,
};

























/*const paypal = require('paypal-rest-sdk');

paypal.configure({
  'mode': process.env.ENVIRONMENT || 'sandbox', // Default to sandbox if ENVIRONMENT is not set
  'client_id': process.env.CLIENT_ID,
  'client_secret': process.env.CLIENT_SECRET,
});

const createPayment = (req, res) => {
  const payment = {
    "intent": "sale",
    "payer": {
      "payment_method": "paypal"
    },
    "redirect_urls": {
      "return_url": "http://your-website.com/success",
      "cancel_url": "http://your-website.com/cancel"
    },
    "transactions": [{
      "amount": {
        "total": "10.00",
        "currency": "UGX"
      },
      "description": "Your purchase description."
    }]
  };

  paypal.payment.create(payment, function (error, payment) {
    if (error) {
      console.error('Payment creation failed:', error);
      res.status(500).json({ message: 'Payment creation failed', error });
    } else {
      const approvalUrl = payment.links.find(link => link.rel === 'approval_url').href;
      res.json({ approvalUrl });
    }
  });
};
*/
















/*const environment = process.env.ENVIRONMENT || 'sandbox';
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const endpoint_url = environment === 'sandbox' ? 'https://api-m.sandbox.paypal.com'  : 'https://api-m.paypal.com';



const Razorpay = require('razorpay');
const instance = new Razorpay({
  key_id: '', key_secret: ''
})


const checkout = async(req, res) => {
  const option = {
    amount: 50000,
    currency: 'UGX'
  }
  const order = await instance.orders.create(option)
  res.json({
    success: true,
    order,
  })
}

const paymentVerification = async(req, res) => {
  const {razorpayOrderId, razorpayPaymentId } = req.body;
  res.json({
    razorpayOrderId, razorpayPaymentId
  })
}

module.exports = {
  checkout,
  paymentVerification,
}*/