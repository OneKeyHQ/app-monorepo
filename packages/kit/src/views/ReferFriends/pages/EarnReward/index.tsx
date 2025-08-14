import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Accordion,
  Alert,
  Divider,
  Empty,
  Icon,
  NumberSizeableText,
  Page,
  SizableText,
  Spinner,
  Stack,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnRewardItem,
  IEarnRewardResponse,
} from '@onekeyhq/shared/src/referralCode/type';
import type {
  EModalReferFriendsRoutes,
  IModalReferFriendsParamList,
} from '@onekeyhq/shared/src/routes/referFriends';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { RouteProp } from '@react-navigation/core';

type ISectionData = IEarnRewardResponse['items'][0];

type IVaultAmount = Record<string, Record<string, string>>;

const SEPARATOR = '__';
const buildKey = (item: IEarnRewardItem) =>
  [
    item.networkId,
    item.provider,
    item.token.symbol,
    item.vaultAddress?.toLowerCase() || '',
  ].join(SEPARATOR);

function EmptyData() {
  const intl = useIntl();
  return (
    <Empty
      mt="$5"
      icon="GiftOutline"
      title={intl.formatMessage({
        id: ETranslations.referral_referred_empty,
      })}
      description={intl.formatMessage({
        id: ETranslations.referral_referred_empty_desc,
      })}
    />
  );
}

function ListHeader() {
  const intl = useIntl();

  return (
    <XStack ai="center" jc="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_friends_address,
        })}
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_order_reward,
        })}
      </SizableText>
    </XStack>
  );
}

function List({
  listData,
  vaultAmount,
}: {
  listData: ISectionData[];
  vaultAmount?: IVaultAmount;
}) {
  const intl = useIntl();
  return listData.length > 0 ? (
    <YStack px="$5" py="$2">
      <ListHeader />
      <YStack>
        <Accordion type="single" collapsible gap="$2">
          {listData.map(({ accountAddress, fiatValue, items }) => (
            <Accordion.Item value={accountAddress} key={accountAddress}>
              <Accordion.Trigger
                unstyled
                flexDirection="row"
                alignItems="center"
                borderWidth={0}
                bg="$transparent"
                px="$2"
                py="$1"
                mx="$-2"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                borderRadius="$2"
              >
                {({ open }: { open: boolean }) => (
                  <XStack my="$3" jc="space-between" flex={1}>
                    <SizableText
                      textAlign="left"
                      flex={1}
                      size="$bodyLgMedium"
                      color="$text"
                    >
                      {accountUtils.shortenAddress({
                        address: accountAddress,
                        leadingLength: 6,
                        trailingLength: 4,
                      })}
                    </SizableText>
                    <XStack ai="center" gap="$2">
                      <Currency
                        color="$textSuccess"
                        formatter="value"
                        size="$bodyLgMedium"
                        formatterOptions={{
                          showPlusMinusSigns: true,
                        }}
                      >
                        {fiatValue}
                      </Currency>
                      <Stack
                        animation="quick"
                        rotate={open ? '180deg' : '0deg'}
                      >
                        <Icon
                          name="ChevronDownSmallOutline"
                          color={open ? '$iconActive' : '$iconSubdued'}
                          size="$5"
                        />
                      </Stack>
                    </XStack>
                  </XStack>
                )}
              </Accordion.Trigger>
              <Accordion.HeightAnimator animation="quick">
                <Accordion.Content
                  unstyled
                  pb="$5"
                  animation="100ms"
                  enterStyle={{ opacity: 0 }}
                  exitStyle={{ opacity: 0 }}
                >
                  {items.map((item, itemIndex) => {
                    return (
                      <XStack
                        ai="center"
                        jc="space-between"
                        key={itemIndex}
                        py="$2"
                      >
                        <YStack flexShrink={1}>
                          <SizableText size="$bodyMd">
                            {accountUtils.shortenAddress({
                              address: accountAddress,
                              leadingLength: 6,
                              trailingLength: 4,
                            })}
                          </SizableText>
                          <SizableText
                            size="$bodySm"
                            color="$textSubdued"
                            flexShrink={1}
                          >
                            <NumberSizeableText
                              flexShrink={1}
                              formatter="balance"
                              size="$bodySm"
                              color="$textSubdued"
                              formatterOptions={{
                                tokenSymbol: item.token.symbol || '',
                              }}
                            >
                              {vaultAmount?.[accountAddress]?.[
                                buildKey(item)
                              ] || 0}
                            </NumberSizeableText>
                            {` ${intl.formatMessage({
                              id: ETranslations.earn_deposited,
                            })}`}
                          </SizableText>
                        </YStack>
                        <Stack
                          ai="flex-end"
                          flexDirection="column"
                          $gtMd={{ flexDirection: 'row' }}
                          gap="$2"
                        >
                          <XStack>
                            <Token
                              size="xs"
                              tokenImageUri={item.token.logoURI}
                              mr="$2"
                            />
                            <XStack mr="$1">
                              <NumberSizeableText
                                formatter="balance"
                                size="$bodyMd"
                                formatterOptions={{
                                  tokenSymbol: item.token.symbol || '',
                                }}
                              >
                                {item.amount}
                              </NumberSizeableText>
                            </XStack>
                          </XStack>
                          <XStack ai="center">
                            <SizableText size="$bodyMd" color="$textSubdued">
                              (
                            </SizableText>
                            <Currency formatter="value" size="$bodyMd">
                              {item.fiatValue}
                            </Currency>
                            <SizableText size="$bodyMd" color="$textSubdued">
                              )
                            </SizableText>
                          </XStack>
                        </Stack>
                      </XStack>
                    );
                  })}
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          ))}
        </Accordion>
      </YStack>
    </YStack>
  ) : (
    <EmptyData />
  );
}

