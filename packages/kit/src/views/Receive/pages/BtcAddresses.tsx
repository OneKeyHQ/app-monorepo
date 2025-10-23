import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useThrottledCallback } from 'use-debounce';

import {
  Empty,
  IconButton,
  Page,
  Pagination,
  SizableText,
  Spinner,
  Table,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { IBtcFreshAddress } from '@onekeyhq/core/src/chains/btc/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type {
  EModalReceiveRoutes,
  IModalReceiveParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useAccountData } from '../../../hooks/useAccountData';

import type { RouteProp } from '@react-navigation/core';

const PAGE_SIZE = 20;
const ENABLE_MOCK_DATA = true;
const MOCK_ADDRESS_PREFIX = 'bc1mockq68';

type IBtcAddressRow = {
  key: string;
  address: string;
  displayAddress: string;
  formattedTotalReceived: string;
  transfers: number;
};

function parsePathIndex(path: string) {
  const segments = path.split('/');
  const branch = Number.parseInt(segments[4] ?? '0', 10);
  const index = Number.parseInt(segments[5] ?? '0', 10);
  if (Number.isNaN(branch) || Number.isNaN(index)) {
    return { branch: 0, index: 0 };
  }
  return { branch, index };
}

function BtcAddresses() {
  const route =
    useRoute<
      RouteProp<IModalReceiveParamList, EModalReceiveRoutes.BtcAddresses>
    >();
  const { accountId, networkId } = route.params;

  const { account, network } = useAccountData({
    accountId,
    networkId,
  });
  const { copyText } = useClipboard();
  const [usedAddresses, setUsedAddresses] = useState<IBtcFreshAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const mockAddresses = useMemo(() => {
    if (!ENABLE_MOCK_DATA) {
      return undefined;
    }
    return Array.from({ length: 200 }, (_, index) => {
      const branch = index < 100 ? 0 : 1;
      const addressIndex = branch === 0 ? index : index - 100;
      const totalReceived = new BigNumber(index + 1)
        .dividedBy(10)
        .shiftedBy(8)
        .integerValue(BigNumber.ROUND_FLOOR)
        .toFixed(0);
      const address = `${MOCK_ADDRESS_PREFIX}${(index + 1)
        .toString()
        .padStart(5, '0')}`;
      return {
        address,
        name: address,
        path: `m/84'/0'/0'/${branch}/${addressIndex}`,
        transfers: index % 7 === 0 ? 3 : 1,
        isDerivedByApp: true,
        totalReceived,
      } as IBtcFreshAddress;
    });
  }, []);

  const loadAddresses = useCallback(async () => {
    if (!account || !networkId) {
      setUsedAddresses([]);
      return;
    }
    const utxoAccount = account as IDBUtxoAccount;
    const xpubSegwit = utxoAccount.xpubSegwit ?? utxoAccount.xpub;
    if (!xpubSegwit) {
      setUsedAddresses([]);
      return;
    }
    setIsLoading(true);
    try {
      const record =
        await backgroundApiProxy.simpleDb.btcFreshAddress.getBTCFreshAddresses({
          networkId,
          xpubSegwit,
        });

      const freshUsed = record?.fresh?.used ?? [];
      const changeUsed = record?.change?.used ?? [];
      const filtered = [...freshUsed, ...changeUsed].filter(
        (item) => item.transfers > 0,
      );
      filtered.sort((a, b) => {
        const infoA = parsePathIndex(a.path);
        const infoB = parsePathIndex(b.path);
        if (infoA.branch !== infoB.branch) {
          return infoA.branch - infoB.branch;
        }
        return infoB.index - infoA.index;
      });
      setUsedAddresses(filtered);
    } catch (error) {
      console.error(error);
      setUsedAddresses([]);
    } finally {
      setIsLoading(false);
    }
  }, [account, networkId]);

  const throttledReload = useThrottledCallback(
    () => {
      void loadAddresses();
    },
    timerUtils.getTimeDurationMs({ seconds: 1 }),
    { leading: true, trailing: true },
  );

  useEffect(() => {
    if (ENABLE_MOCK_DATA) {
      if (mockAddresses) {
        setUsedAddresses(mockAddresses);
      }
      return;
    }
    void loadAddresses();
  }, [loadAddresses, mockAddresses]);

  useEffect(() => {
    if (ENABLE_MOCK_DATA) {
      return;
    }
    if (!account || !networkId) {
      return;
    }
    void backgroundApiProxy.serviceAccountProfile.syncBTCFreshAddressByAccountId(
      {
        accountId: account.id,
        networkId,
      },
    );
  }, [account, networkId]);

  useEffect(() => {
    if (ENABLE_MOCK_DATA) {
      return;
    }
    const handler = () => {
      throttledReload();
    };
    appEventBus.on(EAppEventBusNames.BtcFreshAddressUpdated, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.BtcFreshAddressUpdated, handler);
    };
  }, [throttledReload]);

  const rows = useMemo<IBtcAddressRow[]>(() => {
    const decimals = network?.decimals ?? 8;
    const symbol = network?.symbol ?? 'BTC';
    return usedAddresses.map((item) => {
      const raw = new BigNumber(item.totalReceived ?? '0');
      const value = raw.shiftedBy(-decimals);
      const formatted =
        value.isNaN() || !value.isFinite()
          ? '-'
          : `${
              formatBalance(value.toFixed(), {
                disableThousandSeparator: true,
              }).formattedValue
            } ${symbol}`;
      const address = item.address ?? item.name;
      return {
        key: `${item.name}-${item.path}`,
        address,
        displayAddress: accountUtils.shortenAddress({
          address,
          leadingLength: 10,
          trailingLength: 8,
        }),
        formattedTotalReceived: formatted,
        transfers: item.transfers,
      };
    });
  }, [network, usedAddresses]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [rows.length]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);

  const handleCopy = useCallback(
    (address: string) => {
      if (!address) return;
      copyText(address);
    },
    [copyText],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const showPagination = rows.length > PAGE_SIZE;
  const isInitialLoading = isLoading && usedAddresses.length === 0;

  return (
    <Page>
      <Page.Header title="BTC used addresses" />
      <Page.Body px="$0" py="$5">
        <YStack width="100%" alignSelf="center">
          {isInitialLoading ? (
            <XStack justifyContent="center" py="$10">
              <Spinner size="large" />
            </XStack>
          ) : (
            <YStack gap="$6">
              <Table
                dataSource={pagedRows}
                contentContainerStyle={{ gap: '$3', px: '$0' }}
                columns={[
                  {
                    title: 'Address',
                    dataIndex: 'displayAddress',
                    titleProps: {
                      size: '$bodySm',
                      color: '$textSubdued',
                      numberOfLines: 1,
                    },
                    columnProps: { flex: 1, minWidth: 0 },
                    render: (_, record) => (
                      <SizableText
                        size="$bodySm"
                        color="$text"
                        numberOfLines={1}
                      >
                        {record.displayAddress}
                      </SizableText>
                    ),
                  },
                  {
                    title: 'Total received',
                    dataIndex: 'formattedTotalReceived',
                    align: 'right',
                    titleProps: {
                      size: '$bodySm',
                      color: '$textSubdued',
                      numberOfLines: 1,
                      whiteSpace: 'nowrap',
                    },
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
                          size="$bodySm"
                          color="$text"
                          numberOfLines={1}
                          whiteSpace="nowrap"
                        >
                          {text}
                        </SizableText>
                        <IconButton
                          variant="tertiary"
                          size="small"
                          icon="Copy3Outline"
                          title="Copy address"
                          titlePlacement="left"
                          onPress={() => handleCopy(record.address)}
                        />
                      </>
                    ),
                  },
                ]}
                keyExtractor={(item) => item.key}
                rowProps={{
                  mx: '$0',
                  px: '$5',
                  py: '$1',
                  minHeight: 28,
                  alignItems: 'center',
                  borderRadius: 0,
                  overflow: 'visible',
                }}
                headerRowProps={{
                  mx: '$0',
                  px: '$5',
                  py: '$2',
                  minHeight: 36,
                  alignItems: 'center',
                }}
                TableEmptyComponent={
                  <Empty
                    icon="ColorOutline"
                    title="No used addresses yet"
                    description="Addresses will show up here after you receive Bitcoin."
                  />
                }
              />
            </YStack>
          )}
        </YStack>
      </Page.Body>
      <Page.Footer>
        {showPagination ? (
          <XStack justifyContent="flex-end" py="$6" px="$5">
            <Pagination
              current={currentPage}
              total={totalPages}
              onChange={setCurrentPage}
              showControls={false}
              siblingCount={0}
              maxPages={3}
              pageButtonSize="small"
            />
          </XStack>
        ) : null}
      </Page.Footer>
    </Page>
  );
}

export default BtcAddresses;
