import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  Page,
  SizableText,
  Spinner,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';
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
        <YStack px="$5" pt="$5" pb="$10">
          <SizableText size="$headingSm" color="$textSubdued" py="$2">
            {intl.formatMessage({ id: ETranslations.referral_order_info })}
          </SizableText>
          {items.map((item, key) => (
            <XStack key={key} py="$3" ai="center" jc="space-between">
              <YStack>
                <SizableText size="$bodyLgMedium" numberOfLines={1}>
                  {item.orderName}
                </SizableText>
                {item.source ? (
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {item.source}
                  </SizableText>
                ) : null}
              </YStack>
              <SizableText size="$bodyMd" color="$textSubdued">
                {item.createdAt
                  ? formatDate(item.createdAt, {
                      formatTemplate: 'yyyy-LL-dd HH:mm',
                    })
                  : ''}
              </SizableText>
            </XStack>
          ))}
        </YStack>
      )}
    </YStack>
  );
}

function WalletList() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { result, isLoading } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.getEarnWalletHistory(),
    [],
    {
      watchLoading: true,
      initResult: {
        total: 0,
        items: [],
        networks: [],
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

  const { total = 0, items, networks } = result;

  return (
    <YStack pt="$5">
      <YStack px="$5">
        <SizableText size="$bodyLg">
          {intl.formatMessage({
            id: ETranslations.referral_referred_total_wallets,
          })}
        </SizableText>
        <SizableText size="$heading5xl">{total}</SizableText>
      </YStack>
      {total === 0 && !isLoading ? (
        <EmptyData />
      ) : (
        <YStack pt="$5" pb="$10">
          <SizableText size="$headingSm" color="$textSubdued" px="$5" py="$2">
            {intl.formatMessage({
              id: ETranslations.referral_your_referred_wallets_details,
            })}
          </SizableText>
          {items.map((item, index) => (
            <ListItem
              drillIn
              py="$3"
              key={index}
              title={`Wallet ${index + 1}`}
              onPress={() => {
                navigation.push(
                  EModalReferFriendsRoutes.YourReferredWalletAddresses,
                  {
                    items: item.items,
                    networks,
                  },
                );
              }}
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.referral_your_referred_wallets_more_address,
                  },
                  {
                    amount: item.total > 999 ? '999+' : item.total,
                  },
                )}
              </SizableText>
            </ListItem>
          ))}
        </YStack>
      )}
    </YStack>
  );
}

export default function YourReferred() {
  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.referral_your_referred })}
      />
      <Page.Body>
        <Tabs.Container>
          <Tabs.Tab
            name={intl.formatMessage({
              id: ETranslations.global_wallet,
            })}
          >
            <Tabs.ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              <WalletList />
            </Tabs.ScrollView>
          </Tabs.Tab>
          <Tabs.Tab
            name={intl.formatMessage({
              id: ETranslations.referral_referred_type_3,
            })}
          >
            <Tabs.ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              <HardwareSales />
            </Tabs.ScrollView>
          </Tabs.Tab>
        </Tabs.Container>
      </Page.Body>
    </Page>
  );
}
