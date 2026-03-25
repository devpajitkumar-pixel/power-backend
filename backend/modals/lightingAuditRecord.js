import mongoose from "mongoose";

const lightingAuditRecordSchema = new mongoose.Schema(
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

    area_location: {
      type: String,
      trim: true,
    },

    fixture_type: {
      type: String,
      enum: [
        "tube_light",
        "bulb",
        "led_panel",
        "flood_light",
        "street_light",
        "other",
      ],
    },

    lamp_type: {
      type: String,
      enum: ["LED", "CFL", "fluorescent", "halogen", "incandescent", "other"],
    },

    wattage_W: {
      type: Number,
      min: 0,
    },

    quantity_nos: {
      type: Number,
      min: 0,
    },

    control_type: {
      type: String,
      enum: ["manual", "sensor", "timer", "bms", "other"],
    },

    working_hours_per_day: {
      type: Number,
      min: 0,
    },

    working_days_per_year: {
      type: Number,
      min: 0,
    },

    connected_load_kW: {
      type: Number,
      min: 0,
    },

    annual_energy_kWh: {
      type: Number,
      min: 0,
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

    // 📂 Documents (fixture photos, audit sheets, reports)
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
lightingAuditRecordSchema.index({ utility_account_id: 1 });
lightingAuditRecordSchema.index({ created_at: -1 });

const LightingAuditRecord = mongoose.model(
  "LightingAuditRecord",
  lightingAuditRecordSchema,
);

export default LightingAuditRecord;
