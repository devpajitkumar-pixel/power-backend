import mongoose from "mongoose";

const dgSetSchema = new mongoose.Schema(
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

    dg_number: {
      type: String,
      required: true,
      trim: true,
    },

    make_model: {
      type: String,
      trim: true,
    },

    year_of_installation: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear(),
    },

    rated_capacity_kVA: {
      type: Number,
      min: 0,
    },

    rated_active_power_kW: {
      type: Number,
      min: 0,
    },

    rated_voltage_V: {
      type: Number,
      min: 0,
    },

    rated_speed_RPM: {
      type: Number,
      min: 0,
    },

    fuel_type: {
      type: String,
      enum: ["diesel", "gas", "dual"],
      default: "diesel",
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

    // 📂 Documents (manuals, invoices, images, maintenance reports)
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

// 🔒 Prevent duplicate DG number within same utility account
dgSetSchema.index({ utility_account_id: 1, dg_number: 1 }, { unique: true });

// 🔍 Indexes
dgSetSchema.index({ facility_id: 1 });
dgSetSchema.index({ utility_account_id: 1 });

const DGSet = mongoose.model("DGSet", dgSetSchema);

export default DGSet;
