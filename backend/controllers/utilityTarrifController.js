import asyncHandler from "../middlewares/asyncHandler.js";
import UtilityTariff from "../modals/utilityTarrif.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload documents
const uploadTariffDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(file, "utility-tariffs");

      uploadedDocuments.push({
        fileUrl: uploaded.secure_url,
        fileType: file.mimetype === "application/pdf" ? "pdf" : "image",
        fileName: file.originalname,
      });
    }
  }

  return uploadedDocuments;
};

// 🔍 Check access
const getAccessibleUtilityAccount = async (user, utilityAccountId) => {
  const utility = await UtilityAccount.findById(utilityAccountId);

  if (!utility) return null;

  if (isAdmin(user)) return utility;

  const facility = await Facility.findById(utility.facility_id);

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
// 🚀 CREATE TARIFF
//
const createUtilityTariff = asyncHandler(async (req, res) => {
  const {
    utility_account_id,
    effective_from,
    effective_to,
    basic_energy_charges_rs_per_unit,
    fixed_charges_rs_per_kW_or_per_kVA,
    ed_percent,
    octroi_rs_per_unit,
    surcharge_rs,
    cow_cess_rs,
    rental_rs,
    infracess_rs,
    other_charges_or_rebates_rs,
    any_other_rs,
    audit_date,
    auditor_id,
  } = req.body;

  if (!utility_account_id || !effective_from) {
    res.status(400);
    throw new Error("utility_account_id and effective_from are required");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const uploadedDocuments = await uploadTariffDocuments(req.files);

  const tariff = await UtilityTariff.create({
    utility_account_id,
    effective_from,
    effective_to: effective_to || null,

    basic_energy_charges_rs_per_unit,
    fixed_charges_rs_per_kW_or_per_kVA,
    ed_percent,
    octroi_rs_per_unit,
    surcharge_rs,
    cow_cess_rs,
    rental_rs,
    infracess_rs,
    other_charges_or_rebates_rs,
    any_other_rs,

    audit_date,
    auditor_id,

    documents: uploadedDocuments,
  });

  res.status(201).json({
    success: true,
    message: "Utility tariff created successfully",
    data: tariff,
  });
});

//
// 📥 GET ALL TARIFFS
//
const getUtilityTariffs = asyncHandler(async (req, res) => {
  const { utility_account_id } = req.query;

  let tariffs = [];

  if (isAdmin(req.user)) {
    const query = utility_account_id ? { utility_account_id } : {};

    tariffs = await UtilityTariff.find(query)
      .populate("utility_account_id", "account_number")
      .populate("auditor_id", "name email")
      .sort({ effective_from: -1 });
  } else {
    const utilities = await UtilityAccount.find();

    const allowedIds = [];

    for (const utility of utilities) {
      const access = await getAccessibleUtilityAccount(req.user, utility._id);
      if (access) allowedIds.push(utility._id.toString());
    }

    let query = {
      utility_account_id: { $in: allowedIds },
    };

    if (utility_account_id) {
      if (!allowedIds.includes(utility_account_id.toString())) {
        return res.status(403).json({
          success: false,
          message: "Access denied for this utility account",
        });
      }

      query = {
        utility_account_id,
      };
    }

    tariffs = await UtilityTariff.find(query)
      .populate("utility_account_id", "account_number")
      .populate("auditor_id", "name email")
      .sort({ effective_from: -1 });
  }

  res.status(200).json({
    success: true,
    count: tariffs.length,
    data: tariffs,
  });
});

//
// 📄 GET SINGLE TARIFF
//
const getUtilityTariffById = asyncHandler(async (req, res) => {
  const tariff = await UtilityTariff.findById(req.params.id)
    .populate("utility_account_id")
    .populate("auditor_id", "name email");

  if (!tariff) {
    res.status(404);
    throw new Error("Tariff not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    tariff.utility_account_id._id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: tariff,
  });
});

//
// ✏️ UPDATE TARIFF
//
const updateUtilityTariff = asyncHandler(async (req, res) => {
  const tariff = await UtilityTariff.findById(req.params.id);

  if (!tariff) {
    res.status(404);
    throw new Error("Tariff not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    tariff.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const uploadedDocuments = await uploadTariffDocuments(req.files);

  Object.keys(req.body).forEach((key) => {
    tariff[key] = req.body[key] ?? tariff[key];
  });

  if (uploadedDocuments.length > 0) {
    tariff.documents = [...(tariff.documents || []), ...uploadedDocuments];
  }

  const updated = await tariff.save();

  res.status(200).json({
    success: true,
    message: "Tariff updated successfully",
    data: updated,
  });
});

//
// ❌ DELETE TARIFF
//
const deleteUtilityTariff = asyncHandler(async (req, res) => {
  const tariff = await UtilityTariff.findById(req.params.id);

  if (!tariff) {
    res.status(404);
    throw new Error("Tariff not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    tariff.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  await tariff.deleteOne();

  res.status(200).json({
    success: true,
    message: "Tariff deleted successfully",
  });
});

export {
  createUtilityTariff,
  getUtilityTariffs,
  getUtilityTariffById,
  updateUtilityTariff,
  deleteUtilityTariff,
};
