import { memo, useCallback, useEffect, useMemo } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Empty,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { NumberSizeableText } from '@onekeyhq/components/src/content/NumberSizeableText';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalRoutes,
  EModalStakingRoutes,
  ERootRoutes,
  ETabEarnRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IEarnPortfolioInvestment,
  IEarnText,
  IEarnToken,
} from '@onekeyhq/shared/types/staking';

import { useCurrency } from '../../../components/Currency';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { buildLocalTxStatusSyncId } from '../../Staking/utils/utils';
import { useEarnPortfolio } from '../hooks/useEarnPortfolio';
import { usePortfolioAction } from '../hooks/usePortfolioAction';

import type { IUseEarnPortfolioReturn } from '../hooks/useEarnPortfolio';

const WrappedActionButton = ({
  asset,
  reward,
  stakedSymbol,
  rewardSymbol,
}: {
  asset:
    | IEarnPortfolioInvestment['assets'][number]
    | IEarnPortfolioInvestment['airdropAssets'][number];
  reward:
    | IEarnPortfolioInvestment['assets'][number]['rewardAssets'][number]
    | IEarnPortfolioInvestment['airdropAssets'][number]['airdropAssets'][number];
  stakedSymbol?: string;
  rewardSymbol?: string;
}) => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;

  // For staking config lookup, use:
  // - stakedSymbol for airdrops (the token that was staked to earn rewards)
  // - asset.token.info.symbol for normal claims (the staked token itself)
  const symbolForConfig = stakedSymbol || asset.token.info.symbol;

  const { loading, handleAction } = usePortfolioAction({
    accountId: account?.id || '',
    networkId: asset.metadata.network.networkId,
    indexedAccountId: indexedAccount?.id,
    symbol: symbolForConfig,
    provider: asset.metadata.protocol.providerDetail.code,
    vault: asset.metadata.protocol.vault,
    providerLogoURI: asset.metadata.protocol.providerDetail.logoURI,
    stakeTag: buildLocalTxStatusSyncId({
      providerName: asset.metadata.protocol.providerDetail.code,
      tokenSymbol: symbolForConfig,
    }),
  });

  return (
    <Button
      p="0"
      ai="center"
      variant="link"
      size="small"
      loading={loading}
      disabled={loading || reward.button.disabled}
      cursor={reward.button.disabled ? 'not-allowed' : 'pointer'}
      onPress={() => {
        const buttonData =
          'data' in reward.button ? reward.button.data : undefined;

        // For airdrop assets, also pass the reward token address from asset.token.info.address
        const rewardTokenAddress =
          'token' in asset &&
          'address' in asset.token.info &&
          asset.token.info.address
            ? asset.token.info.address
            : undefined;

        handleAction({
          actionIcon: reward.button,
          token:
            'info' in (buttonData?.token || {})
              ? (buttonData?.token as { info: IEarnToken }).info
              : (buttonData?.token as IEarnToken),
          rewardTokenAddress,
          indexedAccountId: indexedAccount?.id,
          stakedSymbol,
          rewardSymbol,
        });
      }}
    >
      <EarnText
        size="$bodyMdMedium"
        color="$textInfo"
        text={reward.button.text as IEarnText}
      />
    </Button>
  );
};

const FieldWrapper = ({
  children,
  ...rest
}: { children: React.ReactNode } & React.ComponentProps<typeof YStack>) => {
  return (
    <YStack gap="$1" minHeight="$8" {...rest}>
      {children}
    </YStack>
  );
};

const DepositField = ({
  asset,
}: {
  asset: IEarnPortfolioInvestment['assets'][number];
}) => {
  return (
    <XStack ai="center" flex={1}>
      <Token
        size="md"
        borderRadius="$2"
        tokenImageUri={asset.token.info.logoURI}
        networkImageUri={asset.metadata.network.logoURI}
      />
      <FieldWrapper ml="$3" mr="$2" jc="center" flex={1}>
        <XStack gap="$1" maxWidth={200} flexWrap="wrap">
          <EarnText size="$bodyMdMedium" text={asset.deposit?.title} />
          <EarnText
            size="$bodyMdMedium"
            color="$textSubdued"
            text={asset.deposit?.description}
          />
        </XStack>
        {asset.metadata.protocol.vaultName ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {asset.metadata.protocol.vaultName}
          </SizableText>
        ) : null}
      </FieldWrapper>
    </XStack>
  );
};

