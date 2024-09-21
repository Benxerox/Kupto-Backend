const express = require('express');
const { createProduct, getaProduct, getAllProduct, updateProduct, deleteProduct, addToWhishlist, rating } = require('../controller/productCtrl');
const { isAdmin, authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, isAdmin, createProduct);
//router.post('/upload/:id', authMiddleware, isAdmin, uploadPhoto.array('images', 10), productImgResize, uploadImages);


router.get('/:id', getaProduct);
router.put('/wishlist', authMiddleware, addToWhishlist);
router.put('/rating', authMiddleware,  rating);
router.put('/:id', authMiddleware, isAdmin, updateProduct);
router.delete('/:id', authMiddleware, isAdmin, deleteProduct);
router.get('/', getAllProduct);










module.exports = router;