import HVACAudit from "../../../../modals/hvacAudit.js";

const getMongoId = (value) => value?._id || value || null;
const getId = (value) => (value?._id ? String(value._id) : String(value || ""));

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

const yesNoLabel = (value) => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
};

const averageOf = (items, key, decimals = 2) => {
  if (!items.length) return null;

  const values = items
    .map((item) => normalizeNumber(item?.[key]))
    .filter((value) => value !== null);

  if (!values.length) return null;

  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(decimals));
};

const normalizePreAuditInformation = (row) => {
  const info = row?.pre_audit_information || {};

  return {
    facility_name: normalizeText(info?.facility_name),
    location_address: normalizeText(info?.location_address),
    client_contact_person: normalizeText(info?.client_contact_person),
    contact_number_email: normalizeText(info?.contact_number_email),
    type_of_facility: normalizeText(info?.type_of_facility),
    audit_dates: Array.isArray(info?.audit_dates)
      ? info.audit_dates
          .map((date) => formatDate(date))
          .filter(Boolean)
          .join(", ")
      : "",
    auditor_team_members_names: Array.isArray(info?.auditor_team_members_names)
      ? info.auditor_team_members_names
          .map((name) => normalizeText(name))
          .filter(Boolean)
          .join(", ")
      : "",
    total_operating_hours_per_day: normalizeNumber(
      info?.total_operating_hours_per_day,
    ),
    hvac_operating_hours_per_day: normalizeNumber(
      info?.hvac_operating_hours_per_day,
    ),
    season_ambient_conditions: normalizeText(info?.season_ambient_conditions),
  };
};

const normalizeDocumentsRecordsToCollect = (row) => {
  const docs = row?.documents_records_to_collect || {};

  return Object.entries(docs).map(([key, value]) => ({
    item: key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    available: yesNoLabel(value?.available),
    remarks: normalizeText(value?.remarks),
  }));
};

const normalizeEquipmentRegister = (row) => {
  const list = Array.isArray(row?.hvac_equipment_register)
    ? row.hvac_equipment_register
    : [];

  return list.map((item, index) => ({
    sr_no: index + 1,
    equipment_name: normalizeText(item?.equipment_name),
    type: normalizeText(item?.type),
    capacity: normalizeNumber(item?.capacity),
    power_rating_kW: normalizeNumber(item?.power_rating_kW),
    quantity: normalizeNumber(item?.quantity),
    remarks: normalizeText(item?.remarks),
  }));
};

const normalizeChillerFieldTest = (row) => {
  const test = row?.chiller_field_test || {};
  const readings = Array.isArray(test?.readings) ? test.readings : [];

  return {
    readings: readings.map((item, index) => ({
      sr_no: index + 1,
      chiller_load_TR: normalizeNumber(item?.chiller_load_TR),
      power_input_kW: normalizeNumber(item?.power_input_kW),
      chilled_water_in_temp: normalizeNumber(item?.chilled_water_in_temp),
      chilled_water_out_temp: normalizeNumber(item?.chilled_water_out_temp),
      condenser_water_in_temp: normalizeNumber(item?.condenser_water_in_temp),
      condenser_water_out_temp: normalizeNumber(item?.condenser_water_out_temp),
    })),
    average: {
      avg_load_TR: normalizeNumber(test?.average?.avg_load_TR),
      avg_power_kW: normalizeNumber(test?.average?.avg_power_kW),
    },
  };
};

const normalizeAuxiliaryPower = (row) => {
  const aux = row?.auxiliary_power || {};
  const components = Array.isArray(aux?.components) ? aux.components : [];

  return {
    components: components.map((item, index) => ({
      sr_no: index + 1,
      name: normalizeText(item?.name),
      power_kW: normalizeNumber(item?.power_kW),
    })),
    total_auxiliary_power_used_kW: normalizeNumber(
      aux?.total_auxiliary_power_used_kW,
    ),
  };
};

const normalizeCoolingTowerQuickTest = (row) => {
  const test = row?.cooling_tower_quick_test || {};
  const readings = Array.isArray(test?.readings) ? test.readings : [];

  return {
    readings: readings.map((item, index) => ({
      sr_no: index + 1,
      inlet_temp: normalizeNumber(item?.inlet_temp),
      outlet_temp: normalizeNumber(item?.outlet_temp),
      ambient_temp: normalizeNumber(item?.ambient_temp),
    })),
    average: {
      avg_inlet_temp: normalizeNumber(test?.average?.avg_inlet_temp),
      avg_outlet_temp: normalizeNumber(test?.average?.avg_outlet_temp),
    },
  };
};

