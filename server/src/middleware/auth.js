import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

// Verify JWT token
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Check if user has required role (1=Developer, 2=Supervisor, 3=Worker)
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

// Check if user can manage another user (parent-child relationship)
export const canManageUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.body.userId;
    if (!targetUserId) return next();

    // Level 1 can manage anyone
    if (req.user.role === 1) return next();

    // Check if target user is a child of current user
    const childIds = await req.user.getChildIds();
    if (childIds.some(id => id.toString() === targetUserId)) {
      return next();
    }

    // User can manage themselves
    if (req.user._id.toString() === targetUserId) {
      return next();
    }

    return res.status(403).json({ message: 'Cannot manage this user' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
