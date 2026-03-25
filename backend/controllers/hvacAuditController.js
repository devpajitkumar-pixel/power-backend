import asyncHandler from "../middlewares/asyncHandler.js";
import HVACAudit from "../modals/hvacAudit.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload HVAC audit documents
const uploadHVACDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(file, "hvac-audits");

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

// ✅ Convert common string values
const coercePrimitive = (value) => {
  if (value === undefined || value === null) return value;

  if (typeof value !== "string") return value;

  const trimmed = value.trim();

  if (trimmed === "") return "";

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;

  // keep date strings / text as-is unless it's a pure number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return value;
};

// ✅ Safely parse JSON string field
const parseJSONField = (value, fallback) => {
  try {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    if (typeof value === "string") {
      return JSON.parse(value);
    }

    return value;
  } catch (error) {
    return fallback;
  }
};

// ✅ Build nested object from bracket-notation keys in multipart body
// Example:
// documents_records_to_collect[single_line_diagram_electrical][available] = "true"
const extractBracketNotationObject = (body, rootKey) => {
  const result = {};
  const prefix = `${rootKey}[`;

  for (const [key, value] of Object.entries(body || {})) {
    if (!key.startsWith(prefix)) continue;

    const pathMatches = [...key.matchAll(/\[([^\]]*)\]/g)].map(
      (match) => match[1],
    );

    if (pathMatches.length === 0) continue;

    let current = result;

    for (let i = 0; i < pathMatches.length; i++) {
      const segment = pathMatches[i];
      const isLast = i === pathMatches.length - 1;

      if (isLast) {
        current[segment] = coercePrimitive(value);
      } else {
        if (
          !current[segment] ||
          typeof current[segment] !== "object" ||
          Array.isArray(current[segment])
        ) {
          current[segment] = {};
        }
        current = current[segment];
      }
    }
  }

  return result;
};

// ✅ Read either JSON-string field OR bracket-notation multipart field
const getStructuredField = (body, rootKey, fallback) => {
  if (body?.[rootKey] !== undefined) {
    const parsed = parseJSONField(body[rootKey], fallback);
    return parsed ?? fallback;
  }

  const fromBracketNotation = extractBracketNotationObject(body, rootKey);
  if (Object.keys(fromBracketNotation).length > 0) {
    return fromBracketNotation;
  }

  return fallback;
};

// ✅ Check meaningful values
const isMeaningfulValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;

  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.values(value).some(isMeaningfulValue);
  }

  return true;
};

// ✅ Remove completely empty objects from array
const removeEmptyObjectsFromArray = (arr = []) => {
  if (!Array.isArray(arr)) return [];

  return arr.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return Object.values(item).some(isMeaningfulValue);
  });
};

// ✅ Ensure checklist object contains all expected keys
const normalizeDocumentChecklist = (value = {}) => {
  const normalized = {
    single_line_diagram_electrical: {
      available: false,
      remarks: "",
    },
    hvac_layout_piping_drawing: {
      available: false,
      remarks: "",
    },
    chiller_operation_maintenance_log: {
      available: false,
      remarks: "",
    },
    water_treatment_records: {
      available: false,
      remarks: "",
    },
    cooling_tower_maintenance_record: {
      available: false,
      remarks: "",
    },
    hvac_equipment_capacity_list: {
      available: false,
      remarks: "",
    },
    bms_setpoints_schedule: {
      available: false,
      remarks: "",
    },
  };

  for (const key of Object.keys(normalized)) {
    const incoming = value?.[key];

    if (typeof incoming === "boolean") {
      normalized[key] = {
        available: incoming,
        remarks: "",
      };
      continue;
    }

    if (incoming && typeof incoming === "object") {
      normalized[key] = {
        available: Boolean(incoming.available),
        remarks:
          incoming.remarks === undefined || incoming.remarks === null
            ? ""
            : String(incoming.remarks),
      };
    }
  }

  return normalized;
};

