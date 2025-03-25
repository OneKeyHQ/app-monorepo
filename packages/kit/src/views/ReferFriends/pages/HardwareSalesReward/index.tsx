import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Animated, Easing, Keyboard } from 'react-native';

import {
  AnimatePresence,
  Empty,
  Icon,
  Image,
  Page,
  SectionList,
  SizableText,
  Stack,
  Tab,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type ISectionListItem = {
  title?: string;
  data: number[];
};

function ItemSeparatorComponent() {
  return <Stack h="$2.5" />;
}

export default function HardwareSalesReward() {
  const sections = [{ title: 'Today', data: [1, 2] }];
  const renderSectionHeader = useCallback(
    (item: { section: ISectionListItem }) => {
      if (item.section.title) {
        return <SectionList.SectionHeader title={item.section.title} />;
      }
    },
    [],
  );
  const intl = useIntl();
  const renderItem = useCallback(
    ({ item, section }: { item: number; section: ISectionListItem }) => (
      <YStack px="$5">
        <XStack jc="space-between">
          <SizableText size="$bodyLgMedium">
            {intl.formatMessage({
              id: ETranslations.referral_reward_received_address_notset,
            })}
          </SizableText>
          <SizableText size="$bodyLgMedium" color="$textCritical">
            -$10.5
          </SizableText>
        </XStack>
        <SizableText color="$textSubdued" size="$bodyMd">
          21:46 OneKey Pro*2 + Keytag*1
        </SizableText>
      </YStack>
    ),
    [intl],
  );
  return (
    <Page scrollEnabled>
      <Page.Header title="Hardware sales reward" />
      <Page.Body>
        <SectionList
          ListHeaderComponent={
            <YStack px="$5">
              <SizableText size="$bodyLg">
                {intl.formatMessage({
                  id: ETranslations.referral_referred_total,
                })}
              </SizableText>
              <SizableText size="$heading5xl">245</SizableText>
              <XStack jc="space-between" h={38} ai="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_order_info,
                  })}
                </SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.earn_rewards,
                  })}
                </SizableText>
              </XStack>
            </YStack>
          }
          sections={sections}
          renderSectionHeader={renderSectionHeader}
          estimatedItemSize={44}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparatorComponent}
        />
      </Page.Body>
    </Page>
  );
}
