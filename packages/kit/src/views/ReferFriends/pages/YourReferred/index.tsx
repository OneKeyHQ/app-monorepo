import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  Page,
  SizableText,
  Spinner,
  Tab,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

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
  const intl = useIntl();
  const { result, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceReferralCode.getHardwareSalesRewardHistory(),
    [],
    {
      watchLoading: true,
      initResult: {
        total: 0,
        items: [],
      },
    },
  );

  if (isLoading) {
    return (
      <YStack position="relative" mt="30%" ai="center" jc="center" flex={1}>
        <Spinner size="large" />
      </YStack>
    );
  }

  const { total = 0, items } = result;

  return (
    <YStack pt="$5">
      <YStack px="$5">
        <SizableText size="$bodyLg">
          {intl.formatMessage({
            id: ETranslations.referral_referred_total_orders,
          })}
        </SizableText>
        <SizableText size="$heading5xl">{total}</SizableText>
      </YStack>
      {total === 0 && !isLoading ? (
        <EmptyData />
      ) : (
        <YStack px="$5" pt="$5">
          {items.map((item, key) => (
            <YStack key={key} py="$2">
              <SizableText size="$bodyLgMedium">{item.title}</SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {item.createdAt ? formatDate(item.createdAt) : ''}
              </SizableText>
            </YStack>
          ))}
        </YStack>
      )}
    </YStack>
  );
}

function EarnList() {
  const intl = useIntl();
  const { result, isLoading } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.getEarnRewardHistory(),
    [],
    {
      watchLoading: true,
      initResult: {
        total: 0,
        items: [],
      },
    },
  );

  if (isLoading) {
    return (
      <YStack position="relative" mt="30%" ai="center" jc="center" flex={1}>
        <Spinner size="large" />
      </YStack>
    );
  }

  const { total = 0, items } = result;

  return (
    <YStack pt="$5">
      <YStack px="$5">
        <SizableText size="$bodyLg">
          {intl.formatMessage({
            id: ETranslations.referral_referred_total_addresses,
          })}
        </SizableText>
        <SizableText size="$heading5xl">{total}</SizableText>
      </YStack>
      {total === 0 && !isLoading ? (
        <EmptyData />
      ) : (
        <YStack px="$5" pt="$5">
          {items.map((item, key) => (
            <YStack key={key} py="$2">
              <SizableText size="$bodyLgMedium">{item.title}</SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {item.effectiveTime ? formatDate(item.effectiveTime) : ''}
              </SizableText>
            </YStack>
          ))}
        </YStack>
      )}
    </YStack>
  );
}

export default function YourReferred() {
  const intl = useIntl();
  const tabs = useMemo(
    () => [
      // {
      //   title: 'OneKey ID',
      //   page: HardwareSales,
      // },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_referred_type_2,
        }),
        page: EarnList,
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

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.referral_your_referred })}
      />
      <Page.Body>
        <Tab.Page
          data={tabs}
          initialScrollIndex={0}
          showsVerticalScrollIndicator={false}
        />
      </Page.Body>
    </Page>
  );
}
