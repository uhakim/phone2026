"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ApplicationType = "phone" | "tablet" | "gate";
type StatusType = "pending" | "approved" | "rejected" | string;
type TabType = "phone" | "tablet" | "gate" | "history" | "password";

type ApplicationItem = {
  id: number | string;
  student_id: string;
  application_type: ApplicationType;
  reason: string;
  extra_info?: string | null;
  status: StatusType;
  approval_mode?: string | null;
  auto_approve_at?: string | null;
  approval_number?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  approved_source?: string | null;
  rejection_reason?: string | null;
};

type ConsentDocument = {
  id: number;
  title: string;
  content: string;
  version: number;
};

const WEEKDAYS = ["월", "화", "수", "목", "금"] as const;
const DISMISSAL_OPTIONS = [
  { code: "1", label: "1하교", time: "14:00" },
  { code: "2", label: "2하교", time: "14:50" },
  { code: "3", label: "3하교", time: "15:40" },
];

function appTypeLabel(type: ApplicationType) {
  if (type === "phone") return "휴대전화";
  if (type === "tablet") return "태블릿";
  return "정문 출입";
}

function statusLabel(status: StatusType) {
  if (status === "pending") return "승인 대기";
  if (status === "approved") return "승인 완료";
  if (status === "rejected") return "반려";
  return status;
}

function statusColor(status: StatusType) {
  if (status === "approved") return "text-status-approved";
  if (status === "rejected") return "text-status-rejected";
  return "text-status-pending";
}

