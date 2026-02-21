"use client";

import { isAdminUser } from "@/lib/auth/roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function ParentLoginCard() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });

      const payload = (await response.json()) as {
        error?: string;
        user?: {
          email?: string | null;
          app_metadata?: Record<string, unknown> | null;
          user_metadata?: Record<string, unknown> | null;
        };
        session?: { access_token: string; refresh_token: string };
      };

      if (!response.ok || !payload.session) {
        throw new Error(payload.error ?? "로그인에 실패했습니다.");
      }

      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });

      if (sessionError) {
        throw new Error("세션 저장에 실패했습니다.");
      }

      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
      const targetPath = isAdminUser(payload.user, adminEmails) ? "/admin" : "/dashboard";
      router.push(targetPath);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "로그인 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="school-card w-full max-w-md p-7 sm:p-8">
      <header className="mb-6">
        <p className="font-serif text-sm tracking-[0.2em] text-school-sub uppercase">DONGSUNG</p>
        <h2 className="mt-2 text-2xl font-semibold text-text-strong">학부모 로그인</h2>
        <p className="mt-2 text-sm text-text-muted">학생 신청서 확인 및 승인 상태 조회</p>
      </header>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label htmlFor="parent-id" className="block text-sm font-medium text-text-default">
            학생 아이디
          </label>
          <input
            id="parent-id"
            type="text"
            placeholder="학생 아이디 입력"
            className="school-input"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            autoComplete="username"
            required
          />
          <p className="text-xs text-text-muted">예 10101@ds.es.kr</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="parent-password" className="block text-sm font-medium text-text-default">
            비밀번호
          </label>
          <input
            id="parent-password"
            type="password"
            placeholder="비밀번호 입력"
            className="school-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          className="school-button mt-2 w-full py-3 text-sm font-semibold disabled:opacity-70"
          disabled={isSubmitting}
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-status-rejected">{error}</p> : null}
    </section>
  );
}
