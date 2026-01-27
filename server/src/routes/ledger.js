import express from 'express';
import { WorkerLedger, User, Site, Contract, FundAllocation } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateFundAvailability } from './funds.js';
import mongoose from 'mongoose';

const router = express.Router();

// Get ledger entries
router.get('/', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { workerId, siteId, type, category, startDate, endDate, page = 1, limit = 50 } = req.query;

    const filter = { organization: req.user.organization };

    // Filter by role
    // Role 1 = Developer (sees all)
    // Role 2 = Engineer (sees their team)
    // Role 3 = Supervisor (sees their workers)
    // Role 4 = Worker (sees only their own)
    if (req.user.role === 4) {
      // Workers can only see their own ledger
      filter.worker = req.user._id;
    } else if (req.user.role === 2 || req.user.role === 3) {
      // Engineers and Supervisors can see ledger of their children
      const childIds = await req.user.getChildIds();
      filter.worker = { $in: childIds };
    }
    // Role 1 (Developer) sees all - no filter

    if (workerId && req.user.role !== 4) filter.worker = workerId;
    if (siteId) filter.site = siteId;
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate) filter.transactionDate.$lte = new Date(endDate);
    }

    const entries = await WorkerLedger.find(filter)
      .populate('worker', 'name email role')
      .populate('site', 'name')
      .populate('createdBy', 'name')
      .populate('contract', 'title contractNumber totalAmount totalPaid status')
      .sort({ transactionDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await WorkerLedger.countDocuments(filter);

    res.json({
      entries,
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

// Get worker balance summary
router.get('/balance/:workerId', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { workerId } = req.params;

    // Verify access
    // Role 4 (Worker) can only see their own balance
    if (req.user.role === 4 && req.user._id.toString() !== workerId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Role 2 (Engineer) and Role 3 (Supervisor) can see their team's balance
    if (req.user.role === 2 || req.user.role === 3) {
      const childIds = await req.user.getChildIds();
      if (!childIds.some(id => id.toString() === workerId)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const worker = await User.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Calculate balance
    const creditAgg = await WorkerLedger.aggregate([
      {
        $match: {
          organization: req.user.organization,
          worker: worker._id,
          type: 'credit'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const debitAgg = await WorkerLedger.aggregate([
      {
        $match: {
          organization: req.user.organization,
          worker: worker._id,
          type: 'debit'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    // By category
    const categorySummary = await WorkerLedger.aggregate([
      {
        $match: {
          organization: req.user.organization,
          worker: worker._id
        }
      },
      {
        $group: {
          _id: { type: '$type', category: '$category' },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalCredits = creditAgg[0]?.total || 0;
    const totalDebits = debitAgg[0]?.total || 0;

    res.json({
      worker: {
        _id: worker._id,
        name: worker.name,
        email: worker.email
      },
      totalCredits,
      totalDebits,
      balance: totalCredits - totalDebits,
      categorySummary
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get pending salary summary for a worker
router.get('/pending-salary/:workerId', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { workerId } = req.params;

    // Verify access
    if (req.user.role === 4 && req.user._id.toString() !== workerId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 2 || req.user.role === 3) {
      const childIds = await req.user.getChildIds();
      if (!childIds.some(id => id.toString() === workerId)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const worker = await User.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Get pending salary entries
    const pendingEntries = await WorkerLedger.find({
      organization: req.user.organization,
      worker: workerId,
      category: 'pending_salary',
      status: 'pending'
    })
      .populate('site', 'name')
      .populate('linkedAttendance')
      .sort({ transactionDate: -1 });

    const totalPending = pendingEntries.reduce((sum, e) => sum + e.amount, 0);

    // Get unpaid advances (advances without corresponding deduction entries)
    const advances = await WorkerLedger.find({
      organization: req.user.organization,
      worker: workerId,
      category: 'advance',
      type: 'credit'
    });

    // Check which advances have been deducted
    const unpaidAdvances = [];
    for (const advance of advances) {
      const deduction = await WorkerLedger.findOne({
        linkedAdvance: advance._id,
        category: 'deduction'
      });

      if (!deduction) {
        unpaidAdvances.push(advance);
      }
    }

    const totalAdvances = unpaidAdvances.reduce((sum, a) => sum + a.amount, 0);
    const netPayable = totalPending - totalAdvances;

    res.json({
      worker: {
        _id: worker._id,
        name: worker.name,
        email: worker.email,
        dailyRate: worker.dailyRate
      },
      totalPending,
      totalAdvances,
      netPayable,
      pendingEntries: pendingEntries.map(e => ({
        _id: e._id,
        amount: e.amount,
        description: e.description,
        transactionDate: e.transactionDate,
        site: e.site,
        periodStart: e.periodStart,
        periodEnd: e.periodEnd
      })),
      advanceEntries: unpaidAdvances.map(a => ({
        _id: a._id,
        amount: a.amount,
        description: a.description,
        transactionDate: a.transactionDate,
        referenceNumber: a.referenceNumber
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create ledger entry (Developer, Engineer, Supervisor)
router.post('/', authenticate, requireRole(1, 2, 3), async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { workerId, siteId, type, amount, category, description, transactionDate, referenceNumber, paymentMode, fundAllocationId, contractId } = req.body;

    // Verify worker
    const worker = await User.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Engineer and Supervisor can only create entries for their children
    if (req.user.role === 2 || req.user.role === 3) {
      const childIds = await req.user.getChildIds();
      if (!childIds.some(id => id.toString() === workerId)) {
        return res.status(403).json({ message: 'Can only manage ledger for your team members' });
      }
    }

    // Verify site if provided
    if (siteId) {
      const site = await Site.findById(siteId);
      if (!site) {
        return res.status(404).json({ message: 'Site not found' });
      }
    }

    // Verify contract if provided
    if (contractId) {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        return res.status(404).json({ message: 'Contract not found' });
      }
    }

    const entry = new WorkerLedger({
      organization: req.user.organization,
      worker: workerId,
      site: siteId || null,
      createdBy: req.user._id,
      fundAllocation: fundAllocationId || null,
      contract: contractId || null,
      type,
      amount,
      category,
      description,
      transactionDate: transactionDate || new Date(),
      referenceNumber,
      paymentMode
    });

    await entry.save();
    await entry.populate('worker', 'name email role');
    if (siteId) await entry.populate('site', 'name');
    await entry.populate('createdBy', 'name');
    if (fundAllocationId) await entry.populate('fundAllocation');
    if (contractId) await entry.populate('contract', 'title contractNumber totalAmount totalPaid status');

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single entry
router.get('/:id', authenticate, async (req, res) => {
  try {
    const entry = await WorkerLedger.findById(req.params.id)
      .populate('worker', 'name email role')
      .populate('site', 'name')
      .populate('createdBy', 'name')
      .populate('contract', 'title contractNumber totalAmount totalPaid status');

    if (!entry) {
      return res.status(404).json({ message: 'Ledger entry not found' });
    }

    // Check organization access
    if (entry.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Workers can only see their own entries
    if (req.user.role === 4 && entry.worker._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update entry
router.put('/:id', authenticate, requireRole(1, 2, 3), async (req, res) => {
  try {
    const entry = await WorkerLedger.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({ message: 'Ledger entry not found' });
    }

    // Check organization access
    if (entry.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only creator or Level 1 can edit
    if (req.user.role !== 1 && entry.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Can only edit your own entries' });
    }

    const { type, amount, category, description, transactionDate, referenceNumber, paymentMode } = req.body;

    if (type) entry.type = type;
    if (amount !== undefined) entry.amount = amount;
    if (category) entry.category = category;
    if (description !== undefined) entry.description = description;
    if (transactionDate) entry.transactionDate = transactionDate;
    if (referenceNumber !== undefined) entry.referenceNumber = referenceNumber;
    if (paymentMode) entry.paymentMode = paymentMode;

    await entry.save();
    await entry.populate('worker', 'name email role');
    if (entry.site) await entry.populate('site', 'name');
    await entry.populate('createdBy', 'name');

    res.json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete entry (Level 1 only)
router.delete('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const entry = await WorkerLedger.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({ message: 'Ledger entry not found' });
    }

    if (entry.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await entry.deleteOne();

    res.json({ message: 'Ledger entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Pay salary with automatic advance deduction
router.post('/pay-salary', authenticate, requireRole(1, 2, 3), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.user.organization) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const {
      workerId,
      siteId,
      periodStart,
      periodEnd,
      fundAllocationId,
      paymentMode,
      referenceNumber,
      notes
    } = req.body;

    // Validate required fields
    if (!workerId || !fundAllocationId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Worker ID and Fund Allocation ID are required' });
    }

    // Verify worker
    const worker = await User.findById(workerId).session(session);
    if (!worker) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Verify access
    if (req.user.role === 2 || req.user.role === 3) {
      const childIds = await req.user.getChildIds();
      if (!childIds.some(id => id.toString() === workerId)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({ message: 'Can only pay salary for your team members' });
      }
    }

    // Verify fund allocation
    const fundAllocation = await FundAllocation.findById(fundAllocationId).session(session);
    if (!fundAllocation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Fund allocation not found' });
    }

    if (fundAllocation.status !== 'disbursed') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: `Fund allocation must be disbursed (current status: ${fundAllocation.status})`
      });
    }

    // Build filter for pending salary entries
    const pendingFilter = {
      organization: req.user.organization,
      worker: workerId,
      category: 'pending_salary',
      status: 'pending'
    };

    if (siteId) pendingFilter.site = siteId;
    if (periodStart || periodEnd) {
      pendingFilter.transactionDate = {};
      if (periodStart) pendingFilter.transactionDate.$gte = new Date(periodStart);
      if (periodEnd) pendingFilter.transactionDate.$lte = new Date(periodEnd);
    }

    // Fetch pending salary entries
    const pendingEntries = await WorkerLedger.find(pendingFilter).session(session);

    if (pendingEntries.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'No pending salary entries found for the specified period' });
    }

    const totalPendingSalary = pendingEntries.reduce((sum, e) => sum + e.amount, 0);

    // Fetch unpaid advances
    const advances = await WorkerLedger.find({
      organization: req.user.organization,
      worker: workerId,
      category: 'advance',
      type: 'credit'
    }).session(session);

    const unpaidAdvances = [];
    for (const advance of advances) {
      const deduction = await WorkerLedger.findOne({
        linkedAdvance: advance._id,
        category: 'deduction'
      }).session(session);

      if (!deduction) {
        unpaidAdvances.push(advance);
      }
    }

    const totalAdvances = unpaidAdvances.reduce((sum, a) => sum + a.amount, 0);
    const netPayable = totalPendingSalary - totalAdvances;

    // Validate sufficient funds
    const fundCheck = await validateFundAvailability(fundAllocationId, Math.max(netPayable, 0));
    if (!fundCheck.available && netPayable > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: fundCheck.message,
        available: fundCheck.balance,
        requested: netPayable
      });
    }

    // Create payment transaction entries
    const paymentEntries = [];
    const deductionEntries = [];
    const now = new Date();

    // Mark pending salaries as paid
    for (const entry of pendingEntries) {
      entry.status = 'paid';
      entry.fundAllocation = fundAllocationId;
      entry.paidDate = now;
      await entry.save({ session });
    }

    // Create deduction entries for advances
    for (const advance of unpaidAdvances) {
      const deduction = new WorkerLedger({
        organization: req.user.organization,
        worker: workerId,
        site: siteId || null,
        createdBy: req.user._id,
        type: 'debit',
        category: 'deduction',
        amount: advance.amount,
        description: `Advance deduction from salary${periodStart && periodEnd ? ` (${new Date(periodStart).toISOString().split('T')[0]} to ${new Date(periodEnd).toISOString().split('T')[0]})` : ''}`,
        transactionDate: now,
        linkedAdvance: advance._id,
        status: 'paid',
        paidDate: now
      });

      await deduction.save({ session });
      deductionEntries.push(deduction);
    }

    // Create final payment entry if net payable is positive
    if (netPayable > 0) {
      const payment = new WorkerLedger({
        organization: req.user.organization,
        worker: workerId,
        site: siteId || null,
        createdBy: req.user._id,
        fundAllocation: fundAllocationId,
        type: 'credit',
        category: 'salary',
        amount: netPayable,
        description: `Salary payment${periodStart && periodEnd ? ` for ${new Date(periodStart).toISOString().split('T')[0]} to ${new Date(periodEnd).toISOString().split('T')[0]}` : ''}${notes ? ` - ${notes}` : ''}`,
        transactionDate: now,
        referenceNumber,
        paymentMode: paymentMode || 'cash',
        status: 'paid',
        paidDate: now,
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null
      });

      await payment.save({ session });
      paymentEntries.push(payment);
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Salary paid successfully',
      summary: {
        grossSalary: totalPendingSalary,
        advancesDeducted: totalAdvances,
        netPaid: netPayable,
        pendingEntriesProcessed: pendingEntries.length,
        advancesDeductedCount: unpaidAdvances.length
      },
      pendingEntries: pendingEntries.map(e => ({
        _id: e._id,
        amount: e.amount,
        description: e.description
      })),
      deductionEntries: deductionEntries.map(d => ({
        _id: d._id,
        amount: d.amount,
        description: d.description
      })),
      paymentEntries: paymentEntries.map(p => ({
        _id: p._id,
        amount: p.amount,
        description: p.description,
        referenceNumber: p.referenceNumber
      }))
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
});

export default router;
