import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Tab, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function MarketMobileTabs() {
  const intl = useIntl();

  const headerData = useMemo(
    () => [
      { id: 'watchlist', title: 'watchlist' },
      { id: 'trending', title: 'trending' },
    ],
    [],
  );

  // Custom title render: star icon for watchlist tab, translated text for trending
  // Suppress TS type mismatch by casting.
  const renderTitle = (item: { id: string }) =>
    item.id === 'watchlist' ? (
      <Icon name="StarOutline" size="$5" />
    ) : (
      intl.formatMessage({ id: ETranslations.market_trending })
    );

  return (
    <XStack px="$5" py="$3">
      <Tab.Header
        data={headerData}
        showHorizontalScrollButton={false}
        itemContainerStyle={{ ml: 0, mr: '$5' }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        titleFromItem={renderTitle as any}
      />
    </XStack>
  );
}
