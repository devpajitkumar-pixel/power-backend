import mongoose from "mongoose";
import UtilityBillingRecord from "../../../../modals/utilityBillingRecord.js";
import UtilityAccount from "../../../../modals/utilityAccount.js";

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

const formatDateRange = (start, end) => {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel || endLabel || "";
};

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(String(value));

const getId = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned || cleaned === "[object Object]") return "";
    return cleaned;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return String(value);
  }

  if (value?._id) {
    const nestedId =
      typeof value._id === "object" ? getId(value._id) : String(value._id);
    return nestedId === "[object Object]" ? "" : nestedId;
  }

  if (value?.id) {
    const nestedId =
      typeof value.id === "object" ? getId(value.id) : String(value.id);
    return nestedId === "[object Object]" ? "" : nestedId;
  }

  if (value?.utility_account_id?._id) {
    return getId(value.utility_account_id._id);
  }

  if (value?.utility_account_id?.id) {
    return getId(value.utility_account_id.id);
  }

  if (
    value?.utility_account_id &&
    typeof value.utility_account_id === "string" &&
    value.utility_account_id !== "[object Object]"
  ) {
    return value.utility_account_id.trim();
  }

  if (value?.toString && typeof value.toString === "function") {
    const str = String(value.toString()).trim();
    return str === "[object Object]" ? "" : str;
  }

  return "";
};

