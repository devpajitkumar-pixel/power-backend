import mongoose from "mongoose";

const facilityAuditorSchema = new mongoose.Schema(
  {
    facility_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      required: true,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assigned_role: {
      type: String,
      enum: ["lead_auditor", "assistant_auditor", "viewer"],
      default: "assistant_auditor",
    },

    assigned_at: {
      type: Date,
      default: Date.now,
    },

    assigned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: false, // we already have assigned_at
  },
);

// 🔒 Prevent duplicate assignments (same user in same facility)
facilityAuditorSchema.index({ facility_id: 1, user_id: 1 }, { unique: true });

// 🔍 Indexes for performance
facilityAuditorSchema.index({ facility_id: 1 });
facilityAuditorSchema.index({ user_id: 1 });

const FacilityAuditor = mongoose.model(
  "FacilityAuditor",
  facilityAuditorSchema,
);

export default FacilityAuditor;