const normalizeSummary = (row) => {
  const summary = row?.summary || {};

  return {
    average_cooling_produced_TR: normalizeNumber(
      summary?.average_cooling_produced_TR,
    ),
    average_chiller_power_used_kW: normalizeNumber(
      summary?.average_chiller_power_used_kW,
    ),
    total_auxiliary_power_used_kW: normalizeNumber(
      summary?.total_auxiliary_power_used_kW,
    ),
    total_plant_power_kW: normalizeNumber(summary?.total_plant_power_kW),
    plant_efficiency_kW_per_TR: normalizeNumber(
      summary?.plant_efficiency_kW_per_TR,
    ),
    coefficient_of_performance: normalizeNumber(
      summary?.coefficient_of_performance,
    ),
  };
};

const normalizeHVACRecord = (row, index) => {
  const preAudit = normalizePreAuditInformation(row);
  const documents = normalizeDocumentsRecordsToCollect(row);
  const equipmentRegister = normalizeEquipmentRegister(row);
  const chillerFieldTest = normalizeChillerFieldTest(row);
  const auxiliaryPower = normalizeAuxiliaryPower(row);
  const coolingTowerQuickTest = normalizeCoolingTowerQuickTest(row);
  const summary = normalizeSummary(row);

  return {
    id: String(row?._id || ""),
    sr_no: index + 1,
    audit_date: row?.audit_date || null,
    audit_date_label: formatDate(row?.audit_date),

    pre_audit_information: preAudit,
    documents_records_to_collect: documents,
    hvac_equipment_register: equipmentRegister,
    chiller_field_test: chillerFieldTest,
    auxiliary_power: auxiliaryPower,
    cooling_tower_quick_test: coolingTowerQuickTest,
    summary,

    average_cooling_produced_TR: summary.average_cooling_produced_TR,
    average_chiller_power_used_kW: summary.average_chiller_power_used_kW,
    total_auxiliary_power_used_kW: summary.total_auxiliary_power_used_kW,
    total_plant_power_kW: summary.total_plant_power_kW,
    plant_efficiency_kW_per_TR: summary.plant_efficiency_kW_per_TR,
    coefficient_of_performance: summary.coefficient_of_performance,
  };
};

