import type { CaseRow } from "@/components/project/types";

export function ClinicalDataPanel({ caseRow }: { caseRow: CaseRow | null }) {
  const entries = Object.entries(caseRow?.clinicalData ?? {}).filter(
    ([, value]) => value
  );

  return (
    <section className="rounded-2xl border border-white/12 bg-white/[0.06] p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">선택된 임상데이터</h2>
          <p className="mt-2 text-sm text-white/54">
            모델예측 결과에서 선택한 행의 임상정보입니다.
          </p>
        </div>
        {caseRow?.registrationNumber && (
          <span className="w-fit rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-sm text-white/58">
            {caseRow.registrationNumber}
          </span>
        )}
      </div>

      {entries.length > 0 ? (
        <div className="mt-5 max-h-64 overflow-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#202020] text-white/50">
              <tr>
                {entries.map(([key]) => (
                  <th key={key} className="min-w-48 px-4 py-3 font-medium">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="align-top text-white/76">
                {entries.map(([key, value]) => (
                  <td key={key} className="max-w-72 px-4 py-4">
                    <span className="line-clamp-4 break-words">{value}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-white/14 bg-[#171717]/35 p-8 text-center text-sm text-white/45">
          업로드된 임상데이터에서 등록번호 {caseRow?.registrationNumber ?? "-"}를
          찾지 못했습니다.
        </div>
      )}
    </section>
  );
}
