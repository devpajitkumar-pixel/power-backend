import mongoose from "mongoose";

const acAuditRecordSchema = new mongoose.Schema(
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

    // 🔹 BASIC DETAILS
    unit_id: {
      type: String,
      required: true,
      trim: true,
    },

    building_block: {
      type: String,
      trim: true,
    },

    area_location: {
      type: String,
      trim: true,
    },

    ac_type: {
      type: String,
      enum: ["window", "split", "ductable"],
      required: true,
    },

    make: { type: String, trim: true },
    model: { type: String, trim: true },

    cooling_capacity_TR: {
      type: Number,
      min: 0,
    },

    rated_input_power_kW: {
      type: Number,
      min: 0,
    },

    bee_star_rating: {
      type: Number,
      min: 0,
      max: 5,
    },

    refrigerant: {
      type: String,
      trim: true,
    },

    year_of_installation: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear(),
    },

    control_type: {
      type: String,
      enum: ["manual", "thermostat", "bms", "timer", "inverter", "other"],
    },

    quantity_nos: {
      type: Number,
      min: 1,
      default: 1,
    },

    running_status: {
      type: String,
      enum: ["running", "not_running", "standby"],
      default: "running",
    },

    condition: {
      type: String,
      enum: ["good", "average", "poor"],
    },

    remarks: {
      type: String,
      trim: true,
    },

    // 🔹 MEASUREMENT SECTION
    voltage_V: { type: Number, min: 0 },
    current_A: { type: Number, min: 0 },
    power_factor: { type: Number, min: 0, max: 1 },

    measured_power_kW: { type: Number, min: 0 },

    return_air_temp_C: { type: Number },
    supply_air_temp_C: { type: Number },
    ambient_temp_C: { type: Number },
    thermostat_set_temp_C: { type: Number },

    operating_hours_per_day: { type: Number, min: 0 },
    operating_days_per_year: { type: Number, min: 0 },

    compressor_fan_cycling: {
      type: String,
      enum: ["normal", "frequent", "continuous"],
    },

    filter_evaporator_condition: {
      type: String,
      enum: ["clean", "moderate", "dirty"],
    },

    condenser_condition: {
      type: String,
      enum: ["clean", "moderate", "dirty"],
    },

    airflow_noise_leakage: {
      type: String,
      trim: true,
    },

    measurement_remarks: {
      type: String,
      trim: true,
    },

    // 🔹 CALCULATION SECTION (AUTO / STORED SNAPSHOT)
    airside_delta_T: {
      type: Number, // Return - Supply
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

    specific_power_kW_per_TR: {
      type: Number,
      min: 0,
    },

    age_years: {
      type: Number,
      min: 0,
    },

    om_flag: {
      type: String,
      trim: true,
    },

    replacement_flag: {
      type: String,
      enum: ["yes", "no"],
      default: "no",
    },

    control_flag: {
      type: String,
      trim: true,
    },

    overall_ecm_suggestion: {
      type: String,
      trim: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
    },

    indicative_basis: {
      type: String,
      trim: true,
    },

    // 📂 DOCUMENTS
    documents: [
      {
        fileUrl: String,
        fileType: {
          type: String,
          enum: ["image", "pdf"],
        },
        fileName: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // 🔍 AUDIT META
    audit_date: {
      type: Date,
      default: Date.now,
    },

    auditor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

const ACAuditRecord = mongoose.model("ACAuditRecord", acAuditRecordSchema);

export default ACAuditRecord;
