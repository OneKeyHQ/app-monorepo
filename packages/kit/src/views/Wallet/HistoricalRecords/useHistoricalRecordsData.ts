import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { Account } from '@onekeyhq/engine/src/types/account';
import { TxStatus } from '@onekeyhq/engine/src/types/covalent';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useFormatDate from '../../../hooks/useFormatDate';

export type TransactionGroup = { title: string; data: EVMDecodedItem[] };

type UseCollectiblesDataArgs = {
  account?: Account | null | undefined;
  network?: Network | null | undefined;
  tokenId?: string | null | undefined;
  historyFilter?: (item: any) => boolean;
};

const PAGE_SIZE = 50;

const toTransactionSection = (
  queueStr: string,
  _data: EVMDecodedItem[] | null | undefined,
  formatDate: (date: number) => string,
): TransactionGroup[] => {
  if (!_data) return [];

  const sortData = _data.sort((a, b) => b.blockSignedAt - a.blockSignedAt);

  const groups = sortData.reduce((acc: TransactionGroup[], cur) => {
    let key = queueStr;
    if (cur.txStatus !== TxStatus.Pending) {
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

  // bring pending txs to the top.
  const sortedGroups = groups.sort((a) => (a.title === queueStr ? -1 : 1));

  return sortedGroups;
};

const filtePendingList = (list: EVMDecodedItem[]) => {
  const pending = list.filter(
    (h) => h.txStatus === TxStatus.Pending && !!h.nonce,
  );

  const nonceMap = pending.reduce<Map<number, EVMDecodedItem[]>>((acc, cur) => {
    const { nonce } = cur;

    if (typeof nonce === 'undefined') {
      return acc;
    }

    const origin = acc.get(nonce);
    if (origin) {
      acc.set(nonce, [...origin, cur]);
    } else {
      acc.set(nonce, [cur]);
    }
    return acc;
  }, new Map<number, EVMDecodedItem[]>());

  const dropList: string[] = [];
  nonceMap.forEach((i) => {
    const sameNonceList = i.sort((a, b) => a.blockSignedAt - b.blockSignedAt);
    sameNonceList.pop(); // pop most recent one.
    dropList.push(...sameNonceList.map((x) => x.txHash));
  });

  return list.filter((h) => !dropList.includes(h.txHash));
};

type RequestParamsType = {
  accountId: string;
  networkId: string;
  tokenId: string | undefined | null;
  historyFilter?: (item: any) => boolean;
  pageNumber: number;
  pageSize: number;
} | null;

export const useHistoricalRecordsData = ({
  account,
  network,
  tokenId,
  historyFilter,
}: UseCollectiblesDataArgs) => {
  const intl = useIntl();
  const formatDate = useFormatDate();

  const [transactionRecords, setTransactionRecords] =
    useState<TransactionGroup[]>();

  const hasNoParams = !account || !network;

  const requestCall = useCallback(async () => {
    const params: RequestParamsType = {
      accountId: account?.id ?? '',
      networkId: network?.id ?? '',
      tokenId,
      historyFilter,
      pageNumber: 0,
      pageSize: PAGE_SIZE,
    };
    const history = await backgroundApiProxy.engine.getTxHistories(
      params.networkId,
      params.accountId,
      {
        contract: params.tokenId,
        isHidePending: !!params.tokenId,
      },
    );

    let filted = filtePendingList(history);

    const itemFilter = params.historyFilter;
    if (itemFilter) {
      filted = filted.filter((h) => itemFilter(h));
    }

    return filted;
  }, [account?.id, network?.id, tokenId, historyFilter]);

  const refresh = useCallback(async () => {
    if (hasNoParams) {
      return;
    }

    const assets = await requestCall();

    const transactions = toTransactionSection(
      intl.formatMessage({ id: 'history__queue' }),
      assets,
      (date: number) =>
        formatDate.formatMonth(new Date(date), { hideTheYear: true }),
    );

    setTransactionRecords(transactions);
  }, [formatDate, hasNoParams, intl, requestCall]);

  return {
    isLoading: transactionRecords === undefined,
    transactionRecords: transactionRecords || [],
    refresh,
  };
};
