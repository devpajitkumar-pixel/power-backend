import { buildCoverSection } from "./sections/buildCoverSection.js";
import { buildFacilityInfoSection } from "./sections/buildFacilityInfoSection.js";
import { buildUtilityAccountsSection } from "./sections/buildUtilityAccountsSection.js";
import { buildTariffSection } from "./sections/buildTariffSection.js";
import { buildBillingSection } from "./sections/buildBillingSection.js";
import { buildSolarSection } from "./sections/buildSolarSection.js";
import { buildDGSection } from "./sections/buildDGSection.js";
import { buildTransformerSection } from "./sections/buildTransformerSection.js";
import { buildPumpSection } from "./sections/buildPumpSection.js";
import { buildHVACSection } from "./sections/buildHVACSection.js";
import { buildACSection } from "./sections/buildACSection.js";
import { buildFanSection } from "./sections/buildFanSection.js";
import { buildLightingSection } from "./sections/buildLightingSection.js";
import { buildLuxSection } from "./sections/buildLuxSection.js";
import { buildMiscSection } from "./sections/buildMiscSection.js";
import { buildRecommendationsSection } from "./sections/buildRecommendationsSection.js";

const REPORT_TYPES = [
  "full_audit_report",
  "executive_summary",
  "solar_report",
  "dg_report",
  "transformer_report",
  "pump_report",
  "hvac_report",
  "ac_report",
  "fan_report",
  "lighting_report",
  "lux_report",
  "misc_report",
];

const throwError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const normalizeReportType = (type) => {
  if (!type) return "full_audit_report";
  if (!REPORT_TYPES.includes(type)) {
    throwError(`Invalid utility account report type: ${type}`, 400);
  }
  return type;
};

const createEmptyUtilityAccountReportData = (meta) => {
  return {
    meta,
    cover: null,
    facility_info: null,

    utility_accounts: [],
    utility_accounts_summary: null,

    tariffs: [],
    tariff_summary: null,

    billing_records: [],
    billing_summary: null,

    solar_systems: [],
    solar_summary: null,

    dg_sets: [],
    dg_summary: null,

    transformers: [],
    transformer_summary: null,

    pumps: [],
    pump_summary: null,

    hvac_records: [],
    hvac_summary: null,

    ac_records: [],
    ac_summary: null,

    fan_records: [],
    fan_summary: null,

    lighting_records: [],
    lighting_summary: null,

    lux_records: [],
    lux_summary: null,

    misc_records: [],
    misc_summary: null,

    recommendations: [],
    summary: null,

    sections: [],
    sheet_sections: [],
  };
};

const shouldIncludeSection = (reportType, sectionKey) => {
  const sectionMap = {
    full_audit_report: [
      "cover",
      "facility_info",
      "utility_accounts",
      "tariffs",
      "billing_records",
      "solar_systems",
      "dg_sets",
      "transformers",
      "pumps",
      "hvac_records",
      "ac_records",
      "fan_records",
      "lighting_records",
      "lux_records",
      "misc_records",
      "recommendations",
      "summary",
    ],

    executive_summary: [
      "cover",
      "facility_info",
      "utility_accounts",
      "tariffs",
      "billing_records",
      "recommendations",
      "summary",
    ],

    solar_report: [
      "cover",
      "facility_info",
      "utility_accounts",
      "solar_systems",
      "recommendations",
      "summary",
    ],

    dg_report: [
      "cover",
      "facility_info",
      "utility_accounts",
      "dg_sets",
      "recommendations",
      "summary",
    ],

    transformer_report: [
      "cover",
      "facility_info",
      "utility_accounts",
      "transformers",
      "recommendations",
      "summary",
    ],

    pump_report: [
      "cover",
      "facility_info",
      "utility_accounts",
      "pumps",
      "recommendations",
      "summary",
    ],

    hvac_report: [
      "cover",
      "facility_info",
      "utility_accounts",
      "hvac_records",
      "recommendations",
      "summary",
    ],

    ac_report: [
      "cover",
      "facility_info",
      "utility_accounts",
      "ac_records",
      "recommendations",
      "summary",
    ],

    fan_report: [
      "cover",
      "facility_info",
      "utility_accounts",
      "fan_records",
      "recommendations",
      "summary",
    ],

    lighting_report: [
      "cover",
      "facility_info",
      "utility_accounts",
      "lighting_records",
      "recommendations",
      "summary",
    ],

    lux_report: [
      "cover",
      "facility_info",
      "utility_accounts",
      "lux_records",
      "recommendations",
      "summary",
    ],

    misc_report: [
      "cover",
      "facility_info",
      "utility_accounts",
      "misc_records",
      "recommendations",
      "summary",
    ],
  };

  return sectionMap[reportType]?.includes(sectionKey) || false;
};

const safeSection = async (builder, fallback, label = "section") => {
  try {
    const result = await builder();
    return result ?? fallback;
  } catch (error) {
    console.error(`Failed to build utility-account ${label}:`, error);
    return fallback;
  }
};

