import axios from 'axios';
import camelcase from 'camelcase-keys';

import {
  BlockTransactionWithLogEvents,
  DecodedEvent,
  HistoryDetailList,
  LogEvent,
  Transaction,
  TransactionType,
  TxDetail,
} from '../types/covalent';

const COVALENT_API_KEY = 'ckey_26a30671d9c941069612f10ac53';

const TransferEventTopic =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function erc20TransferEventAdapter(log: LogEvent): DecodedEvent {
  const decodedEvent: DecodedEvent = {
    topics: log.rawLogTopics,
    description: log.decoded.signature,
    fromAddress: log.decoded.params[0].value,
    toAddress: log.decoded.params[1].value,
    tokenAmount: log.decoded.params[2].value,
    tokenAddress: log.senderAddress,
    tokenLogoUrl: log.senderLogoUrl,
    tokenName: log.senderName,
    tokenSymbol: log.senderContractTickerSymbol,
    tokenDecimals: log.senderContractDecimals,
  };

  return decodedEvent;
}

function eventAdapter(
  user: string,
  from: string,
  to: string,
  logs: Array<LogEvent>,
): { type: TransactionType; events: Array<DecodedEvent> | null } {
  const decodedEvent = [];
  let type = TransactionType.ContractExecution;
  for (let i = 0; i < logs.length; i += 1) {
    const log = logs[i];
    if (log.rawLogTopics.length !== 0) {
      let event: DecodedEvent;

      switch (log.rawLogTopics[0]) {
        case TransferEventTopic:
          event = erc20TransferEventAdapter(log);
          decodedEvent.push(event);

          if (event.fromAddress === user) {
            type = TransactionType.Transfer;
          } else {
            type = TransactionType.Receive;
          }
          break;
        default:
          break;
      }
    }
  }

  if (decodedEvent.length === 0) {
    if (from === user) {
      type = TransactionType.Transfer;
    } else {
      type = TransactionType.Receive;
    }
  } else {
    type = TransactionType.ContractExecution;
  }

  return { type, events: decodedEvent };
}

function txAdapter(
  user: string,
  tx: BlockTransactionWithLogEvents,
): Transaction {
  const txDetail: Transaction = {
    blockHeight: tx.blockHeight,
    txHash: tx.txHash,
    successful: tx.successful,
    fromAddress: tx.fromAddress,
    toAddress: tx.toAddress,
    toAddressLabel: tx.toAddressLabel,
    value: tx.value,
    valueQuote: tx.valueQuote,
    gasOffered: tx.gasOffered,
    gasSpent: tx.gasSpent,
    gasPrice: tx.gasPrice,
    gasQuote: tx.gasQuote,
    gasQuoteRate: tx.gasQuoteRate,
    type: TransactionType.ContractExecution,
    TokenEvent: [],
  };
  const adapter = eventAdapter(
    user,
    txDetail.fromAddress,
    txDetail.toAddress,
    tx.logEvents,
  );

  txDetail.type = adapter.type;

  if (adapter.events !== null) {
    txDetail.TokenEvent = adapter.events;
  }

  return txDetail;
}

function getTxHistories(
  chainId: string,
  address: string,
  pageNumber: number,
  pageSize: number,
): Promise<HistoryDetailList | null> {
  const request = `https://api.covalenthq.com/v1/${chainId}/address/${address}/transactions_v2/`;
  return axios
    .get<HistoryDetailList>(request, {
      params: {
        'page-number': pageNumber,
        'page-size': pageSize,
        'key': COVALENT_API_KEY,
      },
    })
    .then((response) => {
      if (response.data.error === false) {
        const { data: rawData } = response.data;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const data = camelcase(rawData, { deep: true });

        const txs: Array<Transaction> = [];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        for (let i = 0; i < data.items.length; i += 1) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          txs.push(txAdapter(data.address, data.items[i]));
        }

        const history: HistoryDetailList = {
          error: false,
          errorCode: null,
          errorMessage: null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          data: {
            address: data.address,
            updatedAt: data.updatedAt,
            nextUpdateAt: data.nextUpdateAt,
            quoteCurrency: data.quoteCurrency,
            chainId: data.chainId,
            pagination: data.pagination,
            txList: txs,
            items: [],
          },
        };

        return history;
      }

      return null;
    });
}

function getTxDetail(
  chainId: string,
  txHash: string,
): Promise<Transaction | null> {
  const request = `https://api.covalenthq.com/v1/${chainId}/transaction_v2/${txHash}/`;

  return axios
    .get<TxDetail>(request, {
      params: {
        'key': COVALENT_API_KEY,
      },
    })
    .then((response) => {
      if (response.data.error === false) {
        const { data: rawData } = response.data;
        if (rawData.items.length !== 1) {
          return null;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const data = camelcase(rawData.items[0], { deep: true });
        return txAdapter('', data);
      }

      return null;
    });
}

export { getTxHistories, getTxDetail };
