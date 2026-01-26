import express from 'express';
import { Contract, User, Site, WorkerLedger, Attendance, FundAllocation } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all contracts
router.get('/', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { workerId, siteId, status, contractType, page = 1, limit = 50 } = req.query;

    const filter = { organization: req.user.organization };

    // Role-based filtering
    if (req.user.role === 3) {
      // Workers can only see their own contracts
      filter.worker = req.user._id;
    } else if (req.user.role === 2) {
      // Supervisors can see contracts of their team
      const childIds = await req.user.getChildIds();
      filter.worker = { $in: childIds };
    }

    if (workerId && req.user.role !== 3) filter.worker = workerId;
    if (siteId) filter.site = siteId;
    if (status) filter.status = status;
    if (contractType) filter.contractType = contractType;

    const contracts = await Contract.find(filter)
      .populate('worker', 'name email role')
      .populate('site', 'name')
      .populate('createdBy', 'name')
      .populate('fundAllocation', 'amount purpose status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Contract.countDocuments(filter);

    res.json({
      contracts,
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

// Get contract summary
router.get('/summary', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const filter = { organization: req.user.organization };

    if (req.user.role === 3) {
      filter.worker = req.user._id;
    } else if (req.user.role === 2) {
      const childIds = await req.user.getChildIds();
      filter.worker = { $in: childIds };
    }

    // Aggregate by status
    const statusSummary = await Contract.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$totalPaid' }
        }
      }
    ]);

    // Overall totals
    const overallSummary = await Contract.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalContracts: { $sum: 1 },
          totalContractValue: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$totalPaid' },
          totalRemaining: { $sum: '$remainingAmount' }
        }
      }
    ]);

    // By contract type
    const typeSummary = await Contract.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$contractType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$totalPaid' }
        }
      }
    ]);

    res.json({
      overall: overallSummary[0] || {
        totalContracts: 0,
        totalContractValue: 0,
        totalPaid: 0,
        totalRemaining: 0
      },
      byStatus: statusSummary,
      byType: typeSummary
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single contract
router.get('/:id', authenticate, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('worker', 'name email role dailyRate')
      .populate('site', 'name')
      .populate('createdBy', 'name')
      .populate('fundAllocation', 'amount purpose status fromUser')
      .populate('installments.ledgerEntry');

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    if (contract.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Workers can only see their own contracts
    if (req.user.role === 3 && contract.worker._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(contract);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create contract (Level 1 and 2)
router.post('/', authenticate, requireRole(1, 2), async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const {
      workerId,
      siteId,
      fundAllocationId,
      contractType,
      title,
      description,
      totalAmount,
      numberOfInstallments,
      startDate,
      endDate,
      dailyRate,
      workDescription,
      deliverables,
      terms
    } = req.body;

    // Verify worker
    const worker = await User.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Level 2 can only create contracts for their team
    if (req.user.role === 2) {
      const childIds = await req.user.getChildIds();
      if (!childIds.some(id => id.toString() === workerId)) {
        return res.status(403).json({ message: 'Can only create contracts for your team members' });
      }
    }

    // Verify site
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    // Verify fund allocation if provided
    if (fundAllocationId) {
      const fundAllocation = await FundAllocation.findById(fundAllocationId);
      if (!fundAllocation) {
        return res.status(404).json({ message: 'Fund allocation not found' });
      }
    }

    const contract = new Contract({
      organization: req.user.organization,
      worker: workerId,
      site: siteId,
      createdBy: req.user._id,
      fundAllocation: fundAllocationId || null,
      contractType,
      title,
      description,
      totalAmount,
      numberOfInstallments: numberOfInstallments || 1,
      startDate,
      endDate,
      dailyRate,
      workDescription,
      deliverables: deliverables || [],
      terms
    });

    // Generate installments
    contract.generateInstallments();

    await contract.save();
    await contract.populate('worker', 'name email role');
    await contract.populate('site', 'name');
    await contract.populate('createdBy', 'name');
    if (fundAllocationId) await contract.populate('fundAllocation', 'amount purpose status');

    res.status(201).json(contract);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update contract
router.put('/:id', authenticate, requireRole(1, 2), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    if (contract.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only creator or Level 1 can edit
    if (req.user.role !== 1 && contract.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Can only edit your own contracts' });
    }

    // Don't allow editing completed contracts
    if (contract.status === 'completed') {
      return res.status(400).json({ message: 'Cannot edit completed contracts' });
    }

    const {
      title,
      description,
      totalAmount,
      numberOfInstallments,
      startDate,
      endDate,
      dailyRate,
      workDescription,
      deliverables,
      terms,
      status
    } = req.body;

    if (title) contract.title = title;
    if (description !== undefined) contract.description = description;
    if (startDate) contract.startDate = startDate;
    if (endDate) contract.endDate = endDate;
    if (dailyRate !== undefined) contract.dailyRate = dailyRate;
    if (workDescription !== undefined) contract.workDescription = workDescription;
    if (deliverables) contract.deliverables = deliverables;
    if (terms !== undefined) contract.terms = terms;
    if (status) contract.status = status;

    // Regenerate installments if amount or count changed (only if no payments made)
    if ((totalAmount || numberOfInstallments) && contract.totalPaid === 0) {
      if (totalAmount) contract.totalAmount = totalAmount;
      if (numberOfInstallments) contract.numberOfInstallments = numberOfInstallments;
      contract.generateInstallments();
    }

    await contract.save();
    await contract.populate('worker', 'name email role');
    await contract.populate('site', 'name');
    await contract.populate('createdBy', 'name');
    if (contract.fundAllocation) await contract.populate('fundAllocation', 'amount purpose status');

    res.json(contract);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Record payment for an installment
router.post('/:id/payment', authenticate, requireRole(1, 2), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    if (contract.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (contract.status !== 'active') {
      return res.status(400).json({ message: 'Contract must be active to record payments' });
    }

    const { installmentNumber, amount, paymentMode, referenceNumber, notes, fundAllocationId } = req.body;

    if (!installmentNumber || !amount) {
      return res.status(400).json({ message: 'Installment number and amount are required' });
    }

    const installment = contract.installments.find(i => i.installmentNumber === installmentNumber);
    if (!installment) {
      return res.status(404).json({ message: 'Installment not found' });
    }

    // Create ledger entry for the payment
    const ledgerEntry = new WorkerLedger({
      organization: req.user.organization,
      worker: contract.worker,
      site: contract.site,
      createdBy: req.user._id,
      fundAllocation: fundAllocationId || contract.fundAllocation || null,
      contract: contract._id,
      type: 'debit',
      amount,
      category: 'contract_payment',
      description: `Contract payment - ${contract.title} - Installment ${installmentNumber}`,
      transactionDate: new Date(),
      referenceNumber,
      paymentMode: paymentMode || 'cash'
    });

    await ledgerEntry.save();

    // Record payment in contract
    contract.recordPayment(installmentNumber, amount, ledgerEntry._id);
    installment.notes = notes;

    await contract.save();
    await contract.populate('worker', 'name email role');
    await contract.populate('site', 'name');
    await contract.populate('createdBy', 'name');
    await contract.populate('installments.ledgerEntry');

    res.json({
      contract,
      ledgerEntry
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Activate contract
router.put('/:id/activate', authenticate, requireRole(1, 2), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    if (contract.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (contract.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft contracts can be activated' });
    }

    contract.status = 'active';
    await contract.save();

    await contract.populate('worker', 'name email role');
    await contract.populate('site', 'name');

    res.json(contract);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Calculate salary from attendance for daily rate contracts
router.get('/:id/attendance-salary', authenticate, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('worker', 'name email role dailyRate');

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    if (contract.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (contract.contractType !== 'daily') {
      return res.status(400).json({ message: 'Attendance salary only for daily rate contracts' });
    }

    const { startDate, endDate } = req.query;

    const filter = {
      organization: req.user.organization,
      worker: contract.worker._id,
      site: contract.site
    };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    } else {
      // Default to contract duration
      filter.date = {
        $gte: contract.startDate,
        $lte: contract.endDate || new Date()
      };
    }

    const attendance = await Attendance.find(filter).sort({ date: 1 });

    // Calculate effective days
    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let overtimeHours = 0;

    attendance.forEach(record => {
      switch (record.status) {
        case 'present':
          presentDays++;
          break;
        case 'half_day':
          halfDays++;
          break;
        case 'absent':
          absentDays++;
          break;
        case 'leave':
          leaveDays++;
          break;
      }
      overtimeHours += record.overtime || 0;
    });

    const effectiveDays = presentDays + (halfDays * 0.5);
    const dailyRate = contract.dailyRate || contract.worker.dailyRate || 0;
    const calculatedSalary = effectiveDays * dailyRate;
    const overtimePay = overtimeHours * (dailyRate / 8); // Assuming 8-hour workday

    res.json({
      contract: {
        _id: contract._id,
        title: contract.title,
        contractType: contract.contractType,
        dailyRate
      },
      worker: contract.worker,
      attendance: {
        totalRecords: attendance.length,
        presentDays,
        halfDays,
        absentDays,
        leaveDays,
        effectiveDays,
        overtimeHours
      },
      salary: {
        baseSalary: calculatedSalary,
        overtimePay,
        totalEarned: calculatedSalary + overtimePay
      },
      dateRange: {
        startDate: filter.date.$gte,
        endDate: filter.date.$lte
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete contract (Level 1 only)
router.delete('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    if (contract.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Don't allow deleting contracts with payments
    if (contract.totalPaid > 0) {
      return res.status(400).json({ message: 'Cannot delete contracts with recorded payments' });
    }

    await contract.deleteOne();

    res.json({ message: 'Contract deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
