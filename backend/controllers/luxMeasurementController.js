import asyncHandler from "../middlewares/asyncHandler.js";
import LuxMeasurement from "../modals/luxMeasurement.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload documents
const uploadLuxDocuments = async (files = []) => {
  const docs = [];

  for (const file of files || []) {
    const uploaded = await uploadBufferToCloudinary(file, "lux-measurements");

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
  const p1 = Number(data.measured_lux_point_1);
  const p2 = Number(data.measured_lux_point_2);
  const p3 = Number(data.measured_lux_point_3);
  const requiredLux = Number(data.required_lux);

  const validPoints = [p1, p2, p3].filter((value) => !Number.isNaN(value));

  if (validPoints.length > 0) {
    data.average_lux =
      validPoints.reduce((sum, value) => sum + value, 0) / validPoints.length;
  }

  if (!Number.isNaN(requiredLux) && !Number.isNaN(Number(data.average_lux))) {
    data.compliance = Number(data.average_lux) >= requiredLux;
  }

  return data;
};

//
// 🚀 CREATE
//
const createLuxMeasurement = asyncHandler(async (req, res) => {
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

  const docs = await uploadLuxDocuments(req.files || []);

  const record = await LuxMeasurement.create({
    ...payload,
    auditor_id: req.user?._id || req.body.auditor_id,
    documents: docs,
  });

  await createRecentActivity({
    actor: req.user,
    action: "created",
    entity_type: "lux_measurement",
    entity_id: record._id,
    entity_name:
      record.area_location || record.task_description || "Lux Measurement",
    facility_id: record.facility_id,
    utility_account_id: record.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "created",
      entityLabel: "lux measurement",
      entityName: record.area_location || record.task_description || "",
    }),
    meta: {
      required_lux: record.required_lux,
      average_lux: record.average_lux,
      compliance: record.compliance,
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
const getLuxMeasurements = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;

  let records;

  if (isAdmin(req.user)) {
    records = await LuxMeasurement.find(query)
      .populate("facility_id", "name city")
      .populate("utility_account_id", "account_number")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  } else {
    const allowed = [];

    const all = await LuxMeasurement.find();

    for (const rec of all) {
      const access = await getAccessibleUtilityAccount(
        req.user,
        rec.utility_account_id,
      );

      if (access) allowed.push(rec._id);
    }

    records = await LuxMeasurement.find({
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
const getLuxMeasurementById = asyncHandler(async (req, res) => {
  const record = await LuxMeasurement.findById(req.params.id)
    .populate("facility_id", "name city")
    .populate("utility_account_id", "account_number")
    .populate("auditor_id", "name email");

  if (!record) {
    res.status(404);
    throw new Error("Lux measurement not found");
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
const updateLuxMeasurement = asyncHandler(async (req, res) => {
  const record = await LuxMeasurement.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("Lux measurement not found");
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

  const docs = await uploadLuxDocuments(req.files || []);

  if (docs.length > 0) {
    record.documents.push(...docs);
    updatedFields.push("documents");
  }

  const updated = await record.save();

  await createRecentActivity({
    actor: req.user,
    action: "updated",
    entity_type: "lux_measurement",
    entity_id: updated._id,
    entity_name:
      updated.area_location || updated.task_description || "Lux Measurement",
    facility_id: updated.facility_id,
    utility_account_id: updated.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "updated",
      entityLabel: "lux measurement",
      entityName: updated.area_location || updated.task_description || "",
    }),
    meta: {
      updated_fields: [...new Set(updatedFields)],
      average_lux: updated.average_lux,
      compliance: updated.compliance,
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
const deleteLuxMeasurement = asyncHandler(async (req, res) => {
  const record = await LuxMeasurement.findById(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error("Lux measurement not found");
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
    record.area_location || record.task_description || "Lux Measurement";
  const facilityId = record.facility_id;
  const utilityId = record.utility_account_id;

  await record.deleteOne();

  await createRecentActivity({
    actor: req.user,
    action: "deleted",
    entity_type: "lux_measurement",
    entity_id: record._id,
    entity_name: entityName,
    facility_id: facilityId,
    utility_account_id: utilityId,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "deleted",
      entityLabel: "lux measurement",
      entityName,
    }),
  });

  res.json({
    success: true,
    message: "Lux measurement deleted successfully",
  });
});

export {
  createLuxMeasurement,
  getLuxMeasurements,
  getLuxMeasurementById,
  updateLuxMeasurement,
  deleteLuxMeasurement,
};
