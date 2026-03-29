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

const normalizeBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  return Boolean(value);
};

const getId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value?._id) return String(value._id);
  if (value?.id) return String(value.id);
  if (value?.toString && typeof value.toString === "function") {
    const str = String(value.toString());
    return str === "[object Object]" ? "" : str;
  }
  return "";
};

const normalizeDocument = (doc) => {
  if (!doc) return null;

  return {
    fileUrl: normalizeText(doc.fileUrl),
    fileName: normalizeText(doc.fileName),
    fileType: normalizeText(doc.fileType),
    uploadedAt: doc.uploadedAt || null,
  };
};

const formatNumber = (value, decimals = 2) => {
  const num = normalizeNumber(value);
  if (num === null) return "";
  return num.toFixed(decimals);
};

const normalizeUtilityAccount = (account, index = 0) => {
  const sanctionedDemand = normalizeNumber(account?.sanctioned_demand_kVA);

  const normalized = {
    id: getId(account),
    _id: getId(account),
    sr_no: index + 1,

    facility_id: getId(account?.facility_id),

    account_number: normalizeText(account?.account_number),
    connection_type: normalizeText(account?.connection_type),
    category: normalizeText(account?.category),

    sanctioned_demand_kVA: sanctionedDemand,
    sanctioned_demand_kVA_label:
      sanctionedDemand !== null ? formatNumber(sanctionedDemand) : "",

    is_solar_connected: normalizeBoolean(account?.is_solar_connected),
    is_dg_connected: normalizeBoolean(account?.is_dg_connected),
    is_transformer_connected: normalizeBoolean(
      account?.is_transformer_connected,
    ),
    is_pump_connected: normalizeBoolean(account?.is_pump_connected),
    is_transformer_maintained_by_facility: normalizeBoolean(
      account?.is_transformer_maintained_by_facility,
    ),
    is_active:
      account?.is_active === undefined
        ? true
        : normalizeBoolean(account?.is_active, true),

    flags: {
      solar: normalizeBoolean(account?.is_solar_connected),
      dg: normalizeBoolean(account?.is_dg_connected),
      transformer: normalizeBoolean(account?.is_transformer_connected),
      pump: normalizeBoolean(account?.is_pump_connected),
      transformer_maintained_by_facility: normalizeBoolean(
        account?.is_transformer_maintained_by_facility,
      ),
      active:
        account?.is_active === undefined
          ? true
          : normalizeBoolean(account?.is_active, true),
    },

    documents: Array.isArray(account?.documents)
      ? account.documents.map(normalizeDocument).filter(Boolean)
      : [],

    created_at: account?.createdAt || account?.created_at || null,
    updated_at: account?.updatedAt || account?.updated_at || null,
  };

  normalized.display_rows = [
    {
      label: "Account Number",
      value: normalized.account_number,
    },
    {
      label: "Connection Type",
      value: normalized.connection_type,
    },
    {
      label: "Category",
      value: normalized.category,
    },
    {
      label: "Sanctioned Demand (kVA)",
      value:
        normalized.sanctioned_demand_kVA !== null
          ? formatNumber(normalized.sanctioned_demand_kVA)
          : "",
    },
    {
      label: "Solar Connected",
      value: normalized.is_solar_connected ? "Yes" : "No",
    },
    {
      label: "DG Connected",
      value: normalized.is_dg_connected ? "Yes" : "No",
    },
    {
      label: "Transformer Connected",
      value: normalized.is_transformer_connected ? "Yes" : "No",
    },
    {
      label: "Pump Connected",
      value: normalized.is_pump_connected ? "Yes" : "No",
    },
    {
      label: "Transformer Maintained By Facility",
      value: normalized.is_transformer_maintained_by_facility ? "Yes" : "No",
    },
    {
      label: "Status",
      value: normalized.is_active ? "Active" : "Inactive",
    },
  ].filter((row) => row.value !== "");

  normalized.summary_cards = [
    {
      key: "account_number",
      label: "Account Number",
      value: normalized.account_number || "-",
    },
    {
      key: "connection_type",
      label: "Connection Type",
      value: normalized.connection_type || "-",
    },
    {
      key: "category",
      label: "Category",
      value: normalized.category || "-",
    },
    {
      key: "sanctioned_demand_kVA",
      label: "Sanctioned Demand (kVA)",
      value:
        normalized.sanctioned_demand_kVA !== null
          ? formatNumber(normalized.sanctioned_demand_kVA)
          : "-",
    },
  ];

  return normalized;
};

