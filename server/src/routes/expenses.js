import express from 'express';
import mongoose from 'mongoose';
import { Expense, Site, FundAllocation, User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { validateFundAvailability } from './funds.js';
import { debitWallet, creditWallet } from '../utils/walletHelper.js';

const router = express.Router();

// Helper to build visibility filter based on user role
const getVisibilityFilter = async (user, siteId) => {
  const filter = {};

  if (siteId) {
    filter.site = siteId;
  }

  switch (user.role) {
    case 1: // Developer - sees all expenses
      break;
    case 2: { // Engineer - sees own + all supervisors & workers in same org (role hierarchy)
      const subordinates = await User.find({
        organization: user.organization,
        role: { $in: [3, 4] }
      }).select('_id');
      filter.user = { $in: [user._id, ...subordinates.map(s => s._id)] };
      break;
    }
    case 3: { // Supervisor - sees own + all workers in same org
      const workers = await User.find({
        organization: user.organization,
        role: 4
      }).select('_id');
      filter.user = { $in: [user._id, ...workers.map(w => w._id)] };
      break;
    }
    default: // Worker - sees only own expenses
      filter.user = user._id;
      break;
  }

  return filter;
};

// Helper to mask amounts for supervisor viewing child expenses
const maskChildAmounts = (expense, currentUser) => {
  // Developer sees everything
  if (currentUser.role === 1) {
    return expense;
  }

  // If it's the user's own expense, show full details
  if (expense.user?._id?.toString() === currentUser._id.toString()) {
    return expense;
  }

  // Engineers (role 2) can see all amounts to approve/reject
  return expense;
};

// Get expenses (filtered by visibility)
router.get('/', authenticate, async (req, res) => {
  try {
    const { siteId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = await getVisibilityFilter(req.user, siteId);

    // Apply additional filters
    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    // For supervisor/worker (role >= 3), restrict to their assigned sites
    if (req.user.role >= 3 && !siteId) {
      const sites = await Site.find({ assignedUsers: req.user._id }).select('_id');
      filter.site = { $in: sites.map(s => s._id) };
    }

    const expenses = await Expense.find(filter)
      .populate('site', 'name')
      .populate('user', 'name email')
      .populate('approvedBy', 'name')
      .populate('fundAllocation', 'amount purpose fromUser toUser')
      .sort({ expenseDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Expense.countDocuments(filter);

    // Mask child amounts for supervisors
    const maskedExpenses = expenses.map(exp => maskChildAmounts(exp, req.user));

    res.json({
      expenses: maskedExpenses,
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

// Get site expenses summary
router.get('/summary/:siteId', authenticate, async (req, res) => {
  try {
    const { siteId } = req.params;

    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    // Check access
    if (req.user.role !== 1 && !site.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filter = await getVisibilityFilter(req.user, siteId);

    // Total expenses aggregate
    const totalAgg = await Expense.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const totalExpenses = totalAgg[0]?.total || 0;
    const totalEntries = totalAgg[0]?.count || 0;

    // Monthly breakdown
    const monthlyBreakdown = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$expenseDate' },
            month: { $month: '$expenseDate' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.json({
      site: {
        id: site._id,
        name: site.name
      },
      totalExpenses,
      totalEntries,
      monthlyBreakdown
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create expense
router.post('/', authenticate, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { siteId, amount, description, vendorName, expenseDate, fundAllocationId } = req.body;

    if (!req.user.organization) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No organization assigned' });
    }

    // Auto-detect site for non-admin users (they only have 1 site)
    let resolvedSiteId = siteId;
    if (!resolvedSiteId && req.user.role !== 1) {
      const assignedSite = await Site.findOne({ assignedUsers: req.user._id }).session(session);
      if (!assignedSite) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'No site assigned to your account.' });
      }
      resolvedSiteId = assignedSite._id;
    }

    // Auto-detect fund allocation from the logged-in user if not provided
    let resolvedFundAllocationId = fundAllocationId;
    if (!resolvedFundAllocationId) {
      const autoAlloc = await FundAllocation.findOne({
        toUser: req.user._id,
        status: 'disbursed'
      }).sort({ allocationDate: -1 }).session(session);

      if (!autoAlloc) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'No disbursed fund allocation found for your account.' });
      }
      resolvedFundAllocationId = autoAlloc._id;
    }

    // Check site access
    const site = await Site.findById(resolvedSiteId).session(session);
    if (!site) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Site not found' });
    }

    if (req.user.role !== 1 && !site.hasAccess(req.user._id)) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'Access denied to this site' });
    }

    // Validate fund allocation exists and is disbursed
    const fundAllocation = await FundAllocation.findById(resolvedFundAllocationId).session(session);
    if (!fundAllocation) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Fund allocation not found' });
    }

    if (fundAllocation.status !== 'disbursed') {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Fund allocation must be disbursed before use (current status: ${fundAllocation.status})`
      });
    }

    // Validate sufficient funds available (using wallet balance)
    const fundCheck = await validateFundAvailability(resolvedFundAllocationId, amount);
    if (!fundCheck.available) {
      await session.abortTransaction();
      return res.status(400).json({
        message: fundCheck.message,
        available: fundCheck.balance,
        requested: amount
      });
    }

    // Developer (role 1): auto-approved, wallet debited immediately
    // Supervisor (role 3): stays pending but wallet is blocked/held immediately
    // Engineer (role 2): stays pending, wallet not touched until developer approves
    const isDeveloper = req.user.role === 1;
    const isSupervisor = req.user.role === 3;
    const isWalletHeld = isDeveloper || isSupervisor; // Wallet debited on creation

    const expense = new Expense({
      organization: req.user.organization,
      site: resolvedSiteId,
      user: req.user._id,
      fundAllocation: resolvedFundAllocationId,
      amount: isWalletHeld ? amount : 0, // Supervisor holds amount in pending state
      requestedAmount: amount,
      approvedAmount: isDeveloper ? amount : null,
      status: isDeveloper ? 'approved' : 'pending',
      approvedBy: isDeveloper ? req.user._id : null,
      approvalDate: isDeveloper ? new Date() : null,
      description,
      vendorName,
      expenseDate: expenseDate || new Date()
    });

    await expense.save({ session });

    // Debit wallet: immediately for developer (approved) and supervisor (pending hold)
    if (isWalletHeld && amount > 0) {
      await debitWallet(req.user._id, amount, session, true); // allowNegative=true
    }

    await session.commitTransaction();

    await expense.populate('site', 'name');

    await expense.populate('user', 'name email');
    await expense.populate('fundAllocation');

    res.status(201).json(expense);
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

// Get single expense
router.get('/:id', authenticate, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('site', 'name')
      .populate('user', 'name email');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check visibility
    const filter = await getVisibilityFilter(req.user, expense.site._id);
    if (filter.user) {
      const userIds = Array.isArray(filter.user.$in) ? filter.user.$in : [filter.user];
      if (!userIds.some(id => id.toString() === expense.user._id.toString())) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper to check if user can manage expense (owner, developer, or parent of expense creator)
const canManageExpense = async (user, expense) => {
  // Owner can always manage their own expense
  if (expense.user.toString() === user._id.toString()) {
    return true;
  }
  // Level 1 (Developer) can manage all expenses
  if (user.role === 1) {
    return true;
  }
  // Level 2 (Supervisor/Engineer) can manage their subordinates' expenses
  if (user.role === 2) {
    const childIds = await user.getChildIds();
    return childIds.some(id => id.toString() === expense.user.toString());
  }
  return false;
};

// Update expense
router.put('/:id', authenticate, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const isDeveloper = req.user.role === 1;
    const isOwner = expense.user.toString() === req.user._id.toString();

    // Developer can edit any expense
    // Non-developers can only edit their own expenses and only certain fields
    if (!isDeveloper && !isOwner) {
      return res.status(403).json({ message: 'Only developers can edit others\' expenses' });
    }

    const { amount, description, vendorName, expenseDate, requestedAmount } = req.body;

    // Non-developers can only edit description, vendorName, expenseDate, requestedAmount
    if (!isDeveloper) {
      if (description !== undefined) expense.description = description;
      if (vendorName !== undefined) expense.vendorName = vendorName;
      if (expenseDate) expense.expenseDate = expenseDate;
      if (requestedAmount !== undefined) expense.requestedAmount = requestedAmount;
    } else {
      // Developer can edit everything
      if (amount !== undefined) expense.amount = amount;
      if (description !== undefined) expense.description = description;
      if (vendorName !== undefined) expense.vendorName = vendorName;
      if (expenseDate) expense.expenseDate = expenseDate;
      if (requestedAmount !== undefined) expense.requestedAmount = requestedAmount;
    }

    await expense.save();
    await expense.populate('site', 'name');

    await expense.populate('user', 'name email');
    await expense.populate('approvedBy', 'name');

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve/Pay expense (Developer only)
router.put('/:id/approve', authenticate, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Only developers (role 1) and engineers (role 2) can approve
    if (req.user.role > 2) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'Only developers and engineers can approve expenses' });
    }

    const expense = await Expense.findById(req.params.id).session(session);

    if (!expense) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Engineers (role 2) can only approve supervisor (role 3) expenses
    if (req.user.role === 2) {
      const expenseOwner = await User.findById(expense.user).select('role').session(session);
      if (!expenseOwner || expenseOwner.role !== 3) {
        await session.abortTransaction();
        return res.status(403).json({ message: 'Engineers can only approve supervisor expenses' });
      }
    }

    const { status, approvedAmount, approvalNotes, paymentMethod, paymentReference } = req.body;

    if (!['approved', 'paid', 'rejected'].includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid status' });
    }

    const previousStatus = expense.status;
    const heldAmount = expense.amount; // Amount already held in wallet (>0 for supervisor, 0 for engineer)
    expense.status = status;

    if (status === 'approved' || status === 'paid') {
      if (approvedAmount === undefined || approvedAmount === null) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Approved amount is required' });
      }
      expense.approvedAmount = approvedAmount;
      expense.amount = approvedAmount;
      expense.approvedBy = req.user._id;
      expense.approvalDate = new Date();

      if (previousStatus === 'pending' && approvedAmount > 0) {
        if (heldAmount > 0) {
          // Wallet was already held (supervisor case) — adjust for any difference
          const diff = heldAmount - approvedAmount;
          if (diff > 0) {
            // Developer approved less → credit back the difference
            await creditWallet(expense.user, diff, session);
          } else if (diff < 0) {
            // Developer approved more → debit the extra
            await debitWallet(expense.user, -diff, session, true);
          }
        } else {
          // Wallet not yet touched (engineer case) — debit now
          await debitWallet(expense.user, approvedAmount, session, true);
        }
      }
    }

    if (status === 'rejected' && heldAmount > 0) {
      // Release the held amount back to supervisor's wallet
      await creditWallet(expense.user, heldAmount, session);
    }

    if (status === 'paid') {
      expense.paidDate = new Date();
      if (paymentMethod) expense.paymentMethod = paymentMethod;
      if (paymentReference) expense.paymentReference = paymentReference;
    }

    if (approvalNotes !== undefined) expense.approvalNotes = approvalNotes;

    await expense.save({ session });
    await session.commitTransaction();

    await expense.populate('site', 'name');

    await expense.populate('user', 'name email');
    await expense.populate('approvedBy', 'name');

    res.json(expense);
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

// Delete expense
router.delete('/:id', authenticate, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const expense = await Expense.findById(req.params.id).session(session);

    if (!expense) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Expense not found' });
    }

    const isDeveloper = req.user.role === 1;
    const isOwner = expense.user.toString() === req.user._id.toString();

    // Developer can delete any expense
    // Non-developers can only delete their own pending expenses
    if (!isDeveloper) {
      if (!isOwner) {
        await session.abortTransaction();
        return res.status(403).json({ message: 'Only developers can delete others\' expenses' });
      }
      if (expense.status !== 'pending') {
        await session.abortTransaction();
        return res.status(403).json({ message: 'Can only delete pending expenses' });
      }
    }

    // Release held wallet amount if expense was pending with a held amount (supervisor case)
    if (expense.status === 'pending' && expense.amount > 0) {
      await creditWallet(expense.user, expense.amount, session);
    }

    await expense.deleteOne({ session });
    await session.commitTransaction();

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

// Upload receipt
router.post('/:id/receipt', authenticate, upload.single('receipt'), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user can manage this expense
    const canManage = await canManageExpense(req.user, expense);
    if (!canManage) {
      return res.status(403).json({ message: 'Can only upload to your own or subordinates\' expenses' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    expense.receiptPath = `/uploads/${req.file.filename}`;
    await expense.save();

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk delete expenses
router.post('/bulk-delete', authenticate, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'IDs array is required and cannot be empty' });
    }

    const isDeveloper = req.user.role === 1;

    // Verify all expenses belong to the user's organization and check permissions
    const expenses = await Expense.find({ _id: { $in: ids }, organization: req.user.organization }).session(session);

    if (expenses.length !== ids.length) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'Some expenses do not belong to your organization' });
    }

    // For non-developers, verify they own all expenses and they're all pending
    if (!isDeveloper) {
      const invalidExpenses = expenses.filter(
        exp => exp.user.toString() !== req.user._id.toString() || exp.status !== 'pending'
      );

      if (invalidExpenses.length > 0) {
        await session.abortTransaction();
        return res.status(403).json({
          message: 'You can only delete your own pending expenses'
        });
      }
    }

    // Refund held wallet amounts for pending supervisor expenses
    for (const exp of expenses) {
      if (exp.status === 'pending' && exp.amount > 0) {
        await creditWallet(exp.user, exp.amount, session);
      }
    }

    await Expense.deleteMany({ _id: { $in: ids } }).session(session);
    await session.commitTransaction();

    res.json({
      success: true,
      message: `${ids.length} expense(s) deleted successfully`,
      deletedCount: ids.length
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

export default router;
