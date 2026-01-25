import express from 'express';
import { User } from '../models/index.js';
import { authenticate, requireRole, canManageUser } from '../middleware/auth.js';

const router = express.Router();

// Get users (hierarchical based on role)
router.get('/', authenticate, async (req, res) => {
  try {
    let users;

    if (req.user.role === 1) {
      // Developer sees all users
      users = await User.find()
        .populate('parent', 'name email')
        .sort({ role: 1, createdAt: -1 });
    } else {
      // Others see only their children
      const childIds = await req.user.getChildIds();
      users = await User.find({ _id: { $in: [req.user._id, ...childIds] } })
        .populate('parent', 'name email')
        .sort({ role: 1, createdAt: -1 });
    }

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create user (creates as child of current user)
router.post('/', authenticate, requireRole(1, 2), async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Determine allowed role for new user
    let assignedRole = role;
    if (req.user.role === 2) {
      // Supervisor can only create workers
      assignedRole = 3;
    } else if (req.user.role === 1) {
      // Developer can create supervisors or workers
      if (role !== 2 && role !== 3) {
        assignedRole = 2;
      }
    }

    const user = new User({
      email,
      password,
      name,
      role: assignedRole,
      parent: req.user._id
    });

    await user.save();

    res.status(201).json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Get single user
router.get('/:userId', authenticate, canManageUser, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('parent', 'name email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user
router.put('/:userId', authenticate, canManageUser, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, password, isActive } = req.body;

    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password = password;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    res.json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete user
router.delete('/:userId', authenticate, requireRole(1, 2), canManageUser, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Can't delete yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }

    // Reassign children to deleted user's parent or null
    await User.updateMany(
      { parent: user._id },
      { parent: user.parent || null }
    );

    await user.deleteOne();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get children of current user
router.get('/my/children', authenticate, async (req, res) => {
  try {
    const children = await User.find({ parent: req.user._id })
      .sort({ createdAt: -1 });

    res.json(children);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
