import asyncHandler from "../middlewares/asyncHandler.js";

import Facility from "../modals/facility.js";
import UtilityAccount from "../modals/utilityAccount.js";
import SolarPlant from "../modals/solarPlant.js";
import DGSet from "../modals/dgSet.js";
import Transformer from "../modals/transformer.js";
import Pump from "../modals/pump.js";

import ACAuditRecord from "../modals/acAuditRecord.js";
import HVACAudit from "../modals/hvacAudit.js";
import FanAuditRecord from "../modals/fanAuditRecord.js";
import LightingAuditRecord from "../modals/lightingAuditRecord.js";
import LuxMeasurement from "../modals/luxMeasurement.js";
import MiscLoadAuditRecord from "../modals/miscLoadAuditRecord.js";
import DGAuditRecord from "../modals/dgAuditRecord.js";
import PumpAuditRecord from "../modals/pumpAuditRecord.js";
import TransformerAuditRecord from "../modals/transformerAuditRecord.js";
import SolarGenerationRecord from "../modals/solarGenerationRecord.js";

import FacilityAuditor from "../modals/facilityAuditor.js";
import RecentActivity from "../modals/recentActivity.js";
import User from "../modals/user.js";
import PresenceLog from "../modals/presenceLog.js";

const isAdmin = (user) => user?.role === "admin";

const getMonthRanges = () => {
  const now = new Date();

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1,
    0,
    0,
    0,
    0,
  );
  const lastMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999,
  );

  return {
    now,
    currentMonthStart,
    lastMonthStart,
    lastMonthEnd,
  };
};

const buildComparison = (currentTotal, lastMonthTotal) => {
  const difference = currentTotal - lastMonthTotal;

  let percentage = 0;
  if (lastMonthTotal > 0) {
    percentage = Number(((difference / lastMonthTotal) * 100).toFixed(2));
  } else if (currentTotal > 0) {
    percentage = 100;
  }

  return {
    total: currentTotal,
    lastMonthTotal,
    difference,
    percentage,
    trend:
      difference > 0 ? "increase" : difference < 0 ? "decrease" : "no_change",
  };
};

const getModelCreatedField = (Model) => {
  if (Model?.schema?.paths?.createdAt) return "createdAt";
  if (Model?.schema?.paths?.created_at) return "created_at";
  return null;
};

const getModelUpdatedField = (Model) => {
  if (Model?.schema?.paths?.updatedAt) return "updatedAt";
  if (Model?.schema?.paths?.updated_at) return "updated_at";
  return null;
};

const getAccessibleFacilityIds = async (user) => {
  if (!user?._id) return [];

  if (isAdmin(user)) {
    const facilities = await Facility.find({}, "_id").lean();
    return facilities.map((item) => item._id);
  }

  const ownedFacilities = await Facility.find(
    { owner_user_id: user._id },
    "_id",
  ).lean();

  const assignedFacilities = await FacilityAuditor.find(
    { user_id: user._id },
    "facility_id",
  ).lean();

  const ids = [
    ...ownedFacilities.map((item) => String(item._id)),
    ...assignedFacilities.map((item) => String(item.facility_id)),
  ];

  return [...new Set(ids)];
};

const getAccessibleUtilityIds = async (facilityIds = []) => {
  if (!facilityIds.length) return [];

  const utilityAccounts = await UtilityAccount.find(
    { facility_id: { $in: facilityIds } },
    "_id",
  ).lean();

  return utilityAccounts.map((item) => item._id);
};

const getCountComparison = async (Model, query = {}) => {
  const { lastMonthEnd } = getMonthRanges();
  const createdField = getModelCreatedField(Model);

  const currentTotal = await Model.countDocuments(query);

  let lastMonthTotal = currentTotal;

  if (createdField) {
    lastMonthTotal = await Model.countDocuments({
      ...query,
      [createdField]: { $lte: lastMonthEnd },
    });
  }

  return buildComparison(currentTotal, lastMonthTotal);
};

const getRecentActivitiesData = async (user, facilityIds) => {
  const createdField = getModelCreatedField(RecentActivity) || "createdAt";
  const updatedField = getModelUpdatedField(RecentActivity) || "updatedAt";

  const query = isAdmin(user)
    ? {}
    : {
        $or: [{ facility_id: { $in: facilityIds } }, { actor_id: user._id }],
      };

  const activities = await RecentActivity.find(query)
    .populate("actor_id", "name email role")
    .populate("facility_id", "name city")
    .populate("utility_account_id", "account_number")
    .sort({ [createdField]: -1 })
    .limit(10)
    .lean();

  return activities.map((item) => ({
    _id: item._id,
    action: item.action,
    entity_type: item.entity_type,
    entity_id: item.entity_id,
    entity_name: item.entity_name,
    message: item.message,
    meta: item.meta || {},
    actor: item.actor_id
      ? {
          _id: item.actor_id._id,
          name: item.actor_id.name,
          email: item.actor_id.email,
          role: item.actor_id.role,
        }
      : null,
    facility: item.facility_id
      ? {
          _id: item.facility_id._id,
          name: item.facility_id.name,
          city: item.facility_id.city,
        }
      : null,
    utility_account: item.utility_account_id
      ? {
          _id: item.utility_account_id._id,
          account_number: item.utility_account_id.account_number,
        }
      : null,
    createdAt: item[createdField] || null,
    updatedAt: item[updatedField] || null,
  }));
};

