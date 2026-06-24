"use client";

import { Fragment, useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";

import {
  buildEditPerformanceSummaries,
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
  availableColumns,
}: {
  rows: ReviewAgreementRow[];
  users: ReviewAgreementUser[];
  columns: string[];
  availableColumns: string[];
}) {
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const [metricConfigByColumn, setMetricConfigByColumn] = useState<
    Record<string, { targetColumn: string; positiveValue: string }>
  >({});
  const summaries = useMemo(
    () => buildReviewAgreementSummaries({ rows, users, columns }),
    [columns, rows, users]
  );
  const targetValuesByColumn = useMemo(() => {
    return Object.fromEntries(
      availableColumns.map((column) => {
        const values = new Map<string, number>();

        for (const row of rows) {
          const value = row.predictionData[column]?.trim();

          if (value) {
            values.set(value, (values.get(value) ?? 0) + 1);
          }
        }

        return [
          column,
          [...values.entries()]
            .map(([value, count]) => ({ value, count }))
            .sort((left, right) => right.count - left.count),
        ];
      })
    );
  }, [availableColumns, rows]);
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

  function configForColumn(column: string) {
    const targetColumn =
      metricConfigByColumn[column]?.targetColumn ??
      (availableColumns.includes(column) ? column : availableColumns[0] ?? "");
    const positiveValue =
      metricConfigByColumn[column]?.positiveValue ??
      targetValuesByColumn[targetColumn]?.[0]?.value ??
      "1";

    return { targetColumn, positiveValue };
  }

  function updateMetricConfig(
    column: string,
    patch: Partial<{ targetColumn: string; positiveValue: string }>
  ) {
    setMetricConfigByColumn((current) => {
      const previous = configForColumn(column);
      const next = { ...previous, ...patch };

      if (patch.targetColumn && patch.targetColumn !== previous.targetColumn) {
        next.positiveValue =
          targetValuesByColumn[patch.targetColumn]?.[0]?.value ?? "1";
      }

      return {
        ...current,
        [column]: next,
      };
    });
  }

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
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/62 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`${summary.column} 세부 지표 보기`}
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
                        <ColumnDetails
                          rows={rows}
                          users={users}
                          summary={summary}
                          availableColumns={availableColumns}
                          targetValuesByColumn={targetValuesByColumn}
                          metricConfig={configForColumn(summary.column)}
                          onMetricConfigChange={(patch) =>
                            updateMetricConfig(summary.column, patch)
                          }
                        />
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

function ColumnDetails({
  rows,
  users,
  summary,
  availableColumns,
  targetValuesByColumn,
  metricConfig,
  onMetricConfigChange,
}: {
  rows: ReviewAgreementRow[];
  users: ReviewAgreementUser[];
  summary: ReturnType<typeof buildReviewAgreementSummaries>[number];
  availableColumns: string[];
  targetValuesByColumn: Record<string, Array<{ value: string; count: number }>>;
  metricConfig: { targetColumn: string; positiveValue: string };
  onMetricConfigChange: (
    patch: Partial<{ targetColumn: string; positiveValue: string }>
  ) => void;
}) {
  const performanceSummaries = buildEditPerformanceSummaries({
    rows,
    users,
    editColumn: summary.column,
    targetColumn: metricConfig.targetColumn,
    positiveValue: metricConfig.positiveValue,
  });
  const targetValues = targetValuesByColumn[metricConfig.targetColumn] ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs font-semibold text-white/76">불일치 샘플</p>
        <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto pr-1">
          {summary.disagreements.length === 0 && (
            <div className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-4 text-xs text-white/42">
              불일치 샘플이 없습니다.
            </div>
          )}
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
              추가 불일치 샘플 {summary.disagreements.length - 30}개가 있습니다.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-white/76">
              기준 column 대비 Edit 성능
            </p>
            <p className="mt-1 text-xs text-white/42">
              선택한 기준 column의 positive 값을 정답으로 보고, 사용자별 Edit{" "}
              {summary.column} 값을 비교합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="grid gap-1 text-xs text-white/48">
              기준 column
              <select
                value={metricConfig.targetColumn}
                onChange={(event) =>
                  onMetricConfigChange({
                    targetColumn: event.currentTarget.value,
                  })
                }
                className="h-8 min-w-40 rounded-md border border-white/10 bg-[#111] px-2 text-xs text-white outline-none focus:border-teal-200/50"
              >
                {availableColumns.map((column) => (
                  <option
                    key={column}
                    value={column}
                    className="bg-[#202020] text-white"
                  >
                    {column}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-white/48">
              Positive 값
              <select
                value={metricConfig.positiveValue}
                onChange={(event) =>
                  onMetricConfigChange({
                    positiveValue: event.currentTarget.value,
                  })
                }
                className="h-8 min-w-32 rounded-md border border-white/10 bg-[#111] px-2 text-xs text-white outline-none focus:border-teal-200/50"
              >
                {(targetValues.length > 0
                  ? targetValues
                  : [{ value: metricConfig.positiveValue, count: 0 }]
                ).map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                    className="bg-[#202020] text-white"
                  >
                    {item.value}
                    {item.count ? ` (${item.count})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.04] text-white/48">
              <tr>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">N</th>
                <th className="px-3 py-2 font-medium">Accuracy</th>
                <th className="px-3 py-2 font-medium">F1</th>
                <th className="px-3 py-2 font-medium">Sensitivity</th>
                <th className="px-3 py-2 font-medium">AUC</th>
                <th className="px-3 py-2 font-medium">PRAUC</th>
                <th className="px-3 py-2 font-medium">TP/TN/FP/FN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {performanceSummaries.map((item) => (
                <tr key={item.userId} className="text-white/68">
                  <td className="px-3 py-2 font-medium text-white">
                    {item.userName}
                  </td>
                  <td className="px-3 py-2">{item.comparedSamples}</td>
                  <td className="px-3 py-2">
                    {formatAgreementRate(item.accuracy)}
                  </td>
                  <td className="px-3 py-2">{formatAgreementRate(item.f1)}</td>
                  <td className="px-3 py-2">
                    {formatAgreementRate(item.sensitivity)}
                  </td>
                  <td className="px-3 py-2">{formatMetric(item.auc)}</td>
                  <td className="px-3 py-2">{formatMetric(item.prauc)}</td>
                  <td className="px-3 py-2 text-white/52">
                    {item.truePositive}/{item.trueNegative}/{item.falsePositive}/
                    {item.falseNegative}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-white/38">
          AUC/PRAUC는 Edit 값이 숫자 score일 때 계산됩니다. label 값만 있으면
          Accuracy, F1, Sensitivity를 확인하세요.
        </p>
      </div>
    </div>
  );
}

function formatMetric(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(3);
}
