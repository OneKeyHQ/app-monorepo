import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';
import type { IKytRiskFactor } from '@onekeyhq/shared/types/kyt';

export function getAddressRiskCheckPendingMessageIds({
  isFailed,
  isInternetReachable,
}: {
  isFailed: boolean;
  isInternetReachable?: boolean | null;
}) {
  if (isFailed && isInternetReachable === false) {
    return {
      title: ETranslations.tray_offline_title,
      description: ETranslations.feedback_you_are_offline,
    };
  }
  return isFailed
    ? {
        title: ETranslations.address_risk_check_level_failed__title,
        description: ETranslations.address_risk_check_level_failed__desc,
      }
    : {
        title: ETranslations.address_risk_check_level_checking__title,
        description: ETranslations.address_risk_check_loading__desc,
      };
}

// Exposures below this share (in percent) are usually dust, spam, or address
// poisoning transfers the owner did not initiate; they are folded by default.
const MINOR_EXPOSURE_PERCENT = 0.1;
// Exposures under this share stay listed but are de-emphasized, so a small
// share does not read as alarming as a large one with the same label.
const LOW_SHARE_EXPOSURE_PERCENT = 1;
const MIN_VISIBLE_EXPOSURES = 3;
const MAX_VISIBLE_EXPOSURES = 5;

// MistTrack score bands (inclusive upper bounds). The meter draws them as four
// equal-width segments so each label fits on narrow mobile screens.
export const RISK_SCORE_BANDS: {
  level: EKytRiskLevel;
  min: number;
  max: number;
}[] = [
  { level: EKytRiskLevel.Low, min: 0, max: 30 },
  { level: EKytRiskLevel.Moderate, min: 30, max: 70 },
  { level: EKytRiskLevel.High, min: 70, max: 90 },
  { level: EKytRiskLevel.Severe, min: 90, max: 100 },
];

export type IAddressRiskSummaryVariant =
  | 'clean'
  | 'low'
  | 'moderate'
  | 'high'
  | 'severe'
  | 'unknown';

export function getAddressRiskSummaryVariant({
  level,
  factorCount,
}: {
  level: EKytRiskLevel;
  factorCount: number;
}): IAddressRiskSummaryVariant {
  switch (level) {
    case EKytRiskLevel.None:
      return 'clean';
    case EKytRiskLevel.Low:
      return factorCount > 0 ? 'low' : 'clean';
    case EKytRiskLevel.Moderate:
      return 'moderate';
    case EKytRiskLevel.High:
      return 'high';
    case EKytRiskLevel.Severe:
      return 'severe';
    default:
      return 'unknown';
  }
}

// Largest share first, then largest amount.
function compareRiskFactors(a: IKytRiskFactor, b: IKytRiskFactor) {
  return (
    (b.percent ?? -1) - (a.percent ?? -1) ||
    (b.amountUsd ?? -1) - (a.amountUsd ?? -1)
  );
}

function sortRiskFactors(factors: IKytRiskFactor[]): IKytRiskFactor[] {
  return factors.toSorted(compareRiskFactors);
}

function isMinorRiskFactor(factor: IKytRiskFactor) {
  return (
    factor.percent !== undefined && factor.percent < MINOR_EXPOSURE_PERCENT
  );
}

export function isLowShareRiskFactor(factor: IKytRiskFactor) {
  return (
    factor.percent !== undefined && factor.percent < LOW_SHARE_EXPOSURE_PERCENT
  );
}

export function getRiskFactorDisplay(factors: IKytRiskFactor[]) {
  const sorted = sortRiskFactors(factors);
  const significantCount = sorted.filter(
    (factor) => !isMinorRiskFactor(factor),
  ).length;
  const visibleCount = Math.min(
    sorted.length,
    Math.max(
      Math.min(significantCount, MAX_VISIBLE_EXPOSURES),
      MIN_VISIBLE_EXPOSURES,
    ),
  );
  const hidden = sorted.slice(visibleCount);
  return {
    sorted,
    visibleCount,
    hiddenCount: hidden.length,
    hiddenAllMinor: hidden.length > 0 && hidden.every(isMinorRiskFactor),
  };
}

// A provider tags an address itself (a hacker, mixer pool, gambling site…) by
// returning only direct exposures with a 100% share and no volume. Showing
// those as exposure stats says nothing; the page shows the tag instead.
export function isRiskTaggedAddress(factors: IKytRiskFactor[]) {
  return (
    factors.length > 0 &&
    factors.every(
      (factor) =>
        factor.exposureType === 'direct' &&
        factor.percent !== undefined &&
        factor.percent >= 100 &&
        !factor.amountUsd,
    )
  );
}

export function getRiskExposureStats(factors: IKytRiskFactor[]) {
  return {
    total: factors.length,
    direct: factors.filter((factor) => factor.exposureType === 'direct').length,
    // Same comparator as the breakdown list, so the top item matches its
    // first row.
    top: factors.reduce<IKytRiskFactor | undefined>(
      (best, factor) =>
        !best || compareRiskFactors(factor, best) < 0 ? factor : best,
      undefined,
    ),
  };
}

export function formatRiskPercent(percent: number | undefined) {
  if (percent === undefined || !Number.isFinite(percent)) {
    return '-';
  }
  // Listed exposures are never truly zero; the provider rounds tiny shares
  // down, so anything below 0.01% reads as "<0.01%".
  if (percent < 0.01) {
    return '<0.01%';
  }
  if (percent >= 100) {
    return '100%';
  }
  return numberFormat(String(percent), { formatter: 'priceChange' });
}

// Position of the score on the meter (0-100), mapped piecewise so every band
// takes 25% of the width regardless of its numeric range.
export function getRiskScoreMeterPosition(score: number) {
  const clamped = Math.min(100, Math.max(0, score));
  // The last band ends at 100, so a clamped score always finds a band.
  const bandIndex = RISK_SCORE_BANDS.findIndex((band) => clamped <= band.max);
  const band = RISK_SCORE_BANDS[bandIndex];
  const ratio = (clamped - band.min) / (band.max - band.min);
  return {
    bandIndex,
    positionPercent: ((bandIndex + ratio) * 100) / RISK_SCORE_BANDS.length,
  };
}
