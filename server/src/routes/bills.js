import express from 'express';
import { Bill, Site, Investment, FundAllocation } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import mongoose from 'mongoose';
import { validateFundAvailability } from './funds.js';

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
      billType,
      fundAllocationId,
      linkedInvestment,
      paymentMethod,
      paymentReference,
      gstRate
    } = req.body;

    // Either fund allocation or investment is required
    if (!fundAllocationId && !linkedInvestment) {
      return res.status(400).json({
        message: 'Either fund allocation or investment is required for all bills.'
      });
    }

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

    // Validate fund allocation if provided
    if (fundAllocationId) {
      const fundAllocation = await FundAllocation.findById(fundAllocationId);
      if (!fundAllocation) {
        return res.status(404).json({ message: 'Fund allocation not found' });
      }

      if (fundAllocation.status !== 'disbursed') {
        return res.status(400).json({
          message: `Fund allocation must be disbursed before use (current status: ${fundAllocation.status})`
        });
      }

      // Validate sufficient funds available
      const fundCheck = await validateFundAvailability(fundAllocationId, totalAmount);
      if (!fundCheck.available) {
        return res.status(400).json({
          message: fundCheck.message,
          available: fundCheck.balance,
          requested: totalAmount
        });
      }
    }

    // Validate investment if provided
    if (linkedInvestment) {
      const investment = await Investment.findById(linkedInvestment);
      if (!investment) {
        return res.status(404).json({ message: 'Investment not found' });
      }
      if (investment.organization.toString() !== req.user.organization.toString()) {
        return res.status(403).json({ message: 'Investment not in your organization' });
      }
    }

    const bill = new Bill({
      organization: req.user.organization,
      site: siteId || null,
      createdBy: req.user._id,
      fundAllocation: fundAllocationId || null,
      linkedInvestment: linkedInvestment || null,
      vendorName,
      vendorGstNumber,
      invoiceNumber,
      billDate: billDate || new Date(),
      baseAmount,
      gstAmount: gstAmount || 0,
      totalAmount,
      description,
      billType,
      paymentMethod,
      paymentReference,
      gstRate: gstRate || 18
    });

    await bill.save();
    await bill.populate('site', 'name');
    await bill.populate('createdBy', 'name email');
    await bill.populate('fundAllocation');

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
      billType,
      linkedInvestment,
      paymentMethod,
      paymentReference,
      gstRate
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
    if (linkedInvestment !== undefined) bill.linkedInvestment = linkedInvestment || null;
    if (paymentMethod !== undefined) bill.paymentMethod = paymentMethod;
    if (paymentReference !== undefined) bill.paymentReference = paymentReference;
    if (gstRate !== undefined) bill.gstRate = gstRate;

    await bill.save();
    await bill.populate('site', 'name');
    await bill.populate('createdBy', 'name email');

    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve/Pay/Reject bill
router.put('/:id/approve', authenticate, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Only developers can approve
    if (req.user.role !== 1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Only developers can approve bills' });
    }

    const bill = await Bill.findById(req.params.id).session(session);

    if (!bill) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check organization access
    if (bill.organization.toString() !== req.user.organization?.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Access denied' });
    }

    const { status, approvedAmount, approvalNotes, paymentMethod, paymentReference } = req.body;

    if (!['approved', 'paid', 'rejected'].includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Invalid status' });
    }

    const oldStatus = bill.status;
    bill.status = status;

    if (status === 'approved' || status === 'paid') {
      if (approvedAmount === undefined || approvedAmount === null) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Approved amount is required' });
      }
      bill.approvedAmount = approvedAmount;
      bill.totalAmount = approvedAmount; // Set actual amount
      bill.approvedBy = req.user._id;
      bill.approvalDate = new Date();
    }

    if (status === 'paid') {
      bill.paidDate = new Date();
      if (paymentMethod) bill.paymentMethod = paymentMethod;
      if (paymentReference) bill.paymentReference = paymentReference;
    }

    if (approvalNotes !== undefined) bill.approvalNotes = approvalNotes;

    await bill.save({ session });
    await session.commitTransaction();
    session.endSession();

    await bill.populate('site', 'name');
    await bill.populate('createdBy', 'name email');
    await bill.populate('approvedBy', 'name');
    await bill.populate('fundAllocation');
    // await bill.populate('linkedInvestment');

    res.json(bill);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
});

// Update bill status (credit/pay)
router.put('/:id/status', authenticate, requireRole(1), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status } = req.body;

    if (!['pending', 'credited', 'paid', 'rejected'].includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Invalid status' });
    }

    const bill = await Bill.findById(req.params.id).session(session);

    if (!bill) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check organization access
    if (bill.organization.toString() !== req.user.organization?.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Access denied' });
    }

    const oldStatus = bill.status;
    bill.status = status;

    if (status === 'credited') {
      bill.creditedDate = new Date();

      // Auto-create investment when bill is credited (if not already created)
      if (oldStatus !== 'credited' && !bill.linkedInvestment) {
        try {
          const investment = await Investment.create([{
            organization: bill.organization,
            partner: bill.createdBy, // Bill creator or could use organization owner
            amount: bill.totalAmount,
            description: `Auto-generated from GST bill #${bill.invoiceNumber || 'N/A'} - ${bill.vendorName}`,
            investmentDate: bill.creditedDate,
            referenceNumber: bill.invoiceNumber,
            paymentMode: 'bank_transfer',
            sourceType: 'bill',
            sourceBill: bill._id,
            autoGenerated: true
          }], { session });

          bill.linkedInvestment = investment[0]._id;
        } catch (investmentError) {
          // Log error but don't fail the bill status change
          console.error('Failed to create auto-investment:', investmentError);
        }
      }
    } else if (status === 'paid') {
      bill.paidDate = new Date();
    }

    await bill.save({ session });
    await session.commitTransaction();
    session.endSession();

    await bill.populate('site', 'name');
    await bill.populate('createdBy', 'name email');
    await bill.populate('linkedInvestment');

    res.json(bill);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
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

// Export bills to CSV
router.get('/export/csv', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { siteId, status, billType, startDate, endDate } = req.query;

    const filter = { organization: req.user.organization };

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
      .populate('createdBy', 'name')
      .sort({ billDate: -1 });

    // Generate CSV
    const headers = ['Date', 'Vendor', 'GST Number', 'Invoice', 'Site', 'Type', 'Base Amount', 'GST Rate', 'GST Amount', 'Total', 'Status', 'Payment Method', 'Payment Ref', 'Created By'];
    const rows = bills.map(bill => [
      new Date(bill.billDate).toLocaleDateString('en-IN'),
      bill.vendorName,
      bill.vendorGstNumber || '',
      bill.invoiceNumber || '',
      bill.site?.name || '',
      bill.billType,
      bill.baseAmount,
      bill.gstRate || 18,
      bill.gstAmount,
      bill.totalAmount,
      bill.status,
      bill.paymentMethod || '',
      bill.paymentReference || '',
      bill.createdBy?.name || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bills-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get vendor suggestions (for autocomplete)
router.get('/vendors/suggestions', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const vendors = await Bill.aggregate([
      { $match: { organization: req.user.organization } },
      {
        $group: {
          _id: '$vendorName',
          gstNumber: { $first: '$vendorGstNumber' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 50 }
    ]);

    res.json(vendors.map(v => ({
      name: v._id,
      gstNumber: v.gstNumber || '',
      billCount: v.count
    })));
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
