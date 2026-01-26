import express from 'express';
import { Bill, Site } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Get all bills for organization
router.get('/', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { siteId, status, billType, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = { organization: req.user.organization };

    // Non-developers can only see bills for their assigned sites
    if (req.user.role !== 1) {
      const sites = await Site.find({ assignedUsers: req.user._id }).select('_id');
      filter.site = { $in: sites.map(s => s._id) };
    }

    if (siteId) filter.site = siteId;
    if (status) filter.status = status;
    if (billType) filter.billType = billType;
    if (startDate || endDate) {
      filter.billDate = {};
      if (startDate) filter.billDate.$gte = new Date(startDate);
      if (endDate) filter.billDate.$lte = new Date(endDate);
    }

    const bills = await Bill.find(filter)
      .populate('site', 'name')
      .populate('createdBy', 'name email')
      .sort({ billDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Bill.countDocuments(filter);

    res.json({
      bills,
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

// Get bills summary
router.get('/summary', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const filter = { organization: req.user.organization };

    // By status
    const statusSummary = await Bill.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$totalAmount' },
          totalGst: { $sum: '$gstAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // By type
    const typeSummary = await Bill.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$billType',
          totalAmount: { $sum: '$totalAmount' },
          totalGst: { $sum: '$gstAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Totals
    const totals = await Bill.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBaseAmount: { $sum: '$baseAmount' },
          totalGstAmount: { $sum: '$gstAmount' },
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      statusSummary,
      typeSummary,
      totals: totals[0] || { totalBaseAmount: 0, totalGstAmount: 0, totalAmount: 0, count: 0 }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create bill
router.post('/', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const {
      siteId,
      vendorName,
      vendorGstNumber,
      invoiceNumber,
      billDate,
      baseAmount,
      gstAmount,
      description,
      billType
    } = req.body;

    // Verify site access
    if (siteId) {
      const site = await Site.findById(siteId);
      if (!site) {
        return res.status(404).json({ message: 'Site not found' });
      }
      if (req.user.role !== 1 && !site.hasAccess(req.user._id)) {
        return res.status(403).json({ message: 'Access denied to this site' });
      }
    }

    const totalAmount = parseFloat(baseAmount) + parseFloat(gstAmount || 0);

    const bill = new Bill({
      organization: req.user.organization,
      site: siteId || null,
      createdBy: req.user._id,
      vendorName,
      vendorGstNumber,
      invoiceNumber,
      billDate: billDate || new Date(),
      baseAmount,
      gstAmount: gstAmount || 0,
      totalAmount,
      description,
      billType
    });

    await bill.save();
    await bill.populate('site', 'name');
    await bill.populate('createdBy', 'name email');

    res.status(201).json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single bill
router.get('/:id', authenticate, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('site', 'name')
      .populate('createdBy', 'name email');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check organization access
    if (bill.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update bill
router.put('/:id', authenticate, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check organization access
    if (bill.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only creator or Level 1 can edit
    if (req.user.role !== 1 && bill.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Can only edit your own bills' });
    }

    const {
      vendorName,
      vendorGstNumber,
      invoiceNumber,
      billDate,
      baseAmount,
      gstAmount,
      description,
      billType
    } = req.body;

    if (vendorName) bill.vendorName = vendorName;
    if (vendorGstNumber !== undefined) bill.vendorGstNumber = vendorGstNumber;
    if (invoiceNumber !== undefined) bill.invoiceNumber = invoiceNumber;
    if (billDate) bill.billDate = billDate;
    if (baseAmount !== undefined) {
      bill.baseAmount = baseAmount;
      bill.totalAmount = parseFloat(baseAmount) + parseFloat(bill.gstAmount);
    }
    if (gstAmount !== undefined) {
      bill.gstAmount = gstAmount;
      bill.totalAmount = parseFloat(bill.baseAmount) + parseFloat(gstAmount);
    }
    if (description !== undefined) bill.description = description;
    if (billType) bill.billType = billType;

    await bill.save();
    await bill.populate('site', 'name');
    await bill.populate('createdBy', 'name email');

    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update bill status (credit/pay)
router.put('/:id/status', authenticate, requireRole(1), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'credited', 'paid', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check organization access
    if (bill.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    bill.status = status;
    if (status === 'credited') {
      bill.creditedDate = new Date();
    } else if (status === 'paid') {
      bill.paidDate = new Date();
    }

    await bill.save();
    await bill.populate('site', 'name');
    await bill.populate('createdBy', 'name email');

    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload bill receipt
router.post('/:id/receipt', authenticate, upload.single('receipt'), async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check organization access
    if (bill.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    bill.receiptPath = `/uploads/${req.file.filename}`;
    await bill.save();

    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete bill (Level 1 only)
router.delete('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check organization access
    if (bill.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await bill.deleteOne();

    res.json({ message: 'Bill deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