const toObjectIdArray = (values = []) => {
  return values
    .map((value) => getId(value))
    .filter((id) => id && isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
};

const buildUtilityAccountMap = (utilityAccounts = []) => {
  return new Map(
    utilityAccounts
      .filter(Boolean)
      .map((account) => [getId(account), account])
      .filter(([id]) => Boolean(id)),
  );
};

const normalizeUtilityAccountMini = (account, index = 0) => {
  if (!account) return null;

  const sanctionedDemand = normalizeNumber(account.sanctioned_demand_kVA);

  return {
    id: getId(account),
    _id: getId(account),
    sr_no: index + 1,
    account_number: normalizeText(account.account_number),
    connection_type: normalizeText(account.connection_type),
    category: normalizeText(account.category),
    provider: normalizeText(account.provider),
    billing_cycle: normalizeText(account.billing_cycle),
    sanctioned_demand_kVA: sanctionedDemand,
    sanctioned_demand_kVA_label:
      sanctionedDemand !== null ? formatNumber(sanctionedDemand) : "",
  };
};

const calculateBillingDays = (record) => {
  const existing = normalizeNumber(record?.billing_days);
  if (existing !== null) return existing;

  const start = record?.billing_period_start
    ? new Date(record.billing_period_start)
    : null;
  const end = record?.billing_period_end
    ? new Date(record.billing_period_end)
    : null;

  if (
    start &&
    end &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end >= start
  ) {
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  return null;
};

const calculatePf = (record) => {
  const pf = normalizeNumber(record?.pf);
  if (pf !== null) return pf;

  const kWh = normalizeNumber(record?.units_kWh);
  const kVAh = normalizeNumber(record?.units_kVAh);

  if (kWh !== null && kVAh !== null && kVAh > 0) {
    return Number((kWh / kVAh).toFixed(4));
  }

  return null;
};

const calculateMonthlyBill = (record) => {
  const existing = normalizeNumber(record?.monthly_electricity_bill_rs);
  if (existing !== null) return existing;

  const fixed = normalizeNumber(record?.fixed_charges_rs) || 0;
  const energy = normalizeNumber(record?.energy_charges_rs) || 0;
  const taxes = normalizeNumber(record?.taxes_and_rent_rs) || 0;
  const other = normalizeNumber(record?.other_charges_rs) || 0;

  return Number((fixed + energy + taxes + other).toFixed(2));
};

const calculateUnitConsumptionPerDay = (record, resolvedBillingDays = null) => {
  const existing = normalizeNumber(record?.unit_consumption_per_day_kVAh);
  if (existing !== null) return existing;

  const unitsKVAh = normalizeNumber(record?.units_kVAh);
  const billingDays =
    resolvedBillingDays !== null
      ? resolvedBillingDays
      : normalizeNumber(record?.billing_days);

  if (unitsKVAh !== null && billingDays !== null && billingDays > 0) {
    return Number((unitsKVAh / billingDays).toFixed(2));
  }

  return null;
};

const calculateAveragePerUnitCost = (record, monthlyBill) => {
  const existing = normalizeNumber(record?.average_per_unit_cost_rs);
  if (existing !== null) return existing;

  const unitsKVAh = normalizeNumber(record?.units_kVAh);
  if (unitsKVAh !== null && unitsKVAh > 0) {
    return Number((monthlyBill / unitsKVAh).toFixed(2));
  }

  const unitsKWh = normalizeNumber(record?.units_kWh);
  if (unitsKWh !== null && unitsKWh > 0) {
    return Number((monthlyBill / unitsKWh).toFixed(2));
  }

  return null;
};

const normalizeBillingRecord = (record, account, index = 0) => {
  const billingDays = calculateBillingDays(record);

  const mdiKVA = normalizeNumber(record?.mdi_kVA);
  const unitsKWh = normalizeNumber(record?.units_kWh);
  const unitsKVAh = normalizeNumber(record?.units_kVAh);
  const fixedCharges = normalizeNumber(record?.fixed_charges_rs);
  const energyCharges = normalizeNumber(record?.energy_charges_rs);
  const taxesAndRent = normalizeNumber(record?.taxes_and_rent_rs);
  const otherCharges = normalizeNumber(record?.other_charges_rs);

  const pf = calculatePf(record);
  const monthlyBill = calculateMonthlyBill(record);
  const unitConsumptionPerDay = calculateUnitConsumptionPerDay(
    record,
    billingDays,
  );
  const averagePerUnitCost = calculateAveragePerUnitCost(record, monthlyBill);

  const sanctionedDemand = normalizeNumber(
    account?.sanctioned_demand_kVA ??
      record?.utility_account_id?.sanctioned_demand_kVA,
  );

  return {
    id: getId(record),
    sr_no: index + 1,

    bill_no: normalizeText(record?.bill_no),

    utility_account_id: getId(record?.utility_account_id) || account?.id || "",
    utility_account: account || null,
    account_number:
      account?.account_number ||
      normalizeText(record?.utility_account_id?.account_number),
    connection_type:
      account?.connection_type ||
      normalizeText(record?.utility_account_id?.connection_type),
    category:
      account?.category || normalizeText(record?.utility_account_id?.category),

    provider:
      account?.provider || normalizeText(record?.utility_account_id?.provider),
    billing_cycle:
      account?.billing_cycle ||
      normalizeText(record?.utility_account_id?.billing_cycle),
    sanctioned_demand_kVA: sanctionedDemand,
    sanctioned_demand_kVA_label:
      sanctionedDemand !== null ? formatNumber(sanctionedDemand) : "",

    billing_period_start: record?.billing_period_start || null,
    billing_period_end: record?.billing_period_end || null,
    billing_period_start_label: formatDate(record?.billing_period_start),
    billing_period_end_label: formatDate(record?.billing_period_end),
    billing_period_label: formatDateRange(
      record?.billing_period_start,
      record?.billing_period_end,
    ),

    billing_days: billingDays,
    billing_days_label: billingDays !== null ? String(billingDays) : "",

    mdi_kVA: mdiKVA,
    mdi_kVA_label: mdiKVA !== null ? formatNumber(mdiKVA) : "",

    units_kWh: unitsKWh,
    units_kWh_label: unitsKWh !== null ? formatNumber(unitsKWh) : "",

    units_kVAh: unitsKVAh,
    units_kVAh_label: unitsKVAh !== null ? formatNumber(unitsKVAh) : "",

    pf,
    pf_label: pf !== null ? Number(pf).toFixed(4) : "",

    fixed_charges_rs: fixedCharges,
    fixed_charges_rs_label:
      fixedCharges !== null ? formatNumber(fixedCharges) : "",

    energy_charges_rs: energyCharges,
    energy_charges_rs_label:
      energyCharges !== null ? formatNumber(energyCharges) : "",

    taxes_and_rent_rs: taxesAndRent,
    taxes_and_rent_rs_label:
      taxesAndRent !== null ? formatNumber(taxesAndRent) : "",

    other_charges_rs: otherCharges,
    other_charges_rs_label:
      otherCharges !== null ? formatNumber(otherCharges) : "",

    monthly_electricity_bill_rs: monthlyBill,
    monthly_electricity_bill_rs_label:
      monthlyBill !== null ? formatNumber(monthlyBill) : "",

    unit_consumption_per_day_kVAh: unitConsumptionPerDay,
    unit_consumption_per_day_kVAh_label:
      unitConsumptionPerDay !== null ? formatNumber(unitConsumptionPerDay) : "",

    average_per_unit_cost_rs: averagePerUnitCost,
    average_per_unit_cost_rs_label:
      averagePerUnitCost !== null ? formatNumber(averagePerUnitCost) : "",

    audit_date: record?.audit_date || null,
    auditor_id: getId(record?.auditor_id),
    documents: Array.isArray(record?.documents) ? record.documents : [],

    created_at: record?.createdAt || record?.created_at || null,
    updated_at: record?.updatedAt || record?.updated_at || null,
  };
};

const fetchFacilityUtilityAccounts = async (facilityId) => {
  const resolvedFacilityId = getId(facilityId);
  if (!resolvedFacilityId || !isValidObjectId(resolvedFacilityId)) return [];

  const accounts = await UtilityAccount.find({
    facility_id: new mongoose.Types.ObjectId(resolvedFacilityId),
  })
    .sort({ created_at: 1, createdAt: 1 })
    .lean();

  return Array.isArray(accounts) ? accounts : [];
};

const fetchBillingRecordsByUtilityAccountIds = async (
  utilityAccountIds = [],
) => {
  const validObjectIds = toObjectIdArray(utilityAccountIds);

  if (!validObjectIds.length) return [];

  const billingRecords = await UtilityBillingRecord.find({
    utility_account_id: { $in: validObjectIds },
  })
    .populate(
      "utility_account_id",
      "account_number connection_type category provider billing_cycle sanctioned_demand_kVA",
    )
    .sort({
      utility_account_id: 1,
      billing_period_start: -1,
      billing_period_end: -1,
      created_at: -1,
      createdAt: -1,
    })
    .lean();

  return Array.isArray(billingRecords) ? billingRecords : [];
};

const buildRecordSummary = (items = []) => {
  const totalMonthlyBill = items.reduce(
    (sum, item) =>
      sum + (normalizeNumber(item.monthly_electricity_bill_rs) || 0),
    0,
  );

  const totalUnitsKWh = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.units_kWh) || 0),
    0,
  );

  const totalUnitsKVAh = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.units_kVAh) || 0),
    0,
  );

  const totalFixedCharges = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.fixed_charges_rs) || 0),
    0,
  );

  const totalEnergyCharges = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.energy_charges_rs) || 0),
    0,
  );

  const totalTaxesAndRent = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.taxes_and_rent_rs) || 0),
    0,
  );

  const totalOtherCharges = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.other_charges_rs) || 0),
    0,
  );

  const totalMdiKVA = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.mdi_kVA) || 0),
    0,
  );

  const pfItems = items.filter((item) => normalizeNumber(item.pf) !== null);
  const totalPf = pfItems.reduce(
    (sum, item) => sum + (normalizeNumber(item.pf) || 0),
    0,
  );

  const latestPeriodEnd =
    items
      .map((item) => item.billing_period_end)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  return {
    total_records: items.length,
    total_monthly_electricity_bill_rs: Number(totalMonthlyBill.toFixed(2)),
    total_units_kWh: Number(totalUnitsKWh.toFixed(2)),
    total_units_kVAh: Number(totalUnitsKVAh.toFixed(2)),
    total_fixed_charges_rs: Number(totalFixedCharges.toFixed(2)),
    total_energy_charges_rs: Number(totalEnergyCharges.toFixed(2)),
    total_taxes_and_rent_rs: Number(totalTaxesAndRent.toFixed(2)),
    total_other_charges_rs: Number(totalOtherCharges.toFixed(2)),

    average_monthly_bill_rs:
      items.length > 0
        ? Number((totalMonthlyBill / items.length).toFixed(2))
        : null,

    average_units_kWh:
      items.length > 0
        ? Number((totalUnitsKWh / items.length).toFixed(2))
        : null,

    average_units_kVAh:
      items.length > 0
        ? Number((totalUnitsKVAh / items.length).toFixed(2))
        : null,

    average_mdi_kVA:
      items.length > 0 ? Number((totalMdiKVA / items.length).toFixed(2)) : null,

    average_pf:
      pfItems.length > 0 ? Number((totalPf / pfItems.length).toFixed(4)) : null,

    latest_billing_period_end: latestPeriodEnd,
    latest_billing_period_end_label: formatDate(latestPeriodEnd),

    grid_cost_per_kVAh_rs:
      totalUnitsKVAh > 0
        ? Number((totalMonthlyBill / totalUnitsKVAh).toFixed(2))
        : null,

    grid_cost_per_kWh_rs:
      totalUnitsKWh > 0
        ? Number((totalMonthlyBill / totalUnitsKWh).toFixed(2))
        : null,
  };
};

