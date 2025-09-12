import type { PropsWithChildren } from 'react';
import { Fragment, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Share, StyleSheet } from 'react-native';

import type { IStackStyle } from '@onekeyhq/components';
import {
  Accordion,
  Badge,
  Button,
  Divider,
  Icon,
  IconButton,
  LinearGradient,
  NumberSizeableText,
  Page,
  Popover,
  Progress,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function PopoverLine({ children }: PropsWithChildren) {
  return (
    <XStack gap="$3" ai="center">
      <Stack w="$1.5" h="$1.5" bg="$textSubdued" borderRadius="$full" />
      <SizableText size="$bodyMd">{children}</SizableText>
    </XStack>
  );
}

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

function ShareCode({
  inviteUrl,
  inviteCode,
}: {
  inviteUrl: string;
  inviteCode: string;
}) {
  const navigation = useAppNavigation();
  const { copyText } = useClipboard();

  const handleCopy = useCallback(() => {
    copyText(inviteCode);
    defaultLogger.referral.page.copyReferralCode();
  }, [copyText, inviteCode]);

  const inviteCodeUrl = useMemo(() => {
    return inviteUrl.replace('https://', '');
  }, [inviteUrl]);

  const toYourReferredPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.YourReferred);
  }, [navigation]);
  const intl = useIntl();
  const sharedUrl = useMemo(() => `https://${inviteCodeUrl}`, [inviteCodeUrl]);
  const copyLink = useCallback(() => {
    copyText(sharedUrl);
    defaultLogger.referral.page.shareReferralLink('copy');
  }, [copyText, sharedUrl]);
  return (
    <>
      <YStack px="$5" pt="$6" pb="$5" $platform-native={{ pb: '$8' }}>
        <YStack>
          <XStack jc="space-between">
            <SizableText size="$headingMd">
              {intl.formatMessage({ id: ETranslations.referral_your_code })}
            </SizableText>
            <Button
              onPress={toYourReferredPage}
              variant="tertiary"
              iconAfter="ChevronRightOutline"
              jc="center"
            >
              {intl.formatMessage({ id: ETranslations.referral_referred })}
            </Button>
          </XStack>
          <XStack pt="$2">
            <XStack
              flexShrink={1}
              onPress={handleCopy}
              gap="$3"
              borderRadius="$2"
              ml="$-2"
              px="$2"
              borderCurve="continuous"
              ai="center"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
            >
              <SizableText size="$heading4xl">{inviteCode}</SizableText>
              <IconButton
                title={intl.formatMessage({ id: ETranslations.global_copy })}
                variant="tertiary"
                icon="Copy3Outline"
                size="large"
                iconColor="$iconSubdued"
                hoverStyle={undefined}
                pressStyle={undefined}
                onPress={handleCopy}
              />
            </XStack>
            <XStack flex={1} />
          </XStack>
          <Stack
            mt="$2.5"
            ai="center"
            gap="$2.5"
            flexDirection="row"
            $platform-native={{
              flexDirection: 'column',
              gap: '$4',
            }}
          >
            <XStack
              borderColor="rgba(0, 0, 0, 0.13)"
              bg="$bgDisabled"
              px="$3"
              py="$1.5"
              flex={1}
              width="100%"
              borderWidth={StyleSheet.hairlineWidth}
              jc="space-between"
              ai="center"
              onPress={copyLink}
              borderRadius="$2.5"
              hoverStyle={{ bg: '$bgActive' }}
              pressStyle={{ bg: '$bgActive' }}
            >
              <SizableText
                size="$bodyLg"
                flexShrink={platformEnv.isNative ? undefined : 1}
                textBreakStrategy={
                  platformEnv.isNativeAndroid ? 'simple' : undefined
                }
              >
                {inviteCodeUrl}
              </SizableText>
              {platformEnv.isNative ? null : (
                <IconButton
                  title={intl.formatMessage({ id: ETranslations.global_copy })}
                  icon="Copy3Outline"
                  variant="tertiary"
                  size="medium"
                  iconColor="$iconSubdued"
                  onPress={copyLink}
                  hoverStyle={undefined}
                  pressStyle={undefined}
                />
              )}
            </XStack>
            {platformEnv.isNative ? (
              <XStack
                ai="center"
                gap="$2.5"
                $md={{
                  width: '100%',
                }}
              >
                <Button
                  icon="Copy3Outline"
                  variant={platformEnv.isNative ? undefined : 'primary'}
                  $md={{
                    flex: 1,
                  }}
                  size="medium"
                  onPress={copyLink}
                >
                  {intl.formatMessage({ id: ETranslations.global_copy })}
                </Button>
                <Button
                  variant="primary"
                  icon="ShareOutline"
                  size="medium"
                  $md={{
                    flex: 1,
                  }}
                  onPress={() => {
                    setTimeout(() => {
                      void Share.share(
                        platformEnv.isNativeIOS
                          ? {
                              url: sharedUrl,
                            }
                          : {
                              message: sharedUrl,
                            },
                      );
                    }, 300);
                    defaultLogger.referral.page.shareReferralLink('share');
                  }}
                >
                  {intl.formatMessage({ id: ETranslations.explore_share })}
                </Button>
              </XStack>
            ) : null}
          </Stack>
        </YStack>
      </YStack>
      <Divider mx="$5" />
    </>
  );
}

