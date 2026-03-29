import asyncHandler from "../middlewares/asyncHandler.js";
import MiscLoadAuditRecord from "../modals/miscLoadAuditRecord.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload documents
const uploadMiscLoadDocuments = async (files = []) => {
  const docs = [];

  for (const file of files || []) {
    const uploaded = await uploadBufferToCloudinary(file, "misc-load-audits");

    docs.push({
      fileUrl: uploaded.secure_url,
      fileType: file.mimetype === "application/pdf" ? "pdf" : "image",
      fileName: file.originalname,
    });
  }

  return docs;
};

// 🔍 Check facility access
const getAccessibleFacility = async (user, facilityId) => {
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

// 🔍 Check utility access
const getAccessibleUtilityAccount = async (user, utilityId) => {
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

// ✅ Auto calculation
const computeValues = (data) => {
  const quantity = Number(data.quantity) || 0;
  const ratedPower = Number(data.rated_power_kW) || 0;
  const avgHours = Number(data.average_operating_hours_per_day) || 0;
  const operatingDays = Number(data.operating_days_per_year) || 0;
  const loadFactorPercent = Number(data.load_factor_percent);

  const loadFactor =
    !Number.isNaN(loadFactorPercent) && loadFactorPercent >= 0
      ? loadFactorPercent / 100
      : 1;

  data.estimated_annual_energy_kWh =
    quantity * ratedPower * avgHours * operatingDays * loadFactor;

  return data;
};

//
// 🚀 CREATE
//
const createMiscLoadAuditRecord = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.body;

  if (!facility_id || !utility_account_id) {
    res.status(400);
    throw new Error("facility_id & utility_account_id required");
  }

  // 🔒 Facility access
  const facility = await getAccessibleFacility(req.user, facility_id);
  if (!facility) {
    res.status(403);
    throw new Error("No access to facility");
  }

  // 🔒 Utility access
  const utility = await getAccessibleUtilityAccount(
    req.user,
    utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("No access to utility");
  }

  // ⚠️ Utility must belong to selected facility
  if (utility.facility_id.toString() !== facility_id) {
    res.status(400);
    throw new Error("Utility does not belong to selected facility");
  }

  let payload = { ...req.body };
  payload = computeValues(payload);

  const docs = await uploadMiscLoadDocuments(req.files || []);

  const record = await MiscLoadAuditRecord.create({
    ...payload,
    auditor_id: req.user?._id || req.body.auditor_id,
    documents: docs,
  });

  await createRecentActivity({
    actor: req.user,
    action: "created",
    entity_type: "misc_load",
    entity_id: record._id,
    entity_name: record.equipment_name || record.category || "Misc Load Audit",
    facility_id: record.facility_id,
    utility_account_id: record.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "created",
      entityLabel: "misc load audit",
      entityName: record.equipment_name || record.category || "",
    }),
    meta: {
      category: record.category,
      quantity: record.quantity,
      rated_power_kW: record.rated_power_kW,
      estimated_annual_energy_kWh: record.estimated_annual_energy_kWh,
    },
  });

  res.status(201).json({
    success: true,
    data: record,
  });
});

//
// 📥 GET ALL
//
const getMiscLoadAuditRecords = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id, category } = req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;
  if (category) query.category = category;

  let records;

  if (isAdmin(req.user)) {
    records = await MiscLoadAuditRecord.find(query)
      .populate("facility_id", "name city")
      .populate("utility_account_id", "account_number")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  } else {
    const allowed = [];
    const all = await MiscLoadAuditRecord.find();

    for (const rec of all) {
      const access = await getAccessibleUtilityAccount(
        req.user,
        rec.utility_account_id,
      );

      if (access) allowed.push(rec._id);
    }

    records = await MiscLoadAuditRecord.find({
      _id: { $in: allowed },
      ...query,
    })
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

//
// 📄 GET SINGLE
//
const getMiscLoadAuditRecordById = asyncHandler(async (req, res) => {
  const record = await MiscLoadAuditRecord.findById(req.params.id)
    .populate("facility_id", "name city")
    .populate("utility_account_id", "account_number")
    .populate("auditor_id", "name email");

  if (!record) {
    res.status(404);
    throw new Error("Misc load audit record not found");
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

//
// ✏️ UPDATE
//
const updateMiscLoadAuditRecord = asyncHandler(async (req, res) => {
  const record = await MiscLoadAuditRecord.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("Misc load audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    record.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  // If utility_account_id is being changed
  if (req.body.utility_account_id) {
    const newUtility = await getAccessibleUtilityAccount(
      req.user,
      req.body.utility_account_id,
    );

    if (!newUtility) {
      res.status(403);
      throw new Error("No access to new utility");
    }

    const facilityIdToCheck =
      req.body.facility_id || record.facility_id.toString();

    if (newUtility.facility_id.toString() !== facilityIdToCheck) {
      res.status(400);
      throw new Error("Utility does not belong to selected facility");
    }
  }

  // If facility_id is being changed
  if (req.body.facility_id) {
    const newFacility = await getAccessibleFacility(
      req.user,
      req.body.facility_id,
    );

    if (!newFacility) {
      res.status(403);
      throw new Error("No access to new facility");
    }

    const utilityIdToCheck =
      req.body.utility_account_id || record.utility_account_id.toString();

    const utilityToCheck = await UtilityAccount.findById(utilityIdToCheck);

    if (!utilityToCheck) {
      res.status(404);
      throw new Error("Utility not found");
    }

    if (utilityToCheck.facility_id.toString() !== req.body.facility_id) {
      res.status(400);
      throw new Error("Utility does not belong to selected facility");
    }
  }

  const updatedFields = Object.keys(req.body || {});

  let payload = { ...record.toObject(), ...req.body };
  payload = computeValues(payload);

  Object.assign(record, payload);

  const docs = await uploadMiscLoadDocuments(req.files || []);

  if (docs.length > 0) {
    record.documents.push(...docs);
    updatedFields.push("documents");
  }

  const updated = await record.save();

  await createRecentActivity({
    actor: req.user,
    action: "updated",
    entity_type: "misc_load",
    entity_id: updated._id,
    entity_name:
      updated.equipment_name || updated.category || "Misc Load Audit",
    facility_id: updated.facility_id,
    utility_account_id: updated.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "updated",
      entityLabel: "misc load audit",
      entityName: updated.equipment_name || updated.category || "",
    }),
    meta: {
      updated_fields: [...new Set(updatedFields)],
      estimated_annual_energy_kWh: updated.estimated_annual_energy_kWh,
    },
  });

  res.json({
    success: true,
    data: updated,
  });
});

//
// ❌ DELETE
//
const deleteMiscLoadAuditRecord = asyncHandler(async (req, res) => {
  const record = await MiscLoadAuditRecord.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("Misc load audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    record.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const entityName =
    record.equipment_name || record.category || "Misc Load Audit";
  const facilityId = record.facility_id;
  const utilityId = record.utility_account_id;

  await record.deleteOne();

  await createRecentActivity({
    actor: req.user,
    action: "deleted",
    entity_type: "misc_load",
    entity_id: record._id,
    entity_name: entityName,
    facility_id: facilityId,
    utility_account_id: utilityId,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "deleted",
      entityLabel: "misc load audit",
      entityName,
    }),
  });

  res.json({
    success: true,
    message: "Misc load audit record deleted successfully",
  });
});

export {
  createMiscLoadAuditRecord,
  getMiscLoadAuditRecords,
  getMiscLoadAuditRecordById,
  updateMiscLoadAuditRecord,
  deleteMiscLoadAuditRecord,
};
