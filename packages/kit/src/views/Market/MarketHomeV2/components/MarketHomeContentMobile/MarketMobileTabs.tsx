import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Tab, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IMarketMobileTabsProps {
  selectedTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function MarketMobileTabs({
  selectedTab = 'trending',
  onTabChange,
}: IMarketMobileTabsProps) {
  const intl = useIntl();
  const initialIndex = selectedTab === 'watchlist' ? 0 : 1;
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

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
      <Icon name="StarOutline" size="$4" />
    ) : (
      intl.formatMessage({ id: ETranslations.market_trending })
    );

  const handleTabChange = (index: number) => {
    setSelectedIndex(index);
    const tabId = headerData[index]?.id;
    if (tabId) {
      onTabChange?.(tabId);
    }
  };

  return (
    <XStack px="$5" py="$3">
      <Tab.Header
        data={headerData}
        showHorizontalScrollButton={false}
        itemContainerStyle={{ ml: 0, mr: '$5' }}
        initialScrollIndex={initialIndex}
        onSelectedPageIndex={handleTabChange}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        titleFromItem={renderTitle as any}
      />
    </XStack>
  );
}
