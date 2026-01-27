import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  User,
  Site,
  ExpenseCategory,
  Expense,
  Organization,
  Investment,
  FundAllocation,
  WorkerLedger,
  Attendance,
  Bill,
  Contract
} from '../models/index.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // ==========================================
    // STEP 1: CLEAR ALL EXISTING DATA
    // ==========================================
    console.log('\n--- Cleaning Database ---');
    await Promise.all([
      User.deleteMany({}),
      Site.deleteMany({}),
      ExpenseCategory.deleteMany({}),
      Expense.deleteMany({}),
      Organization.deleteMany({}),
      Investment.deleteMany({}),
      FundAllocation.deleteMany({}),
      WorkerLedger.deleteMany({}),
      Attendance.deleteMany({}),
      Bill.deleteMany({}),
      Contract.deleteMany({})
    ]);
    console.log('All collections cleared!');

    // ==========================================
    // STEP 2: CREATE ORGANIZATION
    // ==========================================
    console.log('\n--- Creating Organization ---');
    const organization = await Organization.create({
      name: 'BuildRight Construction Pvt. Ltd.',
      description: 'Construction company',
      address: '123 Business Park, Mumbai',
      phone: '+91 9876543210',
      email: 'info@buildright.com',
      gstNumber: '27AABCU9603R1ZM',
      isActive: true
    });
    console.log(`  Organization: ${organization.name}`);

    // ==========================================
    // STEP 3: CREATE EXPENSE CATEGORIES
    // ==========================================
    console.log('\n--- Creating Expense Categories ---');
    const categories = await ExpenseCategory.insertMany([
      { name: 'Material', description: 'Construction materials' },
      { name: 'Labor', description: 'Worker wages' },
      { name: 'Transport', description: 'Transportation costs' },
      { name: 'Equipment Rental', description: 'Machinery rental' },
      { name: 'Utilities', description: 'Electricity, water' },
      { name: 'Miscellaneous', description: 'Other expenses' }
    ]);
    console.log(`  Created ${categories.length} categories`);

    // ==========================================
    // STEP 4: CREATE USER HIERARCHY (1 user per level)
    // ==========================================
    console.log('\n--- Creating Users (4-Level Hierarchy) ---');

    // Level 1: Developer
    const developer = await User.create({
      email: 'developer@buildright.com',
      password: 'dev123',
      name: 'Rajesh Kumar',
      role: 1,
      organization: organization._id,
      dailyRate: 0,
      isActive: true
    });
    console.log(`  Developer: ${developer.email} / dev123`);

    // Level 2: Engineer
    const engineer = await User.create({
      email: 'engineer@buildright.com',
      password: 'eng123',
      name: 'Amit Sharma',
      role: 2,
      parent: developer._id,
      organization: organization._id,
      dailyRate: 2000,
      isActive: true
    });
    console.log(`  Engineer: ${engineer.email} / eng123`);

    // Level 3: Supervisor
    const supervisor = await User.create({
      email: 'supervisor@buildright.com',
      password: 'super123',
      name: 'Ravi Verma',
      role: 3,
      parent: engineer._id,
      organization: organization._id,
      dailyRate: 1500,
      isActive: true
    });
    console.log(`  Supervisor: ${supervisor.email} / super123`);

    // Level 4: Worker (Daily rate set by Supervisor)
    const worker = await User.create({
      email: 'worker@buildright.com',
      password: 'worker123',
      name: 'Suresh Kumar',
      role: 4,
      parent: supervisor._id,
      organization: organization._id,
      dailyRate: 0,  // Set by Supervisor when managing worker
      isActive: true
    });
    console.log(`  Worker: ${worker.email} / worker123 (Daily Rate: Set by Supervisor)`);

    // ==========================================
    // STEP 5: CREATE SITE
    // ==========================================
    console.log('\n--- Creating Site ---');
    const site = await Site.create({
      name: 'Sunrise Apartments',
      address: '45 MG Road, Mumbai',
      description: 'Residential apartment project',
      status: 'active',
      organization: organization._id,
      createdBy: developer._id,
      budget: 500000,
      assignedUsers: [engineer._id, supervisor._id, worker._id]
    });
    console.log(`  Site: ${site.name}`);

    // ==========================================
    // STEP 6: CREATE INVESTMENT
    // ==========================================
    console.log('\n--- Creating Investment ---');
    const investment = await Investment.create({
      organization: organization._id,
      partner: developer._id,
      amount: 100000,
      description: 'Initial capital investment',
      investmentDate: new Date('2025-01-01'),
      referenceNumber: 'INV-001',
      paymentMode: 'bank_transfer'
    });
    console.log(`  Investment: Rs. ${investment.amount.toLocaleString()}`);

    // ==========================================
    // STEP 7: CREATE FUND ALLOCATIONS
    // ==========================================
    console.log('\n--- Creating Fund Allocations ---');

    // Developer → Engineer (Rs. 50,000)
    const fundDevToEng = await FundAllocation.create({
      organization: organization._id,
      fromUser: developer._id,
      toUser: engineer._id,
      site: site._id,
      amount: 50000,
      purpose: 'site_expense',
      description: 'Fund allocation: Developer to Engineer',
      status: 'disbursed',
      allocationDate: new Date('2025-01-05'),
      disbursedDate: new Date('2025-01-05'),
      referenceNumber: 'FA-001'
    });
    console.log(`  Developer → Engineer: Rs. ${fundDevToEng.amount.toLocaleString()}`);

    // Engineer → Supervisor (Rs. 20,000 for worker payments)
    const fundEngToSup = await FundAllocation.create({
      organization: organization._id,
      fromUser: engineer._id,
      toUser: supervisor._id,
      site: site._id,
      amount: 20000,
      purpose: 'labor_expense',
      description: 'Fund for worker salaries and advances',
      status: 'disbursed',
      allocationDate: new Date('2025-01-10'),
      disbursedDate: new Date('2025-01-10'),
      referenceNumber: 'FA-002'
    });
    console.log(`  Engineer → Supervisor: Rs. ${fundEngToSup.amount.toLocaleString()} (for worker payments)`);

    // ==========================================
    // STEP 8: CREATE ATTENDANCE (7 days of work)
    // Worker: Rs. 355/day (8 hours), overtime calculated per hour
    // Hourly rate = 355/8 = Rs. 44.375/hour
    // ==========================================
    console.log('\n--- Creating Attendance (7 Days) ---');

    const attendanceData = [
      { date: '2025-01-15', status: 'present', hoursWorked: 8, overtime: 0, notes: 'Day shift' },
      { date: '2025-01-16', status: 'present', hoursWorked: 8, overtime: 4, notes: 'Extra 4 hours work' },
      { date: '2025-01-17', status: 'present', hoursWorked: 8, overtime: 0, notes: 'Day shift' },
      { date: '2025-01-18', status: 'half_day', hoursWorked: 4, overtime: 0, notes: 'Half day' },
      { date: '2025-01-19', status: 'present', hoursWorked: 8, overtime: 4, notes: 'Extra 4 hours work' },
      { date: '2025-01-20', status: 'present', hoursWorked: 8, overtime: 0, notes: 'Day shift' },
      { date: '2025-01-21', status: 'present', hoursWorked: 8, overtime: 0, notes: 'Day shift' },
    ];

    const dailyRate = 355;
    const standardHours = 8;
    const hourlyRate = dailyRate / standardHours; // Rs. 44.375/hour
    let baseEarnings = 0;
    let overtimeEarnings = 0;

    for (const att of attendanceData) {
      await Attendance.create({
        organization: organization._id,
        worker: worker._id,
        site: site._id,
        markedBy: supervisor._id,
        date: new Date(att.date),
        status: att.status,
        hoursWorked: att.hoursWorked,
        overtime: att.overtime,
        notes: att.notes
      });

      // Calculate earnings based on hours
      if (att.status === 'present') {
        baseEarnings += dailyRate;
      } else if (att.status === 'half_day') {
        baseEarnings += dailyRate / 2;
      }
      // Overtime is paid per hour
      overtimeEarnings += att.overtime * hourlyRate;
    }

    const totalEarned = baseEarnings + overtimeEarnings;

    console.log(`  Created 7 attendance records`);
    console.log(`  Hourly Rate: Rs. ${hourlyRate.toFixed(2)}/hour`);
    console.log(`  Base Earnings:`);
    console.log(`    - 6 full days: 6 x Rs.355 = Rs.2,130`);
    console.log(`    - 1 half day: Rs.177.50`);
    console.log(`    - Base Total: Rs.${baseEarnings.toFixed(2)}`);
    console.log(`  Overtime Earnings:`);
    console.log(`    - 8 overtime hours: 8 x Rs.${hourlyRate.toFixed(2)} = Rs.${overtimeEarnings.toFixed(2)}`);
    console.log(`  TOTAL EARNED: Rs.${totalEarned.toFixed(2)}`);

    // ==========================================
    // STEP 9: CREATE WORKER LEDGER ENTRIES
    // Shows: Earnings (credit) vs Payments (debit)
    // ==========================================
    console.log('\n--- Creating Worker Ledger ---');

    // Credit: Worker earned from attendance (this would be auto-calculated in real system)
    // For demo, we'll show what worker earned

    // Debit: Advance payment (Rs. 1,000) - Worker requested advance
    const advance = await WorkerLedger.create({
      organization: organization._id,
      worker: worker._id,
      site: site._id,
      createdBy: supervisor._id,
      fundAllocation: fundEngToSup._id,
      type: 'debit',  // Money going OUT to worker
      amount: 1000,
      category: 'advance',
      description: 'Advance payment for personal needs',
      transactionDate: new Date('2025-01-17'),
      referenceNumber: 'WL-001',
      paymentMode: 'cash'
    });
    console.log(`  ADVANCE PAID: Rs. ${advance.amount.toLocaleString()} (from fund allocation)`);

    // Debit: Partial salary (Rs. 1,000)
    const salary = await WorkerLedger.create({
      organization: organization._id,
      worker: worker._id,
      site: site._id,
      createdBy: supervisor._id,
      fundAllocation: fundEngToSup._id,
      type: 'debit',  // Money going OUT to worker
      amount: 1000,
      category: 'salary',
      description: 'Partial salary payment',
      transactionDate: new Date('2025-01-21'),
      referenceNumber: 'WL-002',
      paymentMode: 'bank_transfer'
    });
    console.log(`  SALARY PAID: Rs. ${salary.amount.toLocaleString()} (from fund allocation)`);

    // Summary
    const totalPaid = 2000; // 1000 advance + 1000 salary
    const pendingBalance = totalEarned - totalPaid;

    console.log(`\n  --- Worker Balance Summary ---`);
    console.log(`  Total Earned (from attendance): Rs. ${totalEarned.toFixed(2)}`);
    console.log(`  Total Paid (advance + salary): Rs. ${totalPaid.toLocaleString()}`);
    console.log(`  PENDING TO PAY: Rs. ${pendingBalance.toFixed(2)}`);
    console.log(`  (Worker is owed Rs. ${pendingBalance.toFixed(2)} more)`);

    // ==========================================
    // STEP 10: CREATE EXPENSE (Supervisor submits)
    // ==========================================
    console.log('\n--- Creating Expense ---');
    const expense = await Expense.create({
      organization: organization._id,
      site: site._id,
      category: categories[0]._id, // Material
      user: supervisor._id,
      fundAllocation: fundEngToSup._id,
      amount: 0,
      requestedAmount: 5000,
      description: 'Cement bags for construction',
      vendorName: 'ACC Cement',
      expenseDate: new Date('2025-01-20'),
      status: 'pending'
    });
    console.log(`  PENDING: ${expense.description} - Rs. ${expense.requestedAmount.toLocaleString()}`);

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n========================================');
    console.log('       DATABASE SEED COMPLETE!');
    console.log('========================================');

    console.log('\n--- Test Accounts ---');
    console.log('  Developer:  developer@buildright.com / dev123');
    console.log('  Engineer:   engineer@buildright.com / eng123');
    console.log('  Supervisor: supervisor@buildright.com / super123');
    console.log('  Worker:     worker@buildright.com / worker123');

    console.log('\n--- Worker Payment System (Hours-Based) ---');
    console.log('  Daily Rate: Rs. 355/day (8 hours standard)');
    console.log('  Hourly Rate: Rs. 44.375/hour');
    console.log('  Overtime: Calculated per extra hour');
    console.log('  ');
    console.log('  Attendance (7 days):');
    console.log('    - 6 full days + 1 half day = Rs. 2,307.50 base');
    console.log('    - 8 overtime hours = Rs. 355 extra');
    console.log('    - Total Earned: Rs. 2,662.50');
    console.log('  ');
    console.log('  Payments Made:');
    console.log('    - Advance: Rs. 1,000');
    console.log('    - Salary:  Rs. 1,000');
    console.log('    - Total Paid: Rs. 2,000');
    console.log('  ');
    console.log('  Balance: Rs. 662.50 (pending to pay worker)');

    console.log('\n--- Fund Flow ---');
    console.log('  Investment: Rs. 1,00,000');
    console.log('  Developer → Engineer: Rs. 50,000');
    console.log('  Engineer → Supervisor: Rs. 20,000');
    console.log('  Supervisor → Worker: Rs. 2,000 (via ledger)');
    console.log('  Remaining with Supervisor: Rs. 18,000');

    console.log('\n--- Permissions ---');
    console.log('  Developer: Full access to everything');
    console.log('  Engineer: Manage sites, funds, approve expenses');
    console.log('  Supervisor: Mark attendance, pay workers, submit expenses');
    console.log('  Worker: View own attendance, view own ledger balance');

    console.log('\n========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();
