import express from 'express';
import { User, FundAllocation, Expense, WorkerLedger, Bill } from '../models/index.js';
import { authenticate, requireRole, canManageUser } from '../middleware/auth.js';

const router = express.Router();

// Get users (hierarchical based on role)
router.get('/', authenticate, async (req, res) => {
  try {
    let users;

    if (req.user.role === 1) {
      // Developer sees all users
      users = await User.find()
        .populate('parent', 'name email')
        .sort({ role: 1, createdAt: -1 });

      // Compute wallet balance for each user via aggregation (stored field may be stale)
      const userIds = users.map(u => u._id);
      if (userIds.length > 0) {
        const toMap = (agg) => {
          const map = {};
          agg.forEach(r => { map[r._id.toString()] = r.total; });
          return map;
        };
        const [receivedAgg, sentAgg, expensesAgg, ledgerAgg, billsAgg] = await Promise.all([
          FundAllocation.aggregate([
            { $match: { toUser: { $in: userIds }, status: 'disbursed' } },
            { $group: { _id: '$toUser', total: { $sum: '$amount' } } }
          ]),
          FundAllocation.aggregate([
            { $match: { fromUser: { $in: userIds }, status: 'disbursed', $expr: { $ne: ['$fromUser', '$toUser'] } } },
            { $group: { _id: '$fromUser', total: { $sum: '$amount' } } }
          ]),
          Expense.aggregate([
            { $match: { user: { $in: userIds }, amount: { $gt: 0 } } },
            { $group: { _id: '$user', total: { $sum: '$amount' } } }
          ]),
          WorkerLedger.aggregate([
            { $match: { createdBy: { $in: userIds }, type: 'credit' } },
            { $group: { _id: '$createdBy', total: { $sum: '$amount' } } }
          ]),
          Bill.aggregate([
            { $match: { createdBy: { $in: userIds }, status: { $in: ['credited', 'paid'] } } },
            { $group: { _id: '$createdBy', total: { $sum: '$totalAmount' } } }
          ]),
        ]);
        const received = toMap(receivedAgg);
        const sent     = toMap(sentAgg);
        const expenses = toMap(expensesAgg);
        const ledger   = toMap(ledgerAgg);
        const bills    = toMap(billsAgg);
        users = users.map(u => {
          const id = u._id.toString();
          const obj = u.toObject();
          obj.walletBalance = (received[id] || 0) - (sent[id] || 0) - (expenses[id] || 0) - (ledger[id] || 0) - (bills[id] || 0);
          return obj;
        });
      }
    } else if (req.user.role === 2) {
      // Engineer sees supervisors and workers in same org (role hierarchy)
      users = await User.find({ organization: req.user.organization, role: { $in: [3, 4] } })
        .populate('parent', 'name email')
        .sort({ role: 1, createdAt: -1 });
    } else if (req.user.role === 3) {
      // Supervisor sees workers in same org (role hierarchy)
      users = await User.find({ organization: req.user.organization, role: 4 })
        .populate('parent', 'name email')
        .sort({ role: 1, createdAt: -1 });
    } else {
      // Workers see only themselves
      users = await User.find({ _id: req.user._id })
        .populate('parent', 'name email')
        .sort({ role: 1, createdAt: -1 });
    }

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create user (creates as child of current user)
router.post('/', authenticate, requireRole(1, 2, 3), async (req, res) => {
  try {
    const { email, password, name, role, dailyRate } = req.body;

    // Determine allowed role for new user based on creator's role
    let assignedRole = role;
    if (req.user.role === 3) {
      // Supervisor can only create workers (role 4)
      assignedRole = 4;
    } else if (req.user.role === 2) {
      // Engineer can create supervisors (3) or workers (4)
      if (role !== 3 && role !== 4) {
        assignedRole = 4;
      }
    } else if (req.user.role === 1) {
      // Developer can create engineers (2), supervisors (3), or workers (4)
      if (role !== 2 && role !== 3 && role !== 4) {
        assignedRole = 2;
      }
    }

    const userData = {
      email,
      password,
      name,
      role: assignedRole,
      parent: req.user._id,
      organization: req.user.organization
    };

    // Add dailyRate for supervisors and workers
    if (dailyRate !== undefined && (assignedRole === 3 || assignedRole === 4)) {
      userData.dailyRate = dailyRate;
    }

    const user = new User(userData);

    await user.save();

    res.status(201).json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Get single user
router.get('/:userId', authenticate, canManageUser, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('parent', 'name email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user
router.put('/:userId', authenticate, canManageUser, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, password, isActive, dailyRate } = req.body;

    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password = password;
    if (isActive !== undefined) user.isActive = isActive;
    // Allow setting dailyRate for supervisors and workers
    if (dailyRate !== undefined && (user.role === 3 || user.role === 4)) {
      user.dailyRate = dailyRate;
    }

    await user.save();

    res.json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete user
router.delete('/:userId', authenticate, requireRole(1, 2, 3), canManageUser, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Can't delete yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }

    // Reassign children to deleted user's parent or null
    await User.updateMany(
      { parent: user._id },
      { parent: user.parent || null }
    );

    await user.deleteOne();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get team members of current user (role-hierarchy based, includes parent manager)
router.get('/my/children', authenticate, async (req, res) => {
  try {
    const result = [];

    // Include parent manager (no wallet shown, no delete allowed on client)
    if (req.user.parent) {
      const parent = await User.findById(req.user.parent).select('name email role');
      if (parent) result.push({ ...parent.toObject(), isParent: true });
    }

    // Children by role hierarchy
    let roleFilter;
    if (req.user.role === 1) roleFilter = { $in: [2, 3, 4] };
    else if (req.user.role === 2) roleFilter = { $in: [3, 4] };
    else if (req.user.role === 3) roleFilter = 4;
    else roleFilter = null;

    if (roleFilter) {
      const children = await User.find({
        organization: req.user.organization,
        role: roleFilter
      }).sort({ role: 1, createdAt: -1 });
      children.forEach(c => result.push({ ...c.toObject(), isParent: false }));
    }

    // Compute wallet balance from FundAllocation history for all non-parent members
    // This ensures correct balance even if stored walletBalance is stale
    const memberIds = result.filter(u => !u.isParent).map(u => u._id);

    if (memberIds.length > 0) {
      const toMap = (agg) => {
        const map = {};
        agg.forEach(r => { map[r._id.toString()] = r.total; });
        return map;
      };

      // Funds received (disbursed allocations TO each member)
      const receivedAgg = await FundAllocation.aggregate([
        { $match: { toUser: { $in: memberIds }, status: 'disbursed' } },
        { $group: { _id: '$toUser', total: { $sum: '$amount' } } }
      ]);

      // Funds sent to others (sub-allocations FROM each member)
      const sentAgg = await FundAllocation.aggregate([
        { $match: { fromUser: { $in: memberIds }, status: 'disbursed', $expr: { $ne: ['$fromUser', '$toUser'] } } },
        { $group: { _id: '$fromUser', total: { $sum: '$amount' } } }
      ]);

      // Expenses by each member (amount > 0 means wallet was debited)
      const expensesAgg = await Expense.aggregate([
        { $match: { user: { $in: memberIds }, amount: { $gt: 0 } } },
        { $group: { _id: '$user', total: { $sum: '$amount' } } }
      ]);

      // Ledger credit entries by each member (wages/advances paid out)
      const ledgerAgg = await WorkerLedger.aggregate([
        { $match: { createdBy: { $in: memberIds }, type: 'credit' } },
        { $group: { _id: '$createdBy', total: { $sum: '$amount' } } }
      ]);

      // Bills credited/paid by each member
      const billsAgg = await Bill.aggregate([
        { $match: { createdBy: { $in: memberIds }, status: { $in: ['credited', 'paid'] } } },
        { $group: { _id: '$createdBy', total: { $sum: '$totalAmount' } } }
      ]);

      const received = toMap(receivedAgg);
      const sent     = toMap(sentAgg);
      const expenses = toMap(expensesAgg);
      const ledger   = toMap(ledgerAgg);
      const bills    = toMap(billsAgg);

      result.forEach(u => {
        if (!u.isParent) {
          const id = u._id.toString();
          u.walletBalance =
            (received[id] || 0) -
            (sent[id]     || 0) -
            (expenses[id] || 0) -
            (ledger[id]   || 0) -
            (bills[id]    || 0);
        }
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
