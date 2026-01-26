import express from 'express';
import { Organization, User } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get current user's organization
router.get('/current', authenticate, async (req, res) => {
  try {
    if (!req.user.organization) {
      return res.status(404).json({ message: 'No organization assigned' });
    }

    const organization = await Organization.findById(req.user.organization);
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    res.json(organization);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all organizations (Level 1 only, for super admin)
router.get('/', authenticate, requireRole(1), async (req, res) => {
  try {
    const organizations = await Organization.find()
      .sort({ createdAt: -1 });

    res.json(organizations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create organization (Level 1 only)
router.post('/', authenticate, requireRole(1), async (req, res) => {
  try {
    const { name, description, address, phone, email, gstNumber } = req.body;

    const organization = new Organization({
      name,
      description,
      address,
      phone,
      email,
      gstNumber
    });

    await organization.save();

    // Assign the organization to the creating user if they don't have one
    if (!req.user.organization) {
      req.user.organization = organization._id;
      await req.user.save();
    }

    res.status(201).json(organization);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single organization
router.get('/:id', authenticate, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user belongs to this organization
    if (req.user.organization?.toString() !== organization._id.toString() && req.user.role !== 1) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(organization);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update organization (Level 1 only)
router.put('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user belongs to this organization
    if (req.user.organization?.toString() !== organization._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, description, address, phone, email, gstNumber, isActive } = req.body;

    if (name) organization.name = name;
    if (description !== undefined) organization.description = description;
    if (address !== undefined) organization.address = address;
    if (phone !== undefined) organization.phone = phone;
    if (email !== undefined) organization.email = email;
    if (gstNumber !== undefined) organization.gstNumber = gstNumber;
    if (isActive !== undefined) organization.isActive = isActive;

    await organization.save();

    res.json(organization);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get organization partners (all Level 1 users in organization)
router.get('/:id/partners', authenticate, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user belongs to this organization
    if (req.user.organization?.toString() !== organization._id.toString() && req.user.role !== 1) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const partners = await User.find({
      organization: organization._id,
      role: 1,
      isActive: true
    }).select('name email');

    res.json(partners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add partner to organization (Level 1 only)
router.post('/:id/partners', authenticate, requireRole(1), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user belongs to this organization
    if (req.user.organization?.toString() !== organization._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is a Level 1 (Developer/Partner)
    if (user.role !== 1) {
      return res.status(400).json({ message: 'Only Level 1 users can be added as partners' });
    }

    // Check if user already belongs to an organization
    if (user.organization) {
      return res.status(400).json({ message: 'User already belongs to an organization' });
    }

    user.organization = organization._id;
    await user.save();

    res.json({ message: 'Partner added successfully', user: { _id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove partner from organization (Level 1 only)
router.delete('/:id/partners/:userId', authenticate, requireRole(1), async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user belongs to this organization
    if (req.user.organization?.toString() !== organization._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cannot remove yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot remove yourself from the organization' });
    }

    // Check if user belongs to this organization
    if (user.organization?.toString() !== organization._id.toString()) {
      return res.status(400).json({ message: 'User does not belong to this organization' });
    }

    user.organization = null;
    await user.save();

    res.json({ message: 'Partner removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get organization summary stats
router.get('/:id/summary', authenticate, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user belongs to this organization
    if (req.user.organization?.toString() !== organization._id.toString() && req.user.role !== 1) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get counts
    const [
      totalUsers,
      totalPartners,
      totalEngineers,
      totalWorkers
    ] = await Promise.all([
      User.countDocuments({ organization: organization._id, isActive: true }),
      User.countDocuments({ organization: organization._id, role: 1, isActive: true }),
      User.countDocuments({ organization: organization._id, role: 2, isActive: true }),
      User.countDocuments({ organization: organization._id, role: 3, isActive: true })
    ]);

    res.json({
      organization,
      stats: {
        totalUsers,
        totalPartners,
        totalEngineers,
        totalWorkers
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
