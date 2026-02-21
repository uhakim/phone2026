export function mapLoginIdToEmail(loginId: string) {
  const normalized = loginId.trim();

  if (normalized.includes("@")) {
    return normalized.toLowerCase();
  }

  // Bluecard style: treat student ID as email local-part for Supabase Auth.
  return `${normalized.toLowerCase()}@student.dongsung.local`;
}