const getVisibleUsers = async (user, facilityIds) => {
  if (isAdmin(user)) {
    const createdField = getModelCreatedField(User) || "createdAt";
    return await User.find({}, "name email role")
      .sort({ [createdField]: -1 })
      .lean();
  }

  const ownedFacilities = await Facility.find(
    { owner_user_id: user._id },
    "_id",
  ).lean();

  const assignedRows = await FacilityAuditor.find(
    {
      $or: [
        { facility_id: { $in: facilityIds } },
        { facility_id: { $in: ownedFacilities.map((f) => f._id) } },
      ],
    },
    "user_id",
  ).lean();

  const assignedUserIds = assignedRows.map((item) => String(item.user_id));
  const userIds = [...new Set([String(user._id), ...assignedUserIds])];

  return await User.find({ _id: { $in: userIds } }, "name email role").lean();
};

const normalizePresenceStatus = (status) => {
  if (!status) return "offline";

  const value = String(status).toLowerCase();

  if (["online", "active", "available"].includes(value)) return "online";
  if (["away", "idle", "inactive", "afk"].includes(value)) return "away";
  return "offline";
};

const getUserAppearanceData = async (user, facilityIds) => {
  const users = await getVisibleUsers(user, facilityIds);
  if (!users.length) return [];

  const userIds = users.map((u) => String(u._id));

  const latestPresence = await PresenceLog.aggregate([
    {
      $match: {
        userId: { $in: userIds },
      },
    },
    {
      $sort: { timestamp: -1 },
    },
    {
      $group: {
        _id: "$userId",
        status: { $first: "$status" },
        timestamp: { $first: "$timestamp" },
      },
    },
  ]);

  const presenceMap = new Map(
    latestPresence.map((item) => [
      String(item._id),
      {
        status: normalizePresenceStatus(item.status),
        timestamp: item.timestamp,
      },
    ]),
  );

  return users.map((u) => {
    const presence = presenceMap.get(String(u._id));

    return {
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      appearance: {
        status: presence?.status || "offline",
        lastSeen: presence?.timestamp || null,
      },
    };
  });
};

const getDashboardStatQueries = (user, facilityIds, utilityIds) => {
  const facilityQuery = isAdmin(user) ? {} : { _id: { $in: facilityIds } };
  const utilityQuery = isAdmin(user)
    ? {}
    : { facility_id: { $in: facilityIds } };
  const assetQuery = isAdmin(user)
    ? {}
    : { utility_account_id: { $in: utilityIds } };

  return { facilityQuery, utilityQuery, assetQuery };
};

const getCoreStats = async (user, facilityIds, utilityIds) => {
  const { facilityQuery, utilityQuery, assetQuery } = getDashboardStatQueries(
    user,
    facilityIds,
    utilityIds,
  );

  const [
    facilities,
    utilityAccounts,
    solarPlants,
    dgSets,
    transformers,
    pumps,
  ] = await Promise.all([
    getCountComparison(Facility, facilityQuery),
    getCountComparison(UtilityAccount, utilityQuery),
    getCountComparison(SolarPlant, assetQuery),
    getCountComparison(DGSet, assetQuery),
    getCountComparison(Transformer, assetQuery),
    getCountComparison(Pump, assetQuery),
  ]);

  return {
    facilities,
    utilityAccounts,
    solarPlants,
    dgSets,
    transformers,
    pumps,
  };
};