const EarningsField = ({
  asset,
}: {
  asset: IEarnPortfolioInvestment['assets'][number];
}) => {
  return (
    <FieldWrapper>
      <YStack ml="$3" mr="$2" jc="center" flex={1}>
        <EarnText size="$bodyMdMedium" text={asset.earnings24h?.title} />
        <XStack gap="$1">
          <EarnText
            size="$bodySm"
            color="$textSubdued"
            text={asset?.totalReward?.title}
          />
          <EarnText
            size="$bodySm"
            color="$textSubdued"
            text={asset?.totalReward?.description}
          />
        </XStack>
      </YStack>
    </FieldWrapper>
  );
};

const AssetStatusField = ({
  asset,
}: {
  asset: IEarnPortfolioInvestment['assets'][number];
}) => {
  return (
    <FieldWrapper jc="center">
      {asset.assetsStatus?.map((status, index) => (
        <XStack key={index} ai="center" maxWidth={200} flexWrap="wrap">
          <EarnText mr="$2" size="$bodyMdMedium" text={status.title} />
          <XStack>
            <EarnText
              mr="$2"
              size="$bodyMd"
              color="$textSubdued"
              text={status.description}
            />
            <EarnTooltip tooltip={status.tooltip} />
          </XStack>
        </XStack>
      ))}
    </FieldWrapper>
  );
};

const ActionField = ({
  asset,
}: {
  asset: IEarnPortfolioInvestment['assets'][number];
}) => {
  if (isEmpty(asset.rewardAssets)) {
    return (
      <FieldWrapper jc="center">
        <Stack flexDirection="row" ai="center" flexWrap="wrap" maxWidth="100%">
          <EarnText mr="$1" size="$bodyMdMedium" text={{ text: '-' }} />
        </Stack>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper jc="center">
      {asset.rewardAssets?.map((reward, index) => (
        <Stack
          key={index}
          flexDirection="row"
          ai="center"
          flexWrap="wrap"
          maxWidth="100%"
        >
          <EarnText
            mr="$1"
            size="$bodyMdMedium"
            text={reward.title ?? { text: '-' }}
          />
          <EarnText
            mr="$2"
            size="$bodyMd"
            color="$textSubdued"
            text={reward.description}
          />
          <WrappedActionButton asset={asset} reward={reward} />
        </Stack>
      ))}
    </FieldWrapper>
  );
};

const ProtocolHeader = ({
  portfolioItem,
}: {
  portfolioItem: IEarnPortfolioInvestment;
}) => {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const media = useMedia();

  return (
    <YStack mb="$1" px="$5">
      <XStack ai="center" gap="$1.5">
        <Token
          size="xs"
          borderRadius="$2"
          tokenImageUri={portfolioItem.protocol.providerDetail.logoURI}
        />
        <SizableText size="$headingSm">
          {portfolioItem.protocol.providerDetail.name}
        </SizableText>
        <Divider
          bg="$headingSm"
          vertical
          ml="$3"
          mr="$1.5"
          height="$5"
          width="$1"
        />
        <XStack ai="center" gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.earn_total_staked_value })}
          </SizableText>
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="marketCap"
            formatterOptions={{ currency: currencyInfo.symbol }}
          >
            {portfolioItem.totalFiatValue}
          </NumberSizeableText>
        </XStack>
      </XStack>
      {isEmpty(portfolioItem.airdropAssets) ||
      portfolioItem.airdropAssets?.every((airdrop) =>
        isEmpty(airdrop.airdropAssets),
      ) ? null : (
        <YStack mb="$2" mt="$5">
          {portfolioItem.airdropAssets?.map((airdrop, index) => {
            // Skip if this airdrop has no airdropAssets
            if (isEmpty(airdrop.airdropAssets)) {
              return null;
            }

            // For airdrops, we need the staked token symbol to look up staking config
            // Use the first staked asset's symbol from the same protocol
            const stakedSymbol = portfolioItem.assets[0]?.token.info.symbol;
            const Wrapper = media.gtSm ? XStack : YStack;

            return (
              <Wrapper
                key={index}
                ai="flex-start"
                gap="$1.5"
                $gtMd={{
                  ai: 'center',
                  minHeight: '$9',
                  gap: '$2.5',
                }}
              >
                {media.gtMd ? (
                  <Token
                    size="xs"
                    borderRadius="$2"
                    tokenImageUri={airdrop.token.info.logoURI}
                  />
                ) : null}
                {airdrop.airdropAssets.map((reward, rewardIndex) => {
                  const needDivider =
                    rewardIndex < airdrop.airdropAssets.length - 1 &&
                    media.gtMd;

                  return (
                    <XStack
                      key={rewardIndex}
                      ai="center"
                      w="100%"
                      $gtMd={{
                        h: '$9',
                        w: 'auto',
                      }}
                    >
                      <XStack>
                        <EarnText
                          mr="$1"
                          size="$bodyMdMedium"
                          text={reward.title}
                        />
                        <EarnText
                          mr="$1"
                          size="$bodyMd"
                          color="$textSubdued"
                          text={reward.description}
                        />
                        <EarnTooltip tooltip={reward.tooltip} />
                      </XStack>
                      <XStack ml="auto" $gtMd={{ ml: 0 }}>
                        {reward.button ? (
                          <WrappedActionButton
                            asset={airdrop}
                            reward={reward}
                            stakedSymbol={stakedSymbol}
                            rewardSymbol={airdrop.token.info.symbol}
                          />
                        ) : null}
                      </XStack>
                      {needDivider ? (
                        <Divider
                          bg="$borderSubdued"
                          vertical
                          ml="$3"
                          mr="$0.5"
                          height="$5"
                          width="$1"
                        />
                      ) : null}
                    </XStack>
                  );
                })}
              </Wrapper>
            );
          })}
        </YStack>
      )}
    </YStack>
  );
};

