import asyncHandler from "../middlewares/asyncHandler.js";
import DGSet from "../modals/dgSet.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload DG set documents
const uploadDGSetDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(file, "dg-sets");

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
// 🚀 CREATE DG SET
//
const createDGSet = asyncHandler(async (req, res) => {
  const {
    facility_id,
    utility_account_id,
    dg_number,
    make_model,
    year_of_installation,
    rated_capacity_kVA,
    rated_active_power_kW,
    rated_voltage_V,
    rated_speed_RPM,
    fuel_type,
    audit_date,
    auditor_id,
  } = req.body;

  if (!facility_id || !utility_account_id || !dg_number) {
    res.status(400);
    throw new Error(
      "facility_id, utility_account_id and dg_number are required",
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

  const existingDG = await DGSet.findOne({
    utility_account_id,
    dg_number,
  });

  if (existingDG) {
    res.status(400);
    throw new Error("DG number already exists for this utility account");
  }

  const uploadedDocuments = await uploadDGSetDocuments(req.files);

  const dgSet = await DGSet.create({
    facility_id,
    utility_account_id,
    dg_number,
    make_model,
    year_of_installation,
    rated_capacity_kVA,
    rated_active_power_kW,
    rated_voltage_V,
    rated_speed_RPM,
    fuel_type,
    audit_date,
    auditor_id,
    documents: uploadedDocuments,
  });
  // ✅ Recent Activity
  await createRecentActivity({
    actor: req.user,
    action: "created",
    entity_type: "dg_set",
    entity_id: dgSet._id,
    entity_name: dgSet.dg_number,
    facility_id: dgSet.facility_id,
    utility_account_id: dgSet.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "created",
      entityLabel: "DG set",
      entityName: dgSet.dg_number,
    }),
    meta: {
      make_model: dgSet.make_model,
      rated_capacity_kVA: dgSet.rated_capacity_kVA,
    },
  });

  res.status(201).json({
    success: true,
    message: "DG set created successfully",
    data: dgSet,
  });
});

//
// 📥 GET ALL DG SETS
//
const getDGSets = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;

  let dgSets;

  if (isAdmin(req.user)) {
    dgSets = await DGSet.find(query)
      .populate("facility_id", "name city")
      .populate(
        "utility_account_id",
        "utility_account_id account_number utility_type",
      )
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

    dgSets = await DGSet.find(userQuery)
      .populate("facility_id", "name city")
      .populate(
        "utility_account_id",
        "utility_account_id account_number utility_type",
      )
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  }

  res.status(200).json({
    success: true,
    count: dgSets.length,
    data: dgSets,
  });
});

//
// 📄 GET SINGLE DG SET
//
const getDGSetById = asyncHandler(async (req, res) => {
  const dgSet = await DGSet.findById(req.params.id)
    .populate("facility_id", "name city address")
    .populate(
      "utility_account_id",
      "utility_account_id account_number utility_type",
    )
    .populate("auditor_id", "name email");

  if (!dgSet) {
    res.status(404);
    throw new Error("DG set not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    dgSet.utility_account_id._id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: dgSet,
  });
});

//
// ✏️ UPDATE DG SET
//
const updateDGSet = asyncHandler(async (req, res) => {
  const dgSet = await DGSet.findById(req.params.id);

  if (!dgSet) {
    res.status(404);
    throw new Error("DG set not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    dgSet.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  if (req.body.utility_account_id) {
    const newUtility = await getAccessibleUtilityAccount(
      req.user,
      req.body.utility_account_id,
    );

    if (!newUtility) {
      res.status(403);
      throw new Error("Access denied for new utility account");
    }

    const targetFacilityId =
      req.body.facility_id || dgSet.facility_id.toString();

    if (newUtility.facility_id.toString() !== targetFacilityId.toString()) {
      res.status(400);
      throw new Error(
        "utility_account_id does not belong to the given facility",
      );
    }
  }

  if (req.body.dg_number) {
    const existingDG = await DGSet.findOne({
      utility_account_id:
        req.body.utility_account_id || dgSet.utility_account_id,
      dg_number: req.body.dg_number,
      _id: { $ne: dgSet._id },
    });

    if (existingDG) {
      res.status(400);
      throw new Error("DG number already exists for this utility account");
    }
  }

  const uploadedDocuments = await uploadDGSetDocuments(req.files);

  Object.keys(req.body).forEach((key) => {
    dgSet[key] = req.body[key] ?? dgSet[key];
  });

  if (uploadedDocuments.length > 0) {
    dgSet.documents = [...(dgSet.documents || []), ...uploadedDocuments];
  }

  const updated = await dgSet.save();

  // ✅ Recent Activity
  await createRecentActivity({
    actor: req.user,
    action: "updated",
    entity_type: "dg_set",
    entity_id: updated._id,
    entity_name: updated.dg_number,
    facility_id: updated.facility_id,
    utility_account_id: updated.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "updated",
      entityLabel: "DG set",
      entityName: updated.dg_number,
    }),
    meta: {
      updated_fields: Object.keys(req.body || {}),
    },
  });

  res.status(200).json({
    success: true,
    message: "DG set updated successfully",
    data: updated,
  });
});

//
// ❌ DELETE DG SET
//
const deleteDGSet = asyncHandler(async (req, res) => {
  const dgSet = await DGSet.findById(req.params.id);

  if (!dgSet) {
    res.status(404);
    throw new Error("DG set not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    dgSet.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  // store before delete
  const name = dgSet.dg_number;
  const facilityId = dgSet.facility_id;
  const utilityId = dgSet.utility_account_id;

  await dgSet.deleteOne();

  // ✅ Recent Activity
  await createRecentActivity({
    actor: req.user,
    action: "deleted",
    entity_type: "dg_set",
    entity_id: dgSet._id,
    entity_name: name,
    facility_id: facilityId,
    utility_account_id: utilityId,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "deleted",
      entityLabel: "DG set",
      entityName: name,
    }),
  });

  res.status(200).json({
    success: true,
    message: "DG set deleted successfully",
  });
});

export { createDGSet, getDGSets, getDGSetById, updateDGSet, deleteDGSet };
