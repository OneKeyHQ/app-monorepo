import { useCallback, useEffect, useMemo, useState } from 'react';

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
  Tab,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

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
  const [settings] = useSettingsPersistAtom();

  return (
    <XStack ai="center" jc="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_friends_address,
        })}
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_reward_undistributed,
        })}
      </SizableText>
    </XStack>
  );
}

function UndistributedList() {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const sectionData = [
    {
      title: '0x1234...1234',
      amount: '10.25',
      data: [
        {
          name: 'Vault name',
          action: '10 ETH deposited',
          token: {
            uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
            symbol: 'USDC',
            amount: 10.25,
            fiatAmount: 0.1,
          },
        },
      ],
    },
  ];
  return (
    <YStack px="$5" py="$2">
      <ListHeader />
      {sectionData.map(({ title, amount, data }, index) => (
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
                my="$-1"
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
                      <NumberSizeableText
                        color="$textSuccess"
                        formatter="balance"
                        size="$bodyLgMedium"
                        formatterOptions={{
                          currency: settings.currencyInfo.symbol,
                          showPlusMinusSigns: true,
                        }}
                      >
                        {amount}
                      </NumberSizeableText>
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
                  pt="$2"
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
                        <Token size="xs" networkId="evm--1" mr="$2" />
                        <NumberSizeableText
                          mr="$1"
                          formatter="balance"
                          size="$bodyMd"
                          formatterOptions={{
                            tokenSymbol: item.token.symbol,
                          }}
                        >
                          {item.token.amount}
                        </NumberSizeableText>
                        <XStack ai="center">
                          <SizableText size="$bodyMd" color="$textSubdued">
                            (
                          </SizableText>
                          <NumberSizeableText
                            formatter="balance"
                            size="$bodyMd"
                            formatterOptions={{
                              currency: settings.currencyInfo.symbol,
                            }}
                          >
                            {item.token.fiatAmount}
                          </NumberSizeableText>
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

function TotalList() {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const sectionData = [
    {
      title: '0x1234...1234',
      amount: '10.25',
      data: [
        {
          name: 'Vault name',
          action: '10 ETH deposited',
          token: {
            uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
            symbol: 'USDC',
            amount: 10.25,
            fiatAmount: 0.1,
          },
        },
      ],
    },
  ];
  return (
    <YStack px="$5" py="$2">
      <ListHeader />
      {sectionData.map(({ title, amount, data }, index) => (
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
                my="$-1"
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
                      <NumberSizeableText
                        color="$textSuccess"
                        formatter="balance"
                        size="$bodyLgMedium"
                        formatterOptions={{
                          currency: settings.currencyInfo.symbol,
                          showPlusMinusSigns: true,
                        }}
                      >
                        {amount}
                      </NumberSizeableText>
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
                  pt="$2"
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
                      <SizableText size="$bodyMd">{item.name}</SizableText>
                      <XStack ai="center">
                        <Token size="xs" networkId="evm--1" mr="$2" />
                        <NumberSizeableText
                          mr="$1"
                          formatter="balance"
                          size="$bodyMd"
                          formatterOptions={{
                            tokenSymbol: item.token.symbol,
                          }}
                        >
                          {item.token.amount}
                        </NumberSizeableText>
                        <XStack ai="center">
                          <SizableText size="$bodyMd" color="$textSubdued">
                            (
                          </SizableText>
                          <NumberSizeableText
                            formatter="balance"
                            size="$bodyMd"
                            formatterOptions={{
                              currency: settings.currencyInfo.symbol,
                            }}
                          >
                            {item.token.fiatAmount}
                          </NumberSizeableText>
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

export default function EarnReward() {
  const intl = useIntl();

  const [amount, setAmount] = useState<
    | {
        available: string;
        pending: string;
      }
    | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);

  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;

  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.earnRewardAlert,
  );

  const fetchSales = useCallback((cursor?: string) => {
    return backgroundApiProxy.serviceReferralCode.getEarnReward(cursor);
  }, []);

  const fetchSummaryInfo = useCallback(() => {
    return backgroundApiProxy.serviceReferralCode.getSummaryInfo();
  }, []);

  const onRefresh = useCallback(() => {
    setIsLoading(true);
    void Promise.allSettled([fetchSales(), fetchSummaryInfo()]).then(
      ([salesResult, summaryResult]) => {
        if (salesResult.status === 'fulfilled') {
          const data = salesResult.value;
          // originalData.current.push(...data.items);
        }

        if (summaryResult.status === 'fulfilled') {
          const data = summaryResult.value;
          setAmount({
            available: data.Earn.available?.amount || '0',
            pending: data.Earn.pending?.amount || '0',
          });
        }
        setIsLoading(false);
      },
    );
  }, [fetchSales, fetchSummaryInfo]);

  useEffect(() => {
    onRefresh();
  }, [fetchSales, fetchSummaryInfo, onRefresh]);

  const tabs = useMemo(
    () => [
      {
        title: intl.formatMessage({
          id: ETranslations.earn_referral_undistributed,
        }),
        page: UndistributedList,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_referred_total,
        }),
        page: TotalList,
      },
    ],
    [intl],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.referral_earn_reward })}
      />
      <Page.Body>
        <Tab.Page
          ListHeaderComponent={
            amount === undefined ? (
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
                    {amount.pending}
                  </NumberSizeableText>
                  <SizableText mt="$1">
                    <NumberSizeableText
                      size="$bodyMdMedium"
                      formatter="balance"
                      formatterOptions={{ currency: currencySymbol }}
                      mr="$1"
                    >
                      {amount.available}
                    </NumberSizeableText>
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {intl.formatMessage({
                        id: ETranslations.referral_total_reward,
                      })}
                    </SizableText>
                  </SizableText>
                </YStack>
              </YStack>
            )
          }
          data={tabs}
          initialScrollIndex={0}
          showsVerticalScrollIndicator={false}
        />
      </Page.Body>
    </Page>
  );
}
