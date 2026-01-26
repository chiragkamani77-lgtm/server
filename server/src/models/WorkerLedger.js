import mongoose from 'mongoose';

const workerLedgerSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fundAllocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FundAllocation'
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['salary', 'advance', 'bonus', 'deduction', 'reimbursement', 'other'],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  transactionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  referenceNumber: {
    type: String,
    trim: true
  },
  paymentMode: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'upi', 'other'],
    default: 'cash'
  }
}, {
  timestamps: true
});

// Index for faster queries
workerLedgerSchema.index({ organization: 1, worker: 1 });
workerLedgerSchema.index({ worker: 1, transactionDate: -1 });
workerLedgerSchema.index({ site: 1, type: 1 });
workerLedgerSchema.index({ fundAllocation: 1 });

const WorkerLedger = mongoose.model('WorkerLedger', workerLedgerSchema);
export default WorkerLedger;
