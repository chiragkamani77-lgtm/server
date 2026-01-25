import express from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Expense, Site, ExpenseCategory } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Helper to build visibility filter
const getVisibilityFilter = async (user, siteId) => {
  const filter = { site: siteId };

  switch (user.role) {
    case 1:
      break;
    case 2:
      const childIds = await user.getChildIds();
      filter.user = { $in: [user._id, ...childIds] };
      break;
    case 3:
      filter.user = user._id;
      break;
  }

  return filter;
};

// Get site report data
router.get('/site/:siteId', authenticate, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { startDate, endDate } = req.query;

    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (req.user.role !== 1 && !site.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filter = await getVisibilityFilter(req.user, siteId);
    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(filter)
      .populate('category', 'name')
      .populate('user', 'name')
      .sort({ expenseDate: -1 });

    const categoryTotals = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' }
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
          total: 1
        }
      }
    ]);

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      site: {
        id: site._id,
        name: site.name,
        address: site.address
      },
      dateRange: { startDate, endDate },
      totalAmount,
      totalEntries: expenses.length,
      categoryTotals,
      expenses
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Download PDF report
router.get('/site/:siteId/pdf', authenticate, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { startDate, endDate } = req.query;

    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (req.user.role !== 1 && !site.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filter = await getVisibilityFilter(req.user, siteId);
    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(filter)
      .populate('category', 'name')
      .populate('user', 'name')
      .sort({ expenseDate: -1 });

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${site.name}-report.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Expense Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Site: ${site.name}`);
    if (site.address) doc.text(`Address: ${site.address}`);
    if (startDate || endDate) {
      doc.text(`Period: ${startDate || 'Start'} to ${endDate || 'Present'}`);
    }
    doc.text(`Generated: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Summary
    doc.fontSize(12).text(`Total Expenses: Rs. ${totalAmount.toLocaleString()}`, { bold: true });
    doc.text(`Total Entries: ${expenses.length}`);
    doc.moveDown();

    // Table header
    doc.fontSize(10);
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 150;
    const col3 = 280;
    const col4 = 380;
    const col5 = 480;

    doc.text('Date', col1, tableTop);
    doc.text('Category', col2, tableTop);
    doc.text('Description', col3, tableTop);
    doc.text('Vendor', col4, tableTop);
    doc.text('Amount', col5, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 25;

    // Table rows
    for (const expense of expenses) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(new Date(expense.expenseDate).toLocaleDateString(), col1, y);
      doc.text(expense.category?.name || '-', col2, y);
      doc.text((expense.description || '-').substring(0, 20), col3, y);
      doc.text((expense.vendorName || '-').substring(0, 15), col4, y);
      doc.text(`Rs. ${expense.amount.toLocaleString()}`, col5, y);

      y += 20;
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Download Excel report
router.get('/site/:siteId/excel', authenticate, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { startDate, endDate } = req.query;

    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (req.user.role !== 1 && !site.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filter = await getVisibilityFilter(req.user, siteId);
    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(filter)
      .populate('category', 'name')
      .populate('user', 'name')
      .sort({ expenseDate: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expenses');

    // Header row
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Added By', key: 'user', width: 20 }
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Data rows
    expenses.forEach(expense => {
      worksheet.addRow({
        date: new Date(expense.expenseDate).toLocaleDateString(),
        category: expense.category?.name || '-',
        description: expense.description || '-',
        vendor: expense.vendorName || '-',
        amount: expense.amount,
        user: expense.user?.name || '-'
      });
    });

    // Total row
    const totalRow = worksheet.addRow({
      date: '',
      category: '',
      description: '',
      vendor: 'TOTAL',
      amount: expenses.reduce((sum, e) => sum + e.amount, 0),
      user: ''
    });
    totalRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${site.name}-report.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Overall summary (Level 1 only)
router.get('/summary', authenticate, requireRole(1), async (req, res) => {
  try {
    // Site-wise totals
    const siteTotals = await Expense.aggregate([
      {
        $group: {
          _id: '$site',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'sites',
          localField: '_id',
          foreignField: '_id',
          as: 'siteInfo'
        }
      },
      {
        $project: {
          site: { $arrayElemAt: ['$siteInfo', 0] },
          total: 1,
          count: 1
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Category-wise totals
    const categoryTotals = await Expense.aggregate([
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' }
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
          total: 1
        }
      }
    ]);

    // Monthly trend
    const monthlyTrend = await Expense.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$expenseDate' },
            month: { $month: '$expenseDate' }
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    const grandTotal = siteTotals.reduce((sum, s) => sum + s.total, 0);

    res.json({
      grandTotal,
      siteTotals,
      categoryTotals,
      monthlyTrend
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
