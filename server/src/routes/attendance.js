import express from 'express';
import { Attendance, User, Site } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get attendance records
router.get('/', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(400).json({ message: 'No organization assigned' });
    }

    const { siteId, workerId, startDate, endDate, status, page = 1, limit = 50 } = req.query;

    const filter = { organization: req.user.organization };

    // Filter by role
    if (req.user.role === 3) {
      // Workers can only see their own attendance
      filter.worker = req.user._id;
    } else if (req.user.role === 2) {
      // Supervisors can see attendance of their children
      const childIds = await req.user.getChildIds();
      filter.worker = { $in: [req.user._id, ...childIds] };
    }

    if (siteId) filter.site = siteId;
    if (workerId && req.user.role !== 3) filter.worker = workerId;
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
    if (req.user.role === 3 && req.user._id.toString() !== workerId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 2) {
      const childIds = await req.user.getChildIds();
      if (!childIds.some(id => id.toString() === workerId) && req.user._id.toString() !== workerId) {
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

    const effectiveDays = summary.presentDays + (summary.halfDays * 0.5);
    const estimatedEarnings = effectiveDays * (worker.dailyRate || 0);

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
      estimatedEarnings,
      statusSummary
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark attendance (Level 2 only - supervisors)
router.post('/', authenticate, requireRole(1, 2), async (req, res) => {
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

    // Level 2 can only mark attendance for their children
    if (req.user.role === 2) {
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

    res.status(201).json(attendance);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Attendance already marked for this worker on this date' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Bulk mark attendance
router.post('/bulk', authenticate, requireRole(1, 2), async (req, res) => {
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
          results.push(attendance);
        }
      } catch (err) {
        errors.push({ workerId: item.workerId, error: err.message });
      }
    }

    res.json({
      success: results.length,
      failed: errors.length,
      errors
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update attendance
router.put('/:id', authenticate, requireRole(1, 2), async (req, res) => {
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

// Delete attendance (Level 1 only)
router.delete('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    if (attendance.organization.toString() !== req.user.organization?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await attendance.deleteOne();

    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
