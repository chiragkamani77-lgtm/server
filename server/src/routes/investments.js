import express from 'express';
import { Investment, User, Expense, Site, Bill, WorkerLedger, FundAllocation } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all investments for organization
router.get('/', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { partnerId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = { organization: req.user.organization };

    if (partnerId) filter.partner = partnerId;
    if (startDate || endDate) {
      filter.investmentDate = {};
      if (startDate) filter.investmentDate.$gte = new Date(startDate);
      if (endDate) filter.investmentDate.$lte = new Date(endDate);
    }

    const investments = await Investment.find(filter)
      .populate('partner', 'name email')
      .sort({ investmentDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Investment.countDocuments(filter);

    res.json({
      investments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get investment summary by partner
router.get('/summary', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    // Total investments by partner
    const partnerInvestments = await Investment.aggregate([
      { $match: { organization: req.user.organization } },
      {
        $group: {
          _id: '$partner',
          totalInvested: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'partnerInfo'
        }
      },
      {
        $project: {
          partner: { $arrayElemAt: ['$partnerInfo', 0] },
          totalInvested: 1,
          count: 1
        }
      },
      {
        $project: {
          'partner.name': 1,
          'partner.email': 1,
          'partner._id': 1,
          totalInvested: 1,
          count: 1
        }
      }
    ]);

    // Total organization investment
    const totalInvestment = partnerInvestments.reduce((sum, p) => sum + p.totalInvested, 0);

    // Total expenses from organization (try by organization first, then by sites for backward compatibility)
    let expenseAgg = await Expense.aggregate([
      { $match: { organization: req.user.organization } },
      { $group: { _id: null, totalExpenses: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Fallback: if no expenses found with organization, try filtering by site
    if (!expenseAgg[0]) {
      const sites = await Site.find({ organization: req.user.organization }).select('_id');
      const siteIds = sites.map(s => s._id);
      expenseAgg = await Expense.aggregate([
        { $match: { site: { $in: siteIds } } },
        { $group: { _id: null, totalExpenses: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]);
    }

    const totalExpenses = expenseAgg[0]?.totalExpenses || 0;
    const expenseCount = expenseAgg[0]?.count || 0;

    // Total Bills (GST Bills) - paid bills
    const billsAgg = await Bill.aggregate([
      { $match: { organization: req.user.organization, status: { $in: ['credited', 'paid'] } } },
      {
        $group: {
          _id: null,
          totalBills: { $sum: '$totalAmount' },
          totalBaseAmount: { $sum: '$baseAmount' },
          totalGstAmount: { $sum: '$gstAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Bills by type breakdown
    const billsByType = await Bill.aggregate([
      { $match: { organization: req.user.organization, status: { $in: ['credited', 'paid'] } } },
      {
        $group: {
          _id: '$billType',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Total Worker Ledger (Credits = money owed to workers)
    const workerLedgerAgg = await WorkerLedger.aggregate([
      { $match: { organization: req.user.organization } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Worker ledger by category
    const workerLedgerByCategory = await WorkerLedger.aggregate([
      { $match: { organization: req.user.organization } },
      {
        $group: {
          _id: '$category',
          credits: {
            $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] }
          },
          debits: {
            $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const workerCredits = workerLedgerAgg.find(w => w._id === 'credit')?.total || 0;
    const workerDebits = workerLedgerAgg.find(w => w._id === 'debit')?.total || 0;
    const netWorkerPayable = workerCredits - workerDebits; // Net amount owed to workers

    // Fund Allocations summary (disbursed funds)
    const fundAllocationsAgg = await FundAllocation.aggregate([
      { $match: { organization: req.user.organization, status: 'disbursed' } },
      {
        $group: {
          _id: '$purpose',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalFundsDisbursed = fundAllocationsAgg.reduce((sum, f) => sum + f.total, 0);

    // Calculate total utilized funds
    const totalBills = billsAgg[0]?.totalBills || 0;
    const totalUtilized = totalExpenses + totalBills + netWorkerPayable;

    res.json({
      partnerInvestments,
      totalInvestment,

      // Detailed breakdown
      expenses: {
        total: totalExpenses,
        count: expenseCount,
        label: 'Site Expenses'
      },
      bills: {
        total: totalBills,
        baseAmount: billsAgg[0]?.totalBaseAmount || 0,
        gstAmount: billsAgg[0]?.totalGstAmount || 0,
        count: billsAgg[0]?.count || 0,
        byType: billsByType,
        label: 'Material & GST Bills'
      },
      workerLedger: {
        credits: workerCredits,
        debits: workerDebits,
        netPayable: netWorkerPayable,
        byCategory: workerLedgerByCategory,
        label: 'Labor & Salaries'
      },
      fundAllocations: {
        totalDisbursed: totalFundsDisbursed,
        byPurpose: fundAllocationsAgg,
        label: 'Funds Allocated'
      },

      // Legacy fields for backward compatibility
      totalExpenses: totalUtilized,

      // New comprehensive summary
      summary: {
        totalInvestment,
        totalUtilized,
        siteExpenses: totalExpenses,
        materialBills: totalBills,
        laborCosts: netWorkerPayable,
        remainingFunds: totalInvestment - totalUtilized
      },

      remainingFunds: totalInvestment - totalUtilized
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create investment (Level 1 only)
router.post('/', authenticate, requireRole(1), async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { partnerId, amount, description, investmentDate, referenceNumber, paymentMode } = req.body;

    // Verify partner belongs to same organization
    const partner = await User.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    if (partner.organization?.toString() !== req.user.organization.toString()) {
      return res.status(403).json({ message: 'Partner not in your organization' });
    }

    const investment = new Investment({
      organization: req.user.organization,
      partner: partnerId,
      amount,
      description,
      investmentDate: investmentDate || new Date(),
      referenceNumber,
      paymentMode
    });

    await investment.save();
    await investment.populate('partner', 'name email');

    res.status(201).json(investment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single investment
router.get('/:id', authenticate, async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.id)
      .populate('partner', 'name email');

    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    // Check organization access
    if (investment.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(investment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update investment (Level 1 only)
router.put('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.id);

    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    // Check organization access
    if (investment.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { amount, description, investmentDate, referenceNumber, paymentMode } = req.body;

    if (amount !== undefined) investment.amount = amount;
    if (description !== undefined) investment.description = description;
    if (investmentDate) investment.investmentDate = investmentDate;
    if (referenceNumber !== undefined) investment.referenceNumber = referenceNumber;
    if (paymentMode) investment.paymentMode = paymentMode;

    await investment.save();
    await investment.populate('partner', 'name email');

    res.json(investment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete investment (Level 1 only)
router.delete('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.id);

    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    // Check organization access
    if (investment.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await investment.deleteOne();

    res.json({ message: 'Investment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