const PortfolioItemComponent = ({
  portfolioItem,
}: {
  portfolioItem: IEarnPortfolioInvestment;
}) => {
  const intl = useIntl();
  const media = useMedia();

  const columns: ITableColumn<IEarnPortfolioInvestment['assets'][number]>[] =
    useMemo(() => {
      return [
        {
          key: 'deposits',
          label: intl.formatMessage({ id: ETranslations.earn_deposited }),
          flex: 1.5,
          priority: 5,
          render: (asset) => <DepositField asset={asset} />,
        },
        {
          key: 'Est. 24h earnings',
          label: intl.formatMessage({ id: ETranslations.earn_24h_earnings }),
          flex: 1,
          priority: 1,
          render: (asset) => <EarningsField asset={asset} />,
        },
        {
          key: 'Asset status',
          label: intl.formatMessage({ id: ETranslations.global_status }),
          flex: 1.5,
          priority: 3,
          render: (asset) => <AssetStatusField asset={asset} />,
        },
        {
          key: 'Claimable',
          label: intl.formatMessage({ id: ETranslations.earn_claimable }),
          flex: 1.5,
          priority: 3,
          render: (asset) => <ActionField asset={asset} />,
        },
      ];
    }, [intl]);

  const appNavigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;

  const handleRowPress = useCallback(
    async (asset: IEarnPortfolioInvestment['assets'][number]) => {
      const symbol = asset.token.info.symbol;
      appNavigation.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.Earn,
        params: {
          screen: ETabEarnRoutes.EarnProtocolDetails,
          params: {
            indexedAccountId: indexedAccount?.id,
            accountId: account?.id,
            networkId: asset.metadata.network.networkId,
            symbol,
            provider: asset.metadata.protocol.providerDetail.code,
            vault: asset.metadata.protocol.vault,
          },
        },
      });
    },
    [appNavigation, account?.id, indexedAccount?.id],
  );

  const handleManagePress = useCallback(
    async (asset: IEarnPortfolioInvestment['assets'][number]) => {
      const symbol = asset.token.info.symbol;

      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.ManagePosition,
        params: {
          networkId: asset.metadata.network.networkId,
          symbol,
          provider: asset.metadata.protocol.providerDetail.code,
          vault: asset.metadata.protocol.vault,
          tokenImageUri: asset.token.info.logoURI,
        },
      });
    },
    [appNavigation],
  );

  const showTable = useMemo(
    () => !isEmpty(portfolioItem.assets),
    [portfolioItem.assets],
  );

  return (
    <YStack>
      <ProtocolHeader portfolioItem={portfolioItem} />
      {showTable ? (
        <TableList<IEarnPortfolioInvestment['assets'][number]>
          data={portfolioItem.assets}
          columns={columns}
          withHeader={media.gtSm}
          tableLayout
          defaultSortKey="deposits"
          defaultSortDirection="desc"
          onPressRow={handleRowPress}
          expandable={
            !media.gtSm
              ? {
                  renderExpandedContent: (asset) => (
                    <YStack gap="$5">
                      {/* Est. 24h earnings */}
                      <XStack ai="center" gap="$1">
                        <EarnText
                          size="$bodyLgMedium"
                          text={asset.earnings24h?.title}
                        />
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {intl.formatMessage({
                            id: ETranslations.earn_24h_earnings,
                          })}
                        </SizableText>
                      </XStack>

                      {/* Asset status list */}
                      {asset.assetsStatus?.map((status, index) => (
                        <XStack key={index} ai="center">
                          <EarnText size="$bodyMdMedium" text={status.title} />
                          <XStack gap="$1.5">
                            <EarnText
                              ml="$2"
                              size="$bodyMd"
                              color="$textSubdued"
                              text={status.description}
                            />
                            <EarnTooltip tooltip={status.tooltip} />
                          </XStack>
                        </XStack>
                      ))}

                      {/* Reward assets (claimable rewards) */}
                      {asset.rewardAssets?.map((reward, index) => (
                        <XStack key={index} ai="center" jc="space-between">
                          <XStack ai="center" gap="$2">
                            <EarnText
                              size="$bodyMdMedium"
                              text={reward.title}
                            />
                            <EarnText
                              size="$bodyMd"
                              color="$textSubdued"
                              text={reward.description}
                            />
                            <EarnTooltip tooltip={reward.tooltip} />
                          </XStack>
                          <WrappedActionButton asset={asset} reward={reward} />
                        </XStack>
                      ))}

                      {/* Buttons */}
                      <XStack gap="$3">
                        <Button
                          flex={1}
                          size="medium"
                          variant="secondary"
                          onPress={async () => {
                            await handleManagePress(asset);
                          }}
                        >
                          {intl.formatMessage({
                            id: ETranslations.global_manage,
                          })}
                        </Button>
                        <Button
                          flex={1}
                          size="medium"
                          variant="secondary"
                          onPress={async () => {
                            await handleRowPress(asset);
                          }}
                        >
                          {intl.formatMessage({
                            id: ETranslations.global_details,
                          })}
                        </Button>
                      </XStack>
                    </YStack>
                  ),
                }
              : undefined
          }
          actions={{
            render: (asset) => {
              return (
                <Stack gap="$2">
                  {asset.buttons?.map(
                    (
                      button: {
                        type: string;
                        text: { text: string };
                        disabled: boolean;
                      },
                      index: number,
                    ) => {
                      return (
                        <Button
                          key={index}
                          size="small"
                          disabled={button?.disabled}
                          variant="secondary"
                          onPress={async () => {
                            if (button?.type === 'manage') {
                              await handleManagePress(asset);
                            }
                          }}
                        >
                          {button.text?.text}
                        </Button>
                      );
                    },
                  )}
                </Stack>
              );
            },
            width: 100,
            align: 'flex-end',
          }}
        />
      ) : null}
    </YStack>
  );
};

