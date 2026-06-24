"use client";

import { Fragment, useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";

import {
  buildReviewAgreementSummaries,
  formatAgreementRate,
  formatKappa,
  type ReviewAgreementRow,
  type ReviewAgreementUser,
} from "@/lib/project-review-agreement";

export function ResultAgreementPanel({
  rows,
  users,
  columns,
}: {
  rows: ReviewAgreementRow[];
  users: ReviewAgreementUser[];
  columns: string[];
}) {
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const summaries = useMemo(
    () => buildReviewAgreementSummaries({ rows, users, columns }),
    [columns, rows, users]
  );
  const comparedSummaries = summaries.filter(
    (summary) => summary.comparedSamples > 0
  );
  const averagePairwiseAgreement =
    comparedSummaries.length > 0
      ? comparedSummaries.reduce(
          (sum, summary) => sum + (summary.pairwiseAgreementRate ?? 0),
          0
        ) / comparedSummaries.length
      : null;
  const totalDisagreements = summaries.reduce(
    (sum, summary) => sum + summary.disagreementSamples,
    0
  );

  return (
    <section className="rounded-xl border border-white/10 bg-[#171717]/55 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <BarChart3 className="h-4 w-4 text-teal-100" />
            평가값 일치도
          </h3>
          <p className="mt-1 text-xs text-white/42">
            빈 값은 제외하고, 같은 샘플에 2명 이상이 남긴 Edit 값만 비교합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-white/62">
            평균 pairwise {formatAgreementRate(averagePairwiseAgreement)}
          </span>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-white/62">
            불일치 {totalDisagreements}
          </span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="border-b border-white/10 bg-white/[0.04] text-white/48">
            <tr>
              <th className="w-9 px-3 py-2" />
              <th className="px-3 py-2 font-medium">Column</th>
              <th className="px-3 py-2 font-medium">비교 샘플</th>
              <th className="px-3 py-2 font-medium">전체 일치</th>
              <th className="px-3 py-2 font-medium">Pairwise</th>
              <th className="px-3 py-2 font-medium">Kappa</th>
              <th className="px-3 py-2 font-medium">불일치</th>
              <th className="px-3 py-2 font-medium">주요 값</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {summaries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-white/42">
                  선택된 column이 없습니다.
                </td>
              </tr>
            )}
            {summaries.map((summary) => {
              const expanded = expandedColumn === summary.column;
              const topValues = summary.valueDistribution.slice(0, 3);

              return (
                <Fragment key={summary.column}>
                  <tr key={summary.column} className="text-white/68">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedColumn(expanded ? null : summary.column)
                        }
                        disabled={summary.disagreements.length === 0}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/62 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`${summary.column} 불일치 샘플 보기`}
                      >
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>
                    <td className="max-w-56 break-words px-3 py-2 font-medium text-white">
                      {summary.column}
                    </td>
                    <td className="px-3 py-2">{summary.comparedSamples}</td>
                    <td className="px-3 py-2">
                      {formatAgreementRate(summary.exactAgreementRate)}
                    </td>
                    <td className="px-3 py-2">
                      {formatAgreementRate(summary.pairwiseAgreementRate)}
                    </td>
                    <td className="px-3 py-2">{formatKappa(summary.kappa)}</td>
                    <td className="px-3 py-2 text-amber-100/80">
                      {summary.disagreementSamples}
                    </td>
                    <td className="px-3 py-2 text-white/54">
                      {topValues.length > 0
                        ? topValues
                            .map((item) => `${item.value} ${item.count}`)
                            .join(" · ")
                        : "-"}
                    </td>
                  </tr>
                  {expanded && (
                    <tr key={`${summary.column}-details`}>
                      <td colSpan={8} className="bg-black/18 px-3 py-3">
                        <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                          {summary.disagreements.slice(0, 30).map((item) => (
                            <div
                              key={item.caseId}
                              className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-medium text-white">
                                  {item.registrationNumber}
                                </span>
                                <span className="text-white/38">
                                  {item.imageId ?? "image_id 없음"}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.values.map((value) => (
                                  <span
                                    key={`${item.caseId}-${value.userId}`}
                                    className="rounded-md border border-amber-100/15 bg-amber-100/[0.06] px-2 py-1 text-xs text-amber-50/82"
                                  >
                                    {value.userName}: {value.value}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                          {summary.disagreements.length > 30 && (
                            <p className="text-xs text-white/38">
                              추가 불일치 샘플 {summary.disagreements.length - 30}
                              개가 있습니다.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
