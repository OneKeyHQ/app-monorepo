import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DetailTabsPager } from '../../pages/EarnProtocolDetails/mobile/MobileDetailTabs';
import {
  resolveActiveTabKey,
  resolveDefaultTabKey,
  resolveVisibleTabKeys,
} from '../../pages/EarnProtocolDetails/mobile/mobileDetailTabs.utils';
import { POOLS_COPY } from '../poolsCopy';

import type { IMobileDetailTabKey } from '../../pages/EarnProtocolDetails/mobile/mobileDetailTabs.utils';

type IPoolDetailTabKey = IMobileDetailTabKey | 'topPositions';

type IPoolDetailTabsProps = {
  /** None until the user holds a position here, and then no tab either */
  portfolioContent?: ReactNode;
  infoContent: ReactNode;
  /** Range pools only: in a share pool every LP holds the same range */
  topPositionsContent?: ReactNode;
  /** None while the pool's detail loads */
  protocolContent?: ReactNode;
};

/**
 * The asset page's tab rules, with Top positions after Info: Portfolio
 * first and open by default once the user holds a position here.
 */
function usePoolDetailTabs({
  portfolioContent,
  infoContent,
  topPositionsContent,
  protocolContent,
}: IPoolDetailTabsProps) {
  const intl = useIntl();
  const hasPortfolio = Boolean(portfolioContent);
  const hasTopPositions = Boolean(topPositionsContent);
  const hasProtocol = Boolean(protocolContent);
  const visibleKeys = useMemo(() => {
    const keys: IPoolDetailTabKey[] = resolveVisibleTabKeys({
      hasPortfolio,
      hasProtocol,
    });
    if (hasTopPositions) {
      keys.splice(keys.indexOf('info') + 1, 0, 'topPositions');
    }
    return keys;
  }, [hasPortfolio, hasProtocol, hasTopPositions]);
  const labels = useMemo<Record<IPoolDetailTabKey, string>>(
    () => ({
      portfolio: intl.formatMessage({ id: ETranslations.global_portfolio }),
      info: intl.formatMessage({ id: ETranslations.global_info }),
      topPositions: POOLS_COPY.topPositions,
      protocol: intl.formatMessage({ id: ETranslations.global_protocol }),
    }),
    [intl],
  );
  const defaultKey: IPoolDetailTabKey = resolveDefaultTabKey({ hasPortfolio });
  const contents: Partial<Record<IPoolDetailTabKey, ReactNode>> = {
    portfolio: portfolioContent,
    info: infoContent,
    topPositions: topPositionsContent,
    protocol: protocolContent,
  };
  return { visibleKeys, defaultKey, labels, contents };
}

/** Wide screens: a plain tab bar, and only the open tab mounted */
function PoolDetailTabBar({
  visibleKeys,
  defaultKey,
  labels,
  contents,
}: ReturnType<typeof usePoolDetailTabs>) {
  const [selectedKey, setSelectedKey] = useState<IPoolDetailTabKey>();
  const activeKey = resolveActiveTabKey({
    selectedKey,
    visibleKeys,
    defaultKey,
  });

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
                {labels[key]}
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
 * A pool page's Portfolio, Info, Top positions and Protocol, split as an
 * Earn asset page splits its tabs. Phones get that page's swipeable tabs.
 */
export function PoolDetailTabs(props: IPoolDetailTabsProps) {
  const { gtMd } = useMedia();
  const tabs = usePoolDetailTabs(props);
  if (gtMd) {
    return <PoolDetailTabBar {...tabs} />;
  }
  return <DetailTabsPager {...tabs} />;
}
