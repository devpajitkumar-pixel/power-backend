import asyncHandler from "../middlewares/asyncHandler.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

// helper: parse auditor ids safely
const parseAuditorIds = (auditor_ids) => {
  let parsedAuditorIds = [];

  if (auditor_ids) {
    if (Array.isArray(auditor_ids)) {
      parsedAuditorIds = auditor_ids;
    } else {
      try {
        parsedAuditorIds = JSON.parse(auditor_ids);
      } catch {
        parsedAuditorIds = [auditor_ids];
      }
    }
  }

  return parsedAuditorIds;
};

// helper: upload documents
const uploadFacilityDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(file, "facilities");

      uploadedDocuments.push({
        fileUrl: uploaded.secure_url,
        fileType: file.mimetype === "application/pdf" ? "pdf" : "image",
        fileName: file.originalname,
      });
    }
  }

  return uploadedDocuments;
};

// helper: admin check
const isAdmin = (user) => user?.role === "admin";

// @route POST /api/v1/facilities
// @desc Create a Facility
// @access Protected
const createFacility = asyncHandler(async (req, res) => {
  const {
    name,
    city,
    address,
    client_representative,
    client_contact_number,
    client_email,
    facility_type,
    status,
    auditor_ids,
  } = req.body;

  if (!name || !city) {
    res.status(400);
    throw new Error("Name and city are required");
  }

  const parsedAuditorIds = parseAuditorIds(auditor_ids);
  const uploadedDocuments = await uploadFacilityDocuments(req.files);

  const facility = await Facility.create({
    owner_user_id: req.user._id,
    created_by: req.user._id,
    name,
    city,
    address,
    client_representative,
    client_contact_number,
    client_email,
    facility_type,
    status,
    documents: uploadedDocuments,
  });

  if (parsedAuditorIds.length > 0) {
    const facilityAuditorDocs = parsedAuditorIds.map((auditorId) => ({
      facility_id: facility._id,
      user_id: auditorId,
      assigned_by: req.user._id,
    }));

    await FacilityAuditor.insertMany(facilityAuditorDocs, { ordered: false });
  }

  res.status(201).json({
    success: true,
    message: "Facility created successfully",
    data: facility,
  });
});

// @route GET /api/v1/facilities
// @desc Get all Facilities
// @access Protected
const getFacilities = asyncHandler(async (req, res) => {
  let facilities = [];

  if (isAdmin(req.user)) {
    facilities = await Facility.find().sort({ createdAt: -1 });
  } else {
    const assignedFacilityIds = await FacilityAuditor.find({
      user_id: req.user._id,
    }).distinct("facility_id");

    facilities = await Facility.find({
      $or: [
        { owner_user_id: req.user._id },
        { _id: { $in: assignedFacilityIds } },
      ],
    }).sort({ createdAt: -1 });
  }

  res.status(200).json({
    success: true,
    count: facilities.length,
    data: facilities,
  });
});

// @route GET /api/v1/facilities/:id
// @desc Get single Facility
// @access Protected
const getFacilityById = asyncHandler(async (req, res) => {
  let facility = null;

  if (isAdmin(req.user)) {
    facility = await Facility.findById(req.params.id);
  } else {
    const isAssignedAuditor = await FacilityAuditor.exists({
      facility_id: req.params.id,
      user_id: req.user._id,
    });

    facility = await Facility.findOne({
      _id: req.params.id,
      $or: [
        { owner_user_id: req.user._id },
        ...(isAssignedAuditor ? [{}] : []),
      ],
    });

    if (!facility && isAssignedAuditor) {
      facility = await Facility.findById(req.params.id);
    }
  }

  if (!facility) {
    res.status(404);
    throw new Error("Facility not found");
  }

  const assignedAuditors = await FacilityAuditor.find({
    facility_id: facility._id,
  })
    .populate("user_id", "name email")
    .select("user_id assigned_by createdAt");

  res.status(200).json({
    success: true,
    data: {
      facility,
      assignedAuditors,
    },
  });
});

// @route PUT /api/v1/facilities/:id
// @desc Update Facility
// @access Protected
const updateFacility = asyncHandler(async (req, res) => {
  const {
    name,
    city,
    address,
    client_representative,
    client_contact_number,
    client_email,
    facility_type,
    status,
    auditor_ids,
  } = req.body;

  const query = isAdmin(req.user)
    ? { _id: req.params.id }
    : { _id: req.params.id, owner_user_id: req.user._id };

  const facility = await Facility.findOne(query);

  if (!facility) {
    res.status(404);
    throw new Error("Facility not found");
  }

  const parsedAuditorIds = parseAuditorIds(auditor_ids);
  const uploadedDocuments = await uploadFacilityDocuments(req.files);

  facility.name = name ?? facility.name;
  facility.city = city ?? facility.city;
  facility.address = address ?? facility.address;
  facility.client_representative =
    client_representative ?? facility.client_representative;
  facility.client_contact_number =
    client_contact_number ?? facility.client_contact_number;
  facility.client_email = client_email ?? facility.client_email;
  facility.facility_type = facility_type ?? facility.facility_type;
  facility.status = status ?? facility.status;

  if (uploadedDocuments.length > 0) {
    facility.documents = [...(facility.documents || []), ...uploadedDocuments];
  }

  const updatedFacility = await facility.save();

  if (auditor_ids !== undefined) {
    await FacilityAuditor.deleteMany({ facility_id: facility._id });

    if (parsedAuditorIds.length > 0) {
      const facilityAuditorDocs = parsedAuditorIds.map((auditorId) => ({
        facility_id: facility._id,
        user_id: auditorId,
        assigned_by: req.user._id,
      }));

      await FacilityAuditor.insertMany(facilityAuditorDocs, { ordered: false });
    }
  }

  const assignedAuditors = await FacilityAuditor.find({
    facility_id: facility._id,
  }).select("user_id assigned_by createdAt");

  res.status(200).json({
    success: true,
    message: "Facility updated successfully",
    data: {
      facility: updatedFacility,
      assignedAuditors,
    },
  });
});

// @route DELETE /api/v1/facilities/:id
// @desc Delete Facility
// @access Protected
const deleteFacility = asyncHandler(async (req, res) => {
  const query = isAdmin(req.user)
    ? { _id: req.params.id }
    : { _id: req.params.id, owner_user_id: req.user._id };

  const facility = await Facility.findOne(query);

  if (!facility) {
    res.status(404);
    throw new Error("Facility not found");
  }

  await FacilityAuditor.deleteMany({ facility_id: facility._id });
  await facility.deleteOne();

  res.status(200).json({
    success: true,
    message: "Facility deleted successfully",
  });
});

export {
  createFacility,
  getFacilities,
  getFacilityById,
  updateFacility,
  deleteFacility,
};
