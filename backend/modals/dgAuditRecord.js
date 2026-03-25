import mongoose from "mongoose";

const dgAuditRecordSchema = new mongoose.Schema(
  {
    dg_set_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DGSet",
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

    // ⚡ Electrical Measurements
    measured_voltage_LL: { type: Number },
    measured_current_avg: { type: Number },
    measured_kW_output: { type: Number },
    measured_kVA_output: { type: Number },
    power_factor: { type: Number, min: 0, max: 1 },
    frequency_Hz: { type: Number },

    // 📊 Load Analysis
    max_load_observed_kW: { type: Number },
    min_load_observed_kW: { type: Number },
    average_loading_percent: { type: Number, min: 0, max: 100 },
    load_factor_percent: { type: Number, min: 0, max: 100 },

    idle_running_observed: { type: Boolean },
    parallel_operation: { type: Boolean },

    // ⛽ Fuel & Generation
    annual_fuel_consumption_liters: { type: Number },
    units_generated_per_year_kWh: { type: Number },
    total_working_hours_per_year: { type: Number },
    units_generated_per_hour_kWh: { type: Number },
    fuel_consumption_per_hour_liters: { type: Number },

    fuel_consumption_during_test_lph: { type: Number },
    units_generated_during_test_kWh: { type: Number },

    specific_fuel_consumption_l_per_kWh: { type: Number },
    manufacturer_sfc_l_per_kWh: { type: Number },
    sfc_deviation_percent: { type: Number },

    // 💰 Cost Analysis
    fuel_cost_rs_per_liter: { type: Number },
    annual_fuel_cost_rs: { type: Number },
    dg_cost_per_kWh_rs: { type: Number },
    grid_cost_per_kWh_rs: { type: Number },

    // ⚙️ Efficiency
    calculated_efficiency_percent: { type: Number, min: 0, max: 100 },
    manufacturer_efficiency_percent: { type: Number, min: 0, max: 100 },
    efficiency_deviation_percent: { type: Number },

    // 🌡️ Operating Conditions
    exhaust_temperature_C: { type: Number },
    cooling_water_temperature_C: { type: Number },
    lube_oil_pressure_bar: { type: Number },
    lube_oil_consumption_liters_per_year: { type: Number },

    total_operating_hours: { type: Number },
    hours_since_last_overhaul: { type: Number },

    air_fuel_filter_condition: {
      type: String,
      enum: ["good", "moderate", "poor"],
    },

    visible_smoke_or_abnormal_vibration: { type: Boolean },

    // 🔍 Audit metadata (recommended)
    audit_date: {
      type: Date,
      default: Date.now,
    },

    auditor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // 📂 Documents (test photos, reports, logs)
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
dgAuditRecordSchema.index({ dg_set_id: 1 });
dgAuditRecordSchema.index({ utility_account_id: 1 });
dgAuditRecordSchema.index({ created_at: -1 });

const DGAuditRecord = mongoose.model("DGAuditRecord", dgAuditRecordSchema);

export default DGAuditRecord;