// ✅ Normalize HVAC audit payload
const normalizeHVACAuditPayload = (body) => {
  const pre_audit_information = getStructuredField(
    body,
    "pre_audit_information",
    {},
  );

  const documents_records_to_collect = normalizeDocumentChecklist(
    getStructuredField(body, "documents_records_to_collect", {}),
  );

  const hvac_equipment_register = removeEmptyObjectsFromArray(
    getStructuredField(body, "hvac_equipment_register", []),
  );

  const chiller_field_test = getStructuredField(body, "chiller_field_test", {});
  chiller_field_test.readings = removeEmptyObjectsFromArray(
    chiller_field_test.readings || [],
  );
  chiller_field_test.average = chiller_field_test.average || {};

  const auxiliary_power = getStructuredField(body, "auxiliary_power", {});
  auxiliary_power.components = removeEmptyObjectsFromArray(
    auxiliary_power.components || [],
  );

  const cooling_tower_quick_test = getStructuredField(
    body,
    "cooling_tower_quick_test",
    {},
  );
  cooling_tower_quick_test.readings = removeEmptyObjectsFromArray(
    cooling_tower_quick_test.readings || [],
  );
  cooling_tower_quick_test.average = cooling_tower_quick_test.average || {};

  const summary = getStructuredField(body, "summary", {});

  return {
    pre_audit_information,
    documents_records_to_collect,
    hvac_equipment_register,
    chiller_field_test,
    auxiliary_power,
    cooling_tower_quick_test,
    summary,
  };
};

//
// 🚀 CREATE HVAC AUDIT
//
const createHVACAudit = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id, audit_date, auditor_id } = req.body;

  if (!facility_id || !utility_account_id) {
    res.status(400);
    throw new Error("facility_id and utility_account_id are required");
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

  const {
    pre_audit_information,
    documents_records_to_collect,
    hvac_equipment_register,
    chiller_field_test,
    auxiliary_power,
    cooling_tower_quick_test,
    summary,
  } = normalizeHVACAuditPayload(req.body);

  const uploadedDocuments = await uploadHVACDocuments(req.files || []);

  const hvacAudit = await HVACAudit.create({
    facility_id,
    utility_account_id,
    pre_audit_information,
    documents_records_to_collect,
    hvac_equipment_register,
    chiller_field_test,
    auxiliary_power,
    cooling_tower_quick_test,
    summary,
    audit_date,
    auditor_id,
    documents: uploadedDocuments,
  });

  res.status(201).json({
    success: true,
    message: "HVAC audit created successfully",
    data: hvacAudit,
  });
});

//
// 📥 GET ALL HVAC AUDITS
//
const getHVACAudits = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;

  let hvacAudits;

  if (isAdmin(req.user)) {
    hvacAudits = await HVACAudit.find(query)
      .populate("facility_id", "name city")
      .populate(
        "utility_account_id",
        "utility_account_id account_number utility_type",
      )
      .populate("auditor_id", "name email")
      .sort({ createdAt: -1 });
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

    hvacAudits = await HVACAudit.find(userQuery)
      .populate("facility_id", "name city")
      .populate(
        "utility_account_id",
        "utility_account_id account_number utility_type",
      )
      .populate("auditor_id", "name email")
      .sort({ createdAt: -1 });
  }

  res.status(200).json({
    success: true,
    count: hvacAudits.length,
    data: hvacAudits,
  });
});

//
// 📄 GET SINGLE HVAC AUDIT
//
const getHVACAuditById = asyncHandler(async (req, res) => {
  const hvacAudit = await HVACAudit.findById(req.params.id)
    .populate("facility_id", "name city address")
    .populate(
      "utility_account_id",
      "utility_account_id account_number utility_type",
    )
    .populate("auditor_id", "name email");

  if (!hvacAudit) {
    res.status(404);
    throw new Error("HVAC audit not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    hvacAudit.utility_account_id._id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: hvacAudit,
  });
});