const getAuditStats = async (user, facilityIds, utilityIds) => {
  const { assetQuery } = getDashboardStatQueries(user, facilityIds, utilityIds);

  const facilityScopedQuery = isAdmin(user)
    ? {}
    : { facility_id: { $in: facilityIds } };

  const utilityScopedQuery = isAdmin(user)
    ? {}
    : { utility_account_id: { $in: utilityIds } };

  const [
    acAudits,
    hvacAudits,
    fanAudits,
    lightingAudits,
    luxMeasurements,
    miscLoadAudits,
    dgAudits,
    pumpAudits,
    transformerAudits,
    solarGenerationRecords,
  ] = await Promise.all([
    getCountComparison(ACAuditRecord, utilityScopedQuery),
    getCountComparison(HVACAudit, utilityScopedQuery),
    getCountComparison(FanAuditRecord, utilityScopedQuery),
    getCountComparison(LightingAuditRecord, utilityScopedQuery),
    getCountComparison(LuxMeasurement, utilityScopedQuery),
    getCountComparison(MiscLoadAuditRecord, utilityScopedQuery),
    getCountComparison(DGAuditRecord, utilityScopedQuery),
    getCountComparison(PumpAuditRecord, utilityScopedQuery),
    getCountComparison(TransformerAuditRecord, utilityScopedQuery),
    getCountComparison(SolarGenerationRecord, utilityScopedQuery),
  ]);

  const totalAudits = {
    total:
      acAudits.total +
      hvacAudits.total +
      fanAudits.total +
      lightingAudits.total +
      luxMeasurements.total +
      miscLoadAudits.total +
      dgAudits.total +
      pumpAudits.total +
      transformerAudits.total +
      solarGenerationRecords.total,
    lastMonthTotal:
      acAudits.lastMonthTotal +
      hvacAudits.lastMonthTotal +
      fanAudits.lastMonthTotal +
      lightingAudits.lastMonthTotal +
      luxMeasurements.lastMonthTotal +
      miscLoadAudits.lastMonthTotal +
      dgAudits.lastMonthTotal +
      pumpAudits.lastMonthTotal +
      transformerAudits.lastMonthTotal +
      solarGenerationRecords.lastMonthTotal,
  };

  const totalAuditComparison = buildComparison(
    totalAudits.total,
    totalAudits.lastMonthTotal,
  );

  return {
    totalAudits: totalAuditComparison,
    acAudits,
    hvacAudits,
    fanAudits,
    lightingAudits,
    luxMeasurements,
    miscLoadAudits,
    dgAudits,
    pumpAudits,
    transformerAudits,
    solarGenerationRecords,
    linkedAssets: {
      solarPlants: await getCountComparison(SolarPlant, assetQuery),
      dgSets: await getCountComparison(DGSet, assetQuery),
      transformers: await getCountComparison(Transformer, assetQuery),
      pumps: await getCountComparison(Pump, assetQuery),
    },
    facilitiesCovered: await getCountComparison(Facility, facilityScopedQuery),
  };
};

// @desc    Get only dashboard stats
// @route   GET /api/v1/dashboard/stats
// @access  Protected
const getDashboardStats = asyncHandler(async (req, res) => {
  const facilityIds = await getAccessibleFacilityIds(req.user);
  const utilityIds = await getAccessibleUtilityIds(facilityIds);

  const stats = await getCoreStats(req.user, facilityIds, utilityIds);
  const auditStats = await getAuditStats(req.user, facilityIds, utilityIds);

  res.json({
    success: true,
    data: {
      ...stats,
      auditStats,
    },
  });
});

// @desc    Get recent dashboard activities
// @route   GET /api/v1/dashboard/recent-activities
// @access  Protected
const getDashboardRecentActivities = asyncHandler(async (req, res) => {
  const facilityIds = await getAccessibleFacilityIds(req.user);
  const activities = await getRecentActivitiesData(req.user, facilityIds);

  res.json({
    success: true,
    count: activities.length,
    data: activities,
  });
});

// @desc    Get dashboard user appearance from PresenceLog
// @route   GET /api/v1/dashboard/user-appearance
// @access  Protected
const getDashboardUserAppearance = asyncHandler(async (req, res) => {
  const facilityIds = await getAccessibleFacilityIds(req.user);
  const appearance = await getUserAppearanceData(req.user, facilityIds);

  res.json({
    success: true,
    count: appearance.length,
    data: appearance,
  });
});

// @desc    Get full dashboard overview
// @route   GET /api/v1/dashboard/overview
// @access  Protected
const getDashboardOverview = asyncHandler(async (req, res) => {
  const facilityIds = await getAccessibleFacilityIds(req.user);
  const utilityIds = await getAccessibleUtilityIds(facilityIds);

  const [stats, auditStats, recentActivities, userAppearance] =
    await Promise.all([
      getCoreStats(req.user, facilityIds, utilityIds),
      getAuditStats(req.user, facilityIds, utilityIds),
      getRecentActivitiesData(req.user, facilityIds),
      getUserAppearanceData(req.user, facilityIds),
    ]);

  res.json({
    success: true,
    data: {
      stats,
      auditStats,
      recentActivities,
      userAppearance,
    },
  });
});

export {
  getDashboardStats,
  getDashboardRecentActivities,
  getDashboardUserAppearance,
  getDashboardOverview,
};
