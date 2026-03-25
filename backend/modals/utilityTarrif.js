import mongoose from "mongoose";

const utilityTariffSchema = new mongoose.Schema(
  {
    utility_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UtilityAccount",
      required: true,
    },

    effective_from: {
      type: Date,
      required: true,
    },

    effective_to: {
      type: Date,
      default: null, // null = current tariff
    },

    basic_energy_charges_rs_per_unit: {
      type: Number,
      min: 0,
    },

    fixed_charges_rs_per_kW_or_per_kVA: {
      type: Number,
      min: 0,
    },

    ed_percent: {
      type: Number,
      min: 0,
    },

    octroi_rs_per_unit: {
      type: Number,
      min: 0,
    },

    surcharge_rs: {
      type: Number,
      min: 0,
    },

    cow_cess_rs: {
      type: Number,
      min: 0,
    },

    rental_rs: {
      type: Number,
      min: 0,
    },

    infracess_rs: {
      type: Number,
      min: 0,
    },

    other_charges_or_rebates_rs: {
      type: Number,
    },

    any_other_rs: {
      type: Number,
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

    // 📂 Documents (tariff orders, electricity bills, govt circulars)
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

// 🔒 Ensure only one active tariff per utility account
utilityTariffSchema.index(
  { utility_account_id: 1, effective_from: 1 },
  { unique: true },
);

// 🔍 Indexes
utilityTariffSchema.index({ utility_account_id: 1 });
utilityTariffSchema.index({ effective_from: -1 });

const UtilityTariff = mongoose.model("UtilityTariff", utilityTariffSchema);

export default UtilityTariff;
