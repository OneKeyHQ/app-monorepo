import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';

function buildRewardUnitSuffixPattern(rewardUnit?: string) {
  const normalizedRewardUnit = rewardUnit?.trim();
  const escapedRewardUnit = normalizedRewardUnit
    ? normalizedRewardUnit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : '';

  return new RegExp(
    `\\s*(?:APR|APY${escapedRewardUnit ? `|${escapedRewardUnit}` : ''})\\s*$`,
    'i',
  );
}

export function stripRewardUnitSuffix(text: string, rewardUnit?: string) {
  return text.replace(buildRewardUnitSuffixPattern(rewardUnit), '');
}

export function withRewardUnit(text: string, rewardUnit: string) {
  const normalizedRewardUnit = rewardUnit.trim();

  if (
    !normalizedRewardUnit ||
    buildRewardUnitSuffixPattern(normalizedRewardUnit).test(text)
  ) {
    return text;
  }

  return `${text} ${normalizedRewardUnit}`;
}

export function formatRewardText({
  text,
  rewardUnit,
  hideSuffix,
}: {
  text: string;
  rewardUnit: string;
  hideSuffix: boolean;
}) {
  return hideSuffix
    ? stripRewardUnitSuffix(text, rewardUnit).trim()
    : withRewardUnit(text, rewardUnit);
}

export function buildAprText(apr: string, unit: string) {
  return withRewardUnit(apr, unit);
}

export function buildAprRangeText({
  minAprInfo,
  maxAprInfo,
  rewardUnit,
}: {
  minAprInfo?: IEarnAvailableAsset['minAprInfo'];
  maxAprInfo?: IEarnAvailableAsset['maxAprInfo'];
  rewardUnit?: IEarnAvailableAsset['rewardUnit'];
}) {
  const minText = minAprInfo?.normal?.text?.trim();
  const maxText = maxAprInfo?.normal?.text?.trim();

  if (!minText || !maxText || !rewardUnit) {
    return undefined;
  }

  return `${stripRewardUnitSuffix(minText, rewardUnit).trim()} - ${stripRewardUnitSuffix(maxText, rewardUnit).trim()} ${rewardUnit}`.trim();
}
