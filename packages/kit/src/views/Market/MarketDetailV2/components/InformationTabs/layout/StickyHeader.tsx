import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Stack, useMedia } from '@onekeyhq/components';
import { useFocusedTab } from '@onekeyhq/components/src/composite/Tabs/useFocusedTab';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TokenLiquidityPoolsTableHeader } from '../../TokenLiquidityPools';
import {
  HoldersHeaderNormal,
  HoldersHeaderSmall,
} from '../components/Holders/layout';
import {
  PortfolioHeaderNormal,
  PortfolioHeaderSmall,
} from '../components/Portfolio/layout';
import {
  TransactionsHeaderNormal,
  TransactionsHeaderSmall,
} from '../components/TransactionsHistory';

function BaseStickyHeader({
  firstTabName,
  variant = 'desktop',
}: {
  firstTabName: string;
  variant?: 'desktop' | 'mobile';
}) {
  const intl = useIntl();
  const { gtLg, gtXl } = useMedia();
  const focusedTab = useFocusedTab();

  const transactionsHeader = useMemo(() => {
    return gtXl ? <TransactionsHeaderNormal /> : <TransactionsHeaderSmall />;
  }, [gtXl]);

  const portfolioHeader = useMemo(() => {
    return gtLg ? <PortfolioHeaderNormal /> : <PortfolioHeaderSmall />;
  }, [gtLg]);

  const holdersHeader = useMemo(() => {
    return gtLg ? <HoldersHeaderNormal /> : <HoldersHeaderSmall />;
  }, [gtLg]);

  const liquidityPoolsHeader = useMemo(
    () => <TokenLiquidityPoolsTableHeader variant={variant} />,
    [variant],
  );

  // Determine which header to show based on focused tab name
  const portfolioTabName = intl.formatMessage({
    id: ETranslations.dexmarket_details_myposition,
  });
  const liquidityPoolsTabName = intl.formatMessage({
    id: ETranslations.global_liquidity,
  });

  let currentHeader: ReactNode = transactionsHeader;
  if (focusedTab === portfolioTabName) {
    currentHeader = portfolioHeader;
  } else if (focusedTab === liquidityPoolsTabName) {
    currentHeader = liquidityPoolsHeader;
  } else if (focusedTab !== firstTabName) {
    currentHeader = holdersHeader;
  }

  return (
    <Stack
      pointerEvents="box-none"
      h="$11"
      justifyContent="center"
      overflow="hidden"
    >
      {currentHeader}
    </Stack>
  );
}
export const StickyHeader = memo(BaseStickyHeader);
