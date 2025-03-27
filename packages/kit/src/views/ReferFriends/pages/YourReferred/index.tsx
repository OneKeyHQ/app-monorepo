import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Page, SizableText, Tab, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function EmptyData() {
  const intl = useIntl();
  return (
    <Empty
      icon="PeopleOutline"
      title={intl.formatMessage({
        id: ETranslations.referral_referred_empty,
      })}
      description={intl.formatMessage({
        id: ETranslations.referral_reward_empty_desc,
      })}
    />
  );
}

function HardwareSales() {
  return (
    <YStack>
      <YStack px="$5" pt="$5">
        <SizableText size="$bodyLgMedium">OneKey Pro*2 + Keytag*1</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          2025-01-26 21:46
        </SizableText>
        <EmptyData />
      </YStack>
    </YStack>
  );
}

export default function YourReferred() {
  const intl = useIntl();
  const tabs = useMemo(
    () => [
      {
        title: 'OneKey ID',
        page: HardwareSales,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_referred_type_2,
        }),
        page: HardwareSales,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_referred_type_3,
        }),
        page: HardwareSales,
      },
    ],
    [intl],
  );

  const onRefresh = useCallback(() => {}, []);
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.referral_your_referred })}
      />
      <Page.Body>
        <Tab
          disableRefresh={!platformEnv.isNative}
          data={tabs}
          ListHeaderComponent={
            <YStack px="$5">
              <SizableText size="$bodyLg">
                {intl.formatMessage({
                  id: ETranslations.referral_referred_total,
                })}
              </SizableText>
              <SizableText size="$heading5xl">245</SizableText>
            </YStack>
          }
          initialScrollIndex={0}
          initialHeaderHeight={220}
          showsVerticalScrollIndicator={false}
          onRefresh={onRefresh}
        />
      </Page.Body>
    </Page>
  );
}
