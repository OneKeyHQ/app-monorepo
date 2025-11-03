import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IStackStyle } from '@onekeyhq/components';
import {
  Button,
  Divider,
  Empty,
  Icon,
  NumberSizeableText,
  Page,
  Popover,
  Progress,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { CumulativeRewards } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CumulativeRewards';
import { FAQ } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/FAQ';
import { ReferralCodeCard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralCodeCard';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import {
  ETabReferFriendsRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

const DEFAULT_EARN_IMAGE_URL =
  'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0xaf88d065e77c8cc2239327c5edb3a432268e5831-1720669320510.png';

function NoRewardYet() {
  const intl = useIntl();
  return (
    <XStack pt="$4" gap="$2.5" ai="center">
      <XStack>
        <Icon size="$4" name="GiftOutline" color="$iconSubdued" />
      </XStack>
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.referral_no_reward })}
      </SizableText>
    </XStack>
  );
}

function RewardLevelMoney({
  threshold: _threshold,
  isLeft,
  isRight,
}: { threshold: string; isLeft?: boolean; isRight?: boolean } & IStackStyle) {
  const ai = useMemo(() => {
    if (isRight) {
      return 'flex-end';
    }
    if (!isLeft && !isRight) {
      return 'center';
    }
  }, [isLeft, isRight]);
  if (isLeft || isRight) {
    return null;
  }
  return (
    <YStack position="absolute" gap={5} top={22} width="100%" ai={ai}>
      <YStack
        w={1}
        h={10}
        bg="$neutral7"
        borderTopLeftRadius="$1"
        borderTopRightRadius="$1"
        borderBottomLeftRadius="$1"
        borderBottomRightRadius="$1"
      />
      {/* {threshold ? (
        <Currency
          formatter="balance"
          textAlign={isRight ? 'right' : undefined}
          size="$bodySmMedium"
          color="$textSubdued"
          dynamicWidth={(v, c) =>
            (v.length + c.length) * 8 + Math.ceil(v.length / 3) * 4
          }
        >
          {threshold}
        </Currency>
      ) : null} */}
    </YStack>
  );
}

function RewardLevelText({
  level,
  percent,
  threshold,
  isLeft,
  isRight,
}: {
  level: string;
  percent: string;
  threshold: string;
  isLeft?: boolean;
  isRight?: boolean;
}) {
  return (
    <YStack>
      <SizableText size="$bodySm" color="$textSubdued">
        {`${level} ${percent}`}
      </SizableText>
      <RewardLevelMoney
        threshold={threshold}
        isLeft={isLeft}
        isRight={isRight}
      />
    </YStack>
  );
}

function FiatValue({ fiatValue }: { fiatValue?: string | number }) {
  if (!fiatValue) {
    return null;
  }
  return (
    <>
      <SizableText size="$bodyMd"> (</SizableText>
      <Currency formatter="value" size="$bodyMd">
        {fiatValue}
      </Currency>
      <SizableText size="$bodyMd">)</SizableText>
    </>
  );
}

