import asyncHandler from "../middlewares/asyncHandler.js";
import DGAuditRecord from "../modals/dgAuditRecord.js";
import DGSet from "../modals/dgSet.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload DG audit documents
const uploadDGAuditDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(file, "dg-audit-records");

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

//
// 🚀 CREATE DG AUDIT RECORD
//
const createDGAuditRecord = asyncHandler(async (req, res) => {
  const {
    dg_set_id,
    utility_account_id,
    facility_id,

    measured_voltage_LL,
    measured_current_avg,
    measured_kW_output,
    measured_kVA_output,
    power_factor,
    frequency_Hz,

    max_load_observed_kW,
    min_load_observed_kW,
    average_loading_percent,
    load_factor_percent,

    idle_running_observed,
    parallel_operation,

    annual_fuel_consumption_liters,
    units_generated_per_year_kWh,
    total_working_hours_per_year,
    units_generated_per_hour_kWh,
    fuel_consumption_per_hour_liters,

    fuel_consumption_during_test_lph,
    units_generated_during_test_kWh,

    specific_fuel_consumption_l_per_kWh,
    manufacturer_sfc_l_per_kWh,
    sfc_deviation_percent,

    fuel_cost_rs_per_liter,
    annual_fuel_cost_rs,
    dg_cost_per_kWh_rs,
    grid_cost_per_kWh_rs,

    calculated_efficiency_percent,
    manufacturer_efficiency_percent,
    efficiency_deviation_percent,

    exhaust_temperature_C,
    cooling_water_temperature_C,
    lube_oil_pressure_bar,
    lube_oil_consumption_liters_per_year,

    total_operating_hours,
    hours_since_last_overhaul,

    air_fuel_filter_condition,
    visible_smoke_or_abnormal_vibration,

    audit_date,
    auditor_id,
  } = req.body;

  if (!dg_set_id || !utility_account_id || !facility_id) {
    res.status(400);
    throw new Error(
      "dg_set_id, utility_account_id and facility_id are required",
    );
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

  const dgSet = await DGSet.findById(dg_set_id);

  if (!dgSet) {
    res.status(404);
    throw new Error("DG set not found");
  }

  if (dgSet.utility_account_id.toString() !== utility_account_id.toString()) {
    res.status(400);
    throw new Error("dg_set_id does not belong to the given utility account");
  }

  if (dgSet.facility_id.toString() !== facility_id.toString()) {
    res.status(400);
    throw new Error("dg_set_id does not belong to the given facility");
  }

  const uploadedDocuments = await uploadDGAuditDocuments(req.files);

  const dgAuditRecord = await DGAuditRecord.create({
    dg_set_id,
    utility_account_id,
    facility_id,

    measured_voltage_LL,
    measured_current_avg,
    measured_kW_output,
    measured_kVA_output,
    power_factor,
    frequency_Hz,

    max_load_observed_kW,
    min_load_observed_kW,
    average_loading_percent,
    load_factor_percent,

    idle_running_observed,
    parallel_operation,

    annual_fuel_consumption_liters,
    units_generated_per_year_kWh,
    total_working_hours_per_year,
    units_generated_per_hour_kWh,
    fuel_consumption_per_hour_liters,

    fuel_consumption_during_test_lph,
    units_generated_during_test_kWh,

    specific_fuel_consumption_l_per_kWh,
    manufacturer_sfc_l_per_kWh,
    sfc_deviation_percent,

    fuel_cost_rs_per_liter,
    annual_fuel_cost_rs,
    dg_cost_per_kWh_rs,
    grid_cost_per_kWh_rs,

    calculated_efficiency_percent,
    manufacturer_efficiency_percent,
    efficiency_deviation_percent,

    exhaust_temperature_C,
    cooling_water_temperature_C,
    lube_oil_pressure_bar,
    lube_oil_consumption_liters_per_year,

    total_operating_hours,
    hours_since_last_overhaul,

    air_fuel_filter_condition,
    visible_smoke_or_abnormal_vibration,

    audit_date,
    auditor_id,
    documents: uploadedDocuments,
  });

  res.status(201).json({
    success: true,
    message: "DG audit record created successfully",
    data: dgAuditRecord,
  });
});

//
// 📥 GET ALL DG AUDIT RECORDS
//
const getDGAuditRecords = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id, dg_set_id } = req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;
  if (dg_set_id) query.dg_set_id = dg_set_id;

  let dgAuditRecords;

  if (isAdmin(req.user)) {
    dgAuditRecords = await DGAuditRecord.find(query)
      .populate("facility_id", "name city")
      .populate(
        "utility_account_id",
        "utility_account_id account_number utility_type",
      )
      .populate("dg_set_id", "dg_number make_model rated_capacity_kVA")
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

    dgAuditRecords = await DGAuditRecord.find(userQuery)
      .populate("facility_id", "name city")
      .populate(
        "utility_account_id",
        "utility_account_id account_number utility_type",
      )
      .populate("dg_set_id", "dg_number make_model rated_capacity_kVA")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  }

  res.status(200).json({
    success: true,
    count: dgAuditRecords.length,
    data: dgAuditRecords,
  });
});

