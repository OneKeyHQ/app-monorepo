import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

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
import { MorphoUSDCVaultAddress } from '@onekeyhq/shared/src/consts/addresses';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import {
  EEarnLabels,
  type IEarnPortfolioAirdropAsset,
  type IEarnPortfolioInvestment,
  type IEarnText,
} from '@onekeyhq/shared/types/staking';

import { useCurrency } from '../../../components/Currency';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { PendingIndicator } from '../../Staking/components/StakingActivityIndicator';
import { buildLocalTxStatusSyncId } from '../../Staking/utils/utils';
import { EarnNavigation } from '../earnUtils';
import { usePortfolioAction } from '../hooks/usePortfolioAction';
import { useStakingPendingTxsByInfo } from '../hooks/useStakingPendingTxs';

import type {
  IRefreshOptions,
  IUseEarnPortfolioReturn,
} from '../hooks/useEarnPortfolio';
import type { IStakePendingTx } from '../hooks/useStakingPendingTxs';

const useIsDesktopLayout = () => {
  const media = useMedia();
  return !platformEnv.isNative && media.gtSm;
};

type IPortfolioPendingTxsContext = {
  onRefresh?: (options?: IRefreshOptions) => Promise<void>;
};

const PortfolioPendingTxsContext = createContext<IPortfolioPendingTxsContext>({
  onRefresh: async () => {},
});

const PortfolioPendingTxsProvider = ({
  value,
  children,
}: {
  value: IPortfolioPendingTxsContext;
  children: React.ReactNode;
}) => (
  <PortfolioPendingTxsContext.Provider value={value}>
    {children}
  </PortfolioPendingTxsContext.Provider>
);

const usePortfolioPendingTxs = () => useContext(PortfolioPendingTxsContext);

const WrappedActionButtonCmp = ({
  asset,
  reward,
  stakedSymbol,
  rewardSymbol,
  stakedVault,
}: {
  asset:
    | IEarnPortfolioInvestment['assets'][number]
    | IEarnPortfolioInvestment['airdropAssets'][number];
  reward:
    | IEarnPortfolioInvestment['assets'][number]['rewardAssets'][number]
    | IEarnPortfolioInvestment['airdropAssets'][number]['airdropAssets'][number];
  stakedSymbol?: string;
  rewardSymbol?: string;
  stakedVault?: string;
}) => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const { onRefresh } = usePortfolioPendingTxs();
  const handleActionSuccess = useCallback(async () => {
    void onRefresh?.({
      provider: asset.metadata.protocol.providerDetail.code,
    });
  }, [onRefresh, asset.metadata.protocol.providerDetail.code]);

  // For staking config lookup, use:
  // - stakedSymbol for airdrops (the token that was staked to earn rewards)
  // - asset.token.info.symbol for normal claims (the staked token itself)
  let symbolForConfig = stakedSymbol || asset.token.info.symbol;
  let vaultForConfig = stakedVault || asset.metadata.protocol.vault;
  if (
    earnUtils.isMorphoProvider({
      providerName: asset.metadata.protocol.providerDetail.code,
    })
  ) {
    symbolForConfig = 'USDC';
    vaultForConfig = MorphoUSDCVaultAddress;
  }

  const stakeTag = buildLocalTxStatusSyncId({
    providerName: asset.metadata.protocol.providerDetail.code,
    tokenSymbol: symbolForConfig,
  });

  const pendingTxsFilter = useCallback(
    (tx: IStakePendingTx) => {
      return (
        [EEarnLabels.Claim].includes(tx.stakingInfo.label) &&
        tx.stakingInfo.tags?.includes(stakeTag)
      );
    },
    [stakeTag],
  );
  const { filteredTxs: pendingTxs = [] } = useStakingPendingTxsByInfo({
    filter: pendingTxsFilter,
  });
  const isPending = useMemo(() => {
    return pendingTxs.length > 0;
  }, [pendingTxs]);
  const previousIsPendingRef = useRef(isPending);

  useEffect(() => {
    if (previousIsPendingRef.current && !isPending) {
      void handleActionSuccess();
    }
    previousIsPendingRef.current = isPending;
  }, [isPending, handleActionSuccess]);

  const { loading, handleAction } = usePortfolioAction({
    accountId: account?.id || '',
    networkId: asset.metadata.network.networkId,
    indexedAccountId: indexedAccount?.id,
    symbol: symbolForConfig,
    provider: asset.metadata.protocol.providerDetail.code,
    vault: vaultForConfig,
    providerLogoURI: asset.metadata.protocol.providerDetail.logoURI,
    stakeTag,
    onSuccess: handleActionSuccess,
  });

  const onPress = useCallback(() => {
    const buttonData = 'data' in reward.button ? reward.button.data : undefined;

    // For airdrop assets, also pass the reward token address from asset.token.info.address
    const rewardTokenAddress =
      'token' in asset &&
      'address' in asset.token.info &&
      asset.token.info.address
        ? asset.token.info.address
        : undefined;

    handleAction({
      actionIcon: reward.button,
      token: buttonData?.token,
      rewardTokenAddress,
      indexedAccountId: indexedAccount?.id,
      stakedSymbol,
      rewardSymbol,
    });
  }, [
    handleAction,
    reward.button,
    asset,
    indexedAccount?.id,
    stakedSymbol,
    rewardSymbol,
  ]);

  const isDesktopLayout = useIsDesktopLayout();
  if (!isDesktopLayout) {
    return (
      <Button
        ai="center"
        variant="secondary"
        size="small"
        loading={loading || isPending}
        disabled={loading || reward.button.disabled}
        cursor={reward.button.disabled ? 'not-allowed' : 'pointer'}
        onPress={onPress}
      >
        <EarnText size="$bodyMdMedium" text={reward.button.text as IEarnText} />
      </Button>
    );
  }

  return (
    <Button
      p="0"
      ai="center"
      variant="link"
      size="small"
      loading={loading || isPending}
      disabled={loading || reward.button.disabled}
      cursor={reward.button.disabled ? 'not-allowed' : 'pointer'}
      onPress={onPress}
    >
      <EarnText
        size="$bodyMdMedium"
        color="$textInfo"
        text={reward.button.text as IEarnText}
      />
    </Button>
  );
};

