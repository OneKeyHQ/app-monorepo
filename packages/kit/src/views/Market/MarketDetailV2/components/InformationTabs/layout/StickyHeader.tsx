import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Stack, useMedia } from '@onekeyhq/components';
import { useFocusedTab } from '@onekeyhq/components/src/composite/Tabs/useFocusedTab';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IMarketMobileDetailKind,
  resolveMobileInformationColumnHeader,
} from '../../../utils/marketMobileDetailKind';
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
  detailKind = 'trending',
}: {
  detailKind?: IMarketMobileDetailKind;
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

  // Determine which header to show based on focused tab name
  const transactionsTabName = intl.formatMessage({
    id: ETranslations.dexmarket_details_transactions,
  });
  const holdersTabName = intl.formatMessage({
    id: ETranslations.dexmarket_holders,
  });
  const portfolioTabName = intl.formatMessage({
    id: ETranslations.dexmarket_details_myposition,
  });
  const liquidityPoolsTabName = intl.formatMessage({
    id: ETranslations.global_liquidity,
  });

  const columnHeader = resolveMobileInformationColumnHeader({
    detailKind,
    focusedTab: focusedTab ?? '',
    transactionsTabName,
    holdersTabName,
    portfolioTabName,
    liquidityTabName: liquidityPoolsTabName,
  });
  // The liquidity table scrolls horizontally (960px min width), so its
  // column header must live inside that ScrollView. Stock and top-coin
  // overviews are not tables, so they have no column header either.
  if (columnHeader === 'none') {
    return null;
  }
  let currentHeader = transactionsHeader;
  if (columnHeader === 'portfolio') {
    currentHeader = portfolioHeader;
  } else if (columnHeader === 'holders') {
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
