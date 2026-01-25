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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  return this.assignedUsers.some(u => u.toString() === userId.toString()) ||
         this.createdBy.toString() === userId.toString();
};

const Site = mongoose.model('Site', siteSchema);
export default Site;
