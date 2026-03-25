import asyncHandler from "../middlewares/asyncHandler.js";
import LightingAuditRecord from "../modals/lightingAuditRecord.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload documents
const uploadLightingDocuments = async (files = []) => {
  const docs = [];

  for (const file of files || []) {
    const uploaded = await uploadBufferToCloudinary(file, "lighting-audits");

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
  const wattage = Number(data.wattage_W);
  const qty = Number(data.quantity_nos);
  const hours = Number(data.working_hours_per_day);
  const days = Number(data.working_days_per_year);

  if (!isNaN(wattage) && !isNaN(qty)) {
    data.connected_load_kW = (wattage * qty) / 1000;
  }

  if (!isNaN(wattage) && !isNaN(qty) && !isNaN(hours) && !isNaN(days)) {
    data.annual_energy_kWh = ((wattage * qty) / 1000) * hours * days;
  }

  return data;
};

//
// 🚀 CREATE
//
const createLightingAuditRecord = asyncHandler(async (req, res) => {
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

  // ⚠️ IMPORTANT VALIDATION
  if (utility.facility_id.toString() !== facility_id) {
    res.status(400);
    throw new Error("Utility does not belong to selected facility");
  }

  let payload = { ...req.body };
  payload = computeValues(payload);

  const docs = await uploadLightingDocuments(req.files || []);

  const record = await LightingAuditRecord.create({
    ...payload,
    documents: docs,
  });

  res.status(201).json({
    success: true,
    data: record,
  });
});

//
// 📥 GET ALL
//
const getLightingAuditRecords = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.query;

  let query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;

  let records;

  if (isAdmin(req.user)) {
    records = await LightingAuditRecord.find(query)
      .populate("facility_id", "name city")
      .populate("utility_account_id", "account_number")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  } else {
    const allowed = [];

    const all = await LightingAuditRecord.find();

    for (const rec of all) {
      const access = await getAccessibleUtilityAccount(
        req.user,
        rec.utility_account_id,
      );

      if (access) allowed.push(rec._id);
    }

    records = await LightingAuditRecord.find({
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
const getLightingAuditRecordById = asyncHandler(async (req, res) => {
  const record = await LightingAuditRecord.findById(req.params.id)
    .populate("facility_id", "name city")
    .populate("utility_account_id", "account_number")
    .populate("auditor_id", "name email");

  if (!record) {
    res.status(404);
    throw new Error("Not found");
  }

  const access = await getAccessibleUtilityAccount(
    req.user,
    record.utility_account_id,
  );

  if (!access) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.json({ success: true, data: record });
});

//
// ✏️ UPDATE
//
const updateLightingAuditRecord = asyncHandler(async (req, res) => {
  const record = await LightingAuditRecord.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("Not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    record.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  let payload = { ...record.toObject(), ...req.body };
  payload = computeValues(payload);

  Object.assign(record, payload);

  const docs = await uploadLightingDocuments(req.files || []);

  if (docs.length > 0) {
    record.documents.push(...docs);
  }

  const updated = await record.save();

  res.json({
    success: true,
    data: updated,
  });
});

//
// ❌ DELETE
//
const deleteLightingAuditRecord = asyncHandler(async (req, res) => {
  const record = await LightingAuditRecord.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("Not found");
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

  res.json({
    success: true,
    message: "Deleted successfully",
  });
});

export {
  createLightingAuditRecord,
  getLightingAuditRecords,
  getLightingAuditRecordById,
  updateLightingAuditRecord,
  deleteLightingAuditRecord,
};
