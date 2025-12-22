import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Stack, useSafeAreaInsets } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import type {
  IBorrowBalance,
  IBorrowReserveItem,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import {
  AmountField,
  AssetField,
  BorrowAPYField,
  BorrowTableList,
} from '../../components/BorrowTableList';

type IBorrowSelectAsset =
  | IBorrowReserveItem['supply']['assets'][number]
  | IBorrowReserveItem['borrow']['assets'][number];

type IBorrowPositionAsset =
  | IBorrowReserveItem['supplied']['assets'][number]
  | IBorrowReserveItem['borrowed']['assets'][number];

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
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowTokenSelect
  >();
  const {
    action,
    currentReserveAddress,
    assets = [],
    positionAssets = [],
    isLoading = false,
    onSelect,
  } = route.params;
  const [searchKeyword, setSearchKeyword] = useState('');

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

  const positionBalanceMap = useMemo(() => {
    const map = new Map<string, IBorrowBalance>();
    positionAssets?.forEach((item: IBorrowPositionAsset) => {
      const balance =
        'borrowedAmount' in item ? item.borrowedAmount : item.suppliedAmount;
      map.set(item.reserveAddress, balance);
    });
    return map;
  }, [positionAssets]);

  const isBorrowAction = action === 'borrow';
  const balanceLabel = isBorrowAction ? 'Available' : 'Wallet Balance';
  const positionLabel = isBorrowAction ? 'Borrowed' : 'Supplied';
  const apyLabel = isBorrowAction ? 'Borrow APY' : 'Supply APY';

  const handleSelect = useCallback(
    (item: IBorrowSelectAsset) => {
      void onSelect?.(item);
      navigation.pop();
    },
    [navigation, onSelect],
  );

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title="Select an asset to supply/borrow"
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
          isLoading={isLoading}
          columns={[
            {
              label: 'Asset',
              key: 'asset',
              render: (item) => {
                const canBeCollateral =
                  'canBeCollateral' in item ? item.canBeCollateral : undefined;
                return (
                  <AssetField
                    token={item.token}
                    canBeCollateral={canBeCollateral}
                  />
                );
              },
              flex: 1.5,
            },
            {
              label: balanceLabel,
              align: 'flex-end',
              key: 'walletBalance',
              render: (item) => {
                const balance = isBorrowAction
                  ? (item as IBorrowReserveItem['borrow']['assets'][number])
                      .available
                  : (item as IBorrowReserveItem['supply']['assets'][number])
                      .walletBalance;
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
              align: 'flex-end',
              key: 'position',
              render: (item) => {
                const positionBalance =
                  positionBalanceMap.get(item.reserveAddress) ?? emptyBalance;
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
              align: 'flex-end',
              key: 'supplyApy',
              render: (item) => <BorrowAPYField apyDetail={item.apyDetail} />,
              flex: 1,
            },
          ]}
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
