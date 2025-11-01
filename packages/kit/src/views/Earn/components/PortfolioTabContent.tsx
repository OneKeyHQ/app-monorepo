import { memo, useCallback, useMemo } from 'react';

import {
  Button,
  Divider,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IEarnInvestmentItem,
  IInvestment,
} from '@onekeyhq/shared/types/staking';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

const PortfolioItemComponent = ({
  portfolioItem,
}: {
  portfolioItem: IEarnInvestmentItem;
}) => {
  const [
    {
      currencyInfo: { symbol: fiatSymbol },
    },
  ] = useSettingsPersistAtom();

  const columns: ITableColumn<IInvestment>[] = useMemo(() => {
    return [
      {
        key: 'deposits',
        label: 'Deposits',
        flex: 1.5,
        render: (item) => {
          return (
            <XStack>
              <Token
                size="md"
                borderRadius="$2"
                tokenImageUri={item.tokenInfo.logoURI}
                networkImageUri={item.networkInfo?.logoURI}
              />
              <YStack ml="$3" mr="$2" jc="center">
                <SizableText size="$bodyLgMedium">
                  {item.staked}
                  {item.tokenInfo.symbol}{' '}
                  <SizableText color="$textSubdued">{`(${fiatSymbol}${item.stakedFiatValue})`}</SizableText>
                </SizableText>
                {item?.vaultName ? (
                  <SizableText
                    mt="$0.5"
                    size="$bodySmMedium"
                    color="$textSubdued"
                  >
                    {item?.vaultName}
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
        // TODO: render actual Est. 24h earnings
        render: (item) => (
          <SizableText mr="$2" size="$bodyLgMedium">
            -
          </SizableText>
        ),
      },
      {
        key: 'Asset status',
        label: 'Asset status',
        flex: 1.5,
        hideInMobile: true,
        render: (item) => (
          <SizableText mr="$2" size="$bodyLgMedium">
            -
          </SizableText>
        ),
      },
      {
        key: 'Claimable',
        label: 'Claimable',
        flex: 1.5,
        render: (item) => (
          <SizableText mr="$2" size="$bodyLgMedium">
            -
          </SizableText>
        ),
      },
    ];
  }, [fiatSymbol]);

  const protocolHeader = useMemo(() => {
    return (
      <YStack>
        <XStack ai="center" gap="$1.5">
          <Token
            size="xs"
            borderRadius="$2"
            tokenImageUri={portfolioItem.logoURI}
          />
          <SizableText size="$bodyLgMedium">{portfolioItem.name} </SizableText>
        </XStack>
      </YStack>
    );
  }, [portfolioItem.logoURI, portfolioItem.name]);

  const appNavigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;

  const handleManagePress = useCallback(
    async (item: IInvestment) => {
      if (item.tokenInfo.symbol === 'USDe') {
        appNavigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.ProtocolDetailsV2,
          params: {
            indexedAccountId: indexedAccount?.id,
            accountId: account?.id,
            networkId: item.tokenInfo.networkId,
            symbol: item.tokenInfo.symbol,
            provider: portfolioItem.name,
            vault: item.vault,
          },
        });

        return;
      }
      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.ManagePosition,
        params: {
          networkId: item.tokenInfo.networkId,
          symbol: item.tokenInfo.symbol,
          provider: portfolioItem.name,
          vault: item.vault,
        },
      });
    },
    [appNavigation, portfolioItem.name, account?.id, indexedAccount?.id],
  );

  return (
    <YStack>
      {protocolHeader}
      <TableList<IInvestment>
        data={portfolioItem.investment}
        columns={columns}
        withHeader
        tableLayout
        defaultSortKey="yield"
        defaultSortDirection="desc"
        actions={{
          render: (item) => (
            <Button
              size="small"
              variant="secondary"
              onPress={() => handleManagePress(item)}
            >
              Manage
            </Button>
          ),
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
  isLoading,
}: {
  portfolioInfo: IEarnInvestmentItem[];
  isLoading: boolean;
}) => {
  return (
    <YStack pt="$6">
      {portfolioInfo.length > 0
        ? portfolioInfo.map((item) => {
            const showDivider =
              portfolioInfo.length > 0 &&
              portfolioInfo[portfolioInfo.length - 1] !== item;

            return (
              <>
                <PortfolioItem key={item.name} portfolioItem={item} />
                {showDivider ? <Divider my="$4" /> : null}
              </>
            );
          })
        : null}
    </YStack>
  );
};
