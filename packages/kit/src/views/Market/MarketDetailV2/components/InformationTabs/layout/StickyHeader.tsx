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

  let currentHeader = transactionsHeader;
  if (focusedTab === portfolioTabName) {
    currentHeader = portfolioHeader;
  } else if (focusedTab !== firstTabName) {
    currentHeader = holdersHeader;
  }

  return (
    <Stack pointerEvents="none" h={40}>
      {currentHeader}
    </Stack>
  );
}
export const StickyHeader = memo(BaseStickyHeader);
