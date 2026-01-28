import express from 'express';
import { Site, User, FundAllocation, Expense, Bill } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all sites (filtered by user access and organization)
router.get('/', authenticate, async (req, res) => {
  try {
    let sites;
    const filter = {};

    // Filter by organization if user has one
    if (req.user.organization) {
      filter.organization = req.user.organization;
    }

    if (req.user.role === 1) {
      // Developer sees all sites in their organization
      sites = await Site.find(filter)
        .populate('createdBy', 'name email')
        .populate('assignedUsers', 'name email role')
        .populate('organization', 'name')
        .sort({ createdAt: -1 });
    } else {
      // Others see only assigned sites
      filter.assignedUsers = req.user._id;
      sites = await Site.find(filter)
        .populate('createdBy', 'name email')
        .populate('assignedUsers', 'name email role')
        .populate('organization', 'name')
        .sort({ createdAt: -1 });
    }

    // Add GST bill summary for each site (only for developers)
    if (req.user.role === 1) {
      const sitesWithGst = await Promise.all(sites.map(async (site) => {
        const bills = await Bill.find({ site: site._id, organization: req.user.organization });
        const gstSummary = {
          totalBills: bills.length,
          totalGstAmount: bills.reduce((sum, b) => sum + (b.gstAmount || 0), 0),
          totalAmount: bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
          pendingBills: bills.filter(b => b.status === 'pending').length,
          approvedBills: bills.filter(b => b.status === 'approved').length,
          paidBills: bills.filter(b => b.status === 'paid').length,
        };
        return {
          ...site.toObject(),
          gstSummary
        };
      }));
      return res.json(sitesWithGst);
    }

    res.json(sites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create site (Level 1 only)
router.post('/', authenticate, requireRole(1), async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'Please create or join an organization first' });
    }

    const { name, address, description, status, budget } = req.body;

    const site = new Site({
      name,
      address,
      description,
      status,
      budget: budget || 0,
      organization: req.user.organization,
      createdBy: req.user._id
    });

    await site.save();
    await site.populate('createdBy', 'name email');
    await site.populate('organization', 'name');

    res.status(201).json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single site
router.get('/:id', authenticate, async (req, res) => {
  try {
    const site = await Site.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('assignedUsers', 'name email role');

    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    // Check access
    if (req.user.role !== 1 && !site.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update site
router.put('/:id', authenticate, requireRole(1, 2), async (req, res) => {
  try {
    const { name, address, description, status, budget } = req.body;

    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    // Level 2 can only update if assigned
    if (req.user.role === 2 && !site.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    site.name = name || site.name;
    site.address = address !== undefined ? address : site.address;
    site.description = description !== undefined ? description : site.description;
    site.status = status || site.status;
    if (budget !== undefined && req.user.role === 1) {
      site.budget = budget;
    }

    await site.save();
    await site.populate('createdBy', 'name email');
    await site.populate('assignedUsers', 'name email role');
    await site.populate('organization', 'name');

    res.json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete site (Level 1 only)
router.delete('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const site = await Site.findByIdAndDelete(req.params.id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    res.json({ message: 'Site deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Assign user to site
router.post('/:id/assign', authenticate, requireRole(1, 2, 3), async (req, res) => {
  try {
    const { userId } = req.body;

    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Level 2 (Engineer) can assign any supervisor or worker to any site
    if (req.user.role === 2) {
      if (user.role !== 3 && user.role !== 4) {
        return res.status(403).json({ message: 'Engineers can only assign supervisors or workers to sites' });
      }
    }

    // Level 3 (Supervisor) can assign any worker to any site
    if (req.user.role === 3) {
      if (user.role !== 4) {
        return res.status(403).json({ message: 'Supervisors can only assign workers to sites' });
      }
    }

    if (!site.assignedUsers.includes(userId)) {
      site.assignedUsers.push(userId);
      await site.save();
    }

    await site.populate('assignedUsers', 'name email role parent');

    res.json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove user from site
router.delete('/:id/assign/:userId', authenticate, requireRole(1, 2, 3), async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    const userToRemove = await User.findById(req.params.userId);
    if (!userToRemove) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Level 2 (Engineer) can remove any supervisor or worker from any site
    if (req.user.role === 2) {
      if (userToRemove.role !== 3 && userToRemove.role !== 4) {
        return res.status(403).json({ message: 'Engineers can only remove supervisors or workers from sites' });
      }
    }

    // Level 3 (Supervisor) can remove any worker from any site
    if (req.user.role === 3) {
      if (userToRemove.role !== 4) {
        return res.status(403).json({ message: 'Supervisors can only remove workers from sites' });
      }
    }

    site.assignedUsers = site.assignedUsers.filter(
      u => u.toString() !== req.params.userId
    );
    await site.save();

    await site.populate('assignedUsers', 'name email role parent');

    res.json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get users assigned to site
router.get('/:id/users', authenticate, async (req, res) => {
  try {
    const site = await Site.findById(req.params.id)
      .populate('assignedUsers', 'name email role');

    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (req.user.role !== 1 && !site.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(site.assignedUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get fund summary for a site
router.get('/:id/funds', authenticate, async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    // Check access
    if (req.user.role !== 1 && !site.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all fund allocations for this site
    const allocations = await FundAllocation.find({
      site: req.params.id,
      organization: req.user.organization
    })
      .populate('fromUser', 'name email role')
      .populate('toUser', 'name email role')
      .sort({ allocationDate: -1 });

    // Calculate fund summary by status
    const totalAllocated = allocations
      .filter(a => a.status !== 'rejected')
      .reduce((sum, a) => sum + a.amount, 0);

    const totalDisbursed = allocations
      .filter(a => a.status === 'disbursed')
      .reduce((sum, a) => sum + a.amount, 0);

    const totalPending = allocations
      .filter(a => a.status === 'pending' || a.status === 'approved')
      .reduce((sum, a) => sum + a.amount, 0);

    // Get all expenses for this site
    const expenses = await Expense.find({
      site: req.params.id,
      organization: req.user.organization
    });

    const totalExpenses = expenses
      .filter(e => e.status === 'paid')
      .reduce((sum, e) => sum + e.amount, 0);

    const pendingExpenses = expenses
      .filter(e => e.status === 'pending' || e.status === 'approved')
      .reduce((sum, e) => sum + e.amount, 0);

    // Calculate remaining funds
    const remainingFunds = totalDisbursed - totalExpenses;

    res.json({
      allocations,
      summary: {
        totalAllocated,
        totalDisbursed,
        totalPending,
        totalExpenses,
        pendingExpenses,
        remainingFunds,
        utilizationPercentage: totalDisbursed > 0 ? ((totalExpenses / totalDisbursed) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
