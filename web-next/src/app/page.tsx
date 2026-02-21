import { ParentLoginCard } from "@/components/parent-login-card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-5 sm:p-10">
      <div className="school-shell flex w-full max-w-5xl flex-col gap-6 rounded-[24px] p-6 md:flex-row md:p-10">
        <section className="school-card flex w-full flex-col justify-between gap-8 p-7 sm:p-8 md:w-[56%]">
          <div>
            <p className="text-xs tracking-[0.22em] text-school-sub uppercase">DONGSUNG ELEMENTARY</p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-text-strong sm:text-4xl">
              출입/휴대전화 허가
              <br />
              통합 신청 시스템
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-text-default">
              학부모님이 신청서를 안전하게 제출하고 승인 상태를 확인할 수 있는 동성초등학교 전용 서비스입니다.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs font-medium sm:text-sm">
            <div className="rounded-xl bg-status-approved/10 px-3 py-3 text-status-approved">승인 완료</div>
            <div className="rounded-xl bg-status-pending/10 px-3 py-3 text-status-pending">검토 중</div>
            <div className="rounded-xl bg-status-info/10 px-3 py-3 text-status-info">문서 발급</div>
          </div>
        </section>

        <div className="flex w-full items-center justify-center md:w-[44%]">
          <ParentLoginCard />
        </div>
      </div>
    </main>
  );
}

