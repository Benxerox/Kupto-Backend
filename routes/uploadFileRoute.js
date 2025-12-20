const express = require('express');
const { deleteFile, uploadFiles, downloadFile } = require('../controller/uploadCtrl');
const { uploadFile } = require('../middlewares/uploadFiles');

const router = express.Router();

// Route to handle file uploads
router.post('/', uploadFile.array('files'), uploadFiles);

// Route to handle file deletion

router.delete('/delete/:id', deleteFile);
router.get('/download/:id', downloadFile);
<<<<<<< HEAD
module.exports = router;
=======
module.exports = router;


>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
