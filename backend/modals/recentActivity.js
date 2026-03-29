import mongoose from "mongoose";

const recentActivitySchema = new mongoose.Schema(
  {
    actor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    actor_name: {
      type: String,
      trim: true,
    },

    actor_role: {
      type: String,
      trim: true,
    },

    action: {
      type: String,
      required: true,
      enum: [
        "created",
        "updated",
        "deleted",
        "assigned",
        "unassigned",
        "generated",
        "uploaded",
        "status_changed",
        "login",
        "logout",
      ],
      index: true,
    },

    entity_type: {
      type: String,
      required: true,
      enum: [
        "facility",
        "utility_account",
        "solar_plant",
        "dg_set",
        "transformer",
        "pump",
        "tariff",
        "billing_record",
        "hvac_audit",
        "ac_audit",
        "fan_audit",
        "lighting_audit",
        "lux_measurement",
        "misc_load",
        "report",
        "user",
        "document",
        "other",
      ],
      index: true,
    },

    entity_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    entity_name: {
      type: String,
      trim: true,
    },

    facility_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      default: null,
      index: true,
    },

    utility_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UtilityAccount",
      default: null,
      index: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    created_by_system: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

recentActivitySchema.index({ createdAt: -1 });
recentActivitySchema.index({ facility_id: 1, createdAt: -1 });
recentActivitySchema.index({ utility_account_id: 1, createdAt: -1 });
recentActivitySchema.index({ entity_type: 1, entity_id: 1, createdAt: -1 });

const RecentActivity = mongoose.model("RecentActivity", recentActivitySchema);

export default RecentActivity;
