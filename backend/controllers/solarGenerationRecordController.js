import asyncHandler from "../middlewares/asyncHandler.js";
import SolarGenerationRecord from "../modals/solarGenerationRecord.js";
import SolarPlant from "../modals/solarPlant.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload solar generation documents
const uploadSolarGenerationDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(
        file,
        "solar-generation-records",
      );

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

// 🔍 Check access to solar plant
const getAccessibleSolarPlant = async (user, solarPlantId) => {
  const solarPlant = await SolarPlant.findById(solarPlantId);

  if (!solarPlant) return null;

  const utility = await getAccessibleUtilityAccount(
    user,
    solarPlant.utility_account_id,
  );

  if (!utility) return null;

  return solarPlant;
};

// ♻️ Auto-calculate net values
const calculateNetValues = (data) => {
  const import_kWh = Number(data.import_kWh || 0);
  const import_kVAh = Number(data.import_kVAh || 0);
  const import_kVA = Number(data.import_kVA || 0);

  const export_kWh = Number(data.export_kWh || 0);
  const export_kVAh = Number(data.export_kVAh || 0);
  const export_kVA = Number(data.export_kVA || 0);

  return {
    net_kWh: import_kWh - export_kWh,
    net_kVAh: import_kVAh - export_kVAh,
    net_kVA: import_kVA - export_kVA,
  };
};

//
// 🚀 CREATE
//
const createSolarGenerationRecord = asyncHandler(async (req, res) => {
  const {
    solar_plant_id,
    utility_account_id,
    facility_id,
    billing_period_start,
    billing_period_end,
    billing_days,
    bill_no,
    import_kWh,
    import_kVAh,
    import_kVA,
    export_kWh,
    export_kVAh,
    export_kVA,
    solar_generation_kWh,
    solar_generation_kVAh,
    solar_generation_kVA,
    audit_date,
    auditor_id,
  } = req.body;

  if (
    !solar_plant_id ||
    !utility_account_id ||
    !facility_id ||
    !billing_period_start ||
    !billing_period_end
  ) {
    res.status(400);
    throw new Error(
      "solar_plant_id, utility_account_id, facility_id, billing_period_start and billing_period_end are required",
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

  const solarPlant = await getAccessibleSolarPlant(req.user, solar_plant_id);

  if (!solarPlant) {
    res.status(403);
    throw new Error("Access denied for solar plant");
  }

  if (utility.facility_id.toString() !== facility_id.toString()) {
    res.status(400);
    throw new Error("utility_account_id does not belong to the given facility");
  }

  if (
    solarPlant.utility_account_id.toString() !== utility_account_id.toString()
  ) {
    res.status(400);
    throw new Error(
      "solar_plant_id does not belong to the given utility_account_id",
    );
  }

  if (solarPlant.facility_id.toString() !== facility_id.toString()) {
    res.status(400);
    throw new Error("solar_plant_id does not belong to the given facility");
  }

  const existingRecord = await SolarGenerationRecord.findOne({
    solar_plant_id,
    billing_period_start,
    billing_period_end,
  });

  if (existingRecord) {
    res.status(400);
    throw new Error(
      "A solar generation record already exists for this plant and billing period",
    );
  }

  const uploadedDocuments = await uploadSolarGenerationDocuments(req.files);
  const { net_kWh, net_kVAh, net_kVA } = calculateNetValues(req.body);

  const solarGenerationRecord = await SolarGenerationRecord.create({
    solar_plant_id,
    utility_account_id,
    facility_id,
    billing_period_start,
    billing_period_end,
    billing_days,
    bill_no,
    import_kWh,
    import_kVAh,
    import_kVA,
    export_kWh,
    export_kVAh,
    export_kVA,
    net_kWh,
    net_kVAh,
    net_kVA,
    solar_generation_kWh,
    solar_generation_kVAh,
    solar_generation_kVA,
    audit_date,
    auditor_id,
    documents: uploadedDocuments,
  });

  // ✅ ACTIVITY
  await createRecentActivity({
    actor: req.user,
    action: "created",
    entity_type: "solar_generation",
    entity_id: solarGenerationRecord._id,
    entity_name: solarPlant.plant_name || "Solar Generation",
    facility_id: solarGenerationRecord.facility_id,
    utility_account_id: solarGenerationRecord.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "created",
      entityLabel: "solar generation record",
      entityName: solarPlant.plant_name || "",
    }),
    meta: {
      solar_generation_kWh: solarGenerationRecord.solar_generation_kWh,
      net_kWh: solarGenerationRecord.net_kWh,
      billing_period_start,
      billing_period_end,
    },
  });

  res.status(201).json({
    success: true,
    message: "Solar generation record created successfully",
    data: solarGenerationRecord,
  });
});

