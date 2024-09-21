const express = require('express');
const { createPayment, executePayment, cancelPayment, handleWebhook } = require('../controller/paymentCtrl');
const router = express.Router();


router.post('/pay', createPayment);
router.get('/success', executePayment);
router.get('/cancel', cancelPayment);
router.post('/webhook', handleWebhook);

module.exports = router;