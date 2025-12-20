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




