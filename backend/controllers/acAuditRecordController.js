import asyncHandler from "../middlewares/asyncHandler.js";
import ACAuditRecord from "../modals/acAuditRecord.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";

const isAdmin = (user) => user?.role === "admin";

const uploadACDocuments = async (files = []) => {
  const docs = [];

  if (!Array.isArray(files) || files.length === 0) {
    return docs;
  }

  for (const file of files) {
    if (!file) continue;

    const uploaded = await uploadBufferToCloudinary(file, "ac-audits");

    docs.push({
      fileUrl: uploaded.secure_url,
      fileType: file.mimetype === "application/pdf" ? "pdf" : "image",
      fileName: file.originalname,
    });
  }

  return docs;
};

const getAccessibleFacility = async (user, facilityId) => {
  if (!user?._id) return null;

  const facility = await Facility.findById(facilityId);
  if (!facility) return null;

  if (isAdmin(user)) return facility;

  const assigned = await FacilityAuditor.exists({
    facility_id: facilityId,
    user_id: user._id,
  });

  if (facility.owner_user_id.toString() === user._id.toString() || assigned) {
    return facility;
  }

  return null;
};

const getAccessibleUtilityAccount = async (user, utilityId) => {
  if (!user?._id) return null;

  const utility = await UtilityAccount.findById(utilityId);
  if (!utility) return null;

  if (isAdmin(user)) return utility;

  const facility = await Facility.findById(utility.facility_id);
  if (!facility) return null;

  const assigned = await FacilityAuditor.exists({
    facility_id: facility._id,
    user_id: user._id,
  });

  if (facility.owner_user_id.toString() === user._id.toString() || assigned) {
    return utility;
  }

  return null;
};

const computeValues = (data) => {
  const returnAir = Number(data.return_air_temp_C);
  const supplyAir = Number(data.supply_air_temp_C);
  const measuredPower = Number(data.measured_power_kW);
  const quantity = Number(data.quantity_nos);
  const hoursPerDay = Number(data.operating_hours_per_day);
  const daysPerYear = Number(data.operating_days_per_year);
  const coolingTR = Number(data.cooling_capacity_TR);
  const ratedPower = Number(data.rated_input_power_kW);
  const yearOfInstallation = Number(data.year_of_installation);
  const currentYear = new Date().getFullYear();

  if (!Number.isNaN(returnAir) && !Number.isNaN(supplyAir)) {
    data.airside_delta_T = returnAir - supplyAir;
  }

  if (!Number.isNaN(measuredPower) && !Number.isNaN(quantity)) {
    data.connected_load_kW = measuredPower * quantity;
  }

  if (
    !Number.isNaN(Number(data.connected_load_kW)) &&
    !Number.isNaN(hoursPerDay) &&
    !Number.isNaN(daysPerYear)
  ) {
    data.annual_energy_consumption_kWh =
      Number(data.connected_load_kW) * hoursPerDay * daysPerYear;
  }

  if (
    !Number.isNaN(measuredPower) &&
    !Number.isNaN(coolingTR) &&
    coolingTR > 0
  ) {
    data.specific_power_kW_per_TR = measuredPower / coolingTR;
  }

  if (!Number.isNaN(yearOfInstallation) && yearOfInstallation > 0) {
    data.age_years = currentYear - yearOfInstallation;
  }

  if (
    !Number.isNaN(measuredPower) &&
    !Number.isNaN(ratedPower) &&
    ratedPower > 0
  ) {
    data.loading_factor_percent = (measuredPower / ratedPower) * 100;
  }

  return data;
};

const createACAuditRecord = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.body;

  if (!facility_id || !utility_account_id) {
    res.status(400);
    throw new Error("facility_id & utility_account_id required");
  }

  const facility = await getAccessibleFacility(req.user, facility_id);
  if (!facility) {
    res.status(403);
    throw new Error("No access to facility");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    utility_account_id,
  );
  if (!utility) {
    res.status(403);
    throw new Error("No access to utility");
  }

  if (utility.facility_id.toString() !== String(facility_id)) {
    res.status(400);
    throw new Error("Utility does not belong to selected facility");
  }

  let payload = { ...req.body };
  payload = computeValues(payload);

  const docs = await uploadACDocuments(req.files || []);

  const record = await ACAuditRecord.create({
    ...payload,
    auditor_id: req.user?._id || payload.auditor_id,
    documents: docs,
  });

  // ✅ Recent Activity
  await createRecentActivity({
    actor: req.user,
    action: "created",
    entity_type: "ac_audit",
    entity_id: record._id,
    entity_name: record.equipment_name || "AC Audit",
    facility_id: record.facility_id,
    utility_account_id: record.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "created",
      entityLabel: "AC audit",
      entityName: record.equipment_name || "",
    }),
    meta: {
      cooling_capacity_TR: record.cooling_capacity_TR,
      measured_power_kW: record.measured_power_kW,
    },
  });

  res.status(201).json({
    success: true,
    data: record,
  });
});