function Dashboard({
  enabledNetworks,
  hardwareSales,
  onChain,
  levelPercent,
  rebateLevels,
  rebateConfig,
  cumulativeRewards = {
    distributed: '0',
    undistributed: '0',
    nextDistribution: '0',
    token: {
      networkId: '',
      address: '',
      logoURI: '',
      name: '',
      symbol: '',
    },
  },
  fetchSummaryInfo,
  withdrawAddresses,
}: {
  enabledNetworks: IInviteSummary['enabledNetworks'];
  onChain: IInviteSummary['Onchain'];
  hardwareSales: IInviteSummary['HardwareSales'];
  cumulativeRewards: IInviteSummary['cumulativeRewards'];
  withdrawAddresses: IInviteSummary['withdrawAddresses'];
  levelPercent: number;
  rebateLevels: IInviteSummary['rebateLevels'];
  rebateConfig: IInviteSummary['rebateConfig'];
  fetchSummaryInfo: () => void;
}) {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const { activeAccount } = useActiveAccount({ num: 0 });

  const toEarnRewardPage = useCallback(() => {
    navigation.push(ETabReferFriendsRoutes.TabEarnReward, {
      title: onChain.title || '',
    });
  }, [navigation, onChain.title]);

  const toHardwareSalesRewardPage = useCallback(() => {
    navigation.push(ETabReferFriendsRoutes.TabHardwareSalesReward);
  }, [navigation]);

  const showEarnSalesAvailableFiat = (onChain.available?.length || 0) > 0;
  const showHardwareSalesAvailableFiat =
    (hardwareSales.available?.length || 0) > 0;
  const showHardwarePendingFiat = (hardwareSales.pending?.length || 0) > 0;
  const onChainSummary = useMemo(() => {
    return onChain.available
      ?.reduce((acc, curr) => {
        return acc.plus(BigNumber(curr.usdValue));
      }, BigNumber(0))
      .toFixed(2);
  }, [onChain.available]);

  const onChainSummaryFiat = useMemo(() => {
    return onChain.available
      ?.reduce((acc, curr) => {
        return acc.plus(BigNumber(curr.fiatValue));
      }, BigNumber(0))
      .toFixed(2);
  }, [onChain.available]);

  const { result: earnToken } = usePromiseResult(async () => {
    return backgroundApiProxy.serviceToken.getToken({
      networkId: PERPS_NETWORK_ID,
      tokenIdOnNetwork: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      accountId: activeAccount.account?.id ?? '',
    });
  }, [activeAccount.account?.id]);

  const renderNextStage = useCallback(() => {
    if (hardwareSales.nextStage) {
      if (hardwareSales.nextStage.isEnd) {
        return (
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.referral_hw_level_up_diamond,
            })}
          </SizableText>
        );
      }
      return (
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {intl.formatMessage(
            { id: ETranslations.referral_hw_level_up_remain },
            {
              Amount: (
                <Currency size="$bodySm" formatter="balance" color="$text">
                  {hardwareSales.nextStage.amount}
                </Currency>
              ),
              LevelName: hardwareSales.nextStage.label,
            },
          )}
        </SizableText>
      );
    }
  }, [hardwareSales.nextStage, intl]);
  return (
    <YStack py="$8" px="$5" gap="$5" borderRadius="$3">
      <CumulativeRewards
        cumulativeRewards={cumulativeRewards}
        withdrawAddresses={withdrawAddresses}
        enabledNetworks={enabledNetworks}
        fetchSummaryInfo={fetchSummaryInfo}
      />
      <YStack
        pb="$4"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
      >
        <YStack
          pt="$4"
          px="$5"
          onPress={toHardwareSalesRewardPage}
          cursor="pointer"
        >
          <XStack ai="center" jc="space-between">
            <XStack gap="$1" ai="center">
              <Icon name="OnekeyLiteOutline" size="$5" />
              <SizableText size="$headingMd">{hardwareSales.title}</SizableText>
            </XStack>
            <Icon size="$4.5" color="$iconSubdued" name="ChevronRightOutline" />
          </XStack>
          <SizableText mt="$0.5" size="$bodyMd" color="$textSubdued">
            {hardwareSales.description}
          </SizableText>
        </YStack>
        <YStack px="$5">
          <YStack>
            <XStack py="$6" jc="space-between" ai="center">
              <XStack gap="$2" ai="center" jc="center">
                <XStack
                  borderRadius="$2"
                  w="$8"
                  h="$8"
                  bg="$bgStrong"
                  ai="center"
                  jc="center"
                >
                  <SizableText size="$headingXl">
                    {rebateConfig.emoji}
                  </SizableText>
                </XStack>
                <YStack>
                  <SizableText size="$headingMd">
                    {rebateConfig.label}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage(
                      {
                        id: ETranslations.referral_hw_level_rebate_rate,
                      },
                      {
                        percent: `${rebateConfig.rebate}%`,
                      },
                    )}
                  </SizableText>
                </YStack>
              </XStack>
              <YStack ai="flex-end">
                <Currency size="$headingMd" formatter="value">
                  {hardwareSales?.monthlySalesFiatValue
                    ? BigNumber(hardwareSales.monthlySalesFiatValue).toFixed(2)
                    : 0}
                </Currency>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_hw_sales_title,
                  })}
                </SizableText>
              </YStack>
            </XStack>
            <YStack h={28} borderRadius="$2" py="$2">
              <XStack mb="$2" jc="space-between" h="$4">
                {rebateLevels.map((rebateLevel, index) => {
                  return (
                    <RewardLevelText
                      key={index}
                      level={rebateLevel.emoji}
                      percent={`${rebateLevel.rebate}%`}
                      isLeft={index === 0}
                      isRight={index === rebateLevels.length - 1}
                      threshold={
                        rebateLevel.level === rebateConfig.level + 1
                          ? String(rebateLevel.thresholdFiatValue)
                          : ''
                      }
                    />
                  );
                })}
              </XStack>
              <Progress
                indicatorColor="$bgSuccessStrong"
                value={levelPercent ? Number(levelPercent) * 100 : 0}
                width="100%"
                size="medium"
              />
            </YStack>
            <XStack gap="$1" pt="$5" pb="$2">
              {renderNextStage()}
            </XStack>
          </YStack>
          {(() => {
            if (!showHardwareSalesAvailableFiat && !showHardwarePendingFiat) {
              return <NoRewardYet />;
            }

            const hasTokenNetworkId =
              hardwareSales.available?.[0]?.token?.networkId ||
              hardwareSales.pending?.[0]?.token?.networkId;

            return (
              <XStack gap="$2" pt="$4">
                {hasTokenNetworkId ? (
                  <Token
                    size="xs"
                    tokenImageUri={
                      hardwareSales.available?.[0]?.token?.logoURI ||
                      hardwareSales.pending?.[0]?.token?.logoURI
                    }
                  />
                ) : null}
                <SizableText size="$bodyMd">
                  <NumberSizeableText
                    formatter="value"
                    size="$bodyMd"
                    formatterOptions={{
                      tokenSymbol: hardwareSales.available?.[0]?.token?.symbol,
                    }}
                  >
                    {hardwareSales.available?.[0]?.amount || 0}
                  </NumberSizeableText>
                  {hardwareSales.available?.[0]?.amount ? (
                    <FiatValue
                      fiatValue={hardwareSales.available?.[0]?.fiatValue}
                    />
                  ) : null}
                  {showHardwarePendingFiat ? (
                    <>
                      <SizableText size="$bodyMd">{` + `}</SizableText>
                      <NumberSizeableText
                        formatter="value"
                        size="$bodyMd"
                        formatterOptions={{
                          tokenSymbol:
                            hardwareSales.pending?.[0]?.token?.symbol,
                        }}
                      >
                        {hardwareSales.pending?.[0]?.amount || 0}
                      </NumberSizeableText>
                      {hardwareSales.pending?.[0]?.amount ? (
                        <FiatValue
                          fiatValue={hardwareSales.pending?.[0]?.fiatValue}
                        />
                      ) : null}
                    </>
                  ) : null}
                </SizableText>
                {showHardwarePendingFiat ? (
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.referral_sales_reward_pending,
                    })}
                  </SizableText>
                ) : null}
              </XStack>
            );
          })()}
        </YStack>
      </YStack>
      <YStack
        pb="$4"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
      >
        <YStack pt="$4" px="$5" onPress={toEarnRewardPage} cursor="pointer">
          <XStack ai="center" jc="space-between">
            <XStack gap="$1" ai="center">
              <Icon name="CoinsOutline" size="$5" />
              <SizableText size="$headingMd">{onChain.title}</SizableText>
            </XStack>
            <Icon size="$4.5" color="$iconSubdued" name="ChevronRightOutline" />
          </XStack>
          <SizableText mt="$0.5" size="$bodyMd" color="$textSubdued">
            {onChain.description}
          </SizableText>
        </YStack>
        <YStack px="$5">
          {showEarnSalesAvailableFiat ? (
            <YStack gap="$2" pt="$4">
              <XStack>
                <Token
                  size="xs"
                  tokenImageUri={earnToken?.logoURI || DEFAULT_EARN_IMAGE_URL}
                />
                <XStack pl="$2" pr="$3">
                  <XStack gap="$1">
                    <SizableText size="$bodyMd">≈</SizableText>
                    <NumberSizeableText
                      formatter="value"
                      size="$bodyMd"
                      formatterOptions={{
                        tokenSymbol: 'USDC',
                      }}
                    >
                      {onChainSummary}
                    </NumberSizeableText>
                  </XStack>
                  <FiatValue fiatValue={onChainSummaryFiat} />
                </XStack>
                <Popover.Tooltip
                  iconSize="$5"
                  title={intl.formatMessage({
                    id: ETranslations.referral_earn_reward_details,
                  })}
                  renderContent={
                    <YStack borderRadius="$3" overflow="hidden">
                      <YStack px="$5">
                        {onChain.available?.map(
                          ({ token, fiatValue, amount }, index) => {
                            return (
                              <XStack
                                key={index}
                                gap="$2"
                                h={48}
                                ai="center"
                                jc="space-between"
                                py={5}
                              >
                                <XStack gap="$2.5" ai="center">
                                  <Token
                                    size="sm"
                                    tokenImageUri={token.logoURI}
                                  />
                                  <SizableText size="$bodyMdMedium">
                                    {token.symbol.toUpperCase()}
                                  </SizableText>
                                </XStack>
                                <YStack ai="flex-end">
                                  <NumberSizeableText
                                    formatter="balance"
                                    size="$bodyMdMedium"
                                  >
                                    {amount}
                                  </NumberSizeableText>
                                  <Currency
                                    formatter="balance"
                                    size="$bodySmMedium"
                                    color="$textSubdued"
                                  >
                                    {fiatValue}
                                  </Currency>
                                </YStack>
                              </XStack>
                            );
                          },
                        )}
                      </YStack>
                      <Divider />
                      <XStack
                        ai="center"
                        gap="$2"
                        py="$2.5"
                        px="$5"
                        bg="$bgSubdued"
                      >
                        <Stack>
                          <Icon
                            color="$iconSubdued"
                            size="$5"
                            name="InfoCircleOutline"
                          />
                        </Stack>
                        <SizableText
                          flex={1}
                          size="$bodyMd"
                          color="$textSubdued"
                        >
                          {intl.formatMessage({
                            id: ETranslations.referral_earn_reward_details_desc,
                          })}
                        </SizableText>
                      </XStack>
                    </YStack>
                  }
                />
              </XStack>
            </YStack>
          ) : (
            <NoRewardYet />
          )}
        </YStack>
      </YStack>
    </YStack>
  );
}

