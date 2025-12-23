import { useCallback, useMemo, useState } from 'react';

import { SizableText, Switch, XStack, useMedia } from '@onekeyhq/components';
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
  const [showZeroBalance, setShowZeroBalance] = useState(false);

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

  const handlePressRow = useCallback(
    (item: ISupplyAsset) => {
      if (!market) return;
      if (gtMd) {
        // Desktop: navigate to details page
        BorrowNavigation.pushToBorrowReserveDetails(navigation, {
          networkId: market.networkId,
          provider: market.provider,
          marketAddress: market.marketAddress,
          reserveAddress: item.reserveAddress,
          symbol: item.token.symbol,
          logoURI: item.token.logoURI,
        });
      } else {
        // Mobile: open Supply dialog
        handleManageSupply(item);
      }
    },
    [navigation, market, gtMd, handleManageSupply],
  );

  const showLoading = !reserves && reservesLoading;

  // Filter data based on showZeroBalance
  const filteredAssets = useMemo(() => {
    if (!reserves?.supply.assets) return [];
    if (showZeroBalance) return reserves.supply.assets;
    return reserves.supply.assets.filter((asset) => {
      return parseFloat(asset?.walletBalance?.title?.text) > 0;
    });
  }, [reserves?.supply.assets, showZeroBalance]);

  const filterUI = useMemo(
    () => (
      <XStack ai="center" gap="$3">
        <Switch
          value={showZeroBalance}
          onChange={setShowZeroBalance}
          size="small"
        />
        <SizableText size="$bodyMd" color="$text">
          Show assets with 0 balance
        </SizableText>
      </XStack>
    ),
    [showZeroBalance],
  );

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
    <Card title="Assets to supply" renderFilter={filterUI}>
      <BorrowTableList<ISupplyAsset>
        data={filteredAssets}
        isLoading={showLoading}
        columns={gtMd ? desktopColumns : mobileColumns}
        onPressRow={handlePressRow}
        emptyContent="Nothing supplied yet"
      />
    </Card>
  );
};
