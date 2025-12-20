const express = require('express');
const { authMiddleware, isAdmin } = require('../middlewares/authMiddleware');
const { createExpense, updateExpense, deleteExpense, getExpense, getallExpense } = require('../controller/expensesCtrl');
const router = express.Router();

router.post('/',authMiddleware, isAdmin, createExpense);
router.put('/:id',authMiddleware, isAdmin, updateExpense);
router.delete('/:id',authMiddleware, isAdmin, deleteExpense);
router.get('/:id', getExpense);
router.get('/', getallExpense);

module.exports = router;