import mongoose from 'mongoose';

const paymentInstallmentSchema = new mongoose.Schema({
  installmentNumber: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  dueDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'partial'],
    default: 'pending'
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  paidDate: {
    type: Date
  },
  ledgerEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkerLedger'
  },
  notes: String
});

const contractSchema = new mongoose.Schema({
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
    ref: 'Site',
    required: true
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
  // Contract details
  contractType: {
    type: String,
    enum: ['fixed', 'milestone', 'daily'],
    default: 'fixed'
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  totalAmount: {
    type: Number,
    required: true
  },
  numberOfInstallments: {
    type: Number,
    default: 1
  },
  installments: [paymentInstallmentSchema],
  // Tracking
  totalPaid: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number
  },
  // Dates
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  // Status
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'terminated', 'on_hold'],
    default: 'draft'
  },
  // For daily rate contracts (linked to attendance)
  dailyRate: {
    type: Number
  },
  // Work details for milestone/fixed contracts
  workDescription: String,
  deliverables: [String],
  // Terms
  terms: String,
  // Reference number
  contractNumber: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// Indexes
contractSchema.index({ organization: 1 });
contractSchema.index({ worker: 1 });
contractSchema.index({ site: 1 });
contractSchema.index({ status: 1 });
contractSchema.index({ fundAllocation: 1 });

// Pre-save: Calculate remaining amount and generate contract number
contractSchema.pre('save', async function(next) {
  this.remainingAmount = this.totalAmount - this.totalPaid;

  // Generate contract number if not set
  if (!this.contractNumber && this.isNew) {
    const count = await this.constructor.countDocuments({ organization: this.organization });
    const date = new Date();
    this.contractNumber = `CON-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;
  }

  next();
});

// Method to generate installments
contractSchema.methods.generateInstallments = function() {
  if (this.numberOfInstallments <= 0) return;

  const installmentAmount = Math.floor(this.totalAmount / this.numberOfInstallments);
  const remainder = this.totalAmount - (installmentAmount * this.numberOfInstallments);

  this.installments = [];

  for (let i = 1; i <= this.numberOfInstallments; i++) {
    const amount = i === this.numberOfInstallments ? installmentAmount + remainder : installmentAmount;

    // Calculate due date based on contract duration
    let dueDate = null;
    if (this.startDate && this.endDate) {
      const duration = this.endDate - this.startDate;
      const interval = duration / this.numberOfInstallments;
      dueDate = new Date(this.startDate.getTime() + (interval * i));
    }

    this.installments.push({
      installmentNumber: i,
      amount,
      dueDate,
      status: 'pending',
      paidAmount: 0
    });
  }
};

// Method to record payment
contractSchema.methods.recordPayment = function(installmentNumber, amount, ledgerEntryId) {
  const installment = this.installments.find(i => i.installmentNumber === installmentNumber);
  if (!installment) {
    throw new Error('Installment not found');
  }

  installment.paidAmount += amount;
  installment.paidDate = new Date();
  if (ledgerEntryId) {
    installment.ledgerEntry = ledgerEntryId;
  }

  if (installment.paidAmount >= installment.amount) {
    installment.status = 'paid';
  } else if (installment.paidAmount > 0) {
    installment.status = 'partial';
  }

  // Update total paid
  this.totalPaid = this.installments.reduce((sum, i) => sum + i.paidAmount, 0);
  this.remainingAmount = this.totalAmount - this.totalPaid;

  // Check if contract is completed
  if (this.totalPaid >= this.totalAmount) {
    this.status = 'completed';
  }
};

// Virtual for progress percentage
contractSchema.virtual('progressPercentage').get(function() {
  return this.totalAmount > 0 ? Math.round((this.totalPaid / this.totalAmount) * 100) : 0;
});

// Virtual for paid installments count
contractSchema.virtual('paidInstallmentsCount').get(function() {
  return this.installments.filter(i => i.status === 'paid').length;
});

contractSchema.set('toJSON', { virtuals: true });
contractSchema.set('toObject', { virtuals: true });

const Contract = mongoose.model('Contract', contractSchema);

export default Contract;
