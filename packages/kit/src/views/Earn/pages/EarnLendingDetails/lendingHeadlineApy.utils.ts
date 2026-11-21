import type {
  IBorrowApy,
  IBorrowApyDetailSection,
} from '@onekeyhq/shared/types/staking';

import type { IHeadlineApyParts } from '../EarnProtocolDetails/mobile/yieldSegments.utils';

// A rate the market writes as text ("+0.77%"), or its figure
function rateOf(value: IBorrowApy | undefined): number | undefined {
  const text =
    value?.normal?.text ?? value?.highlight?.text ?? value?.apy ?? '';
  const parsed = Number.parseFloat(text.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sumOf(section: IBorrowApyDetailSection | undefined) {
  return (section?.items ?? []).reduce(
    (sum, item) => sum + (rateOf(item.value) ?? 0),
    0,
  );
}

// OneKey's own bonus in the campaign orange, a protocol's incentives in the
// blue an Earn page gives its rewards; a campaign wins the color, as there
const PLATFORM_BONUS_COLOR = '$orange10';
const INCENTIVES_COLOR = '$textInfo';

/**
 * A lending market's supply rate as the Earn detail page's headline splits
 * a vault's (demo 10-29): the market's own rate in green, then what is added
 * to it, OneKey's bonus and the protocol's incentives. Only from a
 * breakdown whose parts add up to the rate shown; otherwise undefined and
 * the headline stays one figure
 */
export function buildLendingHeadlineApyParts(
  apyDetail: IBorrowApy | undefined,
): IHeadlineApyParts | undefined {
  const detail = apyDetail?.button?.data?.apyDetail;
  if (!detail?.normal?.items.length) {
    return undefined;
  }
  const total = Number.parseFloat(apyDetail?.apy ?? '');
  const base = sumOf(detail.normal);
  const platform = sumOf(detail.myPlatformBonusShare ?? detail.platformBonus);
  const incentives = sumOf(detail.supplyBonus);
  const bonus = Math.max(platform, 0) + Math.max(incentives, 0);
  // Collateral bonuses and the like belong to a loan, not to this rate. The
  // parts come rounded to the cent, so a few hundredths may part them
  if (!Number.isFinite(total) || Math.abs(base + bonus - total) > 0.02) {
    return undefined;
  }
  return {
    base: `${base.toFixed(2)}%`,
    ...(bonus > 0
      ? {
          bonus: `+${bonus.toFixed(2)}%`,
          bonusColor: platform > 0 ? PLATFORM_BONUS_COLOR : INCENTIVES_COLOR,
        }
      : {}),
    unit: 'APY',
  };
}
