import mongoose from 'mongoose';

const billSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
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
  vendorName: {
    type: String,
    required: true,
    trim: true
  },
  vendorGstNumber: {
    type: String,
    trim: true
  },
  invoiceNumber: {
    type: String,
    trim: true
  },
  billDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  baseAmount: {
    type: Number,
    required: true,
    min: 0
  },
  gstAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  billType: {
    type: String,
    enum: ['material', 'service', 'labor', 'equipment', 'utility', 'other'],
    default: 'material'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'credited', 'paid', 'rejected'],
    default: 'pending'
  },
  // Approval workflow fields
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
  creditedDate: {
    type: Date
  },
  paidDate: {
    type: Date
  },
  receiptPath: {
    type: String
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'upi', 'neft', 'rtgs', 'other'],
  },
  paymentReference: {
    type: String,
    trim: true
  },
  gstRate: {
    type: Number,
    enum: [0, 5, 12, 18, 28],
    default: 18
  },
  linkedInvestment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment'
  }
}, {
  timestamps: true
});

// Index for faster queries
billSchema.index({ organization: 1, status: 1 });
billSchema.index({ organization: 1, billDate: -1 });
billSchema.index({ site: 1, status: 1 });
billSchema.index({ fundAllocation: 1 });

const Bill = mongoose.model('Bill', billSchema);
export default Bill;
