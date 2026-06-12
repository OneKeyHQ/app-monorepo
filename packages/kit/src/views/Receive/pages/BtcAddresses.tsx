import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import {
  Badge,
  Divider,
  Empty,
  IconButton,
  Page,
  Pagination,
  SegmentControl,
  SizableText,
  Spinner,
  Stack,
  Table,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBtcFreshAddress } from '@onekeyhq/core/src/chains/btc/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import AddressTypeSelector from '../../../components/AddressTypeSelector/AddressTypeSelector';
import { useAccountData } from '../../../hooks/useAccountData';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useCopyAddressWithDeriveType } from '../../../hooks/useCopyAccountAddress';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { ReceiveTestIDs } from '../testIDs';

import type { RouteProp } from '@react-navigation/core';

const PAGE_SIZE = 7;
const RECEIVED_DASH = '—';

type ITabKey = 'receive' | 'change';

type IBtcAddressRow = {
  key: string;
  address: string | undefined;
  displayAddress: string;
  formattedReceived: string;
  transfers: number;
  path?: string;
  name: string;
};

type IAddressesPageResult = {
  total: number;
  items: IBtcFreshAddress[];
};

function formatAmount({
  raw,
  decimals,
  symbol,
  fallback,
}: {
  raw: string | undefined;
  decimals: number;
  symbol: string;
  fallback: string;
}): string {
  const value = new BigNumber(raw ?? '0').shiftedBy(-decimals);
  if (value.isNaN() || !value.isFinite()) return fallback;
  return `${
    formatBalance(value.toFixed(), { disableThousandSeparator: true })
      .formattedValue
  } ${symbol}`;
}

function toRow({
  item,
  decimals,
  symbol,
  receivedAsDash,
}: {
  item: IBtcFreshAddress;
  decimals: number;
  symbol: string;
  receivedAsDash?: boolean;
}): IBtcAddressRow {
  const address = item.address;
  const displayAddress = address
    ? accountUtils.shortenAddress({
        address,
        leadingLength: 8,
        trailingLength: 6,
      })
    : '-';
  return {
    key: `${item.name}-${item.path}`,
    address,
    displayAddress,
    formattedReceived: receivedAsDash
      ? RECEIVED_DASH
      : formatAmount({
          raw: item.totalReceived,
          decimals,
          symbol,
          fallback: '-',
        }),
    transfers: item.transfers,
    path: item.path,
    name: item.name,
  };
}

function AddressTable({
  rows,
  receivedHeader,
  addressHeader,
  onCopy,
  onRowPress,
}: {
  rows: IBtcAddressRow[];
  addressHeader: string;
  receivedHeader: string;
  onCopy: (row: IBtcAddressRow) => void;
  onRowPress?: (row: IBtcAddressRow) => void;
}) {
  const headerTitleProps = {
    size: '$bodySmMedium',
    color: '$textSubdued',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    numberOfLines: 1,
    whiteSpace: 'nowrap',
  } as const;
  return (
    <Table
      dataSource={rows}
      scrollEnabled={false}
      contentContainerStyle={{
        gap: '$2',
        px: '$0',
        $gtMd: { gap: '$1' },
      }}
      columns={[
        {
          title: addressHeader,
          dataIndex: 'displayAddress',
          titleProps: headerTitleProps,
          columnProps: { flex: 1, minWidth: 0 },
          render: (_, record) => (
            <SizableText size="$bodyMd" color="$text" numberOfLines={1}>
              {record.displayAddress}
            </SizableText>
          ),
        },
        {
          title: receivedHeader,
          dataIndex: 'formattedReceived',
          align: 'right',
          titleProps: headerTitleProps,
          columnProps: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '$2',
            minWidth: 140,
            overflow: 'visible',
          },
          render: (text, record) => (
            <>
              <SizableText
                size="$bodyMd"
                color="$text"
                numberOfLines={1}
                whiteSpace="nowrap"
              >
                {text}
              </SizableText>
              <IconButton
                testID={ReceiveTestIDs.BtcAddressCopyButton}
                variant="tertiary"
                size="small"
                icon="Copy3Outline"
                disabled={!record.address}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onCopy(record);
                }}
              />
            </>
          ),
        },
      ]}
      keyExtractor={(item) => item.key}
      onRow={(record) => ({
        onPress: () => (onRowPress ?? onCopy)(record),
      })}
      rowProps={{
        mx: '$2',
        px: '$3',
        py: '$2.5',
        minHeight: 44,
        alignItems: 'center',
        borderRadius: '$3',
        overflow: 'visible',
        $gtMd: {
          py: '$2',
          minHeight: 40,
        },
      }}
      headerRowProps={{
        mx: '$2',
        px: '$3',
        py: '$2',
        minHeight: 36,
        alignItems: 'center',
      }}
    />
  );
}

