import mongoose from 'mongoose';

const fundAllocationSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  purpose: {
    type: String,
    enum: ['site_expense', 'labor_expense', 'material', 'equipment', 'other'],
    default: 'site_expense'
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'disbursed', 'rejected'],
    default: 'pending'
  },
  allocationDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  disbursedDate: {
    type: Date
  },
  referenceNumber: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
fundAllocationSchema.index({ organization: 1, fromUser: 1 });
fundAllocationSchema.index({ organization: 1, toUser: 1 });
fundAllocationSchema.index({ site: 1, status: 1 });

const FundAllocation = mongoose.model('FundAllocation', fundAllocationSchema);
export default FundAllocation;