const PortfolioItem = memo(PortfolioItemComponent);

// Skeleton component for loading state
const PortfolioSkeletonItem = () => {
  const media = useMedia();

  return (
    <YStack gap="$2" px="$5">
      {/* Protocol Header */}
      <XStack ai="center" gap="$1.5" mb="$1">
        <Skeleton w="$5" h="$5" borderRadius="$2" />
        <Skeleton h="$4" w={120} />
      </XStack>

      {/* Table Header - Desktop only */}
      {media.gtSm ? (
        <XStack gap="$3" px="$3" py="$2">
          <XStack flex={1.5}>
            <Skeleton h="$3" w={80} />
          </XStack>
          <XStack flex={1}>
            <Skeleton h="$3" w={100} />
          </XStack>
          <XStack flex={1.5}>
            <Skeleton h="$3" w={60} />
          </XStack>
          <XStack flex={1.5}>
            <Skeleton h="$3" w={80} />
          </XStack>
          <XStack w={100} />
        </XStack>
      ) : null}

      {/* Table Rows */}
      {Array.from({ length: 2 }).map((_, index) => (
        <XStack
          key={index}
          gap="$3"
          px="$3"
          py="$2"
          ai={media.gtSm ? 'center' : 'flex-start'}
          minHeight={media.gtSm ? '$11' : '$14'}
        >
          {/* Token Icon + Deposit */}
          <XStack flex={media.gtSm ? 1.5 : 1} ai="center" gap="$3">
            <Skeleton w="$10" h="$10" borderRadius="$2" />
            <YStack gap="$1" flex={1}>
              <Skeleton h="$4" w="70%" />
              <Skeleton h="$3" w="50%" />
            </YStack>
          </XStack>

          {media.gtSm ? (
            <>
              {/* 24h Earnings */}
              <YStack flex={1} gap="$1">
                <Skeleton h="$4" w="60%" />
                <Skeleton h="$3" w="40%" />
              </YStack>
              {/* Status */}
              <YStack flex={1.5} gap="$1">
                <Skeleton h="$4" w="80%" />
                <Skeleton h="$3" w="50%" />
              </YStack>
              {/* Claimable */}
              <YStack flex={1.5} gap="$1">
                <Skeleton h="$4" w="70%" />
              </YStack>
              {/* Actions */}
              <XStack w={100} jc="flex-end">
                <Skeleton w="$20" h="$8" borderRadius="$2" />
              </XStack>
            </>
          ) : null}
        </XStack>
      ))}
    </YStack>
  );
};