function NextAddressRow({
  row,
  nextLabel,
  onCopy,
  onRowPress,
}: {
  row: IBtcAddressRow;
  nextLabel: string;
  onCopy: (row: IBtcAddressRow) => void;
  onRowPress: (row: IBtcAddressRow) => void;
}) {
  return (
    <XStack
      mx="$4"
      px="$3"
      py="$2.5"
      gap="$2"
      alignItems="center"
      borderRadius="$3"
      borderWidth={1}
      borderColor="$borderSubdued"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={() => {
        if (!row.address) return;
        onRowPress(row);
      }}
    >
      <Badge badgeType="info" badgeSize="sm">
        <Badge.Text>{nextLabel}</Badge.Text>
      </Badge>
      <SizableText size="$bodyMd" color="$text" numberOfLines={1} flex={1}>
        {row.displayAddress}
      </SizableText>
      <IconButton
        testID={ReceiveTestIDs.BtcNextAddressCopyButton}
        variant="tertiary"
        size="small"
        icon="Copy3Outline"
        disabled={!row.address}
        onPress={(e) => {
          e?.stopPropagation?.();
          onCopy(row);
        }}
      />
    </XStack>
  );
}

function BtcAddresses() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IModalReceiveParamList, EModalReceiveRoutes.BtcAddresses>
    >();
  const {
    accountId,
    networkId,
    deriveInfo: deriveInfoFromRoute,
    walletId: routeWalletId,
  } = route.params;

  const navigation = useAppNavigation();

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
  const effectiveWalletId =
    routeWalletId ??
    wallet?.id ??
    accountUtils.getWalletIdFromAccountId({ accountId });
  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();

  const [currentAccount, setCurrentAccount] = useState<
    INetworkAccount | undefined
  >(account);
  const [currentDeriveType, setCurrentDeriveType] = useState<
    IAccountDeriveTypes | undefined
  >(deriveTypeFromHook);
  const [currentDeriveInfo, setCurrentDeriveInfo] = useState<
    IAccountDeriveInfo | undefined
  >(deriveInfoFromRoute ?? deriveInfoFromHook);

  // Sync state once useAccountData resolves (route initial load).
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
  const effectiveDeriveInfo = currentDeriveInfo;
  const isHardwareAccount = accountUtils.isHwAccount({
    accountId: effectiveAccountId,
  });

  const [activeTab, setActiveTab] = useState<ITabKey>('receive');
  const [receivePage, setReceivePage] = useState(1);
  const [changePage, setChangePage] = useState(1);

  useEffect(() => {
    setReceivePage(1);
    setChangePage(1);
  }, [effectiveAccountId, networkId, currentDeriveType]);

  const decimals = network?.decimals ?? 8;
  const symbol = network?.symbol ?? 'BTC';

  const { result: nextFresh, run: refreshNextFresh } = usePromiseResult(
    async () => {
      if (!effectiveAccountId || !networkId)
        return { next: undefined, totalFresh: 0 };
      try {
        return await backgroundApiProxy.serviceFreshAddress.getBtcNextFreshAddress(
          {
            accountId: effectiveAccountId,
            networkId,
            deriveType: currentDeriveType,
          },
        );
      } catch (error) {
        console.error(error);
        return { next: undefined, totalFresh: 0 };
      }
    },
    [effectiveAccountId, networkId, currentDeriveType],
    { initResult: { next: undefined, totalFresh: 0 } },
  );

  const { result: nextChange, run: refreshNextChange } = usePromiseResult(
    async () => {
      if (!effectiveAccountId || !networkId) return { next: undefined };
      try {
        return await backgroundApiProxy.serviceFreshAddress.getBtcNextChangeAddress(
          {
            accountId: effectiveAccountId,
            networkId,
            deriveType: currentDeriveType,
          },
        );
      } catch (error) {
        console.error(error);
        return { next: undefined };
      }
    },
    [effectiveAccountId, networkId, currentDeriveType],
    { initResult: { next: undefined } },
  );

  const {
    result: usedResult,
    isLoading: usedLoading,
    run: refreshUsedAddresses,
  } = usePromiseResult<IAddressesPageResult>(
    async () => {
      if (!effectiveAccountId || !networkId) return { total: 0, items: [] };
      try {
        return await backgroundApiProxy.serviceFreshAddress.getBtcUsedAddressesByPage(
          {
            accountId: effectiveAccountId,
            networkId,
            deriveType: currentDeriveType,
            page: receivePage,
            pageSize: PAGE_SIZE,
          },
        );
      } catch (error) {
        console.error(error);
        return { total: 0, items: [] };
      }
    },
    [effectiveAccountId, networkId, receivePage, currentDeriveType],
    { initResult: { total: 0, items: [] }, watchLoading: true },
  );

  const {
    result: changeResult,
    isLoading: changeLoading,
    run: refreshChangeAddresses,
  } = usePromiseResult<IAddressesPageResult>(
    async () => {
      if (!effectiveAccountId || !networkId) return { total: 0, items: [] };
      try {
        return await backgroundApiProxy.serviceFreshAddress.getBtcChangeAddressesByPage(
          {
            accountId: effectiveAccountId,
            networkId,
            deriveType: currentDeriveType,
            page: changePage,
            pageSize: PAGE_SIZE,
          },
        );
      } catch (error) {
        console.error(error);
        return { total: 0, items: [] };
      }
    },
    [effectiveAccountId, networkId, changePage, currentDeriveType],
    { initResult: { total: 0, items: [] }, watchLoading: true },
  );

  useEffect(() => {
    if (!effectiveAccountId || !networkId) return;
    void backgroundApiProxy.serviceFreshAddress.syncBTCFreshAddressByAccountId({
      accountId: effectiveAccountId,
      networkId,
    });
  }, [effectiveAccountId, networkId]);

  const throttledRefreshOnEvent = useThrottledCallback(
    () => {
      void refreshNextFresh();
      void refreshNextChange();
      void refreshUsedAddresses();
      void refreshChangeAddresses();
    },
    timerUtils.getTimeDurationMs({ seconds: 1 }),
    { leading: true, trailing: true },
  );

  useEffect(() => {
    const handler = () => {
      throttledRefreshOnEvent();
    };
    appEventBus.on(EAppEventBusNames.BtcFreshAddressUpdated, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.BtcFreshAddressUpdated, handler);
    };
  }, [throttledRefreshOnEvent]);

  const usedRows = useMemo(
    () => usedResult.items.map((item) => toRow({ item, decimals, symbol })),
    [usedResult.items, decimals, symbol],
  );

  const changeRows = useMemo(
    () => changeResult.items.map((item) => toRow({ item, decimals, symbol })),
    [changeResult.items, decimals, symbol],
  );

  const nextReceiveRow = useMemo(() => {
    if (!nextFresh.next) return undefined;
    return toRow({
      item: nextFresh.next,
      decimals,
      symbol,
      receivedAsDash: true,
    });
  }, [nextFresh.next, decimals, symbol]);

  const nextChangeRow = useMemo(() => {
    if (!nextChange.next) return undefined;
    return toRow({
      item: nextChange.next,
      decimals,
      symbol,
      receivedAsDash: true,
    });
  }, [nextChange.next, decimals, symbol]);

  const usedTotalPages = Math.max(1, Math.ceil(usedResult.total / PAGE_SIZE));
  const changeTotalPages = Math.max(
    1,
    Math.ceil(changeResult.total / PAGE_SIZE),
  );

  useEffect(() => {
    setReceivePage((prev) => Math.min(prev, usedTotalPages));
  }, [usedTotalPages]);

  useEffect(() => {
    setChangePage((prev) => Math.min(prev, changeTotalPages));
  }, [changeTotalPages]);

  const copyAndShowOnDevice = useCallback(
    (row: IBtcAddressRow) => {
      if (!row?.address) return;

      if (isHardwareAccount) {
        if (!effectiveWalletId || !row.path) {
          copyAddressWithDeriveType({
            address: row.address,
            deriveInfo: effectiveDeriveInfo,
            networkName: network?.name,
          });
          return;
        }
        navigation.push(EModalReceiveRoutes.ReceiveToken, {
          networkId,
          accountId: effectiveAccountId,
          walletId: effectiveWalletId,
          indexedAccountId:
            currentAccount?.indexedAccountId ?? account?.indexedAccountId,
          btcUsedAddress: row.address,
          btcUsedAddressPath: row.path,
          disableSelector: true,
        });
        return;
      }

      copyAddressWithDeriveType({
        address: row.address,
        deriveInfo: effectiveDeriveInfo,
        networkName: network?.name,
      });
    },
    [
      account?.indexedAccountId,
      copyAddressWithDeriveType,
      currentAccount?.indexedAccountId,
      effectiveAccountId,
      effectiveDeriveInfo,
      effectiveWalletId,
      isHardwareAccount,
      navigation,
      network?.name,
      networkId,
    ],
  );

  const copyOnly = useCallback(
    (row: IBtcAddressRow) => {
      if (!row?.address) return;
      copyAddressWithDeriveType({
        address: row.address,
        deriveInfo: effectiveDeriveInfo,
        networkName: network?.name,
      });
    },
    [copyAddressWithDeriveType, effectiveDeriveInfo, network?.name],
  );

  const copyAddress = isHardwareAccount ? copyAndShowOnDevice : copyOnly;

  const receivedHeader = intl.formatMessage({
    id: ETranslations.wallet_total_received,
  });
  const usedLabel = intl.formatMessage({
    id: ETranslations.address_list_section_used__title,
  });
  const nextLabel = intl.formatMessage({
    id: ETranslations.address_list_next__action,
  });

  const receiveLoading =
    Boolean(usedLoading) &&
    usedResult.total === 0 &&
    usedResult.items.length === 0 &&
    !nextReceiveRow;

  const changeLoadingInitial =
    Boolean(changeLoading) &&
    changeResult.total === 0 &&
    changeResult.items.length === 0 &&
    !nextChangeRow;

  const segmentOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.global_receive }),
        value: 'receive' as const,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.address_list_tab_change__action,
        }),
        value: 'change' as const,
      },
    ],
    [intl],
  );

  const showFooterPagination =
    activeTab === 'receive' ? usedTotalPages > 1 : changeTotalPages > 1;
  const footerCurrent = activeTab === 'receive' ? receivePage : changePage;
  const footerTotal =
    activeTab === 'receive' ? usedTotalPages : changeTotalPages;
  const footerOnChange =
    activeTab === 'receive' ? setReceivePage : setChangePage;

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
    <Page testID={ReceiveTestIDs.BtcAddressesPage}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_list__action,
        })}
        headerRight={headerRight ? () => headerRight : undefined}
      />
      <Page.Body>
        <YStack flex={1} pt="$4" pb="$2" gap="$4">
          <XStack px="$5">
            <SegmentControl
              fullWidth
              value={activeTab}
              onChange={(v) => setActiveTab(v as ITabKey)}
              options={segmentOptions}
            />
          </XStack>

          {activeTab === 'receive' ? (
            <YStack flex={1} gap="$4">
              {nextReceiveRow ? (
                <NextAddressRow
                  row={nextReceiveRow}
                  nextLabel={nextLabel}
                  onCopy={copyAddress}
                  onRowPress={copyAddress}
                />
              ) : (
                <Stack px="$5">
                  <SizableText size="$bodySm" color="$textSubdued">
                    —
                  </SizableText>
                </Stack>
              )}

              <Divider mx="$5" />

              <YStack testID={ReceiveTestIDs.BtcAddressTable} flex={1}>
                {receiveLoading ? (
                  <XStack
                    flex={1}
                    justifyContent="center"
                    alignItems="center"
                    py="$8"
                  >
                    <Spinner size="large" />
                  </XStack>
                ) : null}
                {!receiveLoading && usedRows.length > 0 ? (
                  <AddressTable
                    rows={usedRows}
                    addressHeader={`${usedLabel} · ${usedResult.total}`}
                    receivedHeader={receivedHeader}
                    onCopy={copyAddress}
                    onRowPress={copyAddress}
                  />
                ) : null}
                {!receiveLoading && usedRows.length === 0 ? (
                  <Stack flex={1} px="$5" py="$8" alignItems="center">
                    <Empty
                      illustration="QuestionMark"
                      title={intl.formatMessage({
                        id: ETranslations.global_no_results,
                      })}
                      description={intl.formatMessage({
                        id: ETranslations.wallet_no_used_addresses_description,
                      })}
                    />
                  </Stack>
                ) : null}
              </YStack>
            </YStack>
          ) : (
            <YStack flex={1} gap="$4">
              {nextChangeRow ? (
                <NextAddressRow
                  row={nextChangeRow}
                  nextLabel={nextLabel}
                  onCopy={copyAddress}
                  onRowPress={copyAddress}
                />
              ) : (
                <Stack px="$5">
                  <SizableText size="$bodySm" color="$textSubdued">
                    —
                  </SizableText>
                </Stack>
              )}

              <Divider mx="$5" />

              <YStack flex={1}>
                {changeLoadingInitial ? (
                  <XStack
                    flex={1}
                    justifyContent="center"
                    alignItems="center"
                    py="$8"
                  >
                    <Spinner size="large" />
                  </XStack>
                ) : null}
                {!changeLoadingInitial && changeRows.length > 0 ? (
                  <AddressTable
                    rows={changeRows}
                    addressHeader={`${usedLabel} · ${changeResult.total}`}
                    receivedHeader={receivedHeader}
                    onCopy={copyAddress}
                    onRowPress={copyAddress}
                  />
                ) : null}
                {!changeLoadingInitial && changeRows.length === 0 ? (
                  <Stack flex={1} px="$5" py="$8" alignItems="center">
                    <Empty
                      illustration="QuestionMark"
                      title={intl.formatMessage({
                        id: ETranslations.global_no_results,
                      })}
                    />
                  </Stack>
                ) : null}
              </YStack>
            </YStack>
          )}
        </YStack>
      </Page.Body>
      {showFooterPagination ? (
        <Page.Footer>
          <XStack justifyContent="flex-end" py="$6" px="$5">
            <Pagination
              testID={ReceiveTestIDs.BtcAddressPagination}
              current={footerCurrent}
              total={footerTotal}
              onChange={footerOnChange}
              siblingCount={0}
              pageButtonSize="small"
            />
          </XStack>
        </Page.Footer>
      ) : null}
    </Page>
  );
}

export default BtcAddresses;
