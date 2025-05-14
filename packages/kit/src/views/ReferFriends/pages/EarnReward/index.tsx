import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Accordion,
  Alert,
  Empty,
  Icon,
  NumberSizeableText,
  Page,
  SizableText,
  Spinner,
  Stack,
  Tab,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnRewardItem } from '@onekeyhq/shared/src/referralCode/type';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IntlShape } from 'react-intl';

interface ISectionData {
  title: string;
  amount: string;
  data: {
    orderTotalAmount: string;
    name: string;
    action: string;
    token: {
      uri: string;
      symbol: string;
      amount: string;
      fiatAmount: string;
    };
  }[];
}

function EmptyData() {
  const intl = useIntl();
  return (
    <Empty
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

function List({ listData }: { listData: ISectionData[] }) {
  return (
    <YStack px="$5" py="$2">
      <ListHeader />
      {listData.map(({ title, amount, data }, index) => (
        <YStack key={index}>
          <Accordion type="multiple" gap="$2">
            <Accordion.Item value={String(index)}>
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
                      color={open ? '$text' : '$textSubdued'}
                    >
                      {title}
                    </SizableText>
                    <XStack ai="center" gap="$2">
                      <Currency
                        sourceCurrency="usd"
                        color="$textSuccess"
                        formatter="balance"
                        size="$bodyLgMedium"
                        formatterOptions={{
                          showPlusMinusSigns: true,
                        }}
                      >
                        {amount}
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
                  {data.map((item, itemIndex) => (
                    <XStack
                      ai="center"
                      jc="space-between"
                      key={itemIndex}
                      py="$2"
                    >
                      <YStack>
                        <SizableText size="$bodyMd">{item.name}</SizableText>
                        <SizableText size="$bodySm" color="$textSubdued">
                          {item.action}
                        </SizableText>
                      </YStack>
                      <XStack ai="center">
                        <Token
                          size="xs"
                          tokenImageUri={item.token.uri}
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
                            {item.token.amount}
                          </NumberSizeableText>
                        </XStack>
                        <XStack ai="center">
                          <SizableText size="$bodyMd" color="$textSubdued">
                            (
                          </SizableText>
                          <Currency
                            sourceCurrency="usd"
                            formatter="balance"
                            size="$bodyMd"
                          >
                            {item.token.fiatAmount}
                          </Currency>
                          <SizableText size="$bodyMd" color="$textSubdued">
                            )
                          </SizableText>
                        </XStack>
                      </XStack>
                    </XStack>
                  ))}
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          </Accordion>
        </YStack>
      ))}
    </YStack>
  );
}

const formatSections = (data: IEarnRewardItem[], intl: IntlShape) => {
  const formattedData = data.reduce<Record<string, IEarnRewardItem[]>>(
    (acc: Record<string, IEarnRewardItem[]>, item: IEarnRewardItem) => {
      const address = item.accountAddress;
      if (!acc[address]) {
        acc[address] = [];
      }
      acc[address].push(item);
      return acc;
    },
    {},
  );

  const sectionDataArray: ISectionData[] = Object.entries(formattedData).map(
    ([address, items]) => {
      const totalFiatValue = items.reduce(
        (sum, item) => sum.plus(new BigNumber(item.fiatValue || '0')),
        new BigNumber(0),
      );

      return {
        title: accountUtils.shortenAddress({
          address,
          leadingLength: 6,
          trailingLength: 4,
        }),
        amount: totalFiatValue.toFixed(2),
        data: items.map((item) => {
          const orderTotalAmount = item?.orderTotalAmount || '0';
          const symbol = item?.token?.symbol || '';
          return {
            name: item?.vaultName || '',
            orderTotalAmount,
            action: `${orderTotalAmount} ${symbol} ${intl.formatMessage({
              id: ETranslations.earn_deposited,
            })}`,
            token: {
              uri: item?.token.logoURI || '',
              symbol,
              amount: item.amount || '0',
              fiatAmount: item?.fiatValue || '0',
            },
          };
        }),
      };
    },
  );
  return sectionDataArray;
};

export default function EarnReward() {
  const intl = useIntl();

  const [amount, setAmount] = useState<
    | {
        available: string;
        pending: string;
      }
    | undefined
  >();
  const [undistributedListData, setUndistributedListData] = useState<
    ISectionData[]
  >([]);
  const [totalListData, setTotalListData] = useState<ISectionData[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;

  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.earnRewardAlert,
  );

  const fetchSales = useCallback((cursor?: string) => {
    return backgroundApiProxy.serviceReferralCode.getEarnReward(cursor, true);
  }, []);

  const fetchTotalList = useCallback((cursor?: string) => {
    return backgroundApiProxy.serviceReferralCode.getEarnReward(cursor);
  }, []);

  const onRefresh = useCallback(() => {
    setIsLoading(true);
    void Promise.allSettled([fetchSales(), fetchTotalList()]).then(
      ([salesResult, totalResult]) => {
        if (salesResult.status === 'fulfilled') {
          const data = salesResult.value;
          setUndistributedListData(formatSections(data.items, intl));
          setAmount({
            available: '0',
            pending: data.fiatValue || '0',
          });
        }
        if (totalResult.status === 'fulfilled') {
          const data = totalResult.value;
          setTotalListData(formatSections(data.items, intl));
        }
        setIsLoading(false);
      },
    );
  }, [fetchSales, fetchTotalList, intl]);

  useEffect(() => {
    onRefresh();
  }, [fetchSales, onRefresh]);

  const tabs = useMemo(
    () => [
      {
        title: intl.formatMessage({
          id: ETranslations.earn_referral_undistributed,
        }),
        // eslint-disable-next-line react/no-unstable-nested-components
        page: () => <List listData={undistributedListData} />,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_referred_total,
        }),
        // eslint-disable-next-line react/no-unstable-nested-components
        page: () => <List listData={totalListData} />,
      },
    ],
    [intl, totalListData, undistributedListData],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.referral_earn_reward })}
      />
      <Page.Body>
        {isLoading ? (
          <YStack
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
        ) : (
          <Tab.Page
            ListHeaderComponent={
              <YStack>
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
                  <NumberSizeableText
                    size="$heading5xl"
                    formatter="balance"
                    formatterOptions={{ currency: currencySymbol }}
                  >
                    {amount?.pending || 0}
                  </NumberSizeableText>
                </YStack>
              </YStack>
            }
            data={tabs}
            initialScrollIndex={0}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Page.Body>
    </Page>
  );
}
