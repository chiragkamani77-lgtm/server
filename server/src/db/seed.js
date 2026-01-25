import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Site, ExpenseCategory, Expense } from '../models/index.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Site.deleteMany({}),
      ExpenseCategory.deleteMany({}),
      Expense.deleteMany({})
    ]);

    // Create expense categories
    const categories = await ExpenseCategory.insertMany([
      { name: 'Material', description: 'Construction materials - cement, bricks, steel, etc.' },
      { name: 'Labor', description: 'Worker wages and contractor payments' },
      { name: 'Transport', description: 'Transportation and logistics costs' },
      { name: 'Equipment Rental', description: 'Machinery and equipment rental' },
      { name: 'Utilities', description: 'Electricity, water, and other utilities' },
      { name: 'Miscellaneous', description: 'Other expenses' }
    ]);
    console.log('Created expense categories');

    // Create Level 1 user (Developer/Admin)
    const admin = await User.create({
      email: 'admin@billing.com',
      password: 'admin123',
      name: 'Admin Developer',
      role: 1
    });
    console.log('Created admin user: admin@billing.com / admin123');

    // Create Level 2 users (Supervisors)
    const supervisor1 = await User.create({
      email: 'supervisor1@billing.com',
      password: 'super123',
      name: 'John Supervisor',
      role: 2,
      parent: admin._id
    });

    const supervisor2 = await User.create({
      email: 'supervisor2@billing.com',
      password: 'super123',
      name: 'Jane Supervisor',
      role: 2,
      parent: admin._id
    });
    console.log('Created supervisor users');

    // Create Level 3 users (Workers)
    const worker1 = await User.create({
      email: 'worker1@billing.com',
      password: 'worker123',
      name: 'Mike Worker',
      role: 3,
      parent: supervisor1._id
    });

    const worker2 = await User.create({
      email: 'worker2@billing.com',
      password: 'worker123',
      name: 'Sarah Worker',
      role: 3,
      parent: supervisor1._id
    });

    const worker3 = await User.create({
      email: 'worker3@billing.com',
      password: 'worker123',
      name: 'Tom Worker',
      role: 3,
      parent: supervisor2._id
    });
    console.log('Created worker users');

    // Create sites
    const site1 = await Site.create({
      name: 'Sunrise Apartments',
      address: '123 Main Street, City Center',
      description: 'Residential apartment complex - 20 units',
      status: 'active',
      createdBy: admin._id,
      assignedUsers: [supervisor1._id, worker1._id, worker2._id]
    });

    const site2 = await Site.create({
      name: 'Green Valley Villas',
      address: '456 Park Road, Suburb',
      description: 'Luxury villa project - 10 villas',
      status: 'active',
      createdBy: admin._id,
      assignedUsers: [supervisor2._id, worker3._id]
    });

    const site3 = await Site.create({
      name: 'Metro Commercial Plaza',
      address: '789 Business Ave, Downtown',
      description: 'Commercial shopping complex',
      status: 'on_hold',
      createdBy: admin._id,
      assignedUsers: [supervisor1._id]
    });
    console.log('Created sites');

    // Create sample expenses
    const sampleExpenses = [
      // Site 1 expenses
      { site: site1._id, category: categories[0]._id, user: supervisor1._id, amount: 50000, description: 'Cement purchase - 100 bags', vendorName: 'ABC Cement Co.', expenseDate: new Date('2025-01-10') },
      { site: site1._id, category: categories[0]._id, user: worker1._id, amount: 25000, description: 'Steel rods - 500kg', vendorName: 'Steel World', expenseDate: new Date('2025-01-12') },
      { site: site1._id, category: categories[1]._id, user: supervisor1._id, amount: 75000, description: 'Weekly labor payment', vendorName: 'Labor contractor', expenseDate: new Date('2025-01-15') },
      { site: site1._id, category: categories[1]._id, user: worker2._id, amount: 15000, description: 'Helper wages', vendorName: 'Daily workers', expenseDate: new Date('2025-01-16') },
      { site: site1._id, category: categories[2]._id, user: worker1._id, amount: 8000, description: 'Material transport', vendorName: 'Fast Logistics', expenseDate: new Date('2025-01-17') },
      { site: site1._id, category: categories[3]._id, user: supervisor1._id, amount: 12000, description: 'Concrete mixer rental', vendorName: 'Equipment Rentals', expenseDate: new Date('2025-01-18') },

      // Site 2 expenses
      { site: site2._id, category: categories[0]._id, user: supervisor2._id, amount: 80000, description: 'Bricks - 10000 pieces', vendorName: 'Brick Factory', expenseDate: new Date('2025-01-11') },
      { site: site2._id, category: categories[0]._id, user: worker3._id, amount: 35000, description: 'Sand and gravel', vendorName: 'Mining Co.', expenseDate: new Date('2025-01-13') },
      { site: site2._id, category: categories[1]._id, user: supervisor2._id, amount: 90000, description: 'Masonry work payment', vendorName: 'Skilled Labor Group', expenseDate: new Date('2025-01-19') },
      { site: site2._id, category: categories[4]._id, user: worker3._id, amount: 5000, description: 'Electricity bill', vendorName: 'Power Corp', expenseDate: new Date('2025-01-20') },

      // Site 3 expenses
      { site: site3._id, category: categories[0]._id, user: supervisor1._id, amount: 120000, description: 'Foundation materials', vendorName: 'Building Supplies', expenseDate: new Date('2025-01-08') },
      { site: site3._id, category: categories[5]._id, user: supervisor1._id, amount: 10000, description: 'Site inspection fees', vendorName: 'City Authority', expenseDate: new Date('2025-01-09') }
    ];

    await Expense.insertMany(sampleExpenses);
    console.log('Created sample expenses');

    console.log('\n=== Seed Complete ===');
    console.log('\nTest Accounts:');
    console.log('Level 1 (Admin): admin@billing.com / admin123');
    console.log('Level 2 (Supervisor): supervisor1@billing.com / super123');
    console.log('Level 2 (Supervisor): supervisor2@billing.com / super123');
    console.log('Level 3 (Worker): worker1@billing.com / worker123');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();
