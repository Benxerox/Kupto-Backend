const express = require('express');
const { authMiddleware, isAdmin } = require('../middlewares/authMiddleware');
const { createSize, updateSize, deleteSize, getSize, getallSize } = require('../controller/sizeCtrl');
const router = express.Router();

router.post('/',authMiddleware, isAdmin, createSize);
router.put('/:id',authMiddleware, isAdmin, updateSize);
router.delete('/:id',authMiddleware, isAdmin, deleteSize);
router.get('/:id', getSize);
router.get('/', getallSize);

module.exports = router;