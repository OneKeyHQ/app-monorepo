import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText, Switch, XStack, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { useEarnAccount } from '../../Staking/hooks/useEarnAccount';
import { EManagePositionType } from '../../Staking/pages/ManagePosition/hooks/useManagePage';
import { EBorrowDataStatus } from '../borrowDataStatus';
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
  const { reserves, market, borrowDataStatus } = useBorrowContext();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { earnAccount } = useEarnAccount({ networkId: market?.networkId });
  const { gtMd, gtLg } = useMedia();
  const [showZeroBalance, setShowZeroBalance] = useState(true);
  const accountId = earnAccount?.account?.id || '';
  const walletId = earnAccount?.walletId || '';
  const indexedAccountId = earnAccount?.account?.indexedAccountId;

  const handleManageSupply = useCallback(
    (item: ISupplyAsset) => {
      if (!market) return;

      BorrowNavigation.pushToBorrowManagePosition(navigation, {
        accountId,
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
    [navigation, market, accountId, reserves],
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
          accountId: accountId || undefined,
          indexedAccountId,
        });
      } else {
        // Mobile: open Supply dialog
        handleManageSupply(item);
      }
    },
    [navigation, market, gtMd, handleManageSupply, accountId, indexedAccountId],
  );

  const showLoading =
    borrowDataStatus === EBorrowDataStatus.LoadingMarkets ||
    borrowDataStatus === EBorrowDataStatus.WaitingForAccount ||
    borrowDataStatus === EBorrowDataStatus.LoadingReserves;

  // Filter data based on showZeroBalance (mobile always shows all assets)
  const filteredAssets = useMemo(() => {
    if (!reserves?.supply?.assets) return [];
    // Mobile: always show all assets
    if (!gtMd) return reserves.supply.assets;
    // Desktop: filter based on showZeroBalance toggle
    if (showZeroBalance) return reserves.supply.assets;
    return reserves.supply.assets.filter((asset) => {
      const balance = new BigNumber(asset?.walletBalance?.title?.text || '0');
      return balance.gt(0);
    });
  }, [reserves?.supply?.assets, showZeroBalance, gtMd]);

  const labels = useMemo(
    () => ({
      supplyApy: intl.formatMessage({ id: ETranslations.defi_supply_apy }),
      balance: intl.formatMessage({ id: ETranslations.global_balance }),
      supply: intl.formatMessage({ id: ETranslations.defi_supply }),
      assetCanBeCollateral: intl.formatMessage({
        id: ETranslations.global_asset,
      }),
      assetsToSupply: intl.formatMessage({
        id: ETranslations.defi_assets_to_supply,
      }),
      noAssetsToSupply: intl.formatMessage({
        id: ETranslations.defi_no_assets_to_supply,
      }),
      showAssetsWithZeroBalance: intl.formatMessage({
        id: ETranslations.defi_show_assets_with_0_balance,
      }),
    }),
    [intl],
  );

  const filterUI = useMemo(
    () => (
      <XStack ai="center" gap="$3">
        <Switch
          value={showZeroBalance}
          onChange={setShowZeroBalance}
          size="small"
        />
        <SizableText size="$bodyMd" color="$text">
          {labels.showAssetsWithZeroBalance}
        </SizableText>
      </XStack>
    ),
    [showZeroBalance, labels.showAssetsWithZeroBalance],
  );

  // Mobile columns - 2 columns only
  const mobileColumns = useMemo(
    () => [
      {
        label: labels.assetCanBeCollateral,
        key: 'asset',
        render: (item: ISupplyAsset) => (
          <AssetWithAmountField
            token={item.token}
            canBeCollateral={false}
            amount={item.walletBalance.title}
            amountDescription={item.walletBalance.description}
            showWalletIcon
            platformBonusApy={item.platformBonusApy}
          />
        ),
        flex: 1.5,
      },
      {
        label: labels.supplyApy,
        align: 'flex-end' as const,
        key: 'supplyApy',
        render: BorrowAPYField,
        flex: 1,
      },
    ],
    [labels],
  );

  // Desktop columns - all columns
  const desktopColumns = useMemo(
    () => [
      {
        label: labels.assetCanBeCollateral,
        key: 'asset',
        render: (item: ISupplyAsset) => (
          <AssetField
            token={item.token}
            platformBonusApy={item.platformBonusApy}
          />
        ),
        flex: 1.5,
      },
      {
        label: labels.balance,
        align: 'flex-end' as const,
        key: 'balance',
        sortable: true,
        comparator: (a: ISupplyAsset, b: ISupplyAsset) => {
          const aFiatValue = new BigNumber(a.walletBalance?.fiatValue || '0');
          const bFiatValue = new BigNumber(b.walletBalance?.fiatValue || '0');
          return aFiatValue.comparedTo(bFiatValue);
        },
        render: (item: ISupplyAsset) => (
          <AmountField
            title={item.walletBalance.title}
            description={item.walletBalance.description}
          />
        ),
        flex: 1,
      },
      {
        label: labels.supplyApy,
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
            buttonText={<EarnText text={{ text: labels.supply }} />}
            item={item}
            onPress={() => handleManageSupply(item)}
            needAdditionButton={gtLg}
            accountId={accountId}
            walletId={walletId}
            indexedAccountId={indexedAccountId}
            disabled={item.supplyButton?.disabled}
          />
        ),
        flex: 1,
      },
    ],
    [handleManageSupply, gtLg, accountId, walletId, indexedAccountId, labels],
  );

  return (
    <Card title={labels.assetsToSupply} renderFilter={gtMd ? filterUI : null}>
      <BorrowTableList<ISupplyAsset>
        data={filteredAssets}
        isLoading={showLoading}
        columns={gtMd ? desktopColumns : mobileColumns}
        onPressRow={handlePressRow}
        emptyContent={labels.noAssetsToSupply}
        defaultSortKey="balance"
        defaultSortDirection="desc"
      />
    </Card>
  );
};
