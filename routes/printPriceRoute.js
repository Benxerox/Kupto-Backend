const express = require('express');
const { authMiddleware, isAdmin } = require('../middlewares/authMiddleware');
const { createPrice, updatePrice, deletePrice, getPrice, getAllPrice } = require('../controller/printPriceCtrl');
const router = express.Router();

router.post('/',authMiddleware, isAdmin, createPrice);
router.put('/:id',authMiddleware, isAdmin, updatePrice);
router.delete('/:id',authMiddleware, isAdmin, deletePrice);
router.get('/:id', getPrice);
router.get('/', getAllPrice);

module.exports = router;