export const buildHVACSection = async ({
  report,
  meta,
  facility,
  utilityAccount = null,
  scope = "facility",
}) => {
  const facilityId = getMongoId(facility);
  const utilityAccountId = getMongoId(utilityAccount);

  const query =
    scope === "utility_account"
      ? {
          facility_id: facilityId,
          utility_account_id: utilityAccountId,
        }
      : {
          facility_id: facilityId,
        };

  const rows = await HVACAudit.find(query).sort({ createdAt: -1 }).lean();

  const items = (rows || []).map((row, index) =>
    normalizeHVACRecord(row, index),
  );

  const summary = {
    total_records: items.length,
    average_cooling_produced_TR: averageOf(
      items,
      "average_cooling_produced_TR",
    ),
    average_chiller_power_used_kW: averageOf(
      items,
      "average_chiller_power_used_kW",
    ),
    average_total_auxiliary_power_used_kW: averageOf(
      items,
      "total_auxiliary_power_used_kW",
    ),
    average_total_plant_power_kW: averageOf(items, "total_plant_power_kW"),
    average_plant_efficiency_kW_per_TR: averageOf(
      items,
      "plant_efficiency_kW_per_TR",
      3,
    ),
    average_coefficient_of_performance: averageOf(
      items,
      "coefficient_of_performance",
      3,
    ),
    latest_audit_date:
      items
        .map((item) => item.audit_date)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null,
  };

  const latestRecord = items[0] || null;

  return {
    title: "HVAC Records",
    scope,
    facility_id: getId(facility),
    utility_account_id: getId(utilityAccount),
    report_type: report?.report_type || meta?.report_type || "",
    total_records: items.length,
    items,

    summary: {
      ...summary,
      latest_audit_date_label: formatDate(summary.latest_audit_date),
    },

    sections: [
      {
        heading: "HVAC Audit Overview",
        columns: [
          "sr_no",
          "audit_date_label",
          "average_cooling_produced_TR",
          "average_chiller_power_used_kW",
          "total_auxiliary_power_used_kW",
          "total_plant_power_kW",
          "plant_efficiency_kW_per_TR",
          "coefficient_of_performance",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          audit_date_label: item.audit_date_label,
          average_cooling_produced_TR:
            item.average_cooling_produced_TR !== null
              ? formatNumber(item.average_cooling_produced_TR)
              : "",
          average_chiller_power_used_kW:
            item.average_chiller_power_used_kW !== null
              ? formatNumber(item.average_chiller_power_used_kW)
              : "",
          total_auxiliary_power_used_kW:
            item.total_auxiliary_power_used_kW !== null
              ? formatNumber(item.total_auxiliary_power_used_kW)
              : "",
          total_plant_power_kW:
            item.total_plant_power_kW !== null
              ? formatNumber(item.total_plant_power_kW)
              : "",
          plant_efficiency_kW_per_TR:
            item.plant_efficiency_kW_per_TR !== null
              ? formatNumber(item.plant_efficiency_kW_per_TR, 3)
              : "",
          coefficient_of_performance:
            item.coefficient_of_performance !== null
              ? formatNumber(item.coefficient_of_performance, 3)
              : "",
        })),
      },

      ...(latestRecord
        ? [
            {
              heading: "Pre-Audit Information",
              columns: ["label", "value"],
              rows: [
                {
                  label: "Facility Name",
                  value: latestRecord.pre_audit_information.facility_name,
                },
                {
                  label: "Location Address",
                  value: latestRecord.pre_audit_information.location_address,
                },
                {
                  label: "Client Contact Person",
                  value:
                    latestRecord.pre_audit_information.client_contact_person,
                },
                {
                  label: "Contact Number / Email",
                  value:
                    latestRecord.pre_audit_information.contact_number_email,
                },
                {
                  label: "Type of Facility",
                  value: latestRecord.pre_audit_information.type_of_facility,
                },
                {
                  label: "Audit Dates",
                  value: latestRecord.pre_audit_information.audit_dates,
                },
                {
                  label: "Auditor Team Members",
                  value:
                    latestRecord.pre_audit_information
                      .auditor_team_members_names,
                },
                {
                  label: "Total Operating Hours / Day",
                  value:
                    latestRecord.pre_audit_information
                      .total_operating_hours_per_day !== null
                      ? formatNumber(
                          latestRecord.pre_audit_information
                            .total_operating_hours_per_day,
                        )
                      : "",
                },
                {
                  label: "HVAC Operating Hours / Day",
                  value:
                    latestRecord.pre_audit_information
                      .hvac_operating_hours_per_day !== null
                      ? formatNumber(
                          latestRecord.pre_audit_information
                            .hvac_operating_hours_per_day,
                        )
                      : "",
                },
                {
                  label: "Season / Ambient Conditions",
                  value:
                    latestRecord.pre_audit_information
                      .season_ambient_conditions,
                },
              ].filter((row) => row.value !== ""),
            },

            {
              heading: "Documents / Records to Collect",
              columns: ["item", "available", "remarks"],
              rows: latestRecord.documents_records_to_collect.map((item) => ({
                item: item.item,
                available: item.available,
                remarks: item.remarks,
              })),
            },

            {
              heading: "HVAC Equipment Register",
              columns: [
                "sr_no",
                "equipment_name",
                "type",
                "capacity",
                "power_rating_kW",
                "quantity",
                "remarks",
              ],
              rows: latestRecord.hvac_equipment_register.map((item) => ({
                sr_no: item.sr_no,
                equipment_name: item.equipment_name,
                type: item.type,
                capacity:
                  item.capacity !== null ? formatNumber(item.capacity) : "",
                power_rating_kW:
                  item.power_rating_kW !== null
                    ? formatNumber(item.power_rating_kW)
                    : "",
                quantity:
                  item.quantity !== null ? formatNumber(item.quantity, 0) : "",
                remarks: item.remarks,
              })),
            },

            {
              heading: "Chiller Field Test Readings",
              columns: [
                "sr_no",
                "chiller_load_TR",
                "power_input_kW",
                "chilled_water_in_temp",
                "chilled_water_out_temp",
                "condenser_water_in_temp",
                "condenser_water_out_temp",
              ],
              rows: latestRecord.chiller_field_test.readings.map((item) => ({
                sr_no: item.sr_no,
                chiller_load_TR:
                  item.chiller_load_TR !== null
                    ? formatNumber(item.chiller_load_TR)
                    : "",
                power_input_kW:
                  item.power_input_kW !== null
                    ? formatNumber(item.power_input_kW)
                    : "",
                chilled_water_in_temp:
                  item.chilled_water_in_temp !== null
                    ? formatNumber(item.chilled_water_in_temp)
                    : "",
                chilled_water_out_temp:
                  item.chilled_water_out_temp !== null
                    ? formatNumber(item.chilled_water_out_temp)
                    : "",
                condenser_water_in_temp:
                  item.condenser_water_in_temp !== null
                    ? formatNumber(item.condenser_water_in_temp)
                    : "",
                condenser_water_out_temp:
                  item.condenser_water_out_temp !== null
                    ? formatNumber(item.condenser_water_out_temp)
                    : "",
              })),
            },

            {
              heading: "Chiller Field Test Average",
              columns: ["label", "value"],
              rows: [
                {
                  label: "Average Load (TR)",
                  value:
                    latestRecord.chiller_field_test.average.avg_load_TR !== null
                      ? formatNumber(
                          latestRecord.chiller_field_test.average.avg_load_TR,
                        )
                      : "",
                },
                {
                  label: "Average Power (kW)",
                  value:
                    latestRecord.chiller_field_test.average.avg_power_kW !==
                    null
                      ? formatNumber(
                          latestRecord.chiller_field_test.average.avg_power_kW,
                        )
                      : "",
                },
              ].filter((row) => row.value !== ""),
            },

            {
              heading: "Auxiliary Power Components",
              columns: ["sr_no", "name", "power_kW"],
              rows: latestRecord.auxiliary_power.components.map((item) => ({
                sr_no: item.sr_no,
                name: item.name,
                power_kW:
                  item.power_kW !== null ? formatNumber(item.power_kW) : "",
              })),
            },

            {
              heading: "Auxiliary Power Summary",
              columns: ["label", "value"],
              rows: [
                {
                  label: "Total Auxiliary Power Used (kW)",
                  value:
                    latestRecord.auxiliary_power
                      .total_auxiliary_power_used_kW !== null
                      ? formatNumber(
                          latestRecord.auxiliary_power
                            .total_auxiliary_power_used_kW,
                        )
                      : "",
                },
              ].filter((row) => row.value !== ""),
            },

            {
              heading: "Cooling Tower Quick Test Readings",
              columns: ["sr_no", "inlet_temp", "outlet_temp", "ambient_temp"],
              rows: latestRecord.cooling_tower_quick_test.readings.map(
                (item) => ({
                  sr_no: item.sr_no,
                  inlet_temp:
                    item.inlet_temp !== null
                      ? formatNumber(item.inlet_temp)
                      : "",
                  outlet_temp:
                    item.outlet_temp !== null
                      ? formatNumber(item.outlet_temp)
                      : "",
                  ambient_temp:
                    item.ambient_temp !== null
                      ? formatNumber(item.ambient_temp)
                      : "",
                }),
              ),
            },

            {
              heading: "Cooling Tower Quick Test Average",
              columns: ["label", "value"],
              rows: [
                {
                  label: "Average Inlet Temp",
                  value:
                    latestRecord.cooling_tower_quick_test.average
                      .avg_inlet_temp !== null
                      ? formatNumber(
                          latestRecord.cooling_tower_quick_test.average
                            .avg_inlet_temp,
                        )
                      : "",
                },
                {
                  label: "Average Outlet Temp",
                  value:
                    latestRecord.cooling_tower_quick_test.average
                      .avg_outlet_temp !== null
                      ? formatNumber(
                          latestRecord.cooling_tower_quick_test.average
                            .avg_outlet_temp,
                        )
                      : "",
                },
              ].filter((row) => row.value !== ""),
            },

            {
              heading: "HVAC Summary Details",
              columns: ["label", "value"],
              rows: [
                {
                  label: "Average Cooling Produced (TR)",
                  value:
                    latestRecord.summary.average_cooling_produced_TR !== null
                      ? formatNumber(
                          latestRecord.summary.average_cooling_produced_TR,
                        )
                      : "",
                },
                {
                  label: "Average Chiller Power Used (kW)",
                  value:
                    latestRecord.summary.average_chiller_power_used_kW !== null
                      ? formatNumber(
                          latestRecord.summary.average_chiller_power_used_kW,
                        )
                      : "",
                },
                {
                  label: "Total Auxiliary Power Used (kW)",
                  value:
                    latestRecord.summary.total_auxiliary_power_used_kW !== null
                      ? formatNumber(
                          latestRecord.summary.total_auxiliary_power_used_kW,
                        )
                      : "",
                },
                {
                  label: "Total Plant Power (kW)",
                  value:
                    latestRecord.summary.total_plant_power_kW !== null
                      ? formatNumber(latestRecord.summary.total_plant_power_kW)
                      : "",
                },
                {
                  label: "Plant Efficiency (kW/TR)",
                  value:
                    latestRecord.summary.plant_efficiency_kW_per_TR !== null
                      ? formatNumber(
                          latestRecord.summary.plant_efficiency_kW_per_TR,
                          3,
                        )
                      : "",
                },
                {
                  label: "Coefficient of Performance",
                  value:
                    latestRecord.summary.coefficient_of_performance !== null
                      ? formatNumber(
                          latestRecord.summary.coefficient_of_performance,
                          3,
                        )
                      : "",
                },
              ].filter((row) => row.value !== ""),
            },
          ]
        : []),

      {
        heading: "HVAC Report Summary",
        columns: ["metric", "value"],
        rows: [
          {
            metric: "Total HVAC Records",
            value: summary.total_records ?? "",
          },
          {
            metric: "Average Cooling Produced (TR)",
            value:
              summary.average_cooling_produced_TR !== null
                ? formatNumber(summary.average_cooling_produced_TR)
                : "",
          },
          {
            metric: "Average Chiller Power Used (kW)",
            value:
              summary.average_chiller_power_used_kW !== null
                ? formatNumber(summary.average_chiller_power_used_kW)
                : "",
          },
          {
            metric: "Average Total Auxiliary Power Used (kW)",
            value:
              summary.average_total_auxiliary_power_used_kW !== null
                ? formatNumber(summary.average_total_auxiliary_power_used_kW)
                : "",
          },
          {
            metric: "Average Total Plant Power (kW)",
            value:
              summary.average_total_plant_power_kW !== null
                ? formatNumber(summary.average_total_plant_power_kW)
                : "",
          },
          {
            metric: "Average Plant Efficiency (kW/TR)",
            value:
              summary.average_plant_efficiency_kW_per_TR !== null
                ? formatNumber(summary.average_plant_efficiency_kW_per_TR, 3)
                : "",
          },
          {
            metric: "Average Coefficient of Performance",
            value:
              summary.average_coefficient_of_performance !== null
                ? formatNumber(summary.average_coefficient_of_performance, 3)
                : "",
          },
          {
            metric: "Latest Audit Date",
            value: formatDate(summary.latest_audit_date),
          },
        ],
      },
    ],

    table_columns: [
      { key: "sr_no", label: "Sr No" },
      { key: "audit_date_label", label: "Audit Date" },
      { key: "average_cooling_produced_TR", label: "Avg Cooling (TR)" },
      { key: "average_chiller_power_used_kW", label: "Avg Chiller Power (kW)" },
      {
        key: "total_auxiliary_power_used_kW",
        label: "Auxiliary Power (kW)",
      },
      { key: "total_plant_power_kW", label: "Total Plant Power (kW)" },
      { key: "plant_efficiency_kW_per_TR", label: "Plant Efficiency (kW/TR)" },
      { key: "coefficient_of_performance", label: "COP" },
    ],

    table_rows: items.map((item) => ({
      sr_no: item.sr_no,
      audit_date_label: item.audit_date_label,
      average_cooling_produced_TR:
        item.average_cooling_produced_TR !== null
          ? formatNumber(item.average_cooling_produced_TR)
          : "",
      average_chiller_power_used_kW:
        item.average_chiller_power_used_kW !== null
          ? formatNumber(item.average_chiller_power_used_kW)
          : "",
      total_auxiliary_power_used_kW:
        item.total_auxiliary_power_used_kW !== null
          ? formatNumber(item.total_auxiliary_power_used_kW)
          : "",
      total_plant_power_kW:
        item.total_plant_power_kW !== null
          ? formatNumber(item.total_plant_power_kW)
          : "",
      plant_efficiency_kW_per_TR:
        item.plant_efficiency_kW_per_TR !== null
          ? formatNumber(item.plant_efficiency_kW_per_TR, 3)
          : "",
      coefficient_of_performance:
        item.coefficient_of_performance !== null
          ? formatNumber(item.coefficient_of_performance, 3)
          : "",
    })),
  };
};

export default buildHVACSection;
