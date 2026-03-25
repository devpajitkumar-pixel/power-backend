import mongoose from "mongoose";

const miscLoadAuditRecordSchema = new mongoose.Schema(
  {
    facility_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      required: true,
    },
    utility_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UtilityAccount",
      required: true,
    },

    equipment_name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      trim: true,
    },

    location_department: {
      type: String,
      trim: true,
    },

    quantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    rated_power_kW: {
      type: Number,
      min: 0,
      default: 0,
    },

    average_operating_hours_per_day: {
      type: Number,
      min: 0,
      default: 0,
    },

    operating_days_per_year: {
      type: Number,
      min: 0,
      default: 0,
    },

    load_factor_percent: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },

    estimated_annual_energy_kWh: {
      type: Number,
      min: 0,
      default: 0,
    },

    // 🔍 Audit metadata (recommended)
    audit_date: {
      type: Date,
      default: Date.now,
    },

    auditor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    documents: [
      {
        fileUrl: {
          type: String,
          required: true,
        },
        fileType: {
          type: String,
          enum: ["image", "pdf"],
          required: true,
        },
        fileName: {
          type: String,
          trim: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

miscLoadAuditRecordSchema.index({ utility_account_id: 1 });
miscLoadAuditRecordSchema.index({ category: 1 });
miscLoadAuditRecordSchema.index({ created_at: -1 });

const MiscLoadAuditRecord = mongoose.model(
  "MiscLoadAuditRecord",
  miscLoadAuditRecordSchema,
);

export default MiscLoadAuditRecord;
