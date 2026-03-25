import mongoose from "mongoose";

const transformerAuditRecordSchema = new mongoose.Schema(
  {
    transformer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transformer",
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

    // ⚡ Performance & Losses
    total_losses_kW: { type: Number, min: 0 },
    average_load_kVA: { type: Number, min: 0 },
    percent_loading: { type: Number, min: 0, max: 100 },
    max_load_kVA: { type: Number, min: 0 },
    load_factor_percent: { type: Number, min: 0, max: 100 },

    operating_hours_per_year: { type: Number, min: 0 },
    annual_energy_supplied_kWh: { type: Number, min: 0 },
    annual_energy_losses_kWh: { type: Number, min: 0 },

    per_unit_cost_rs: { type: Number, min: 0 },
    cost_of_losses_rs: { type: Number, min: 0 },

    // ⚡ Electrical Quality
    power_factor_LT: { type: Number, min: 0, max: 1 },
    harmonics_THD_percent: { type: Number, min: 0 },

    // 🛡️ Safety & Earthing
    neutral_earth_resistance_ohms: { type: Number, min: 0 },
    body_to_earth_resistance_ohms: { type: Number, min: 0 },

    // 🧪 Maintenance Indicators
    silica_gel_cobalt_type: {
      type: String,
      enum: ["good", "moderate", "poor"],
    },

    silica_gel_non_cobalt_type: {
      type: String,
      enum: ["good", "moderate", "poor"],
    },

    oil_level: {
      type: String,
      enum: ["low", "normal", "high"],
    },

    // 🔌 Voltage Measurements
    line_voltage_Vr: { type: Number },
    line_voltage_Vy: { type: Number },
    line_voltage_Vb: { type: Number },

    phase_voltage_Vr_n: { type: Number },
    phase_voltage_Vy_n: { type: Number },
    phase_voltage_Vb_n: { type: Number },

    // 🔌 Current Measurements
    line_current_Ir: { type: Number },
    line_current_Iy: { type: Number },
    line_current_Ib: { type: Number },

    // 🔍 Audit metadata (recommended)
    audit_date: {
      type: Date,
      default: Date.now,
    },

    auditor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // 📂 Documents (test reports, IR test, images, etc.)
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
transformerAuditRecordSchema.index({ transformer_id: 1 });
transformerAuditRecordSchema.index({ utility_account_id: 1 });
transformerAuditRecordSchema.index({ created_at: -1 });

const TransformerAuditRecord = mongoose.model(
  "TransformerAuditRecord",
  transformerAuditRecordSchema,
);

export default TransformerAuditRecord;