const buildBillingGroups = ({ utilityAccounts = [], billingRecords = [] }) => {
  const groups = new Map();

  utilityAccounts.forEach((account, index) => {
    const normalizedAccount = normalizeUtilityAccountMini(account, index);
    const accountId = normalizedAccount?.id;

    if (!accountId) return;

    groups.set(accountId, {
      account: normalizedAccount,
      records: [],
      summary: null,
    });
  });

  billingRecords.forEach((record) => {
    const accountId = getId(record?.utility_account_id);
    if (!accountId) return;

    if (!groups.has(accountId)) {
      const fallbackAccount = normalizeUtilityAccountMini(
        record?.utility_account_id,
        groups.size,
      ) || {
        id: accountId,
        _id: accountId,
        sr_no: groups.size + 1,
        account_number: "Unknown Account",
        connection_type: "",
        category: "",
        provider: "",
        billing_cycle: "",
        sanctioned_demand_kVA: null,
        sanctioned_demand_kVA_label: "",
      };

      groups.set(accountId, {
        account: fallbackAccount,
        records: [],
        summary: null,
      });
    }

    const group = groups.get(accountId);
    const normalizedRecord = normalizeBillingRecord(
      record,
      group.account,
      group.records.length,
    );
    group.records.push(normalizedRecord);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    summary: buildRecordSummary(group.records),
  }));
};

