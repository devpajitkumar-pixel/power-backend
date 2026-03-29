import UtilityTariff from "../../../../modals/utilityTarrif.js";
import UtilityAccount from "../../../../modals/utilityAccount.js";
import mongoose from "mongoose";

const normalizeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const formatNumber = (value, decimals = 2) => {
  const num = normalizeNumber(value);
  if (num === null) return "";
  return num.toFixed(decimals);
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB");
};

const getId = (value) => {
  if (!value) return "";

  // already string id
  if (typeof value === "string") return value;

  // direct _id
  if (value?._id) return String(value._id);

  // nested case (VERY IMPORTANT)
  if (value?.utility_account_id) {
    return getId(value.utility_account_id);
  }

  // avoid [object Object] fallback
  return "";
};

const buildUtilityAccountMap = (utilityAccounts = []) => {
  return new Map(
    utilityAccounts.filter(Boolean).map((account) => [getId(account), account]),
  );
};

const normalizeUtilityAccountMini = (account) => {
  if (!account) return null;

  return {
    id: getId(account),
    account_number: normalizeText(account.account_number),
    connection_type: normalizeText(account.connection_type),
    category: normalizeText(account.category),
  };
};

const normalizeTariffRecord = (tariff, index, utilityAccountMap) => {
  const linkedAccount =
    utilityAccountMap.get(getId(tariff?.utility_account_id)) ||
    tariff?.utility_account_id ||
    null;

  const basicEnergy = normalizeNumber(tariff?.basic_energy_charges_rs_per_unit);
  const fixedCharges = normalizeNumber(
    tariff?.fixed_charges_rs_per_kW_or_per_kVA,
  );
  const edPercent = normalizeNumber(tariff?.ed_percent);
  const octroi = normalizeNumber(tariff?.octroi_rs_per_unit);
  const surcharge = normalizeNumber(tariff?.surcharge_rs);
  const cowCess = normalizeNumber(tariff?.cow_cess_rs);
  const rental = normalizeNumber(tariff?.rental_rs);
  const infracess = normalizeNumber(tariff?.infracess_rs);
  const otherChargesOrRebates = normalizeNumber(
    tariff?.other_charges_or_rebates_rs,
  );
  const anyOther = normalizeNumber(tariff?.any_other_rs);

  return {
    id: getId(tariff),
    sr_no: index + 1,

    utility_account_id: getId(tariff?.utility_account_id),
    utility_account: normalizeUtilityAccountMini(linkedAccount),

    effective_from: tariff?.effective_from || null,
    effective_to: tariff?.effective_to || null,
    effective_from_label: formatDate(tariff?.effective_from),
    effective_to_label: tariff?.effective_to
      ? formatDate(tariff?.effective_to)
      : "Current",
    is_current: !tariff?.effective_to,

    basic_energy_charges_rs_per_unit: basicEnergy,
    fixed_charges_rs_per_kW_or_per_kVA: fixedCharges,
    ed_percent: edPercent,
    octroi_rs_per_unit: octroi,
    surcharge_rs: surcharge,
    cow_cess_rs: cowCess,
    rental_rs: rental,
    infracess_rs: infracess,
    other_charges_or_rebates_rs: otherChargesOrRebates,
    any_other_rs: anyOther,

    basic_energy_charges_rs_per_unit_label: formatNumber(basicEnergy),
    fixed_charges_rs_per_kW_or_per_kVA_label: formatNumber(fixedCharges),
    ed_percent_label: formatNumber(edPercent),
    octroi_rs_per_unit_label: formatNumber(octroi),
    surcharge_rs_label: formatNumber(surcharge),
    cow_cess_rs_label: formatNumber(cowCess),
    rental_rs_label: formatNumber(rental),
    infracess_rs_label: formatNumber(infracess),
    other_charges_or_rebates_rs_label: formatNumber(otherChargesOrRebates),
    any_other_rs_label: formatNumber(anyOther),
  };
};

const fetchFacilityUtilityAccounts = async (facilityId) => {
  if (!facilityId) return [];

  const accounts = await UtilityAccount.find({
    facility_id: facilityId,
  }).lean();

  return Array.isArray(accounts) ? accounts : [];
};

