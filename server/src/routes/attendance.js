import express from 'express';
import { Attendance, User, Site, WorkerLedger } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Helper function to create pending salary entry from attendance
async function createPendingSalaryEntry(attendance, worker, markedBy) {
  try {
    // Check if worker has daily rate configured
    if (!worker.dailyRate || worker.dailyRate <= 0) {
      console.warn(`Worker ${worker._id} does not have daily rate configured. Skipping pending salary creation.`);
      return null;
    }

    // Calculate salary for this attendance
    const hourlyRate = worker.dailyRate / 8;
    let baseSalary = 0;

    if (attendance.status === 'present') {
      baseSalary = worker.dailyRate;
    } else if (attendance.status === 'half_day') {
      baseSalary = worker.dailyRate / 2;
    } else {
      // absent or leave - no salary
      baseSalary = 0;
    }

    const overtimePay = (attendance.overtime || 0) * hourlyRate;
    const totalEarnings = baseSalary + overtimePay;

    // Check if a pending salary entry already exists for this attendance
    const existingEntry = await WorkerLedger.findOne({
      linkedAttendance: attendance._id,
      category: 'pending_salary',
      status: 'pending'
    });

    if (existingEntry) {
      // Update existing entry
      if (totalEarnings <= 0) {
        // If no earnings, delete the existing entry
        await WorkerLedger.deleteOne({ _id: existingEntry._id });
        return null;
      }

      existingEntry.amount = totalEarnings;
      existingEntry.description = `Pending salary for ${attendance.date.toISOString().split('T')[0]} (${attendance.status})`;
      existingEntry.transactionDate = attendance.date;
      await existingEntry.save();
      return existingEntry;
    }

    // Don't create entry if no earnings
    if (totalEarnings <= 0) {
      return null;
    }

    // Create new pending salary entry in worker ledger
    const ledgerEntry = new WorkerLedger({
      organization: attendance.organization,
      worker: attendance.worker,
      site: attendance.site,
      createdBy: markedBy,
      type: 'credit',
      category: 'pending_salary',
      amount: totalEarnings,
      description: `Pending salary for ${attendance.date.toISOString().split('T')[0]} (${attendance.status})`,
      status: 'pending',
      linkedAttendance: attendance._id,
      periodStart: attendance.date,
      periodEnd: attendance.date,
      transactionDate: attendance.date
    });

    await ledgerEntry.save();
    return ledgerEntry;
  } catch (error) {
    console.error('Error creating pending salary entry:', error);
    return null;
  }
}