function formatGateExtraInfo(extraInfo?: string | null) {
  if (!extraInfo) return "-";
  try {
    const parsed = JSON.parse(extraInfo) as {
      morningDays?: string[];
      dismissalByDay?: Record<string, string>;
      morning_days?: string[];
      dismissal_by_day?: Record<string, string>;
    };
    const morning = (parsed.morningDays ?? parsed.morning_days ?? []).join(", ");
    const dismissal = Object.entries(parsed.dismissalByDay ?? parsed.dismissal_by_day ?? {})
      .map(([day, code]) => {
        const option = DISMISSAL_OPTIONS.find((opt) => opt.code === code);
        return `${day}${option?.label ?? code}`;
      })
      .join(", ");

    if (!morning && !dismissal) return "-";
    return `등교(${morning || "없음"}) / 하교(${dismissal || "없음"})`;
  } catch {
    return extraInfo;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [isChecking, setIsChecking] = useState(true);
  const [accessToken, setAccessToken] = useState("");
  const [studentId, setStudentId] = useState("");

  const [activeTab, setActiveTab] = useState<TabType>("phone");
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [consentLoading, setConsentLoading] = useState(true);
  const [consentRequired, setConsentRequired] = useState(false);
  const [consentDocument, setConsentDocument] = useState<ConsentDocument | null>(null);
  const [isAgreeingConsent, setIsAgreeingConsent] = useState(false);

  const [phoneReason, setPhoneReason] = useState("");
  const [tabletReason, setTabletReason] = useState("");
  const [gateReason, setGateReason] = useState("");
  const [morningDays, setMorningDays] = useState<string[]>([]);
  const [dismissalByDay, setDismissalByDay] = useState<Record<string, string>>({});

  const fetchApplications = useCallback(async (token: string) => {
    setIsLoadingHistory(true);
    setError("");
    try {
      const response = await fetch("/api/parent/applications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as { error?: string; items?: ApplicationItem[] };
      if (!response.ok) {
        throw new Error(payload.error ?? "\uB3D9\uC758 \uCC98\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
      }
      setApplications(payload.items ?? []);
    } catch (fetchError) {
      const msg = fetchError instanceof Error ? fetchError.message : "신청 내역 조회 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const fetchConsentStatus = useCallback(async (token: string) => {
    setConsentLoading(true);
    try {
      const response = await fetch("/api/parent/consent/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as {
        error?: string;
        required?: boolean;
        agreed?: boolean;
        document?: ConsentDocument | null;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "동의 상태 조회에 실패했습니다.");
      }
      const shouldRequire = Boolean(payload.required) && !Boolean(payload.agreed);
      setConsentRequired(shouldRequire);
      setConsentDocument(payload.document ?? null);
    } catch (consentError) {
      const msg = consentError instanceof Error ? consentError.message : "동의 상태 조회 중 오류가 발생했습니다.";
      setError(msg);
      setConsentRequired(false);
      setConsentDocument(null);
    } finally {
      setConsentLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      if (!supabase) {
        router.replace("/");
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;

      if (sessionError || !data.session?.user?.email) {
        router.replace("/");
        return;
      }

      setAccessToken(data.session.access_token);
      setStudentId(data.session.user.email);
      setIsChecking(false);
    }

    void checkSession();

    const authState = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.email) {
        router.replace("/");
        return;
      }
      setAccessToken(session.access_token);
      setStudentId(session.user.email);
      setIsChecking(false);
    });

    return () => {
      mounted = false;
      authState?.data.subscription.unsubscribe();
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!accessToken) return;
    void fetchApplications(accessToken);
    void fetchConsentStatus(accessToken);
  }, [accessToken, fetchApplications, fetchConsentStatus]);

  async function submitApplication(applicationType: ApplicationType, reason: string, extraInfo?: string | null) {
    if (!accessToken) return;
    if (consentRequired) {
      setError("\uAC1C\uC778\uC815\uBCF4 \uC218\uC9D1\u00B7\uC774\uC6A9 \uB3D9\uC758 \uD6C4 \uC2E0\uCCAD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      return;
    }
    if (!reason.trim()) {
      setError("신청 사유를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/parent/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          applicationType,
          reason: reason.trim(),
          extraInfo: extraInfo ?? null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "신청에 실패했습니다.");
      }
      setMessage("신청이 완료되었습니다.");
      if (applicationType === "phone") setPhoneReason("");
      if (applicationType === "tablet") setTabletReason("");
      if (applicationType === "gate") {
        setGateReason("");
        setMorningDays([]);
        setDismissalByDay({});
      }
      setActiveTab("history");
      await fetchApplications(accessToken);
    } catch (submitError) {
      const msg = submitError instanceof Error ? submitError.message : "신청 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function cancelApplication(applicationId: string | number) {
    if (!accessToken) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/parent/applications/${applicationId}/cancel`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "신청 취소에 실패했습니다.");
      }
      setMessage("신청이 취소되었습니다.");
      await fetchApplications(accessToken);
    } catch (cancelError) {
      const msg = cancelError instanceof Error ? cancelError.message : "신청 취소 중 오류가 발생했습니다.";
      setError(msg);
    }
  }

  async function downloadPdf(applicationId: string | number, applicationType: ApplicationType) {
    if (!accessToken) return;
    setError("");
    try {
      const response = await fetch(`/api/parent/applications/${applicationId}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "PDF 생성에 실패했습니다.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `permit-${applicationType}-${studentId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (pdfError) {
      const msg = pdfError instanceof Error ? pdfError.message : "PDF 다운로드 중 오류가 발생했습니다.";
      setError(msg);
    }
  }

  function toggleMorning(day: string) {
    setMorningDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function updateDismissal(day: string, value: string) {
    setDismissalByDay((prev) => {
      const next = { ...prev };
      if (!value || value === "none") {
        delete next[day];
        return next;
      }
      next[day] = value;
      return next;
    });
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
      if (updateError) {
        throw updateError;
      }
      setPasswordMessage("비밀번호가 변경되었습니다.");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (changeError) {
      const msg = changeError instanceof Error ? changeError.message : "비밀번호 변경 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function agreeConsent() {
    if (!accessToken) return;
    setError("");
    setIsAgreeingConsent(true);
    try {
      const response = await fetch("/api/parent/consent/agree", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "동의 처리에 실패했습니다.");
      }
      setConsentRequired(false);
      setMessage("개인정보 이용 동의가 완료되었습니다.");
    } catch (agreeError) {
      const msg = agreeError instanceof Error ? agreeError.message : "\uB3D9\uC758 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";
      setError(msg);
    } finally {
      setIsAgreeingConsent(false);
    }
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <section className="school-card w-full max-w-lg p-8 text-center">
          <p className="text-sm text-text-muted">로그인 상태를 확인하고 있습니다...</p>
        </section>

    </main>
  );
  }

  const tabClass = (tab: TabType) =>
    `rounded-full border px-3 py-1.5 text-sm ${activeTab === tab ? "border-school-main bg-school-main text-white" : "border-border-default bg-white text-text-default"}`;

  return (
    <main className="flex min-h-screen justify-center p-4 sm:p-6">
      <section className="school-card w-full max-w-[1100px] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.2em] text-school-sub uppercase">DONGSUNG</p>
            <h1 className="mt-2 text-3xl font-semibold text-text-strong">학부모 대시보드</h1>
            <p className="mt-2 text-sm text-text-default">신청서를 작성하고 승인 상태를 확인할 수 있습니다.</p>
            <p className="mt-2 text-sm text-text-muted">로그인 계정: {studentId}</p>
          </div>
          <button type="button" onClick={handleLogout} className="school-button px-5 py-3 text-sm font-semibold">
            로그아웃
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className={tabClass("phone")} onClick={() => setActiveTab("phone")}>
            휴대전화 신청
          </button>
          <button type="button" className={tabClass("tablet")} onClick={() => setActiveTab("tablet")}>
            태블릿 신청
          </button>
          <button type="button" className={tabClass("gate")} onClick={() => setActiveTab("gate")}>
            정문 출입 신청
          </button>
          <button type="button" className={tabClass("history")} onClick={() => setActiveTab("history")}>
            내 신청 내역
          </button>
          <button type="button" className={tabClass("password")} onClick={() => setActiveTab("password")}>
            {"\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD"}
          </button>
        </div>

        {message ? <p className="mt-4 text-sm text-status-approved">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-status-rejected">{error}</p> : null}

        {activeTab === "phone" ? (
          <section className="mt-5 rounded-xl border border-border-default p-5">
            <h2 className="text-xl font-semibold text-text-strong">휴대전화 소지 신청</h2>
            <textarea
              className="school-input mt-4 min-h-28 resize-y"
              placeholder="휴대전화를 소지해야 하는 신청 사유를 입력하세요."
              value={phoneReason}
              onChange={(event) => setPhoneReason(event.target.value)}
            />
            <button
              type="button"
              className="school-button mt-4 px-5 py-3 text-sm font-semibold disabled:opacity-70"
              disabled={isSubmitting || consentRequired}
              onClick={() => submitApplication("phone", phoneReason)}
            >
              {isSubmitting ? "처리 중..." : "신청하기"}
            </button>
          </section>
        ) : null}

        {activeTab === "tablet" ? (
          <section className="mt-5 rounded-xl border border-border-default p-5">
            <h2 className="text-xl font-semibold text-text-strong">태블릿 소지 신청</h2>
            <textarea
              className="school-input mt-4 min-h-28 resize-y"
              placeholder="태블릿을 소지해야 하는 신청 사유를 입력하세요."
              value={tabletReason}
              onChange={(event) => setTabletReason(event.target.value)}
            />
            <button
              type="button"
              className="school-button mt-4 px-5 py-3 text-sm font-semibold disabled:opacity-70"
              disabled={isSubmitting || consentRequired}
              onClick={() => submitApplication("tablet", tabletReason)}
            >
              {isSubmitting ? "처리 중..." : "신청하기"}
            </button>
          </section>
        ) : null}

        {activeTab === "gate" ? (
          <section className="mt-5 rounded-xl border border-border-default p-5">
            <h2 className="text-xl font-semibold text-text-strong">정문 출입 신청</h2>
            <input
              className="school-input mt-4"
              placeholder="정문 출입 사유를 입력하세요."
              value={gateReason}
              onChange={(event) => setGateReason(event.target.value)}
            />

            <div className="mt-5">
              <p className="text-sm font-medium text-text-default">등교 요일</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleMorning(day)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${morningDays.includes(day) ? "border-school-main bg-school-main text-white" : "border-border-default bg-white text-text-default"}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-medium text-text-default">하교 요일/시간</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {WEEKDAYS.map((day) => (
                  <label key={day} className="rounded-md border border-border-default p-3 text-sm">
                    <p className="mb-2 font-medium text-text-default">{day}</p>
                    <select
                      className="school-input h-12 py-3 text-xs leading-4"
                      value={dismissalByDay[day] ?? "none"}
                      onChange={(event) => updateDismissal(day, event.target.value)}
                    >
                      <option value="none">선택 안함</option>
                      {DISMISSAL_OPTIONS.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.label} ({option.time})
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="school-button mt-5 px-5 py-3 text-sm font-semibold disabled:opacity-70"
              disabled={isSubmitting || consentRequired}
              onClick={() => {
                if (morningDays.length === 0 && Object.keys(dismissalByDay).length === 0) {
                  setError("등교 또는 하교 시간 중 최소 1개 이상 선택해주세요.");
                  return;
                }
                void submitApplication(
                  "gate",
                  gateReason,
                  JSON.stringify({
                    morningDays,
                    dismissalByDay,
                  }),
                );
              }}
            >
              {isSubmitting ? "처리 중..." : "신청하기"}
            </button>
          </section>
        ) : null}

        {activeTab === "history" ? (
          <section className="mt-5 rounded-xl border border-border-default p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-text-strong">내 신청 내역</h2>
              <button
                type="button"
                className="rounded-md border border-border-default px-4 py-2 text-sm text-text-default"
                onClick={() => fetchApplications(accessToken)}
              >
                새로고침
              </button>
            </div>

            {isLoadingHistory ? <p className="mt-4 text-sm text-text-muted">조회 중...</p> : null}
            {!isLoadingHistory && applications.length === 0 ? <p className="mt-4 text-sm text-text-muted">신청 내역이 없습니다.</p> : null}

            <div className="mt-4 space-y-3">
              {applications.map((item) => (
                <article key={String(item.id)} className="rounded-lg border border-border-default p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-text-strong">{appTypeLabel(item.application_type)}</p>
                      <p className={`text-sm ${statusColor(item.status)}`}>{statusLabel(item.status)}</p>
                    </div>
                    <p className="text-xs text-text-muted">{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "-"}</p>
                  </div>

                  <p className="mt-3 text-sm text-text-default">신청사유: {item.reason}</p>
                  {item.application_type === "gate" ? (
                    <p className="mt-2 text-sm text-text-muted">출입 정보: {formatGateExtraInfo(item.extra_info)}</p>
                  ) : null}

                  {item.rejection_reason ? <p className="mt-2 text-sm text-status-rejected">반려사유: {item.rejection_reason}</p> : null}
                  {item.approval_number ? <p className="mt-2 text-sm text-text-muted">승인번호: {item.approval_number}</p> : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.status === "approved" ? (
                      <button
                        type="button"
                        className="rounded-md bg-status-approved/15 px-3 py-2 text-sm text-status-approved"
                        onClick={() => downloadPdf(item.id, item.application_type)}
                      >
                        PDF 다운로드
                      </button>
                    ) : null}

                    {item.status === "pending" || item.status === "approved" ? (
                      <button
                        type="button"
                        className="rounded-md border border-border-default px-3 py-2 text-sm text-text-default"
                        onClick={() => cancelApplication(item.id)}
                      >
                        신청 취소
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "password" ? (
          <section className="mt-5 rounded-xl border border-border-default p-5">
            <h2 className="text-xl font-semibold text-text-strong">{"\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD"}</h2>
            <p className="mt-2 text-sm text-text-muted">{"\uCD5C\uC18C 6\uC790 \uC774\uC0C1 \uC785\uB825\uD574\uC8FC\uC138\uC694."}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <input
                type="password"
                className="school-input"
                placeholder={"\uC0C8 \uBE44\uBC00\uBC88\uD638"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
              <input
                type="password"
                className="school-input"
                placeholder={"\uC0C8 \uBE44\uBC00\uBC88\uD638 \uD655\uC778"}
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
              {isChangingPassword ? "\uBCC0\uACBD \uC911..." : "\uBE44\uBC00\uBC88\uD638 \uC800\uC7A5"}
            </button>
            {passwordMessage ? <p className="mt-3 text-sm text-status-approved">{passwordMessage}</p> : null}
          </section>
        ) : null}
      </section>

      {consentRequired ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <section className="school-card w-full max-w-2xl p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-text-strong">
              {"\uAC1C\uC778\uC815\uBCF4 \uC218\uC9D1\u00B7\uC774\uC6A9 \uB3D9\uC758(\uD544\uC218)"}
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              {"\uC11C\uBE44\uC2A4 \uC2E0\uCCAD \uC804 \uD544\uC218 \uB3D9\uC758\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4."}
            </p>

            <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-lg border border-border-default bg-bg-soft p-4 text-sm leading-7 text-text-default whitespace-pre-wrap">
              {consentDocument?.content ?? "\uB3D9\uC758 \uBB38\uC11C\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4."}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-text-muted">
                {"\uBB38\uC11C \uBC84\uC804"}: {consentDocument?.version ?? "-"}
              </p>
              <button
                type="button"
                className="school-button px-5 py-2.5 text-sm font-semibold disabled:opacity-70"
                onClick={agreeConsent}
                disabled={isAgreeingConsent || consentLoading || !consentDocument}
              >
                {isAgreeingConsent ? "\uB3D9\uC758 \uCC98\uB9AC \uC911..." : "\uB3D9\uC758\uD558\uACE0 \uACC4\uC18D"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
