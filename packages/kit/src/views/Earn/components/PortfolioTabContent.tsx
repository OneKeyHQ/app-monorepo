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
  type IEarnActionIcon,
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

type IPortfolioAssetStatusItem =
  IEarnPortfolioInvestment['assets'][number]['assetsStatus'][number];
type IPortfolioActionableAssetStatusItem = Omit<
  IPortfolioAssetStatusItem,
  'button'
> & {
  button: IEarnActionIcon;
};
type IWrappedActionReward =
  | IEarnPortfolioInvestment['assets'][number]['rewardAssets'][number]
  | IEarnPortfolioInvestment['airdropAssets'][number]['airdropAssets'][number]
  | IPortfolioActionableAssetStatusItem;
type IWrappedActionButton = IWrappedActionReward['button'];

const toActionableAssetStatusItem = (
  status: IPortfolioAssetStatusItem,
): IPortfolioActionableAssetStatusItem | undefined => {
  if (!status.button) {
    return undefined;
  }

  return {
    ...status,
    button: status.button,
  };
};

const getRewardButtonToken = (button: IWrappedActionButton) => {
  if (!('data' in button) || !button.data || !('token' in button.data)) {
    return undefined;
  }

  return button.data.token;
};

const getRewardButtonDisabled = (button: IWrappedActionButton) => {
  return 'disabled' in button ? button.disabled : undefined;
};