// Get attendance records
router.get('/', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { siteId, workerId, startDate, endDate, status, page = 1, limit = 50 } = req.query;

    const filter = { organization: req.user.organization };

    // Filter by role
    // Role 1 = Developer (sees all)
    // Role 2 = Engineer (sees their team)
    // Role 3 = Supervisor (sees their workers)
    // Role 4 = Worker (sees only their own)
    if (req.user.role === 4) {
      // Workers can only see their own attendance
      filter.worker = req.user._id;
    } else if (req.user.role === 2 || req.user.role === 3) {
      // Engineers and Supervisors can see attendance of their children
      const childIds = await req.user.getChildIds();
      filter.worker = { $in: [...childIds] };
    }
    // Role 1 (Developer) sees all - no filter

    if (siteId) filter.site = siteId;
    if (workerId && req.user.role !== 4) filter.worker = workerId;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(filter)
      .populate('worker', 'name email role dailyRate')
      .populate('site', 'name')
      .populate('markedBy', 'name')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Attendance.countDocuments(filter);

    res.json({
      attendance,
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

// Get attendance summary for a worker
router.get('/summary/:workerId', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { workerId } = req.params;
    const { month, year } = req.query;

    // Verify access to this worker's data
    // Role 4 (Worker) can only see their own data
    if (req.user.role === 4 && req.user._id.toString() !== workerId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Role 2 (Engineer) and Role 3 (Supervisor) can see their team's data
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

    // Build date filter
    const currentDate = new Date();
    const filterMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const filterYear = year ? parseInt(year) : currentDate.getFullYear();

    const startOfMonth = new Date(filterYear, filterMonth, 1);
    const endOfMonth = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59);

    const filter = {
      organization: req.user.organization,
      worker: workerId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    };

    // Aggregate by status
    const statusSummary = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalHours: { $sum: '$hoursWorked' },
          totalOvertime: { $sum: '$overtime' }
        }
      }
    ]);

    // Total calculations
    const totals = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          halfDays: {
            $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] }
          },
          absentDays: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          },
          leaveDays: {
            $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] }
          },
          totalHours: { $sum: '$hoursWorked' },
          totalOvertime: { $sum: '$overtime' }
        }
      }
    ]);

    // Calculate earnings
    const summary = totals[0] || {
      totalDays: 0,
      presentDays: 0,
      halfDays: 0,
      absentDays: 0,
      leaveDays: 0,
      totalHours: 0,
      totalOvertime: 0
    };

    const dailyRate = worker.dailyRate || 0;
    const standardHours = 8; // Standard work day hours
    const hourlyRate = dailyRate / standardHours;

    const effectiveDays = summary.presentDays + (summary.halfDays * 0.5);
    const baseEarnings = effectiveDays * dailyRate;
    const overtimeEarnings = summary.totalOvertime * hourlyRate;
    const estimatedEarnings = baseEarnings + overtimeEarnings;

    res.json({
      worker: {
        _id: worker._id,
        name: worker.name,
        email: worker.email,
        dailyRate: worker.dailyRate
      },
      month: filterMonth + 1,
      year: filterYear,
      summary,
      effectiveDays,
      hourlyRate,
      baseEarnings,
      overtimeEarnings,
      estimatedEarnings,
      statusSummary
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark attendance (Developer, Engineer, Supervisor)
router.post('/', authenticate, requireRole(1, 2, 3), async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { workerId, siteId, date, status, hoursWorked, overtime, notes } = req.body;

    // Verify worker
    const worker = await User.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Engineer and Supervisor can only mark attendance for their children
    if (req.user.role === 2 || req.user.role === 3) {
      const childIds = await req.user.getChildIds();
      if (!childIds.some(id => id.toString() === workerId)) {
        return res.status(403).json({ message: 'Can only mark attendance for your team members' });
      }
    }

    // Verify site
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (site.organization.toString() !== req.user.organization.toString()) {
      return res.status(403).json({ message: 'Site not in your organization' });
    }

    // Check if attendance already exists for this date
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const existing = await Attendance.findOne({
      worker: workerId,
      site: siteId,
      date: attendanceDate
    });

    if (existing) {
      return res.status(400).json({ message: 'Attendance already marked for this date' });
    }

    const attendance = new Attendance({
      organization: req.user.organization,
      worker: workerId,
      site: siteId,
      markedBy: req.user._id,
      date: attendanceDate,
      status: status || 'present',
      hoursWorked: hoursWorked || 8,
      overtime: overtime || 0,
      notes
    });

    await attendance.save();
    await attendance.populate('worker', 'name email role dailyRate');
    await attendance.populate('site', 'name');
    await attendance.populate('markedBy', 'name');

    // Auto-create pending salary entry
    const pendingSalary = await createPendingSalaryEntry(attendance, worker, req.user._id);

    res.status(201).json({
      attendance,
      pendingSalaryCreated: !!pendingSalary,
      pendingSalary: pendingSalary ? {
        amount: pendingSalary.amount,
        description: pendingSalary.description
      } : null
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Attendance already marked for this worker on this date' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Bulk mark attendance
router.post('/bulk', authenticate, requireRole(1, 2, 3), async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { siteId, date, attendanceList } = req.body;

    // Verify site
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const results = [];
    const errors = [];
    const pendingSalariesCreated = [];

    for (const item of attendanceList) {
      try {
        // Check if already exists
        const existing = await Attendance.findOne({
          worker: item.workerId,
          site: siteId,
          date: attendanceDate
        });

        if (existing) {
          // Update existing
          existing.status = item.status || existing.status;
          existing.hoursWorked = item.hoursWorked ?? existing.hoursWorked;
          existing.overtime = item.overtime ?? existing.overtime;
          existing.notes = item.notes ?? existing.notes;
          await existing.save();
          results.push(existing);
        } else {
          // Create new
          const attendance = new Attendance({
            organization: req.user.organization,
            worker: item.workerId,
            site: siteId,
            markedBy: req.user._id,
            date: attendanceDate,
            status: item.status || 'present',
            hoursWorked: item.hoursWorked || 8,
            overtime: item.overtime || 0,
            notes: item.notes
          });
          await attendance.save();

          // Get worker data for salary calculation
          const worker = await User.findById(item.workerId);
          if (worker) {
            // Auto-create pending salary entry
            const pendingSalary = await createPendingSalaryEntry(attendance, worker, req.user._id);
            if (pendingSalary) {
              pendingSalariesCreated.push({
                workerId: item.workerId,
                amount: pendingSalary.amount
              });
            }
          }

          results.push(attendance);
        }
      } catch (err) {
        errors.push({ workerId: item.workerId, error: err.message });
      }
    }

    res.json({
      success: results.length,
      failed: errors.length,
      pendingSalariesCreated: pendingSalariesCreated.length,
      pendingSalaries: pendingSalariesCreated,
      errors
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update attendance
router.put('/:id', authenticate, requireRole(1, 2, 3), async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Check organization access
    if (attendance.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { status, hoursWorked, overtime, notes } = req.body;

    if (status) attendance.status = status;
    if (hoursWorked !== undefined) attendance.hoursWorked = hoursWorked;
    if (overtime !== undefined) attendance.overtime = overtime;
    if (notes !== undefined) attendance.notes = notes;

    await attendance.save();
    await attendance.populate('worker', 'name email role dailyRate');
    await attendance.populate('site', 'name');
    await attendance.populate('markedBy', 'name');

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete attendance (Developer, Engineer, Supervisor)
router.delete('/:id', authenticate, requireRole(1, 2, 3), async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    if (attendance.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Engineers and Supervisors can only delete entries for their team members
    if (req.user.role === 2 || req.user.role === 3) {
      const childIds = await req.user.getChildIds();
      if (!childIds.some(id => id.toString() === attendance.worker.toString())) {
        return res.status(403).json({ message: 'Can only delete attendance for your team members' });
      }
    }

    // Delete linked pending salary entry first
    try {
      await WorkerLedger.deleteMany({
        linkedAttendance: attendance._id,
        category: 'pending_salary',
        status: 'pending'
      });
    } catch (salaryError) {
      console.error('Error deleting salary entry:', salaryError);
      // Continue with attendance deletion even if salary deletion fails
    }

    await attendance.deleteOne();

    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Bulk delete attendance records
router.post('/bulk-delete', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'IDs array is required and cannot be empty' });
    }

    // Verify all records belong to the user's organization
    const records = await Attendance.find({
      _id: { $in: ids },
      organization: req.user.organization
    });

    if (records.length !== ids.length) {
      return res.status(403).json({ message: 'Some records do not belong to your organization' });
    }

    // Delete linked pending salary entries first
    try {
      const salaryDeleteResult = await WorkerLedger.deleteMany({
        linkedAttendance: { $in: ids },
        category: 'pending_salary',
        status: 'pending'
      });
      console.log(`Deleted ${salaryDeleteResult.deletedCount} linked salary entries`);
    } catch (salaryError) {
      console.error('Error deleting salary entries:', salaryError);
      // Continue with attendance deletion even if salary deletion fails
    }

    // Delete the attendance records
    const deleteResult = await Attendance.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `${deleteResult.deletedCount} attendance record(s) deleted successfully`,
      deletedCount: deleteResult.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Export attendance sheet template for a month
router.get('/export-template', authenticate, async (req, res) => {
  try {
    const { year, month, siteId } = req.query;

    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month are required' });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    // Get all workers in the organization
    const workerFilter = {
      organization: req.user.organization,
      role: 4, // Workers only
      isActive: true
    };

    // If non-developer, only show workers under them
    let workers;
    if (req.user.role !== 1) {
      const childIds = await req.user.getChildIds([4]); // Only workers
      workers = await User.find({ ...workerFilter, _id: { $in: childIds } })
        .select('name email dailyRate')
        .sort({ name: 1 });
    } else {
      workers = await User.find(workerFilter)
        .select('name email dailyRate')
        .sort({ name: 1 });
    }

    if (workers.length === 0) {
      return res.status(404).json({ message: 'No workers found' });
    }

    // Get site info if provided
    let siteName = 'All Sites';
    if (siteId) {
      const site = await Site.findById(siteId);
      if (site) siteName = site.name;
    }

    // Get number of days in the month
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

    // Get existing attendance for the month
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

    const attendanceFilter = {
      organization: req.user.organization,
      date: { $gte: startDate, $lte: endDate }
    };
    if (siteId) attendanceFilter.site = siteId;

    const existingAttendance = await Attendance.find(attendanceFilter)
      .populate('worker', 'name')
      .populate('site', 'name');

    // Create attendance map for quick lookup: workerId-date -> attendance
    const attendanceMap = {};
    existingAttendance.forEach(att => {
      const key = `${att.worker._id}-${att.date.getDate()}`;
      attendanceMap[key] = att;
    });

    // Build CSV headers - simple format with just attendance
    const headers = [
      'Worker ID',
      'Worker Name',
      'Email',
      'Daily Rate',
      'Site',
      ...Array.from({ length: daysInMonth }, (_, i) => `Day ${i + 1}`)
    ];

    // Build CSV rows - one row per worker with only attendance data
    const rows = [];

    workers.forEach(worker => {
      const dailyRate = worker.dailyRate || 0;

      const workerRow = [
        worker._id.toString(),
        worker.name,
        worker.email,
        dailyRate,
        siteName
      ];

      // Add attendance data for each day
      for (let day = 1; day <= daysInMonth; day++) {
        const key = `${worker._id}-${day}`;
        const att = attendanceMap[key];

        if (att) {
          // Format: status|hoursWorked|overtime|notes
          const value = `${att.status}|${att.hoursWorked || 8}|${att.overtime || 0}|${att.notes || ''}`;
          workerRow.push(value);
        } else {
          workerRow.push('');
        }
      }

      rows.push(workerRow);
    });

    // Generate CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const str = String(cell);
        // Escape quotes and wrap in quotes if contains comma or newline
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-${yearNum}-${monthNum.toString().padStart(2, '0')}-${siteName.replace(/\s+/g, '-')}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Import filled attendance sheet
router.post('/import-sheet', authenticate, async (req, res) => {
  try {
    const { csvData, year, month, siteId } = req.body;

    if (!csvData || !year || !month) {
      return res.status(400).json({ message: 'CSV data, year, and month are required' });
    }

    if (!siteId) {
      return res.status(400).json({ message: 'Site is required for importing attendance' });
    }

    // Verify site exists and user has access
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }
    if (req.user.role !== 1 && !site.hasAccess(req.user._id)) {
      return res.status(403).json({ message: 'Access denied to this site' });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

    // Parse CSV
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({ message: 'CSV file is empty or invalid' });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    // Find day columns (Day 1, Day 2, etc.)
    const dayColumnIndices = [];
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].startsWith('Day ')) {
        dayColumnIndices.push(i);
      }
    }

    if (dayColumnIndices.length === 0) {
      return res.status(400).json({ message: 'No day columns found in CSV' });
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // Process each worker row
    for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
      const line = lines[rowIdx].trim();
      if (!line) continue;

      // Parse CSV line (handle quoted fields)
      const values = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim()); // Push last value

      const workerId = values[0];
      if (!workerId) {
        results.errors.push(`Row ${rowIdx + 1}: Missing worker ID`);
        continue;
      }

      // Verify worker exists
      const worker = await User.findById(workerId);
      if (!worker) {
        results.errors.push(`Row ${rowIdx + 1}: Worker not found (${workerId})`);
        continue;
      }

      // Process each day
      for (let dayIdx = 0; dayIdx < dayColumnIndices.length && dayIdx < daysInMonth; dayIdx++) {
        const colIdx = dayColumnIndices[dayIdx];
        const cellValue = values[colIdx] || '';

        if (!cellValue.trim()) {
          results.skipped++;
          continue; // Skip empty cells
        }

        // Parse format: status|hoursWorked|overtime|notes
        const parts = cellValue.split('|').map(p => p.trim());
        const status = parts[0] || 'present';
        const hoursWorked = parseFloat(parts[1]) || 8;
        const overtime = parseFloat(parts[2]) || 0;
        const notes = parts[3] || '';

        // Validate status
        if (!['present', 'absent', 'half_day', 'leave'].includes(status)) {
          results.errors.push(`Row ${rowIdx + 1}, Day ${dayIdx + 1}: Invalid status "${status}"`);
          continue;
        }

        // Create date for this day
        const date = new Date(yearNum, monthNum - 1, dayIdx + 1);

        try {
          // Check if attendance already exists
          const existing = await Attendance.findOne({
            worker: workerId,
            site: siteId,
            date: {
              $gte: new Date(date.setHours(0, 0, 0, 0)),
              $lte: new Date(date.setHours(23, 59, 59, 999))
            }
          });

          if (existing) {
            // Update existing
            existing.status = status;
            existing.hoursWorked = hoursWorked;
            existing.overtime = overtime;
            existing.notes = notes;
            existing.markedBy = req.user._id;
            await existing.save();

            // Create or update pending salary
            await createPendingSalaryEntry(existing, worker, req.user._id);
            results.updated++;
          } else {
            // Create new attendance
            const attendance = new Attendance({
              organization: req.user.organization,
              worker: workerId,
              site: siteId,
              markedBy: req.user._id,
              date,
              status,
              hoursWorked,
              overtime,
              notes
            });
            await attendance.save();

            // Create pending salary
            await createPendingSalaryEntry(attendance, worker, req.user._id);
            results.created++;
          }
        } catch (error) {
          results.errors.push(`Row ${rowIdx + 1}, Day ${dayIdx + 1}: ${error.message}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Import completed. Created: ${results.created}, Updated: ${results.updated}, Skipped: ${results.skipped}`,
      results
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
