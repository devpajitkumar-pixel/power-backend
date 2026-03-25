import asyncHandler from "../middlewares/asyncHandler.js";
import PumpAuditRecord from "../modals/pumpAuditRecord.js";
import Pump from "../modals/pump.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload audit documents
const uploadPumpAuditDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(
        file,
        "pump-audit-records",
      );

      uploadedDocuments.push({
        fileUrl: uploaded.secure_url,
        fileType: file.mimetype === "application/pdf" ? "pdf" : "image",
        fileName: file.originalname,
      });
    }
  }

  return uploadedDocuments;
};

// 🔍 Check access to utility account
const getAccessibleUtilityAccount = async (user, utilityAccountId) => {
  const utility = await UtilityAccount.findById(utilityAccountId);

  if (!utility) return null;

  if (isAdmin(user)) return utility;

  const facility = await Facility.findById(utility.facility_id);

  if (!facility) return null;

  const isAssignedAuditor = await FacilityAuditor.exists({
    facility_id: facility._id,
    user_id: user._id,
  });

  if (
    facility.owner_user_id.toString() === user._id.toString() ||
    isAssignedAuditor
  ) {
    return utility;
  }

  return null;
};

// 🔍 Check access to pump
const getAccessiblePump = async (user, pumpId) => {
  const pump = await Pump.findById(pumpId);

  if (!pump) return null;

  const utility = await getAccessibleUtilityAccount(
    user,
    pump.utility_account_id,
  );

  if (!utility) return null;

  return pump;
};

//
// 🚀 CREATE PUMP AUDIT RECORD
//
const createPumpAuditRecord = asyncHandler(async (req, res) => {
  const {
    pump_id,
    utility_account_id,
    facility_id,
    suction_head_m,
    discharge_static_head_m,
    delivery_pipe_diameter_inches,
    tank_or_sump_capacity,
    time_to_fill_tank_minutes,
    actual_flow_m3_per_hr,
    voltage_V,
    current_A,
    power_factor,
    input_power_kW,
    operating_hours_per_day,
    daily_energy_consumption_kWh,
    total_dynamic_head_m,
    hydraulic_output_power_kW,
    overall_pump_set_efficiency_percent,
    motor_loading_percent,
    specific_energy_consumption_kWh_per_m3,
    annual_energy_consumption_kWh,
    control_valve_throttling,
    vfd_installed,
    pump_condition,
    leakages_observed,
    recommendations,
    audit_date,
    auditor_id,
  } = req.body;

  if (!pump_id || !utility_account_id || !facility_id) {
    res.status(400);
    throw new Error("pump_id, utility_account_id and facility_id are required");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  if (utility.facility_id.toString() !== facility_id.toString()) {
    res.status(400);
    throw new Error("utility_account_id does not belong to the given facility");
  }

  const pump = await getAccessiblePump(req.user, pump_id);

  if (!pump) {
    res.status(404);
    throw new Error("Pump not found or access denied");
  }

  if (pump.utility_account_id.toString() !== utility_account_id.toString()) {
    res.status(400);
    throw new Error("pump_id does not belong to the given utility_account_id");
  }

  if (pump.facility_id.toString() !== facility_id.toString()) {
    res.status(400);
    throw new Error("pump_id does not belong to the given facility_id");
  }

  const uploadedDocuments = await uploadPumpAuditDocuments(req.files);

  const pumpAuditRecord = await PumpAuditRecord.create({
    pump_id,
    utility_account_id,
    facility_id,
    suction_head_m,
    discharge_static_head_m,
    delivery_pipe_diameter_inches,
    tank_or_sump_capacity,
    time_to_fill_tank_minutes,
    actual_flow_m3_per_hr,
    voltage_V,
    current_A,
    power_factor,
    input_power_kW,
    operating_hours_per_day,
    daily_energy_consumption_kWh,
    total_dynamic_head_m,
    hydraulic_output_power_kW,
    overall_pump_set_efficiency_percent,
    motor_loading_percent,
    specific_energy_consumption_kWh_per_m3,
    annual_energy_consumption_kWh,
    control_valve_throttling,
    vfd_installed,
    pump_condition,
    leakages_observed,
    recommendations,
    documents: uploadedDocuments,
    audit_date,
    auditor_id,
  });

  res.status(201).json({
    success: true,
    message: "Pump audit record created successfully",
    data: pumpAuditRecord,
  });
});

//
// 📥 GET ALL PUMP AUDIT RECORDS
//
const getPumpAuditRecords = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id, pump_id } = req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;
  if (pump_id) query.pump_id = pump_id;

  let records;

  if (isAdmin(req.user)) {
    records = await PumpAuditRecord.find(query)
      .populate("facility_id", "name city")
      .populate(
        "utility_account_id",
        "utility_account_id account_number connection_type category",
      )
      .populate("pump_id", "pump_tag_number make_model rated_power_kW_or_HP")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  } else {
    const utilities = await UtilityAccount.find();
    const allowedUtilityIds = [];

    for (const utility of utilities) {
      const access = await getAccessibleUtilityAccount(req.user, utility._id);
      if (access) allowedUtilityIds.push(utility._id);
    }

    const userQuery = {
      ...query,
      utility_account_id: query.utility_account_id
        ? query.utility_account_id
        : { $in: allowedUtilityIds },
    };

    if (
      query.utility_account_id &&
      !allowedUtilityIds.some(
        (id) => id.toString() === query.utility_account_id.toString(),
      )
    ) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    records = await PumpAuditRecord.find(userQuery)
      .populate("facility_id", "name city")
      .populate(
        "utility_account_id",
        "utility_account_id account_number connection_type category",
      )
      .populate("pump_id", "pump_tag_number make_model rated_power_kW_or_HP")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  }

  res.status(200).json({
    success: true,
    count: records.length,
    data: records,
  });
});

