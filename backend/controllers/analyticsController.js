import asyncHandler from "../middlewares/asyncHandler.js";
import Facility from "../modals/facility.js";
import FacilityAuditor from "../modals/facilityAuditor.js";
import UtilityAccount from "../modals/utilityAccount.js";
import SolarPlant from "../modals/solarPlant.js";
import DGSet from "../modals/dgSet.js";
import Transformer from "../modals/transformer.js";
import Pump from "../modals/pump.js";

const isAdmin = (user) => user?.role === "admin";

const getAccessibleFacilityIds = async (user) => {
  if (!user?._id) return [];

  if (isAdmin(user)) {
    const facilities = await Facility.find({}, "_id").lean();
    return facilities.map((f) => String(f._id));
  }

  const ownedFacilities = await Facility.find(
    { owner_user_id: user._id },
    "_id",
  ).lean();

  const assignedFacilities = await FacilityAuditor.find(
    { user_id: user._id },
    "facility_id",
  ).lean();

  const ids = new Set([
    ...ownedFacilities.map((f) => String(f._id)),
    ...assignedFacilities.map((a) => String(a.facility_id)),
  ]);

  return [...ids];
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 1);

const getLastNMonths = (count = 6) => {
  const months = [];
  const now = new Date();

  for (let i = count - 1; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }

  return months;
};

const monthLabel = (date) =>
  date.toLocaleString("en-US", {
    month: "short",
  });

const resolveCreatedAt = (doc) => {
  return (
    doc?.createdAt ||
    doc?.created_at ||
    doc?.updatedAt ||
    doc?.updated_at ||
    null
  );
};

const isWithinRange = (value, start, end) => {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date >= start && date < end;
};

const getComparisonStats = (items = [], referenceDate = new Date()) => {
  const currentMonthStart = startOfMonth(referenceDate);
  const nextMonthStart = endOfMonth(referenceDate);

  const previousMonthStart = new Date(
    currentMonthStart.getFullYear(),
    currentMonthStart.getMonth() - 1,
    1,
  );
  const previousMonthEnd = currentMonthStart;

  let currentTotal = 0;
  let lastMonthTotal = 0;

  for (const item of items) {
    const createdAt = resolveCreatedAt(item);

    if (isWithinRange(createdAt, currentMonthStart, nextMonthStart)) {
      currentTotal += 1;
    } else if (isWithinRange(createdAt, previousMonthStart, previousMonthEnd)) {
      lastMonthTotal += 1;
    }
  }

  const difference = currentTotal - lastMonthTotal;

  let percentage = 0;
  if (lastMonthTotal === 0) {
    percentage = currentTotal > 0 ? 100 : 0;
  } else {
    percentage = (difference / lastMonthTotal) * 100;
  }

  let trend = "no_change";
  if (difference > 0) trend = "increase";
  if (difference < 0) trend = "decrease";

  return {
    total: items.length,
    lastMonthTotal,
    difference,
    percentage: Number(Math.abs(percentage).toFixed(2)),
    trend,
  };
};

const buildTimeSeriesData = (datasets = [], months = 6) => {
  const buckets = getLastNMonths(months).map((d) => ({
    date: monthLabel(d),
    audits: 0,
    key: `${d.getFullYear()}-${d.getMonth()}`,
  }));

  for (const dataset of datasets) {
    for (const item of dataset) {
      const rawDate = resolveCreatedAt(item);
      if (!rawDate) continue;

      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime())) continue;

      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = buckets.find((b) => b.key === key);

      if (bucket) {
        bucket.audits += 1;
      }
    }
  }

  return buckets.map(({ key, ...rest }) => rest);
};

