const express = require('express');
const { isAdmin, authMiddleware } = require('../middlewares/authMiddleware');
const { createPost, getaPost, updatePost, deletePost, getAllPost } = require('../controller/otherPostCtrl');

const router = express.Router();

router.get('/', getAllPost);

router.post('/', authMiddleware, isAdmin, createPost);


router.get('/:id', getaPost);

router.put('/:id', authMiddleware, isAdmin, updatePost);
router.delete('/:id', authMiddleware, isAdmin, deletePost);











module.exports = router;