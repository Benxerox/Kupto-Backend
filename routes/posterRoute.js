const express = require('express');
const { isAdmin, authMiddleware } = require('../middlewares/authMiddleware');
const { createPoster, updatePoster, getAllPoster, getaPoster, deletePoster } = require('../controller/posterCtrl');

const router = express.Router();

router.get('/', getAllPoster);

router.post('/', authMiddleware, isAdmin, createPoster);


router.get('/:id', getaPoster);

router.put('/:id', authMiddleware, isAdmin, updatePoster);
router.delete('/:id', authMiddleware, isAdmin, deletePoster);











module.exports = router;