const getRewardButtonText = (
  button: IWrappedActionButton,
): IEarnText | undefined => {
  if (!('text' in button) || !button.text) {
    return undefined;
  }

  return typeof button.text === 'string' ? { text: button.text } : button.text;
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
  reward: IWrappedActionReward;
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
  const providerName = asset?.metadata?.protocol?.providerDetail?.code;
  const isMorphoProvider = earnUtils.isMorphoProvider({
    providerName,
  });
  const isPendleProvider = earnUtils.isPendleProvider({
    providerName,
  });

  // Default airdrop claims reuse the source position's symbol/vault, but some
  // providers expose rewards as their own backend asset (for example Pendle's
  // Ethena unstake claim), so we normalize those separately below.
  let symbolForConfig = stakedSymbol || asset.token.info.symbol;
  let vaultForConfig = stakedVault || asset.metadata.protocol.vault;
  if (isMorphoProvider) {
    symbolForConfig = 'USDC';
    vaultForConfig = MorphoUSDCVaultAddress;
  } else if (isPendleProvider) {
    // Pendle Ethena-unstake rewards have their own protocol identity on the
    // backend, so don't reuse the original staked position's symbol/vault.
    symbolForConfig = asset.token.info.symbol;
    vaultForConfig = asset.metadata.protocol.vault;
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
    // Only Morpho reward claims need the backend reward token selector.
    const rewardTokenAddress =
      isMorphoProvider &&
      'token' in asset &&
      'address' in asset.token.info &&
      asset.token.info.address
        ? asset.token.info.address
        : undefined;

    handleAction({
      actionIcon: reward.button,
      token: getRewardButtonToken(reward.button),
      rewardTokenAddress,
      indexedAccountId: indexedAccount?.id,
      stakedSymbol,
      rewardSymbol,
    });
  }, [
    handleAction,
    reward.button,
    asset,
    isMorphoProvider,
    indexedAccount?.id,
    stakedSymbol,
    rewardSymbol,
  ]);
  const isDesktopLayout = useIsDesktopLayout();

  const buttonDisabled = getRewardButtonDisabled(reward.button);
  const buttonText = getRewardButtonText(reward.button);

  if (!buttonText) {
    return null;
  }
  if (!isDesktopLayout) {
    return (
      <Button
        ai="center"
        variant="secondary"
        size="small"
        loading={loading || isPending}
        disabled={loading || buttonDisabled}
        cursor={buttonDisabled ? 'not-allowed' : 'pointer'}
        onPress={onPress}
      >
        <EarnText size="$bodyMdMedium" text={buttonText} />
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
      disabled={loading || buttonDisabled}
      cursor={buttonDisabled ? 'not-allowed' : 'pointer'}
      onPress={onPress}
    >
      <EarnText size="$bodyMdMedium" color="$textInfo" text={buttonText} />
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
            size="$bodySm"
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
  const netPnl = asset.metadata?.netPnl;
  const netPnlFiatValue = asset.metadata?.netPnlFiatValue;
  const secondLine = useMemo(() => {
    if (netPnl) {
      return null;
    }
    if (asset?.totalReward) {
      return (
        <XStack gap="$1">
          <EarnText
            size="$bodySm"
            color="$textSubdued"
            text={asset.totalReward.title}
          />
          <EarnText
            size="$bodySm"
            color="$textSubdued"
            text={asset.totalReward.description}
          />
        </XStack>
      );
    }
    return null;
  }, [netPnl, asset?.totalReward]);

  if (netPnl) {
    return (
      <FieldWrapper asset={asset}>
        <YStack jc="center" flex={1} gap="$1">
          <EarnText size="$bodyMdMedium" text={netPnlFiatValue} />
          <EarnText size="$bodySm" text={netPnl} />
        </YStack>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper asset={asset}>
      <YStack jc="center" flex={1} gap="$1">
        <EarnText size="$bodyMdMedium" text={asset.earnings24h?.title} />
        {secondLine}
      </YStack>
    </FieldWrapper>
  );
};

const MobilePnlSection = memo(
  ({ asset }: { asset: IEarnPortfolioInvestment['assets'][number] }) => {
    const intl = useIntl();
    const netPnl = asset.metadata?.netPnl;
    const netPnlFiatValue = asset.metadata?.netPnlFiatValue;
    if (netPnl) {
      return (
        <XStack ai="center" gap="$1">
          <EarnText size="$bodySm" text={netPnlFiatValue} />
          <EarnText size="$bodySm" text={netPnl} />
        </XStack>
      );
    }
    if (asset.totalReward) {
      return (
        <XStack ai="center" gap="$1">
          <EarnText
            size="$bodySm"
            color="$textSubdued"
            text={asset.totalReward.description}
          />
          <EarnText
            size="$bodySm"
            color="$textSubdued"
            text={{
              text: intl.formatMessage({
                id: ETranslations.earn_referral_total_earned,
              }),
            }}
          />
        </XStack>
      );
    }
    return null;
  },
);
MobilePnlSection.displayName = 'MobilePnlSection';

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
      {asset.assetsStatus?.map((status, index) => {
        const actionableStatus = toActionableAssetStatusItem(status);

        return (
          <XStack
            key={index}
            ai="center"
            maxWidth={200}
            flexWrap="wrap"
            gap="$2"
          >
            <EarnText size="$bodyMdMedium" text={status.title} />
            <XStack gap="$2">
              <EarnText
                size="$bodyMd"
                color="$textSubdued"
                text={status.description}
              />
              <EarnTooltip tooltip={status.tooltip} />
            </XStack>
            {actionableStatus ? (
              <WrappedActionButton asset={asset} reward={actionableStatus} />
            ) : null}
          </XStack>
        );
      })}
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

const PositionValueField = ({ totalFiatValue }: { totalFiatValue: string }) => {
  const currencyInfo = useCurrency();
  return (
    <NumberSizeableText
      size="$bodyMdMedium"
      formatter="value"
      formatterOptions={{ currency: currencyInfo.symbol }}
    >
      {totalFiatValue}
    </NumberSizeableText>
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
    <YStack px="$pagePadding" py="$3">
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

type IAirdropRewardItem = IEarnPortfolioAirdropAsset['airdropAssets'][number];
type IAirdropRewardPair = {
  primary: IAirdropRewardItem;
  secondary?: IAirdropRewardItem;
};

const buildRewardPairs = (items: IAirdropRewardItem[]) => {
  const pairs: IAirdropRewardPair[] = [];
  for (let index = 0; index < items.length; index += 2) {
    pairs.push({ primary: items[index], secondary: items[index + 1] });
  }
  return pairs;
};

const ProtocolAirdrop = ({
  airdropAssets,
  stakedSymbol,
  stakedVault,
  isPendle,
}: {
  airdropAssets: IEarnPortfolioAirdropAsset[];
  stakedSymbol?: string;
  stakedVault?: string;
  isPendle?: boolean;
}) => {
  const intl = useIntl();
  const isDesktopLayout = useIsDesktopLayout();
  const rows = airdropAssets.flatMap((airdropGroup, groupIndex) => {
    const items = airdropGroup.airdropAssets ?? [];
    if (items.length === 0) {
      return [];
    }
    return buildRewardPairs(items).map((pair, pairIndex) => ({
      key: `${groupIndex}-${pairIndex}`,
      pair,
      group: airdropGroup,
    }));
  });

  if (rows.length === 0) {
    return null;
  }

  const title = intl.formatMessage({
    id: isPendle
      ? ETranslations.defi_unstaking_via_ethena
      : ETranslations.defi_claimable_protocol_rewards,
  });
  const rowMinHeight = 38;
  const primaryTextSize = '$bodyMdMedium';
  const secondaryTextSize = isDesktopLayout ? '$bodyMd' : '$bodyMdMedium';

  return (
    <YStack px="$pagePadding" mt="$8" gap="$4">
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {title}
      </SizableText>
      <YStack w="100%" gap="$4">
        {rows.map(({ key, pair, group }) => {
          const primaryTitle = pair.primary?.title;
          const primaryDescription = pair.primary?.description;
          const hasSecondary = Boolean(pair.secondary);
          const secondaryDescription =
            pair.secondary?.title ?? pair.secondary?.description;
          const tooltip = pair.secondary?.tooltip ?? pair.primary?.tooltip;
          const actionReward = pair.primary?.button
            ? pair.primary
            : pair.secondary;
          const actionButtonNode = actionReward?.button ? (
            <WrappedActionButton
              asset={group}
              reward={actionReward}
              stakedSymbol={stakedSymbol}
              stakedVault={stakedVault}
              rewardSymbol={group.token.info.symbol}
            />
          ) : null;

          if (!isDesktopLayout) {
            return (
              <XStack
                key={key}
                w="100%"
                minHeight={rowMinHeight}
                gap="$3"
                ai="center"
              >
                <Token
                  size="md"
                  tokenImageUri={group.token.info.logoURI}
                  showNetworkIcon
                  networkId={group.metadata?.network?.networkId}
                />
                <YStack flex={1} gap="$0.5">
                  <XStack ai="center" jc="space-between" gap="$2">
                    <XStack ai="center" gap="$1" flexWrap="wrap" flex={1}>
                      {primaryTitle ? (
                        <EarnText size={primaryTextSize} text={primaryTitle} />
                      ) : null}
                      {primaryDescription ? (
                        <EarnText
                          size={primaryTextSize}
                          color="$textSubdued"
                          text={primaryDescription}
                        />
                      ) : null}
                    </XStack>
                    {actionButtonNode}
                  </XStack>
                  {secondaryDescription || tooltip ? (
                    <XStack ai="center" gap="$1" flexWrap="wrap">
                      {secondaryDescription ? (
                        <EarnText
                          size={secondaryTextSize}
                          color="$textSubdued"
                          text={secondaryDescription}
                        />
                      ) : null}
                      {tooltip ? <EarnTooltip tooltip={tooltip} /> : null}
                    </XStack>
                  ) : null}
                </YStack>
              </XStack>
            );
          }

          return (
            <XStack
              key={key}
              ai="center"
              w="100%"
              minHeight={rowMinHeight}
              gap="$2"
              flexWrap="wrap"
            >
              <Token
                size="md"
                tokenImageUri={group.token.info.logoURI}
                showNetworkIcon
                networkId={group.metadata?.network?.networkId}
              />
              <XStack ai="center" gap="$1" flexWrap="wrap">
                {primaryTitle ? (
                  <EarnText size={primaryTextSize} text={primaryTitle} />
                ) : null}
                {primaryDescription ? (
                  <EarnText
                    size={primaryTextSize}
                    color="$textSubdued"
                    text={primaryDescription}
                  />
                ) : null}
              </XStack>
              {actionButtonNode}
              {hasSecondary ? <Divider vertical h="$5" mx="$1" /> : null}
              {secondaryDescription ? (
                <EarnText
                  size={secondaryTextSize}
                  color="$textSubdued"
                  text={secondaryDescription}
                />
              ) : null}
              {tooltip ? <EarnTooltip tooltip={tooltip} /> : null}
            </XStack>
          );
        })}
      </YStack>
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

  const isPendle = useMemo(
    () =>
      earnUtils.isPendleProvider({
        providerName: portfolioItem.protocol?.providerDetail?.code ?? '',
      }),
    [portfolioItem.protocol?.providerDetail?.code],
  );
  const earningsColumnLabel = useMemo(
    () =>
      intl.formatMessage({
        id: isPendle
          ? ETranslations.defi_unrealized_pnl_title
          : ETranslations.earn_24h_earnings,
      }),
    [intl, isPendle],
  );

  const columns: ITableColumn<IEarnPortfolioInvestment['assets'][number]>[] =
    useMemo(() => {
      return [
        {
          key: 'deposits',
          label: depositColumnLabel,
          flex: 1.5,
          priority: 5,
          render: (asset: IEarnPortfolioInvestment['assets'][number]) => (
            <DepositField asset={asset} />
          ),
        },
        {
          key: 'Est. 24h earnings',
          label: earningsColumnLabel,
          flex: 1,
          priority: 1,
          render: (asset: IEarnPortfolioInvestment['assets'][number]) => (
            <EarningsField asset={asset} />
          ),
        },
        {
          key: 'Asset status',
          label: intl.formatMessage({ id: ETranslations.earn_asset_status }),
          flex: 1,
          priority: 3,
          render: (asset: IEarnPortfolioInvestment['assets'][number]) => (
            <AssetStatusField asset={asset} />
          ),
        },
        isPendle
          ? {
              key: 'Position value',
              label: intl.formatMessage({
                id: ETranslations.defi_position_value,
              }),
              flex: 1,
              priority: 3,
              render: (asset: IEarnPortfolioInvestment['assets'][number]) => (
                <PositionValueField
                  totalFiatValue={
                    asset.metadata.fiatValue ?? portfolioItem.totalFiatValue
                  }
                />
              ),
            }
          : {
              key: 'Claimable',
              label: intl.formatMessage({ id: ETranslations.earn_claimable }),
              flex: 1,
              priority: 3,
              render: (asset: IEarnPortfolioInvestment['assets'][number]) => (
                <ActionField asset={asset} />
              ),
            },
      ];
    }, [
      depositColumnLabel,
      earningsColumnLabel,
      intl,
      isPendle,
      portfolioItem.totalFiatValue,
    ]);

  const appNavigation = useAppNavigation();

  const isAssetNavigationDisabled = useCallback(
    (asset: IEarnPortfolioInvestment['assets'][number]) =>
      earnUtils.isPendleProvider({
        providerName: asset.metadata.protocol.providerDetail.code,
      }) &&
      asset.metadata.protocol.symbol === 'USDe' &&
      (!asset.buttons || asset.buttons.length === 0),
    [],
  );

  const handleRowPress = useCallback(
    async (asset: IEarnPortfolioInvestment['assets'][number]) => {
      if (isAssetNavigationDisabled(asset)) {
        return;
      }
      await EarnNavigation.pushToEarnProtocolDetails(appNavigation, {
        networkId: asset.metadata.network.networkId,
        symbol: asset.token.info.symbol,
        provider: asset.metadata.protocol.providerDetail.code,
        vault: asset.metadata.protocol.vault,
      });
    },
    [appNavigation, isAssetNavigationDisabled],
  );

  const handleManagePress = useCallback(
    async (
      asset: IEarnPortfolioInvestment['assets'][number],
      defaultTab?: 'deposit' | 'withdraw',
    ) => {
      if (isAssetNavigationDisabled(asset)) {
        return;
      }
      const symbol = asset.token.info.symbol;

      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.ManagePosition,
        params: {
          networkId: asset.metadata.network.networkId,
          symbol,
          provider: asset.metadata.protocol.providerDetail.code,
          vault: asset.metadata.protocol.vault,
          tab: defaultTab,
          tokenImageUri: asset.token.info.logoURI,
        },
      });
    },
    [appNavigation, isAssetNavigationDisabled],
  );

  const showTable = useMemo(
    () => !isEmpty(portfolioItem.assets),
    [portfolioItem.assets],
  );

  return (
    <PortfolioPendingTxsProvider value={{ onRefresh }}>
      <YStack>
        <ProtocolHeader portfolioItem={portfolioItem} />
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
                        {/* Earnings / Unrealized PnL */}
                        <XStack ai="center" gap="$1">
                          {asset.metadata?.netPnl ? (
                            <>
                              <EarnText
                                size="$bodyLgMedium"
                                text={asset.metadata.netPnlFiatValue}
                              />
                              <EarnText
                                size="$bodyMd"
                                text={asset.metadata.netPnl}
                              />
                            </>
                          ) : (
                            <EarnText
                              size="$bodyLgMedium"
                              text={asset.earnings24h?.title}
                            />
                          )}
                          <SizableText size="$bodyMd" color="$textSubdued">
                            {earningsColumnLabel}
                          </SizableText>
                        </XStack>

                        {/* Asset status list */}
                        {asset.assetsStatus?.map((status, index) => {
                          const actionableStatus =
                            toActionableAssetStatusItem(status);

                          return (
                            <XStack key={index} ai="center" jc="space-between">
                              <XStack ai="center">
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
                              {actionableStatus ? (
                                <WrappedActionButton
                                  asset={asset}
                                  reward={actionableStatus}
                                />
                              ) : null}
                            </XStack>
                          );
                        })}

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

                        <MobilePnlSection asset={asset} />

                        {/* Buttons */}
                        <XStack gap="$3">
                          <Button
                            flex={1}
                            size="medium"
                            variant="secondary"
                            onPress={async () => {
                              await handleManagePress(
                                asset,
                                asset.buttons?.some(
                                  (button) => button?.type === 'redeem',
                                )
                                  ? 'withdraw'
                                  : undefined,
                              );
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
                              if (
                                button?.type === 'manage' ||
                                button?.type === 'redeem'
                              ) {
                                await handleManagePress(
                                  asset,
                                  button?.type === 'redeem'
                                    ? 'withdraw'
                                    : undefined,
                                );
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
        <ProtocolAirdrop
          airdropAssets={portfolioItem.airdropAssets}
          stakedSymbol={portfolioItem.assets[0]?.token.info.symbol}
          stakedVault={portfolioItem.assets[0]?.metadata.protocol.vault}
          isPendle={isPendle}
        />
      </YStack>
    </PortfolioPendingTxsProvider>
  );
};

const PortfolioItem = memo(PortfolioItemComponent);

// Skeleton component for loading state
const PortfolioSkeletonItem = () => {
  const isDesktopLayout = useIsDesktopLayout();
  return (
    <YStack gap="$2" px="$pagePadding">
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

interface IBasePortfolioTabContentProps {
  portfolioData: IUseEarnPortfolioReturn;
  hideSmallAssets?: boolean;
}

const BasePortfolioTabContent = ({
  portfolioData,
  hideSmallAssets = false,
}: IBasePortfolioTabContentProps) => {
  const intl = useIntl();
  const { investments, isLoading, refresh } = portfolioData;

  const filteredInvestments = useMemo(() => {
    const withAssets = investments.filter(
      (item) =>
        !isEmpty(item.assets) ||
        (item.airdropAssets.find(
          (airdrop) => !isEmpty(airdrop.airdropAssets),
        ) !== null &&
          item.airdropAssets.find(
            (airdrop) => !isEmpty(airdrop.airdropAssets),
          ) !== undefined),
    );

    if (!hideSmallAssets) {
      return withAssets;
    }

    return withAssets.reduce(
      (acc, item) => {
        const filteredAssets = item.assets.filter((asset) => {
          const assetValueUsd = Number(asset.metadata?.fiatValueUsd ?? 0);
          return assetValueUsd >= 0.01;
        });

        // If we filtered out all assets and there are no airdrop assets, drop the protocol
        // (Or if the original protocol only had assets that are now all hidden)
        if (
          filteredAssets.length > 0 ||
          item.airdropAssets.some((airdrop) => !isEmpty(airdrop.airdropAssets))
        ) {
          acc.push({
            ...item,
            assets: filteredAssets,
          });
        }

        return acc;
      },
      [] as typeof withAssets,
    );
  }, [hideSmallAssets, investments]);
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
        illustration="BlockPercentage"
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
