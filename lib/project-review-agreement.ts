import { editColumnName } from "@/components/project/data-utils";

export type ReviewAgreementUser = {
  id: string;
  name: string;
};

export type ReviewAgreementRow = {
  id: string;
  registrationNumber: string;
  imageId: string | null;
  predictionData: Record<string, string>;
  predictionEdits: Array<{
    userId: string;
    data: Record<string, string>;
  }>;
};

export type ReviewAgreementColumnSummary = {
  column: string;
  comparedSamples: number;
  exactAgreementSamples: number;
  disagreementSamples: number;
  exactAgreementRate: number | null;
  pairwiseAgreementRate: number | null;
  kappa: number | null;
  totalPairs: number;
  matchingPairs: number;
  valueDistribution: Array<{
    value: string;
    count: number;
  }>;
  disagreements: Array<{
    caseId: string;
    registrationNumber: string;
    imageId: string | null;
    values: Array<{
      userId: string;
      userName: string;
      value: string;
    }>;
  }>;
};

export type ReviewEditPerformanceSummary = {
  userId: string;
  userName: string;
  comparedSamples: number;
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  accuracy: number | null;
  f1: number | null;
  sensitivity: number | null;
  auc: number | null;
  prauc: number | null;
};

function normalizeReviewValue(value: string | undefined | null) {
  return value?.trim() ?? "";
}

function numericValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function isPositiveValue(value: string, positiveValue: string) {
  return value.trim().toLowerCase() === positiveValue.trim().toLowerCase();
}

function predictedPositive(value: string, positiveValue: string) {
  const score = numericValue(value);

  if (score !== null) {
    return score >= 0.5;
  }

  return isPositiveValue(value, positiveValue);
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function binaryAuc(points: Array<{ actualPositive: boolean; score: number }>) {
  const positives = points.filter((point) => point.actualPositive).length;
  const negatives = points.length - positives;

  if (positives === 0 || negatives === 0) {
    return null;
  }

  const ranked = [...points]
    .sort((left, right) => left.score - right.score)
    .map((point, index) => ({ ...point, rank: index + 1 }));
  let positiveRankSum = 0;

  for (const point of ranked) {
    if (point.actualPositive) {
      positiveRankSum += point.rank;
    }
  }

  return (
    (positiveRankSum - (positives * (positives + 1)) / 2) /
    (positives * negatives)
  );
}

function binaryPrauc(points: Array<{ actualPositive: boolean; score: number }>) {
  const positives = points.filter((point) => point.actualPositive).length;

  if (positives === 0) {
    return null;
  }

  const sorted = [...points].sort((left, right) => right.score - left.score);
  let truePositives = 0;
  let precisionSum = 0;

  sorted.forEach((point, index) => {
    if (!point.actualPositive) {
      return;
    }

    truePositives += 1;
    precisionSum += truePositives / (index + 1);
  });

  return precisionSum / positives;
}

function valuesForRow({
  row,
  column,
  users,
}: {
  row: ReviewAgreementRow;
  column: string;
  users: ReviewAgreementUser[];
}) {
  const editColumn = editColumnName(column);

  return users.flatMap((user) => {
    const edit = row.predictionEdits.find(
      (predictionEdit) => predictionEdit.userId === user.id
    );
    const value = normalizeReviewValue(edit?.data[editColumn]);

    if (!value) {
      return [];
    }

    return [
      {
        userId: user.id,
        userName: user.name,
        value,
      },
    ];
  });
}

function pairStats(values: Array<{ value: string }>) {
  let totalPairs = 0;
  let matchingPairs = 0;

  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      totalPairs += 1;

      if (values[left].value === values[right].value) {
        matchingPairs += 1;
      }
    }
  }

  return { totalPairs, matchingPairs };
}

function kappaFromRates({
  observedAgreement,
  valueCounts,
  totalValues,
}: {
  observedAgreement: number;
  valueCounts: Map<string, number>;
  totalValues: number;
}) {
  if (totalValues === 0) {
    return null;
  }

  const expectedAgreement = [...valueCounts.values()].reduce((sum, count) => {
    const proportion = count / totalValues;

    return sum + proportion * proportion;
  }, 0);

  if (expectedAgreement >= 1) {
    return observedAgreement === 1 ? 1 : null;
  }

  return (observedAgreement - expectedAgreement) / (1 - expectedAgreement);
}

