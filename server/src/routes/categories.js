import express from 'express';
import { ExpenseCategory } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all categories
router.get('/', authenticate, async (req, res) => {
  try {
    const categories = await ExpenseCategory.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create category (Level 1 only)
router.post('/', authenticate, requireRole(1), async (req, res) => {
  try {
    const { name, description } = req.body;

    const category = new ExpenseCategory({ name, description });
    await category.save();

    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update category
router.put('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const { name, description } = req.body;

    const category = await ExpenseCategory.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete category
router.delete('/:id', authenticate, requireRole(1), async (req, res) => {
  try {
    const category = await ExpenseCategory.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
