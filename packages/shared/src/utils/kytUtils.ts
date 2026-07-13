import { EKytRiskLevel, EKytStatus } from '../../types/kyt';

import type { IKytHistoryResult } from '../../types/kyt';

const LEVEL_SEVERITY: Record<EKytRiskLevel, number> = {
  [EKytRiskLevel.Checking]: -1,
  [EKytRiskLevel.Failed]: -1,
  [EKytRiskLevel.None]: 0,
  [EKytRiskLevel.Low]: 1,
  [EKytRiskLevel.Moderate]: 2,
  [EKytRiskLevel.High]: 3,
  [EKytRiskLevel.Severe]: 4,
};

// Per-transfer display state. Status takes priority — a transfer's level is only
// trusted once its check has succeeded.
export function resolveKytItemLevel(
  status: EKytStatus,
  level: EKytRiskLevel,
): EKytRiskLevel {
  if (status === EKytStatus.Pending || status === EKytStatus.Checking) {
    return EKytRiskLevel.Checking;
  }
  if (status === EKytStatus.Failed) {
    return EKytRiskLevel.Failed;
  }
  return level;
}

// Tx-level display state across all checked transfers. A finished (success)
// result wins and shows the highest risk among succeeded transfers; otherwise
// status takes priority, so an in-progress check shows Checking even when the
// server already reported a preliminary highestLevel.
export function resolveKytDisplayLevel(
  kyt: IKytHistoryResult | undefined,
): EKytRiskLevel | undefined {
  const list = kyt?.list;
  if (!list?.length) {
    return undefined;
  }
  const successLevels = list
    .filter((item) => item.status === EKytStatus.Success)
    .map((item) => item.level);
  if (successLevels.length) {
    return successLevels.reduce((max, level) =>
      LEVEL_SEVERITY[level] > LEVEL_SEVERITY[max] ? level : max,
    );
  }
  if (
    list.some(
      (item) =>
        item.status === EKytStatus.Pending ||
        item.status === EKytStatus.Checking,
    )
  ) {
    return EKytRiskLevel.Checking;
  }
  return EKytRiskLevel.Failed;
}