const buildGroupedSections = (billingGroups = [], overallSummary) => {
  const sections = [];

  sections.push({
    heading: "Billing Accounts Summary",
    columns: [
      "sr_no",
      "account_number",
      "connection_type",
      "category",
      "provider",
      "billing_cycle",
      "sanctioned_demand_kVA_label",
      "total_records",
      "total_units_kWh",
      "total_units_kVAh",
      "total_monthly_electricity_bill_rs",
      "grid_cost_per_kWh_rs",
    ],
    rows: billingGroups.map((group) => ({
      sr_no: group.account.sr_no,
      account_number: group.account.account_number,
      connection_type: group.account.connection_type,
      category: group.account.category,
      provider: group.account.provider,
      billing_cycle: group.account.billing_cycle,
      sanctioned_demand_kVA_label: group.account.sanctioned_demand_kVA_label,
      total_records: group.summary.total_records,
      total_units_kWh: formatNumber(group.summary.total_units_kWh),
      total_units_kVAh: formatNumber(group.summary.total_units_kVAh),
      total_monthly_electricity_bill_rs: formatNumber(
        group.summary.total_monthly_electricity_bill_rs,
      ),
      grid_cost_per_kWh_rs:
        group.summary.grid_cost_per_kWh_rs !== null
          ? formatNumber(group.summary.grid_cost_per_kWh_rs)
          : "",
    })),
  });

  billingGroups.forEach((group) => {
    sections.push({
      heading: `${group.account.account_number || "Utility Account"} - Details`,
      columns: ["field", "value"],
      rows: [
        { field: "Account Number", value: group.account.account_number || "" },
        {
          field: "Connection Type",
          value: group.account.connection_type || "",
        },
        { field: "Category", value: group.account.category || "" },
        { field: "Provider", value: group.account.provider || "" },
        { field: "Billing Cycle", value: group.account.billing_cycle || "" },
        {
          field: "Sanctioned Demand (kVA)",
          value: group.account.sanctioned_demand_kVA_label || "",
        },
      ],
    });

    sections.push({
      heading: `${group.account.account_number || "Utility Account"} - Billing Records`,
      columns: [
        "sr_no",
        "bill_no",
        "provider",
        "billing_cycle",
        "sanctioned_demand_kVA_label",
        "billing_period_label",
        "billing_days_label",
        "mdi_kVA_label",
        "units_kWh_label",
        "units_kVAh_label",
        "pf_label",
        "monthly_electricity_bill_rs_label",
        "average_per_unit_cost_rs_label",
      ],
      rows: group.records.map((item) => ({
        sr_no: item.sr_no,
        bill_no: item.bill_no,
        provider: item.provider || "",
        billing_cycle: item.billing_cycle || "",
        sanctioned_demand_kVA_label: item.sanctioned_demand_kVA_label || "",
        billing_period_label: item.billing_period_label,
        billing_days_label: item.billing_days_label,
        mdi_kVA_label: item.mdi_kVA_label,
        units_kWh_label: item.units_kWh_label,
        units_kVAh_label: item.units_kVAh_label,
        pf_label: item.pf_label,
        monthly_electricity_bill_rs_label:
          item.monthly_electricity_bill_rs_label,
        average_per_unit_cost_rs_label: item.average_per_unit_cost_rs_label,
      })),
    });

    sections.push({
      heading: `${group.account.account_number || "Utility Account"} - Charge Breakdown`,
      columns: [
        "sr_no",
        "bill_no",
        "fixed_charges_rs_label",
        "energy_charges_rs_label",
        "taxes_and_rent_rs_label",
        "other_charges_rs_label",
        "monthly_electricity_bill_rs_label",
      ],
      rows: group.records.map((item) => ({
        sr_no: item.sr_no,
        bill_no: item.bill_no,
        fixed_charges_rs_label: item.fixed_charges_rs_label,
        energy_charges_rs_label: item.energy_charges_rs_label,
        taxes_and_rent_rs_label: item.taxes_and_rent_rs_label,
        other_charges_rs_label: item.other_charges_rs_label,
        monthly_electricity_bill_rs_label:
          item.monthly_electricity_bill_rs_label,
      })),
    });

    sections.push({
      heading: `${group.account.account_number || "Utility Account"} - Summary`,
      columns: ["metric", "value"],
      rows: [
        { metric: "Total Records", value: group.summary.total_records },
        {
          metric: "Total Monthly Electricity Bill (Rs)",
          value: formatNumber(group.summary.total_monthly_electricity_bill_rs),
        },
        {
          metric: "Total Units (kWh)",
          value: formatNumber(group.summary.total_units_kWh),
        },
        {
          metric: "Total Units (kVAh)",
          value: formatNumber(group.summary.total_units_kVAh),
        },
        {
          metric: "Average Monthly Bill (Rs)",
          value:
            group.summary.average_monthly_bill_rs !== null
              ? formatNumber(group.summary.average_monthly_bill_rs)
              : "",
        },
        {
          metric: "Average Units (kWh)",
          value:
            group.summary.average_units_kWh !== null
              ? formatNumber(group.summary.average_units_kWh)
              : "",
        },
        {
          metric: "Average Units (kVAh)",
          value:
            group.summary.average_units_kVAh !== null
              ? formatNumber(group.summary.average_units_kVAh)
              : "",
        },
        {
          metric: "Average MDI (kVA)",
          value:
            group.summary.average_mdi_kVA !== null
              ? formatNumber(group.summary.average_mdi_kVA)
              : "",
        },
        {
          metric: "Average PF",
          value:
            group.summary.average_pf !== null
              ? Number(group.summary.average_pf).toFixed(4)
              : "",
        },
        {
          metric: "Grid Cost per kVAh (Rs)",
          value:
            group.summary.grid_cost_per_kVAh_rs !== null
              ? formatNumber(group.summary.grid_cost_per_kVAh_rs)
              : "",
        },
        {
          metric: "Grid Cost per kWh (Rs)",
          value:
            group.summary.grid_cost_per_kWh_rs !== null
              ? formatNumber(group.summary.grid_cost_per_kWh_rs)
              : "",
        },
        {
          metric: "Latest Billing Period End",
          value: group.summary.latest_billing_period_end_label || "",
        },
      ],
    });
  });

  sections.push({
    heading: "Overall Billing Summary",
    columns: ["metric", "value"],
    rows: [
      { metric: "Total Utility Accounts", value: billingGroups.length },
      { metric: "Total Billing Records", value: overallSummary.total_records },
      {
        metric: "Total Monthly Electricity Bill (Rs)",
        value: formatNumber(overallSummary.total_monthly_electricity_bill_rs),
      },
      {
        metric: "Total Units (kWh)",
        value: formatNumber(overallSummary.total_units_kWh),
      },
      {
        metric: "Total Units (kVAh)",
        value: formatNumber(overallSummary.total_units_kVAh),
      },
      {
        metric: "Total Fixed Charges (Rs)",
        value: formatNumber(overallSummary.total_fixed_charges_rs),
      },
      {
        metric: "Total Energy Charges (Rs)",
        value: formatNumber(overallSummary.total_energy_charges_rs),
      },
      {
        metric: "Total Taxes and Rent (Rs)",
        value: formatNumber(overallSummary.total_taxes_and_rent_rs),
      },
      {
        metric: "Total Other Charges (Rs)",
        value: formatNumber(overallSummary.total_other_charges_rs),
      },
      {
        metric: "Average Monthly Bill (Rs)",
        value:
          overallSummary.average_monthly_bill_rs !== null
            ? formatNumber(overallSummary.average_monthly_bill_rs)
            : "",
      },
      {
        metric: "Average Units (kWh)",
        value:
          overallSummary.average_units_kWh !== null
            ? formatNumber(overallSummary.average_units_kWh)
            : "",
      },
      {
        metric: "Average Units (kVAh)",
        value:
          overallSummary.average_units_kVAh !== null
            ? formatNumber(overallSummary.average_units_kVAh)
            : "",
      },
      {
        metric: "Average MDI (kVA)",
        value:
          overallSummary.average_mdi_kVA !== null
            ? formatNumber(overallSummary.average_mdi_kVA)
            : "",
      },
      {
        metric: "Average PF",
        value:
          overallSummary.average_pf !== null
            ? Number(overallSummary.average_pf).toFixed(4)
            : "",
      },
      {
        metric: "Latest Billing Period End",
        value: overallSummary.latest_billing_period_end_label || "",
      },
      {
        metric: "Grid Cost per kVAh (Rs)",
        value:
          overallSummary.grid_cost_per_kVAh_rs !== null
            ? formatNumber(overallSummary.grid_cost_per_kVAh_rs)
            : "",
      },
      {
        metric: "Grid Cost per kWh (Rs)",
        value:
          overallSummary.grid_cost_per_kWh_rs !== null
            ? formatNumber(overallSummary.grid_cost_per_kWh_rs)
            : "",
      },
    ],
  });

  return sections;
};

