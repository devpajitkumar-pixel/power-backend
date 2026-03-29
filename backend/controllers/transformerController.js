import asyncHandler from "../middlewares/asyncHandler.js";
import Transformer from "../modals/transformer.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload transformer documents
const uploadTransformerDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(file, "transformers");

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
// 🚀 CREATE TRANSFORMER
//
const createTransformer = asyncHandler(async (req, res) => {
  const {
    facility_id,
    utility_account_id,
    transformer_tag,
    rated_capacity_kVA,
    type_of_cooling,
    rated_HV_kV,
    rated_LV_V,
    rated_HV_current_A,
    rated_LV_current_A,
    no_load_loss_kW,
    full_load_loss_kW,
    nameplate_efficiency_percent,
    audit_date,
    auditor_id,
  } = req.body;

  if (!facility_id || !utility_account_id || !transformer_tag) {
    res.status(400);
    throw new Error(
      "facility_id, utility_account_id and transformer_tag are required",
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

  const existingTransformer = await Transformer.findOne({
    utility_account_id,
    transformer_tag,
  });

  if (existingTransformer) {
    res.status(400);
    throw new Error("Transformer tag already exists for this utility account");
  }

  const uploadedDocuments = await uploadTransformerDocuments(req.files);

  const transformer = await Transformer.create({
    facility_id,
    utility_account_id,
    transformer_tag,
    rated_capacity_kVA,
    type_of_cooling,
    rated_HV_kV,
    rated_LV_V,
    rated_HV_current_A,
    rated_LV_current_A,
    no_load_loss_kW,
    full_load_loss_kW,
    nameplate_efficiency_percent,
    audit_date,
    auditor_id,
    documents: uploadedDocuments,
  });

  // ✅ ACTIVITY
  await createRecentActivity({
    actor: req.user,
    action: "created",
    entity_type: "transformer",
    entity_id: transformer._id,
    entity_name: transformer.transformer_tag,
    facility_id: transformer.facility_id,
    utility_account_id: transformer.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "created",
      entityLabel: "transformer",
      entityName: transformer.transformer_tag,
    }),
    meta: {
      rated_capacity_kVA: transformer.rated_capacity_kVA,
      type_of_cooling: transformer.type_of_cooling,
    },
  });

  res.status(201).json({
    success: true,
    message: "Transformer created successfully",
    data: transformer,
  });
});

//
// 📥 GET ALL TRANSFORMERS
//
const getTransformers = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;

  let transformers;

  if (isAdmin(req.user)) {
    transformers = await Transformer.find(query)
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

    transformers = await Transformer.find(userQuery)
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
    count: transformers.length,
    data: transformers,
  });
});

//
// 📄 GET SINGLE TRANSFORMER
//
const getTransformerById = asyncHandler(async (req, res) => {
  const transformer = await Transformer.findById(req.params.id)
    .populate("facility_id", "name city address")
    .populate(
      "utility_account_id",
      "utility_account_id account_number utility_type",
    )
    .populate("auditor_id", "name email");

  if (!transformer) {
    res.status(404);
    throw new Error("Transformer not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    transformer.utility_account_id._id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: transformer,
  });
});

//
// ✏️ UPDATE TRANSFORMER
//
const updateTransformer = asyncHandler(async (req, res) => {
  const transformer = await Transformer.findById(req.params.id);

  if (!transformer) {
    res.status(404);
    throw new Error("Transformer not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    transformer.utility_account_id,
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
      req.body.facility_id || transformer.facility_id.toString();

    if (newUtility.facility_id.toString() !== targetFacilityId.toString()) {
      res.status(400);
      throw new Error(
        "utility_account_id does not belong to the given facility",
      );
    }
  }

  if (req.body.transformer_tag) {
    const existingTransformer = await Transformer.findOne({
      utility_account_id:
        req.body.utility_account_id || transformer.utility_account_id,
      transformer_tag: req.body.transformer_tag,
      _id: { $ne: transformer._id },
    });

    if (existingTransformer) {
      res.status(400);
      throw new Error(
        "Transformer tag already exists for this utility account",
      );
    }
  }

  const updatedFields = Object.keys(req.body || {});
  const uploadedDocuments = await uploadTransformerDocuments(req.files);

  Object.keys(req.body).forEach((key) => {
    transformer[key] = req.body[key] ?? transformer[key];
  });

  if (uploadedDocuments.length > 0) {
    transformer.documents = [
      ...(transformer.documents || []),
      ...uploadedDocuments,
    ];
    updatedFields.push("documents");
  }

  const updatedTransformer = await transformer.save();

  // ✅ ACTIVITY
  await createRecentActivity({
    actor: req.user,
    action: "updated",
    entity_type: "transformer",
    entity_id: updatedTransformer._id,
    entity_name: updatedTransformer.transformer_tag,
    facility_id: updatedTransformer.facility_id,
    utility_account_id: updatedTransformer.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "updated",
      entityLabel: "transformer",
      entityName: updatedTransformer.transformer_tag,
    }),
    meta: {
      updated_fields: [...new Set(updatedFields)],
      rated_capacity_kVA: updatedTransformer.rated_capacity_kVA,
    },
  });

  res.status(200).json({
    success: true,
    message: "Transformer updated successfully",
    data: updatedTransformer,
  });
});

//
// ❌ DELETE TRANSFORMER
//
const deleteTransformer = asyncHandler(async (req, res) => {
  const transformer = await Transformer.findById(req.params.id);

  if (!transformer) {
    res.status(404);
    throw new Error("Transformer not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    transformer.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const entityName = transformer.transformer_tag;
  const facilityId = transformer.facility_id;
  const utilityId = transformer.utility_account_id;
  const ratedCapacity = transformer.rated_capacity_kVA;

  await transformer.deleteOne();

  // ✅ ACTIVITY
  await createRecentActivity({
    actor: req.user,
    action: "deleted",
    entity_type: "transformer",
    entity_id: transformer._id,
    entity_name: entityName,
    facility_id: facilityId,
    utility_account_id: utilityId,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "deleted",
      entityLabel: "transformer",
      entityName,
    }),
    meta: {
      rated_capacity_kVA: ratedCapacity,
    },
  });

  res.status(200).json({
    success: true,
    message: "Transformer deleted successfully",
  });
});

export {
  createTransformer,
  getTransformers,
  getTransformerById,
  updateTransformer,
  deleteTransformer,
};
