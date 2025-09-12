import { memo, useMemo } from 'react';

import { Stack, useMedia } from '@onekeyhq/components';
import { useFocusedTab } from '@onekeyhq/components/src/composite/Tabs/useFocusedTab';

import {
  HoldersHeaderNormal,
  HoldersHeaderSmall,
} from '../components/Holders/layout';
import {
  TransactionsHeaderNormal,
  TransactionsHeaderSmall,
} from '../components/TransactionsHistory';

function BaseStickyHeader({ firstTabName }: { firstTabName: string }) {
  const { gtLg, gtXl } = useMedia();
  const focusedTab = useFocusedTab();

  const transactionsHeader = useMemo(() => {
    return gtXl ? <TransactionsHeaderNormal /> : <TransactionsHeaderSmall />;
  }, [gtXl]);

  const holdersHeader = useMemo(() => {
    return gtLg ? <HoldersHeaderNormal /> : <HoldersHeaderSmall />;
  }, [gtLg]);

  return (
    <Stack pointerEvents="none" h={40}>
      {focusedTab === firstTabName ? transactionsHeader : holdersHeader}
    </Stack>
  );
}
export const StickyHeader = memo(BaseStickyHeader);
