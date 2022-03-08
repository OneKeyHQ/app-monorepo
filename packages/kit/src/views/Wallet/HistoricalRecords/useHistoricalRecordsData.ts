import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import useSWRInfinite from 'swr/infinite';

import { Account } from '@onekeyhq/engine/src/types/account';
import { Transaction, TxStatus } from '@onekeyhq/engine/src/types/covalent';
import { Network } from '@onekeyhq/engine/src/types/network';
import engine from '@onekeyhq/kit/src/engine/EngineProvider';

import useFormatDate from '../../../hooks/useFormatDate';

export type TransactionGroup = { title: string; data: Transaction[] };

type UseCollectiblesDataArgs = {
  account?: Account | null | undefined;
  network?: Network | null | undefined;
  tokenId?: string | null | undefined;
};

type UseHistoricalRecordsDataReturn = {
  isLoading: boolean;
  transactionRecords: TransactionGroup[];
  fetchData: () => void;
  loadMore?: () => void;
  refresh?: () => void;
};

const PAGE_SIZE = 10;
const FIRST_PAGE_SIZE = 20;

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

export const useHistoricalRecordsData = ({
  account,
  network,
  tokenId,
}: UseCollectiblesDataArgs): UseHistoricalRecordsDataReturn => {
  const intl = useIntl();
  const formatDate = useFormatDate();

  const hasNoParams = !account || !network;

  const getKey = (size: number, previousPageData: Transaction[]) => {
    // reached the end
    const isEndOfData = previousPageData && !previousPageData?.length;

    if (isEndOfData || hasNoParams) return null;

    const params = {
      accountId: account.id,
      networkId: network.id,
      tokenId,
      // offset limit 写法
      // offset:
      //   size > 0 ? FIRST_PAGE_SIZE + (size - 1) * PAGE_SIZE : FIRST_PAGE_SIZE,
      // limit: size === 0 ? FIRST_PAGE_SIZE : PAGE_SIZE,
      pageNumber: size > 0 ? size + 1 : 0,
      pageSize: size === 0 ? FIRST_PAGE_SIZE : PAGE_SIZE,
    };
    return params;
  };

  const assetsSwr = useSWRInfinite(getKey, async (params) => {
    let history;
    if (params.tokenId) {
      history = await engine.getErc20TxHistories(
        params.networkId,
        params.accountId,
        params.tokenId,
        params.pageNumber,
        params.pageSize,
      );
    } else {
      history = await engine.getTxHistories(
        params.networkId,
        params.accountId,
        params.pageNumber,
        params.pageSize,
      );
    }

    if (history?.error || !history?.data?.txList) {
      throw new Error(history?.errorMessage ?? '');
    }

    return history.data.txList;
  });

  return useMemo(() => {
    const { data, error, mutate, isValidating } = assetsSwr;

    if (hasNoParams) {
      return {
        isLoading: true,
        fetchData: mutate,
        transactionRecords: [],
      };
    }

    if (error) {
      return {
        isLoading: false,
        fetchData: mutate,
        transactionRecords: [],
      };
    }

    // const isRefreshing = isValidating && !!data;

    const assets = data?.flat(1) ?? [];

    const transactionRecords = toTransactionSection(
      intl.formatMessage({ id: 'history__queue' }),
      assets,
      (date: string) => formatDate.formatMonth(date, { hideTheYear: true }),
    );

    const loadMore = () => {
      const isEmpty = !data?.length;
      const isReachingEnd =
        isEmpty || (data && data[data.length - 1].length < PAGE_SIZE);

      if (!isValidating && !isReachingEnd) {
        assetsSwr.setSize((preSize) => preSize + 1);
      }
    };

    return {
      loadMore,
      transactionRecords,
      fetchData: mutate,
      isLoading: isValidating,
    };
  }, [assetsSwr, formatDate, hasNoParams, intl]);
};