const fetchFacilityUtilityAccounts = async (facilityId) => {
  if (!facilityId) return [];

  const accounts = await UtilityAccount.find({ facility_id: facilityId })
    .sort({ createdAt: 1, created_at: 1 })
    .lean();

  return Array.isArray(accounts) ? accounts : [];
};

const buildSummary = (utilityAccounts = []) => {
  return {
    total_utility_accounts: utilityAccounts.length,
    total_active_utility_accounts: utilityAccounts.filter(
      (item) => item.is_active,
    ).length,
    total_inactive_utility_accounts: utilityAccounts.filter(
      (item) => !item.is_active,
    ).length,
    total_solar_connected: utilityAccounts.filter(
      (item) => item.is_solar_connected,
    ).length,
    total_dg_connected: utilityAccounts.filter((item) => item.is_dg_connected)
      .length,
    total_transformer_connected: utilityAccounts.filter(
      (item) => item.is_transformer_connected,
    ).length,
    total_pump_connected: utilityAccounts.filter(
      (item) => item.is_pump_connected,
    ).length,
    total_transformer_maintained_by_facility: utilityAccounts.filter(
      (item) => item.is_transformer_maintained_by_facility,
    ).length,
  };
};

const buildGroupedSections = (accounts = []) => {
  const sections = [];

  sections.push({
    heading: "Utility Account Details",
    columns: [
      "sr_no",
      "account_number",
      "connection_type",
      "category",
      "sanctioned_demand_kVA_label",
      "is_active",
    ],
    rows: accounts.map((item) => ({
      sr_no: item.sr_no,
      account_number: item.account_number,
      connection_type: item.connection_type,
      category: item.category,
      sanctioned_demand_kVA_label: item.sanctioned_demand_kVA_label,
      is_active: item.is_active ? "Active" : "Inactive",
    })),
  });

  sections.push({
    heading: "System Connectivity",
    columns: [
      "sr_no",
      "account_number",
      "is_solar_connected",
      "is_dg_connected",
      "is_transformer_connected",
      "is_pump_connected",
      "is_transformer_maintained_by_facility",
    ],
    rows: accounts.map((item) => ({
      sr_no: item.sr_no,
      account_number: item.account_number,
      is_solar_connected: item.is_solar_connected ? "Yes" : "No",
      is_dg_connected: item.is_dg_connected ? "Yes" : "No",
      is_transformer_connected: item.is_transformer_connected ? "Yes" : "No",
      is_pump_connected: item.is_pump_connected ? "Yes" : "No",
      is_transformer_maintained_by_facility:
        item.is_transformer_maintained_by_facility ? "Yes" : "No",
    })),
  });

  accounts.forEach((item) => {
    sections.push({
      heading: `${item.account_number || "Utility Account"} - Details`,
      columns: ["field", "value"],
      rows: [
        { field: "Account Number", value: item.account_number || "" },
        { field: "Connection Type", value: item.connection_type || "" },
        { field: "Category", value: item.category || "" },
        {
          field: "Sanctioned Demand (kVA)",
          value:
            item.sanctioned_demand_kVA !== null
              ? formatNumber(item.sanctioned_demand_kVA)
              : "",
        },
        {
          field: "Solar Connected",
          value: item.is_solar_connected ? "Yes" : "No",
        },
        { field: "DG Connected", value: item.is_dg_connected ? "Yes" : "No" },
        {
          field: "Transformer Connected",
          value: item.is_transformer_connected ? "Yes" : "No",
        },
        {
          field: "Pump Connected",
          value: item.is_pump_connected ? "Yes" : "No",
        },
        {
          field: "Transformer Maintained By Facility",
          value: item.is_transformer_maintained_by_facility ? "Yes" : "No",
        },
        { field: "Status", value: item.is_active ? "Active" : "Inactive" },
      ],
    });
  });

  const summary = buildSummary(accounts);

  sections.push({
    heading: "Utility Account Summary",
    columns: ["metric", "value"],
    rows: [
      {
        metric: "Total Utility Accounts",
        value: summary.total_utility_accounts,
      },
      {
        metric: "Active Accounts",
        value: summary.total_active_utility_accounts,
      },
      {
        metric: "Inactive Accounts",
        value: summary.total_inactive_utility_accounts,
      },
      {
        metric: "Solar Connected",
        value: summary.total_solar_connected,
      },
      {
        metric: "DG Connected",
        value: summary.total_dg_connected,
      },
      {
        metric: "Transformer Connected",
        value: summary.total_transformer_connected,
      },
      {
        metric: "Pump Connected",
        value: summary.total_pump_connected,
      },
      {
        metric: "Transformer Maintained By Facility",
        value: summary.total_transformer_maintained_by_facility,
      },
    ],
  });

  return sections;
};

