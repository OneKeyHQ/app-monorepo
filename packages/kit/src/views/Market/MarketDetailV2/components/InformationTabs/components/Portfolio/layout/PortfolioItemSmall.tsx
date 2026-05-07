import { memo } from 'react';

import { XStack } from '@onekeyhq/components';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

import { PnlCell } from '../components/PnlCell';

interface IPortfolioItemSmallProps {
  item: IMarketAccountPortfolioItem;
}

function PortfolioItemSmallBase({ item }: IPortfolioItemSmallProps) {
  const pnl = item.pnl;
  const isPnlSupported = pnl?.isPnlSupported ?? false;

  return (
    <XStack mx="$2" px="$3" py="$2.5" borderRadius="$3" alignItems="center">
      <PnlCell
        usdValue={pnl?.unrealizedPnlUsd ?? '0'}
        percent={pnl?.unrealizedPnlPercent ?? '0'}
        isSupported={isPnlSupported}
        flex={1}
      />

      <PnlCell
        usdValue={pnl?.totalPnlUsd ?? '0'}
        percent={pnl?.totalPnlPercent ?? '0'}
        isSupported={isPnlSupported}
        columnWidth={110}
      />
    </XStack>
  );
}

const PortfolioItemSmall = memo(PortfolioItemSmallBase);

export { PortfolioItemSmall };
