import mongoose from "mongoose";

const utilityBillingRecordSchema = new mongoose.Schema(
  {
    utility_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UtilityAccount",
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

    mdi_kVA: {
      type: Number,
      min: 0,
    },

    units_kWh: {
      type: Number,
      min: 0,
    },

    units_kVAh: {
      type: Number,
      min: 0,
    },

    pf: {
      type: Number,
      min: 0,
      max: 1,
    },

    fixed_charges_rs: {
      type: Number,
      min: 0,
    },

    energy_charges_rs: {
      type: Number,
      min: 0,
    },

    taxes_and_rent_rs: {
      type: Number,
      min: 0,
    },

    other_charges_rs: {
      type: Number,
      min: 0,
    },

    monthly_electricity_bill_rs: {
      type: Number,
      min: 0,
    },

    unit_consumption_per_day_kVAh: {
      type: Number,
      min: 0,
    },

    average_per_unit_cost_rs: {
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

    // 📂 Documents (actual bill PDFs, meter photos, etc.)
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

// 🔒 Prevent duplicate billing record for same period
utilityBillingRecordSchema.index(
  { utility_account_id: 1, billing_period_start: 1, billing_period_end: 1 },
  { unique: true },
);

// 🔍 Indexes
utilityBillingRecordSchema.index({ utility_account_id: 1 });
utilityBillingRecordSchema.index({ billing_period_start: -1 });

const UtilityBillingRecord = mongoose.model(
  "UtilityBillingRecord",
  utilityBillingRecordSchema,
);

export default UtilityBillingRecord;