//
// 📄 GET SINGLE DG AUDIT RECORD
//
const getDGAuditRecordById = asyncHandler(async (req, res) => {
  const dgAuditRecord = await DGAuditRecord.findById(req.params.id)
    .populate("facility_id", "name city address")
    .populate(
      "utility_account_id",
      "utility_account_id account_number utility_type",
    )
    .populate(
      "dg_set_id",
      "dg_number make_model rated_capacity_kVA rated_active_power_kW",
    )
    .populate("auditor_id", "name email");

  if (!dgAuditRecord) {
    res.status(404);
    throw new Error("DG audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    dgAuditRecord.utility_account_id._id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: dgAuditRecord,
  });
});

//
// ✏️ UPDATE DG AUDIT RECORD
//
const updateDGAuditRecord = asyncHandler(async (req, res) => {
  const dgAuditRecord = await DGAuditRecord.findById(req.params.id);

  if (!dgAuditRecord) {
    res.status(404);
    throw new Error("DG audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    dgAuditRecord.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const targetFacilityId =
    req.body.facility_id || dgAuditRecord.facility_id.toString();

  const targetUtilityAccountId =
    req.body.utility_account_id || dgAuditRecord.utility_account_id.toString();

  const targetDGSetId =
    req.body.dg_set_id || dgAuditRecord.dg_set_id.toString();

  if (req.body.utility_account_id) {
    const newUtility = await getAccessibleUtilityAccount(
      req.user,
      req.body.utility_account_id,
    );

    if (!newUtility) {
      res.status(403);
      throw new Error("Access denied for new utility account");
    }

    if (newUtility.facility_id.toString() !== targetFacilityId.toString()) {
      res.status(400);
      throw new Error(
        "utility_account_id does not belong to the given facility",
      );
    }
  }

  if (
    req.body.dg_set_id ||
    req.body.utility_account_id ||
    req.body.facility_id
  ) {
    const dgSet = await DGSet.findById(targetDGSetId);

    if (!dgSet) {
      res.status(404);
      throw new Error("DG set not found");
    }

    if (
      dgSet.utility_account_id.toString() !== targetUtilityAccountId.toString()
    ) {
      res.status(400);
      throw new Error("dg_set_id does not belong to the given utility account");
    }

    if (dgSet.facility_id.toString() !== targetFacilityId.toString()) {
      res.status(400);
      throw new Error("dg_set_id does not belong to the given facility");
    }
  }

  const uploadedDocuments = await uploadDGAuditDocuments(req.files);

  Object.keys(req.body).forEach((key) => {
    dgAuditRecord[key] = req.body[key] ?? dgAuditRecord[key];
  });

  if (uploadedDocuments.length > 0) {
    dgAuditRecord.documents = [
      ...(dgAuditRecord.documents || []),
      ...uploadedDocuments,
    ];
  }

  const updated = await dgAuditRecord.save();

  res.status(200).json({
    success: true,
    message: "DG audit record updated successfully",
    data: updated,
  });
});

//
// ❌ DELETE DG AUDIT RECORD
//
const deleteDGAuditRecord = asyncHandler(async (req, res) => {
  const dgAuditRecord = await DGAuditRecord.findById(req.params.id);

  if (!dgAuditRecord) {
    res.status(404);
    throw new Error("DG audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    dgAuditRecord.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  await dgAuditRecord.deleteOne();

  res.status(200).json({
    success: true,
    message: "DG audit record deleted successfully",
  });
});

export {
  createDGAuditRecord,
  getDGAuditRecords,
  getDGAuditRecordById,
  updateDGAuditRecord,
  deleteDGAuditRecord,
};
