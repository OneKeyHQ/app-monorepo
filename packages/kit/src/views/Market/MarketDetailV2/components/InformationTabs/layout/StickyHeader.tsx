import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Stack, useMedia } from '@onekeyhq/components';
import { useFocusedTab } from '@onekeyhq/components/src/composite/Tabs/useFocusedTab';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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

function BaseStickyHeader({ firstTabName }: { firstTabName: string }) {
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
  const portfolioTabName = intl.formatMessage({
    id: ETranslations.dexmarket_details_myposition,
  });
  const liquidityPoolsTabName = intl.formatMessage({
    id: ETranslations.global_liquidity,
  });

  let currentHeader = transactionsHeader;
  if (focusedTab === portfolioTabName) {
    currentHeader = portfolioHeader;
  } else if (focusedTab === liquidityPoolsTabName) {
    // The liquidity table scrolls horizontally (960px min width), so its
    // column header must live inside that ScrollView to stay aligned with the
    // rows — it renders in the tab content with a matching 44px zone instead.
    return null;
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
