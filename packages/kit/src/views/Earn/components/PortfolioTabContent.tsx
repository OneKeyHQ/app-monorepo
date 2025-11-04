import { memo, useCallback, useMemo } from 'react';

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
import type { IEarnInvestmentItemV2 } from '@onekeyhq/shared/types/staking';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';

const PortfolioItemComponent = ({
  portfolioItem,
}: {
  portfolioItem: IEarnInvestmentItemV2;
}) => {
  const columns: ITableColumn<IEarnInvestmentItemV2['assets'][number]>[] =
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
              // color={asset.earnings24h?.color}
              text={asset.earnings24h?.title}
            />
            // <SizableText
            //   mr="$2"
            //   size="$bodyLgMedium"
            //   color={asset.earnings24h?.color}
            // >
            //   {asset.earnings24h?.text}
            // </SizableText>
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
                // <SizableText
                //   key={index}
                //   mr="$2"
                //   size="$bodyLgMedium"
                //   color={status.text?.color}
                // >
                //   {status.text?.text}
                // </SizableText>
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
              {asset.rewardAssets?.map((reward, index) => (
                <SizableText
                  key={index}
                  mr="$2"
                  size="$bodyLgMedium"
                  color={reward.text?.color}
                >
                  {reward.text?.text}
                </SizableText>
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
    async (asset: IEarnInvestmentItemV2['assets'][number]) => {
      const symbol = asset.token.info.symbol;
      if (symbol === 'USDe') {
        appNavigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.ProtocolDetailsV2,
          params: {
            indexedAccountId: indexedAccount?.id,
            accountId: account?.id,
            networkId: portfolioItem.network.networkId,
            symbol,
            provider: portfolioItem.protocol.providerDetail.code,
            vault: portfolioItem.protocol.vaultName,
          },
        });

        return;
      }
      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.ManagePosition,
        params: {
          networkId: portfolioItem.network.networkId,
          symbol,
          provider: portfolioItem.protocol.providerDetail.code,
          // vault: portfolioItem.protocol.providerDetail.,
        },
      });
    },
    [
      appNavigation,
      portfolioItem.protocol.providerDetail.code,
      portfolioItem.protocol.vaultName,
      portfolioItem.network.networkId,
      account?.id,
      indexedAccount?.id,
    ],
  );

  console.log('portfolioItem.assetsportfolioItem.assets', portfolioItem.assets);

  return (
    <YStack>
      {protocolHeader}
      <TableList<IEarnInvestmentItemV2['assets'][number]>
        data={portfolioItem.assets}
        columns={columns}
        withHeader
        tableLayout
        defaultSortKey="deposits"
        defaultSortDirection="desc"
        actions={{
          render: (asset) => {
            return (
              <Stack gap="$2">
                {asset.buttons?.map((button, index) => {
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
                })}
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

export const PortfolioTabContent = ({
  portfolioInfo,
  isLoading: _isLoading,
}: {
  portfolioInfo: IEarnInvestmentItemV2[];
  isLoading: boolean;
}) => {
  return (
    <YStack>
      {portfolioInfo.length > 0
        ? portfolioInfo.map((item, index) => {
            const showDivider = index < portfolioInfo.length - 1;
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