/**
 * Build utility accounts section
 *
 * Expected input:
 * {
 *   report,
 *   meta,
 *   facility,
 *   utilityAccount,
 *   scope, // "facility" | "utility_account"
 * }
 */
export const buildUtilityAccountsSection = async ({
  report,
  meta,
  facility,
  utilityAccount = null,
  scope = "facility",
}) => {
  if (!report) {
    const error = new Error(
      "report is required in buildUtilityAccountsSection",
    );
    error.statusCode = 500;
    throw error;
  }

  if (!facility) {
    const error = new Error(
      "facility is required in buildUtilityAccountsSection",
    );
    error.statusCode = 500;
    throw error;
  }

  let accounts = [];

  if (scope === "utility_account") {
    if (utilityAccount) {
      accounts = [utilityAccount];
    } else if (meta?.utility_account_id) {
      const found = await UtilityAccount.findById(
        meta.utility_account_id,
      ).lean();
      if (found) accounts = [found];
    }
  } else {
    accounts = await fetchFacilityUtilityAccounts(
      facility?._id || facility?.id,
    );
  }

  const normalizedAccounts = accounts
    .filter(Boolean)
    .map((account, index) => normalizeUtilityAccount(account, index));

  const summary = buildSummary(normalizedAccounts);
  const sections = buildGroupedSections(normalizedAccounts);

  return {
    title: "Utility Accounts",
    key: "utility_accounts",
    scope,
    facility_id: getId(facility),
    report_type: report?.report_type || meta?.report_type || "",
    total_accounts: normalizedAccounts.length,

    // backward-compatible
    items: normalizedAccounts,
    summary,

    // improved readable structure like solar
    sections,

    // keep renderer compatibility
    table_columns: [
      { key: "sr_no", label: "Sr No" },
      { key: "account_number", label: "Account Number" },
      { key: "connection_type", label: "Connection Type" },
      { key: "category", label: "Category" },
      { key: "sanctioned_demand_kVA_label", label: "Sanctioned Demand (kVA)" },
      { key: "is_solar_connected", label: "Solar Connected" },
      { key: "is_dg_connected", label: "DG Connected" },
      { key: "is_transformer_connected", label: "Transformer Connected" },
      { key: "is_pump_connected", label: "Pump Connected" },
      { key: "is_active", label: "Status" },
    ],

    table_rows: normalizedAccounts.map((item) => ({
      sr_no: item.sr_no,
      account_number: item.account_number,
      connection_type: item.connection_type,
      category: item.category,
      sanctioned_demand_kVA_label: item.sanctioned_demand_kVA_label,
      is_solar_connected: item.is_solar_connected ? "Yes" : "No",
      is_dg_connected: item.is_dg_connected ? "Yes" : "No",
      is_transformer_connected: item.is_transformer_connected ? "Yes" : "No",
      is_pump_connected: item.is_pump_connected ? "Yes" : "No",
      is_active: item.is_active ? "Active" : "Inactive",
    })),
  };
};

export default buildUtilityAccountsSection;
