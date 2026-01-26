import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'half_day', 'leave'],
    default: 'present'
  },
  hoursWorked: {
    type: Number,
    min: 0,
    max: 24,
    default: 8
  },
  overtime: {
    type: Number,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Ensure one attendance record per worker per day per site
attendanceSchema.index({ worker: 1, site: 1, date: 1 }, { unique: true });
attendanceSchema.index({ organization: 1, date: -1 });
attendanceSchema.index({ site: 1, date: -1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
