import type { SupabaseClient } from "@supabase/supabase-js";

export const SETTINGS_DEFAULTS = {
  academic_year: "2026",
  academic_year_start: "2026-03-01",
  principal_stamp_path: "",
  google_sheet_webapp_url: "",
  gate_sheet_url: "",
} as const;

export type SettingsKey = keyof typeof SETTINGS_DEFAULTS;

export async function getSettingsMap(serviceClient: SupabaseClient) {
  const keys = Object.keys(SETTINGS_DEFAULTS) as SettingsKey[];
  const { data, error } = await serviceClient
    .from("settings")
    .select("key, value")
    .in("key", keys);

  if (error) throw new Error(`설정 조회 실패: ${error.message}`);

  const map: Record<SettingsKey, string> = { ...SETTINGS_DEFAULTS };
  for (const row of data ?? []) {
    if (row.key in map) {
      map[row.key as SettingsKey] = String(row.value ?? "");
    }
  }
  return map;
}

export async function setSettingValue(serviceClient: SupabaseClient, key: SettingsKey, value: string) {
  const { error } = await serviceClient.from("settings").upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(`설정 저장 실패: ${error.message}`);
}