const fetchTariffsByUtilityAccountIds = async (utilityAccountIds = []) => {
  const validIds = utilityAccountIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!validIds.length) return [];

  const tariffs = await UtilityTariff.find({
    utility_account_id: { $in: validIds },
  })
    .sort({ utility_account_id: 1, effective_from: -1, createdAt: -1 })
    .lean();

  return Array.isArray(tariffs) ? tariffs : [];
};

const buildSummary = (items = []) => {
  const currentTariffs = items.filter((item) => item.is_current);

  return {
    total_tariffs: items.length,
    total_current_tariffs: currentTariffs.length,
    total_historical_tariffs: items.length - currentTariffs.length,

    average_basic_energy_charges_rs_per_unit:
      currentTariffs.length > 0
        ? Number(
            (
              currentTariffs.reduce(
                (sum, item) =>
                  sum +
                  (normalizeNumber(item.basic_energy_charges_rs_per_unit) || 0),
                0,
              ) / currentTariffs.length
            ).toFixed(2),
          )
        : null,

    average_fixed_charges_rs_per_kW_or_per_kVA:
      currentTariffs.length > 0
        ? Number(
            (
              currentTariffs.reduce(
                (sum, item) =>
                  sum +
                  (normalizeNumber(item.fixed_charges_rs_per_kW_or_per_kVA) ||
                    0),
                0,
              ) / currentTariffs.length
            ).toFixed(2),
          )
        : null,
  };
};

