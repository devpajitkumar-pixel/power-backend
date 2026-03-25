import asyncHandler from "../middlewares/asyncHandler.js";
import TransformerAuditRecord from "../modals/transformerAuditRecord.js";
import Transformer from "../modals/transformer.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload transformer audit documents
const uploadTransformerAuditDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(
        file,
        "transformer-audit-records",
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

// 🔍 Check transformer belongs to given utility and facility
const validateTransformerRelation = async (
  transformerId,
  utilityAccountId,
  facilityId,
) => {
  const transformer = await Transformer.findById(transformerId);

  if (!transformer) return null;

  if (
    transformer.utility_account_id.toString() !== utilityAccountId.toString()
  ) {
    return false;
  }

  if (transformer.facility_id.toString() !== facilityId.toString()) {
    return false;
  }

  return transformer;
};

//
// 🚀 CREATE TRANSFORMER AUDIT RECORD
//
const createTransformerAuditRecord = asyncHandler(async (req, res) => {
  const {
    transformer_id,
    utility_account_id,
    facility_id,
    total_losses_kW,
    average_load_kVA,
    percent_loading,
    max_load_kVA,
    load_factor_percent,
    operating_hours_per_year,
    annual_energy_supplied_kWh,
    annual_energy_losses_kWh,
    per_unit_cost_rs,
    cost_of_losses_rs,
    power_factor_LT,
    harmonics_THD_percent,
    neutral_earth_resistance_ohms,
    body_to_earth_resistance_ohms,
    silica_gel_cobalt_type,
    silica_gel_non_cobalt_type,
    oil_level,
    line_voltage_Vr,
    line_voltage_Vy,
    line_voltage_Vb,
    phase_voltage_Vr_n,
    phase_voltage_Vy_n,
    phase_voltage_Vb_n,
    line_current_Ir,
    line_current_Iy,
    line_current_Ib,
    audit_date,
    auditor_id,
  } = req.body;

  if (!transformer_id || !utility_account_id || !facility_id) {
    res.status(400);
    throw new Error(
      "transformer_id, utility_account_id and facility_id are required",
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

  const transformer = await validateTransformerRelation(
    transformer_id,
    utility_account_id,
    facility_id,
  );

  if (!transformer) {
    res.status(404);
    throw new Error("Transformer not found");
  }

  if (transformer === false) {
    res.status(400);
    throw new Error(
      "transformer_id does not belong to the given utility account/facility",
    );
  }

  const uploadedDocuments = await uploadTransformerAuditDocuments(req.files);

  const transformerAuditRecord = await TransformerAuditRecord.create({
    transformer_id,
    utility_account_id,
    facility_id,
    total_losses_kW,
    average_load_kVA,
    percent_loading,
    max_load_kVA,
    load_factor_percent,
    operating_hours_per_year,
    annual_energy_supplied_kWh,
    annual_energy_losses_kWh,
    per_unit_cost_rs,
    cost_of_losses_rs,
    power_factor_LT,
    harmonics_THD_percent,
    neutral_earth_resistance_ohms,
    body_to_earth_resistance_ohms,
    silica_gel_cobalt_type,
    silica_gel_non_cobalt_type,
    oil_level,
    line_voltage_Vr,
    line_voltage_Vy,
    line_voltage_Vb,
    phase_voltage_Vr_n,
    phase_voltage_Vy_n,
    phase_voltage_Vb_n,
    line_current_Ir,
    line_current_Iy,
    line_current_Ib,
    audit_date,
    auditor_id,
    documents: uploadedDocuments,
  });

  res.status(201).json({
    success: true,
    message: "Transformer audit record created successfully",
    data: transformerAuditRecord,
  });
});

//
// 📥 GET ALL TRANSFORMER AUDIT RECORDS
//
const getTransformerAuditRecords = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id, transformer_id } = req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;
  if (transformer_id) query.transformer_id = transformer_id;

  let transformerAuditRecords;

  if (isAdmin(req.user)) {
    transformerAuditRecords = await TransformerAuditRecord.find(query)
      .populate("facility_id", "name city")
      .populate(
        "utility_account_id",
        "utility_account_id account_number utility_type",
      )
      .populate("transformer_id", "transformer_tag rated_capacity_kVA")
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

    transformerAuditRecords = await TransformerAuditRecord.find(userQuery)
      .populate("facility_id", "name city")
      .populate(
        "utility_account_id",
        "utility_account_id account_number utility_type",
      )
      .populate("transformer_id", "transformer_tag rated_capacity_kVA")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  }

  res.status(200).json({
    success: true,
    count: transformerAuditRecords.length,
    data: transformerAuditRecords,
  });
});

