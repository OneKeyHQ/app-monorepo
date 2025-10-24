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

type IBtcAddressesPageResult = {
  total: number;
  items: IBtcFreshAddress[];
};

function BtcAddresses() {
  const route =
    useRoute<
      RouteProp<IModalReceiveParamList, EModalReceiveRoutes.BtcAddresses>
    >();
  const { accountId, networkId, deriveInfo } = route.params;

  const { network } = useAccountData({
    accountId,
    networkId,
  });
  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [accountId, networkId]);

  const { result: pageResult, isLoading } =
    usePromiseResult<IBtcAddressesPageResult>(
      async () => {
        if (!accountId || !networkId) {
          return { total: 0, items: [] };
        }
        try {
          return await backgroundApiProxy.serviceAccountProfile.getBtcUsedAddressesByPage(
            {
              accountId,
              networkId,
              page: currentPage,
              pageSize: PAGE_SIZE,
            },
          );
        } catch (error) {
          console.error(error);
          return { total: 0, items: [] };
        }
      },
      [accountId, networkId, currentPage],
      { initResult: { total: 0, items: [] }, watchLoading: true },
    );

  const usedAddresses = pageResult.items;
  const total = pageResult.total;

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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

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

  const isInitialLoading =
    Boolean(isLoading) && total === 0 && usedAddresses.length === 0;
  const hasRows = rows.length > 0;

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
                  dataSource={rows}
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
      </Page.Footer>
    </Page>
  );
}

export default BtcAddresses;
