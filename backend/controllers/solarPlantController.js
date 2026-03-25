import asyncHandler from "../middlewares/asyncHandler.js";
import SolarPlant from "../modals/solarPlant.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

// 🔐 Admin check
const isAdmin = (user) => user?.role === "admin";

// 📂 Upload plant documents
const uploadSolarPlantDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(file, "solar-plants");

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
// 🚀 CREATE SOLAR PLANT
//
const createSolarPlant = asyncHandler(async (req, res) => {
  const {
    facility_id,
    utility_account_id,
    plant_name,
    rating_kWp,
    panel_rating_watt,
    no_of_panels,
    inverter_make,
    inverter_rating_kW,
    audit_date,
    auditor_id,
  } = req.body;

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

  const uploadedDocuments = await uploadSolarPlantDocuments(req.files);

  const solarPlant = await SolarPlant.create({
    facility_id,
    utility_account_id,
    plant_name,
    rating_kWp,
    panel_rating_watt,
    no_of_panels,
    inverter_make,
    inverter_rating_kW,
    audit_date,
    auditor_id,
    documents: uploadedDocuments,
  });

  res.status(201).json({
    success: true,
    message: "Solar plant created successfully",
    data: solarPlant,
  });
});

//
// 📥 GET ALL SOLAR PLANTS
//
const getSolarPlants = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id } = req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;

  let solarPlants;

  if (isAdmin(req.user)) {
    solarPlants = await SolarPlant.find(query)
      .populate("facility_id", "name city")
      .populate("utility_account_id", "account_number utility_type")
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

    solarPlants = await SolarPlant.find(userQuery)
      .populate("facility_id", "name city")
      .populate("utility_account_id", "account_number utility_type")
      .populate("auditor_id", "name email")
      .sort({ created_at: -1 });
  }

  res.status(200).json({
    success: true,
    count: solarPlants.length,
    data: solarPlants,
  });
});

//
// 📄 GET SINGLE SOLAR PLANT
//
const getSolarPlantById = asyncHandler(async (req, res) => {
  const solarPlant = await SolarPlant.findById(req.params.id)
    .populate("facility_id", "name city address")
    .populate("utility_account_id", "account_number utility_type")
    .populate("auditor_id", "name email");

  if (!solarPlant) {
    res.status(404);
    throw new Error("Solar plant not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    solarPlant.utility_account_id._id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: solarPlant,
  });
});

//
// ✏️ UPDATE SOLAR PLANT
//
const updateSolarPlant = asyncHandler(async (req, res) => {
  const solarPlant = await SolarPlant.findById(req.params.id);

  if (!solarPlant) {
    res.status(404);
    throw new Error("Solar plant not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    solarPlant.utility_account_id,
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
      req.body.facility_id || solarPlant.facility_id.toString();

    if (newUtility.facility_id.toString() !== targetFacilityId.toString()) {
      res.status(400);
      throw new Error(
        "utility_account_id does not belong to the given facility",
      );
    }
  }

  const uploadedDocuments = await uploadSolarPlantDocuments(req.files);

  Object.keys(req.body).forEach((key) => {
    solarPlant[key] = req.body[key] ?? solarPlant[key];
  });

  if (uploadedDocuments.length > 0) {
    solarPlant.documents = [
      ...(solarPlant.documents || []),
      ...uploadedDocuments,
    ];
  }

  const updated = await solarPlant.save();

  res.status(200).json({
    success: true,
    message: "Solar plant updated successfully",
    data: updated,
  });
});

//
// ❌ DELETE SOLAR PLANT
//
const deleteSolarPlant = asyncHandler(async (req, res) => {
  const solarPlant = await SolarPlant.findById(req.params.id);

  if (!solarPlant) {
    res.status(404);
    throw new Error("Solar plant not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    solarPlant.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  await solarPlant.deleteOne();

  res.status(200).json({
    success: true,
    message: "Solar plant deleted successfully",
  });
});

export {
  createSolarPlant,
  getSolarPlants,
  getSolarPlantById,
  updateSolarPlant,
  deleteSolarPlant,
};