//
// 📥 GET ALL (UNCHANGED)
//
const getSolarGenerationRecords = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id, solar_plant_id } = req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;
  if (solar_plant_id) query.solar_plant_id = solar_plant_id;

  let solarGenerationRecords;

  if (isAdmin(req.user)) {
    solarGenerationRecords = await SolarGenerationRecord.find(query)
      .populate("facility_id", "name city")
      .populate("utility_account_id", "account_number connection_type")
      .populate("solar_plant_id", "plant_name rating_kWp")
      .populate("auditor_id", "name email")
      .sort({ billing_period_start: -1, created_at: -1 });
  } else {
    const utilities = await UtilityAccount.find();
    const allowedUtilityIds = [];

    for (const utility of utilities) {
      const access = await getAccessibleUtilityAccount(req.user, utility._id);
      if (access) allowedUtilityIds.push(utility._id.toString());
    }

    if (
      utility_account_id &&
      !allowedUtilityIds.includes(utility_account_id.toString())
    ) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const userQuery = {
      ...query,
      utility_account_id: utility_account_id
        ? utility_account_id
        : { $in: allowedUtilityIds },
    };

    solarGenerationRecords = await SolarGenerationRecord.find(userQuery)
      .populate("facility_id", "name city")
      .populate("utility_account_id", "account_number connection_type")
      .populate("solar_plant_id", "plant_name rating_kWp")
      .populate("auditor_id", "name email")
      .sort({ billing_period_start: -1, created_at: -1 });
  }

  res.status(200).json({
    success: true,
    count: solarGenerationRecords.length,
    data: solarGenerationRecords,
  });
});

//
// 📄 GET SINGLE (UNCHANGED)
//
const getSolarGenerationRecordById = asyncHandler(async (req, res) => {
  const solarGenerationRecord = await SolarGenerationRecord.findById(
    req.params.id,
  )
    .populate("facility_id", "name city address")
    .populate("utility_account_id", "account_number connection_type")
    .populate("solar_plant_id", "plant_name rating_kWp")
    .populate("auditor_id", "name email");

  if (!solarGenerationRecord) {
    res.status(404);
    throw new Error("Solar generation record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    solarGenerationRecord.utility_account_id._id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: solarGenerationRecord,
  });
});