function RewardLevelMoney({
  threshold,
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

function CumulativeRewardsLineItem({
  bg,
  amount,
  title,
}: {
  bg: IStackStyle['bg'];
  title: string;
  amount: string;
}) {
  return (
    <XStack jc="space-between" h={36} ai="center">
      <XStack gap="$2" ai="center" jc="center">
        <Stack w="$2" h="$2" borderRadius="$full" bg={bg} />
        <SizableText size="$bodyMd" color="$textSubdued">
          {title}
        </SizableText>
      </XStack>
      <Currency size="$bodyMdMedium">{BigNumber(amount).toFixed(2)}</Currency>
    </XStack>
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

  const isNewEditWithdrawAddress = withdrawAddresses.length === 0;

  const toEditAddressPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.EditAddress, {
      enabledNetworks,
      accountId: activeAccount.account?.id ?? '',
      address: withdrawAddresses[0]?.address,
      onAddressAdded: async ({ networkId }: { networkId: string }) => {
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.referral_address_updated,
          }),
        });
        setTimeout(() => {
          fetchSummaryInfo();
        }, 50);
        defaultLogger.referral.page.editReceivingAddress({
          networkId,
          editMethod: isNewEditWithdrawAddress ? 'new' : 'edit',
        });
      },
    });
  }, [
    activeAccount.account?.id,
    enabledNetworks,
    fetchSummaryInfo,
    intl,
    isNewEditWithdrawAddress,
    navigation,
    withdrawAddresses,
  ]);

  const toEarnRewardPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.EarnReward, {
      title: onChain.title || '',
    });
  }, [navigation, onChain.title]);

  const toHardwareSalesRewardPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.HardwareSalesReward);
  }, [navigation]);

  const toRewardDistributionHistoryPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.RewardDistributionHistory);
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
      networkId: 'evm--42161',
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
      <YStack borderRadius="$3">
        <YStack
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          borderRadius="$3"
          overflow="hidden"
        >
          <YStack>
            <LinearGradient
              pt="$4"
              px="$5"
              colors={['rgba(0, 196, 59, 0.09)', 'rgba(0, 196, 59, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <XStack ai="center" jc="space-between">
                <XStack gap="$1" ai="center">
                  <Icon name="CoinsAddSolid" size="$5" color="$iconSuccess" />
                  <SizableText size="$headingMd">
                    {intl.formatMessage({
                      id: ETranslations.referral_cumulative_rewards,
                    })}
                  </SizableText>
                </XStack>
                <IconButton
                  variant="tertiary"
                  iconColor="$iconSubdued"
                  icon="ClockTimeHistoryOutline"
                  size="small"
                  iconSize="$5"
                  px="$1.5"
                  mr="$-2"
                  onPress={toRewardDistributionHistoryPage}
                />
              </XStack>
              <Currency
                textAlign="center"
                size="$heading5xl"
                color="$textSuccessStrong"
                formatter="value"
                my="$6"
              >
                {BigNumber(cumulativeRewards.distributed)
                  .plus(cumulativeRewards.undistributed)
                  .toFixed(2)}
              </Currency>
            </LinearGradient>
            <YStack px="$5">
              <CumulativeRewardsLineItem
                bg="$iconSuccess"
                title={intl.formatMessage({
                  id: ETranslations.referral_distributed,
                })}
                amount={cumulativeRewards.distributed}
              />
              <CumulativeRewardsLineItem
                bg="$iconCaution"
                title={intl.formatMessage({
                  id: ETranslations.referral_undistributed,
                })}
                amount={cumulativeRewards.undistributed}
              />
            </YStack>
            <Divider my="$2" mx="$5" />
            <XStack py="$1" px="$5" jc="space-between" ai="center">
              <YStack>
                <SizableText size="$bodyMdMedium">
                  {intl.formatMessage({
                    id: ETranslations.referral_reward_received_address,
                  })}
                </SizableText>
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  flexShrink={1}
                  numberOfLines={10}
                >
                  {withdrawAddresses.length
                    ? accountUtils.shortenAddress({
                        address: withdrawAddresses[0].address,
                      })
                    : intl.formatMessage({
                        id: ETranslations.referral_reward_received_address_notset,
                      })}
                </SizableText>
              </YStack>
              <IconButton
                title={intl.formatMessage({ id: ETranslations.global_edit })}
                variant="tertiary"
                icon="EditOutline"
                size="small"
                onPress={toEditAddressPage}
                iconColor="$iconSubdued"
              />
            </XStack>
          </YStack>
          <YStack bg="$bgSubdued">
            <XStack
              h="$4"
              bg="$bgApp"
              mx={-1}
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
              borderRadius="$3"
              shadowColor="rgba(0,0,0,0.04)"
              shadowOffset={{
                width: 0,
                height: 1,
              }}
            />
            <XStack px="$5" h={36} ai="center" jc="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.referral_next_distribution,
                })}
              </SizableText>
              <SizableText size="$bodyMd">
                {cumulativeRewards.nextDistribution}
              </SizableText>
            </XStack>
          </YStack>
        </YStack>
      </YStack>
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
          {showHardwareSalesAvailableFiat || showHardwarePendingFiat ? (
            <XStack gap="$2" pt="$4">
              {hardwareSales.available?.[0]?.token?.networkId ||
              hardwareSales.pending?.[0]?.token?.networkId ? (
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
                        tokenSymbol: hardwareSales.pending?.[0]?.token.symbol,
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
          ) : (
            <NoRewardYet />
          )}
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

function FAQ({ faqs }: { faqs: IInviteSummary['faqs'] }) {
  const intl = useIntl();
  return (
    <YStack gap="$6" px="$5" py="$8">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.global_faqs })}
      </SizableText>
      <YStack>
        <Accordion type="multiple" gap="$2">
          {faqs.map(({ q, a }, index) => (
            <Accordion.Item value={String(index)} key={String(index)}>
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
                  <>
                    <SizableText
                      textAlign="left"
                      flex={1}
                      size="$bodyLgMedium"
                      color={open ? '$text' : '$textSubdued'}
                    >
                      {q}
                    </SizableText>
                    <Stack animation="quick" rotate={open ? '180deg' : '0deg'}>
                      <Icon
                        name="ChevronDownSmallOutline"
                        color={open ? '$iconActive' : '$iconSubdued'}
                        size="$5"
                      />
                    </Stack>
                  </>
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
                  <SizableText size="$bodyMd">{a}</SizableText>
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          ))}
        </Accordion>
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
  return (
    <>
      <ShareCode inviteUrl={inviteUrl} inviteCode={inviteCode} />
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
        }}
        enabledNum={[0]}
      >
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
      </AccountSelectorProviderMirror>

      <FAQ faqs={faqs} />
      <Link />
    </>
  );
}

export default function InviteReward() {
  const intl = useIntl();
  const { result: summaryInfo, run: fetchSummaryInfo } = usePromiseResult(
    async () => backgroundApiProxy.serviceReferralCode.getSummaryInfo(),
    [],
    {
      initResult: undefined,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  const renderHeaderTitle = useCallback(
    () => (
      <XStack gap="$2">
        <SizableText size="$headingLg">
          {intl.formatMessage({
            id: ETranslations.referral_title,
          })}
        </SizableText>
        <Badge badgeType="info" badgeSize="sm">
          <Badge.Text>Beta</Badge.Text>
        </Badge>
      </XStack>
    ),
    [intl],
  );

  return (
    <Page>
      <Page.Header headerTitle={renderHeaderTitle} />
      <Page.Body>
        {!summaryInfo ? (
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
        ) : (
          <ScrollView>
            <InviteRewardContent
              summaryInfo={summaryInfo}
              fetchSummaryInfo={fetchSummaryInfo}
            />
          </ScrollView>
        )}
      </Page.Body>
    </Page>
  );
}
