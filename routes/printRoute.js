const express = require('express');
const { createPrintOrder, getPrintOrder, getPrintOrders, updatePrintOrder, deletePrint } = require('../controller/printCtrl');

const router = express.Router();

router.post('/', createPrintOrder);
router.put('/:id',updatePrintOrder);
router.delete('/:id',deletePrint);
router.get('/:id', getPrintOrder);
router.get('/', getPrintOrders);




module.exports = router;