const buildCapacityByCity = ({
  facilities = [],
  utilityAccounts = [],
  solarPlants = [],
  dgSets = [],
  transformers = [],
  pumps = [],
}) => {
  const facilityMap = new Map(facilities.map((f) => [String(f._id), f]));

  const utilityToFacilityMap = new Map(
    utilityAccounts.map((u) => [String(u._id), String(u.facility_id)]),
  );

  const cityTotals = new Map();

  const addCapacity = (facilityId, value) => {
    const facility = facilityMap.get(String(facilityId));
    const city = facility?.city?.trim() || "Unknown";
    const prev = cityTotals.get(city) || 0;
    cityTotals.set(city, prev + toNumber(value));
  };

  for (const dg of dgSets) {
    const facilityId =
      utilityToFacilityMap.get(String(dg.utility_account_id)) ||
      String(dg.facility_id || "");
    addCapacity(facilityId, dg.rated_capacity_kVA);
  }

  for (const solar of solarPlants) {
    const facilityId =
      utilityToFacilityMap.get(String(solar.utility_account_id)) ||
      String(solar.facility_id || "");
    addCapacity(facilityId, solar.rating_kWp);
  }

  for (const transformer of transformers) {
    const facilityId =
      utilityToFacilityMap.get(String(transformer.utility_account_id)) ||
      String(transformer.facility_id || "");
    addCapacity(facilityId, transformer.rated_capacity_kVA);
  }

  for (const pump of pumps) {
    const facilityId =
      utilityToFacilityMap.get(String(pump.utility_account_id)) ||
      String(pump.facility_id || "");
    addCapacity(facilityId, pump.rated_power_kW_or_HP);
  }

  return [...cityTotals.entries()]
    .map(([city, capacity]) => ({
      city,
      capacity: Math.round(capacity),
    }))
    .sort((a, b) => b.capacity - a.capacity);
};

const buildEnergySourceDistribution = ({
  utilityAccounts = [],
  solarPlants = [],
  dgSets = [],
}) => {
  const gridCapacity = utilityAccounts.reduce(
    (sum, u) => sum + toNumber(u.sanctioned_demand_kVA),
    0,
  );

  const dgCapacity = dgSets.reduce(
    (sum, dg) => sum + toNumber(dg.rated_capacity_kVA),
    0,
  );

  const solarCapacity = solarPlants.reduce(
    (sum, s) => sum + toNumber(s.rating_kWp),
    0,
  );

  return [
    { name: "Grid", value: Math.round(gridCapacity) },
    { name: "DG", value: Math.round(dgCapacity) },
    { name: "Solar", value: Math.round(solarCapacity) },
  ];
};

const deriveAuditStatus = ({
  facilities = [],
  utilityAccounts = [],
  solarPlants = [],
  dgSets = [],
  transformers = [],
  pumps = [],
}) => {
  const utilityByFacility = new Map();
  const assetByFacility = new Map();

  for (const u of utilityAccounts) {
    const facilityId = String(u.facility_id);
    utilityByFacility.set(
      facilityId,
      (utilityByFacility.get(facilityId) || 0) + 1,
    );
  }

  const allAssets = [...solarPlants, ...dgSets, ...transformers, ...pumps];

  for (const item of allAssets) {
    const facilityId = String(item.facility_id);
    assetByFacility.set(facilityId, (assetByFacility.get(facilityId) || 0) + 1);
  }

  let completed = 0;
  let inProgress = 0;
  let pending = 0;

  for (const facility of facilities) {
    const facilityId = String(facility._id);

    const utilityCount = utilityByFacility.get(facilityId) || 0;
    const assetCount = assetByFacility.get(facilityId) || 0;

    if (utilityCount > 0 && assetCount > 0) {
      completed += 1;
    } else if (utilityCount > 0) {
      inProgress += 1;
    } else {
      pending += 1;
    }
  }

  return {
    completed,
    inProgress,
    pending,
    chart: [
      { name: "Completed", value: completed },
      { name: "In Progress", value: inProgress },
      { name: "Pending", value: pending },
    ],
  };
};