function Link() {
  return (
    <XStack px="$5" mb="$5">
      <HyperlinkText
        cursor="pointer"
        size="$bodyMdMedium"
        underlineTextProps={{
          color: '$textInfo',
        }}
        style={{
          textUnderlineOffset: 2,
        }}
        translationId={ETranslations.referral_more_questions}
      />
    </XStack>
  );
}

function InviteRewardContent({
  summaryInfo,
  fetchSummaryInfo,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => void;
}) {
  const {
    faqs,
    inviteUrl,
    inviteCode,
    enabledNetworks,
    Onchain,
    HardwareSales,
    cumulativeRewards,
    levelPercent,
    rebateLevels,
    rebateConfig,
    withdrawAddresses,
  } = summaryInfo;
  const navigation = useAppNavigation();

  const handleViewLevelDetail = useCallback(() => {
    navigation.push(ETabReferFriendsRoutes.TabReferralLevel);
  }, [navigation]);

  return (
    <>
      <ReferralCodeCard inviteUrl={inviteUrl} inviteCode={inviteCode} />
      <YStack px="$5" py="$4">
        <Button
          variant="secondary"
          size="medium"
          onPress={handleViewLevelDetail}
          icon="TrophyOutline"
        >
          查看等级详情
        </Button>
      </YStack>
      <Dashboard
        enabledNetworks={enabledNetworks}
        onChain={Onchain}
        hardwareSales={HardwareSales}
        cumulativeRewards={cumulativeRewards}
        levelPercent={Number(levelPercent)}
        rebateLevels={rebateLevels}
        rebateConfig={rebateConfig}
        fetchSummaryInfo={fetchSummaryInfo}
        withdrawAddresses={withdrawAddresses}
      />
      <FAQ faqs={faqs} />
      <Link />
    </>
  );
}

function InviteRewardPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    result: summaryInfo,
    run: fetchSummaryInfo,
    isLoading,
  } = usePromiseResult(
    async () => {
      try {
        return await backgroundApiProxy.serviceReferralCode.getSummaryInfo();
      } catch (error) {
        if (error instanceof OneKeyServerApiError) {
          // Silently swallow known backend errors so we can show fallback UI
          console.warn('InviteRewardPage getSummaryInfo failed:', error);
          return undefined;
        }
        throw error;
      }
    },
    [],
    {
      initResult: undefined,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      undefinedResultIfError: true,
      watchLoading: true,
    },
  );

  const isFetching = isLoading ?? summaryInfo === undefined;

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.ReferFriends}
      />
      <Page.Body>
        {(() => {
          if (isFetching) {
            return (
              <Stack
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
              </Stack>
            );
          }

          if (summaryInfo) {
            return (
              <ScrollView>
                <InviteRewardContent
                  summaryInfo={summaryInfo}
                  fetchSummaryInfo={fetchSummaryInfo}
                />
              </ScrollView>
            );
          }

          return (
            <Stack flex={1} ai="center" jc="center" px="$5">
              <Empty
                icon="GiftOutline"
                title={intl.formatMessage({
                  id: ETranslations.referral_referred_empty,
                })}
                description={intl.formatMessage({
                  id: ETranslations.referral_referred_empty_desc,
                })}
                button={
                  <Button
                    size="medium"
                    variant="primary"
                    onPress={() => {
                      navigation.replace(
                        ETabReferFriendsRoutes.TabReferAFriend,
                      );
                    }}
                  >
                    {intl.formatMessage({
                      id: ETranslations.referral_invite_via,
                    })}
                  </Button>
                }
              />
            </Stack>
          );
        })()}
      </Page.Body>
    </Page>
  );
}

export default function InviteReward() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <InviteRewardPage />
    </AccountSelectorProviderMirror>
  );
}
