import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  SizableText,
  Switch,
  XStack,
  rootNavigationRef,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
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
  const { reserves, market, borrowDataStatus, earnAccount } =
    useBorrowContext();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { gtMd, gtLg } = useMedia();
  const [showZeroBalance, setShowZeroBalance] = useState(true);
  const accountId = earnAccount.data?.account?.id || '';
  const walletId = earnAccount.data?.walletId || '';
  const indexedAccountId = earnAccount.data?.account?.indexedAccountId;
  const noConnectedWallet = useMemo(
    () =>
      activeAccount.ready &&
      !activeAccount.wallet?.id &&
      !activeAccount.account?.id &&
      !activeAccount.indexedAccount?.id,
    [
      activeAccount.ready,
      activeAccount.wallet?.id,
      activeAccount.account?.id,
      activeAccount.indexedAccount?.id,
    ],
  );

  const openCreateWalletPage = useCallback(() => {
    rootNavigationRef.current?.navigate(ERootRoutes.Onboarding, {
      screen: EOnboardingV2Routes.OnboardingV2,
      params: {
        screen: EOnboardingPagesV2.CreateOrImportWallet,
      },
    });
  }, []);

  const handleManageSupply = useCallback(
    (item: ISupplyAsset) => {
      if (noConnectedWallet) {
        openCreateWalletPage();
        return;
      }
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
        borrowReserves: reserves.data ?? undefined,
      });
    },
    [
      noConnectedWallet,
      openCreateWalletPage,
      navigation,
      market,
      accountId,
      reserves.data,
    ],
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
    if (!reserves.data?.supply?.assets) return [];
    // Mobile: always show all assets
    if (!gtMd) return reserves.data.supply.assets;
    // Desktop: filter based on showZeroBalance toggle
    if (showZeroBalance) return reserves.data.supply.assets;
    return reserves.data.supply.assets.filter((asset) => {
      const balance = new BigNumber(asset?.walletBalance?.title?.text || '0');
      return balance.gt(0);
    });
  }, [reserves.data?.supply?.assets, showZeroBalance, gtMd]);

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
            needAdditionButton={gtLg && !noConnectedWallet}
            accountId={accountId}
            walletId={walletId}
            indexedAccountId={indexedAccountId}
            disabled={noConnectedWallet ? false : item.supplyButton?.disabled}
          />
        ),
        flex: 1,
      },
    ],
    [
      handleManageSupply,
      gtLg,
      noConnectedWallet,
      accountId,
      walletId,
      indexedAccountId,
      labels,
    ],
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
