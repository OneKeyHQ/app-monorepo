import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Empty,
  Icon,
  ListView,
  Page,
  Select,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
  IUtxoInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalReceiveRoutes,
  IModalReceiveParamList,
} from '@onekeyhq/shared/src/routes';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import AddressTypeSelector from '../../../components/AddressTypeSelector/AddressTypeSelector';
import { useAccountData } from '../../../hooks/useAccountData';
import {
  EUtxoSortType,
  UTXOListItem,
} from '../../Send/pages/CoinControl/UTXOListItem';
import { ReceiveTestIDs } from '../testIDs';

import type { RouteProp } from '@react-navigation/core';

function BtcCoinsPage() {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalReceiveParamList, EModalReceiveRoutes.BtcCoins>>();
  const {
    accountId,
    networkId,
    deriveInfo: deriveInfoFromRoute,
    walletId: routeWalletId,
  } = route.params;

  const {
    account,
    network,
    wallet,
    vaultSettings,
    deriveType: deriveTypeFromHook,
    deriveInfo: deriveInfoFromHook,
  } = useAccountData({
    accountId,
    networkId,
    walletId: routeWalletId,
  });
  const effectiveWalletId = routeWalletId ?? wallet?.id;

  const [currentAccount, setCurrentAccount] = useState<
    INetworkAccount | undefined
  >(account);
  const [currentDeriveType, setCurrentDeriveType] = useState<
    IAccountDeriveTypes | undefined
  >(deriveTypeFromHook);
  const [currentDeriveInfo, setCurrentDeriveInfo] = useState<
    IAccountDeriveInfo | undefined
  >(deriveInfoFromRoute ?? deriveInfoFromHook);

  useEffect(() => {
    if (account && !currentAccount) setCurrentAccount(account);
  }, [account, currentAccount]);
  useEffect(() => {
    if (deriveTypeFromHook && !currentDeriveType) {
      setCurrentDeriveType(deriveTypeFromHook);
    }
  }, [deriveTypeFromHook, currentDeriveType]);
  useEffect(() => {
    const resolved = deriveInfoFromRoute ?? deriveInfoFromHook;
    if (resolved && !currentDeriveInfo) setCurrentDeriveInfo(resolved);
  }, [deriveInfoFromRoute, deriveInfoFromHook, currentDeriveInfo]);

  const effectiveAccountId = currentAccount?.id ?? accountId;

  const [sortType, setSortType] = useState<EUtxoSortType>(
    EUtxoSortType.NewestFirst,
  );

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (!effectiveAccountId || !networkId) return [];
      return backgroundApiProxy.serviceAccountProfile.getAccountUtxos({
        accountId: effectiveAccountId,
        networkId,
      });
    },
    [effectiveAccountId, networkId],
    { watchLoading: true, initResult: [] },
  );

  const utxoList: IUtxoInfo[] = useMemo(
    () => (Array.isArray(result) ? result : []),
    [result],
  );

  const sortedData = useMemo(() => {
    const data = [...utxoList];
    switch (sortType) {
      case EUtxoSortType.NewestFirst:
        return data.toSorted((a, b) => b.height - a.height);
      case EUtxoSortType.OldestFirst:
        return data.toSorted((a, b) => a.height - b.height);
      case EUtxoSortType.LargestFirst:
        return data.toSorted((a, b) =>
          new BigNumber(b.value).comparedTo(new BigNumber(a.value)),
        );
      case EUtxoSortType.SmallestFirst:
        return data.toSorted((a, b) =>
          new BigNumber(a.value).comparedTo(new BigNumber(b.value)),
        );
      default:
        return data;
    }
  }, [utxoList, sortType]);

  const decimals = network?.decimals ?? 8;
  const symbol = network?.symbol ?? 'BTC';

  const totalAmount = useMemo(() => {
    const sum = utxoList.reduce(
      (acc, utxo) => acc.plus(utxo.value),
      new BigNumber(0),
    );
    return sum.shiftedBy(-decimals).toFixed();
  }, [utxoList, decimals]);

  const sortOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_newest_first,
        }),
        value: EUtxoSortType.NewestFirst,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_oldest_first,
        }),
        value: EUtxoSortType.OldestFirst,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_smallest_first,
        }),
        value: EUtxoSortType.SmallestFirst,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_largest_first,
        }),
        value: EUtxoSortType.LargestFirst,
      },
    ],
    [intl],
  );

  const currentSortLabel = useMemo(
    () => sortOptions.find((opt) => opt.value === sortType)?.label ?? '',
    [sortType, sortOptions],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: IUtxoInfo; index: number }) => (
      <UTXOListItem
        item={item}
        index={index}
        decimals={decimals}
        symbol={symbol}
        intl={intl}
        readOnly
      />
    ),
    [decimals, symbol, intl],
  );

  const keyExtractor = useCallback(
    (item: IUtxoInfo, index: number) =>
      `${sortType}-${index}-${item.txid}-${item.vout}`,
    [sortType],
  );

  const headerRightIndexedAccountId =
    currentAccount?.indexedAccountId ?? account?.indexedAccountId ?? '';
  const showDeriveTypeSelector = Boolean(
    vaultSettings?.mergeDeriveAssetsEnabled &&
    effectiveWalletId &&
    headerRightIndexedAccountId,
  );
  const headerRight = useMemo(() => {
    if (!showDeriveTypeSelector) return undefined;
    return (
      <Stack pr="$5">
        <AddressTypeSelector
          placement="bottom-end"
          walletId={effectiveWalletId ?? ''}
          networkId={networkId}
          indexedAccountId={headerRightIndexedAccountId}
          activeDeriveType={currentDeriveType}
          activeDeriveInfo={currentDeriveInfo}
          onSelect={async (value) => {
            if (value.account) {
              setCurrentAccount(value.account);
              setCurrentDeriveType(value.deriveType);
              setCurrentDeriveInfo(value.deriveInfo);
            }
          }}
        />
      </Stack>
    );
  }, [
    showDeriveTypeSelector,
    effectiveWalletId,
    networkId,
    headerRightIndexedAccountId,
    currentDeriveType,
    currentDeriveInfo,
  ]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.coins__action })}
        headerRight={headerRight ? () => headerRight : undefined}
      />
      <Page.Body>
        <YStack flex={1}>
          <XStack
            px="$5"
            py="$4"
            ai="center"
            jc="space-between"
            borderBottomWidth="$0"
          >
            <SizableText size="$headingLg" color="$text">
              {totalAmount} {symbol}
            </SizableText>
            <Select
              testID={ReceiveTestIDs.BtcCoinsSortSelect}
              title={intl.formatMessage({ id: ETranslations.market_sort_by })}
              value={sortType}
              onChange={setSortType}
              items={sortOptions}
              renderTrigger={({ onPress }) => (
                <XStack
                  ai="center"
                  onPress={onPress}
                  cursor="pointer"
                  px="$2"
                  py="$1"
                  mx="$-2"
                  my="$-1"
                  borderRadius="$2"
                  hoverStyle={{ bg: '$bgHover' }}
                  pressStyle={{ bg: '$bgActive' }}
                >
                  <SizableText
                    size="$bodyMd"
                    fontWeight="500"
                    color="$textSubdued"
                  >
                    {currentSortLabel}
                  </SizableText>
                  <Icon
                    name="ChevronDownSmallOutline"
                    size="$4"
                    color="$iconSubdued"
                  />
                </XStack>
              )}
            />
          </XStack>

          {isLoading ? (
            <Stack
              flex={1}
              alignItems="center"
              justifyContent="center"
              py="$20"
            >
              <Spinner size="large" />
            </Stack>
          ) : null}
          {!isLoading && sortedData.length === 0 ? (
            <Stack flex={1} px="$5" py="$8" alignItems="center">
              <Empty
                illustration="QuestionMark"
                title={intl.formatMessage({
                  id: ETranslations.global_no_results,
                })}
              />
            </Stack>
          ) : null}
          {!isLoading && sortedData.length > 0 ? (
            <ListView
              flex={1}
              estimatedItemSize={60}
              data={sortedData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              extraData={sortType}
            />
          ) : null}
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default BtcCoinsPage;
