const Expense = require('../models/expensesModel');
const asyncHandler = require('express-async-handler');
const validateMongoDbId = require('../utils/validateMongodbid');


const createExpense = asyncHandler(async(req, res)=>{
  try {
    const newExpense = await Expense.create(req.body);
    res.json(newExpense);
  } catch (error) {
    throw new Error (error);
  }
});

const updateExpense = asyncHandler(async(req, res)=>{
  const {id} =  req.params;
  validateMongoDbId(id);
  try {
    const updatedExpense = await Expense.findByIdAndUpdate(id,req.body,{
      new: true,
    });
    res.json(updatedExpense);
  } catch (error) {
    throw new Error (error);
  }
});

const deleteExpense = asyncHandler(async(req, res)=>{
  const {id} =  req.params;
  validateMongoDbId(id);
  try {
    const deletedExpense = await Expense.findByIdAndDelete(id);
    res.json(deletedExpense);
  } catch (error) {
    throw new Error (error);
  }
});
const getExpense = asyncHandler(async(req, res)=>{
  const {id} =  req.params;
  validateMongoDbId(id);
  try {
    const getaExpense = await Expense.findById(id);
    res.json(getaExpense);
  } catch (error) {
    throw new Error (error);
  }
});


const getallExpense = asyncHandler(async(req, res)=>{
 
  try {
    const getallExpenses = await Expense.find();
    res.json(getallExpenses);
  } catch (error) {
    throw new Error (error);
  }
});



module.exports = {createExpense, updateExpense, deleteExpense, getExpense, getallExpense};