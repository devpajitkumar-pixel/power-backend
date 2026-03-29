export const buildActivityMessage = ({
  actorName = "User",
  action,
  entityLabel,
  entityName = "",
}) => {
  const safeEntityName = entityName ? ` "${entityName}"` : "";

  switch (action) {
    case "created":
      return `${actorName} created ${entityLabel}${safeEntityName}`;
    case "updated":
      return `${actorName} updated ${entityLabel}${safeEntityName}`;
    case "deleted":
      return `${actorName} deleted ${entityLabel}${safeEntityName}`;
    case "assigned":
      return `${actorName} assigned ${entityLabel}${safeEntityName}`;
    case "unassigned":
      return `${actorName} unassigned ${entityLabel}${safeEntityName}`;
    case "generated":
      return `${actorName} generated ${entityLabel}${safeEntityName}`;
    case "uploaded":
      return `${actorName} uploaded ${entityLabel}${safeEntityName}`;
    case "status_changed":
      return `${actorName} changed status of ${entityLabel}${safeEntityName}`;
    case "login":
      return `${actorName} logged in`;
    case "logout":
      return `${actorName} logged out`;
    default:
      return `${actorName} performed ${action} on ${entityLabel}${safeEntityName}`;
  }
};