const pushSectionIfValid = (result, section) => {
  if (!section || typeof section !== "object") return;

  if (Array.isArray(section.blocks) && section.blocks.length) {
    result.sheet_sections.push(section);
    return;
  }

  if (Array.isArray(section.items) && section.items.length) {
    result.sections.push(section);
  }
};

const buildUtilityAccountSummary = ({
  facility,
  utilityAccount,
  tariffs = [],
  billingRecords = [],
  solarSystems = [],
  dgSets = [],
  transformers = [],
  pumps = [],
  hvacRecords = [],
  acRecords = [],
  fanRecords = [],
  lightingRecords = [],
  luxRecords = [],
  miscRecords = [],
  recommendations = [],
}) => {
  return {
    facility_name: facility?.name || "",
    facility_city: facility?.city || "",
    utility_account_id: utilityAccount?._id?.toString?.() || "",
    utility_account_number: utilityAccount?.account_number || "",
    connection_type: utilityAccount?.connection_type || "",
    category: utilityAccount?.category || "",

    total_tariffs: tariffs.length,
    total_billing_records: billingRecords.length,
    total_solar_systems: solarSystems.length,
    total_dg_sets: dgSets.length,
    total_transformers: transformers.length,
    total_pumps: pumps.length,
    total_hvac_records: hvacRecords.length,
    total_ac_records: acRecords.length,
    total_fan_records: fanRecords.length,
    total_lighting_records: lightingRecords.length,
    total_lux_records: luxRecords.length,
    total_misc_records: miscRecords.length,
    total_recommendations: recommendations.length,
  };
};

/**
 * Build normalized utility-account-scope report data
 *
 * Expected input:
 * {
 *   report,
 *   facility,
 *   utilityAccount,
 *   meta
 * }
 */
