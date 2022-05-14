import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Account } from '@onekeyhq/engine/src/types/account';
import { TxStatus } from '@onekeyhq/engine/src/types/covalent';
import { Network } from '@onekeyhq/engine/src/types/network';
import {
  EVMDecodedItem,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useFormatDate from '../../../hooks/useFormatDate';

export type TransactionGroup = { title: string; data: EVMDecodedItem[] };

type UseCollectiblesDataArgs = {
  account?: Account | null | undefined;
  network?: Network | null | undefined;
  tokenId?: string | null | undefined;
  isInternalSwapOnly?: boolean;
};

const PAGE_SIZE = 50;

const toTransactionSection = (
  queueStr: string,
  _data: EVMDecodedItem[] | null | undefined,
  formatDate: (date: number) => string,
): TransactionGroup[] => {
  if (!_data) return [];

  const sortData = _data.sort((a, b) => b.blockSignedAt - a.blockSignedAt);

  return sortData.reduce((acc: TransactionGroup[], cur: EVMDecodedItem) => {
    let key = queueStr;
    if (cur.txStatus === TxStatus.Pending) {
      key = queueStr;
    } else {
      key = formatDate(cur.blockSignedAt);
    }

    let dateGroup = acc.find((x) => x.title === key);
    if (!dateGroup) {
      dateGroup = { title: key, data: [] };
      acc.push(dateGroup);
    }
    dateGroup.data.push(cur);
    return acc;
  }, []);
};

type RequestParamsType = {
  accountId: string;
  networkId: string;
  tokenId: string | undefined | null;
  isInternalSwapOnly?: boolean;
  pageNumber: number;
  pageSize: number;
} | null;

export const useHistoricalRecordsData = ({
  account,
  network,
  tokenId,
  isInternalSwapOnly,
}: UseCollectiblesDataArgs) => {
  const intl = useIntl();
  const formatDate = useFormatDate();

  const [transactionRecords, setTransactionRecords] = useState<
    TransactionGroup[]
  >([]);

  const [isLoading, setIsLoading] = useState(false);

  const hasNoParams = useMemo(() => !account || !network, [account, network]);

  const paramsMemo: RequestParamsType = useMemo(() => {
    if (hasNoParams) return null;

    const pageSize = PAGE_SIZE;

    const params = {
      accountId: account?.id ?? '',
      networkId: network?.id ?? '',
      tokenId,
      isInternalSwapOnly,
      pageNumber: 0,
      pageSize,
    };

    return params;
  }, [account?.id, hasNoParams, isInternalSwapOnly, network?.id, tokenId]);

  const requestCall = useCallback(async (params: RequestParamsType) => {
    if (!params) {
      return [];
    }

    const history = await backgroundApiProxy.engine.getTxHistoriesV2(
      params.networkId,
      params.accountId,
      {
        contract: params.tokenId,
        isHidePending: !!params.tokenId,
        isLocalOnly: !!params.isInternalSwapOnly,
      },
    );

    if (params.isInternalSwapOnly) {
      return history.filter((h) => h.txType === EVMDecodedTxType.INTERNAL_SWAP);
    }

    return history;
  }, []);

  const refresh = useCallback(() => {
    (async () => {
      setIsLoading(true);
      setTransactionRecords([]);

      if (hasNoParams) {
        setIsLoading(false);
        return;
      }

      const assets = await requestCall(paramsMemo);

      const transactions = toTransactionSection(
        intl.formatMessage({ id: 'history__queue' }),
        assets,
        (date: number) =>
          formatDate.formatMonth(new Date(date), { hideTheYear: true }),
      );

      setIsLoading(false);
      setTransactionRecords(transactions);
    })();
  }, [formatDate, hasNoParams, intl, paramsMemo, requestCall]);

  return useMemo(
    () => ({
      isLoading,
      transactionRecords,
      refresh,
    }),
    [isLoading, refresh, transactionRecords],
  );
};
