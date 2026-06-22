import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import {
  ActionList,
  Button,
  Divider,
  Empty,
  Icon,
  IconButton,
  Page,
  Pagination,
  ScrollView,
  SegmentControl,
  SizableText,
  Spinner,
  Stack,
  Table,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type {
  IBtcFindAddressItem,
  IBtcFreshAddress,
} from '@onekeyhq/core/src/chains/btc/types';
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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
import {
  BtcAddressText,
  BtcFindAddressSection,
} from '../components/BtcFindAddress';
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
    size: '$headingSm',
    color: '$text',
    numberOfLines: 1,
    whiteSpace: 'nowrap',
  } as const;
  return (
    <Table
      dataSource={rows}
      scrollEnabled={false}
      contentContainerStyle={{
        px: '$0',
      }}
      columns={[
        {
          title: addressHeader,
          dataIndex: 'displayAddress',
          titleProps: headerTitleProps,
          columnProps: { flex: 1, minWidth: 0 },
          render: (_, record) => (
            <XStack alignItems="center" gap="$1.5" minWidth={0}>
              <BtcAddressText
                displayAddress={record.displayAddress}
                address={record.address}
                copyTestID={ReceiveTestIDs.BtcAddressCopyButton}
              />
            </XStack>
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
            minWidth: 140,
          },
          render: (text) => (
            <SizableText
              size="$bodyMd"
              color="$text"
              numberOfLines={1}
              whiteSpace="nowrap"
            >
              {text}
            </SizableText>
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
        userSelect: 'none',
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
  onRowPress,
}: {
  row: IBtcAddressRow;
  nextLabel: string;
  onRowPress: (row: IBtcAddressRow) => void;
}) {
  return (
    <YStack>
      <SizableText px="$5" size="$headingSm" color="$text">
        {nextLabel}
      </SizableText>
      <XStack
        mx="$2"
        px="$3"
        py="$2.5"
        minHeight={44}
        gap="$1.5"
        alignItems="center"
        borderRadius="$3"
        userSelect="none"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        $gtMd={{ py: '$2', minHeight: 40 }}
        onPress={() => {
          if (!row.address) return;
          onRowPress(row);
        }}
      >
        <BtcAddressText
          displayAddress={row.displayAddress}
          address={row.address}
          copyTestID={ReceiveTestIDs.BtcNextAddressCopyButton}
        />
      </XStack>
    </YStack>
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
  // hw and qr accounts can both verify an arbitrary-path address on the
  // device/offline screen (ReceiveToken supports both wallet kinds)
  const isHardwareAccount =
    accountUtils.isHwAccount({
      accountId: effectiveAccountId,
    }) ||
    accountUtils.isQrAccount({
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

  const addressTypeLabel = useMemo(() => {
    if (effectiveDeriveInfo?.labelKey) {
      return intl.formatMessage({ id: effectiveDeriveInfo.labelKey });
    }
    return effectiveDeriveInfo?.label ?? '';
  }, [effectiveDeriveInfo, intl]);

  // find-address is only available for account types whose claimed
  // addresses can be spent (hd) or verified on a device (hw/qr)
  const showFindAddressEntry =
    accountUtils.isHdAccount({ accountId: effectiveAccountId }) ||
    accountUtils.isHwAccount({ accountId: effectiveAccountId }) ||
    accountUtils.isQrAccount({ accountId: effectiveAccountId });

  const onPressFindAddress = useCallback(() => {
    const accountPath = currentAccount?.path ?? account?.path;
    if (!accountPath) return;
    defaultLogger.transaction.findAddress.findAddressOpened({ networkId });
    navigation.push(EModalReceiveRoutes.BtcFindAddress, {
      accountId: effectiveAccountId,
      networkId,
      accountName: currentAccount?.name ?? account?.name ?? '',
      accountPath,
      addressTypeLabel,
      deriveType: currentDeriveType ?? '',
    });
  }, [
    account?.name,
    account?.path,
    addressTypeLabel,
    currentAccount?.name,
    currentAccount?.path,
    currentDeriveType,
    effectiveAccountId,
    navigation,
    networkId,
  ]);

  const copyFindAddress = useCallback(
    (item: IBtcFindAddressItem) => {
      defaultLogger.transaction.findAddress.claimedAddressCopied({
        networkId,
      });
      copyAddress({
        key: item.relPath,
        address: item.address,
        displayAddress: item.address,
        formattedReceived: '',
        transfers: 0,
        path: item.path,
        name: item.address,
      });
    },
    [copyAddress, networkId],
  );

  return (
    <Page testID={ReceiveTestIDs.BtcAddressesPage}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_list__action,
        })}
      />
      <Page.Body>
        <YStack flex={1} pt="$2" pb="$2" gap="$4">
          <XStack
            px="$5"
            alignItems="center"
            justifyContent="space-between"
            gap="$3"
          >
            <SegmentControl
              value={activeTab}
              onChange={(v) => setActiveTab(v as ITabKey)}
              options={segmentOptions}
            />
            <XStack alignItems="center" gap="$2.5">
              {showDeriveTypeSelector && addressTypeLabel ? (
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
                  renderSelectorTrigger={
                    <Button
                      testID={ReceiveTestIDs.BtcAddressTypeSelector}
                      size="small"
                      variant="tertiary"
                      childrenAsText={false}
                    >
                      <XStack alignItems="center" gap="$1">
                        <SizableText size="$bodyMdMedium" color="$textSubdued">
                          {addressTypeLabel}
                        </SizableText>
                        <Icon
                          name="ChevronDownSmallOutline"
                          size="$4.5"
                          color="$iconSubdued"
                        />
                      </XStack>
                    </Button>
                  }
                />
              ) : null}
              {showFindAddressEntry ? (
                <ActionList
                  title=""
                  renderTrigger={
                    <IconButton
                      testID={ReceiveTestIDs.BtcFindAddressEntry}
                      icon="DotHorOutline"
                      variant="tertiary"
                      size="small"
                    />
                  }
                  sections={[
                    {
                      items: [
                        {
                          icon: 'SearchOutline',
                          label: intl.formatMessage({
                            id: ETranslations.find_address__action,
                          }),
                          onPress: onPressFindAddress,
                        },
                      ],
                    },
                  ]}
                />
              ) : null}
            </XStack>
          </XStack>

          <Divider />

          {activeTab === 'receive' ? (
            <ScrollView
              flex={1}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: '$4', flexGrow: 1, pb: '$2' }}
            >
              {showFindAddressEntry ? (
                <BtcFindAddressSection
                  accountId={effectiveAccountId}
                  networkId={networkId}
                  decimals={decimals}
                  symbol={symbol}
                  onCopy={copyFindAddress}
                />
              ) : null}
              {nextReceiveRow ? (
                <NextAddressRow
                  row={nextReceiveRow}
                  nextLabel={nextLabel}
                  onRowPress={copyAddress}
                />
              ) : (
                <Stack px="$5">
                  <SizableText size="$bodySm" color="$textSubdued">
                    —
                  </SizableText>
                </Stack>
              )}

              {receiveLoading ? (
                <XStack justifyContent="center" alignItems="center" py="$8">
                  <Spinner size="large" />
                </XStack>
              ) : null}
              {!receiveLoading && usedRows.length > 0 ? (
                <YStack testID={ReceiveTestIDs.BtcAddressTable}>
                  <AddressTable
                    rows={usedRows}
                    addressHeader={`${usedLabel} (${usedResult.total})`}
                    receivedHeader={receivedHeader}
                    onCopy={copyAddress}
                    onRowPress={copyAddress}
                  />
                </YStack>
              ) : null}
              {!receiveLoading && usedRows.length === 0 ? (
                <Stack px="$5" py="$8" alignItems="center">
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
            </ScrollView>
          ) : (
            <ScrollView
              flex={1}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: '$4', flexGrow: 1, pb: '$2' }}
            >
              {nextChangeRow ? (
                <NextAddressRow
                  row={nextChangeRow}
                  nextLabel={nextLabel}
                  onRowPress={copyAddress}
                />
              ) : (
                <Stack px="$5">
                  <SizableText size="$bodySm" color="$textSubdued">
                    —
                  </SizableText>
                </Stack>
              )}
              {changeLoadingInitial ? (
                <XStack justifyContent="center" alignItems="center" py="$8">
                  <Spinner size="large" />
                </XStack>
              ) : null}
              {!changeLoadingInitial && changeRows.length > 0 ? (
                <AddressTable
                  rows={changeRows}
                  addressHeader={`${usedLabel} (${changeResult.total})`}
                  receivedHeader={receivedHeader}
                  onCopy={copyAddress}
                  onRowPress={copyAddress}
                />
              ) : null}
              {!changeLoadingInitial && changeRows.length === 0 ? (
                <Stack px="$5" py="$8" alignItems="center">
                  <Empty
                    illustration="QuestionMark"
                    title={intl.formatMessage({
                      id: ETranslations.global_no_results,
                    })}
                  />
                </Stack>
              ) : null}
            </ScrollView>
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
