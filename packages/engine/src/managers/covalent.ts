import axios from 'axios';
import camelcase from 'camelcase-keys';

import {
  BlockTransactionWithLogEvents,
  HistoryDetailList,
  LogEvent,
  TokenType,
  Transaction,
  TransactionType,
  Transfer,
  TransferEvent,
  TxDetail,
  TxStatus,
} from '../types/covalent';

const COVALENT_API_KEY = 'ckey_26a30671d9c941069612f10ac53';

const TransferEventTopic =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function transferLogToTransferEvent(transfer: Transfer): TransferEvent {
  return {
    topics: [],
    description: '',
    fromAddress: transfer.fromAddress,
    fromAddressLabel: transfer.fromAddressLabel,
    toAddress: transfer.toAddress,
    toAddressLabel: transfer.toAddressLabel,
    tokenAmount: transfer.delta,
    tokenAddress: transfer.contractAddress,
    tokenLogoUrl: transfer.logoUrl,
    tokenName: transfer.contractName,
    tokenSymbol: transfer.contractTickerSymbol,
    tokenDecimals: transfer.contractDecimals,
    transferType:
      transfer.transferType === 'IN'
        ? TransactionType.Receive
        : TransactionType.Transfer,
    tokenType: TokenType.native,
    balance: 0,
    balanceQuote: 0,
    quoteRate: transfer.quoteRate,
    delta: transfer.delta,
    deltaQuote: transfer.deltaQuote,
    eventLength: 0,
  };
}

function erc20TransferEventAdapter(user: string, log: LogEvent): TransferEvent {
  const transferEvent: TransferEvent = {
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
    tokenType: TokenType.native,
    transferType:
      log.senderAddress === user
        ? TransactionType.Transfer
        : TransactionType.Receive,
    balance: 0,
    balanceQuote: 0,
    quoteRate: 0,
    delta: '',
    deltaQuote: 0,
    fromAddressLabel: '',
    toAddressLabel: '',
    eventLength: 0,
  };

  return transferEvent;
}

function eventAdapter(
  user: string,
  from: string,
  to: string,
  value: string,
  logs: Array<LogEvent>,
  transfers: Array<Transfer>,
): {
  tokenType: TokenType;
  type: TransactionType;
  events: Array<TransferEvent> | null;
} {
  const transferEvent: TransferEvent[] = [];
  let type = TransactionType.ContractExecution;
  let tokenType = TokenType.native;

  if (logs !== undefined) {
    for (let i = 0; i < logs.length; i += 1) {
      const log = logs[i];
      let event: TransferEvent;
      if (log.rawLogTopics.length !== 0) {
        switch (log.rawLogTopics[0]) {
          case TransferEventTopic:
            event = erc20TransferEventAdapter(user, log);
            transferEvent.push(event);
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
  } else {
    for (let index = 0; index < transfers.length; index += 1) {
      transferEvent.push(transferLogToTransferEvent(transfers[index]));
    }
  }
  if (transfers !== undefined) {
    tokenType = TokenType.ERC20;
    type = transferEvent[0].transferType;
  } else if (logs !== undefined) {
    if (value !== '0' || type === TransactionType.ContractExecution) {
      if (logs.length === 0 && value !== '0') {
        if (from === user) {
          type = TransactionType.Transfer;
        } else {
          type = TransactionType.Receive;
        }
      } else if (logs.length >= 0) {
        type = TransactionType.ContractExecution;
      }
    }
  }

  return { tokenType, type, events: transferEvent };
}

function txAdapter(
  user: string,
  tx: BlockTransactionWithLogEvents,
): Transaction {
  const txDetail: Transaction = {
    blockSignedAt: tx.blockSignedAt,
    blockHeight: tx.blockHeight,
    txHash: tx.txHash,
    successful: tx.successful ? TxStatus.Confirmed : TxStatus.Failed,
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
    tokenEvent: [],
    tokenType: TokenType.native,
    fromAddressLabel: '',
  };
  const adapter = eventAdapter(
    user,
    txDetail.fromAddress,
    txDetail.toAddress,
    txDetail.value,
    tx.logEvents,
    tx.transfers,
  );

  txDetail.type = adapter.type;
  txDetail.tokenType = adapter.tokenType;
  if (adapter.events !== null) {
    txDetail.tokenEvent = adapter.events;
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

function getErc20TransferHistories(
  chainId: string,
  address: string,
  contract: string,
  pageNumber: number,
  pageSize: number,
): Promise<HistoryDetailList | null> {
  const request = `https://api.covalenthq.com/v1/${chainId}/address/${address}/transfers_v2/`;
  return axios
    .get<HistoryDetailList>(request, {
      params: {
        'page-number': pageNumber,
        'page-size': pageSize,
        'key': COVALENT_API_KEY,
        'contract-address': contract,
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

export { getTxHistories, getErc20TransferHistories, getTxDetail };
