import RecentActivity from "../modals/recentActivity.js";

export const createRecentActivity = async ({
  actor = null,
  action,
  entity_type,
  entity_id,
  entity_name = "",
  facility_id = null,
  utility_account_id = null,
  message,
  meta = {},
  created_by_system = false,
}) => {
  try {
    if (!action || !entity_type || !entity_id || !message) return null;

    return await RecentActivity.create({
      actor_id: actor?._id || actor?.id || null,
      actor_name: actor?.name || "",
      actor_role: actor?.role || "",
      action,
      entity_type,
      entity_id,
      entity_name,
      facility_id,
      utility_account_id,
      message,
      meta,
      created_by_system,
    });
  } catch (error) {
    console.error("Failed to create recent activity:", error.message);
    return null;
  }
};