const PortfolioSkeleton = () => (
  <YStack gap="$4">
    <PortfolioSkeletonItem />
    <Divider mx="$5" />
    <PortfolioSkeletonItem />
  </YStack>
);

export const PortfolioTabContent = ({
  portfolioData,
}: {
  portfolioData: IUseEarnPortfolioReturn;
}) => {
  const intl = useIntl();
  const { investments, isLoading, refresh } = portfolioData;

  const refreshPortfolioRow = useCallback<
    (payload: {
      provider: string;
      symbol: string;
      networkId: string;
      rewardSymbol?: string;
    }) => void
  >(
    (payload) => {
      if (!payload?.provider || !payload?.symbol || !payload?.networkId) {
        return;
      }
      // Add delay to allow backend data to update after order success
      void timerUtils.wait(350).then(() => {
        void refresh({
          provider: payload.provider,
          symbol: payload.symbol,
          networkId: payload.networkId,
          rewardSymbol: payload.rewardSymbol,
        });
      });
    },
    [refresh],
  );

  useEffect(() => {
    const handler = (payload: {
      provider: string;
      symbol: string;
      networkId: string;
      rewardSymbol?: string;
    }) => {
      refreshPortfolioRow(payload);
    };
    const fullRefreshHandler = () => {
      void refresh();
    };
    appEventBus.on(EAppEventBusNames.RefreshEarnPortfolioItem, handler);
    appEventBus.on(EAppEventBusNames.RefreshEarnPortfolio, fullRefreshHandler);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshEarnPortfolioItem, handler);
      appEventBus.off(
        EAppEventBusNames.RefreshEarnPortfolio,
        fullRefreshHandler,
      );
    };
  }, [refreshPortfolioRow, refresh]);

  const showEmpty =
    !isLoading &&
    (investments.length === 0 ||
      investments.every(
        (item) =>
          isEmpty(item.assets) &&
          item.airdropAssets.find(
            (airdrop) => !isEmpty(airdrop.airdropAssets),
          ) == null,
      ));

  const showSkeleton = isLoading;

  // Show skeleton while loading initial data
  if (showSkeleton) {
    return <PortfolioSkeleton />;
  }

  // Show empty state when no investments
  if (showEmpty) {
    return (
      <Empty
        icon="ClockTimeHistoryOutline"
        title={intl.formatMessage({
          id: ETranslations.earn_no_assets_deposited,
        })}
        description={intl.formatMessage({
          id: ETranslations.earn_no_orders_desc,
        })}
      />
    );
  }

  return (
    <YStack>
      {investments.map((item, index) => {
        if (
          isEmpty(item.assets) &&
          item.airdropAssets.find(
            (airdrop) => !isEmpty(airdrop.airdropAssets),
          ) == null
        ) {
          return null;
        }

        const showDivider = index !== 0 && investments.length > 1;
        const key = `${item.protocol.providerDetail.code}_${
          item.protocol.vaultName || ''
        }_${item.network.networkId}`;

        return (
          <>
            {showDivider ? <Divider my="$4" mx="$5" /> : null}
            <PortfolioItem key={key} portfolioItem={item} />
          </>
        );
      })}
    </YStack>
  );
};
