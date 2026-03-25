import mongoose from "mongoose";

const transformerSchema = new mongoose.Schema(
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

    transformer_tag: {
      type: String,
      required: true,
      trim: true,
    },

    rated_capacity_kVA: {
      type: Number,
      min: 0,
    },

    type_of_cooling: {
      type: String,
      enum: ["ONAN", "ONAF", "OFWF", "ODAF", "dry"],
    },

    rated_HV_kV: {
      type: Number,
      min: 0,
    },

    rated_LV_V: {
      type: Number,
      min: 0,
    },

    rated_HV_current_A: {
      type: Number,
      min: 0,
    },

    rated_LV_current_A: {
      type: Number,
      min: 0,
    },

    no_load_loss_kW: {
      type: Number,
      min: 0,
    },

    full_load_loss_kW: {
      type: Number,
      min: 0,
    },

    nameplate_efficiency_percent: {
      type: Number,
      min: 0,
      max: 100,
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

    // 📂 Documents (test reports, nameplate images, drawings, etc.)
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

// 🔒 Prevent duplicate transformer tag per utility account
transformerSchema.index(
  { utility_account_id: 1, transformer_tag: 1 },
  { unique: true },
);

// 🔍 Indexes
transformerSchema.index({ facility_id: 1 });
transformerSchema.index({ utility_account_id: 1 });

const Transformer = mongoose.model("Transformer", transformerSchema);

export default Transformer;
