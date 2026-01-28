import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: Number,
    required: true,
    enum: [1, 2, 3, 4], // 1=Developer, 2=Engineer, 3=Supervisor, 4=Worker
    default: 4
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  dailyRate: {
    type: Number,
    min: 0,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get all child user IDs (recursive)
userSchema.methods.getChildIds = async function(
    roles = [],      // [2, 3] → only these roles
  siteId = null   // only users assigned to this site
) {
 const match = {
    parent: this._id
  };

  // Role filter
  if (roles.length) {
    match.role = { $in: roles };
  }

  // Site filter (if you store assigned sites on user)
  if (siteId) {
    match.assignedSites = siteId;
  }

  const children = await User.find(match).select('_id role');

  let allChildIds = children.map(c => c._id);

  for (const child of children) {
    const grandChildren = await child.getChildIds({ roles, siteId });
    allChildIds = allChildIds.concat(grandChildren);
  }

  return allChildIds;
};

// Don't return password in JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
