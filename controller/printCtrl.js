const Print = require('../models/printModel');
const asyncHandler = require('express-async-handler');



const createPrintOrder = asyncHandler(async(req, res)=>{
  const {name, email, mobile, quantity, instruction, uploadedFiles} = req.body;
  
  try {
    const PrintOrder = await Print.create({
      name, email, mobile, quantity, instruction, uploadedFiles
    })
    res.json({
      PrintOrder,
      success: true
    })
  } catch (error) {
    throw new Error(error);
  }
});


const getPrintOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const printOrder = await Print.findById(id);
    
    if (!printOrder) {
      res.status(404);
      throw new Error('Print order not found');
    }

    res.json({
      printOrder,
      success: true
    });
  } catch (error) {
    res.status(500);
    throw new Error(error);
  }
});

const getPrintOrders = asyncHandler(async (req, res) => {
  try {
    const printOrders = await Print.find();
    
    res.json({
      printOrders,
      success: true
    });
  } catch (error) {
    res.status(500);
    throw new Error(error);
  }
});

// Update Print Order
const updatePrintOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const updatedPrintOrder = await Print.findByIdAndUpdate(id, req.body, {
      new: true, // Return the updated document
    });
    
    if (!updatedPrintOrder) {
      res.status(404);
      throw new Error('Print order not found');
    }

    res.json({
      updatedPrintOrder,
      success: true,
    });
  } catch (error) {
    res.status(500);
    throw new Error(error);
  }
});

const deletePrint = asyncHandler(async(req, res)=>{
  const {id} =  req.params;

  try {
    const deletedPrint = await Print.findByIdAndDelete(id);
    res.json(deletedPrint);
  } catch (error) {
    throw new Error (error);
  }
});

   


module.exports = { createPrintOrder, getPrintOrder, getPrintOrders, updatePrintOrder, deletePrint };