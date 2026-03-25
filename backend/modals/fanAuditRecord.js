import mongoose from "mongoose";

const fanAuditRecordSchema = new mongoose.Schema(
  {
    utility_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UtilityAccount",
      required: true,
    },

    building_block: {
      type: String,
      trim: true,
    },

    area_location: {
      type: String,
      trim: true,
    },

    fan_type: {
      type: String,
      enum: ["ceiling", "exhaust", "pedestal", "wall", "industrial", "other"],
    },

    make_model: {
      type: String,
      trim: true,
    },

    rated_power_W: {
      type: Number,
      min: 0,
    },

    measured_power_W: {
      type: Number,
      min: 0,
    },

    quantity_nos: {
      type: Number,
      min: 0,
    },

    speed_control_type: {
      type: String,
      enum: ["regulator", "electronic", "vfd", "none"],
    },

    operating_hours_per_day: {
      type: Number,
      min: 0,
    },

    operating_days_per_year: {
      type: Number,
      min: 0,
    },

    loading_factor_percent: {
      type: Number,
      min: 0,
      max: 100,
    },

    connected_load_kW: {
      type: Number,
      min: 0,
    },

    annual_energy_consumption_kWh: {
      type: Number,
      min: 0,
    },

    condition: {
      type: String,
      enum: ["good", "moderate", "poor"],
    },

    remarks: {
      type: String,
      trim: true,
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
    // 📂 Documents (fan images, measurement proof, reports)
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

// 🔍 Indexes
fanAuditRecordSchema.index({ utility_account_id: 1 });
fanAuditRecordSchema.index({ created_at: -1 });

const FanAuditRecord = mongoose.model("FanAuditRecord", fanAuditRecordSchema);

export default FanAuditRecord;
