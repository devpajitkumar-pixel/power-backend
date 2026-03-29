import asyncHandler from "../middlewares/asyncHandler.js";
import Pump from "../modals/pump.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload pump documents
const uploadPumpDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(file, "pumps");

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
// 🚀 CREATE PUMP
//
const createPump = asyncHandler(async (req, res) => {
  const {
    facility_id,
    utility_account_id,
    pump_tag_number,
    make_model,
    rated_power_kW_or_HP,
    rated_flow_m3_per_hr,
    rated_head_m,
    rated_speed_RPM,
    number_of_stages,
    year_of_installation,
    audit_date,
    auditor_id,
  } = req.body;

  if (!facility_id || !utility_account_id || !pump_tag_number) {
    res.status(400);
    throw new Error(
      "facility_id, utility_account_id and pump_tag_number are required",
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

  const existingPump = await Pump.findOne({
    utility_account_id,
    pump_tag_number,
  });

  if (existingPump) {
    res.status(400);
    throw new Error("Pump tag already exists for this utility account");
  }

  const uploadedDocuments = await uploadPumpDocuments(req.files);

  const pump = await Pump.create({
    facility_id,
    utility_account_id,
    pump_tag_number,
    make_model,
    rated_power_kW_or_HP,
    rated_flow_m3_per_hr,
    rated_head_m,
    rated_speed_RPM,
    number_of_stages,
    year_of_installation,
    audit_date,
    auditor_id,
    documents: uploadedDocuments,
  });

  await createRecentActivity({
    actor: req.user,
    action: "created",
    entity_type: "pump",
    entity_id: pump._id,
    entity_name: pump.pump_tag_number,
    facility_id: pump.facility_id,
    utility_account_id: pump.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "created",
      entityLabel: "pump",
      entityName: pump.pump_tag_number || "",
    }),
    meta: {
      rated_power_kW_or_HP: pump.rated_power_kW_or_HP,
      rated_flow_m3_per_hr: pump.rated_flow_m3_per_hr,
      rated_head_m: pump.rated_head_m,
      year_of_installation: pump.year_of_installation,
    },
  });

  res.status(201).json({
    success: true,
    message: "Pump created successfully",
    data: pump,
  });
});

//
// 📥 GET ALL PUMPS
//
const getPumps = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;

  let pumps;

  if (isAdmin(req.user)) {
    pumps = await Pump.find(query)
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

    pumps = await Pump.find(userQuery)
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
    count: pumps.length,
    data: pumps,
  });
});

//
// 📄 GET SINGLE PUMP
//
const getPumpById = asyncHandler(async (req, res) => {
  const pump = await Pump.findById(req.params.id)
    .populate("facility_id", "name city address")
    .populate(
      "utility_account_id",
      "utility_account_id account_number utility_type",
    )
    .populate("auditor_id", "name email");

  if (!pump) {
    res.status(404);
    throw new Error("Pump not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    pump.utility_account_id._id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: pump,
  });
});

//
// ✏️ UPDATE PUMP
//
const updatePump = asyncHandler(async (req, res) => {
  const pump = await Pump.findById(req.params.id);

  if (!pump) {
    res.status(404);
    throw new Error("Pump not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    pump.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const targetFacilityId = req.body.facility_id || pump.facility_id.toString();
  const targetUtilityId =
    req.body.utility_account_id || pump.utility_account_id.toString();

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

  if (req.body.pump_tag_number) {
    const existingPump = await Pump.findOne({
      utility_account_id: targetUtilityId,
      pump_tag_number: req.body.pump_tag_number,
      _id: { $ne: pump._id },
    });

    if (existingPump) {
      res.status(400);
      throw new Error("Pump tag already exists for this utility account");
    }
  }

  const updatedFields = Object.keys(req.body || {});
  const uploadedDocuments = await uploadPumpDocuments(req.files);

  Object.keys(req.body).forEach((key) => {
    pump[key] = req.body[key] ?? pump[key];
  });

  if (uploadedDocuments.length > 0) {
    pump.documents = [...(pump.documents || []), ...uploadedDocuments];
    updatedFields.push("documents");
  }

  const updatedPump = await pump.save();

  await createRecentActivity({
    actor: req.user,
    action: "updated",
    entity_type: "pump",
    entity_id: updatedPump._id,
    entity_name: updatedPump.pump_tag_number,
    facility_id: updatedPump.facility_id,
    utility_account_id: updatedPump.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "updated",
      entityLabel: "pump",
      entityName: updatedPump.pump_tag_number || "",
    }),
    meta: {
      updated_fields: [...new Set(updatedFields)],
      rated_power_kW_or_HP: updatedPump.rated_power_kW_or_HP,
      rated_flow_m3_per_hr: updatedPump.rated_flow_m3_per_hr,
      rated_head_m: updatedPump.rated_head_m,
      year_of_installation: updatedPump.year_of_installation,
    },
  });

  res.status(200).json({
    success: true,
    message: "Pump updated successfully",
    data: updatedPump,
  });
});

//
// ❌ DELETE PUMP
//
const deletePump = asyncHandler(async (req, res) => {
  const pump = await Pump.findById(req.params.id);

  if (!pump) {
    res.status(404);
    throw new Error("Pump not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    pump.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const entityName = pump.pump_tag_number || "Pump";
  const facilityId = pump.facility_id;
  const utilityId = pump.utility_account_id;
  const ratedPower = pump.rated_power_kW_or_HP;
  const ratedFlow = pump.rated_flow_m3_per_hr;
  const ratedHead = pump.rated_head_m;

  await pump.deleteOne();

  await createRecentActivity({
    actor: req.user,
    action: "deleted",
    entity_type: "pump",
    entity_id: pump._id,
    entity_name: entityName,
    facility_id: facilityId,
    utility_account_id: utilityId,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "deleted",
      entityLabel: "pump",
      entityName,
    }),
    meta: {
      rated_power_kW_or_HP: ratedPower,
      rated_flow_m3_per_hr: ratedFlow,
      rated_head_m: ratedHead,
    },
  });

  res.status(200).json({
    success: true,
    message: "Pump deleted successfully",
  });
});

export { createPump, getPumps, getPumpById, updatePump, deletePump };
