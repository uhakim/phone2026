import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsentDocument = {
  id: number;
  consent_type: string;
  title: string;
  content: string;
  version: number;
  is_required: boolean;
  is_active: boolean;
};

export type ConsentStatus = {
  required: boolean;
  agreed: boolean;
  agreed_at: string | null;
  document: ConsentDocument | null;
};

export async function getLatestRequiredConsentDocument(serviceClient: SupabaseClient) {
  const { data, error } = await serviceClient
    .from("consent_documents")
    .select("id, consent_type, title, content, version, is_required, is_active")
    .eq("is_active", true)
    .eq("is_required", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`동의 문서 조회 실패: ${error.message}`);
  }

  return (data as ConsentDocument | null) ?? null;
}

export async function getConsentStatus(serviceClient: SupabaseClient, userId: string): Promise<ConsentStatus> {
  const latest = await getLatestRequiredConsentDocument(serviceClient);
  if (!latest) {
    return {
      required: false,
      agreed: true,
      agreed_at: null,
      document: null,
    };
  }

  const { data, error } = await serviceClient
    .from("user_consents")
    .select("agreed_at")
    .eq("user_id", userId)
    .eq("document_id", latest.id)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(`동의 이력 조회 실패: ${error.message}`);
  }

  return {
    required: true,
    agreed: Boolean(data),
    agreed_at: data?.agreed_at ?? null,
    document: latest,
  };
}

export async function ensureLatestConsentAgreed(serviceClient: SupabaseClient, userId: string) {
  const status = await getConsentStatus(serviceClient, userId);
  if (!status.required) return null;
  if (status.agreed) return null;
  return "개인정보 수집·이용 동의 후 신청할 수 있습니다.";
}