export function buildReviewAgreementSummaries({
  rows,
  users,
  columns,
}: {
  rows: ReviewAgreementRow[];
  users: ReviewAgreementUser[];
  columns: string[];
}): ReviewAgreementColumnSummary[] {
  return columns.map((column) => {
    let comparedSamples = 0;
    let exactAgreementSamples = 0;
    let totalPairs = 0;
    let matchingPairs = 0;
    let totalValues = 0;
    const valueCounts = new Map<string, number>();
    const disagreements: ReviewAgreementColumnSummary["disagreements"] = [];

    for (const row of rows) {
      const values = valuesForRow({ row, column, users });

      if (values.length < 2) {
        continue;
      }

      comparedSamples += 1;
      totalValues += values.length;

      for (const value of values) {
        valueCounts.set(value.value, (valueCounts.get(value.value) ?? 0) + 1);
      }

      const uniqueValues = new Set(values.map((value) => value.value));
      const rowPairStats = pairStats(values);

      totalPairs += rowPairStats.totalPairs;
      matchingPairs += rowPairStats.matchingPairs;

      if (uniqueValues.size === 1) {
        exactAgreementSamples += 1;
      } else {
        disagreements.push({
          caseId: row.id,
          registrationNumber: row.registrationNumber,
          imageId: row.imageId,
          values,
        });
      }
    }

    const pairwiseAgreementRate =
      totalPairs > 0 ? matchingPairs / totalPairs : null;

    return {
      column,
      comparedSamples,
      exactAgreementSamples,
      disagreementSamples: comparedSamples - exactAgreementSamples,
      exactAgreementRate:
        comparedSamples > 0 ? exactAgreementSamples / comparedSamples : null,
      pairwiseAgreementRate,
      kappa:
        pairwiseAgreementRate === null
          ? null
          : kappaFromRates({
              observedAgreement: pairwiseAgreementRate,
              valueCounts,
              totalValues,
            }),
      totalPairs,
      matchingPairs,
      valueDistribution: [...valueCounts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((left, right) => right.count - left.count),
      disagreements,
    };
  });
}

export function buildEditPerformanceSummaries({
  rows,
  users,
  editColumn,
  targetColumn,
  positiveValue,
}: {
  rows: ReviewAgreementRow[];
  users: ReviewAgreementUser[];
  editColumn: string;
  targetColumn: string;
  positiveValue: string;
}): ReviewEditPerformanceSummary[] {
  const pairedEditColumn = editColumnName(editColumn);

  return users.map((user) => {
    let truePositive = 0;
    let trueNegative = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    const scorePoints: Array<{ actualPositive: boolean; score: number }> = [];

    for (const row of rows) {
      const truth = normalizeReviewValue(row.predictionData[targetColumn]);
      const edit = row.predictionEdits.find(
        (predictionEdit) => predictionEdit.userId === user.id
      );
      const prediction = normalizeReviewValue(edit?.data[pairedEditColumn]);

      if (!truth || !prediction) {
        continue;
      }

      const actualPositive = isPositiveValue(truth, positiveValue);
      const predictionIsPositive = predictedPositive(prediction, positiveValue);
      const score = numericValue(prediction);

      if (score !== null) {
        scorePoints.push({ actualPositive, score });
      }

      if (actualPositive && predictionIsPositive) {
        truePositive += 1;
      } else if (!actualPositive && !predictionIsPositive) {
        trueNegative += 1;
      } else if (!actualPositive && predictionIsPositive) {
        falsePositive += 1;
      } else {
        falseNegative += 1;
      }
    }

    const comparedSamples =
      truePositive + trueNegative + falsePositive + falseNegative;

    return {
      userId: user.id,
      userName: user.name,
      comparedSamples,
      truePositive,
      trueNegative,
      falsePositive,
      falseNegative,
      accuracy: ratio(truePositive + trueNegative, comparedSamples),
      f1: ratio(2 * truePositive, 2 * truePositive + falsePositive + falseNegative),
      sensitivity: ratio(truePositive, truePositive + falseNegative),
      auc: binaryAuc(scorePoints),
      prauc: binaryPrauc(scorePoints),
    };
  });
}

export function formatAgreementRate(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}

export function formatKappa(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(2);
}
