import express from 'express';
import { WorkerLedger, User, Site, Contract } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

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
    if (req.user.role === 3) {
      // Workers can only see their own ledger
      filter.worker = req.user._id;
    } else if (req.user.role === 2) {
      // Supervisors can see ledger of their children
      const childIds = await req.user.getChildIds();
      filter.worker = { $in: childIds };
    }

    if (workerId && req.user.role !== 3) filter.worker = workerId;
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
    if (req.user.role === 3 && req.user._id.toString() !== workerId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 2) {
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

// Create ledger entry (Level 1 and 2)
router.post('/', authenticate, requireRole(1, 2), async (req, res) => {
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

    // Level 2 can only create entries for their children
    if (req.user.role === 2) {
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
    if (req.user.role === 3 && entry.worker._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update entry
router.put('/:id', authenticate, requireRole(1, 2), async (req, res) => {
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

export default router;
