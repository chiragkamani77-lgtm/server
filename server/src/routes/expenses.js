import express from 'express';
import { Expense, Site } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

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
    case 2: // Supervisor - sees own + children's expenses
      const childIds = await user.getChildIds();
      filter.user = { $in: [user._id, ...childIds] };
      break;
    case 3: // Worker - sees only own expenses
      filter.user = user._id;
      break;
  }

  return filter;
};

// Get expenses (filtered by visibility)
router.get('/', authenticate, async (req, res) => {
  try {
    const { siteId, category, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = await getVisibilityFilter(req.user, siteId);

    // Apply additional filters
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    // If not level 1, also filter by assigned sites
    if (req.user.role !== 1 && !siteId) {
      const sites = await Site.find({ assignedUsers: req.user._id }).select('_id');
      filter.site = { $in: sites.map(s => s._id) };
    }

    const expenses = await Expense.find(filter)
      .populate('site', 'name')
      .populate('category', 'name')
      .populate('user', 'name email')
      .sort({ expenseDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Expense.countDocuments(filter);

    res.json({
      expenses,
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

    // Aggregate by category
    const categoryBreakdown = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'expensecategories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $project: {
          category: { $arrayElemAt: ['$categoryInfo.name', 0] },
          total: 1,
          count: 1
        }
      }
    ]);

    // Total expenses
    const totalExpenses = categoryBreakdown.reduce((sum, cat) => sum + cat.total, 0);

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
      totalEntries: categoryBreakdown.reduce((sum, cat) => sum + cat.count, 0),
      categoryBreakdown,
      monthlyBreakdown
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create expense
router.post('/', authenticate, async (req, res) => {
  try {
    const { siteId, categoryId, amount, description, vendorName, expenseDate, fundAllocationId } = req.body;

    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    // Check site access
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (req.user.role !== 1 && !site.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied to this site' });
    }

    const expense = new Expense({
      organization: req.user.organization,
      site: siteId,
      category: categoryId,
      user: req.user._id,
      fundAllocation: fundAllocationId || null,
      amount,
      description,
      vendorName,
      expenseDate: expenseDate || new Date()
    });

    await expense.save();
    await expense.populate('site', 'name');
    await expense.populate('category', 'name');
    await expense.populate('user', 'name email');
    if (fundAllocationId) await expense.populate('fundAllocation');

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single expense
router.get('/:id', authenticate, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('site', 'name')
      .populate('category', 'name')
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

    // Check if user can manage this expense
    const canManage = await canManageExpense(req.user, expense);
    if (!canManage) {
      return res.status(403).json({ message: 'Can only edit your own or subordinates\' expenses' });
    }

    const { categoryId, amount, description, vendorName, expenseDate } = req.body;

    if (categoryId) expense.category = categoryId;
    if (amount !== undefined) expense.amount = amount;
    if (description !== undefined) expense.description = description;
    if (vendorName !== undefined) expense.vendorName = vendorName;
    if (expenseDate) expense.expenseDate = expenseDate;

    await expense.save();
    await expense.populate('site', 'name');
    await expense.populate('category', 'name');
    await expense.populate('user', 'name email');

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete expense
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user can manage this expense
    const canManage = await canManageExpense(req.user, expense);
    if (!canManage) {
      return res.status(403).json({ message: 'Can only delete your own or subordinates\' expenses' });
    }

    await expense.deleteOne();

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

export default router;
