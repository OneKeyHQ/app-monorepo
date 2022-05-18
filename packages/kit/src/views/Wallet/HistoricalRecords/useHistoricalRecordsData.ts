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

    const history = await backgroundApiProxy.engine.getTxHistories(
      params.networkId,
      params.accountId,
      {
        contract: params.tokenId,
        isHidePending: !!params.tokenId,
        isLocalOnly: !!params.isInternalSwapOnly,
      },
    );

    const filted = filtePendingList(history);

    if (params.isInternalSwapOnly) {
      return filted.filter((h) => h.txType === EVMDecodedTxType.INTERNAL_SWAP);
    }

    return filted;
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
