import { useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPerpSimplePortfolioTab } from '@onekeyhq/shared/src/routes/perp';

export function SimplePortfolioTabs({
  positionCount,
  orderCount,
  testIDPrefix,
  initialTab,
  children,
}: {
  positionCount: number;
  orderCount: number;
  testIDPrefix: string;
  initialTab?: IPerpSimplePortfolioTab;
  children: (tab: IPerpSimplePortfolioTab) => ReactNode;
}) {
  const intl = useIntl();
  const [selectedTab, setSelectedTab] = useState<
    IPerpSimplePortfolioTab | undefined
  >(initialTab);
  const counts = { positions: positionCount, orders: orderCount };
  const tabs = (['positions', 'orders'] as const).filter(
    (tab) => counts[tab] > 0,
  );
  const activeTab =
    selectedTab && tabs.includes(selectedTab) ? selectedTab : tabs[0];
  if (!activeTab) return null;
  return (
    <YStack gap="$3">
      <XStack
        gap="$5"
        alignItems="center"
        accessibilityRole="tablist"
        flexWrap="wrap"
      >
        {tabs.map((tab) => (
          <XStack
            key={tab}
            testID={`${testIDPrefix}-${tab}-tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            alignItems="center"
            gap="$2"
            minHeight={44}
            cursor="pointer"
            onPress={() => setSelectedTab(tab)}
          >
            <SizableText
              size="$headingLg"
              color={activeTab === tab ? '$text' : '$textSubdued'}
            >
              {intl.formatMessage({
                id:
                  tab === 'positions'
                    ? ETranslations.perp_position_title
                    : ETranslations.perp_open_orders_title,
              })}
            </SizableText>
            <SizableText
              size="$bodyMd"
              color={activeTab === tab ? '$text' : '$textSubdued'}
            >
              {counts[tab]}
            </SizableText>
          </XStack>
        ))}
      </XStack>
      {tabs.map((tab) => (
        <YStack
          key={tab}
          gap="$3"
          display={activeTab === tab ? 'flex' : 'none'}
        >
          {children(tab)}
        </YStack>
      ))}
    </YStack>
  );
}
