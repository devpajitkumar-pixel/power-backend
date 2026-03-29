// modals/report.js
import mongoose from "mongoose";

const reportFileSchema = new mongoose.Schema(
  {
    fileUrl: String,
    fileName: String,
    fileType: String, // pdf, xlsx
    publicId: String,
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const reportSchema = new mongoose.Schema(
  {
    facility_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      required: true,
    },

    utility_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UtilityAccount",
      default: null,
    },

    report_scope: {
      type: String,
      enum: ["facility", "utility_account"],
      required: true,
    },

    report_type: {
      type: String,
      enum: [
        "full_audit_report",
        "executive_summary",
        "solar_report",
        "dg_report",
        "transformer_report",
        "pump_report",
        "hvac_report",
        "ac_report",
        "fan_report",
        "lighting_report",
        "lux_report",
        "misc_report",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },

    snapshot_meta: {
      facility_name: String,
      facility_city: String,
      utility_account_number: String,
      report_period_from: Date,
      report_period_to: Date,
    },

    excel_file: reportFileSchema,
    pdf_file: reportFileSchema,

    generated_at: Date,
    error_message: String,

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

export default mongoose.models.Report || mongoose.model("Report", reportSchema);
