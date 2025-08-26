import { Fragment, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Dialog,
  Divider,
  Image,
  Input,
  Page,
  Toast,
  XStack,
  YStack,
  useMedia,
  useShare,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { CountDownCalendarAlert } from '@onekeyhq/kit/src/components/CountDownCalendarAlert';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { PeriodSection } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/PeriodSectionV2';
import { ProtectionSection } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/ProtectionSectionV2';
import {
  useDevSettingsPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalReceiveRoutes,
  EModalRoutes,
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import {
  normalizeToEarnProvider,
  normalizeToEarnSymbol,
} from '@onekeyhq/shared/types/earn/earnProvider.constants';
import { EStakingActionType } from '@onekeyhq/shared/types/staking';
import type {
  IEarnActivateActionIcon,
  IEarnAlert,
  IEarnDetailActions,
  IEarnReceiveActionIcon,
  IEarnTokenInfo,
  IEarnTradeActionIcon,
  IEarnWithdrawActionIcon,
  IEarnWithdrawOrderActionIcon,
  IProtocolInfo,
  IStakeEarnDetail,
  ISubscriptionAction,
} from '@onekeyhq/shared/types/staking';

import { showRiskNoticeDialogBeforeDepositOrWithdraw } from '../../../Earn/components/RiskNoticeDialog';
import { EarnNavigation, EarnNetworkUtils } from '../../../Earn/earnUtils';
import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { EarnActionIcon } from '../../components/ProtocolDetails/EarnActionIcon';
import { EarnAlert } from '../../components/ProtocolDetails/EarnAlert';
import { EarnIcon } from '../../components/ProtocolDetails/EarnIcon';
import { EarnText } from '../../components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../components/ProtocolDetails/EarnTooltip';
import { GridItem } from '../../components/ProtocolDetails/GridItemV2';
import { NoAddressWarning } from '../../components/ProtocolDetails/NoAddressWarning';
import { ShareEventsContext } from '../../components/ProtocolDetails/ShareEventsProvider';
import { showKYCDialog } from '../../components/ProtocolDetails/showKYCDialog';
import { StakingTransactionIndicator } from '../../components/StakingActivityIndicator';
import { OverviewSkeleton } from '../../components/StakingSkeleton';
import { useCheckEthenaKycStatus } from '../../hooks/useCheckEthenaKycStatus';
import { useHandleSwap } from '../../hooks/useHandleSwap';
import { useUnsupportedProtocol } from '../../hooks/useUnsupportedProtocol';
import { buildLocalTxStatusSyncId } from '../../utils/utils';
import {
  useHandleStake,
  useHandleWithdraw,
} from '../ProtocolDetails/useHandleActions';

import { FAQSection } from './FAQSection';

function ManagersSection({
  managers,
}: {
  managers: IStakeEarnDetail['managers'] | undefined;
}) {
  return managers?.items?.length ? (
    <XStack pt="$1" pb="$4" gap="$1" px="$5">
      {managers.items.map((item, index) => (
        <Fragment key={index}>
          <XStack gap="$1" alignItems="center">
            <Image size="$4" borderRadius="$1" src={item.logoURI} />
            <EarnText text={item.title} size="$bodySm" />
            <EarnText text={item.description} size="$bodySm" />
          </XStack>
          {index !== managers.items.length - 1 ? (
            <XStack w="$4" h="$4" ai="center" jc="center">
              <XStack w="$1" h="$1" borderRadius="$full" bg="$iconSubdued" />
            </XStack>
          ) : null}
        </Fragment>
      ))}
    </XStack>
  ) : null;
}

function SubscriptionSection({
  subscriptionValue,
  subscriptionActions,
  badgeTags,
}: {
  subscriptionValue: IStakeEarnDetail['subscriptionValue'];
  subscriptionActions: ISubscriptionAction[];
  badgeTags?: IStakeEarnDetail['tags'];
}) {
  const media = useMedia();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const renderActionButtons = useCallback(() => {
    if (!media.gtMd) {
      return null;
    }
    return (
      <XStack gap="$2">
        {subscriptionActions.map((action) => (
          <Button key={action.text} {...action.buttonProps}>
            {action.text ?? ''}
          </Button>
        ))}
      </XStack>
    );
  }, [media.gtMd, subscriptionActions]);
  const isZero = useMemo(() => {
    return (
      !subscriptionValue?.fiatValue || subscriptionValue?.fiatValue === '0'
    );
  }, [subscriptionValue?.fiatValue]);
  return subscriptionValue ? (
    <YStack gap="$8">
      <YStack>
        <XStack ai="center" gap="$2" pt="$2">
          <EarnText text={subscriptionValue.title} size="$headingLg" />
          {badgeTags?.map((tag) => (
            <Badge key={tag.tag} badgeType={tag.badge}>
              <Badge.Text>{tag.tag}</Badge.Text>
            </Badge>
          ))}
        </XStack>
        <XStack gap="$2" pt="$2" pb="$1" jc="space-between">
          <EarnText
            text={{
              text: isZero
                ? `${currencyInfo.symbol} 0.00`
                : subscriptionValue.fiatValue,
            }}
            size="$heading4xl"
            color={isZero ? '$textDisabled' : '$text'}
          />
          {renderActionButtons()}
        </XStack>
        <EarnText
          text={{
            text: `${subscriptionValue.formattedValue || 0} ${
              subscriptionValue?.token?.info?.symbol
            }`,
          }}
          size="$bodyLgMedium"
          color="$textSubdued"
        />
      </YStack>
    </YStack>
  ) : null;
}

function AlertSection({ alerts }: { alerts?: IEarnAlert[] }) {
  return <EarnAlert alerts={alerts} />;
}

function ProtocolRewards({
  rewards,
  tokenInfo,
  protocolInfo,
}: {
  rewards: IStakeEarnDetail['rewards'];
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
}) {
  return rewards ? (
    <YStack
      gap="$2.5"
      py="$3.5"
      px="$4"
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      bg="$bgSubdued"
    >
      <XStack alignItems="center" gap="$1">
        <EarnText text={rewards.title} size="$bodyMd" color="$textSubdued" />
        <EarnTooltip title={rewards?.title?.text} tooltip={rewards?.tooltip} />
      </XStack>
      {rewards?.tokens?.map((token, index) => {
        return (
          <Fragment key={index}>
            <YStack gap="$2.5">
              <XStack
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                gap="$2"
              >
                <XStack alignItems="center" flex={1} flexWrap="wrap">
                  <Token
                    mr="$1.5"
                    size="sm"
                    tokenImageUri={token.token.info.logoURI}
                  />
                  <XStack flex={1} flexWrap="wrap" alignItems="center">
                    <EarnText text={token.title} size="$bodyLgMedium" />
                  </XStack>
                </XStack>
                <EarnActionIcon
                  title={token.title.text}
                  actionIcon={token.button}
                  protocolInfo={protocolInfo}
                  tokenInfo={tokenInfo}
                  token={token.token.info}
                />
              </XStack>
              <XStack>
                <EarnText
                  text={token.description}
                  size="$bodyMd"
                  color="$textSubdued"
                />
              </XStack>
            </YStack>
            {rewards?.tokens.length !== index + 1 ? (
              <Divider my="$1.5" />
            ) : null}
          </Fragment>
        );
      })}
    </YStack>
  ) : null;
}

function PortfolioSection({
  portfolios,
  rewards,
  tokenInfo,
  protocolInfo,
}: {
  portfolios: IStakeEarnDetail['portfolios'];
  rewards: IStakeEarnDetail['rewards'];
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
}) {
  const renderItem = useCallback(
    (item: NonNullable<IStakeEarnDetail['portfolios']>['items'][0]) => {
      switch (item.type) {
        case 'default':
        default:
          return (
            <XStack
              key={item.title.text}
              minHeight={30}
              alignItems="center"
              justifyContent="space-between"
            >
              <XStack alignItems="center" gap="$1.5">
                <Token size="sm" tokenImageUri={item.token.info.logoURI} />
                <EarnText text={item.title} size="$bodyLgMedium" />
                <EarnText text={item.description} size="$bodyLgMedium" />
                {item?.badge ? (
                  <Badge
                    badgeType={item.badge.badgeType}
                    badgeSize={item.badge.badgeSize}
                  >
                    <Badge.Text>{item.badge.text.text}</Badge.Text>
                  </Badge>
                ) : null}
                <EarnTooltip
                  title={item?.description?.text}
                  tooltip={item?.tooltip}
                />
              </XStack>
              <XStack gap="$1">
                {item.buttons?.map((button, index) => (
                  <EarnActionIcon
                    key={index}
                    title={item.title.text}
                    actionIcon={button}
                    protocolInfo={protocolInfo}
                    tokenInfo={tokenInfo}
                    token={item.token.info}
                  />
                ))}
              </XStack>
            </XStack>
          );
      }
    },
    [protocolInfo, tokenInfo],
  );
  return portfolios?.items?.length || rewards?.tokens?.length ? (
    <>
      <YStack gap="$6">
        <XStack justifyContent="space-between">
          <EarnText text={portfolios?.title} size="$headingLg" />
          <EarnActionIcon
            title={portfolios?.title?.text}
            actionIcon={portfolios?.button}
            protocolInfo={protocolInfo}
            tokenInfo={tokenInfo}
          />
        </XStack>
        <YStack gap="$3">
          {portfolios?.items?.length ? (
            <YStack gap="$3">{portfolios.items.map(renderItem)}</YStack>
          ) : null}
          {rewards?.tokens.length ? (
            <ProtocolRewards
              rewards={rewards}
              tokenInfo={tokenInfo}
              protocolInfo={protocolInfo}
            />
          ) : null}
        </YStack>
      </YStack>
      <Divider />
    </>
  ) : null;
}

function ProfitSection({ profit }: { profit: IStakeEarnDetail['profit'] }) {
  return profit ? (
    <>
      <YStack gap="$6">
        <EarnText text={profit.title} size="$headingLg" />
        <XStack flexWrap="wrap" m="$-5" p="$2">
          {profit.items.map((cell) => (
            <GridItem
              key={cell.title.text}
              title={cell.title}
              description={cell.description}
              actionIcon={cell.button}
              tooltip={cell.tooltip}
              type={cell.type}
            />
          ))}
        </XStack>
      </YStack>
      <Divider />
    </>
  ) : null;
}

function ProviderSection({
  provider,
}: {
  provider: IStakeEarnDetail['provider'];
}) {
  return provider ? (
    <>
      <YStack gap="$6">
        <EarnText text={provider.title} size="$headingLg" />
        <XStack flexWrap="wrap" m="$-5" p="$2">
          {provider.items.map((cell) => (
            <GridItem
              key={cell.title.text}
              title={cell.title}
              description={cell.description}
              actionIcon={cell.button}
              tooltip={cell?.tooltip}
              type={cell.type}
            />
          ))}
        </XStack>
      </YStack>
      <Divider />
    </>
  ) : null;
}

function RiskSection({ risk }: { risk?: IStakeEarnDetail['risk'] }) {
  return risk ? (
    <>
      <YStack gap="$6">
        <EarnText text={risk.title} size="$headingLg" />
        <YStack gap="$3">
          {risk.items?.map((item) => (
            <>
              <XStack ai="center" gap="$3" key={item.title.text}>
                <YStack flex={1} gap="$2">
                  <XStack ai="center" gap="$2">
                    <XStack
                      ai="center"
                      jc="center"
                      w="$6"
                      h="$6"
                      borderRadius="$1"
                    >
                      <EarnIcon
                        icon={item.icon}
                        size="$6"
                        color="$iconCaution"
                      />
                    </XStack>
                    <EarnText text={item.title} size="$bodyMdMedium" />
                  </XStack>
                  <EarnText
                    text={item.description}
                    size="$bodyMd"
                    color={item.description.color || '$textSubdued'}
                  />
                </YStack>
                <EarnActionIcon
                  title={item.title.text}
                  actionIcon={item.actionButton}
                />
              </XStack>

              {item.list?.length ? (
                <YStack gap="$1">
                  {item.list.map((i, indexOfList) => (
                    <XStack key={indexOfList} gap="$1">
                      <EarnIcon icon={i.icon} size="$4" color="$iconCaution" />
                      <EarnText
                        text={i.title}
                        size="$bodySm"
                        color="$textCaution"
                      />
                    </XStack>
                  ))}
                </YStack>
              ) : null}
            </>
          ))}
        </YStack>
      </YStack>
      <Divider />
    </>
  ) : null;
}

const ProtocolDetailsPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    | EModalStakingRoutes.ProtocolDetailsV2
    | EModalStakingRoutes.ProtocolDetailsV2Share
  >();
  const { activeAccount } = useActiveAccount({ num: 0 });

  // parse route params, support two types of routes
  const resolvedParams = useMemo<{
    accountId: string;
    indexedAccountId: string | undefined;
    networkId: string;
    symbol: ISupportedSymbol;
    provider: string;
    vault: string | undefined;
    isFromShareLink: boolean;
  }>(() => {
    const routeParams = route.params as any;

    // check if it is the new share link format
    if ('network' in routeParams) {
      // new format: /earn/:network/:symbol/:provider
      const {
        network,
        symbol: symbolParam,
        provider: providerParam,
        vault,
      } = routeParams;
      const networkId = EarnNetworkUtils.getNetworkIdByName(network);
      const symbol = normalizeToEarnSymbol(symbolParam);
      const provider = normalizeToEarnProvider(providerParam);

      if (!networkId) {
        throw new OneKeyLocalError(`Unknown network: ${String(network)}`);
      }
      if (!symbol) {
        throw new OneKeyLocalError(`Unknown symbol: ${String(symbolParam)}`);
      }
      if (!provider) {
        throw new OneKeyLocalError(
          `Unknown provider: ${String(providerParam)}`,
        );
      }

      return {
        accountId: activeAccount.account?.id || '',
        indexedAccountId: activeAccount.indexedAccount?.id,
        networkId,
        symbol,
        provider,
        vault,
        isFromShareLink: true,
      };
    }

    // old format: /defi/staking/v2/:symbol/:provider
    const {
      accountId: routeAccountId,
      indexedAccountId: routeIndexedAccountId,
      networkId,
      symbol,
      provider,
      vault,
    } = routeParams;

    return {
      accountId: routeAccountId || activeAccount.account?.id || '',
      indexedAccountId:
        routeIndexedAccountId || activeAccount.indexedAccount?.id,
      networkId,
      symbol,
      provider,
      vault,
      isFromShareLink: false,
    };
  }, [route.params, activeAccount]);

  const { accountId, networkId, indexedAccountId, symbol, provider, vault } =
    resolvedParams;
  const appNavigation = useAppNavigation();
  const [stakeLoading, setStakeLoading] = useState(false);
  const [keepSkeletonVisible, setKeepSkeletonVisible] = useState(false);

  const { result: earnAccount, run: refreshAccount } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceStaking.getEarnAccount({
        accountId,
        networkId,
        indexedAccountId,
        btcOnlyTaproot: true,
      }),
    [accountId, indexedAccountId, networkId],
  );

  const {
    result: detailInfo,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      const response =
        await backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
          accountId,
          networkId,
          indexedAccountId,
          symbol,
          provider,
          vault,
        });
      return response;
    },
    [accountId, networkId, indexedAccountId, symbol, provider, vault],
    { watchLoading: true, revalidateOnFocus: true },
  );

  // Handle unsupported protocol
  useUnsupportedProtocol({
    detailInfo,
    appNavigation,
    setKeepSkeletonVisible,
  });

  useCheckEthenaKycStatus({
    provider,
    refreshEarnDetailData: run,
  });

  const tokenInfo: IEarnTokenInfo | undefined = useMemo(() => {
    if (!detailInfo?.subscriptionValue?.token) {
      return undefined;
    }

    // Use BigNumber to handle balance and fallback to '0' if invalid or missing
    const balanceBN = new BigNumber(
      detailInfo.subscriptionValue.balance || '0',
    );
    const balanceParsed = balanceBN.isNaN() ? '0' : balanceBN.toFixed();

    return {
      balanceParsed,
      token: detailInfo.subscriptionValue.token.info,
      price: detailInfo.subscriptionValue.token.price,
      networkId,
      provider,
      vault,
      accountId,
    };
  }, [
    detailInfo?.subscriptionValue?.token,
    detailInfo?.subscriptionValue?.balance,
    networkId,
    provider,
    vault,
    accountId,
  ]);

  const onCreateAddress = useCallback(async () => {
    await refreshAccount();
    void run();
  }, [refreshAccount, run]);

  const handleWithdraw = useHandleWithdraw();
  const handleStake = useHandleStake();
  const { handleSwap } = useHandleSwap();

  // const { result: trackingResp, run: refreshTracking } = usePromiseResult(
  //   async () => {
  //     if (
  //       provider.toLowerCase() !== EEarnProviderEnum.Babylon.toLowerCase() ||
  //       !earnAccount
  //     ) {
  //       return [];
  //     }
  //     const items =
  //       await backgroundApiProxy.serviceStaking.getBabylonTrackingItems({
  //         accountId: earnAccount.accountId,
  //         networkId: earnAccount.networkId,
  //       });
  //     return items;
  //   },
  //   [provider, earnAccount],
  //   { initResult: [] },
  // );

  // const isFocused = useIsFocused();
  // useEffect(() => {
  //   if (isFocused) {
  //     void refreshTracking();
  //   }
  // }, [isFocused, refreshTracking]);

  // const onRefreshTracking = useCallback(async () => {
  //   void run();
  //   void refreshTracking();
  // }, [run, refreshTracking]);

  const protocolInfo: IProtocolInfo | undefined = useMemo(() => {
    const withdrawAction = detailInfo?.actions?.find(
      (i) => i.type === 'withdraw',
    ) as IEarnWithdrawActionIcon;
    return detailInfo?.protocol
      ? {
          ...detailInfo.protocol,
          apyDetail: detailInfo.apyDetail,
          earnAccount,
          activeBalance: withdrawAction?.data?.balance,
          eventEndTime: detailInfo?.countDownAlert?.endTime,
          stakeTag: buildLocalTxStatusSyncId({
            providerName: provider,
            tokenSymbol: symbol,
          }),

          // withdraw
          overflowBalance: detailInfo.nums?.overflow,
          maxUnstakeAmount: detailInfo.nums?.maxUnstakeAmount,
          minUnstakeAmount: detailInfo.nums?.minUnstakeAmount,

          // staking
          minTransactionFee: detailInfo.nums?.minTransactionFee,
          remainingCap: detailInfo.nums?.remainingCap,

          // claim
          claimable: detailInfo.nums?.claimable,
        }
      : undefined;
  }, [
    detailInfo?.actions,
    detailInfo?.apyDetail,
    detailInfo?.countDownAlert?.endTime,
    detailInfo?.nums?.claimable,
    detailInfo?.nums?.maxUnstakeAmount,
    detailInfo?.nums?.minTransactionFee,
    detailInfo?.nums?.minUnstakeAmount,
    detailInfo?.nums?.remainingCap,
    detailInfo?.nums?.overflow,
    detailInfo?.protocol,
    earnAccount,
    provider,
    symbol,
  ]);

  const onStake = useCallback(async () => {
    if (
      earnAccount?.accountAddress &&
      protocolInfo?.provider &&
      networkId &&
      detailInfo?.riskNoticeDialog?.deposit
    ) {
      const isFirstDeposit =
        await backgroundApiProxy.simpleDb.earnExtra.isFirstOperation(
          networkId,
          protocolInfo.provider,
          earnAccount.accountAddress,
          'deposit',
        );

      if (isFirstDeposit) {
        showRiskNoticeDialogBeforeDepositOrWithdraw({
          networkId,
          providerName: protocolInfo.provider,
          address: earnAccount.accountAddress,
          operationType: 'deposit',
          riskNoticeDialogContent: detailInfo?.riskNoticeDialog?.deposit,
          onConfirm: async () => {
            await handleStake({
              protocolInfo,
              tokenInfo,
              accountId: earnAccount?.accountId,
              networkId,
              indexedAccountId,
              setStakeLoading,
              onSuccess: async () => {
                // if (networkUtils.isBTCNetwork(networkId)) {
                //   await run();
                // }
              },
            });
          },
        });
        return;
      }
    }

    await handleStake({
      protocolInfo,
      tokenInfo,
      accountId: earnAccount?.accountId,
      networkId,
      indexedAccountId,
      setStakeLoading,
      onSuccess: async () => {
        // if (networkUtils.isBTCNetwork(networkId)) {
        //   await run();
        // }
      },
    });
  }, [
    handleStake,
    protocolInfo,
    tokenInfo,
    earnAccount?.accountId,
    earnAccount?.accountAddress,
    networkId,
    indexedAccountId,
    detailInfo?.riskNoticeDialog?.deposit,
  ]);

  const onWithdraw = useCallback(
    async (withdrawType: EStakingActionType) => {
      if (
        earnAccount?.accountAddress &&
        protocolInfo?.provider &&
        networkId &&
        detailInfo?.riskNoticeDialog?.withdraw
      ) {
        const isFirstWithdraw =
          await backgroundApiProxy.simpleDb.earnExtra.isFirstOperation(
            networkId,
            protocolInfo.provider,
            earnAccount.accountAddress,
            'withdraw',
          );

        if (isFirstWithdraw) {
          showRiskNoticeDialogBeforeDepositOrWithdraw({
            networkId,
            providerName: protocolInfo.provider,
            address: earnAccount.accountAddress,
            operationType: 'withdraw',
            riskNoticeDialogContent: detailInfo?.riskNoticeDialog?.withdraw,
            onConfirm: async () => {
              await handleWithdraw({
                withdrawType,
                protocolInfo,
                tokenInfo,
                accountId: earnAccount?.accountId,
                networkId,
                symbol,
                provider,
                onSuccess: async () => {
                  // if (networkUtils.isBTCNetwork(networkId)) {
                  //   await run();
                  // }
                },
              });
            },
          });
          return;
        }
      }

      await handleWithdraw({
        withdrawType,
        protocolInfo,
        tokenInfo,
        accountId: earnAccount?.accountId,
        networkId,
        symbol,
        provider,
        onSuccess: async () => {
          // if (networkUtils.isBTCNetwork(networkId)) {
          //   await run();
          // }
        },
      });
    },
    [
      earnAccount?.accountId,
      earnAccount?.accountAddress,
      handleWithdraw,
      networkId,
      protocolInfo,
      provider,
      symbol,
      tokenInfo,
      detailInfo?.riskNoticeDialog?.withdraw,
    ],
  );

  const historyAction = useMemo(() => {
    return detailInfo?.actions?.find((i) => i.type === 'history');
  }, [detailInfo?.actions]);

  const onHistory = useMemo(() => {
    if (historyAction?.disabled || !earnAccount?.accountId) {
      return undefined;
    }
    return (params?: { filterType?: string }) => {
      const { filterType } = params || {};
      appNavigation.navigate(EModalStakingRoutes.HistoryList, {
        accountId: earnAccount?.accountId,
        networkId,
        symbol,
        provider,
        stakeTag: protocolInfo?.stakeTag || '',
        protocolVault: vault,
        filterType,
      });
    };
  }, [
    appNavigation,
    earnAccount?.accountId,
    historyAction?.disabled,
    networkId,
    protocolInfo?.stakeTag,
    provider,
    symbol,
    vault,
  ]);

  const intl = useIntl();
  const media = useMedia();
  const { shareText } = useShare();
  const [devSettings] = useDevSettingsPersistAtom();

  // Generate share URL
  const shareUrl = useMemo(() => {
    if (!symbol || !provider || !networkId) return undefined;
    const shareLink = EarnNavigation.generateShareLink({
      networkId,
      symbol,
      provider,
      vault,
      isDevMode: devSettings.enabled,
    });
    return shareLink;
  }, [symbol, provider, networkId, vault, devSettings.enabled]);

  const handleShare = useCallback(() => {
    if (!shareUrl) return;
    void shareText(shareUrl);
  }, [shareUrl, shareText]);

  const depositActionProps = useMemo(() => {
    const item = detailInfo?.actions?.find((i) => i.type === 'deposit');
    return {
      text: item?.text.text,
      buttonProps: {
        disabled: !earnAccount?.accountAddress || item?.disabled,
        variant: 'primary',
        loading: stakeLoading,
        display: item ? undefined : 'none',
        onPress: onStake,
      } as IButtonProps,
    };
  }, [detailInfo?.actions, earnAccount?.accountAddress, stakeLoading, onStake]);

  const withdrawActionProps = useMemo(() => {
    const item: IEarnWithdrawActionIcon | IEarnWithdrawOrderActionIcon =
      detailInfo?.actions?.find(
        (i) =>
          i.type === EStakingActionType.Withdraw ||
          i.type === EStakingActionType.WithdrawOrder,
      ) as IEarnWithdrawActionIcon | IEarnWithdrawOrderActionIcon;
    return {
      text: item?.text.text,
      buttonProps: {
        disabled: !earnAccount?.accountAddress || item?.disabled,
        display: item ? undefined : 'none',
        onPress: () => onWithdraw(item?.type || EStakingActionType.Withdraw),
      } as IButtonProps,
    };
  }, [earnAccount?.accountAddress, onWithdraw, detailInfo?.actions]);

  const activateActionProps = useMemo(() => {
    const item = detailInfo?.actions?.find(
      (i) => i.type === EStakingActionType.Activate,
    ) as IEarnActivateActionIcon | undefined;
    return {
      text: item?.text.text,
      buttonProps: {
        disabled: !earnAccount?.accountAddress || item?.disabled,
        display: item ? undefined : 'none',
        variant: 'primary',
        onPress: () => {
          if (item) {
            showKYCDialog({
              actionData: item,
              onConfirm: async (checkboxStates: boolean[]) => {
                if (checkboxStates.every(Boolean)) {
                  const resp =
                    await backgroundApiProxy.serviceStaking.verifyRegisterSignMessage(
                      {
                        networkId,
                        provider,
                        symbol,
                        accountAddress: earnAccount?.accountAddress ?? '',
                        signature: '',
                        message: '',
                      },
                    );
                  if (resp.toast) {
                    Toast.success({
                      title: resp.toast.text.text,
                    });
                  }
                  setTimeout(() => {
                    void run();
                  }, 300);
                  return Promise.resolve();
                }
                throw new OneKeyLocalError(
                  'All checkboxes must be checked to proceed',
                );
              },
            });
          }
        },
      } as IButtonProps,
    };
  }, [
    earnAccount?.accountAddress,
    detailInfo?.actions,
    networkId,
    provider,
    symbol,
    run,
  ]);

  const receiveActionProps = useMemo(() => {
    const item = detailInfo?.actions?.find(
      (i) => i.type === EStakingActionType.Receive,
    ) as IEarnReceiveActionIcon | undefined;
    return {
      text: item?.text.text,
      buttonProps: {
        disabled: !earnAccount?.accountAddress || item?.disabled,
        display: item ? undefined : 'none',
        onPress: () => {
          appNavigation.pushModal(EModalRoutes.ReceiveModal, {
            screen: EModalReceiveRoutes.ReceiveToken,
            params: {
              networkId,
              accountId: earnAccount?.accountId ?? '',
              walletId: earnAccount?.walletId,
              token: detailInfo?.subscriptionValue?.token.info,
            },
          });
        },
      } as IButtonProps,
    };
  }, [
    detailInfo?.actions,
    earnAccount?.walletId,
    earnAccount?.accountId,
    earnAccount?.accountAddress,
    networkId,
    detailInfo?.subscriptionValue?.token.info,
    appNavigation,
  ]);

  const tradeActionProps = useMemo(() => {
    const item = detailInfo?.actions?.find(
      (i) => i.type === EStakingActionType.Trade,
    ) as IEarnTradeActionIcon | undefined;
    return {
      text: item?.text.text,
      buttonProps: {
        disabled: !earnAccount?.accountAddress || item?.disabled,
        display: item ? undefined : 'none',
        variant: 'primary',
        onPress: async () => {
          if (detailInfo?.subscriptionValue?.token) {
            await handleSwap({
              token: detailInfo.subscriptionValue.token.info,
              networkId,
            });
          }
        },
      } as IButtonProps,
    };
  }, [
    detailInfo?.actions,
    earnAccount?.accountAddress,
    detailInfo?.subscriptionValue?.token,
    handleSwap,
    networkId,
  ]);

  const SUBSCRIPTION_ACTION_TYPES = useMemo(
    () => [
      EStakingActionType.Withdraw,
      EStakingActionType.WithdrawOrder,
      EStakingActionType.Deposit,
      EStakingActionType.Activate,
      EStakingActionType.Receive,
      EStakingActionType.Trade,
    ],
    [],
  );

  const getButtonPropsForAction = useCallback(
    (action: IEarnDetailActions) => {
      switch (action.type) {
        case EStakingActionType.Deposit:
          return depositActionProps;
        case EStakingActionType.Withdraw:
          return withdrawActionProps;
        case EStakingActionType.WithdrawOrder:
          return withdrawActionProps;
        case EStakingActionType.Activate:
          return activateActionProps;
        case EStakingActionType.Receive:
          return receiveActionProps;
        case EStakingActionType.Trade:
          return tradeActionProps;
        default:
          return undefined;
      }
    },
    [
      depositActionProps,
      withdrawActionProps,
      activateActionProps,
      receiveActionProps,
      tradeActionProps,
    ],
  );

  const subscriptionActions = useMemo<ISubscriptionAction[]>(() => {
    if (!detailInfo?.actions) {
      return [];
    }
    // Sort by SUBSCRIPTION_ACTION_TYPES order
    return SUBSCRIPTION_ACTION_TYPES.map((actionType) => {
      const action = detailInfo?.actions?.find((a) => a.type === actionType);
      return action ? getButtonPropsForAction(action) : null;
    }).filter(Boolean);
  }, [detailInfo?.actions, getButtonPropsForAction, SUBSCRIPTION_ACTION_TYPES]);

  const renderPageFooter = useCallback(() => {
    if (media.gtMd || !subscriptionActions.length) {
      return null;
    }

    // Only one action: use as Confirm Button
    if (subscriptionActions.length === 1) {
      return (
        <Page.Footer
          onConfirmText={subscriptionActions[0].text}
          confirmButtonProps={subscriptionActions[0].buttonProps}
        />
      );
    }

    // Two or more actions: first as Cancel Button, second as Confirm Button
    return (
      <Page.Footer
        onCancelText={subscriptionActions[0].text}
        cancelButtonProps={subscriptionActions[0].buttonProps}
        onConfirmText={subscriptionActions[1].text}
        confirmButtonProps={subscriptionActions[1].buttonProps}
      />
    );
  }, [media.gtMd, subscriptionActions]);

  const now = useMemo(() => Date.now(), []);
  const contextValue = useMemo(
    () => ({
      onHistory,
    }),
    [onHistory],
  );
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_earn_symbol },
          {
            'symbol': networkUtils.isBTCNetwork(networkId)
              ? `${symbol} (Taproot)`
              : symbol,
          },
        )}
      />
      <Page.Body pb="$5">
        <ManagersSection managers={detailInfo?.managers} />
        {detailInfo?.countDownAlert?.startTime &&
        detailInfo?.countDownAlert?.endTime &&
        now > detailInfo.countDownAlert.startTime &&
        detailInfo.countDownAlert.endTime < now ? (
          <YStack pb="$1">
            <CountDownCalendarAlert
              description={detailInfo.countDownAlert.description.text}
              descriptionTextProps={{
                color: detailInfo.countDownAlert.description.color,
                size: detailInfo.countDownAlert.description.size,
              }}
              effectiveTimeAt={detailInfo.countDownAlert.endTime}
            />
          </YStack>
        ) : null}
        <YStack px="$5" gap="$8">
          <ShareEventsContext.Provider value={contextValue}>
            <PageFrame
              LoadingSkeleton={OverviewSkeleton}
              loading={
                isLoadingState({ result: detailInfo, isLoading }) ||
                keepSkeletonVisible
              }
              error={isErrorState({ result: detailInfo, isLoading })}
              onRefresh={run}
            >
              {detailInfo ? (
                <YStack gap="$8">
                  {earnAccount?.accountAddress ? (
                    <>
                      <SubscriptionSection
                        subscriptionValue={detailInfo.subscriptionValue}
                        subscriptionActions={subscriptionActions}
                        badgeTags={detailInfo?.tags}
                      />
                      <AlertSection alerts={detailInfo.alertsV2} />
                      <Divider />
                      <PortfolioSection
                        portfolios={detailInfo.portfolios}
                        rewards={detailInfo.rewards}
                        tokenInfo={tokenInfo}
                        protocolInfo={protocolInfo}
                      />
                    </>
                  ) : (
                    <NoAddressWarning
                      accountId={accountId}
                      networkId={networkId}
                      indexedAccountId={indexedAccountId}
                      onCreateAddress={onCreateAddress}
                    />
                  )}
                  <ProfitSection profit={detailInfo.profit} />
                  <PeriodSection timeline={detailInfo.timeline} />
                  <ProtectionSection protection={detailInfo.protection} />
                  <ProviderSection provider={detailInfo.provider} />
                  <RiskSection risk={detailInfo.risk} />
                  <FAQSection faqs={detailInfo.faqs} tokenInfo={tokenInfo} />
                </YStack>
              ) : null}
              {renderPageFooter()}
              {detailInfo ? (
                <StakingTransactionIndicator
                  accountId={earnAccount?.accountId ?? ''}
                  networkId={networkId}
                  stakeTag={protocolInfo?.stakeTag || ''}
                  historyAction={historyAction}
                  onRefresh={run}
                  onPress={onHistory}
                  shareUrl={shareUrl}
                  onShare={handleShare}
                />
              ) : null}
            </PageFrame>
          </ShareEventsContext.Provider>
        </YStack>
      </Page.Body>
    </Page>
  );
};

function ProtocolDetailsPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ProtocolDetailsPage />
    </AccountSelectorProviderMirror>
  );
}

export default ProtocolDetailsPageWithProvider;
