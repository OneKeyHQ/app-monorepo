import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Icon,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type ISubsidyPanel = 'tron' | 'multichain' | 'history' | 'help';

export const desktopSubsidySidebarWidth = '40%';

function PanelLink({
  label,
  trailingLabel,
  selected,
  testID,
  onPress,
}: {
  label: string;
  trailingLabel?: string;
  selected: boolean;
  testID: string;
  onPress: () => void;
}) {
  const textColor = selected ? '$text' : '$textSubdued';
  return (
    <Button
      testID={testID}
      childrenAsText={false}
      aria-pressed={selected}
      size="small"
      justifyContent="space-between"
      mx="$-3"
      pl="$3"
      pr="$2.5"
      minHeight="$9"
      borderRadius="$3"
      bg="$transparent"
      borderWidth={0}
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgHover' }}
      onPress={onPress}
    >
      <SizableText size="$headingSm" color={textColor}>
        {label}
      </SizableText>
      <XStack alignItems="center" gap="$2">
        {trailingLabel ? (
          <SizableText size="$bodyMdMedium" color={textColor}>
            {trailingLabel}
          </SizableText>
        ) : null}
        <ListItem.DrillIn color={selected ? '$iconActive' : '$iconSubdued'} />
      </XStack>
    </Button>
  );
}

export function DesktopSubsidyLayout({
  detailTitle,
  totalSaved,
  recordCount,
  benefitCards,
  activePanel,
  onSelectPanel,
  children,
}: {
  detailTitle?: string;
  totalSaved: number;
  recordCount: number;
  benefitCards: ReactNode;
  activePanel: ISubsidyPanel;
  onSelectPanel: (panel: ISubsidyPanel) => void;
  children: ReactNode;
}) {
  const intl = useIntl();
  const faqLabel = intl.formatMessage({ id: ETranslations.global_faqs });
  return (
    <XStack
      flex={1}
      minHeight={0}
      px="$6"
      pt="$5"
      pb="$8"
      gap="$6"
      testID="subsidy-desktop-layout"
    >
      <YStack
        width={desktopSubsidySidebarWidth}
        flexShrink={0}
        mt="$-3"
        bg="$bg"
        borderRadius="$5"
        overflow="hidden"
      >
        <ScrollView flex={1}>
          <YStack p="$5">
            <XStack alignItems="center" gap="$2">
              <YStack flex={1} minWidth={0} gap="$1">
                <SizableText size="$bodySm" color="$textSubdued">
                  累计获得补贴（演示）
                </SizableText>
                <SizableText size="$heading4xl" fontVariant={['tabular-nums']}>
                  ${totalSaved.toFixed(2)}
                </SizableText>
              </YStack>
              <Icon name="CoinsIllus" width={80} height={80} flexShrink={0} />
            </XStack>
            <Divider mt="$3" mb="$5" />
            <YStack gap="$2">
              <SizableText size="$headingSm" color="$textSubdued">
                我的补贴
              </SizableText>
              {benefitCards}
            </YStack>
            <Divider my="$3" />
            <YStack gap="$1.5">
              <PanelLink
                label="补贴记录"
                trailingLabel={String(recordCount)}
                selected={activePanel === 'history'}
                testID="subsidy-view-all-records"
                onPress={() => onSelectPanel('history')}
              />
              <PanelLink
                label={faqLabel}
                selected={activePanel === 'help'}
                testID="subsidy-desktop-help"
                onPress={() => onSelectPanel('help')}
              />
            </YStack>
          </YStack>
        </ScrollView>
      </YStack>
      <YStack
        flex={1}
        minHeight={0}
        minWidth={0}
        gap="$5"
        testID="subsidy-desktop-detail"
      >
        {detailTitle ? (
          <SizableText size="$headingMd">{detailTitle}</SizableText>
        ) : null}
        {activePanel === 'history' || activePanel === 'tron' ? (
          children
        ) : (
          <ScrollView
            key={activePanel}
            flex={1}
            ml={activePanel === 'help' ? '$-3' : undefined}
          >
            {children}
          </ScrollView>
        )}
      </YStack>
    </XStack>
  );
}
