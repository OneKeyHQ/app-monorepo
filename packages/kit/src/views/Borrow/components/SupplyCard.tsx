import { useCallback, useMemo } from 'react';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EManagePositionType } from '../../Staking/pages/ManagePosition/hooks/useManagePage';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';

import {
  ActionField,
  AmountField,
  AssetField,
  AssetWithAmountField,
  BorrowAPYField,
  BorrowTableList,
} from './BorrowTableList';
import { Card } from './Card';

type ISupplyAsset = IBorrowReserveItem['supply']['assets'][number];

export const SupplyCard = () => {
  const { reserves, market, reservesLoading } = useBorrowContext();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { gtMd } = useMedia();

  const handlePressRow = useCallback(
    (item: ISupplyAsset) => {
      if (!market) return;
      BorrowNavigation.pushToBorrowReserveDetails(navigation, {
        networkId: market.networkId,
        provider: market.provider,
        marketAddress: market.marketAddress,
        reserveAddress: item.reserveAddress,
        symbol: item.token.symbol,
        logoURI: item.token.logoURI,
      });
    },
    [navigation, market],
  );

  const handleManageSupply = useCallback(
    (item: ISupplyAsset) => {
      if (!market) return;

      BorrowNavigation.pushToBorrowManagePosition(navigation, {
        accountId: activeAccount.account?.id || '',
        networkId: market.networkId,
        provider: market.provider,
        marketAddress: market.marketAddress,
        reserveAddress: item.reserveAddress,
        symbol: item.token.symbol,
        providerLogoURI: market.logoURI,
        logoURI: item.token.logoURI,
        type: EManagePositionType.Supply,
        borrowReserves: reserves ?? undefined,
      });
    },
    [navigation, market, activeAccount.account?.id, reserves],
  );

  const showLoading = !reserves && reservesLoading;

  // Mobile columns - 2 columns only
  const mobileColumns = useMemo(
    () => [
      {
        label: 'Asset / Can be collateral',
        key: 'asset',
        render: (item: ISupplyAsset) => (
          <AssetWithAmountField
            token={item.token}
            canBeCollateral={item.canBeCollateral}
            amount={item.walletBalance.title}
            amountDescription={item.walletBalance.description}
            showWalletIcon
          />
        ),
        flex: 1.5,
      },
      {
        label: 'Supply APY',
        align: 'flex-end' as const,
        key: 'supplyApy',
        render: BorrowAPYField,
        flex: 1,
      },
    ],
    [],
  );

  // Desktop columns - all columns
  const desktopColumns = useMemo(
    () => [
      {
        label: 'Asset / Can be collateral',
        key: 'asset',
        render: AssetField,
        flex: 1.5,
      },
      {
        label: 'Balance',
        align: 'flex-end' as const,
        key: 'balance',
        render: (item: ISupplyAsset) => (
          <AmountField
            title={item.walletBalance.title}
            description={item.walletBalance.description}
          />
        ),
        flex: 1,
      },
      {
        label: 'Supply APY',
        align: 'flex-end' as const,
        key: 'supplyApy',
        render: BorrowAPYField,
        flex: 1,
      },
      {
        label: '',
        align: 'flex-end' as const,
        key: 'actions',
        render: (item: ISupplyAsset) => (
          <ActionField
            buttonText={<EarnText text={{ text: 'Supply' }} />}
            item={item}
            onPress={() => handleManageSupply(item)}
            needAdditionButton
          />
        ),
        flex: 1,
      },
    ],
    [handleManageSupply],
  );

  return (
    <Card title="Assets to supply">
      <BorrowTableList<ISupplyAsset>
        data={reserves?.supply.assets || []}
        isLoading={showLoading}
        columns={gtMd ? desktopColumns : mobileColumns}
        onPressRow={gtMd ? handlePressRow : handleManageSupply}
        emptyContent="Nothing supplied yet"
      />
    </Card>
  );
};
