import asyncHandler from "../middlewares/asyncHandler.js";
import FanAuditRecord from "../modals/fanAuditRecord.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";

const isAdmin = (user) => user?.role === "admin";

const uploadFanDocuments = async (files = []) => {
  const docs = [];

  if (!Array.isArray(files) || files.length === 0) {
    return docs;
  }

  for (const file of files) {
    if (!file) continue;

    const uploaded = await uploadBufferToCloudinary(file, "fan-audits");

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
  const ratedPower = Number(data.rated_power_W);
  const measuredPower = Number(data.measured_power_W);
  const quantity = Number(data.quantity_nos);
  const hoursPerDay = Number(data.operating_hours_per_day);
  const daysPerYear = Number(data.operating_days_per_year);

  if (
    !Number.isNaN(measuredPower) &&
    !Number.isNaN(ratedPower) &&
    ratedPower > 0
  ) {
    data.loading_factor_percent = (measuredPower / ratedPower) * 100;
  }

  if (!Number.isNaN(measuredPower) && !Number.isNaN(quantity)) {
    data.connected_load_kW = (measuredPower * quantity) / 1000;
  }

  if (
    !Number.isNaN(Number(data.connected_load_kW)) &&
    !Number.isNaN(hoursPerDay) &&
    !Number.isNaN(daysPerYear)
  ) {
    data.annual_energy_consumption_kWh =
      Number(data.connected_load_kW) * hoursPerDay * daysPerYear;
  }

  return data;
};

const createFanAuditRecord = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.body;

  if (!facility_id || !utility_account_id) {
    res.status(400);
    throw new Error("facility_id and utility_account_id are required");
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
    throw new Error("No access to utility account");
  }

  if (utility.facility_id.toString() !== String(facility_id)) {
    res.status(400);
    throw new Error("Utility account does not belong to selected facility");
  }

  let payload = { ...req.body };
  payload = computeValues(payload);

  const docs = await uploadFanDocuments(req.files || []);

  const record = await FanAuditRecord.create({
    ...payload,
    auditor_id: req.user?._id || payload.auditor_id,
    documents: docs,
  });

  await createRecentActivity({
    actor: req.user,
    action: "created",
    entity_type: "fan_audit",
    entity_id: record._id,
    entity_name: record.fan_tag_number || record.fan_name || "Fan Audit",
    facility_id: record.facility_id,
    utility_account_id: record.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "created",
      entityLabel: "fan audit",
      entityName: record.fan_tag_number || record.fan_name || "",
    }),
    meta: {
      rated_power_W: record.rated_power_W,
      measured_power_W: record.measured_power_W,
      quantity_nos: record.quantity_nos,
    },
  });

  res.status(201).json({
    success: true,
    data: record,
  });
});

const getFanAuditRecords = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.query;

  const query = {};
  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;

  let records;

  if (isAdmin(req.user)) {
    records = await FanAuditRecord.find(query)
      .populate("facility_id", "name city")
      .populate("utility_account_id", "account_number")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  } else {
    const allRecords = await FanAuditRecord.find(query);
    const allowedIds = [];

    for (const record of allRecords) {
      const access = await getAccessibleUtilityAccount(
        req.user,
        record.utility_account_id,
      );

      if (access) allowedIds.push(record._id);
    }

    records = await FanAuditRecord.find({ _id: { $in: allowedIds } })
      .populate("facility_id", "name city")
      .populate("utility_account_id", "account_number")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  }

  res.json({
    success: true,
    count: records.length,
    data: records,
  });
});

const getFanAuditRecordById = asyncHandler(async (req, res) => {
  const record = await FanAuditRecord.findById(req.params.id)
    .populate("facility_id", "name city")
    .populate("utility_account_id", "account_number")
    .populate("auditor_id", "name email");

  if (!record) {
    res.status(404);
    throw new Error("Fan audit record not found");
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

const updateFanAuditRecord = asyncHandler(async (req, res) => {
  const record = await FanAuditRecord.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("Fan audit record not found");
  }

  const existingUtilityAccess = await getAccessibleUtilityAccount(
    req.user,
    record.utility_account_id,
  );

  if (!existingUtilityAccess) {
    res.status(403);
    throw new Error("Access denied");
  }

  const nextFacilityId = req.body.facility_id || record.facility_id?.toString();
  const nextUtilityId =
    req.body.utility_account_id || record.utility_account_id?.toString();

  if (!nextFacilityId || !nextUtilityId) {
    res.status(400);
    throw new Error("facility_id and utility_account_id are required");
  }

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
    throw new Error("No access to utility account");
  }

  if (nextUtility.facility_id.toString() !== String(nextFacilityId)) {
    res.status(400);
    throw new Error("Utility account does not belong to selected facility");
  }

  const updatedFields = Object.keys(req.body || {});

  let payload = {
    ...record.toObject(),
    ...req.body,
  };

  payload = computeValues(payload);

  Object.assign(record, payload);

  const docs = await uploadFanDocuments(req.files || []);
  if (docs.length > 0) {
    record.documents.push(...docs);
    updatedFields.push("documents");
  }

  const updated = await record.save();

  await createRecentActivity({
    actor: req.user,
    action: "updated",
    entity_type: "fan_audit",
    entity_id: updated._id,
    entity_name: updated.fan_tag_number || updated.fan_name || "Fan Audit",
    facility_id: updated.facility_id,
    utility_account_id: updated.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "updated",
      entityLabel: "fan audit",
      entityName: updated.fan_tag_number || updated.fan_name || "",
    }),
    meta: {
      updated_fields: [...new Set(updatedFields)],
    },
  });

  res.json({
    success: true,
    data: updated,
  });
});

const deleteFanAuditRecord = asyncHandler(async (req, res) => {
  const record = await FanAuditRecord.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("Fan audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    record.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const entityName = record.fan_tag_number || record.fan_name || "Fan Audit";
  const facilityId = record.facility_id;
  const utilityId = record.utility_account_id;

  await record.deleteOne();

  await createRecentActivity({
    actor: req.user,
    action: "deleted",
    entity_type: "fan_audit",
    entity_id: record._id,
    entity_name: entityName,
    facility_id: facilityId,
    utility_account_id: utilityId,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "deleted",
      entityLabel: "fan audit",
      entityName: entityName,
    }),
  });

  res.json({
    success: true,
    message: "Fan audit record deleted successfully",
  });
});

export {
  createFanAuditRecord,
  getFanAuditRecords,
  getFanAuditRecordById,
  updateFanAuditRecord,
  deleteFanAuditRecord,
};
