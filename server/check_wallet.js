import mongoose from 'mongoose';
import { FundAllocation, Expense, User } from './src/models/index.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkWallet() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Find the user "Kevin Patel" or get all users
    const users = await User.find().select('name email role organization');
    console.log('=== USERS ===');
    users.forEach(u => console.log(`${u.name} (${u.email}) - Role: ${u.role} - ID: ${u._id}`));

    console.log('\n=== FUND ALLOCATIONS ===');
    const allocations = await FundAllocation.find()
      .populate('fromUser', 'name')
      .populate('toUser', 'name')
      .sort({ allocationDate: -1 });
    
    allocations.forEach(a => {
      console.log(`\nID: ${a._id}`);
      console.log(`From: ${a.fromUser?.name} → To: ${a.toUser?.name}`);
      console.log(`Amount: ₹${a.amount}`);
      console.log(`Status: ${a.status}`);
      console.log(`Date: ${a.allocationDate}`);
    });

    console.log('\n=== EXPENSES ===');
    const expenses = await Expense.find()
      .populate('user', 'name')
      .populate('fundAllocation')
      .sort({ expenseDate: -1 });
    
    expenses.forEach(e => {
      console.log(`\nID: ${e._id}`);
      console.log(`User: ${e.user?.name}`);
      console.log(`Amount: ₹${e.amount} (Requested: ₹${e.requestedAmount})`);
      console.log(`Status: ${e.status}`);
      console.log(`Fund Allocation: ${e.fundAllocation?._id}`);
      console.log(`Date: ${e.expenseDate}`);
    });

    // Calculate wallet balance for each user
    console.log('\n=== WALLET CALCULATIONS ===');
    for (const user of users) {
      if (!user.organization) continue;

      const received = await FundAllocation.aggregate([
        {
          $match: {
            toUser: user._id,
            status: 'disbursed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);

      const spent = await Expense.aggregate([
        {
          $match: {
            user: user._id
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);

      // Exclude self-allocations to avoid double-counting
      const subAlloc = await FundAllocation.aggregate([
        {
          $match: {
            fromUser: user._id,
            status: 'disbursed',
            $expr: { $ne: ['$fromUser', '$toUser'] } // Exclude self-allocations
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);

      const totalReceived = received[0]?.total || 0;
      const totalSpent = spent[0]?.total || 0;
      const totalSubAlloc = subAlloc[0]?.total || 0;
      const balance = totalReceived - totalSpent - totalSubAlloc;

      console.log(`\n${user.name}:`);
      console.log(`  Received: ₹${totalReceived}`);
      console.log(`  Spent (Expenses): ₹${totalSpent}`);
      console.log(`  Passed Down (Sub-allocations): ₹${totalSubAlloc}`);
      console.log(`  Balance: ₹${balance}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkWallet();