export const buildUtilityAccountReportData = async ({
  report,
  facility,
  utilityAccount,
  meta,
}) => {
  if (!report) {
    throwError("report is required in buildUtilityAccountReportData", 500);
  }

  if (!facility) {
    throwError("facility is required in buildUtilityAccountReportData", 500);
  }

  if (!utilityAccount) {
    throwError(
      "utilityAccount is required in buildUtilityAccountReportData",
      500,
    );
  }

  const reportType = normalizeReportType(report.report_type);
  const result = createEmptyUtilityAccountReportData(meta);

  if (shouldIncludeSection(reportType, "cover")) {
    result.cover = await safeSection(
      () =>
        buildCoverSection({
          report,
          meta,
          facility,
          utilityAccount,
          scope: "utility_account",
        }),
      null,
      "cover",
    );
  }

  if (shouldIncludeSection(reportType, "facility_info")) {
    result.facility_info = await safeSection(
      () =>
        buildFacilityInfoSection({
          report,
          meta,
          facility,
          utilityAccount,
          scope: "utility_account",
        }),
      null,
      "facility_info",
    );
  }

  if (shouldIncludeSection(reportType, "utility_accounts")) {
    const utilityAccountsSection = await safeSection(
      () =>
        buildUtilityAccountsSection({
          report,
          meta,
          facility,
          utilityAccount,
          scope: "utility_account",
        }),
      {
        key: "utility_accounts",
        title: "Utility Accounts",
        items: [],
        summary: null,
        columns: [],
      },
      "utility_accounts",
    );

    result.utility_accounts = utilityAccountsSection.items || [];
    result.utility_accounts_summary = utilityAccountsSection.summary || null;

    if (result.utility_accounts.length === 0 && utilityAccount) {
      result.utility_accounts = [utilityAccount];
    }

    pushSectionIfValid(result, {
      ...utilityAccountsSection,
      items: result.utility_accounts,
    });
  }

  if (shouldIncludeSection(reportType, "tariffs")) {
    const tariffSection = await safeSection(
      () =>
        buildTariffSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "tariffs",
        title: "Tariffs",
        items: [],
        summary: null,
        columns: [],
      },
      "tariffs",
    );

    result.tariffs = tariffSection.items || [];
    result.tariff_summary = tariffSection.summary || null;
    pushSectionIfValid(result, tariffSection);
  }

  if (shouldIncludeSection(reportType, "billing_records")) {
    const billingSection = await safeSection(
      () =>
        buildBillingSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "billing_records",
        title: "Billing Records",
        items: [],
        summary: null,
        columns: [],
      },
      "billing_records",
    );

    result.billing_records = billingSection.items || [];
    result.billing_summary = billingSection.summary || null;
    pushSectionIfValid(result, billingSection);
  }

  if (shouldIncludeSection(reportType, "solar_systems")) {
    const solarSection = await safeSection(
      () =>
        buildSolarSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "solar_systems",
        title: "Solar Records",
        items: [],
        summary: null,
        columns: [],
      },
      "solar_systems",
    );

    result.solar_systems = solarSection.items || [];
    result.solar_summary = solarSection.summary || null;
    pushSectionIfValid(result, solarSection);
  }

  if (shouldIncludeSection(reportType, "dg_sets")) {
    const dgSection = await safeSection(
      () =>
        buildDGSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "dg_sets",
        title: "DG Records",
        items: [],
        summary: null,
        columns: [],
      },
      "dg_sets",
    );

    result.dg_sets = dgSection.items || [];
    result.dg_summary = dgSection.summary || null;
    pushSectionIfValid(result, dgSection);
  }

  if (shouldIncludeSection(reportType, "transformers")) {
    const transformerSection = await safeSection(
      () =>
        buildTransformerSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "transformers",
        title: "Transformer Records",
        items: [],
        summary: null,
        columns: [],
      },
      "transformers",
    );

    result.transformers = transformerSection.items || [];
    result.transformer_summary = transformerSection.summary || null;
    pushSectionIfValid(result, transformerSection);
  }

  if (shouldIncludeSection(reportType, "pumps")) {
    const pumpSection = await safeSection(
      () =>
        buildPumpSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "pumps",
        title: "Pump Records",
        items: [],
        summary: null,
        columns: [],
      },
      "pumps",
    );

    result.pumps = pumpSection.items || [];
    result.pump_summary = pumpSection.summary || null;
    pushSectionIfValid(result, pumpSection);
  }

  if (shouldIncludeSection(reportType, "hvac_records")) {
    const hvacSection = await safeSection(
      () =>
        buildHVACSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "hvac_records",
        title: "HVAC Records",
        items: [],
        summary: null,
        columns: [],
      },
      "hvac_records",
    );

    result.hvac_records = hvacSection.items || [];
    result.hvac_summary = hvacSection.summary || null;
    pushSectionIfValid(result, hvacSection);
  }

  if (shouldIncludeSection(reportType, "ac_records")) {
    const acSection = await safeSection(
      () =>
        buildACSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "ac_records",
        title: "AC Records",
        items: [],
        summary: null,
        columns: [],
      },
      "ac_records",
    );

    result.ac_records = acSection.items || [];
    result.ac_summary = acSection.summary || null;
    pushSectionIfValid(result, acSection);
  }

  if (shouldIncludeSection(reportType, "fan_records")) {
    const fanSection = await safeSection(
      () =>
        buildFanSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "fan_records",
        title: "Fan Records",
        items: [],
        summary: null,
        columns: [],
      },
      "fan_records",
    );

    result.fan_records = fanSection.items || [];
    result.fan_summary = fanSection.summary || null;
    pushSectionIfValid(result, fanSection);
  }

  if (shouldIncludeSection(reportType, "lighting_records")) {
    const lightingSection = await safeSection(
      () =>
        buildLightingSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "lighting_records",
        title: "Lighting Records",
        items: [],
        summary: null,
        columns: [],
      },
      "lighting_records",
    );

    result.lighting_records = lightingSection.items || [];
    result.lighting_summary = lightingSection.summary || null;
    pushSectionIfValid(result, lightingSection);
  }

  if (shouldIncludeSection(reportType, "lux_records")) {
    const luxSection = await safeSection(
      () =>
        buildLuxSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "lux_records",
        title: "Lux Measurements",
        items: [],
        summary: null,
        columns: [],
      },
      "lux_records",
    );

    result.lux_records = luxSection.items || [];
    result.lux_summary = luxSection.summary || null;
    pushSectionIfValid(result, luxSection);
  }

  if (shouldIncludeSection(reportType, "misc_records")) {
    const miscSection = await safeSection(
      () =>
        buildMiscSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          scope: "utility_account",
        }),
      {
        key: "misc_records",
        title: "Misc Records",
        items: [],
        summary: null,
        columns: [],
      },
      "misc_records",
    );

    result.misc_records = miscSection.items || [];
    result.misc_summary = miscSection.summary || null;
    pushSectionIfValid(result, miscSection);
  }

  if (shouldIncludeSection(reportType, "recommendations")) {
    result.recommendations = await safeSection(
      () =>
        buildRecommendationsSection({
          report,
          meta,
          facility,
          utilityAccount,
          utilityAccounts: result.utility_accounts,
          tariffs: result.tariffs,
          billing_records: result.billing_records,
          solar_systems: result.solar_systems,
          dg_sets: result.dg_sets,
          transformers: result.transformers,
          pumps: result.pumps,
          hvac_records: result.hvac_records,
          ac_records: result.ac_records,
          fan_records: result.fan_records,
          lighting_records: result.lighting_records,
          lux_records: result.lux_records,
          misc_records: result.misc_records,
          scope: "utility_account",
        }),
      [],
      "recommendations",
    );
  }

  if (shouldIncludeSection(reportType, "summary")) {
    result.summary = buildUtilityAccountSummary({
      facility,
      utilityAccount,
      tariffs: result.tariffs,
      billingRecords: result.billing_records,
      solarSystems: result.solar_systems,
      dgSets: result.dg_sets,
      transformers: result.transformers,
      pumps: result.pumps,
      hvacRecords: result.hvac_records,
      acRecords: result.ac_records,
      fanRecords: result.fan_records,
      lightingRecords: result.lighting_records,
      luxRecords: result.lux_records,
      miscRecords: result.misc_records,
      recommendations: result.recommendations,
    });
  }

  return result;
};

export default buildUtilityAccountReportData;