export const buildTariffSection = async ({
  report,
  meta,
  facility,
  utilityAccount = null,
  utilityAccounts = [],
  scope = "facility",
}) => {
  if (!report) {
    const error = new Error("report is required in buildTariffSection");
    error.statusCode = 500;
    throw error;
  }

  if (!facility) {
    const error = new Error("facility is required in buildTariffSection");
    error.statusCode = 500;
    throw error;
  }

  let resolvedUtilityAccounts = Array.isArray(utilityAccounts)
    ? utilityAccounts.filter(Boolean)
    : [];

  if (scope === "utility_account") {
    if (utilityAccount) {
      resolvedUtilityAccounts = [utilityAccount];
    } else if (meta?.utility_account_id) {
      const found = await UtilityAccount.findById(
        meta.utility_account_id,
      ).lean();
      resolvedUtilityAccounts = found ? [found] : [];
    }
  } else if (!resolvedUtilityAccounts.length) {
    resolvedUtilityAccounts = await fetchFacilityUtilityAccounts(facility?._id);
  }

  const utilityAccountIds = resolvedUtilityAccounts
    .map((item) => {
      if (!item) return null;

      // case 1: already ObjectId string
      if (typeof item === "string") return item;

      // case 2: mongoose doc / object
      if (item._id) return String(item._id);

      // case 3: nested object (IMPORTANT FIX)
      if (item.utility_account_id) {
        if (typeof item.utility_account_id === "string") {
          return item.utility_account_id;
        }
        if (item.utility_account_id._id) {
          return String(item.utility_account_id._id);
        }
      }

      return null;
    })
    .filter(Boolean);
  const utilityAccountMap = buildUtilityAccountMap(resolvedUtilityAccounts);

  const tariffs = await fetchTariffsByUtilityAccountIds(utilityAccountIds);

  const items = tariffs.map((tariff, index) =>
    normalizeTariffRecord(tariff, index, utilityAccountMap),
  );

  const summary = buildSummary(items);

  return {
    title: "Utility Tariff",
    scope,
    facility_id: getId(facility),
    utility_account_id:
      scope === "utility_account" ? getId(utilityAccount) : "",
    report_type: report?.report_type || meta?.report_type || "",
    total_tariffs: items.length,

    items,
    summary,

    sections: [
      {
        heading: "Tariff Applicability",
        columns: [
          "sr_no",
          "account_number",
          "connection_type",
          "category",
          "effective_from_label",
          "effective_to_label",
          "status",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          account_number: item.utility_account?.account_number || "",
          connection_type: item.utility_account?.connection_type || "",
          category: item.utility_account?.category || "",
          effective_from_label: item.effective_from_label,
          effective_to_label: item.effective_to_label,
          status: item.is_current ? "Current" : "Historical",
        })),
      },

      {
        heading: "Core Tariff Charges",
        columns: [
          "sr_no",
          "account_number",
          "basic_energy_charges_rs_per_unit_label",
          "fixed_charges_rs_per_kW_or_per_kVA_label",
          "ed_percent_label",
          "octroi_rs_per_unit_label",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          account_number: item.utility_account?.account_number || "",
          basic_energy_charges_rs_per_unit_label:
            item.basic_energy_charges_rs_per_unit_label,
          fixed_charges_rs_per_kW_or_per_kVA_label:
            item.fixed_charges_rs_per_kW_or_per_kVA_label,
          ed_percent_label: item.ed_percent_label,
          octroi_rs_per_unit_label: item.octroi_rs_per_unit_label,
        })),
      },

      {
        heading: "Additional Charges & Adjustments",
        columns: [
          "sr_no",
          "account_number",
          "surcharge_rs_label",
          "cow_cess_rs_label",
          "rental_rs_label",
          "infracess_rs_label",
          "other_charges_or_rebates_rs_label",
          "any_other_rs_label",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          account_number: item.utility_account?.account_number || "",
          surcharge_rs_label: item.surcharge_rs_label,
          cow_cess_rs_label: item.cow_cess_rs_label,
          rental_rs_label: item.rental_rs_label,
          infracess_rs_label: item.infracess_rs_label,
          other_charges_or_rebates_rs_label:
            item.other_charges_or_rebates_rs_label,
          any_other_rs_label: item.any_other_rs_label,
        })),
      },

      {
        heading: "Tariff Summary",
        columns: ["metric", "value"],
        rows: [
          {
            metric: "Total Tariffs",
            value: summary.total_tariffs ?? "",
          },
          {
            metric: "Current Tariffs",
            value: summary.total_current_tariffs ?? "",
          },
          {
            metric: "Historical Tariffs",
            value: summary.total_historical_tariffs ?? "",
          },
          {
            metric: "Average Current Energy Charges (Rs/Unit)",
            value:
              summary.average_basic_energy_charges_rs_per_unit !== null
                ? formatNumber(summary.average_basic_energy_charges_rs_per_unit)
                : "",
          },
          {
            metric: "Average Current Fixed Charges (Rs/kW or kVA)",
            value:
              summary.average_fixed_charges_rs_per_kW_or_per_kVA !== null
                ? formatNumber(
                    summary.average_fixed_charges_rs_per_kW_or_per_kVA,
                  )
                : "",
          },
        ],
      },
    ],

    table_columns: [
      { key: "sr_no", label: "Sr No" },
      { key: "account_number", label: "Account Number" },
      { key: "effective_from_label", label: "Effective From" },
      { key: "effective_to_label", label: "Effective To" },
      {
        key: "basic_energy_charges_rs_per_unit_label",
        label: "Energy Charges (Rs/Unit)",
      },
      {
        key: "fixed_charges_rs_per_kW_or_per_kVA_label",
        label: "Fixed Charges (Rs/kW or kVA)",
      },
      { key: "ed_percent_label", label: "ED (%)" },
      { key: "surcharge_rs_label", label: "Surcharge (Rs)" },
    ],

    table_rows: items.map((item) => ({
      sr_no: item.sr_no,
      account_number: item.utility_account?.account_number || "",
      effective_from_label: item.effective_from_label,
      effective_to_label: item.effective_to_label,
      basic_energy_charges_rs_per_unit_label:
        item.basic_energy_charges_rs_per_unit_label,
      fixed_charges_rs_per_kW_or_per_kVA_label:
        item.fixed_charges_rs_per_kW_or_per_kVA_label,
      ed_percent_label: item.ed_percent_label,
      surcharge_rs_label: item.surcharge_rs_label,
    })),
  };
};

export default buildTariffSection;
