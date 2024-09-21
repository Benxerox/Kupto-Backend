const express = require('express');
const { isAdmin, authMiddleware } = require('../middlewares/authMiddleware');
const { createPost, getaPost, updatePost, deletePost, getAllPost } = require('../controller/otherPostCtrl');

const router = express.Router();

router.post('/', authMiddleware, isAdmin, createPost);


router.get('/:id', getaPost);

router.put('/:id', authMiddleware, isAdmin, updatePost);
router.delete('/:id', authMiddleware, isAdmin, deletePost);
router.get('/', getAllPost);










module.exports = router;