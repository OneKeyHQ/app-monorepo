import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Account } from '@onekeyhq/engine/src/types/account';
import { Transaction, TxStatus } from '@onekeyhq/engine/src/types/covalent';
import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useFormatDate from '../../../hooks/useFormatDate';

export type TransactionGroup = { title: string; data: Transaction[] };

type UseCollectiblesDataArgs = {
  account?: Account | null | undefined;
  network?: Network | null | undefined;
  tokenId?: string | null | undefined;
};

const PAGE_SIZE = 50;

const toTransactionSection = (
  queueStr: string,
  _data: Transaction[] | null | undefined,
  formatDate: (date: string) => string,
): TransactionGroup[] => {
  if (!_data) return [];

  const sortData = _data.sort(
    (a, b) =>
      new Date(b.blockSignedAt).getTime() - new Date(a.blockSignedAt).getTime(),
  );

  return sortData.reduce((_pre: TransactionGroup[], _current: Transaction) => {
    let key = queueStr;
    if (_current.successful === TxStatus.Pending) {
      key = queueStr;
    } else {
      key = formatDate(_current.blockSignedAt);
    }

    let dateGroup = _pre.find((x) => x.title === key);
    if (!dateGroup) {
      dateGroup = { title: key, data: [] };
      _pre.push(dateGroup);
    }
    dateGroup.data.push(_current);
    return _pre;
  }, []);
};

type RequestParamsType = {
  accountId: string;
  networkId: string;
  tokenId: string | undefined | null;
  pageNumber: number;
  pageSize: number;
} | null;

export const useHistoricalRecordsData = ({
  account,
  network,
  tokenId,
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
      pageNumber: 0,
      pageSize,
    };

    return params;
  }, [account?.id, hasNoParams, network?.id, tokenId]);

  const requestCall = useCallback(async (params: RequestParamsType) => {
    // console.log('begin getTxHistories request');
    if (!params) {
      return [];
    }

    let history;
    if (params.tokenId) {
      history = await backgroundApiProxy.engine.getErc20TxHistories(
        params.networkId,
        params.accountId,
        params.tokenId,
        params.pageNumber,
        params.pageSize,
      );
    } else {
      history = await backgroundApiProxy.engine.getTxHistories(
        params.networkId,
        params.accountId,
        params.pageNumber,
        params.pageSize,
      );
    }

    if (history?.error || !history?.data?.txList) {
      // throw new Error(history?.errorMessage ?? '');
      return [];
    }

    const result = history.data.txList;
    // console.log('end getTxHistories', result.length);
    return result;
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
        (date: string) => formatDate.formatMonth(date, { hideTheYear: true }),
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
