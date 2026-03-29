import asyncHandler from "../middlewares/asyncHandler.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import UtilityAccount from "../modals/utilityAccount.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";

// helper: admin check
const isAdmin = (user) => user?.role === "admin";

// helper: upload documents
const uploadUtilityDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(file, "utility-accounts");

      uploadedDocuments.push({
        fileUrl: uploaded.secure_url,
        fileType: file.mimetype === "application/pdf" ? "pdf" : "image",
        fileName: file.originalname,
      });
    }
  }

  return uploadedDocuments;
};

// helper: parse booleans safely
const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "")
    return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return Boolean(value);
};

// helper: check user access to facility
const getAccessibleFacility = async (user, facilityId) => {
  if (isAdmin(user)) {
    return await Facility.findById(facilityId);
  }

  const isAssignedAuditor = await FacilityAuditor.exists({
    facility_id: facilityId,
    user_id: user._id,
  });

  return await Facility.findOne({
    _id: facilityId,
    $or: [{ owner_user_id: user._id }, ...(isAssignedAuditor ? [{}] : [])],
  });
};

// @route POST
const createUtilityAccount = asyncHandler(async (req, res) => {
  const {
    facility_id,
    account_number,
    connection_type,
    category,
    sanctioned_demand_kVA,
    provider,
    billing_cycle,
    audit_date,
    auditor_id,
    is_solar_connected,
    is_dg_connected,
    is_transformer_connected,
    is_pump_connected,
    is_transformer_maintained_by_facility,
    is_active,
  } = req.body;

  if (!facility_id || !account_number || !connection_type) {
    res.status(400);
    throw new Error(
      "facility_id, account_number and connection_type are required",
    );
  }

  const facility = await getAccessibleFacility(req.user, facility_id);

  if (!facility) {
    res.status(404);
    throw new Error("Facility not found or access denied");
  }

  const existingUtilityAccount = await UtilityAccount.findOne({
    facility_id,
    account_number: account_number.trim(),
  });

  if (existingUtilityAccount) {
    res.status(400);
    throw new Error("Utility account already exists for this facility");
  }

  const uploadedDocuments = await uploadUtilityDocuments(req.files);

  const utilityAccount = await UtilityAccount.create({
    facility_id,
    account_number: account_number.trim(),
    connection_type,
    category,
    sanctioned_demand_kVA:
      sanctioned_demand_kVA !== undefined && sanctioned_demand_kVA !== ""
        ? Number(sanctioned_demand_kVA)
        : undefined,
    provider,
    billing_cycle,
    audit_date: audit_date || undefined,
    auditor_id: auditor_id || undefined,
    is_solar_connected: parseBoolean(is_solar_connected, false),
    is_dg_connected: parseBoolean(is_dg_connected, false),
    is_transformer_connected: parseBoolean(is_transformer_connected, false),
    is_pump_connected: parseBoolean(is_pump_connected, false),
    is_transformer_maintained_by_facility: parseBoolean(
      is_transformer_maintained_by_facility,
      false,
    ),
    is_active: parseBoolean(is_active, true),
    documents: uploadedDocuments,
  });

  // ✅ ACTIVITY
  await createRecentActivity({
    actor: req.user,
    action: "created",
    entity_type: "utility_account",
    entity_id: utilityAccount._id,
    entity_name: utilityAccount.account_number,
    facility_id: utilityAccount.facility_id,
    utility_account_id: utilityAccount._id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "created",
      entityLabel: "utility account",
      entityName: utilityAccount.account_number,
    }),
    meta: {
      connection_type: utilityAccount.connection_type,
      provider: utilityAccount.provider,
    },
  });

  res.status(201).json({
    success: true,
    message: "Utility account created successfully",
    data: utilityAccount,
  });
});

// GET ALL (unchanged)
const getUtilityAccounts = asyncHandler(async (req, res) => {
  const { facility_id } = req.query;

  let utilities = [];
  console.log(facility_id);

  if (isAdmin(req.user)) {
    const query = facility_id ? { facility_id } : {};
    utilities = await UtilityAccount.find(query)
      .populate("facility_id", "name city")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  } else {
    const assignedFacilityIds = await FacilityAuditor.find({
      user_id: req.user._id,
    }).distinct("facility_id");

    const ownedFacilities = await Facility.find({
      owner_user_id: req.user._id,
    }).distinct("_id");

    const accessibleFacilityIds = [...ownedFacilities, ...assignedFacilityIds];

    const query = {
      facility_id: {
        $in: facility_id
          ? accessibleFacilityIds.filter(
              (id) => id.toString() === facility_id.toString(),
            )
          : accessibleFacilityIds,
      },
    };

    utilities = await UtilityAccount.find(query)
      .populate("facility_id", "name city")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  }

  res.status(200).json({
    success: true,
    count: utilities.length,
    data: utilities,
  });
});

// GET SINGLE (unchanged)
const getUtilityAccountById = asyncHandler(async (req, res) => {
  const utilityAccount = await UtilityAccount.findById(req.params.id)
    .populate("facility_id", "name city address owner_user_id")
    .populate("auditor_id", "name email");

  if (!utilityAccount) {
    res.status(404);
    throw new Error("Utility account not found");
  }

  const facility = await getAccessibleFacility(
    req.user,
    utilityAccount.facility_id._id,
  );

  if (!facility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: utilityAccount,
  });
});

