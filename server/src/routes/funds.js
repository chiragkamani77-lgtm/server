import express from 'express';
import { FundAllocation, User, Site } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

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
      // Workers see only allocations to them
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

// Create fund allocation (Level 1 and 2)
router.post('/', authenticate, requireRole(1, 2), async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { toUserId, siteId, amount, purpose, description, referenceNumber } = req.body;

    // Verify recipient
    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // For Level 2, can only allocate to their children
    if (req.user.role === 2) {
      const childIds = await req.user.getChildIds();
      if (!childIds.some(id => id.toString() === toUserId)) {
        return res.status(403).json({ message: 'Can only allocate funds to your team members' });
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

    const allocation = new FundAllocation({
      organization: req.user.organization,
      fromUser: req.user._id,
      toUser: toUserId,
      site: siteId || null,
      amount,
      purpose,
      description,
      referenceNumber,
      status: req.user.role === 1 ? 'approved' : 'pending' // Auto-approve if from Developer
    });

    await allocation.save();
    await allocation.populate('fromUser', 'name email role');
    await allocation.populate('toUser', 'name email role');
    if (siteId) await allocation.populate('site', 'name');

    res.status(201).json(allocation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update allocation status (approve/reject/disburse)
router.put('/:id/status', authenticate, requireRole(1, 2), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['approved', 'rejected', 'disbursed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const allocation = await FundAllocation.findById(req.params.id);

    if (!allocation) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    // Check organization access
    if (allocation.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Level 1 can approve/reject any, Level 2 can only disburse their received funds
    if (req.user.role === 2) {
      if (status !== 'disbursed' || allocation.toUser.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Can only mark as disbursed for funds you received' });
      }
    }

    allocation.status = status;
    if (status === 'disbursed') {
      allocation.disbursedDate = new Date();
    }

    await allocation.save();
    await allocation.populate('fromUser', 'name email role');
    await allocation.populate('toUser', 'name email role');
    if (allocation.site) await allocation.populate('site', 'name');

    res.json(allocation);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

// Delete allocation (Level 1 only, and only pending)
router.delete('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const allocation = await FundAllocation.findById(req.params.id);

    if (!allocation) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    if (allocation.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (allocation.status !== 'pending') {
      return res.status(400).json({ message: 'Can only delete pending allocations' });
    }

    await allocation.deleteOne();

    res.json({ message: 'Allocation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
