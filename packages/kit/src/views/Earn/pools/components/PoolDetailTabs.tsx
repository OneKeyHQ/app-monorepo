import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MobileDetailTabs } from '../../pages/EarnProtocolDetails/mobile/MobileDetailTabs';
import {
  resolveActiveTabKey,
  resolveDefaultTabKey,
  resolveVisibleTabKeys,
} from '../../pages/EarnProtocolDetails/mobile/mobileDetailTabs.utils';

import type { IMobileDetailTabKey } from '../../pages/EarnProtocolDetails/mobile/mobileDetailTabs.utils';

const TAB_LABEL_IDS: Record<IMobileDetailTabKey, ETranslations> = {
  portfolio: ETranslations.global_portfolio,
  info: ETranslations.global_info,
  protocol: ETranslations.global_protocol,
};

type IPoolDetailTabsProps = {
  /** None until the user holds a position here, and then no tab either */
  portfolioContent?: ReactNode;
  infoContent: ReactNode;
  /** None while the pool's detail loads */
  protocolContent?: ReactNode;
};

/**
 * Wide screens: the same tabs and rules with a plain tab bar, and only the
 * open tab mounted.
 */
function PoolDetailTabBar({
  portfolioContent,
  infoContent,
  protocolContent,
}: IPoolDetailTabsProps) {
  const intl = useIntl();
  const [selectedKey, setSelectedKey] = useState<IMobileDetailTabKey>();
  const hasPortfolio = Boolean(portfolioContent);
  const visibleKeys = useMemo(
    () =>
      resolveVisibleTabKeys({
        hasPortfolio,
        hasProtocol: Boolean(protocolContent),
      }),
    [hasPortfolio, protocolContent],
  );
  const activeKey = resolveActiveTabKey({
    selectedKey,
    visibleKeys,
    defaultKey: resolveDefaultTabKey({ hasPortfolio }),
  });
  const contents: Record<IMobileDetailTabKey, ReactNode> = {
    portfolio: portfolioContent,
    info: infoContent,
    protocol: protocolContent,
  };

  return (
    <YStack gap="$6">
      <XStack
        gap="$5"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        {visibleKeys.map((key) => {
          const focused = key === activeKey;
          return (
            <YStack
              key={key}
              testID={`earn-pool-detail-tab-${key}`}
              h={40}
              ai="center"
              jc="center"
              borderBottomWidth={2}
              borderBottomColor={focused ? '$text' : '$transparent'}
              cursor="pointer"
              userSelect="none"
              onPress={() => setSelectedKey(key)}
            >
              <SizableText
                size="$bodyLgMedium"
                color={focused ? '$text' : '$textSubdued'}
                hoverStyle={{ color: '$text' }}
                numberOfLines={1}
              >
                {intl.formatMessage({ id: TAB_LABEL_IDS[key] })}
              </SizableText>
            </YStack>
          );
        })}
      </XStack>
      {contents[activeKey]}
    </YStack>
  );
}

/**
 * A pool page's Portfolio, Info and Protocol, split as an Earn asset page
 * splits them: Portfolio first and open by default once the user holds a
 * position here. Phones get that page's swipeable tabs.
 */
export function PoolDetailTabs(props: IPoolDetailTabsProps) {
  const { gtMd } = useMedia();
  if (gtMd) {
    return <PoolDetailTabBar {...props} />;
  }
  return (
    <MobileDetailTabs
      hasPortfolio={Boolean(props.portfolioContent)}
      portfolioContent={props.portfolioContent}
      infoContent={props.infoContent}
      protocolContent={props.protocolContent}
    />
  );
}