// @route   GET /api/v1/analytics
// @desc    Get dashboard analytics
// @access  Protected
const getAnalytics = asyncHandler(async (req, res) => {
  const accessibleFacilityIds = await getAccessibleFacilityIds(req.user);

  if (!accessibleFacilityIds.length) {
    return res.status(200).json({
      success: true,
      data: {
        analytics: {
          totalFacilities: 0,
          completedAudits: 0,
          pendingAudits: 0,
          totalCapacity: 0,
          totalConnections: 0,
          dgCapacity: 0,
          solarCapacity: 0,
          totalDGSystems: 0,
          totalSolarSystems: 0,
          totalTransformers: 0,
          totalPumps: 0,
        },
        stats: {
          facilities: {
            total: 0,
            lastMonthTotal: 0,
            difference: 0,
            percentage: 0,
            trend: "no_change",
          },
          utilityAccounts: {
            total: 0,
            lastMonthTotal: 0,
            difference: 0,
            percentage: 0,
            trend: "no_change",
          },
          solarPlants: {
            total: 0,
            lastMonthTotal: 0,
            difference: 0,
            percentage: 0,
            trend: "no_change",
          },
          dgSets: {
            total: 0,
            lastMonthTotal: 0,
            difference: 0,
            percentage: 0,
            trend: "no_change",
          },
          transformers: {
            total: 0,
            lastMonthTotal: 0,
            difference: 0,
            percentage: 0,
            trend: "no_change",
          },
          pumps: {
            total: 0,
            lastMonthTotal: 0,
            difference: 0,
            percentage: 0,
            trend: "no_change",
          },
        },
        statusData: [],
        energySourceData: [],
        capacityByCity: [],
        timeSeriesData: [],
      },
    });
  }

  const facilityQuery = { _id: { $in: accessibleFacilityIds } };

  const [
    facilities,
    utilityAccounts,
    solarPlants,
    dgSets,
    transformers,
    pumps,
  ] = await Promise.all([
    Facility.find(
      facilityQuery,
      "name city status facility_type createdAt updatedAt created_at updated_at",
    ).lean(),

    UtilityAccount.find(
      { facility_id: { $in: accessibleFacilityIds } },
      "facility_id account_number sanctioned_demand_kVA createdAt updatedAt created_at updated_at",
    ).lean(),

    SolarPlant.find(
      { facility_id: { $in: accessibleFacilityIds } },
      "facility_id utility_account_id rating_kWp createdAt updatedAt created_at updated_at",
    ).lean(),

    DGSet.find(
      { facility_id: { $in: accessibleFacilityIds } },
      "facility_id utility_account_id rated_capacity_kVA createdAt updatedAt created_at updated_at",
    ).lean(),

    Transformer.find(
      { facility_id: { $in: accessibleFacilityIds } },
      "facility_id utility_account_id rated_capacity_kVA createdAt updatedAt created_at updated_at",
    ).lean(),

    Pump.find(
      { facility_id: { $in: accessibleFacilityIds } },
      "facility_id utility_account_id rated_power_kW_or_HP createdAt updatedAt created_at updated_at",
    ).lean(),
  ]);

  const auditStatus = deriveAuditStatus({
    facilities,
    utilityAccounts,
    solarPlants,
    dgSets,
    transformers,
    pumps,
  });

  const energySourceDistribution = buildEnergySourceDistribution({
    utilityAccounts,
    solarPlants,
    dgSets,
  });

  const capacityByCity = buildCapacityByCity({
    facilities,
    utilityAccounts,
    solarPlants,
    dgSets,
    transformers,
    pumps,
  });

  const totalGridCapacity =
    energySourceDistribution.find((x) => x.name === "Grid")?.value || 0;

  const totalDGCapacity =
    energySourceDistribution.find((x) => x.name === "DG")?.value || 0;

  const totalSolarCapacity =
    energySourceDistribution.find((x) => x.name === "Solar")?.value || 0;

  const transformerCapacity = transformers.reduce(
    (sum, t) => sum + toNumber(t.rated_capacity_kVA),
    0,
  );

  const pumpCapacity = pumps.reduce(
    (sum, p) => sum + toNumber(p.rated_power_kW_or_HP),
    0,
  );

  const totalCapacity =
    totalGridCapacity +
    totalDGCapacity +
    totalSolarCapacity +
    Math.round(transformerCapacity) +
    Math.round(pumpCapacity);

  const analytics = {
    totalFacilities: facilities.length,
    completedAudits: auditStatus.completed,
    pendingAudits: auditStatus.pending,
    totalCapacity,
    totalConnections: utilityAccounts.length,
    dgCapacity: totalDGCapacity,
    solarCapacity: totalSolarCapacity,
    totalDGSystems: dgSets.length,
    totalSolarSystems: solarPlants.length,
    totalTransformers: transformers.length,
    totalPumps: pumps.length,
  };

  const stats = {
    facilities: getComparisonStats(facilities),
    utilityAccounts: getComparisonStats(utilityAccounts),
    solarPlants: getComparisonStats(solarPlants),
    dgSets: getComparisonStats(dgSets),
    transformers: getComparisonStats(transformers),
    pumps: getComparisonStats(pumps),
  };

  const timeSeriesData = buildTimeSeriesData(
    [facilities, utilityAccounts, solarPlants, dgSets, transformers, pumps],
    6,
  );

  res.status(200).json({
    success: true,
    data: {
      analytics,
      stats,
      statusData: auditStatus.chart,
      energySourceData: energySourceDistribution,
      capacityByCity,
      timeSeriesData,
    },
  });
});

export { getAnalytics };
