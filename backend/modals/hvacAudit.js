import mongoose from "mongoose";

const hvacAuditSchema = new mongoose.Schema(
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

    pre_audit_information: {
      facility_name: String,
      location_address: String,
      client_contact_person: String,
      contact_number_email: String,
      type_of_facility: String,
      audit_dates: [Date],
      auditor_team_members_names: [String],
      total_operating_hours_per_day: Number,
      hvac_operating_hours_per_day: Number,
      season_ambient_conditions: String,
    },

    documents_records_to_collect: {
      single_line_diagram_electrical: {
        available: { type: Boolean, default: false },
        remarks: { type: String, trim: true, default: "" },
      },
      hvac_layout_piping_drawing: {
        available: { type: Boolean, default: false },
        remarks: { type: String, trim: true, default: "" },
      },
      chiller_operation_maintenance_log: {
        available: { type: Boolean, default: false },
        remarks: { type: String, trim: true, default: "" },
      },
      water_treatment_records: {
        available: { type: Boolean, default: false },
        remarks: { type: String, trim: true, default: "" },
      },
      cooling_tower_maintenance_record: {
        available: { type: Boolean, default: false },
        remarks: { type: String, trim: true, default: "" },
      },
      hvac_equipment_capacity_list: {
        available: { type: Boolean, default: false },
        remarks: { type: String, trim: true, default: "" },
      },
      bms_setpoints_schedule: {
        available: { type: Boolean, default: false },
        remarks: { type: String, trim: true, default: "" },
      },
    },

    hvac_equipment_register: [
      {
        equipment_name: { type: String, trim: true },
        type: { type: String, trim: true },
        capacity: { type: Number, min: 0 },
        power_rating_kW: { type: Number, min: 0 },
        quantity: { type: Number, min: 0 },
        remarks: { type: String, trim: true },
      },
    ],

    chiller_field_test: {
      readings: [
        {
          chiller_load_TR: Number,
          power_input_kW: Number,
          chilled_water_in_temp: Number,
          chilled_water_out_temp: Number,
          condenser_water_in_temp: Number,
          condenser_water_out_temp: Number,
        },
      ],
      average: {
        avg_load_TR: Number,
        avg_power_kW: Number,
      },
    },

    auxiliary_power: {
      components: [
        {
          name: String,
          power_kW: Number,
        },
      ],
      total_auxiliary_power_used_kW: Number,
    },

    cooling_tower_quick_test: {
      readings: [
        {
          inlet_temp: Number,
          outlet_temp: Number,
          ambient_temp: Number,
        },
      ],
      average: {
        avg_inlet_temp: Number,
        avg_outlet_temp: Number,
      },
    },

    summary: {
      average_cooling_produced_TR: Number,
      average_chiller_power_used_kW: Number,
      total_auxiliary_power_used_kW: Number,
      total_plant_power_kW: Number,
      plant_efficiency_kW_per_TR: Number,
      coefficient_of_performance: Number,
    },

    audit_date: {
      type: Date,
    },

    auditor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    documents: [
      {
        fileUrl: String,
        fileType: String,
        fileName: String,
        publicId: String,
      },
    ],
  },
  { timestamps: true },
);

const HVACAudit = mongoose.model("HVACAudit", hvacAuditSchema);

export default HVACAudit;