//
// 📄 GET SINGLE PUMP AUDIT RECORD
//
const getPumpAuditRecordById = asyncHandler(async (req, res) => {
  const record = await PumpAuditRecord.findById(req.params.id)
    .populate("facility_id", "name city address")
    .populate(
      "utility_account_id",
      "utility_account_id account_number connection_type category",
    )
    .populate(
      "pump_id",
      "pump_tag_number make_model rated_power_kW_or_HP rated_flow_m3_per_hr rated_head_m",
    )
    .populate("auditor_id", "name email");

  if (!record) {
    res.status(404);
    throw new Error("Pump audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    record.utility_account_id._id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: record,
  });
});

//
// ✏️ UPDATE PUMP AUDIT RECORD
//
const updatePumpAuditRecord = asyncHandler(async (req, res) => {
  const record = await PumpAuditRecord.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("Pump audit record not found");
  }

  const currentUtility = await getAccessibleUtilityAccount(
    req.user,
    record.utility_account_id,
  );

  if (!currentUtility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const targetFacilityId =
    req.body.facility_id || record.facility_id.toString();
  const targetUtilityId =
    req.body.utility_account_id || record.utility_account_id.toString();
  const targetPumpId = req.body.pump_id || record.pump_id.toString();

  const newUtility = await getAccessibleUtilityAccount(
    req.user,
    targetUtilityId,
  );

  if (!newUtility) {
    res.status(403);
    throw new Error("Access denied for selected utility account");
  }

  if (newUtility.facility_id.toString() !== targetFacilityId.toString()) {
    res.status(400);
    throw new Error("utility_account_id does not belong to the given facility");
  }

  const newPump = await getAccessiblePump(req.user, targetPumpId);

  if (!newPump) {
    res.status(404);
    throw new Error("Pump not found or access denied");
  }

  if (newPump.utility_account_id.toString() !== targetUtilityId.toString()) {
    res.status(400);
    throw new Error("pump_id does not belong to the given utility_account_id");
  }

  if (newPump.facility_id.toString() !== targetFacilityId.toString()) {
    res.status(400);
    throw new Error("pump_id does not belong to the given facility_id");
  }

  const uploadedDocuments = await uploadPumpAuditDocuments(req.files);

  Object.keys(req.body).forEach((key) => {
    record[key] = req.body[key] ?? record[key];
  });

  if (uploadedDocuments.length > 0) {
    record.documents = [...(record.documents || []), ...uploadedDocuments];
  }

  const updatedRecord = await record.save();

  res.status(200).json({
    success: true,
    message: "Pump audit record updated successfully",
    data: updatedRecord,
  });
});

//
// ❌ DELETE PUMP AUDIT RECORD
//
const deletePumpAuditRecord = asyncHandler(async (req, res) => {
  const record = await PumpAuditRecord.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("Pump audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    record.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  await record.deleteOne();

  res.status(200).json({
    success: true,
    message: "Pump audit record deleted successfully",
  });
});

export {
  createPumpAuditRecord,
  getPumpAuditRecords,
  getPumpAuditRecordById,
  updatePumpAuditRecord,
  deletePumpAuditRecord,
};
