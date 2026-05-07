import { memo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

import { PnlCell } from '../components/PnlCell';

interface IPortfolioItemNormalProps {
  item: IMarketAccountPortfolioItem;
  tokenLogoUrl?: string;
  columnWidth: number;
}

function PortfolioItemNormalBase({
  item,
  tokenLogoUrl,
  columnWidth,
}: IPortfolioItemNormalProps) {
  const pnl = item.pnl;
  const isPnlSupported = pnl?.isPnlSupported ?? false;

  return (
    <XStack
      flex={1}
      gap="$6"
      alignItems="center"
      mx="$2"
      px="$3"
      py="$2.5"
      borderRadius="$3"
      cursor="default"
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <XStack gap="$2" alignItems="center" w={100}>
        <Token size="xs" tokenImageUri={tokenLogoUrl} />
        <SizableText size="$bodyMd" color="$text" numberOfLines={1}>
          {item.symbol}
        </SizableText>
      </XStack>

      <PnlCell
        usdValue={pnl?.unrealizedPnlUsd ?? '0'}
        percent={pnl?.unrealizedPnlPercent ?? '0'}
        isSupported={isPnlSupported}
        columnWidth={columnWidth}
      />

      <PnlCell
        usdValue={pnl?.totalPnlUsd ?? '0'}
        percent={pnl?.totalPnlPercent ?? '0'}
        isSupported={isPnlSupported}
        columnWidth={columnWidth}
      />
    </XStack>
  );
}

const PortfolioItemNormal = memo(PortfolioItemNormalBase);

export { PortfolioItemNormal };
