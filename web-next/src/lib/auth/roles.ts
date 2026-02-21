type AuthLikeUser = {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

function parseAdminEmails(rawAdminEmails: string | undefined) {
  return new Set(
    (rawAdminEmails ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function readRole(user: AuthLikeUser) {
  const appRole = user.app_metadata?.role;
  const userRole = user.user_metadata?.role;

  if (typeof appRole === "string") {
    return appRole.toLowerCase();
  }
  if (typeof userRole === "string") {
    return userRole.toLowerCase();
  }
  return "";
}

export function isAdminUser(user: AuthLikeUser | undefined | null, rawAdminEmails: string | undefined) {
  if (!user) {
    return false;
  }

  const role = readRole(user);
  if (role === "admin") {
    return true;
  }

  if (!user.email) {
    return false;
  }

  const adminEmails = parseAdminEmails(rawAdminEmails);
  return adminEmails.has(user.email.toLowerCase());
}

