const express = require('express');
const { createPrintOrder, getPrintOrder, getPrintOrders, updatePrintOrder, deletePrint } = require('../controller/printCtrl');

const router = express.Router();

router.post('/', createPrintOrder);
router.put('/:id',updatePrintOrder);
router.delete('/:id',deletePrint);
router.get('/:id', getPrintOrder);
router.get('/', getPrintOrders);




<<<<<<< HEAD
module.exports = router;
=======
module.exports = router;











>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