const getACAuditRecords = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.query;

  const query = {};
  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;

  let records;

  if (isAdmin(req.user)) {
    records = await ACAuditRecord.find(query)
      .populate("facility_id", "name city")
      .populate("utility_account_id", "account_number")
      .populate("auditor_id", "name email")
      .sort({ createdAt: -1 });
  } else {
    const all = await ACAuditRecord.find(query);
    const allowed = [];

    for (const rec of all) {
      const access = await getAccessibleUtilityAccount(
        req.user,
        rec.utility_account_id,
      );

      if (access) allowed.push(rec._id);
    }

    records = await ACAuditRecord.find({ _id: { $in: allowed } })
      .populate("facility_id", "name city")
      .populate("utility_account_id", "account_number")
      .populate("auditor_id", "name email")
      .sort({ createdAt: -1 });
  }

  res.json({
    success: true,
    count: records.length,
    data: records,
  });
});

const getACAuditRecordById = asyncHandler(async (req, res) => {
  const record = await ACAuditRecord.findById(req.params.id)
    .populate("facility_id", "name city")
    .populate("utility_account_id", "account_number")
    .populate("auditor_id", "name email");

  if (!record) {
    res.status(404);
    throw new Error("AC audit record not found");
  }

  const access = await getAccessibleUtilityAccount(
    req.user,
    record.utility_account_id,
  );

  if (!access) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.json({
    success: true,
    data: record,
  });
});

const updateACAuditRecord = asyncHandler(async (req, res) => {
  const record = await ACAuditRecord.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("AC audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    record.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const nextFacilityId = req.body.facility_id || record.facility_id.toString();
  const nextUtilityId =
    req.body.utility_account_id || record.utility_account_id.toString();

  const facility = await getAccessibleFacility(req.user, nextFacilityId);
  if (!facility) {
    res.status(403);
    throw new Error("No access to facility");
  }

  const nextUtility = await getAccessibleUtilityAccount(
    req.user,
    nextUtilityId,
  );
  if (!nextUtility) {
    res.status(403);
    throw new Error("No access to utility");
  }

  if (nextUtility.facility_id.toString() !== String(nextFacilityId)) {
    res.status(400);
    throw new Error("Utility does not belong to selected facility");
  }

  let payload = {
    ...record.toObject(),
    ...req.body,
  };

  payload = computeValues(payload);

  Object.assign(record, payload);

  const docs = await uploadACDocuments(req.files || []);
  if (docs.length > 0) {
    record.documents.push(...docs);
  }

  const updated = await record.save();
  // ✅ Recent Activity
  await createRecentActivity({
    actor: req.user,
    action: "updated",
    entity_type: "ac_audit",
    entity_id: updated._id,
    entity_name: updated.equipment_name || "AC Audit",
    facility_id: updated.facility_id,
    utility_account_id: updated.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "updated",
      entityLabel: "AC audit",
      entityName: updated.equipment_name || "",
    }),
    meta: {
      updated_fields: Object.keys(req.body || {}),
    },
  });

  res.json({
    success: true,
    data: updated,
  });
});

const deleteACAuditRecord = asyncHandler(async (req, res) => {
  const record = await ACAuditRecord.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("AC audit record not found");
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
  // ✅ Recent Activity
  await createRecentActivity({
    actor: req.user,
    action: "deleted",
    entity_type: "ac_audit",
    entity_id: record._id,
    entity_name: name,
    facility_id: facilityId,
    utility_account_id: utilityId,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "deleted",
      entityLabel: "AC audit",
      entityName: name,
    }),
  });

  res.json({
    success: true,
    message: "AC audit record deleted successfully",
  });
});

export {
  createACAuditRecord,
  getACAuditRecords,
  getACAuditRecordById,
  updateACAuditRecord,
  deleteACAuditRecord,
};