// UPDATE
const updateUtilityAccount = asyncHandler(async (req, res) => {
  const {
    account_number,
    connection_type,
    category,
    sanctioned_demand_kVA,
    provider,
    billing_cycle,
    audit_date,
    auditor_id,
    is_solar_connected,
    is_dg_connected,
    is_transformer_connected,
    is_pump_connected,
    is_transformer_maintained_by_facility,
    is_active,
  } = req.body;

  const utilityAccount = await UtilityAccount.findById(req.params.id);

  if (!utilityAccount) {
    res.status(404);
    throw new Error("Utility account not found");
  }

  const facility = await getAccessibleFacility(
    req.user,
    utilityAccount.facility_id,
  );

  if (!facility) {
    res.status(403);
    throw new Error("Access denied");
  }

  if (
    account_number !== undefined &&
    account_number.trim() !== utilityAccount.account_number
  ) {
    const existingUtilityAccount = await UtilityAccount.findOne({
      facility_id: utilityAccount.facility_id,
      account_number: account_number.trim(),
      _id: { $ne: utilityAccount._id },
    });

    if (existingUtilityAccount) {
      res.status(400);
      throw new Error("Utility account already exists for this facility");
    }
  }

  const uploadedDocuments = await uploadUtilityDocuments(req.files);

  const updatedFields = Object.keys(req.body || {});

  utilityAccount.account_number =
    account_number !== undefined
      ? account_number.trim()
      : utilityAccount.account_number;

  utilityAccount.connection_type =
    connection_type ?? utilityAccount.connection_type;

  utilityAccount.category = category ?? utilityAccount.category;

  utilityAccount.sanctioned_demand_kVA =
    sanctioned_demand_kVA !== undefined && sanctioned_demand_kVA !== ""
      ? Number(sanctioned_demand_kVA)
      : utilityAccount.sanctioned_demand_kVA;

  utilityAccount.provider = provider ?? utilityAccount.provider;
  utilityAccount.billing_cycle = billing_cycle ?? utilityAccount.billing_cycle;
  utilityAccount.audit_date = audit_date ?? utilityAccount.audit_date;
  utilityAccount.auditor_id = auditor_id ?? utilityAccount.auditor_id;

  if (is_solar_connected !== undefined) {
    utilityAccount.is_solar_connected = parseBoolean(is_solar_connected);
  }

  if (is_dg_connected !== undefined) {
    utilityAccount.is_dg_connected = parseBoolean(is_dg_connected);
  }

  if (is_transformer_connected !== undefined) {
    utilityAccount.is_transformer_connected = parseBoolean(
      is_transformer_connected,
    );
  }

  if (is_pump_connected !== undefined) {
    utilityAccount.is_pump_connected = parseBoolean(is_pump_connected);
  }

  if (is_transformer_maintained_by_facility !== undefined) {
    utilityAccount.is_transformer_maintained_by_facility = parseBoolean(
      is_transformer_maintained_by_facility,
    );
  }

  if (is_active !== undefined) {
    utilityAccount.is_active = parseBoolean(is_active, true);
  }

  if (uploadedDocuments.length > 0) {
    utilityAccount.documents = [
      ...(utilityAccount.documents || []),
      ...uploadedDocuments,
    ];
    updatedFields.push("documents");
  }

  const updatedUtilityAccount = await utilityAccount.save();

  // ✅ ACTIVITY
  await createRecentActivity({
    actor: req.user,
    action: "updated",
    entity_type: "utility_account",
    entity_id: updatedUtilityAccount._id,
    entity_name: updatedUtilityAccount.account_number,
    facility_id: updatedUtilityAccount.facility_id,
    utility_account_id: updatedUtilityAccount._id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "updated",
      entityLabel: "utility account",
      entityName: updatedUtilityAccount.account_number,
    }),
    meta: {
      updated_fields: [...new Set(updatedFields)],
      connection_type: updatedUtilityAccount.connection_type,
    },
  });

  res.status(200).json({
    success: true,
    message: "Utility account updated successfully",
    data: updatedUtilityAccount,
  });
});

// DELETE
const deleteUtilityAccount = asyncHandler(async (req, res) => {
  const utilityAccount = await UtilityAccount.findById(req.params.id);

  if (!utilityAccount) {
    res.status(404);
    throw new Error("Utility account not found");
  }

  const facility = await getAccessibleFacility(
    req.user,
    utilityAccount.facility_id,
  );

  if (!facility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const entityName = utilityAccount.account_number;
  const facilityId = utilityAccount.facility_id;

  await utilityAccount.deleteOne();

  // ✅ ACTIVITY
  await createRecentActivity({
    actor: req.user,
    action: "deleted",
    entity_type: "utility_account",
    entity_id: utilityAccount._id,
    entity_name: entityName,
    facility_id: facilityId,
    utility_account_id: utilityAccount._id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "deleted",
      entityLabel: "utility account",
      entityName,
    }),
  });

  res.status(200).json({
    success: true,
    message: "Utility account deleted successfully",
  });
});

export {
  createUtilityAccount,
  getUtilityAccounts,
  getUtilityAccountById,
  updateUtilityAccount,
  deleteUtilityAccount,
};
