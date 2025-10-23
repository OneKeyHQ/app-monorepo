import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';

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
} from '@onekeyhq/components';
import type { IBtcFreshAddress } from '@onekeyhq/core/src/chains/btc/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  EModalReceiveRoutes,
  IModalReceiveParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';

import { useAccountData } from '../../../hooks/useAccountData';
import { useCopyAddressWithDeriveType } from '../../../hooks/useCopyAccountAddress';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { RouteProp } from '@react-navigation/core';

const PAGE_SIZE = 20;

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
  const { accountId, networkId, deriveInfo } = route.params;

  const { account, network } = useAccountData({
    accountId,
    networkId,
  });
  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();
  const [currentPage, setCurrentPage] = useState(1);

  const utxoAccount = account as IDBUtxoAccount | undefined;
  const accountXpubSegwit = utxoAccount?.xpubSegwit;
  const accountXpub = utxoAccount?.xpub;

  const { result: usedAddresses, isLoading } = usePromiseResult<
    IBtcFreshAddress[]
  >(
    async () => {
      if (!networkId || !utxoAccount) {
        return [];
      }
      const xpubSegwit = accountXpubSegwit ?? accountXpub;
      if (!xpubSegwit) {
        return [];
      }
      try {
        const record =
          await backgroundApiProxy.simpleDb.btcFreshAddress.getBTCFreshAddresses(
            {
              networkId,
              xpubSegwit,
            },
          );

        const freshUsed = record?.fresh?.used ?? [];
        const filtered = freshUsed.filter((item) => item.transfers > 0);
        filtered.sort((a, b) => {
          const infoA = parsePathIndex(a.path);
          const infoB = parsePathIndex(b.path);
          if (infoA.branch !== infoB.branch) {
            return infoA.branch - infoB.branch;
          }
          return infoB.index - infoA.index;
        });
        return filtered;
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    [networkId, accountXpubSegwit, accountXpub, utxoAccount],
    { initResult: [] as IBtcFreshAddress[], watchLoading: true },
  );

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
      copyAddressWithDeriveType({
        address,
        deriveInfo,
        networkName: network?.shortname,
      });
    },
    [copyAddressWithDeriveType, deriveInfo, network],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const showPagination = rows.length > PAGE_SIZE;
  const isInitialLoading = Boolean(isLoading) && usedAddresses.length === 0;
  const hasRows = pagedRows.length > 0;

  return (
    <Page>
      <Page.Header title="Used addresses" />
      <Page.Body px="$0" py="$5">
        <YStack flex={1} width="100%" alignSelf="center">
          {isInitialLoading ? (
            <XStack flex={1} justifyContent="center" alignItems="center">
              <Spinner size="large" />
            </XStack>
          ) : (
            <YStack flex={1} gap="$6">
              {hasRows ? (
                <Table
                  dataSource={pagedRows}
                  contentContainerStyle={{ gap: '$3', px: '$0', pb: '$12' }}
                  columns={[
                    {
                      title: 'Address',
                      dataIndex: 'displayAddress',
                      titleProps: {
                        size: '$bodyMdMedium',
                        color: '$textSubdued',
                        numberOfLines: 1,
                      },
                      columnProps: { flex: 1, minWidth: 0 },
                      render: (_, record) => (
                        <SizableText
                          size="$bodyMd"
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
                        size: '$bodyMdMedium',
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
                            size="$bodyMd"
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
                />
              ) : (
                <XStack flex={1} justifyContent="center" alignItems="center">
                  <Empty
                    icon="SearchOutline"
                    title="No Results"
                    description="Used addresses will appear after your first incoming transaction."
                  />
                </XStack>
              )}
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