//
// ✏️ UPDATE HVAC AUDIT
//
const updateHVACAudit = asyncHandler(async (req, res) => {
  const hvacAudit = await HVACAudit.findById(req.params.id);

  if (!hvacAudit) {
    res.status(404);
    throw new Error("HVAC audit not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    hvacAudit.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const nextFacilityId =
    req.body.facility_id || hvacAudit.facility_id.toString();
  const nextUtilityId =
    req.body.utility_account_id || hvacAudit.utility_account_id.toString();

  const targetUtility = await getAccessibleUtilityAccount(
    req.user,
    nextUtilityId,
  );

  if (!targetUtility) {
    res.status(403);
    throw new Error("Access denied for target utility account");
  }

  if (targetUtility.facility_id.toString() !== nextFacilityId.toString()) {
    res.status(400);
    throw new Error("utility_account_id does not belong to the given facility");
  }

  const uploadedDocuments = await uploadHVACDocuments(req.files || []);
  const normalized = normalizeHVACAuditPayload(req.body);

  if (req.body.facility_id) {
    hvacAudit.facility_id = req.body.facility_id;
  }

  if (req.body.utility_account_id) {
    hvacAudit.utility_account_id = req.body.utility_account_id;
  }

  if (req.body.audit_date !== undefined) {
    hvacAudit.audit_date = req.body.audit_date || null;
  }

  if (req.body.auditor_id !== undefined) {
    hvacAudit.auditor_id = req.body.auditor_id || null;
  }

  if (
    req.body.pre_audit_information !== undefined ||
    Object.keys(extractBracketNotationObject(req.body, "pre_audit_information"))
      .length > 0
  ) {
    hvacAudit.pre_audit_information = normalized.pre_audit_information;
  }

  if (
    req.body.documents_records_to_collect !== undefined ||
    Object.keys(
      extractBracketNotationObject(req.body, "documents_records_to_collect"),
    ).length > 0
  ) {
    hvacAudit.documents_records_to_collect =
      normalized.documents_records_to_collect;
  }

  if (
    req.body.hvac_equipment_register !== undefined ||
    Object.keys(
      extractBracketNotationObject(req.body, "hvac_equipment_register"),
    ).length > 0
  ) {
    hvacAudit.hvac_equipment_register = normalized.hvac_equipment_register;
  }

  if (
    req.body.chiller_field_test !== undefined ||
    Object.keys(extractBracketNotationObject(req.body, "chiller_field_test"))
      .length > 0
  ) {
    hvacAudit.chiller_field_test = normalized.chiller_field_test;
  }

  if (
    req.body.auxiliary_power !== undefined ||
    Object.keys(extractBracketNotationObject(req.body, "auxiliary_power"))
      .length > 0
  ) {
    hvacAudit.auxiliary_power = normalized.auxiliary_power;
  }

  if (
    req.body.cooling_tower_quick_test !== undefined ||
    Object.keys(
      extractBracketNotationObject(req.body, "cooling_tower_quick_test"),
    ).length > 0
  ) {
    hvacAudit.cooling_tower_quick_test = normalized.cooling_tower_quick_test;
  }

  if (
    req.body.summary !== undefined ||
    Object.keys(extractBracketNotationObject(req.body, "summary")).length > 0
  ) {
    hvacAudit.summary = normalized.summary;
  }

  if (uploadedDocuments.length > 0) {
    hvacAudit.documents = [
      ...(hvacAudit.documents || []),
      ...uploadedDocuments,
    ];
  }

  const updatedHVACAudit = await hvacAudit.save();

  res.status(200).json({
    success: true,
    message: "HVAC audit updated successfully",
    data: updatedHVACAudit,
  });
});

//
// ❌ DELETE HVAC AUDIT
//
const deleteHVACAudit = asyncHandler(async (req, res) => {
  const hvacAudit = await HVACAudit.findById(req.params.id);

  if (!hvacAudit) {
    res.status(404);
    throw new Error("HVAC audit not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    hvacAudit.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  await hvacAudit.deleteOne();

  res.status(200).json({
    success: true,
    message: "HVAC audit deleted successfully",
  });
});

export {
  createHVACAudit,
  getHVACAudits,
  getHVACAuditById,
  updateHVACAudit,
  deleteHVACAudit,
};
