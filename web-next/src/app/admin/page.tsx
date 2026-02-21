"use client";

import { isAdminUser } from "@/lib/auth/roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ApplicationItem = {
  id: number | string;
  student_id: string;
  application_type: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | string;
  approval_number?: string | null;
  submitted_at?: string | null;
  rejection_reason?: string | null;
};

type StudentItem = {
  id: number;
  student_id: string;
  name: string;
  grade: number;
  class_num: number;
};

type FilterType = "all" | "pending" | "approved" | "rejected";
type ActionType = "approve" | "reject" | "reset";
type PolicyMode = "manual" | "immediate" | "delayed";
type PolicyKey = "phone" | "tablet" | "pass";
type AdminSection = "applications" | "policies" | "students" | "settings" | "gate_roster" | "stats" | "password";

type PolicyItem = {
  policy_key: PolicyKey;
  mode: PolicyMode;
  delay_minutes: number;
};

type SettingsItem = {
  academic_year: string;
  academic_year_start: string;
  principal_stamp_path: string;
  google_sheet_webapp_url: string;
  gate_sheet_url: string;
};

type GateRosterItem = {
  student_id: string;
  name: string;
  grade: number | null;
  class_num: number | null;
  reason: string;
  morning: Record<string, string>;
  dismissal: Record<string, string>;
};

type StatsItem = {
  summary: {
    total_students: number;
    total_applications: number;
    unique_applicants: number;
  };
  students: {
    grades: Record<string, number>;
  };
  applications: {
    by_type: Record<string, number>;
    by_status: Record<string, number>;
    unique_applicants_by_type: Record<string, number>;
  };
};

function statusLabel(status: string) {
  if (status === "approved") return "승인";
  if (status === "rejected") return "반려";
  if (status === "pending") return "대기";
  return status;
}

function approvalPlaceholder(applicationType: string) {
  const normalized = applicationType.toLowerCase();
  if (normalized.includes("phone") || applicationType.includes("휴대")) return "예: ds-phone-001";
  if (normalized.includes("tablet") || applicationType.includes("태블")) return "예: ds-tablet-001";
  if (normalized.includes("pass") || normalized.includes("gate") || applicationType.includes("정문") || applicationType.includes("출입")) {
    return "예: ds-pass-001";
  }
  return "비우면 자동 생성";
}

function policyLabel(key: PolicyKey) {
  if (key === "phone") return "휴대전화";
  if (key === "tablet") return "태블릿";
  return "정문 출입";
}

function toCsvTemplate() {
  return "student_id,name,grade,class_num\n10101@ds.es.kr,홍길동,6,1\n";
}

function parseStudentCsv(text: string) {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const indexes = {
    student_id: headers.indexOf("student_id"),
    name: headers.indexOf("name"),
    grade: headers.indexOf("grade"),
    class_num: headers.indexOf("class_num"),
  };
  if (Object.values(indexes).some((idx) => idx < 0)) return null;

  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return {
      student_id: cells[indexes.student_id] ?? "",
      name: cells[indexes.name] ?? "",
      grade: Number(cells[indexes.grade] ?? 0),
      class_num: Number(cells[indexes.class_num] ?? 0),
    };
  });
  return rows;
}

