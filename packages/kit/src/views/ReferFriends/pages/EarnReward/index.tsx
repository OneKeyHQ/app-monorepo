import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Animated, Easing, Keyboard } from 'react-native';

import {
  Alert,
  AnimatePresence,
  Divider,
  Empty,
  Icon,
  Image,
  NumberSizeableText,
  Page,
  SectionList,
  SizableText,
  Stack,
  Tab,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type ISectionListItem = {
  title?: string;
  data: number[];
};

function ItemSeparatorComponent() {
  return <Stack h="$2.5" />;
}

export default function EarnReward() {
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

  const [, setIsShowAlert] = useState(true);
  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;

  const hideAlert = useCallback(() => {
    setIsShowAlert(false);
  }, []);
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.referral_earn_reward })}
      />
      <Page.Body>
        <YStack>
          <Alert
            closable
            description={intl.formatMessage({
              id: ETranslations.referral_earn_reward_tips,
            })}
            type="info"
            mx="$5"
            mb="$2.5"
            onClose={hideAlert}
          />
          <YStack p="$5" pt={0}>
            <SizableText size="$bodyLg">
              {intl.formatMessage({
                id: ETranslations.referral_reward_undistributed,
              })}
            </SizableText>
            <NumberSizeableText
              size="$heading5xl"
              formatter="balance"
              formatterOptions={{ currency: currencySymbol }}
            >
              20.45
            </NumberSizeableText>
            <SizableText mt="$1">
              <NumberSizeableText
                size="$bodyMdMedium"
                formatter="balance"
                formatterOptions={{ currency: currencySymbol }}
                mr="$1"
              >
                245
              </NumberSizeableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.referral_total_reward,
                })}
              </SizableText>
            </SizableText>
          </YStack>
          <YStack>
            <Divider />
            <Empty
              icon="GiftOutline"
              title={intl.formatMessage({
                id: ETranslations.referral_referred_empty,
              })}
              description={intl.formatMessage({
                id: ETranslations.referral_referred_empty_desc,
              })}
            />
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}
