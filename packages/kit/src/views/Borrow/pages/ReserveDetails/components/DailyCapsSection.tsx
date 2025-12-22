import BigNumber from 'bignumber.js';
import { XStack } from '@onekeyhq/components';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import type { IBorrowReserveDetail, IEarnText } from '@onekeyhq/shared/types/staking';

import { DetailsSectionContainer } from './DetailsSectionContainer';

const fallbackText: IEarnText = { text: '-' };
const resetText: IEarnText = { text: '24h' };

const MAGNITUDE_EXPONENTS: Record<string, number> = {
  K: 3,
  M: 6,
  B: 9,
  T: 12,
};

function parseCompactNumber(text?: string): BigNumber | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const match = cleaned.match(/^([\d.]+)\s*([kmbtKMGT]?)$/);
  if (!match) {
    try {
      return new BigNumber(cleaned);
    } catch {
      return undefined;
    }
  }
  const [, value, suffix] = match;
  const exponent = MAGNITUDE_EXPONENTS[suffix.toUpperCase()] ?? 0;
  return new BigNumber(value).multipliedBy(new BigNumber(10).pow(exponent));
}

function stripTrailingZeros(value: string) {
  return value.replace(/\.?0+$/, '');
}

function formatCompactNumber(value?: BigNumber) {
  if (!value) return undefined;
  const thresholds = [
    { exponent: 12, suffix: 'T' },
    { exponent: 9, suffix: 'B' },
    { exponent: 6, suffix: 'M' },
    { exponent: 3, suffix: 'K' },
  ];
  const absValue = value.absoluteValue();
  for (const threshold of thresholds) {
    const limit = new BigNumber(10).pow(threshold.exponent);
    if (absValue.gte(limit)) {
      const formatted = stripTrailingZeros(
        value
          .dividedBy(limit)
          .toFixed(2, BigNumber.ROUND_HALF_UP),
      );
      return `${formatted}${threshold.suffix}`;
    }
  }
  return stripTrailingZeros(
    value.toFixed(2, BigNumber.ROUND_HALF_UP),
  );
}

function parseUsageTitle(title?: string) {
  if (!title) return null;
  const parts = title.split('of').map((part) => part.trim());
  if (parts.length !== 2) return null;
  return {
    usedText: parts[0],
    capText: parts[1],
    usedValue: parseCompactNumber(parts[0]),
    capValue: parseCompactNumber(parts[1]),
  };
}

export function DailyCapsSection({
  details,
}: {
  details?: IBorrowReserveDetail;
}) {
  if (!details) {
    return null;
  }

  const borrowUsage = parseUsageTitle(details.borrow.usage?.title?.text);
  const supplyUsage = parseUsageTitle(details.supply.usage?.title?.text);

  const borrowableValue =
    borrowUsage?.capValue && borrowUsage?.usedValue
      ? BigNumber.maximum(
          borrowUsage.capValue.minus(borrowUsage.usedValue),
          new BigNumber(0),
        )
      : undefined;
  const withdrawableValue =
    supplyUsage?.capValue && supplyUsage?.usedValue
      ? BigNumber.maximum(
          supplyUsage.capValue.minus(supplyUsage.usedValue),
          new BigNumber(0),
        )
      : undefined;

  const borrowableText = formatCompactNumber(borrowableValue);
  const withdrawableText = formatCompactNumber(withdrawableValue);

  const items = [
    {
      key: 'dailyBorrowCap',
      title: 'Daily borrow cap',
      description: borrowUsage?.capText
        ? { text: borrowUsage.capText }
        : fallbackText,
    },
    {
      key: 'borrowableToday',
      title: 'Borrowable today',
      description: borrowableText
        ? { text: borrowableText }
        : fallbackText,
    },
    {
      key: 'borrowCapResetsIn',
      title: 'Daily cap resets in',
      description: resetText,
    },
    {
      key: 'dailyWithdrawCap',
      title: 'Daily withdraw cap',
      description: supplyUsage?.capText
        ? { text: supplyUsage.capText }
        : fallbackText,
    },
    {
      key: 'withdrawableToday',
      title: 'Withdrawable today',
      description: withdrawableText
        ? { text: withdrawableText }
        : fallbackText,
    },
    {
      key: 'withdrawCapResetsIn',
      title: 'Daily cap resets in',
      description: resetText,
    },
  ];

  return (
    <DetailsSectionContainer title="Daily caps">
      <XStack flexWrap="wrap" m="$-5" p="$2">
        {items.map((item) => (
          <GridItem
            key={item.key}
            title={{ text: item.title }}
            description={item.description}
          />
        ))}
      </XStack>
    </DetailsSectionContainer>
  );
}