async function readCsvText(file: File) {
  const buffer = await file.arrayBuffer();

  const utf8Text = new TextDecoder("utf-8").decode(buffer);
  const normalizedUtf8 = utf8Text.charCodeAt(0) === 0xfeff ? utf8Text.slice(1) : utf8Text;
  if (!normalizedUtf8.includes("\uFFFD")) {
    return normalizedUtf8;
  }

  try {
    const eucKrText = new TextDecoder("euc-kr").decode(buffer);
    const normalizedEucKr = eucKrText.charCodeAt(0) === 0xfeff ? eucKrText.slice(1) : eucKrText;
    if (!normalizedEucKr.includes("\uFFFD")) {
      return normalizedEucKr;
    }
  } catch {
    // Ignore decoder fallback errors and use UTF-8 result.
  }

  return normalizedUtf8;
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("applications");

  const [filter, setFilter] = useState<FilterType>("all");
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");
  const [approvalNumbers, setApprovalNumbers] = useState<Record<string, string>>({});
  const [rejectTarget, setRejectTarget] = useState<ApplicationItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentMessage, setStudentMessage] = useState("");
  const [newStudent, setNewStudent] = useState({ student_id: "", name: "", grade: 1, class_num: 1 });

  const [policies, setPolicies] = useState<Record<PolicyKey, PolicyItem>>({
    phone: { policy_key: "phone", mode: "manual", delay_minutes: 10 },
    tablet: { policy_key: "tablet", mode: "manual", delay_minutes: 10 },
    pass: { policy_key: "pass", mode: "manual", delay_minutes: 10 },
  });
  const [isSavingPolicy, setIsSavingPolicy] = useState<Record<PolicyKey, boolean>>({
    phone: false,
    tablet: false,
    pass: false,
  });
  const [policyMessage, setPolicyMessage] = useState("");
  const [settings, setSettings] = useState<SettingsItem>({
    academic_year: "2026",
    academic_year_start: "2026-03-01",
    principal_stamp_path: "",
    google_sheet_webapp_url: "",
    gate_sheet_url: "",
  });
  const [settingsMessage, setSettingsMessage] = useState("");
  const [gateRoster, setGateRoster] = useState<GateRosterItem[]>([]);
  const [isLoadingGateRoster, setIsLoadingGateRoster] = useState(false);
  const [gateSheetUrl, setGateSheetUrl] = useState("");
  const [gateMessage, setGateMessage] = useState("");
  const [stats, setStats] = useState<StatsItem | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsMessage, setStatsMessage] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isCsvDragOver, setIsCsvDragOver] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkSessionAndRole() {
      if (!supabase) {
        router.replace("/");
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;

      if (sessionError || !data.session) {
        router.replace("/");
        return;
      }

      const user = data.session.user;
      const allowed = isAdminUser(user, process.env.NEXT_PUBLIC_ADMIN_EMAILS);
      setUserEmail(user.email ?? "");
      setAccessToken(data.session.access_token);
      setIsAllowed(allowed);
      setIsChecking(false);
    }

    void checkSessionAndRole();

    const authState = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/");
        return;
      }
      setAccessToken(session.access_token);
    });

    return () => {
      mounted = false;
      authState?.data.subscription.unsubscribe();
    };
  }, [router, supabase]);

  const fetchApplications = useCallback(async (token: string, nextFilter: FilterType) => {
    setIsLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ status: nextFilter }).toString();
      const response = await fetch(`/api/admin/applications?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as { error?: string; items?: ApplicationItem[] };
      if (!response.ok) throw new Error(payload.error ?? "신청서 조회에 실패했습니다.");
      const nextItems = payload.items ?? [];
      setItems(nextItems);
      setApprovalNumbers((prev) => {
        const next = { ...prev };
        for (const item of nextItems) {
          const key = String(item.id);
          if (!next[key] && item.approval_number) next[key] = item.approval_number;
        }
        return next;
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "신청서 조회 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPolicies = useCallback(async (token: string) => {
    try {
      const response = await fetch("/api/admin/policies", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as { error?: string; items?: PolicyItem[] };
      if (!response.ok) throw new Error(payload.error ?? "정책 조회에 실패했습니다.");
      setPolicies((prev) => {
        const next = { ...prev };
        for (const item of payload.items ?? []) next[item.policy_key] = item;
        return next;
      });
    } catch (policyError) {
      const message = policyError instanceof Error ? policyError.message : "정책 조회 중 오류가 발생했습니다.";
      setPolicyMessage(message);
    }
  }, []);

  const fetchStudents = useCallback(async (token: string) => {
    setIsLoadingStudents(true);
    setStudentMessage("");
    try {
      const response = await fetch("/api/admin/students", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as { error?: string; items?: StudentItem[] };
      if (!response.ok) throw new Error(payload.error ?? "학생 목록 조회에 실패했습니다.");
      setStudents(payload.items ?? []);
    } catch (studentError) {
      const message = studentError instanceof Error ? studentError.message : "학생 목록 조회 중 오류가 발생했습니다.";
      setStudentMessage(message);
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  const fetchSettings = useCallback(async (token: string) => {
    setSettingsMessage("");
    try {
      const response = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as { error?: string; item?: SettingsItem };
      if (!response.ok) throw new Error(payload.error ?? "설정 조회에 실패했습니다.");
      if (payload.item) {
        setSettings(payload.item);
      }
    } catch (settingsError) {
      const message = settingsError instanceof Error ? settingsError.message : "설정 조회 중 오류가 발생했습니다.";
      setSettingsMessage(message);
    }
  }, []);

  const fetchGateRoster = useCallback(async (token: string) => {
    setIsLoadingGateRoster(true);
    setGateMessage("");
    try {
      const response = await fetch("/api/admin/gate-roster", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as {
        error?: string;
        items?: GateRosterItem[];
        gate_sheet_url?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "정문 출입 명단 조회에 실패했습니다.");
      setGateRoster(payload.items ?? []);
      setGateSheetUrl(payload.gate_sheet_url ?? "");
    } catch (rosterError) {
      const message = rosterError instanceof Error ? rosterError.message : "정문 출입 명단 조회 중 오류가 발생했습니다.";
      setGateMessage(message);
    } finally {
      setIsLoadingGateRoster(false);
    }
  }, []);

  const fetchStats = useCallback(async (token: string) => {
    setIsLoadingStats(true);
    setStatsMessage("");
    try {
      const response = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as { error?: string } & StatsItem;
      if (!response.ok) throw new Error(payload.error ?? "통계 조회에 실패했습니다.");
      setStats(payload);
    } catch (statsError) {
      const message = statsError instanceof Error ? statsError.message : "통계 조회 중 오류가 발생했습니다.";
      setStatsMessage(message);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken || !isAllowed) return;
    void fetchApplications(accessToken, filter);
    void fetchPolicies(accessToken);
    void fetchStudents(accessToken);
    void fetchSettings(accessToken);
    void fetchGateRoster(accessToken);
    void fetchStats(accessToken);
  }, [accessToken, fetchApplications, fetchGateRoster, fetchPolicies, fetchSettings, fetchStats, fetchStudents, filter, isAllowed]);

  async function savePolicy(key: PolicyKey) {
    if (!accessToken) return;
    setPolicyMessage("");
    setIsSavingPolicy((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await fetch("/api/admin/policies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(policies[key]),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "정책 저장에 실패했습니다.");
      setPolicyMessage(`${policyLabel(key)} 정책을 저장했습니다.`);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "정책 저장 중 오류가 발생했습니다.";
      setPolicyMessage(message);
    } finally {
      setIsSavingPolicy((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function runAutoApprovalNow() {
    if (!accessToken) return;
    setPolicyMessage("");
    try {
      const response = await fetch("/api/admin/policies/run-auto-approval", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as { error?: string; updated_count?: number };
      if (!response.ok) throw new Error(payload.error ?? "자동승인 실행에 실패했습니다.");
      setPolicyMessage(`자동승인 실행 완료: ${payload.updated_count ?? 0}건 처리`);
      await fetchApplications(accessToken, filter);
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "자동승인 실행 중 오류가 발생했습니다.";
      setPolicyMessage(message);
    }
  }

  async function updateStatus(item: ApplicationItem, action: ActionType, reason?: string) {
    if (!accessToken) return;
    const itemId = String(item.id);
    setActionId(itemId);
    setError("");
    try {
      const response = await fetch(`/api/admin/applications/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          action,
          rejectionReason: action === "reject" ? reason : undefined,
          approvalNumber: action === "approve" ? approvalNumbers[itemId] : undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string; sync_error?: string };
      if (!response.ok) throw new Error(payload.error ?? "상태 변경에 실패했습니다.");
      if (payload.sync_error) {
        setError(`처리는 완료됐지만 정문 명단 동기화 실패: ${payload.sync_error}`);
      }
      await fetchApplications(accessToken, filter);
      await fetchGateRoster(accessToken);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "상태 변경 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setActionId("");
    }
  }

  async function addOrUpdateStudent() {
    if (!accessToken) return;
    setStudentMessage("");
    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(newStudent),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "학생 저장에 실패했습니다.");
      setStudentMessage("학생 정보가 저장되었습니다.");
      setNewStudent({ student_id: "", name: "", grade: 1, class_num: 1 });
      await fetchStudents(accessToken);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "학생 저장 중 오류가 발생했습니다.";
      setStudentMessage(message);
    }
  }

  async function deleteStudent(studentId: string) {
    if (!accessToken) return;
    setStudentMessage("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "학생 삭제에 실패했습니다.");
      setStudentMessage("학생이 삭제되었습니다.");
      await fetchStudents(accessToken);
      await fetchApplications(accessToken, filter);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "학생 삭제 중 오류가 발생했습니다.";
      setStudentMessage(message);
    }
  }

  async function clearAllStudents() {
    if (!accessToken) return;
    if (!window.confirm("학생/신청 데이터를 모두 삭제합니다. 계속할까요?")) return;

    setStudentMessage("");
    try {
      const response = await fetch("/api/admin/students?all=true", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "전체 삭제에 실패했습니다.");
      setStudentMessage("학생/신청 데이터가 전체 삭제되었습니다.");
      await fetchStudents(accessToken);
      await fetchApplications(accessToken, filter);
    } catch (clearError) {
      const message = clearError instanceof Error ? clearError.message : "전체 삭제 중 오류가 발생했습니다.";
      setStudentMessage(message);
    }
  }

  async function uploadCsv(file: File) {
    if (!accessToken) return;
    setStudentMessage("");
    const text = await readCsvText(file);
    const rows = parseStudentCsv(text);
    if (!rows || rows.length === 0) {
      setStudentMessage("CSV 형식이 올바르지 않습니다. (student_id,name,grade,class_num)");
      return;
    }

    try {
      const response = await fetch("/api/admin/students?mode=bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ students: rows }),
      });
      const payload = (await response.json()) as { error?: string; count?: number };
      if (!response.ok) throw new Error(payload.error ?? "CSV 업로드에 실패했습니다.");
      setStudentMessage(`${payload.count ?? rows.length}명의 학생을 저장했습니다.`);
      await fetchStudents(accessToken);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "CSV 업로드 중 오류가 발생했습니다.";
      setStudentMessage(message);
    }
  }

  function downloadCsvTemplate() {
    const blob = new Blob([toCsvTemplate()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "students_template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openReject(item: ApplicationItem) {
    setRejectTarget(item);
    setRejectionReason(item.rejection_reason ?? "");
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    if (!rejectionReason.trim()) {
      setError("반려 사유를 입력해주세요.");
      return;
    }
    await updateStatus(rejectTarget, "reject", rejectionReason.trim());
    setRejectTarget(null);
    setRejectionReason("");
  }

  async function saveSetting(key: keyof SettingsItem, value: string) {
    if (!accessToken) return;
    setSettingsMessage("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ key, value }),
      });
      const payload = (await response.json()) as { error?: string; item?: SettingsItem };
      if (!response.ok) throw new Error(payload.error ?? "설정 저장에 실패했습니다.");
      if (payload.item) {
        setSettings(payload.item);
      }
      setSettingsMessage("설정을 저장했습니다.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "설정 저장 중 오류가 발생했습니다.";
      setSettingsMessage(message);
    }
  }

  async function uploadPrincipalStamp(file: File) {
    if (!accessToken) return;
    setSettingsMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/settings/principal-stamp", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "직인 업로드에 실패했습니다.");
      setSettingsMessage("직인 이미지를 저장했습니다.");
      await fetchSettings(accessToken);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "직인 업로드 중 오류가 발생했습니다.";
      setSettingsMessage(message);
    }
  }

  async function deletePrincipalStamp() {
    if (!accessToken) return;
    setSettingsMessage("");
    try {
      const response = await fetch("/api/admin/settings/principal-stamp", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "직인 삭제에 실패했습니다.");
      setSettingsMessage("직인 이미지를 삭제했습니다.");
      await fetchSettings(accessToken);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "직인 삭제 중 오류가 발생했습니다.";
      setSettingsMessage(message);
    }
  }

  async function syncGateRosterToGoogleSheet() {
    if (!accessToken) return;
    setGateMessage("");
    try {
      const response = await fetch("/api/admin/gate-roster/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as { error?: string; count?: number };
      if (!response.ok) throw new Error(payload.error ?? "구글시트 동기화에 실패했습니다.");
      setGateMessage(`구글시트 동기화 완료: ${payload.count ?? 0}건`);
      await fetchGateRoster(accessToken);
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "구글시트 동기화 중 오류가 발생했습니다.";
      setGateMessage(message);
    }
  }

  async function changePassword() {
    if (!supabase) return;
    setError("");
    setPasswordMessage("");

    const next = newPassword.trim();
    const confirm = newPasswordConfirm.trim();

    if (next.length < 6) {
      setError("비밀번호는 6자 이상으로 입력해주세요.");
      return;
    }
    if (next !== confirm) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;
      setPasswordMessage("비밀번호가 변경되었습니다.");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (changeError) {
      const message = changeError instanceof Error ? changeError.message : "비밀번호 변경 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/");
  }

  const pendingCount = items.filter((item) => item.status === "pending").length;
  const approvedCount = items.filter((item) => item.status === "approved").length;
  const rejectedCount = items.filter((item) => item.status === "rejected").length;
  const gradeChart = stats
    ? ["1", "2", "3", "4", "5", "6"].map((grade) => ({ label: `${grade}학년`, value: stats.students.grades[grade] ?? 0 }))
    : [];
  const maxGrade = Math.max(1, ...gradeChart.map((item) => item.value));
  const typeChart = stats
    ? [
        { label: "휴대전화", value: stats.applications.by_type.phone ?? 0 },
        { label: "태블릿", value: stats.applications.by_type.tablet ?? 0 },
        { label: "정문출입", value: stats.applications.by_type.gate ?? 0 },
      ]
    : [];
  const maxType = Math.max(1, ...typeChart.map((item) => item.value));

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <section className="school-card w-full max-w-lg p-8 text-center">
          <p className="text-sm text-text-muted">관리자 권한을 확인하고 있습니다...</p>
        </section>
      </main>
    );
  }

  if (!isAllowed) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <section className="school-card w-full max-w-lg p-8 text-center">
          <h1 className="text-2xl font-semibold text-text-strong">접근 권한이 없습니다</h1>
          <p className="mt-3 text-sm text-text-muted">현재 계정은 관리자 대시보드 접근 권한이 없습니다.</p>
          <button type="button" className="school-button mt-6 px-5 py-3 text-sm font-semibold" onClick={() => router.push("/dashboard")}>학부모 대시보드로 이동</button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen justify-center p-4 sm:p-6">
      <section className="school-card w-full max-w-[1240px] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.2em] text-school-sub uppercase">DONGSUNG ADMIN</p>
            <h1 className="mt-2 text-3xl font-semibold text-text-strong">관리자 대시보드</h1>
            <p className="mt-2 text-sm text-text-default">신청서 승인/반려, 자동승인 정책, 학생 명단을 관리합니다.</p>
            {userEmail ? <p className="mt-2 text-sm text-text-muted">관리자 계정: {userEmail}</p> : null}
          </div>
          <button type="button" onClick={handleLogout} className="school-button px-5 py-3 text-sm font-semibold">로그아웃</button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {([
            { key: "applications", label: "신청 관리" },
            { key: "policies", label: "자동승인 정책" },
            { key: "students", label: "학생 명단" },
            { key: "settings", label: "문서/학년도 설정" },
            { key: "gate_roster", label: "정문 출입 명단" },
            { key: "stats", label: "통계" },
            { key: "password", label: "비밀번호 변경" },
          ] as const).map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveSection(section.key)}
              className={`rounded-full border px-4 py-2 text-sm ${
                activeSection === section.key
                  ? "border-school-main bg-school-main text-white"
                  : "border-border-default bg-white text-text-default"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        {activeSection === "stats" ? (
          <section className="mt-6 rounded-xl border border-border-default p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-strong">통계</h2>
              <button type="button" className="rounded-md border border-border-default px-4 py-2 text-sm text-text-default" onClick={() => accessToken && fetchStats(accessToken)}>새로고침</button>
            </div>

            {isLoadingStats ? <p className="mt-4 text-sm text-text-muted">통계 조회 중...</p> : null}
            {statsMessage ? <p className="mt-4 text-sm text-status-rejected">{statsMessage}</p> : null}

            {stats ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <article className="rounded-xl bg-bg-soft p-4">
                    <p className="text-xs text-text-muted">총 학생수</p>
                    <p className="mt-1 text-2xl font-semibold text-text-strong">{stats.summary.total_students}명</p>
                  </article>
                  <article className="rounded-xl bg-bg-soft p-4">
                    <p className="text-xs text-text-muted">총 신청건수</p>
                    <p className="mt-1 text-2xl font-semibold text-text-strong">{stats.summary.total_applications}건</p>
                  </article>
                  <article className="rounded-xl bg-bg-soft p-4">
                    <p className="text-xs text-text-muted">신청한 학생수</p>
                    <p className="mt-1 text-2xl font-semibold text-text-strong">{stats.summary.unique_applicants}명</p>
                  </article>
                </div>

                <div className="mt-5">
                  <article className="rounded-xl border border-border-default p-4">
                    <p className="text-sm font-semibold text-text-strong">학년별 인원</p>
                    <div className="mt-3 space-y-2">
                      {gradeChart.map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-xs text-text-muted">
                            <span>{item.label}</span>
                            <span>{item.value}명</span>
                          </div>
                          <div className="mt-1 h-2 rounded bg-bg-soft">
                            <div className="h-2 rounded bg-school-main" style={{ width: `${(item.value / maxGrade) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <article className="rounded-xl border border-border-default p-4">
                    <p className="text-sm font-semibold text-text-strong">유형별 신청 건수</p>
                    <div className="mt-3 space-y-2">
                      {typeChart.map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-xs text-text-muted">
                            <span>{item.label}</span>
                            <span>{item.value}건</span>
                          </div>
                          <div className="mt-1 h-2 rounded bg-bg-soft">
                            <div className="h-2 rounded bg-status-approved" style={{ width: `${(item.value / maxType) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-xl border border-border-default p-4">
                    <p className="text-sm font-semibold text-text-strong">유형별 신청 학생 수(중복제거)</p>
                    <div className="mt-3 space-y-2 text-sm text-text-default">
                      <p>휴대전화: {stats.applications.unique_applicants_by_type.phone ?? 0}명</p>
                      <p>태블릿: {stats.applications.unique_applicants_by_type.tablet ?? 0}명</p>
                      <p>정문출입: {stats.applications.unique_applicants_by_type.gate ?? 0}명</p>
                    </div>
                  </article>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {activeSection === "password" ? (
          <section className="mt-6 rounded-xl border border-border-default p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-text-strong">비밀번호 변경</h2>
            <p className="mt-2 text-sm text-text-muted">최소 6자 이상 입력해주세요.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <input
                type="password"
                className="school-input h-10 py-1.5 text-sm"
                placeholder="새 비밀번호"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
              <input
                type="password"
                className="school-input h-10 py-1.5 text-sm"
                placeholder="새 비밀번호 확인"
                value={newPasswordConfirm}
                onChange={(event) => setNewPasswordConfirm(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <button
              type="button"
              className="school-button mt-4 px-5 py-3 text-sm font-semibold disabled:opacity-70"
              onClick={changePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? "변경 중..." : "비밀번호 저장"}
            </button>
            {passwordMessage ? <p className="mt-3 text-sm text-status-approved">{passwordMessage}</p> : null}
          </section>
        ) : null}

        {activeSection === "policies" ? (
          <section className="mt-6 rounded-xl border border-border-default p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-text-strong">자동승인 정책</h2>
            <button type="button" className="rounded-md border border-border-default px-4 py-2 text-sm text-text-default" onClick={runAutoApprovalNow}>자동승인 지금 실행</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {(["phone", "tablet", "pass"] as PolicyKey[]).map((key) => (
              <article key={key} className="rounded-lg border border-border-default p-3">
                <p className="text-sm font-semibold text-text-strong">{policyLabel(key)}</p>
                <div className="mt-3 space-y-2">
                  <select className="school-input h-12 py-3 text-sm leading-5" value={policies[key].mode} onChange={(event) => setPolicies((prev) => ({ ...prev, [key]: { ...prev[key], mode: event.target.value as PolicyMode } }))}>
                    <option value="manual">수동 승인</option>
                    <option value="immediate">즉시 승인</option>
                    <option value="delayed">n분 후 자동승인</option>
                  </select>
                  <input type="number" min={0} max={1440} className="school-input h-11 py-2 text-base leading-6" disabled={policies[key].mode !== "delayed"} value={policies[key].delay_minutes} onChange={(event) => setPolicies((prev) => ({ ...prev, [key]: { ...prev[key], delay_minutes: Number(event.target.value || 0) } }))} />
                  <button type="button" onClick={() => savePolicy(key)} disabled={isSavingPolicy[key]} className="school-button w-full py-2 text-sm font-semibold disabled:opacity-70">{isSavingPolicy[key] ? "저장 중..." : "정책 저장"}</button>
                </div>
              </article>
            ))}
          </div>
          {policyMessage ? <p className="mt-3 text-sm text-text-default">{policyMessage}</p> : null}
          </section>
        ) : null}

        {activeSection === "students" ? (
          <section className="mt-6 rounded-xl border border-border-default p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-text-strong">학생 명단 관리</h2>
            <div className="flex gap-2">
              <button type="button" className="rounded-md border border-border-default px-4 py-2 text-sm text-text-default" onClick={downloadCsvTemplate}>CSV 템플릿</button>
              <button type="button" className="rounded-md border border-border-default px-4 py-2 text-sm text-text-default" onClick={clearAllStudents}>전체 삭제</button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <article className="rounded-lg border border-border-default p-3">
              <p className="text-sm font-semibold text-text-strong">개별 추가/수정</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input className="school-input h-10 py-1.5 text-sm" placeholder="학생 아이디" value={newStudent.student_id} onChange={(event) => setNewStudent((prev) => ({ ...prev, student_id: event.target.value }))} />
                <input className="school-input h-10 py-1.5 text-sm" placeholder="이름" value={newStudent.name} onChange={(event) => setNewStudent((prev) => ({ ...prev, name: event.target.value }))} />
                <input className="school-input h-10 py-1.5 text-sm" type="number" min={1} max={6} placeholder="학년" value={newStudent.grade} onChange={(event) => setNewStudent((prev) => ({ ...prev, grade: Number(event.target.value || 1) }))} />
                <input className="school-input h-10 py-1.5 text-sm" type="number" min={1} max={20} placeholder="반" value={newStudent.class_num} onChange={(event) => setNewStudent((prev) => ({ ...prev, class_num: Number(event.target.value || 1) }))} />
              </div>
              <button type="button" onClick={addOrUpdateStudent} className="school-button mt-3 w-full py-2 text-sm font-semibold">학생 저장</button>
            </article>

            <article className="rounded-lg border border-border-default p-3">
              <p className="text-sm font-semibold text-text-strong">CSV 업로드</p>
              <p className="mt-2 text-xs text-text-muted">헤더: student_id,name,grade,class_num (UTF-8/CP949 지원)</p>
              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadCsv(file);
                  event.currentTarget.value = "";
                }}
              />
              <div
                role="button"
                tabIndex={0}
                className={`mt-3 rounded-lg border-2 border-dashed px-4 py-5 text-center transition ${
                  isCsvDragOver
                    ? "border-school-main bg-school-main/5"
                    : "border-border-default bg-bg-soft/40"
                }`}
                onClick={() => csvFileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    csvFileInputRef.current?.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsCsvDragOver(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsCsvDragOver(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsCsvDragOver(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) void uploadCsv(file);
                }}
              >
                <p className="text-sm font-semibold text-text-strong">여기를 클릭해 CSV 선택</p>
                <p className="mt-1 text-xs text-text-muted">또는 이 영역에 파일을 드래그해 놓으세요</p>
              </div>
            </article>
          </div>

          {studentMessage ? <p className="mt-3 text-sm text-text-default">{studentMessage}</p> : null}

          <div className="mt-4 overflow-x-auto rounded-xl border border-border-default">
            <table className="min-w-[780px] w-full text-left text-sm">
              <thead className="bg-bg-soft text-text-strong">
                <tr>
                  <th className="px-4 py-3">학생 아이디</th>
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">학년</th>
                  <th className="px-4 py-3">반</th>
                  <th className="px-4 py-3">관리</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingStudents ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">조회 중...</td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">등록된 학생이 없습니다.</td></tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.id} className="border-t border-border-default">
                      <td className="px-4 py-3">{student.student_id}</td>
                      <td className="px-4 py-3">{student.name}</td>
                      <td className="px-4 py-3">{student.grade}</td>
                      <td className="px-4 py-3">{student.class_num}</td>
                      <td className="px-4 py-3"><button type="button" className="rounded-md border border-border-default px-3 py-1.5 text-sm text-text-default" onClick={() => deleteStudent(student.student_id)}>삭제</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </section>
        ) : null}

        {activeSection === "settings" ? (
          <section className="mt-6 rounded-xl border border-border-default p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-text-strong">문서/학년도 설정</h2>
            <p className="mt-2 text-sm text-text-muted">Streamlit 관리 페이지의 문서 관리/학년도 설정 기능을 동일하게 제공합니다.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article className="rounded-lg border border-border-default p-3">
                <p className="text-sm font-semibold text-text-strong">학년도 설정</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    className="school-input h-10 py-1.5 text-sm"
                    placeholder="학년도 (예: 2026)"
                    value={settings.academic_year}
                    onChange={(event) => setSettings((prev) => ({ ...prev, academic_year: event.target.value }))}
                  />
                  <input
                    className="school-input h-10 py-1.5 text-sm"
                    type="date"
                    value={settings.academic_year_start}
                    onChange={(event) => setSettings((prev) => ({ ...prev, academic_year_start: event.target.value }))}
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="school-button px-4 py-2 text-sm font-semibold" onClick={() => saveSetting("academic_year", settings.academic_year)}>학년도 저장</button>
                  <button type="button" className="rounded-md border border-border-default px-4 py-2 text-sm text-text-default" onClick={() => saveSetting("academic_year_start", settings.academic_year_start)}>시작일 저장</button>
                </div>
              </article>

              <article className="rounded-lg border border-border-default p-3">
                <p className="text-sm font-semibold text-text-strong">교장 직인 관리</p>
                {settings.principal_stamp_path ? (
                  <img src={settings.principal_stamp_path} alt="principal-stamp" className="mt-3 h-20 w-20 rounded-md border border-border-default object-contain bg-white p-1" />
                ) : (
                  <p className="mt-3 text-xs text-text-muted">등록된 직인 이미지가 없습니다.</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    className="block text-sm"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPrincipalStamp(file);
                    }}
                  />
                  <button type="button" className="rounded-md border border-border-default px-4 py-2 text-sm text-text-default" onClick={deletePrincipalStamp}>직인 삭제</button>
                </div>
              </article>
            </div>

            <div className="mt-4 rounded-lg border border-border-default p-3">
              <p className="text-sm font-semibold text-text-strong">구글 연동 주소</p>
              <div className="mt-3 grid gap-2">
                <input
                  className="school-input h-10 py-1.5 text-sm"
                  placeholder="Google Apps Script WebApp URL"
                  value={settings.google_sheet_webapp_url}
                  onChange={(event) => setSettings((prev) => ({ ...prev, google_sheet_webapp_url: event.target.value }))}
                />
                <input
                  className="school-input h-10 py-1.5 text-sm"
                  placeholder="Gate Google Sheet URL"
                  value={settings.gate_sheet_url}
                  onChange={(event) => setSettings((prev) => ({ ...prev, gate_sheet_url: event.target.value }))}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="school-button px-4 py-2 text-sm font-semibold" onClick={() => saveSetting("google_sheet_webapp_url", settings.google_sheet_webapp_url)}>WebApp URL 저장</button>
                <button type="button" className="rounded-md border border-border-default px-4 py-2 text-sm text-text-default" onClick={() => saveSetting("gate_sheet_url", settings.gate_sheet_url)}>시트 URL 저장</button>
              </div>
            </div>

            {settingsMessage ? <p className="mt-3 text-sm text-text-default">{settingsMessage}</p> : null}
          </section>
        ) : null}

        {activeSection === "gate_roster" ? (
          <section className="mt-6 rounded-xl border border-border-default p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-text-strong">정문 출입 명단</h2>
              <div className="flex gap-2">
                {gateSheetUrl ? (
                  <a
                    href={gateSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-border-default px-4 py-2 text-sm text-text-default"
                  >
                    구글시트 바로가기
                  </a>
                ) : null}
                <button type="button" className="school-button px-4 py-2 text-sm font-semibold" onClick={syncGateRosterToGoogleSheet}>구글시트 업로드 (A4:M)</button>
              </div>
            </div>
            <p className="mt-2 text-sm text-text-muted">승인 완료된 정문 출입 신청만 표시합니다.</p>

            <div className="mt-4 overflow-x-auto rounded-xl border border-border-default">
              <table className="min-w-[1300px] w-full text-left text-sm">
                <thead className="bg-bg-soft text-text-strong">
                  <tr>
                    <th className="px-4 py-3">학번</th>
                    <th className="px-4 py-3">이름</th>
                    <th className="px-4 py-3">학년</th>
                    <th className="px-4 py-3">반</th>
                    <th className="px-4 py-3">등교-월</th>
                    <th className="px-4 py-3">등교-화</th>
                    <th className="px-4 py-3">등교-수</th>
                    <th className="px-4 py-3">등교-목</th>
                    <th className="px-4 py-3">등교-금</th>
                    <th className="px-4 py-3">하교-월</th>
                    <th className="px-4 py-3">하교-화</th>
                    <th className="px-4 py-3">하교-수</th>
                    <th className="px-4 py-3">하교-목</th>
                    <th className="px-4 py-3">하교-금</th>
                    <th className="px-4 py-3">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingGateRoster ? (
                    <tr><td colSpan={15} className="px-4 py-8 text-center text-text-muted">로딩 중...</td></tr>
                  ) : gateRoster.length === 0 ? (
                    <tr><td colSpan={15} className="px-4 py-8 text-center text-text-muted">표시할 정문 출입 명단이 없습니다.</td></tr>
                  ) : (
                    gateRoster.map((row) => (
                      <tr key={row.student_id} className="border-t border-border-default">
                        <td className="px-4 py-3">{row.student_id}</td>
                        <td className="px-4 py-3">{row.name}</td>
                        <td className="px-4 py-3">{row.grade ?? "-"}</td>
                        <td className="px-4 py-3">{row.class_num ?? "-"}</td>
                        <td className="px-4 py-3">{row.morning["월"] || ""}</td>
                        <td className="px-4 py-3">{row.morning["화"] || ""}</td>
                        <td className="px-4 py-3">{row.morning["수"] || ""}</td>
                        <td className="px-4 py-3">{row.morning["목"] || ""}</td>
                        <td className="px-4 py-3">{row.morning["금"] || ""}</td>
                        <td className="px-4 py-3">{row.dismissal["월"] || ""}</td>
                        <td className="px-4 py-3">{row.dismissal["화"] || ""}</td>
                        <td className="px-4 py-3">{row.dismissal["수"] || ""}</td>
                        <td className="px-4 py-3">{row.dismissal["목"] || ""}</td>
                        <td className="px-4 py-3">{row.dismissal["금"] || ""}</td>
                        <td className="px-4 py-3 min-w-[220px]">{row.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {gateMessage ? <p className="mt-3 text-sm text-text-default">{gateMessage}</p> : null}
          </section>
        ) : null}

        {activeSection === "applications" ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <article className="rounded-xl bg-status-pending/10 p-4 text-status-pending">대기 {pendingCount}건</article>
              <article className="rounded-xl bg-status-approved/10 p-4 text-status-approved">승인 {approvedCount}건</article>
              <article className="rounded-xl bg-status-rejected/10 p-4 text-status-rejected">반려 {rejectedCount}건</article>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {(["all", "pending", "approved", "rejected"] as FilterType[]).map((value) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-sm ${filter === value ? "border-school-main bg-school-main text-white" : "border-border-default bg-white text-text-default"}`}>
                  {value === "all" ? "전체" : value === "pending" ? "대기" : value === "approved" ? "승인" : "반려"}
                </button>
              ))}
            </div>

            {error ? <p className="mt-4 text-sm text-status-rejected">{error}</p> : null}

            <div className="mt-5 overflow-x-auto rounded-xl border border-border-default">
              <table className="min-w-[1240px] w-full text-left text-sm">
                <thead className="bg-bg-soft text-text-strong">
                  <tr>
                    <th className="px-5 py-3 whitespace-nowrap">ID</th>
                    <th className="px-5 py-3 whitespace-nowrap">학생 아이디</th>
                    <th className="px-5 py-3 whitespace-nowrap">신청 종류</th>
                    <th className="px-5 py-3 whitespace-nowrap">상태</th>
                    <th className="px-5 py-3 whitespace-nowrap">처리</th>
                    <th className="px-5 py-3 whitespace-nowrap">신청일</th>
                    <th className="px-5 py-3 whitespace-nowrap">승인번호</th>
                    <th className="px-5 py-3 whitespace-nowrap">신청사유</th>
                    <th className="px-5 py-3 whitespace-nowrap">반려사유</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-text-muted">로딩 중...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-text-muted">신청서가 없습니다.</td></tr>
                  ) : (
                    items.map((item) => {
                      const rowId = String(item.id);
                      const isRowAction = actionId === rowId;
                      return (
                        <tr key={rowId} className="border-t border-border-default">
                          <td className="px-5 py-3 text-text-strong whitespace-nowrap">{item.id}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{item.student_id}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{item.application_type}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{statusLabel(item.status)}</td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            {item.status === "pending" ? (
                              <div className="flex gap-2">
                                <button type="button" onClick={() => updateStatus(item, "approve")} disabled={isRowAction} className="rounded-md bg-status-approved/15 px-3 py-1.5 text-status-approved disabled:opacity-60">승인</button>
                                <button type="button" onClick={() => openReject(item)} disabled={isRowAction} className="rounded-md bg-status-rejected/15 px-3 py-1.5 text-status-rejected disabled:opacity-60">반려</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => updateStatus(item, "reset")} disabled={isRowAction} className="rounded-md border border-border-default px-3 py-1.5 text-text-default disabled:opacity-60">취소</button>
                            )}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "-"}</td>
                          <td className="px-5 py-3 min-w-[230px]">
                            {item.status === "pending" ? (
                              <input type="text" className="school-input h-9 py-1.5" placeholder={approvalPlaceholder(item.application_type)} value={approvalNumbers[rowId] ?? ""} onChange={(event) => setApprovalNumbers((prev) => ({ ...prev, [rowId]: event.target.value }))} />
                            ) : (
                              item.approval_number ?? "-"
                            )}
                          </td>
                          <td className="px-5 py-3 min-w-[230px] max-w-[300px] truncate" title={item.reason}>{item.reason}</td>
                          <td className="px-5 py-3 min-w-[200px] max-w-[280px] truncate" title={item.rejection_reason ?? ""}>{item.rejection_reason ?? "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="school-card w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-text-strong">반려 사유 입력</h2>
            <p className="mt-2 text-sm text-text-muted">신청서 #{rejectTarget.id} 반려 사유를 입력해주세요.</p>
            <textarea className="school-input mt-4 min-h-28 resize-y" placeholder="반려 사유 입력" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-border-default px-4 py-2 text-sm text-text-default" onClick={() => setRejectTarget(null)}>취소</button>
              <button type="button" className="school-button px-4 py-2 text-sm font-semibold" onClick={confirmReject}>반려 확정</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