//
// ✏️ UPDATE
//
const updateSolarGenerationRecord = asyncHandler(async (req, res) => {
  const solarGenerationRecord = await SolarGenerationRecord.findById(
    req.params.id,
  );

  if (!solarGenerationRecord) {
    res.status(404);
    throw new Error("Solar generation record not found");
  }

  const currentUtility = await getAccessibleUtilityAccount(
    req.user,
    solarGenerationRecord.utility_account_id,
  );

  if (!currentUtility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const targetUtilityId =
    req.body.utility_account_id || solarGenerationRecord.utility_account_id;
  const targetFacilityId =
    req.body.facility_id || solarGenerationRecord.facility_id;
  const targetSolarPlantId =
    req.body.solar_plant_id || solarGenerationRecord.solar_plant_id;

  const targetUtility = await getAccessibleUtilityAccount(
    req.user,
    targetUtilityId,
  );

  if (!targetUtility) {
    res.status(403);
    throw new Error("Access denied for target utility account");
  }

  const targetSolarPlant = await getAccessibleSolarPlant(
    req.user,
    targetSolarPlantId,
  );

  if (!targetSolarPlant) {
    res.status(403);
    throw new Error("Access denied for target solar plant");
  }

  if (targetUtility.facility_id.toString() !== targetFacilityId.toString()) {
    res.status(400);
    throw new Error("utility_account_id does not belong to the given facility");
  }

  if (
    targetSolarPlant.utility_account_id.toString() !==
    targetUtilityId.toString()
  ) {
    res.status(400);
    throw new Error(
      "solar_plant_id does not belong to the given utility_account_id",
    );
  }

  if (targetSolarPlant.facility_id.toString() !== targetFacilityId.toString()) {
    res.status(400);
    throw new Error("solar_plant_id does not belong to the given facility");
  }

  const newBillingPeriodStart =
    req.body.billing_period_start || solarGenerationRecord.billing_period_start;
  const newBillingPeriodEnd =
    req.body.billing_period_end || solarGenerationRecord.billing_period_end;

  const duplicateRecord = await SolarGenerationRecord.findOne({
    solar_plant_id: targetSolarPlantId,
    billing_period_start: newBillingPeriodStart,
    billing_period_end: newBillingPeriodEnd,
    _id: { $ne: solarGenerationRecord._id },
  });

  if (duplicateRecord) {
    res.status(400);
    throw new Error(
      "A solar generation record already exists for this plant and billing period",
    );
  }

  const updatedFields = Object.keys(req.body || {});
  const uploadedDocuments = await uploadSolarGenerationDocuments(req.files);

  Object.keys(req.body).forEach((key) => {
    solarGenerationRecord[key] = req.body[key] ?? solarGenerationRecord[key];
  });

  const calculated = calculateNetValues({
    import_kWh: req.body.import_kWh ?? solarGenerationRecord.import_kWh,
    import_kVAh: req.body.import_kVAh ?? solarGenerationRecord.import_kVAh,
    import_kVA: req.body.import_kVA ?? solarGenerationRecord.import_kVA,
    export_kWh: req.body.export_kWh ?? solarGenerationRecord.export_kWh,
    export_kVAh: req.body.export_kVAh ?? solarGenerationRecord.export_kVAh,
    export_kVA: req.body.export_kVA ?? solarGenerationRecord.export_kVA,
  });

  solarGenerationRecord.net_kWh = calculated.net_kWh;
  solarGenerationRecord.net_kVAh = calculated.net_kVAh;
  solarGenerationRecord.net_kVA = calculated.net_kVA;

  if (uploadedDocuments.length > 0) {
    solarGenerationRecord.documents = [
      ...(solarGenerationRecord.documents || []),
      ...uploadedDocuments,
    ];
    updatedFields.push("documents");
  }

  const updated = await solarGenerationRecord.save();

  // ✅ ACTIVITY
  await createRecentActivity({
    actor: req.user,
    action: "updated",
    entity_type: "solar_generation",
    entity_id: updated._id,
    entity_name: targetSolarPlant?.plant_name || "Solar Generation",
    facility_id: updated.facility_id,
    utility_account_id: updated.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "updated",
      entityLabel: "solar generation record",
      entityName: targetSolarPlant?.plant_name || "",
    }),
    meta: {
      updated_fields: [...new Set(updatedFields)],
      solar_generation_kWh: updated.solar_generation_kWh,
      net_kWh: updated.net_kWh,
    },
  });

  res.status(200).json({
    success: true,
    message: "Solar generation record updated successfully",
    data: updated,
  });
});

//
// ❌ DELETE
//
const deleteSolarGenerationRecord = asyncHandler(async (req, res) => {
  const solarGenerationRecord = await SolarGenerationRecord.findById(
    req.params.id,
  );

  if (!solarGenerationRecord) {
    res.status(404);
    throw new Error("Solar generation record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    solarGenerationRecord.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const solarPlant = await SolarPlant.findById(
    solarGenerationRecord.solar_plant_id,
  );

  const meta = {
    solar_generation_kWh: solarGenerationRecord.solar_generation_kWh,
    net_kWh: solarGenerationRecord.net_kWh,
  };

  await solarGenerationRecord.deleteOne();

  // ✅ ACTIVITY
  await createRecentActivity({
    actor: req.user,
    action: "deleted",
    entity_type: "solar_generation",
    entity_id: solarGenerationRecord._id,
    entity_name: solarPlant?.plant_name || "Solar Generation",
    facility_id: solarGenerationRecord.facility_id,
    utility_account_id: solarGenerationRecord.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "deleted",
      entityLabel: "solar generation record",
      entityName: solarPlant?.plant_name || "",
    }),
    meta,
  });

  res.status(200).json({
    success: true,
    message: "Solar generation record deleted successfully",
  });
});

export {
  createSolarGenerationRecord,
  getSolarGenerationRecords,
  getSolarGenerationRecordById,
  updateSolarGenerationRecord,
  deleteSolarGenerationRecord,
};
