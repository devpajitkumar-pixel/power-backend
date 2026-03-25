import mongoose from "mongoose";

const solarGenerationRecordSchema = new mongoose.Schema(
  {
    solar_plant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SolarPlant",
      required: true,
    },

    utility_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UtilityAccount",
      required: true,
    },
    facility_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      required: true,
    },

    billing_period_start: {
      type: Date,
      required: true,
    },

    billing_period_end: {
      type: Date,
      required: true,
    },

    billing_days: {
      type: Number,
      min: 0,
    },

    bill_no: {
      type: String,
      trim: true,
    },

    // ⚡ Import (Grid consumption)
    import_kWh: {
      type: Number,
      min: 0,
    },

    import_kVAh: {
      type: Number,
      min: 0,
    },

    import_kVA: {
      type: Number,
      min: 0,
    },

    // 🔁 Export (Solar sent to grid)
    export_kWh: {
      type: Number,
      min: 0,
    },

    export_kVAh: {
      type: Number,
      min: 0,
    },

    export_kVA: {
      type: Number,
      min: 0,
    },

    // ⚖️ Net values
    net_kWh: {
      type: Number,
    },

    net_kVAh: {
      type: Number,
    },

    net_kVA: {
      type: Number,
    },

    // ☀️ Solar generation
    solar_generation_kWh: {
      type: Number,
      min: 0,
    },

    solar_generation_kVAh: {
      type: Number,
      min: 0,
    },

    solar_generation_kVA: {
      type: Number,
      min: 0,
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

    // 📂 Documents (net meter bills, generation reports, screenshots)
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

// 🔒 Prevent duplicate records for same plant & billing period
solarGenerationRecordSchema.index(
  {
    solar_plant_id: 1,
    billing_period_start: 1,
    billing_period_end: 1,
  },
  { unique: true },
);

// 🔍 Indexes
solarGenerationRecordSchema.index({ solar_plant_id: 1 });
solarGenerationRecordSchema.index({ utility_account_id: 1 });
solarGenerationRecordSchema.index({ billing_period_start: -1 });

const SolarGenerationRecord = mongoose.model(
  "SolarGenerationRecord",
  solarGenerationRecordSchema,
);

export default SolarGenerationRecord;