const buildAccountNetworkKey = (accountAddress: string, networkId: string) =>
  `${accountAddress}-${networkId}`;

export default function EarnReward() {
  const route =
    useRoute<
      RouteProp<
        IModalReferFriendsParamList,
        EModalReferFriendsRoutes.EarnReward
      >
    >();

  const { title } = route.params;
  const intl = useIntl();

  const [lists, setLists] = useState<(ISectionData[] | undefined)[]>([]);
  const [amount, setAmount] = useState<
    | {
        pending: string;
      }
    | undefined
  >();

  const [isLoading, setIsLoading] = useState(true);

  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.earnRewardAlert,
  );

  const [vaultAmount, setVaultAmount] = useState<IVaultAmount | undefined>();

  const fetchSales = useCallback((cursor?: string) => {
    return backgroundApiProxy.serviceReferralCode.getEarnReward(cursor, true);
  }, []);

  const fetchTotalList = useCallback((cursor?: string) => {
    return backgroundApiProxy.serviceReferralCode.getEarnReward(cursor);
  }, []);

  const onRefresh = useCallback(async () => {
    setIsLoading(true);
    const [salesResult, totalResult] = await Promise.allSettled([
      fetchSales(),
      fetchTotalList(),
    ]);
    const listBundles = [];
    let pending = '0';
    if (salesResult.status === 'fulfilled') {
      const data = salesResult.value;
      listBundles[0] = data.items?.length ? data.items : [];
      pending = BigNumber(data.fiatValue).toFixed(2) || '0';
    }
    if (totalResult.status === 'fulfilled') {
      const data = totalResult.value;
      listBundles[1] = data.items?.length ? data.items : [];
    }
    const accounts: {
      accountAddress: string;
      networkId: string;
    }[] = [];
    const seenAccounts = new Set<string>();
    const processItems = (items: IEarnRewardResponse['items']) => {
      if (!items || !items.length) {
        return;
      }
      items.forEach((item) => {
        const key = buildAccountNetworkKey(
          item.accountAddress,
          item.items[0].networkId,
        );
        if (!seenAccounts.has(key)) {
          seenAccounts.add(key);
          accounts.push({
            accountAddress: item.accountAddress,
            networkId: item.items[0].networkId,
          });
        }
      });
    };

    if (salesResult.status === 'fulfilled' && salesResult.value.items) {
      processItems(salesResult.value.items);
    }

    if (totalResult.status === 'fulfilled' && totalResult.value.items) {
      processItems(totalResult.value.items);
    }
    const response = await backgroundApiProxy.serviceReferralCode.getPositions(
      accounts,
    );

    const newVaultAmount = {} as IVaultAmount;
    for (const item of response.list) {
      const keys = item.key.split(SEPARATOR);
      const lastIndex = keys.length - 1;
      if (keys[lastIndex].length) {
        keys[lastIndex] = keys[lastIndex].toLowerCase();
      }
      if (!newVaultAmount[item.accountAddress]) {
        newVaultAmount[item.accountAddress] = {};
      }
      newVaultAmount[item.accountAddress][keys.join(SEPARATOR)] =
        item.deposited;
    }
    setVaultAmount(newVaultAmount);
    setAmount({ pending });
    setLists(listBundles);
    setTimeout(() => {
      setIsLoading(false);
    }, 80);
  }, [fetchSales, fetchTotalList]);

  useEffect(() => {
    void onRefresh();
  }, [fetchSales, onRefresh]);

  const ListHeaderComponent = useMemo(() => {
    return (
      <YStack bg="$bgApp">
        {tourTimes === 0 ? (
          <Alert
            closable
            description={intl.formatMessage({
              id: ETranslations.referral_earn_reward_tips,
            })}
            type="info"
            mx="$5"
            mb="$2.5"
            onClose={tourVisited}
          />
        ) : null}
        <YStack px="$5" py="$2.5">
          <SizableText size="$bodyLg">
            {intl.formatMessage({
              id: ETranslations.referral_reward_undistributed,
            })}
          </SizableText>
          <Currency size="$heading5xl" formatter="value">
            {amount?.pending || 0}
          </Currency>
        </YStack>
      </YStack>
    );
  }, [amount?.pending, intl, tourTimes, tourVisited]);

  const Content = useMemo(() => {
    if ((lists[0]?.length || 0) + (lists[1]?.length || 0) === 0) {
      return (
        <YStack>
          {ListHeaderComponent}
          <Divider mx="$5" />
          <EmptyData />
        </YStack>
      );
    }

    return (
      <Tabs.Container
        renderHeader={() => ListHeaderComponent}
        renderTabBar={(props) => <Tabs.TabBar {...props} />}
      >
        <Tabs.Tab
          name={intl.formatMessage({
            id: ETranslations.earn_referral_undistributed,
          })}
        >
          <Tabs.ScrollView style={{ paddingBottom: 40 }}>
            <List listData={lists[0] || []} vaultAmount={vaultAmount} />
          </Tabs.ScrollView>
        </Tabs.Tab>
        <Tabs.Tab
          name={intl.formatMessage({
            id: ETranslations.referral_referred_total,
          })}
        >
          <Tabs.ScrollView style={{ paddingBottom: 40 }}>
            <List listData={lists[1] || []} vaultAmount={vaultAmount} />
          </Tabs.ScrollView>
        </Tabs.Tab>
      </Tabs.Container>
    );
  }, [ListHeaderComponent, intl, lists, vaultAmount]);

  return (
    <Page>
      <Page.Header title={title} />
      <Page.Body>
        {Content}
        {isLoading || !lists[0] || !lists[1] ? (
          <YStack
            bg="$bgApp"
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            ai="center"
            jc="center"
            flex={1}
          >
            <Spinner size="large" />
          </YStack>
        ) : null}
      </Page.Body>
    </Page>
  );
}