const WrappedActionButton = memo(WrappedActionButtonCmp);

const useFieldWrapperNeedPadding = (
  asset: IEarnPortfolioInvestment['assets'][number],
) => {
  return useMemo(() => !asset?.metadata?.protocol?.vaultName, [asset]);
};

const FieldWrapper = ({
  children,
  asset,
  ...rest
}: {
  children: React.ReactNode;
  asset: IEarnPortfolioInvestment['assets'][number];
} & React.ComponentProps<typeof YStack>) => {
  const needPadding = useFieldWrapperNeedPadding(asset);

  return (
    <YStack
      gap="$1"
      minHeight="$8"
      jc="flex-start"
      pt={needPadding ? '$1.5' : 0}
      {...rest}
    >
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
        tokenImageUri={asset.token.info.logoURI}
        networkImageUri={asset.metadata.network.logoURI}
      />
      <FieldWrapper ml="$3" mr="$2" flex={1} asset={asset}>
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
    <FieldWrapper asset={asset}>
      <YStack jc="center" flex={1} gap="$1">
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
  if (isEmpty(asset.assetsStatus)) {
    return (
      <FieldWrapper asset={asset}>
        <Stack flexDirection="row" ai="center" flexWrap="wrap" maxWidth="100%">
          <EarnText mr="$1" size="$bodyMdMedium" text={{ text: '-' }} />
        </Stack>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper asset={asset}>
      {asset.assetsStatus?.map((status, index) => (
        <XStack key={index} ai="center" maxWidth={200} flexWrap="wrap" gap="$2">
          <EarnText size="$bodyMdMedium" text={status.title} />
          <XStack gap="$2">
            <EarnText
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
      <FieldWrapper asset={asset}>
        <Stack flexDirection="row" ai="center" flexWrap="wrap" maxWidth="100%">
          <EarnText mr="$1" size="$bodyMdMedium" text={{ text: '-' }} />
        </Stack>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper asset={asset}>
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
          {reward?.tooltip ? (
            <XStack mr="$2">
              <EarnTooltip tooltip={reward.tooltip} />
            </XStack>
          ) : null}
          <WrappedActionButton asset={asset} reward={reward} />
        </Stack>
      ))}
    </FieldWrapper>
  );
};

const ProtocolHeader = ({
  portfolioItem,
  pendingCount,
}: {
  portfolioItem: IEarnPortfolioInvestment;
  pendingCount?: number;
}) => {
  const currencyInfo = useCurrency();

  return (
    <YStack px="$5" py="$3">
      <XStack ai="center">
        <Token
          size="xs"
          borderRadius="$2"
          mr="$2"
          tokenImageUri={portfolioItem.protocol.providerDetail.logoURI}
        />
        <SizableText size="$headingLg">
          {portfolioItem.protocol.providerDetail.name}
        </SizableText>
        <Divider bg="$headingSm" vertical mx="$3" height="$5" width="$1" />
        <XStack ai="center" gap="$1">
          <NumberSizeableText
            size="$headingLg"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{ currency: currencyInfo.symbol }}
          >
            {portfolioItem.totalFiatValue}
          </NumberSizeableText>
        </XStack>
        {pendingCount && pendingCount > 0 ? (
          <XStack ml="$2">
            <PendingIndicator num={pendingCount} />
          </XStack>
        ) : null}
      </XStack>
    </YStack>
  );
};

const ProtocolAirdrop = ({
  airdropAssets,
  stakedSymbol,
  stakedVault,
  airdropRenderMode = 'all',
}: {
  airdropAssets: IEarnPortfolioAirdropAsset[];
  stakedSymbol?: string;
  stakedVault?: string;
  airdropRenderMode?: 'firstOnly' | 'all' | 'exceptFirst';
}) => {
  const media = useMedia();
  const isDesktopLayout = useIsDesktopLayout();
  return (
    <YStack px="$5" my="$2" $gtSm={{ my: 0 }}>
      <XStack ai="center">
        {isEmpty(airdropAssets) ||
        airdropAssets?.every((airdrop) =>
          isEmpty(airdrop.airdropAssets),
        ) ? null : (
          <YStack w="100%" gap={isDesktopLayout ? '$0' : '$2'}>
            {airdropAssets?.map((airdropGroup, groupIndex) => {
              const Layout = isDesktopLayout ? XStack : YStack;

              const airdropsToRender = (() => {
                if (airdropRenderMode === 'firstOnly') {
                  return airdropGroup.airdropAssets.slice(0, 1);
                }
                if (airdropRenderMode === 'exceptFirst') {
                  return airdropGroup.airdropAssets.slice(1);
                }
                if (airdropRenderMode === 'all') {
                  return airdropGroup.airdropAssets;
                }
                return [];
              })();

              return (
                <Layout
                  key={groupIndex}
                  ai="flex-start"
                  gap="$1.5"
                  w="100%"
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
                      tokenImageUri={airdropGroup.token.info.logoURI}
                    />
                  ) : null}
                  {airdropsToRender.map((airdropReward, rewardIndex) => {
                    const showDivider =
                      rewardIndex < airdropsToRender.length - 1 && media.gtMd;

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
                            text={airdropReward.title}
                          />
                          <EarnText
                            mr="$1"
                            size="$bodyMd"
                            color="$textSubdued"
                            text={airdropReward.description}
                          />
                          <EarnTooltip tooltip={airdropReward.tooltip} />
                        </XStack>
                        <XStack ml="auto" $gtMd={{ ml: 0 }}>
                          {airdropReward.button ? (
                            <WrappedActionButton
                              asset={airdropGroup}
                              reward={airdropReward}
                              stakedSymbol={stakedSymbol}
                              stakedVault={stakedVault}
                              rewardSymbol={airdropGroup.token.info.symbol}
                            />
                          ) : null}
                        </XStack>
                        {showDivider ? (
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
                </Layout>
              );
            })}
          </YStack>
        )}
      </XStack>
    </YStack>
  );
};

const PortfolioItemComponent = ({
  portfolioItem,
  onRefresh,
}: {
  portfolioItem: IEarnPortfolioInvestment;
  onRefresh?: (options?: IRefreshOptions) => Promise<void>;
}) => {
  const intl = useIntl();
  const isDesktopLayout = useIsDesktopLayout();
  // Get provider and networkId from first asset or first airdrop asset
  const firstAsset = portfolioItem.assets[0] || portfolioItem.airdropAssets[0];

  const depositColumnLabel = useMemo(() => {
    if (firstAsset?.token?.info?.symbol?.toUpperCase() === 'USDE') {
      return intl.formatMessage({ id: ETranslations.earn_holdings });
    }

    return intl.formatMessage({ id: ETranslations.earn_deposited });
  }, [firstAsset, intl]);

  const columns: ITableColumn<IEarnPortfolioInvestment['assets'][number]>[] =
    useMemo(() => {
      return [
        {
          key: 'deposits',
          label: depositColumnLabel,
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
          label: intl.formatMessage({ id: ETranslations.earn_asset_status }),
          flex: 1,
          priority: 3,
          render: (asset) => <AssetStatusField asset={asset} />,
        },
        {
          key: 'Claimable',
          label: intl.formatMessage({ id: ETranslations.earn_claimable }),
          flex: 1,
          priority: 3,
          render: (asset) => <ActionField asset={asset} />,
        },
      ];
    }, [depositColumnLabel, intl]);

  const appNavigation = useAppNavigation();

  const handleRowPress = useCallback(
    async (asset: IEarnPortfolioInvestment['assets'][number]) => {
      await EarnNavigation.pushToEarnProtocolDetails(appNavigation, {
        networkId: asset.metadata.network.networkId,
        symbol: asset.token.info.symbol,
        provider: asset.metadata.protocol.providerDetail.code,
        vault: asset.metadata.protocol.vault,
      });
    },
    [appNavigation],
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
    <PortfolioPendingTxsProvider value={{ onRefresh }}>
      <YStack>
        <ProtocolHeader portfolioItem={portfolioItem} />
        <ProtocolAirdrop
          airdropRenderMode={isDesktopLayout ? 'all' : 'firstOnly'}
          airdropAssets={portfolioItem.airdropAssets}
          stakedSymbol={portfolioItem.assets[0]?.token.info.symbol}
          stakedVault={portfolioItem.assets[0]?.metadata.protocol.vault}
        />
        {showTable ? (
          <TableList<IEarnPortfolioInvestment['assets'][number]>
            data={portfolioItem.assets}
            keyExtractor={(asset, index) =>
              `${asset.token.info.symbol}-${
                asset.metadata.protocol.providerDetail.code
              }-${asset.metadata.network.networkId}-${
                asset.metadata.protocol.vault || 'default'
              }-${index}`
            }
            columns={columns}
            withHeader={isDesktopLayout}
            tableLayout={isDesktopLayout}
            defaultSortKey="deposits"
            defaultSortDirection="desc"
            onPressRow={handleRowPress}
            headerProps={{
              mt: '$3',
              minHeight: '$8',
            }}
            listItemProps={{
              ai: isDesktopLayout ? 'flex-start' : 'center',
              mt: isDesktopLayout ? '$2' : '$1',
            }}
            expandable={
              !isDesktopLayout
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
                            <EarnText
                              size="$bodyMdMedium"
                              text={status.title}
                            />
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
                            <WrappedActionButton
                              asset={asset}
                              reward={reward}
                            />
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
        {!isDesktopLayout ? (
          <ProtocolAirdrop
            airdropRenderMode="exceptFirst"
            airdropAssets={portfolioItem.airdropAssets}
            stakedSymbol={portfolioItem.assets[0]?.token.info.symbol}
            stakedVault={portfolioItem.assets[0]?.metadata.protocol.vault}
          />
        ) : null}
      </YStack>
    </PortfolioPendingTxsProvider>
  );
};

const PortfolioItem = memo(PortfolioItemComponent);

// Skeleton component for loading state
const PortfolioSkeletonItem = () => {
  const isDesktopLayout = useIsDesktopLayout();
  return (
    <YStack gap="$2" px="$5">
      {/* Protocol Header */}
      <XStack ai="center" gap="$1.5" mb="$1">
        <Skeleton w="$5" h="$5" borderRadius="$2" />
        <Skeleton h="$4" w={120} />
      </XStack>

      {/* Table Header - Desktop only */}
      {isDesktopLayout ? (
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
          ai={isDesktopLayout ? 'center' : 'flex-start'}
          minHeight={isDesktopLayout ? '$11' : '$14'}
        >
          {/* Token Icon + Deposit */}
          <XStack flex={isDesktopLayout ? 1.5 : 1} ai="center" gap="$3">
            <Skeleton w="$10" h="$10" borderRadius="$2" />
            <YStack gap="$1" flex={1}>
              <Skeleton h="$4" w="70%" />
              <Skeleton h="$3" w="50%" />
            </YStack>
          </XStack>

          {isDesktopLayout ? (
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

const BasePortfolioTabContent = ({
  portfolioData,
}: {
  portfolioData: IUseEarnPortfolioReturn;
}) => {
  const intl = useIntl();
  const { investments, isLoading, refresh } = portfolioData;

  const filteredInvestments = useMemo(
    () =>
      investments.filter(
        (item) =>
          !isEmpty(item.assets) ||
          item.airdropAssets.find(
            (airdrop) => !isEmpty(airdrop.airdropAssets),
          ) != null,
      ),
    [investments],
  );
  const noAssets = useMemo(
    () => isEmpty(filteredInvestments),
    [filteredInvestments],
  );

  const investmentsItemRender = useCallback(
    (item: IEarnPortfolioInvestment, index: number) => {
      const showDivider = index !== 0 && filteredInvestments.length > 1;
      const key = `${item.protocol.providerDetail.code}_${
        item.protocol.vaultName || ''
      }_${item.network.networkId}`;

      return (
        <>
          {showDivider ? <Divider my="$4" mx="$5" /> : null}
          <PortfolioItem key={key} portfolioItem={item} onRefresh={refresh} />
        </>
      );
    },
    [filteredInvestments.length, refresh],
  );

  const showSkeleton = isLoading && noAssets;

  // Show skeleton while loading initial data
  if (showSkeleton) {
    return <PortfolioSkeleton />;
  }

  // Show empty state when no investments
  if (noAssets) {
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

  return <YStack>{filteredInvestments.map(investmentsItemRender)}</YStack>;
};

export const PortfolioTabContent = memo(BasePortfolioTabContent);
