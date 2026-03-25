import asyncHandler from "../middlewares/asyncHandler.js";
import UtilityBillingRecord from "../modals/utilityBillingRecord.js";
import UtilityAccount from "../modals/utilityAccount.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

// helper: admin check
const isAdmin = (user) => user?.role === "admin";

// helper: upload documents
const uploadBillingDocuments = async (files = []) => {
  const uploadedDocuments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadBufferToCloudinary(
        file,
        "utility-billing-records",
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

// helper: number parser
const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return Number(value);
};

// helper: access check
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
    facility.owner_user_id?.toString() === user._id.toString() ||
    isAssignedAuditor
  ) {
    return utility;
  }

  return null;
};

// @route POST /api/v1/utility-billing-records
// @desc Create Utility Billing Record
// @access Protected
const createUtilityBillingRecord = asyncHandler(async (req, res) => {
  const {
    utility_account_id,
    billing_period_start,
    billing_period_end,
    billing_days,
    bill_no,
    mdi_kVA,
    units_kWh,
    units_kVAh,
    pf,
    fixed_charges_rs,
    energy_charges_rs,
    taxes_and_rent_rs,
    other_charges_rs,
    monthly_electricity_bill_rs,
    unit_consumption_per_day_kVAh,
    average_per_unit_cost_rs,
    audit_date,
    auditor_id,
  } = req.body;

  if (!utility_account_id || !billing_period_start || !billing_period_end) {
    res.status(400);
    throw new Error(
      "utility_account_id, billing_period_start and billing_period_end are required",
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

  const existingRecord = await UtilityBillingRecord.findOne({
    utility_account_id,
    billing_period_start,
    billing_period_end,
  });

  if (existingRecord) {
    res.status(400);
    throw new Error("Billing record already exists for this billing period");
  }

  const uploadedDocuments = await uploadBillingDocuments(req.files);

  const billingRecord = await UtilityBillingRecord.create({
    utility_account_id,
    billing_period_start,
    billing_period_end,
    billing_days: parseNumber(billing_days),
    bill_no: bill_no?.trim(),
    mdi_kVA: parseNumber(mdi_kVA),
    units_kWh: parseNumber(units_kWh),
    units_kVAh: parseNumber(units_kVAh),
    pf: parseNumber(pf),
    fixed_charges_rs: parseNumber(fixed_charges_rs),
    energy_charges_rs: parseNumber(energy_charges_rs),
    taxes_and_rent_rs: parseNumber(taxes_and_rent_rs),
    other_charges_rs: parseNumber(other_charges_rs),
    monthly_electricity_bill_rs: parseNumber(monthly_electricity_bill_rs),
    unit_consumption_per_day_kVAh: parseNumber(unit_consumption_per_day_kVAh),
    average_per_unit_cost_rs: parseNumber(average_per_unit_cost_rs),
    audit_date: audit_date || undefined,
    auditor_id: auditor_id || undefined,
    documents: uploadedDocuments,
  });

  res.status(201).json({
    success: true,
    message: "Utility billing record created successfully",
    data: billingRecord,
  });
});

// @route GET /api/v1/utility-billing-records
// @desc Get all Utility Billing Records
// @access Protected
const getUtilityBillingRecords = asyncHandler(async (req, res) => {
  const { utility_account_id } = req.query;

  let billingRecords = [];

  if (isAdmin(req.user)) {
    const query = utility_account_id ? { utility_account_id } : {};

    billingRecords = await UtilityBillingRecord.find(query)
      .populate("utility_account_id", "account_number facility_id")
      .populate("auditor_id", "name email")
      .sort({ billing_period_start: -1 });
  } else {
    const utilities = await UtilityAccount.find();
    const allowedIds = [];

    for (const utility of utilities) {
      const access = await getAccessibleUtilityAccount(req.user, utility._id);
      if (access) {
        allowedIds.push(utility._id);
      }
    }

    const query = {
      utility_account_id: utility_account_id
        ? {
            $in: allowedIds.filter(
              (id) => id.toString() === utility_account_id.toString(),
            ),
          }
        : { $in: allowedIds },
    };

    billingRecords = await UtilityBillingRecord.find(query)
      .populate("utility_account_id", "account_number facility_id")
      .populate("auditor_id", "name email")
      .sort({ billing_period_start: -1 });
  }

  res.status(200).json({
    success: true,
    count: billingRecords.length,
    data: billingRecords,
  });
});

// @route GET /api/v1/utility-billing-records/:id
// @desc Get single Utility Billing Record
// @access Protected
const getUtilityBillingRecordById = asyncHandler(async (req, res) => {
  const billingRecord = await UtilityBillingRecord.findById(req.params.id)
    .populate("utility_account_id")
    .populate("auditor_id", "name email");

  if (!billingRecord) {
    res.status(404);
    throw new Error("Utility billing record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    billingRecord.utility_account_id._id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.status(200).json({
    success: true,
    data: billingRecord,
  });
});

// @route PUT /api/v1/utility-billing-records/:id
// @desc Update Utility Billing Record
// @access Protected
const updateUtilityBillingRecord = asyncHandler(async (req, res) => {
  const {
    billing_period_start,
    billing_period_end,
    billing_days,
    bill_no,
    mdi_kVA,
    units_kWh,
    units_kVAh,
    pf,
    fixed_charges_rs,
    energy_charges_rs,
    taxes_and_rent_rs,
    other_charges_rs,
    monthly_electricity_bill_rs,
    unit_consumption_per_day_kVAh,
    average_per_unit_cost_rs,
    audit_date,
    auditor_id,
  } = req.body;

  const billingRecord = await UtilityBillingRecord.findById(req.params.id);

  if (!billingRecord) {
    res.status(404);
    throw new Error("Utility billing record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    billingRecord.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  const nextBillingPeriodStart =
    billing_period_start ?? billingRecord.billing_period_start;
  const nextBillingPeriodEnd =
    billing_period_end ?? billingRecord.billing_period_end;

  if (billing_period_start !== undefined || billing_period_end !== undefined) {
    const existingRecord = await UtilityBillingRecord.findOne({
      utility_account_id: billingRecord.utility_account_id,
      billing_period_start: nextBillingPeriodStart,
      billing_period_end: nextBillingPeriodEnd,
      _id: { $ne: billingRecord._id },
    });

    if (existingRecord) {
      res.status(400);
      throw new Error("Billing record already exists for this billing period");
    }
  }

  const uploadedDocuments = await uploadBillingDocuments(req.files);

  billingRecord.billing_period_start =
    billing_period_start ?? billingRecord.billing_period_start;
  billingRecord.billing_period_end =
    billing_period_end ?? billingRecord.billing_period_end;
  billingRecord.billing_days =
    billing_days !== undefined
      ? parseNumber(billing_days)
      : billingRecord.billing_days;
  billingRecord.bill_no =
    bill_no !== undefined ? bill_no?.trim() : billingRecord.bill_no;
  billingRecord.mdi_kVA =
    mdi_kVA !== undefined ? parseNumber(mdi_kVA) : billingRecord.mdi_kVA;
  billingRecord.units_kWh =
    units_kWh !== undefined ? parseNumber(units_kWh) : billingRecord.units_kWh;
  billingRecord.units_kVAh =
    units_kVAh !== undefined
      ? parseNumber(units_kVAh)
      : billingRecord.units_kVAh;
  billingRecord.pf = pf !== undefined ? parseNumber(pf) : billingRecord.pf;
  billingRecord.fixed_charges_rs =
    fixed_charges_rs !== undefined
      ? parseNumber(fixed_charges_rs)
      : billingRecord.fixed_charges_rs;
  billingRecord.energy_charges_rs =
    energy_charges_rs !== undefined
      ? parseNumber(energy_charges_rs)
      : billingRecord.energy_charges_rs;
  billingRecord.taxes_and_rent_rs =
    taxes_and_rent_rs !== undefined
      ? parseNumber(taxes_and_rent_rs)
      : billingRecord.taxes_and_rent_rs;
  billingRecord.other_charges_rs =
    other_charges_rs !== undefined
      ? parseNumber(other_charges_rs)
      : billingRecord.other_charges_rs;
  billingRecord.monthly_electricity_bill_rs =
    monthly_electricity_bill_rs !== undefined
      ? parseNumber(monthly_electricity_bill_rs)
      : billingRecord.monthly_electricity_bill_rs;
  billingRecord.unit_consumption_per_day_kVAh =
    unit_consumption_per_day_kVAh !== undefined
      ? parseNumber(unit_consumption_per_day_kVAh)
      : billingRecord.unit_consumption_per_day_kVAh;
  billingRecord.average_per_unit_cost_rs =
    average_per_unit_cost_rs !== undefined
      ? parseNumber(average_per_unit_cost_rs)
      : billingRecord.average_per_unit_cost_rs;
  billingRecord.audit_date = audit_date ?? billingRecord.audit_date;
  billingRecord.auditor_id = auditor_id ?? billingRecord.auditor_id;

  if (uploadedDocuments.length > 0) {
    billingRecord.documents = [
      ...(billingRecord.documents || []),
      ...uploadedDocuments,
    ];
  }

  const updatedBillingRecord = await billingRecord.save();

  res.status(200).json({
    success: true,
    message: "Utility billing record updated successfully",
    data: updatedBillingRecord,
  });
});

// @route DELETE /api/v1/utility-billing-records/:id
// @desc Delete Utility Billing Record
// @access Protected
const deleteUtilityBillingRecord = asyncHandler(async (req, res) => {
  const billingRecord = await UtilityBillingRecord.findById(req.params.id);

  if (!billingRecord) {
    res.status(404);
    throw new Error("Utility billing record not found");
  }

  const utility = await getAccessibleUtilityAccount(
    req.user,
    billingRecord.utility_account_id,
  );

  if (!utility) {
    res.status(403);
    throw new Error("Access denied");
  }

  await billingRecord.deleteOne();

  res.status(200).json({
    success: true,
    message: "Utility billing record deleted successfully",
  });
});

export {
  createUtilityBillingRecord,
  getUtilityBillingRecords,
  getUtilityBillingRecordById,
  updateUtilityBillingRecord,
  deleteUtilityBillingRecord,
};
