import mongoose from 'mongoose';

const siteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'on_hold'],
    default: 'active'
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  budget: {
    type: Number,
    min: 0,
    default: 0
  },
  assignedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Check if user has access to site
siteSchema.methods.hasAccess = function(userId) {
  return this.assignedUsers.some(u => {
    // Handle both populated (u is a User object) and non-populated (u is an ObjectId)
    const uId = u._id || u;
    return uId.toString() === userId.toString();
  }) || this.createdBy.toString() === userId.toString();
};

const Site = mongoose.model('Site', siteSchema);
export default Site;
