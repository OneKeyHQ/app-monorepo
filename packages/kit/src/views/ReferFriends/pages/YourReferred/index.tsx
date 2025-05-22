import { useMemo } from 'react';

import { reverse } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Divider,
  Empty,
  Page,
  SizableText,
  Spinner,
  Tab,
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
        <YStack px="$5" pt="$5">
          <SizableText size="$headingSm" color="$textSubdued" py="$2">
            {intl.formatMessage({ id: ETranslations.referral_order_info })}
          </SizableText>
          {items.map((item, key) => (
            <YStack key={key} py="$3">
              <SizableText size="$bodyLgMedium" numberOfLines={1}>
                {item.title}
              </SizableText>
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
        <YStack pt="$5">
          <SizableText size="$headingSm" color="$textSubdued" px="$5" py="$2">
            {intl.formatMessage({
              id: ETranslations.referral_your_referred_wallets_details,
            })}
          </SizableText>
          {reverse(items).map((item, index) => (
            <>
              <ListItem
                drillIn
                py="$3"
                key={index}
                title={`Wallet ${items.length - index}`}
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
              <Divider mx="$5" />
            </>
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
      {
        title: intl.formatMessage({
          id: ETranslations.global_wallet,
        }),
        page: WalletList,
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
