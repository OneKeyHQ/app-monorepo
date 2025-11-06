import { memo, useCallback, useMemo } from 'react';

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
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import type {
  IEarnPortfolioInvestment,
  IEarnText,
  IEarnToken,
  IEarnTokenInfo,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

import { useCurrency } from '../../../components/Currency';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { EarnActionIcon } from '../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { useProtocolDetails } from '../../Staking/pages/ManagePosition/hooks/useProtocolDetails';
import { useEarnPortfolio } from '../hooks/useEarnPortfolio';

const WrappedActionButton = ({
  button,
  protocolInfo,
  tokenInfo,
  token,
  text,
}: {
  button: IEarnPortfolioInvestment['assets'][number]['rewardAssets'][number]['button'];
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
  token?: {
    info: IEarnToken;
    price: string;
  };
  text: IEarnText;
}) => {
  return (
    <EarnActionIcon
      actionIcon={button}
      protocolInfo={protocolInfo}
      tokenInfo={tokenInfo}
      token={token?.info}
      // eslint-disable-next-line react/no-unstable-nested-components
      trigger={({ onPress, loading, disabled }) => {
        return (
          <Button
            p="0"
            variant="link"
            size="small"
            onPress={onPress}
            cursor={disabled ? 'not-allowed' : 'pointer'}
            loading={loading}
            disabled={disabled}
          >
            {text.text}
          </Button>
        );
      }}
    />
  );
};

const DepositField = ({
  asset,
}: {
  asset: IEarnPortfolioInvestment['assets'][number];
}) => {
  return (
    <XStack>
      <Token
        size="md"
        borderRadius="$2"
        tokenImageUri={asset.token.info.logoURI}
        networkImageUri={asset.metadata.network.logoURI}
      />
      <YStack ml="$3" mr="$2" jc="center">
        <XStack gap="$1">
          <EarnText flex={1} size="$bodyLgMedium" text={asset.deposit?.title} />
          <EarnText
            flex={1}
            size="$bodyLgMedium"
            color="$textSubdued"
            text={asset.deposit?.description}
          />
        </XStack>
        {asset.metadata.protocol.vaultName ? (
          <SizableText mt="$0.5" size="$bodySmMedium" color="$textSubdued">
            {asset.metadata.protocol.vaultName}
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  );
};

const AssetStatusField = ({
  asset,
}: {
  asset: IEarnPortfolioInvestment['assets'][number];
}) => {
  return (
    <YStack gap="$1">
      {asset.assetsStatus?.map((status, index) => (
        <XStack key={index}>
          <EarnText
            key={index}
            mr="$2"
            size="$bodyLgMedium"
            text={status.title}
          />
          <EarnText
            key={index}
            mr="$2"
            size="$bodyLgMedium"
            color="$textSubdued"
            text={status.description}
          />
          <EarnTooltip tooltip={status.tooltip} />
        </XStack>
      ))}
    </YStack>
  );
};

const ActionField = ({
  asset,
}: {
  asset: IEarnPortfolioInvestment['assets'][number];
}) => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;

  const { isLoading, tokenInfo, protocolInfo, detailInfo } = useProtocolDetails(
    {
      accountId: account?.id || '',
      networkId: asset.metadata.network.networkId,
      indexedAccountId: indexedAccount?.id,
      symbol: asset.token.info.symbol as ISupportedSymbol,
      provider: asset.metadata.protocol.providerDetail.code,
      vault: asset.metadata.protocol.vault,
    },
  );

  return (
    <YStack gap="$1">
      {isEmpty(asset.rewardAssets) ? (
        <EarnText flex={1} size="$bodyLgMedium" text={{ text: '-' }} />
      ) : null}
      {asset.rewardAssets?.map((reward, index) => (
        <XStack key={index}>
          <EarnText mr="$1" size="$bodyLgMedium" text={reward.title} />
          <EarnText
            mr="$2"
            size="$bodyLgMedium"
            color="$textSubdued"
            text={reward.description}
          />
          {!isLoading ? (
            <WrappedActionButton
              button={reward.button}
              protocolInfo={protocolInfo}
              tokenInfo={tokenInfo}
              token={detailInfo?.subscriptionValue?.token}
              text={reward.button.text as IEarnText}
            />
          ) : null}
        </XStack>
      ))}
    </YStack>
  );
};

const ProtocolHeader = ({
  portfolioItem,
}: {
  portfolioItem: IEarnPortfolioInvestment;
}) => {
  const currencyInfo = useCurrency();

  return (
    <YStack mb="$1">
      <XStack ai="center" gap="$1.5">
        <Token
          size="xs"
          borderRadius="$2"
          tokenImageUri={portfolioItem.protocol.providerDetail.logoURI}
        />
        <SizableText size="$bodyLgMedium">
          {portfolioItem.protocol.providerDetail.name}
        </SizableText>
        <Divider bg="$borderSubdued" vertical mx="$3" height="$5" width="$1" />
        <SizableText size="$bodyLgMedium" color="$textSubdued">
          Total value{' '}
          {numberFormat(portfolioItem.totalFiatValue, {
            formatter: 'price',
            formatterOptions: {
              currency: currencyInfo.symbol,
            },
          })}
        </SizableText>
      </XStack>
      {isEmpty(portfolioItem.airdropAssets) ? null : (
        <YStack mb="$2" mt="$5">
          {portfolioItem.airdropAssets?.map((airdrop, index) => {
            return (
              <XStack key={index} ai="center">
                <Token
                  size="xs"
                  borderRadius="$2"
                  mr="$1.5"
                  tokenImageUri={airdrop.token.info.logoURI}
                />
                {airdrop.airdropAssets.map((reward, rewardIndex) => {
                  const needDivider =
                    rewardIndex < airdrop.airdropAssets.length - 1;

                  return (
                    <XStack key={rewardIndex} ai="center">
                      <EarnText
                        mr="$1"
                        size="$bodyLgMedium"
                        text={reward.title}
                      />
                      <EarnText
                        mr="$1"
                        size="$bodyLgMedium"
                        color="$textSubdued"
                        text={reward.description}
                      />
                      <EarnTooltip tooltip={reward.tooltip} />
                      {needDivider ? (
                        <Divider
                          bg="$borderSubdued"
                          vertical
                          mx="$3"
                          height="$5"
                          width="$1"
                        />
                      ) : null}
                    </XStack>
                  );
                })}
              </XStack>
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
  const media = useMedia();

  const columns: ITableColumn<IEarnPortfolioInvestment['assets'][number]>[] =
    useMemo(() => {
      return [
        {
          key: 'deposits',
          label: 'Deposits',
          flex: 1.5,
          priority: 5, // Always visible (mobile, tablet, desktop)
          render: (asset) => <DepositField asset={asset} />,
        },
        {
          key: 'Est. 24h earnings',
          label: 'Est. 24h earnings',
          flex: 1,
          priority: 2, // Visible on desktop only
          render: (asset) => (
            <EarnText
              flex={1}
              size="$bodyLgMedium"
              text={asset.earnings24h?.title}
            />
          ),
        },
        {
          key: 'Asset status',
          label: 'Asset status',
          flex: 1.5,
          priority: 1, // Visible on desktop only
          render: (asset) => <AssetStatusField asset={asset} />,
        },
        {
          key: 'Claimable',
          label: 'Claimable',
          flex: 1.5,
          priority: 3, // Visible on tablet and desktop
          render: (asset) => <ActionField asset={asset} />,
        },
      ];
    }, []);

  const appNavigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;

  const handleManagePress = useCallback(
    async (asset: IEarnPortfolioInvestment['assets'][number]) => {
      const symbol = asset.token.info.symbol;
      if (symbol === 'USDe') {
        appNavigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.ProtocolDetailsV2,
          params: {
            indexedAccountId: indexedAccount?.id,
            accountId: account?.id,
            networkId: asset.metadata.network.networkId,
            symbol,
            provider: asset.metadata.protocol.providerDetail.code,
            vault: asset.metadata.protocol.vault,
          },
        });

        return;
      }
      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.ManagePosition,
        params: {
          networkId: asset.metadata.network.networkId,
          symbol,
          provider: asset.metadata.protocol.providerDetail.code,
          vault: asset.metadata.protocol.vault,
        },
      });
    },
    [appNavigation, account?.id, indexedAccount?.id],
  );

  return (
    <YStack>
      <ProtocolHeader portfolioItem={portfolioItem} />
      <TableList<IEarnPortfolioInvestment['assets'][number]>
        data={portfolioItem.assets}
        columns={columns}
        withHeader
        tableLayout
        defaultSortKey="deposits"
        defaultSortDirection="desc"
        listItemProps={{
          px: '0',
          mx: '0',
          ai: 'flex-start',
        }}
        expandable={
          !media.gtSm
            ? {
                renderExpandedContent: (asset) => (
                  <YStack gap="$4">
                    {/* Est. 24h earnings */}
                    <YStack gap="$2">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        Est. 24h earnings
                      </SizableText>
                      <EarnText
                        size="$bodyLgMedium"
                        text={asset.earnings24h?.title}
                      />
                    </YStack>

                    {/* Asset status */}
                    <YStack gap="$2">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        Asset status
                      </SizableText>
                      <AssetStatusField asset={asset} />
                    </YStack>

                    {/* Claimable */}
                    <YStack gap="$2">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        Claimable
                      </SizableText>
                      <ActionField asset={asset} />
                    </YStack>
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
    </YStack>
  );
};

const PortfolioItem = memo(PortfolioItemComponent);

// Skeleton component for loading state
const PortfolioSkeletonItem = () => (
  <YStack gap="$4">
    <XStack ai="center" gap="$1.5">
      <Skeleton w="$6" h="$6" borderRadius="$2" />
      <Skeleton.BodyLg w="$32" />
      <Skeleton.BodyMd w="$24" />
    </XStack>
    <YStack gap="$3">
      {Array.from({ length: 2 }).map((_, index) => (
        <XStack key={index} ai="center" gap="$3">
          <Skeleton w="$10" h="$10" borderRadius="$2" />
          <YStack flex={1} gap="$2">
            <Skeleton.BodyLg w="60%" />
            <Skeleton.BodyMd w="40%" />
          </YStack>
          <YStack flex={1} gap="$2">
            <Skeleton.BodyMd w="50%" />
          </YStack>
          <YStack flex={1} gap="$2">
            <Skeleton.BodyMd w="70%" />
          </YStack>
          <Skeleton w="$20" h="$8" borderRadius="$2" />
        </XStack>
      ))}
    </YStack>
  </YStack>
);

const PortfolioSkeleton = () => (
  <YStack gap="$6">
    <PortfolioSkeletonItem />
    <Divider />
    <PortfolioSkeletonItem />
  </YStack>
);

export const PortfolioTabContent = () => {
  const intl = useIntl();
  const { investments, isLoading } = useEarnPortfolio();

  const showSkeleton = isLoading && investments.length === 0;
  const showEmpty = !isLoading && investments.length === 0;

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
          id: ETranslations.earn_no_orders,
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
        const showDivider = index < investments.length - 1;
        const key = `${item.protocol.providerDetail.code}_${
          item.protocol.vaultName || ''
        }_${item.network.networkId}`;

        return (
          <>
            <PortfolioItem key={key} portfolioItem={item} />
            {showDivider ? <Divider my="$4" /> : null}
          </>
        );
      })}
    </YStack>
  );
};
