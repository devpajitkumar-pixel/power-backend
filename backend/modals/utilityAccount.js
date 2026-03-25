import mongoose from "mongoose";

const utilityAccountSchema = new mongoose.Schema(
  {
    facility_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      required: true,
    },

    account_number: {
      type: String,
      required: true,
      trim: true,
    },

    connection_type: {
      type: String,
      enum: ["LT", "HT"],
      required: true,
    },

    category: {
      type: String,
      trim: true,
    },

    sanctioned_demand_kVA: {
      type: Number,
      min: 0,
    },
    // ⚡ Connections
    is_solar_connected: {
      type: Boolean,
      default: false,
    },

    is_dg_connected: {
      type: Boolean,
      default: false,
    },

    is_transformer_connected: {
      type: Boolean,
      default: false,
    },

    is_pump_connected: {
      type: Boolean,
      default: false,
    },

    is_transformer_maintained_by_facility: {
      type: Boolean,
      default: false,
    },

    is_active: {
      type: Boolean,
      default: true,
    },
    provider: {
      type: String, // PSPCL, DHBVN, etc.
    },
    billing_cycle: {
      type: String, // monthly, bi-monthly
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

    // 📂 Documents (Bills, Agreements, Images, etc.)
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

// 🔒 Prevent duplicate account per facility
utilityAccountSchema.index(
  { facility_id: 1, account_number: 1 },
  { unique: true },
);

// 🔍 Indexes
utilityAccountSchema.index({ facility_id: 1 });
utilityAccountSchema.index({ is_active: 1 });

const UtilityAccount = mongoose.model("UtilityAccount", utilityAccountSchema);

export default UtilityAccount;
