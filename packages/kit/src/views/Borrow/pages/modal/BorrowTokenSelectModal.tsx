import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Stack, useMedia, useSafeAreaInsets } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import type {
  EBorrowActionsEnum,
  IBorrowAsset,
  IBorrowAssetsList,
  IBorrowBalance,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import {
  AmountField,
  AssetField,
  AssetWithAmountField,
  BorrowAPYField,
  BorrowTableList,
} from '../../components/BorrowTableList';

type IBorrowSelectAsset = IBorrowAsset;

const emptyText: IEarnText = { text: '-' };
const emptyBalance: IBorrowBalance = {
  amount: '-',
  fiatValue: '-',
  title: emptyText,
  description: emptyText,
};

export default function BorrowTokenSelectModal() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const { gtMd } = useMedia();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowTokenSelect
  >();
  const {
    accountId,
    networkId,
    provider,
    marketAddress,
    action,
    currentReserveAddress,
    onSelect,
  } = route.params;
  const [searchKeyword, setSearchKeyword] = useState('');

  const { result: assetsList, isLoading } = usePromiseResult<IBorrowAssetsList>(
    async () => {
      if (!accountId || !networkId || !provider || !marketAddress) {
        return { assets: [] };
      }
      return backgroundApiProxy.serviceStaking.getBorrowAssetsList({
        accountId,
        networkId,
        provider,
        marketAddress,
        action: action as EBorrowActionsEnum,
      });
    },
    [accountId, networkId, provider, marketAddress, action],
    {
      initResult: { assets: [] },
      watchLoading: true,
    },
  );

  const assets = assetsList.assets;

  const filteredAssets = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return assets;
    return assets.filter((item) => {
      const symbol = item.token.symbol.toLowerCase();
      const name = item.token.name.toLowerCase();
      const address = item.token.address.toLowerCase();
      return (
        symbol.includes(keyword) ||
        name.includes(keyword) ||
        address.includes(keyword)
      );
    });
  }, [assets, searchKeyword]);

  const isBorrowAction = action === 'borrow';

  const labels = useMemo(() => {
    const asset = intl.formatMessage({ id: ETranslations.global_asset });
    const borrowed = intl.formatMessage({
      id: ETranslations.wallet_defi_asset_type_borrowed,
    });
    const supplied = intl.formatMessage({
      id: ETranslations.wallet_defi_asset_type_supplied,
    });
    const available = intl.formatMessage({
      id: ETranslations.global_available,
    });
    return {
      asset,
      available,
      borrowed,
      supplied,
      walletBalance: intl.formatMessage({
        id: ETranslations.global_wallet_balance,
      }),
      borrowApy: intl.formatMessage({ id: ETranslations.defi_borrow_apy }),
      supplyApy: intl.formatMessage({ id: ETranslations.defi_supply_apy }),
      assetAvailable: `${asset} / ${available}`,
      availableWithColon: `${available}:`,
    };
  }, [intl]);

  const balanceLabel = isBorrowAction ? labels.available : labels.walletBalance;
  const positionLabel = isBorrowAction ? labels.borrowed : labels.supplied;
  const apyLabel = isBorrowAction ? labels.borrowApy : labels.supplyApy;
  const modalTitle = isBorrowAction
    ? intl.formatMessage({
        id: ETranslations.defi_select_an_asset_to_borrow,
      })
    : intl.formatMessage({
        id: ETranslations.defi_select_an_asset_to_supply,
      });

  const handleSelect = useCallback(
    (item: IBorrowSelectAsset) => {
      void onSelect?.(item);
      navigation.pop();
    },
    [navigation, onSelect],
  );

  // Mobile columns - 2 columns only (Asset with amount + APY)
  const mobileColumns = useMemo(
    () => [
      {
        label: labels.assetAvailable,
        key: 'asset',
        render: (item: IBorrowSelectAsset) => {
          const balance = isBorrowAction
            ? (item.available ?? emptyBalance)
            : (item.walletBalance ?? item.balance ?? emptyBalance);
          return (
            <AssetWithAmountField
              token={item.token}
              amountLabel={{ text: labels.availableWithColon }}
              amount={balance.title}
              amountDescription={balance.description}
              platformBonusApy={item?.platformBonusApy}
            />
          );
        },
        flex: 1.5,
      },
      {
        label: apyLabel,
        align: 'flex-end' as const,
        key: 'apy',
        render: (item: IBorrowSelectAsset) => (
          <BorrowAPYField apyDetail={item.apyDetail} />
        ),
        flex: 1,
      },
    ],
    [labels, isBorrowAction, apyLabel],
  );

  // Desktop columns - all 4 columns
  const desktopColumns = useMemo(
    () => [
      {
        label: labels.asset,
        key: 'asset',
        render: (item: IBorrowSelectAsset) => {
          return (
            <AssetField
              token={item.token}
              platformBonusApy={item?.platformBonusApy}
            />
          );
        },
        flex: 1.5,
      },
      {
        label: balanceLabel,
        align: 'flex-end' as const,
        key: 'walletBalance',
        render: (item: IBorrowSelectAsset) => {
          const balance = isBorrowAction
            ? (item.available ?? emptyBalance)
            : (item.walletBalance ?? item.balance ?? emptyBalance);
          return (
            <AmountField
              title={balance.title}
              description={balance.description}
            />
          );
        },
        flex: 1,
      },
      {
        label: positionLabel,
        align: 'flex-end' as const,
        key: 'position',
        render: (item: IBorrowSelectAsset) => {
          const positionBalance = isBorrowAction
            ? (item.borrowed ?? emptyBalance)
            : (item.supplied ?? emptyBalance);
          return (
            <AmountField
              title={positionBalance.title}
              description={positionBalance.description}
            />
          );
        },
        flex: 1,
      },
      {
        label: apyLabel,
        align: 'flex-end' as const,
        key: 'apy',
        render: (item: IBorrowSelectAsset) => (
          <BorrowAPYField apyDetail={item.apyDetail} />
        ),
        flex: 1,
      },
    ],
    [labels, balanceLabel, positionLabel, apyLabel, isBorrowAction],
  );

  const columns = gtMd ? desktopColumns : mobileColumns;

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={modalTitle}
        headerSearchBarOptions={{
          placeholder: intl.formatMessage({
            id: ETranslations.token_selector_search_placeholder,
          }),
          onChangeText: ({ nativeEvent }) => {
            setSearchKeyword(nativeEvent.text);
          },
          searchBarInputValue: searchKeyword,
        }}
      />
      <Page.Body>
        <BorrowTableList<IBorrowSelectAsset>
          data={filteredAssets}
          isLoading={Boolean(isLoading)}
          columns={columns}
          skeletonCount={6}
          onPressRow={(item) => {
            if (item.reserveAddress === currentReserveAddress) return;
            handleSelect(item);
          }}
          listProps={{
            listItemProps: (item) =>
              item.reserveAddress === currentReserveAddress
                ? { bg: '$bgHover' }
                : undefined,
            ListFooterComponent: <Stack h={bottom || '$2'} />,
          }}
          emptyContent={intl.formatMessage({
            id: ETranslations.global_no_results,
          })}
        />
      </Page.Body>
    </Page>
  );
}
