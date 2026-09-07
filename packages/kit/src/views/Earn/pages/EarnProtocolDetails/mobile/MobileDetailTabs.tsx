import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  resolveActiveTabKey,
  resolveDefaultTabKey,
  resolveVisibleTabKeys,
} from './mobileDetailTabs.utils';

import type { IMobileDetailTabKey } from './mobileDetailTabs.utils';

const TAB_LABEL_IDS: Record<IMobileDetailTabKey, ETranslations> = {
  portfolio: ETranslations.global_portfolio,
  info: ETranslations.global_info,
  protocol: ETranslations.global_protocol,
};

function TabBarItem({
  label,
  focused,
  onPress,
}: {
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  return (
    <YStack
      h={40}
      ai="center"
      jc="center"
      position="relative"
      cursor="pointer"
      userSelect="none"
      onPress={onPress}
    >
      <SizableText
        size="$bodyLgMedium"
        color={focused ? '$text' : '$textSubdued'}
        numberOfLines={1}
      >
        {label}
      </SizableText>
      {focused ? (
        <YStack
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          h="$0.5"
          bg="$text"
          borderRadius={1}
        />
      ) : null}
    </YStack>
  );
}

export function MobileDetailTabs({
  hasPortfolio,
  portfolioContent,
  infoContent,
  protocolContent,
}: {
  hasPortfolio: boolean;
  portfolioContent?: React.ReactNode;
  infoContent: React.ReactNode;
  protocolContent: React.ReactNode;
}) {
  const intl = useIntl();
  const [selectedKey, setSelectedKey] = useState<
    IMobileDetailTabKey | undefined
  >(undefined);

  // The portfolio tab only exists once the account response says there is a
  // position, so visibility is data-driven and can change under a mounted page.
  const showPortfolio = hasPortfolio && Boolean(portfolioContent);

  const visibleKeys = useMemo(
    () => resolveVisibleTabKeys({ hasPortfolio: showPortfolio }),
    [showPortfolio],
  );

  const activeKey = useMemo(
    () =>
      resolveActiveTabKey({
        selectedKey,
        visibleKeys,
        defaultKey: resolveDefaultTabKey({ hasPortfolio: showPortfolio }),
      }),
    [selectedKey, visibleKeys, showPortfolio],
  );

  const handleChange = useCallback((key: IMobileDetailTabKey) => {
    setSelectedKey(key);
  }, []);

  const content = useMemo(() => {
    switch (activeKey) {
      case 'portfolio':
        return portfolioContent ?? null;
      case 'protocol':
        return protocolContent;
      case 'info':
      default:
        return infoContent;
    }
  }, [activeKey, portfolioContent, infoContent, protocolContent]);

  return (
    <YStack gap="$6">
      <XStack
        gap="$5"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        {visibleKeys.map((key) => (
          <TabBarItem
            key={key}
            label={intl.formatMessage({ id: TAB_LABEL_IDS[key] })}
            focused={activeKey === key}
            onPress={() => handleChange(key)}
          />
        ))}
      </XStack>
      {content}
    </YStack>
  );
}
