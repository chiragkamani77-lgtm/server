import express from 'express';
import mongoose from 'mongoose';
import { FundAllocation, User, Site, Expense, Bill, WorkerLedger, Investment } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { creditWallet, debitWallet, transferWallet } from '../utils/walletHelper.js';

const router = express.Router();

// Utility function to validate fund availability
// Validates that the fund allocation has enough unspent balance
async function validateFundAvailability(fundAllocationId, requestedAmount) {
  try {
    // Get fund allocation
    const allocation = await FundAllocation.findById(fundAllocationId);

    if (!allocation) {
      return {
        available: false,
        balance: 0,
        message: 'Fund allocation not found'
      };
    }

    // Check if allocation is disbursed
    if (allocation.status !== 'disbursed') {
      return {
        available: false,
        balance: 0,
        message: `Fund allocation must be disbursed (current status: ${allocation.status})`
      };
    }

    const allocatedAmount = allocation.amount;

    // Calculate total spent from this fund allocation
    // Include pending expenses with amount > 0 (supervisor wallet holds)
    const expensesAgg = await Expense.aggregate([
      {
        $match: {
          fundAllocation: allocation._id,
          $or: [
            { status: { $in: ['approved', 'paid'] } },
            { status: 'pending', amount: { $gt: 0 } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' }
        }
      }
    ]);

    const totalExpenses = expensesAgg[0]?.totalExpenses || 0;

    // Calculate total ledger payments from this fund allocation
    const ledgerAgg = await WorkerLedger.aggregate([
      {
        $match: {
          fundAllocation: allocation._id,
          type: 'credit'
        }
      },
      {
        $group: {
          _id: null,
          totalLedger: { $sum: '$amount' }
        }
      }
    ]);

    const totalLedger = ledgerAgg[0]?.totalLedger || 0;

    // Calculate total bills against this fund allocation (pending/credited/paid)
    const billsAgg = await Bill.aggregate([
      {
        $match: {
          fundAllocation: allocation._id,
          status: { $in: ['pending', 'credited', 'paid'] }
        }
      },
      {
        $group: {
          _id: null,
          totalBills: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalBills = billsAgg[0]?.totalBills || 0;

    const totalSpent = totalExpenses + totalLedger + totalBills;
    const balance = allocatedAmount - totalSpent;
    const available = requestedAmount <= balance;

    return {
      available,
      balance,
      allocated: allocatedAmount,
      utilized: totalSpent,
      message: available
        ? 'Sufficient funds in allocation'
        : `Insufficient funds in allocation. Available: ${balance.toFixed(2)}, Requested: ${requestedAmount.toFixed(2)}`
    };
  } catch (error) {
    return {
      available: false,
      balance: 0,
      message: `Error validating funds: ${error.message}`
    };
  }
}

// Utility function to validate investment pool availability
async function validateInvestmentPool(requestedAmount, organization) {
  try {
    // Convert to ObjectId for consistent comparison
    // Check if already ObjectId instance to avoid unnecessary conversion
    const orgId = organization instanceof mongoose.Types.ObjectId
      ? organization
      : mongoose.Types.ObjectId.createFromHexString(organization.toString());

    // Get total investment
    const investments = await Investment.find({ organization: orgId });
    const totalInvestment = investments.reduce((sum, inv) => sum + inv.amount, 0);

    // Get total allocated (disbursed) funds
    const allocatedAgg = await FundAllocation.aggregate([
      {
        $match: {
          organization: orgId,
          status: 'disbursed'
        }
      },
      {
        $group: {
          _id: null,
          totalAllocated: { $sum: '$amount' }
        }
      }
    ]);

    const totalAllocated = allocatedAgg[0]?.totalAllocated || 0;
    const availablePool = totalInvestment - totalAllocated;
    const available = requestedAmount <= availablePool;

    return {
      available,
      totalInvestment,
      totalAllocated,
      availablePool,
      message: available
        ? 'Sufficient funds in investment pool'
        : `Insufficient funds in investment pool. Available: ${availablePool.toFixed(2)}, Requested: ${requestedAmount.toFixed(2)}`
    };
  } catch (error) {
    return {
      available: false,
      totalInvestment: 0,
      totalAllocated: 0,
      availablePool: 0,
      message: `Error validating investment pool: ${error.message}`
    };
  }
}

// Utility function to validate wallet balance
async function validateWalletBalance(userId, requestedAmount, organization) {
  try {
    // Simply read the wallet balance from the user document
    const user = await User.findById(userId).select('walletBalance');

    if (!user) {
      return {
        available: false,
        balance: 0,
        totalReceived: 0,
        totalSpent: 0,
        message: 'User not found'
      };
    }

    const balance = user.walletBalance || 0;
    const available = requestedAmount <= balance;

    return {
      available,
      balance,
      totalReceived: 0, // Not calculated anymore, kept for backward compatibility
      totalSpent: 0, // Not calculated anymore, kept for backward compatibility
      message: available
        ? 'Sufficient wallet balance'
        : `Insufficient wallet balance. Available: ${balance.toFixed(2)}, Requested: ${requestedAmount.toFixed(2)}`
    };
  } catch (error) {
    return {
      available: false,
      balance: 0,
      totalReceived: 0,
      totalSpent: 0,
      message: `Error validating wallet balance: ${error.message}`
    };
  }
}

// Export for use in other routes
export { validateFundAvailability, validateInvestmentPool, validateWalletBalance };

// Get fund allocations (filtered by user role)
router.get('/', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { siteId, status, fromUser, toUser, page = 1, limit = 20 } = req.query;

    const filter = { organization: req.user.organization };

    // Filter by role
    if (req.user.role === 2) {
      // Engineers/Supervisors see allocations to/from them
      filter.$or = [{ fromUser: req.user._id }, { toUser: req.user._id }];
    } else if (req.user.role === 3) {
      // Supervisors see only allocations to them
      filter.toUser = req.user._id;
    }

    if (siteId) filter.site = siteId;
    if (status) filter.status = status;
    if (fromUser && req.user.role === 1) filter.fromUser = fromUser;
    if (toUser && req.user.role === 1) filter.toUser = toUser;

    const allocations = await FundAllocation.find(filter)
      .populate('fromUser', 'name email role')
      .populate('toUser', 'name email role')
      .populate('site', 'name')
      .sort({ allocationDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await FundAllocation.countDocuments(filter);

    res.json({
      allocations,
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

// Get fund flow summary for user
router.get('/my-summary', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    // Funds received
    const receivedAgg = await FundAllocation.aggregate([
      {
        $match: {
          organization: req.user.organization,
          toUser: req.user._id,
          status: 'disbursed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Funds disbursed (sent to others)
    const disbursedAgg = await FundAllocation.aggregate([
      {
        $match: {
          organization: req.user.organization,
          fromUser: req.user._id,
          status: 'disbursed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Pending to receive
    const pendingReceivedAgg = await FundAllocation.aggregate([
      {
        $match: {
          organization: req.user.organization,
          toUser: req.user._id,
          status: { $in: ['pending', 'approved'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      received: {
        total: receivedAgg[0]?.total || 0,
        count: receivedAgg[0]?.count || 0
      },
      disbursed: {
        total: disbursedAgg[0]?.total || 0,
        count: disbursedAgg[0]?.count || 0
      },
      pendingToReceive: {
        total: pendingReceivedAgg[0]?.total || 0,
        count: pendingReceivedAgg[0]?.count || 0
      },
      balance: (receivedAgg[0]?.total || 0) - (disbursedAgg[0]?.total || 0)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get investment pool summary (Admin only)
router.get('/investment-pool/summary', authenticate, requireRole(1), async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const poolCheck = await validateInvestmentPool(0, req.user.organization);

    res.json({
      totalInvestment: poolCheck.totalInvestment,
      totalAllocated: poolCheck.totalAllocated,
      availablePool: poolCheck.availablePool
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get wallet summary for user (wallet-based system)
router.get('/wallet/summary', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    // Convert userId properly - handle both string query param and ObjectId from req.user
    const userId = req.query.userId && req.user.role === 1
      ? (req.query.userId instanceof mongoose.Types.ObjectId
        ? req.query.userId
        : mongoose.Types.ObjectId.createFromHexString(req.query.userId))
      : req.user._id;

    // Convert organization properly
    const orgId = req.user.organization instanceof mongoose.Types.ObjectId
      ? req.user.organization
      : mongoose.Types.ObjectId.createFromHexString(req.user.organization.toString());

    // Total received (credited to wallet from Investment)
    const receivedAgg = await FundAllocation.aggregate([
      {
        $match: {
          organization: orgId,
          toUser: userId,
          status: 'disbursed'
        }
      },
      {
        $group: {
          _id: null,
          totalReceived: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalReceived = receivedAgg[0]?.totalReceived || 0;
    const receivedCount = receivedAgg[0]?.count || 0;

    // Total expenses by this user
    const expensesAgg = await Expense.aggregate([
      {
        $match: {
          organization: orgId,
          user: userId
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalExpenses = expensesAgg[0]?.totalExpenses || 0;
    const expenseCount = expensesAgg[0]?.count || 0;

    // Total bills created by this user (credited/paid status)
    const billsAgg = await Bill.aggregate([
      {
        $match: {
          organization: orgId,
          createdBy: userId,
          status: { $in: ['credited', 'paid'] }
        }
      },
      {
        $group: {
          _id: null,
          totalBills: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalBills = billsAgg[0]?.totalBills || 0;
    const billCount = billsAgg[0]?.count || 0;

    // Worker ledger entries linked to this user's fund allocations
    const userAllocations = await FundAllocation.find({
      organization: orgId,
      toUser: userId,
      status: 'disbursed'
    }).select('_id');

    const allocationIds = userAllocations.map(a => a._id);

    const ledgerAgg = await WorkerLedger.aggregate([
      {
        $match: {
          organization: orgId,
          fundAllocation: { $in: allocationIds }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const ledgerCredits = ledgerAgg.find(l => l._id === 'credit')?.total || 0;
    const ledgerDebits = ledgerAgg.find(l => l._id === 'debit')?.total || 0;
    const netLedger = ledgerCredits - ledgerDebits;
    const ledgerCount = ledgerAgg.reduce((sum, l) => sum + l.count, 0);

    // Get sub-allocations (funds passed down to others)
    // Exclude self-allocations to avoid double-counting
    const subAllocationsAgg = await FundAllocation.aggregate([
      {
        $match: {
          organization: orgId,
          fromUser: userId,
          status: 'disbursed',
          $expr: { $ne: ['$fromUser', '$toUser'] } // Exclude self-allocations
        }
      },
      {
        $group: {
          _id: null,
          totalSubAllocated: { $sum: '$amount' }
        }
      }
    ]);

    const totalSubAllocated = subAllocationsAgg[0]?.totalSubAllocated || 0;

    // Calculate totals - include sub-allocations in spent amount
    const totalSpent = totalExpenses + totalBills + netLedger + totalSubAllocated;
    const remainingBalance = totalReceived - totalSpent;

    res.json({
      totalReceived,
      receivedCount,
      breakdown: {
        expenses: {
          total: totalExpenses,
          count: expenseCount
        },
        bills: {
          total: totalBills,
          count: billCount
        },
        ledger: {
          credits: ledgerCredits,
          debits: ledgerDebits,
          net: netLedger,
          count: ledgerCount
        },
        subAllocations: {
          total: totalSubAllocated,
          count: subAllocationsAgg[0] ? 1 : 0
        }
      },
      totalSpent,
      remainingBalance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get fund utilization for a specific allocation
router.get('/:id/utilization', authenticate, async (req, res) => {
  try {
    const allocation = await FundAllocation.findById(req.params.id)
      .populate('fromUser', 'name email role')
      .populate('toUser', 'name email role')
      .populate('site', 'name');

    if (!allocation) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    // Check organization access
    if (allocation.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get expenses linked to this fund allocation
    const expenses = await Expense.find({ fundAllocation: allocation._id })
      .populate('site', 'name')
      .populate('category', 'name')
      .populate('user', 'name');

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Get bills linked to this fund allocation
    const bills = await Bill.find({ fundAllocation: allocation._id })
      .populate('site', 'name')
      .populate('createdBy', 'name');

    const totalBills = bills.reduce((sum, b) => sum + b.totalAmount, 0);

    // Get worker ledger entries linked to this fund allocation
    const ledgerEntries = await WorkerLedger.find({ fundAllocation: allocation._id })
      .populate('worker', 'name')
      .populate('site', 'name');

    const ledgerCredits = ledgerEntries.filter(e => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0);
    const ledgerDebits = ledgerEntries.filter(e => e.type === 'debit').reduce((sum, e) => sum + e.amount, 0);

    // Get sub-allocations (funds passed down to others)
    // Exclude self-allocations to avoid double-counting
    const subAllocations = await FundAllocation.find({
      organization: allocation.organization,
      fromUser: allocation.toUser._id,
      status: 'disbursed',
      toUser: { $ne: allocation.toUser._id } // Exclude self-allocations
    }).populate('toUser', 'name email role');

    const totalSubAllocated = subAllocations.reduce((sum, a) => sum + a.amount, 0);

    const totalUtilized = totalExpenses + totalBills + (ledgerCredits - ledgerDebits) + totalSubAllocated;
    const remainingBalance = allocation.amount - totalUtilized;

    res.json({
      allocation,
      utilization: {
        expenses: {
          items: expenses,
          total: totalExpenses,
          count: expenses.length
        },
        bills: {
          items: bills,
          total: totalBills,
          count: bills.length
        },
        workerLedger: {
          items: ledgerEntries,
          credits: ledgerCredits,
          debits: ledgerDebits,
          net: ledgerCredits - ledgerDebits,
          count: ledgerEntries.length
        },
        subAllocations: {
          items: subAllocations,
          total: totalSubAllocated,
          count: subAllocations.length
        }
      },
      summary: {
        allocated: allocation.amount,
        totalUtilized,
        remainingBalance,
        utilizationPercent: allocation.amount > 0 ? ((totalUtilized / allocation.amount) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get organization-wide fund flow summary
router.get('/flow/summary', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    // Get all disbursed allocations grouped by level
    const allocations = await FundAllocation.find({
      organization: req.user.organization,
      status: 'disbursed'
    })
      .populate('fromUser', 'name email role')
      .populate('toUser', 'name email role')
      .populate('site', 'name');

    // Separate by flow type
    const developerToEngineer = allocations.filter(a => a.fromUser?.role === 1 && a.toUser?.role === 2);
    const engineerToSupervisor = allocations.filter(a => a.fromUser?.role === 2 && a.toUser?.role === 3);
    const developerToSupervisor = allocations.filter(a => a.fromUser?.role === 1 && a.toUser?.role === 3);

    // Group allocations by recipient
    const groupByRecipient = (allocs) => {
      const grouped = {};
      allocs.forEach(a => {
        const key = a.toUser?._id?.toString();
        if (!key) return;
        if (!grouped[key]) {
          grouped[key] = { toUser: a.toUser, fromUser: a.fromUser, total: 0, count: 0 };
        }
        grouped[key].total += a.amount;
        grouped[key].count += 1;
      });
      return Object.values(grouped);
    };

    // Get total utilized from each category
    const expenseTotal = await Expense.aggregate([
      { $match: { organization: req.user.organization } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    const billTotal = await Bill.aggregate([
      { $match: { organization: req.user.organization, status: { $in: ['credited', 'paid'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
    ]);

    const ledgerTotal = await WorkerLedger.aggregate([
      {
        $match: {
          organization: req.user.organization,
          fundAllocation: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const ledgerCredits = ledgerTotal.find(l => l._id === 'credit')?.total || 0;
    const ledgerDebits = ledgerTotal.find(l => l._id === 'debit')?.total || 0;

    res.json({
      fundFlow: {
        developerToEngineer: {
          total: developerToEngineer.reduce((sum, a) => sum + a.amount, 0),
          count: developerToEngineer.length,
          recipients: groupByRecipient(developerToEngineer)
        },
        engineerToSupervisor: {
          total: engineerToSupervisor.reduce((sum, a) => sum + a.amount, 0),
          count: engineerToSupervisor.length,
          recipients: groupByRecipient(engineerToSupervisor)
        },
        developerToSupervisor: {
          total: developerToSupervisor.reduce((sum, a) => sum + a.amount, 0),
          count: developerToSupervisor.length,
          recipients: groupByRecipient(developerToSupervisor)
        }
      },
      utilization: {
        expenses: {
          total: expenseTotal[0]?.total || 0,
          count: expenseTotal[0]?.count || 0
        },
        bills: {
          total: billTotal[0]?.total || 0,
          count: billTotal[0]?.count || 0
        },
        workerLedger: {
          credits: ledgerCredits,
          debits: ledgerDebits,
          net: ledgerCredits - ledgerDebits,
          count: ledgerTotal.reduce((sum, l) => sum + l.count, 0)
        }
      },
      totalDisbursed: allocations.reduce((sum, a) => sum + a.amount, 0),
      totalUtilized: (expenseTotal[0]?.total || 0) + (billTotal[0]?.total || 0) + (ledgerCredits - ledgerDebits)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Enhanced fund flow with site-wise and GST breakdown
router.get('/flow/detailed', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    // Get all disbursed allocations
    const allocations = await FundAllocation.find({
      organization: req.user.organization,
      status: 'disbursed'
    })
      .populate('fromUser', 'name email role')
      .populate('toUser', 'name email role')
      .populate('site', 'name')
      .sort({ allocationDate: -1 });

    // Get site-wise fund allocation and utilization
    const siteWiseData = await FundAllocation.aggregate([
      {
        $match: {
          organization: req.user.organization,
          status: 'disbursed',
          site: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$site',
          totalAllocated: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'sites',
          localField: '_id',
          foreignField: '_id',
          as: 'siteDetails'
        }
      },
      { $unwind: '$siteDetails' },
      {
        $lookup: {
          from: 'expenses',
          let: { siteId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$site', '$$siteId'] }, status: 'paid' } },
            {
              $group: {
                _id: null,
                totalExpenses: { $sum: '$amount' },
                totalBaseAmount: { $sum: { $ifNull: ['$baseAmount', 0] } },
                totalGST: { $sum: { $ifNull: ['$gstAmount', 0] } },
                count: { $sum: 1 }
              }
            }
          ],
          as: 'expenseData'
        }
      },
      {
        $project: {
          site: '$siteDetails',
          totalAllocated: 1,
          allocationCount: '$count',
          expenses: { $arrayElemAt: ['$expenseData', 0] }
        }
      }
    ]);

    // Get GST breakdown across all expenses
    const gstBreakdown = await Expense.aggregate([
      {
        $match: {
          organization: req.user.organization,
          status: 'paid',
          isBill: true
        }
      },
      {
        $group: {
          _id: '$gstPercentage',
          totalBaseAmount: { $sum: '$baseAmount' },
          totalGST: { $sum: '$gstAmount' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      allocations,
      siteWise: siteWiseData.map(s => ({
        site: s.site,
        totalAllocated: s.totalAllocated,
        allocationCount: s.allocationCount,
        totalExpenses: s.expenses?.totalExpenses || 0,
        totalBaseAmount: s.expenses?.totalBaseAmount || 0,
        totalGST: s.expenses?.totalGST || 0,
        expenseCount: s.expenses?.count || 0,
        remaining: s.totalAllocated - (s.expenses?.totalExpenses || 0)
      })),
      gstBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create fund allocation (Level 1, 2, and 3)
router.post('/', authenticate, requireRole(1, 2, 3), async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { toUserId, siteId, amount, description, referenceNumber } = req.body;

    // Verify recipient
    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // For Level 2 (Engineer) and Level 3 (Supervisor), check wallet balance and prevent self-allocation
    if (req.user.role === 2 || req.user.role === 3) {
      // Engineers and Supervisors cannot allocate to themselves
      if (toUserId === req.user._id.toString()) {
        return res.status(400).json({ message: 'Cannot allocate funds to yourself. Only developers can allocate from investment pool.' });
      }

      // Allow Engineer → Supervisor transfer
      const isEngineerToSupervisor =
        req.user.role === 2 && toUser.role === 3;

      if (!isEngineerToSupervisor) {
        // Otherwise, enforce team hierarchy
        const childIds = await req.user.getChildIds();
        if (!childIds.some(id => id.toString() === toUserId)) {
          return res.status(403).json({
            message: 'Can only allocate funds to your team members or supervisor'
          });
        }
      }


      // Validate wallet balance
      const walletCheck = await validateWalletBalance(req.user._id, amount, req.user.organization);
      if (!walletCheck.available) {
        return res.status(400).json({
          message: walletCheck.message,
          walletBalance: walletCheck.balance
        });
      }
    }

    // For Level 1 (Developer), validate against investment pool
    if (req.user.role === 1) {
      const poolCheck = await validateInvestmentPool(amount, req.user.organization);
      if (!poolCheck.available) {
        return res.status(400).json({
          message: poolCheck.message,
          investmentPool: poolCheck.totalInvestment,
          alreadyAllocated: poolCheck.totalAllocated,
          availablePool: poolCheck.availablePool
        });
      }
    }

    // Verify site if provided
    if (siteId) {
      const site = await Site.findById(siteId);
      if (!site) {
        return res.status(404).json({ message: 'Site not found' });
      }
      if (site.organization.toString() !== req.user.organization.toString()) {
        return res.status(403).json({ message: 'Site not in your organization' });
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const allocation = new FundAllocation({
        organization: req.user.organization,
        fromUser: req.user._id,
        toUser: toUserId,
        site: siteId || null,
        amount,
        description,
        referenceNumber,
        status: 'disbursed',
        disbursedDate: new Date()
      });

      await allocation.save({ session });

      // Credit receiver wallet on creation (auto-disbursed)
      if (req.user.role === 1) {
        // Developer: funds come from investment pool — only credit receiver
        await creditWallet(toUserId, amount, session);
      } else {
        // Engineer/Supervisor: transfer from sender's wallet to receiver's wallet
        await transferWallet(req.user._id, toUserId, amount, session);
      }

      await session.commitTransaction();

      await allocation.populate('fromUser', 'name email role');
      await allocation.populate('toUser', 'name email role');
      if (siteId) await allocation.populate('site', 'name');

      res.status(201).json(allocation);
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update allocation status (approve/reject/disburse)
router.put('/:id/status', authenticate, requireRole(1, 2, 3), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status } = req.body;

    if (!['approved', 'rejected', 'disbursed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const allocation = await FundAllocation.findById(req.params.id).session(session);

    if (!allocation) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Allocation not found' });
    }

    // Check organization access
    if (allocation.organization.toString() !== req.user.organization?.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'Access denied' });
    }

    // Level 1 can approve/reject any, Level 2 and 3 can only disburse their received funds
    if (req.user.role === 2 || req.user.role === 3) {
      if (status !== 'disbursed' || allocation.toUser.toString() !== req.user._id.toString()) {
        await session.abortTransaction();
        return res.status(403).json({ message: 'Can only mark as disbursed for funds you received' });
      }
    }

    // Check if status is already disbursed to prevent double-crediting
    if (allocation.status === 'disbursed' && status === 'disbursed') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Allocation already disbursed' });
    }

    allocation.status = status;
    if (status === 'disbursed') {
      allocation.disbursedDate = new Date();

      // Update wallet balances
      const fromUser = await User.findById(allocation.fromUser).session(session);

      // If fromUser is Developer (role 1), funds come from investment pool - only credit receiver
      // Otherwise, transfer from sender's wallet to receiver's wallet
      if (fromUser && fromUser.role === 1) {
        // Credit only receiver (funds from investment pool)
        await creditWallet(allocation.toUser, allocation.amount, session);
      } else {
        // Transfer from sender to receiver
        await transferWallet(allocation.fromUser, allocation.toUser, allocation.amount, session);
      }
    }

    await allocation.save({ session });
    await session.commitTransaction();

    await allocation.populate('fromUser', 'name email role');
    await allocation.populate('toUser', 'name email role');
    if (allocation.site) await allocation.populate('site', 'name');

    res.json(allocation);
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

// Get single allocation
router.get('/:id', authenticate, async (req, res) => {
  try {
    const allocation = await FundAllocation.findById(req.params.id)
      .populate('fromUser', 'name email role')
      .populate('toUser', 'name email role')
      .populate('site', 'name');

    if (!allocation) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    // Check access
    if (allocation.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Non-developers can only see their own allocations
    if (req.user.role !== 1) {
      if (allocation.fromUser._id.toString() !== req.user._id.toString() &&
        allocation.toUser._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(allocation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete allocation (Developer can delete any allocation)
router.delete('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const allocation = await FundAllocation.findById(req.params.id);

    if (!allocation) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    if (allocation.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Developers can delete any allocation regardless of status

    await allocation.deleteOne();

    res.json({ message: 'Allocation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
