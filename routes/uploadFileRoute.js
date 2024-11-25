const express = require('express');
const { deleteFile, uploadFiles } = require('../controller/uploadCtrl');
const { uploadFile } = require('../middlewares/uploadFiles');

const router = express.Router();

// Route to handle file uploads
router.post('/', uploadFile.array('files'), uploadFiles);

// Route to handle file deletion

router.delete('/delete/:id', deleteFile);
module.exports = router;


