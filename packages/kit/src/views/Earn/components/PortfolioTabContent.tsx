import { memo, useCallback, useMemo } from 'react';

import { isEmpty } from 'lodash';

import {
  Button,
  Divider,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IEarnPortfolioInvestment } from '@onekeyhq/shared/types/staking';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { useEarnPortfolio } from '../hooks/useEarnPortfolio';

const PortfolioItemComponent = ({
  portfolioItem,
}: {
  portfolioItem: IEarnPortfolioInvestment;
}) => {
  const columns: ITableColumn<IEarnPortfolioInvestment['assets'][number]>[] =
    useMemo(() => {
      return [
        {
          key: 'deposits',
          label: 'Deposits',
          flex: 1.5,
          render: (asset) => {
            return (
              <XStack>
                <Token
                  size="md"
                  borderRadius="$2"
                  tokenImageUri={asset.token.info.logoURI}
                  networkImageUri={portfolioItem.network.logoURI}
                />
                <YStack ml="$3" mr="$2" jc="center">
                  <XStack gap="$1">
                    <EarnText
                      flex={1}
                      size="$bodyLgMedium"
                      text={asset.deposit?.title}
                    />
                    <EarnText
                      flex={1}
                      size="$bodyLgMedium"
                      color="$textSubdued"
                      text={asset.deposit?.description}
                    />
                  </XStack>
                  {portfolioItem.protocol.vaultName ? (
                    <SizableText
                      mt="$0.5"
                      size="$bodySmMedium"
                      color="$textSubdued"
                    >
                      {portfolioItem.protocol.vaultName}
                    </SizableText>
                  ) : null}
                </YStack>
              </XStack>
            );
          },
        },
        {
          key: 'Est. 24h earnings',
          label: 'Est. 24h earnings',
          flex: 1,
          hideInMobile: true,
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
          hideInMobile: true,
          render: (asset) => (
            <XStack gap="$1">
              {asset.assetsStatus?.map((status, index) => (
                <>
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
                </>
              ))}
            </XStack>
          ),
        },
        {
          key: 'Claimable',
          label: 'Claimable',
          flex: 1.5,
          render: (asset) => (
            <XStack gap="$2">
              {isEmpty(asset.rewardAssets) ? (
                <EarnText flex={1} size="$bodyLgMedium" text={{ text: '-' }} />
              ) : null}
              {asset.rewardAssets?.map((reward, index) => (
                <XStack key={index}>
                  <EarnText mr="$2" size="$bodyLgMedium" text={reward.title} />
                  <EarnText
                    mr="$2"
                    size="$bodyLgMedium"
                    color="$textSubdued"
                    text={reward.description}
                  />
                </XStack>
              ))}
            </XStack>
          ),
        },
      ];
    }, [portfolioItem.network.logoURI, portfolioItem.protocol.vaultName]);

  const protocolHeader = useMemo(() => {
    return (
      <YStack>
        <XStack ai="center" gap="$1.5">
          <Token
            size="xs"
            borderRadius="$2"
            tokenImageUri={portfolioItem.protocol.providerDetail.logoURI}
          />
          <SizableText size="$bodyLgMedium">
            {portfolioItem.protocol.providerDetail.name}
          </SizableText>
          <SizableText size="$bodyLgMedium" color="$textSubdued">
            Total value {portfolioItem.totalFiatValue}
          </SizableText>
        </XStack>
      </YStack>
    );
  }, [
    portfolioItem.totalFiatValue,
    portfolioItem.protocol.providerDetail.logoURI,
    portfolioItem.protocol.providerDetail.name,
  ]);

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
            networkId: asset.requestParams.networkId,
            symbol,
            provider: asset.requestParams.provider,
            vault: asset.requestParams.vault,
          },
        });

        return;
      }
      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.ManagePosition,
        params: {
          networkId: asset.requestParams.networkId,
          symbol,
          provider: asset.requestParams.provider,
          vault: asset.requestParams.vault,
        },
      });
    },
    [appNavigation, account?.id, indexedAccount?.id],
  );

  return (
    <YStack>
      {protocolHeader}
      <TableList<IEarnPortfolioInvestment['assets'][number]>
        data={portfolioItem.assets.filter((asset) => asset.type === 'normal')}
        columns={columns}
        withHeader
        tableLayout
        defaultSortKey="deposits"
        defaultSortDirection="desc"
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

export const PortfolioTabContent = () => {
  const { investments, isLoading } = useEarnPortfolio();

  const showSkeleton = isLoading && investments.length === 0;
  const showEmpty = !isLoading && investments.length === 0;

  return (
    <YStack>
      {investments.length > 0
        ? investments.map((item, index) => {
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
          })
        : null}
    </YStack>
  );
};
