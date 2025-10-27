import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';

import { useAccountData } from '../../../hooks/useAccountData';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useCopyAddressWithDeriveType } from '../../../hooks/useCopyAccountAddress';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { RouteProp } from '@react-navigation/core';

const PAGE_SIZE = 10;

type IBtcAddressRow = {
  key: string;
  address: string;
  displayAddress: string;
  formattedTotalReceived: string;
  transfers: number;
  path?: string;
  name: string;
};

type IBtcAddressesPageResult = {
  total: number;
  items: IBtcFreshAddress[];
};

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
    deriveInfo: deriveInfoFromHook,
  } = useAccountData({
    accountId,
    networkId,
    walletId: routeWalletId,
  });
  const effectiveDeriveInfo = deriveInfoFromRoute ?? deriveInfoFromHook;
  const effectiveWalletId =
    routeWalletId ??
    wallet?.id ??
    accountUtils.getWalletIdFromAccountId({ accountId });
  const isHardwareAccount = accountUtils.isHwAccount({ accountId });
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
      const address = item.address ?? '-';
      return {
        key: `${item.name}-${item.path}`,
        address,
        displayAddress: accountUtils.shortenAddress({
          address,
          leadingLength: 8,
          trailingLength: 6,
        }),
        formattedTotalReceived: formatted,
        transfers: item.transfers,
        path: item.path,
        name: item.name,
      };
    });
  }, [network, usedAddresses]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const handleCopy = useCallback(
    (row: IBtcAddressRow) => {
      if (!row?.address) return;

      if (isHardwareAccount) {
        if (!effectiveWalletId || !row.path) {
          copyAddressWithDeriveType({
            address: row.address,
            deriveInfo: effectiveDeriveInfo,
            networkName: network?.shortname,
          });
          return;
        }
        navigation.push(EModalReceiveRoutes.ReceiveToken, {
          networkId,
          accountId,
          walletId: effectiveWalletId,
          indexedAccountId: account?.indexedAccountId,
          btcUsedAddress: row.address,
          btcUsedAddressPath: row.path,
          disableSelector: true,
        });
        return;
      }

      copyAddressWithDeriveType({
        address: row.address,
        deriveInfo: effectiveDeriveInfo,
        networkName: network?.shortname,
      });
    },
    [
      account?.indexedAccountId,
      accountId,
      copyAddressWithDeriveType,
      effectiveDeriveInfo,
      effectiveWalletId,
      isHardwareAccount,
      navigation,
      network?.shortname,
      networkId,
    ],
  );

  const isInitialLoading =
    Boolean(isLoading) && total === 0 && usedAddresses.length === 0;
  const hasRows = rows.length > 0;

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_used_addresses,
        })}
      />
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
                  contentContainerStyle={{ gap: '$2', px: '$0' }}
                  columns={[
                    {
                      title: intl.formatMessage({
                        id: ETranslations.global_address,
                      }),
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
                      title: intl.formatMessage({
                        id: ETranslations.wallet_total_received,
                      }),
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
                        minWidth: 180,
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
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              handleCopy(record);
                            }}
                          />
                        </>
                      ),
                    },
                  ]}
                  keyExtractor={(item) => item.key}
                  onRow={(record) => ({
                    onPress: () => handleCopy(record),
                  })}
                  rowProps={{
                    mx: '$2',
                    px: '$3',
                    py: '$2.5',
                    minHeight: 44,
                    alignItems: 'center',
                    borderRadius: '$3',
                    overflow: 'visible',
                  }}
                  headerRowProps={{
                    mx: '$2',
                    px: '$3',
                    py: '$2',
                    minHeight: 36,
                    alignItems: 'center',
                  }}
                />
              ) : (
                <XStack flex={1} justifyContent="center" alignItems="center">
                  <Empty
                    icon="SearchOutline"
                    title={intl.formatMessage({
                      id: ETranslations.global_no_results,
                    })}
                    description={intl.formatMessage({
                      id: ETranslations.wallet_no_used_addresses_description,
                    })}
                  />
                </XStack>
              )}
            </YStack>
          )}
        </YStack>
      </Page.Body>
      {totalPages > 1 ? (
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
      ) : null}
    </Page>
  );
}

export default BtcAddresses;
