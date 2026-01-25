import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpenseCategory',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  vendorName: {
    type: String,
    trim: true
  },
  receiptPath: {
    type: String
  },
  expenseDate: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
expenseSchema.index({ site: 1, user: 1 });
expenseSchema.index({ site: 1, expenseDate: -1 });

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
