import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
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
  fundAllocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FundAllocation'
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
  },
  // Approval workflow fields
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'rejected'],
    default: 'pending'
  },
  requestedAmount: {
    type: Number,
    min: 0
  },
  approvedAmount: {
    type: Number,
    min: 0
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: {
    type: Date
  },
  approvalNotes: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'upi', 'neft', 'rtgs', 'other']
  },
  paymentReference: {
    type: String,
    trim: true
  },
  paidDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
expenseSchema.index({ organization: 1, site: 1 });
expenseSchema.index({ site: 1, user: 1 });
expenseSchema.index({ site: 1, expenseDate: -1 });
expenseSchema.index({ fundAllocation: 1 });

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