export const buildBillingSection = async ({
  report,
  meta,
  facility,
  utilityAccount = null,
  utilityAccounts = [],
  scope = "facility",
}) => {
  if (!report) {
    const error = new Error("report is required in buildBillingSection");
    error.statusCode = 500;
    throw error;
  }

  if (!facility) {
    const error = new Error("facility is required in buildBillingSection");
    error.statusCode = 500;
    throw error;
  }

  let resolvedUtilityAccounts = [];

  if (scope === "utility_account") {
    const resolvedUtilityAccountId =
      getId(utilityAccount) || getId(meta?.utility_account_id);

    if (resolvedUtilityAccountId && isValidObjectId(resolvedUtilityAccountId)) {
      const found = await UtilityAccount.findById(
        resolvedUtilityAccountId,
      ).lean();
      resolvedUtilityAccounts = found ? [found] : [];
    }
  } else {
    resolvedUtilityAccounts = await fetchFacilityUtilityAccounts(
      facility?._id || facility?.id,
    );
  }

  const utilityAccountIds = resolvedUtilityAccounts
    .map((item) => getId(item))
    .filter((id) => id && isValidObjectId(id));

  const utilityAccountMap = buildUtilityAccountMap(resolvedUtilityAccounts);

  const rawBillingRecords =
    await fetchBillingRecordsByUtilityAccountIds(utilityAccountIds);

  const billingRecords = rawBillingRecords.map((record) => {
    const accountId = getId(record?.utility_account_id);

    if (accountId && utilityAccountMap.has(accountId)) {
      return {
        ...record,
        utility_account_id: {
          ...utilityAccountMap.get(accountId),
          ...(record.utility_account_id || {}),
        },
      };
    }

    return record;
  });

  const billingGroups = buildBillingGroups({
    utilityAccounts: resolvedUtilityAccounts,
    billingRecords,
  });

  const flatItems = billingGroups.flatMap((group) => group.records);
  const overallSummary = buildRecordSummary(flatItems);
  const sections = buildGroupedSections(billingGroups, overallSummary);

  return {
    title: "Utility Billing Records",
    key: "billing_records",
    scope,
    facility_id: getId(facility),
    utility_account_id:
      scope === "utility_account" ? getId(utilityAccount) : "",
    report_type: report?.report_type || meta?.report_type || "",
    total_billing_records: flatItems.length,

    billing_groups: billingGroups,

    items: flatItems,
    summary: overallSummary,

    sections,

    table_columns: [
      { key: "sr_no", label: "Sr No" },
      { key: "account_number", label: "Account Number" },
      { key: "provider", label: "Provider" },
      { key: "billing_cycle", label: "Billing Cycle" },
      {
        key: "sanctioned_demand_kVA_label",
        label: "Sanctioned Demand (kVA)",
      },
      { key: "bill_no", label: "Bill No" },
      { key: "billing_period_label", label: "Billing Period" },
      { key: "units_kWh_label", label: "Units (kWh)" },
      { key: "units_kVAh_label", label: "Units (kVAh)" },
      { key: "pf_label", label: "PF" },
      { key: "monthly_electricity_bill_rs_label", label: "Monthly Bill (Rs)" },
      {
        key: "average_per_unit_cost_rs_label",
        label: "Avg / Unit Cost (Rs)",
      },
    ],

    table_rows: flatItems.map((item) => ({
      sr_no: item.sr_no,
      account_number:
        item.account_number || item.utility_account?.account_number || "",
      provider: item.provider || "",
      billing_cycle: item.billing_cycle || "",
      sanctioned_demand_kVA_label: item.sanctioned_demand_kVA_label || "",
      bill_no: item.bill_no,
      billing_period_label: item.billing_period_label,
      units_kWh_label: item.units_kWh_label,
      units_kVAh_label: item.units_kVAh_label,
      pf_label: item.pf_label,
      monthly_electricity_bill_rs_label: item.monthly_electricity_bill_rs_label,
      average_per_unit_cost_rs_label: item.average_per_unit_cost_rs_label,
    })),
  };
};

export default buildBillingSection;