//
// 📄 GET SINGLE TRANSFORMER AUDIT RECORD
//
const getTransformerAuditRecordById = asyncHandler(async (req, res) => {
  const transformerAuditRecord = await TransformerAuditRecord.findById(
    req.params.id,
  )
    .populate("facility_id", "name city address")
    .populate(
      "utility_account_id",
      "utility_account_id account_number utility_type",
    )
    .populate("transformer_id", "transformer_tag rated_capacity_kVA")
    .populate("auditor_id", "name email");

  if (!transformerAuditRecord) {
    res.status(404);
    throw new Error("Transformer audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    transformerAuditRecord.utility_account_id._id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: transformerAuditRecord,
  });
});

//
// ✏️ UPDATE TRANSFORMER AUDIT RECORD
//
const updateTransformerAuditRecord = asyncHandler(async (req, res) => {
  const transformerAuditRecord = await TransformerAuditRecord.findById(
    req.params.id,
  );

  if (!transformerAuditRecord) {
    res.status(404);
    throw new Error("Transformer audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    transformerAuditRecord.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const targetUtilityId =
    req.body.utility_account_id || transformerAuditRecord.utility_account_id;
  const targetFacilityId =
    req.body.facility_id || transformerAuditRecord.facility_id;
  const targetTransformerId =
    req.body.transformer_id || transformerAuditRecord.transformer_id;

  if (req.body.utility_account_id) {
    const newUtility = await getAccessibleUtilityAccount(
      req.user,
      req.body.utility_account_id,
    );

    if (!newUtility) {
      res.status(403);
      throw new Error("Access denied for new utility account");
    }

    if (newUtility.facility_id.toString() !== targetFacilityId.toString()) {
      res.status(400);
      throw new Error(
        "utility_account_id does not belong to the given facility",
      );
    }
  }

  const transformer = await validateTransformerRelation(
    targetTransformerId,
    targetUtilityId,
    targetFacilityId,
  );

  if (!transformer) {
    res.status(404);
    throw new Error("Transformer not found");
  }

  if (transformer === false) {
    res.status(400);
    throw new Error(
      "transformer_id does not belong to the given utility account/facility",
    );
  }

  const uploadedDocuments = await uploadTransformerAuditDocuments(req.files);

  Object.keys(req.body).forEach((key) => {
    transformerAuditRecord[key] = req.body[key] ?? transformerAuditRecord[key];
  });

  if (uploadedDocuments.length > 0) {
    transformerAuditRecord.documents = [
      ...(transformerAuditRecord.documents || []),
      ...uploadedDocuments,
    ];
  }

  const updatedTransformerAuditRecord = await transformerAuditRecord.save();

  res.status(200).json({
    success: true,
    message: "Transformer audit record updated successfully",
    data: updatedTransformerAuditRecord,
  });
});

//
// ❌ DELETE TRANSFORMER AUDIT RECORD
//
const deleteTransformerAuditRecord = asyncHandler(async (req, res) => {
  const transformerAuditRecord = await TransformerAuditRecord.findById(
    req.params.id,
  );

  if (!transformerAuditRecord) {
    res.status(404);
    throw new Error("Transformer audit record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    transformerAuditRecord.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  await transformerAuditRecord.deleteOne();

  res.status(200).json({
    success: true,
    message: "Transformer audit record deleted successfully",
  });
});

export {
  createTransformerAuditRecord,
  getTransformerAuditRecords,
  getTransformerAuditRecordById,
  updateTransformerAuditRecord,
  deleteTransformerAuditRecord,
};
