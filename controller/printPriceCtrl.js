const Pprice = require('../models/printPriceModel');
const asyncHandler = require('express-async-handler');
const slugify = require('slugify');
const validateMongoDbId = require('../utils/validateMongodbid');

const createPrice = asyncHandler(async (req, res) => {
  try {
    console.log('Received Request Body:', req.body); // For dev, remove in production

    // Validate that title and price objects are provided
    if (!req.body.title || req.body.printPrice === undefined || req.body.discountPrintPrice === undefined) {
      return res.status(400).json({ message: 'Title and prices (printPrice, discountPrintPrice) are required.' });
    }

    // Create slug from title
    req.body.slug = slugify(req.body.title);

    console.log('Price to be created:', req.body);

    const newPrice = await Pprice.create(req.body);

    console.log('Created Price:', newPrice);

    res.status(201).json({ newPrice });
  } catch (error) {
    console.error('Error creating price:', error);
    res.status(500).json({ error: error.message });
  }
});

const updatePrice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const updatedPrice = await Pprice.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedPrice) {
      return res.status(404).json({ message: 'Price not found for update.' });
    }
    res.json(updatedPrice);
  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ error: error.message });
  }
});

const deletePrice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const deletedPrice = await Pprice.findByIdAndDelete(id);
    if (!deletedPrice) {
      return res.status(404).json({ message: 'Price not found for deletion.' });
    }
    res.json({ message: 'Price deleted successfully', deletedPrice });
  } catch (error) {
    console.error('Error deleting price:', error);
    res.status(500).json({ error: error.message });
  }
});

const getPrice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const price = await Pprice.findById(id);
    if (!price) {
      return res.status(404).json({ message: 'Price not found.' });
    }
    res.json(price);
  } catch (error) {
    console.error('Error fetching price:', error);
    res.status(500).json({ error: error.message });
  }
});

const getAllPrice = asyncHandler(async (req, res) => {
  try {
    const prices = await Pprice.find();
    res.json(prices);
  } catch (error) {
    console.error('Error fetching all prices:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = { createPrice, updatePrice, deletePrice, getPrice, getAllPrice };