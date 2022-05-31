import axios from 'axios';
import camelcase from 'camelcase-keys';

import { COVALENT_API_KEY } from '@onekeyhq/kit/src/config';

import {
  BlockTransactionWithLogEvents,
  EVMTxFromType,
  HistoryDetailList,
  LogEvent,
  NftDetail,
  NftMetadata,
  Transaction,
  Transfer,
  TransferEvent,
  TxDetail,
  TxStatus,
} from '../types/covalent';
import { HistoryEntryStatus, HistoryEntryTransaction } from '../types/history';
import {
  EVMDecodedItem,
  EVMDecodedTxType,
} from '../vaults/impl/evm/decoder/decoder';

const NOBODY = '0x0000000000000000000000000000000000000000';

const TransferEventTopic =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const SwapEventTopic =
  '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
const DepositTopic =
  '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c';
const WithdrawalTopic =
  '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65';

const WethAddressSet = new Set<string>([
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // chainID: 1 (Mainnet-WETH)
  '0xd0a1e359811322d97991e03f863a0c30c2cf029c', // chainID: 42 (kovan-WETH)
  '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // chainID: 137 (Matic-WMATIC)
  '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', // chainID: 43114 (Avalache C-chain-WAVAX)
  '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // chainID: 56 (BSC-WBNB)
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // chainID: 42161 (Arbitrum-WETH)
  '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83', // chainID: 250 (Fantom-WFTM)
  '0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f', // chainID: 128 (HECO-WHT)
]);

function nativeTransferEvent(
  from: string,
  to: string,
  value: string,
  fromType: EVMTxFromType,
): TransferEvent {
  return {
    topics: [],
    description: '',
    fromAddress: from,
    fromAddressLabel: '',
    toAddress: to,
    toAddressLabel: '',
    tokenAmount: value,
    tokenAddress: '',
    tokenLogoUrl: '',
    tokenName: '',
    tokenSymbol: '',
    tokenDecimals: 0,
    tokenId: '',
    balance: 0,
    balanceQuote: 0,
    quoteRate: 0,
    delta: '',
    deltaQuote: 0,
    eventLength: 0,
    fromType,
    txType: EVMDecodedTxType.NATIVE_TRANSFER,
  };
}

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
    tokenId: transfer.tokenId,
    balance: 0,
    balanceQuote: 0,
    quoteRate: transfer.quoteRate,
    delta: transfer.delta,
    deltaQuote: transfer.deltaQuote,
    eventLength: 0,
    fromType:
      transfer.transferType === 'IN' ? EVMTxFromType.IN : EVMTxFromType.OUT,
    txType: EVMDecodedTxType.TOKEN_TRANSFER,
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
    balance: 0,
    balanceQuote: 0,
    quoteRate: 0,
    delta: '',
    deltaQuote: 0,
    fromAddressLabel: '',
    toAddressLabel: '',
    eventLength: 0,
    tokenId: '',
    fromType:
      log.decoded.params[0].value === user
        ? EVMTxFromType.OUT
        : EVMTxFromType.IN,
    txType: EVMDecodedTxType.TOKEN_TRANSFER,
  };

  return transferEvent;
}

function getNftDetail(
  chainId: string,
  contractAddress: string,
  tokenId: string,
): Promise<NftMetadata | null> {
  const request = `https://api.covalenthq.com/v1/${chainId}/tokens/${contractAddress}/nft_metadata/${tokenId}/`;

  return axios
    .get<NftDetail>(request, {
      params: {
        'key': COVALENT_API_KEY,
      },
    })
    .then((response) => {
      if (response.data.error === false) {
        const { data: rawData } = response.data;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const data = camelcase(rawData, { deep: true });

        return data.items[0];
      }
      return null;
    });
}

function eventAdapter(
  user: string,
  from: string,
  to: string,
  value: string,
  logs: Array<LogEvent>,
  transfers: Array<Transfer>,
): {
  txType: EVMDecodedTxType;
  fromType: EVMTxFromType;
  events: Array<TransferEvent> | null;
  nftToken: Array<{ contractAddress: string; tokenId: string }>;
} {
  const transferEvent: TransferEvent[] = [];
  let txType = EVMDecodedTxType.TRANSACTION;
  let fromType = EVMTxFromType.OUT;
  let isSwap = false;
  const nftToken = [];

  if (!logs || !logs.length) {
    txType = EVMDecodedTxType.NATIVE_TRANSFER;
    if (from !== user) {
      fromType = EVMTxFromType.IN;
    }
    return {
      txType,
      fromType,
      events: transferEvent,
      nftToken: [],
    };
  }

  if (logs !== undefined) {
    for (let i = 0; i < logs.length; i += 1) {
      const log = logs[i];
      let event: TransferEvent;
      if (log.rawLogTopics.length !== 0) {
        switch (log.rawLogTopics[0]) {
          case TransferEventTopic: {
            const eventFrom = log.rawLogTopics[1].replace(
              '000000000000000000000000',
              '',
            );
            const eventTo = log.rawLogTopics[2].replace(
              '000000000000000000000000',
              '',
            );
            if (eventFrom !== user && eventTo !== user) {
              break;
            }
            if (eventFrom === NOBODY || eventTo === NOBODY) {
              break;
            }

            event = erc20TransferEventAdapter(user, log);
            transferEvent.push(event);
            if (event.fromAddress === user) {
              fromType = EVMTxFromType.OUT;
            } else {
              fromType = EVMTxFromType.IN;
            }
            if (event.topics.length === 4) {
              txType = EVMDecodedTxType.ERC721_TRANSFER;
              event.txType = EVMDecodedTxType.ERC721_TRANSFER;
              event.tokenId = parseInt(log.rawLogTopics[3], 16).toString();
              nftToken.push({
                contractAddress: log.senderAddress,
                tokenId: parseInt(log.rawLogTopics[3], 16).toString(),
              });
            }
            break;
          }
          case SwapEventTopic:
            isSwap = true;
            break;
          case DepositTopic:
            if (!WethAddressSet.has(log.senderAddress)) {
              break;
            }
            transferEvent.push(
              nativeTransferEvent(
                user === from ? user : from,
                log.rawLogTopics[1].replace('000000000000000000000000', ''),
                value,
                user === from ? EVMTxFromType.OUT : EVMTxFromType.IN,
              ),
            );
            break;
          case WithdrawalTopic:
            if (!WethAddressSet.has(log.senderAddress)) {
              break;
            }
            transferEvent.push(
              nativeTransferEvent(
                log.rawLogTopics[1].replace('000000000000000000000000', ''),
                user,
                value,
                EVMTxFromType.IN,
              ),
            );
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
    txType = EVMDecodedTxType.TOKEN_TRANSFER;
    fromType = transferEvent[0].fromType;
  } else if (logs !== undefined) {
    if (isSwap) {
      txType = EVMDecodedTxType.SWAP;
      fromType = EVMTxFromType.OUT;
    } else if (value !== '0' || txType === EVMDecodedTxType.TRANSACTION) {
      if (logs.length === 0) {
        if (from === user) {
          fromType = EVMTxFromType.OUT;
        } else {
          fromType = EVMTxFromType.IN;
        }
      } else if (logs.length >= 0) {
        fromType = EVMTxFromType.OUT;
      }
    }
  }

  return { events: transferEvent, nftToken, txType, fromType };
}

async function txAdapter(
  chainId: string,
  user: string,
  tx: BlockTransactionWithLogEvents,
): Promise<Transaction> {
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
    tokenEvent: [],
    fromAddressLabel: '',
    fromType: EVMTxFromType.OUT,
    txType: EVMDecodedTxType.TRANSACTION,
    source: 'covalent',
    info: null,
    logEvents: tx.logEvents,
    transfers: tx.transfers,
    chainId: parseInt(chainId),
  };

  const adapter = eventAdapter(
    user,
    txDetail.fromAddress,
    txDetail.toAddress,
    txDetail.value,
    tx.logEvents,
    tx.transfers,
  );

  txDetail.txType = adapter.txType;
  txDetail.fromType = adapter.fromType;
  if (adapter.events !== null) {
    txDetail.tokenEvent = adapter.events;
  }

  const metadata = await Promise.all(
    adapter.nftToken.map((token) =>
      getNftDetail(chainId, token.contractAddress, token.tokenId),
    ),
  );

  if (txDetail.tokenEvent && txDetail.tokenEvent.length > 0) {
    for (let i = 0; i < txDetail.tokenEvent.length; i += 1) {
      if (txDetail.tokenEvent[i].txType === EVMDecodedTxType.ERC721_TRANSFER) {
        for (let k = 0; k < metadata.length; k += 1) {
          if (
            txDetail.tokenEvent[i].tokenAddress ===
              metadata[k]?.contractAddress &&
            txDetail.tokenEvent[i].tokenId === metadata[k]?.nftData[0].tokenId
          ) {
            txDetail.tokenEvent[i].tokenName =
              metadata[k]?.nftData[0].externalData.name;
            txDetail.tokenEvent[i].tokenLogoUrl =
              metadata[k]?.nftData[0].externalData.image;
            break;
          }
        }
      }
    }
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
    .then(async (response) => {
      if (response.data.error === false) {
        const { data: rawData } = response.data;

        const data = camelcase(rawData, { deep: true });

        const txs: Array<Transaction> = [];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        for (let i = 0; i < data.items.length; i += 1) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          txs.push(await txAdapter(chainId, data.address, data.items[i]));
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
    .then(async (response) => {
      if (response.data.error === false) {
        const { data: rawData } = response.data;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const data = camelcase(rawData, { deep: true });

        const txs: Array<Transaction> = [];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        for (let i = 0; i < data.items.length; i += 1) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          txs.push(await txAdapter(chainId, data.address, data.items[i]));
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
        return txAdapter(chainId, data.fromAddress, data);
      }

      return null;
    });
}

function updateLocalTransactions(
  localHistory: Transaction[],
  txList: Transaction[],
) {
  const localHistoryMap: Record<string, Transaction> = {};
  for (const h of localHistory) {
    localHistoryMap[h.txHash] = h;
  }

  const confirmeds = txList.filter(
    (tx) => tx.successful === TxStatus.Confirmed,
  );
  for (const confirmed of confirmeds) {
    const { txHash, gasSpent } = confirmed;
    if (localHistoryMap[txHash]) {
      localHistoryMap[txHash].gasSpent = gasSpent;
    }
  }
}

function decodedItemToTransaction(
  item: EVMDecodedItem,
  historyEntry: HistoryEntryTransaction,
): Transaction {
  const { createdAt, status, rawTx } = historyEntry;
  const blockSignedAt = new Date(createdAt).toISOString();

  let successful: TxStatus;
  if (status === HistoryEntryStatus.SUCCESS) {
    successful = TxStatus.Confirmed;
  } else if (status === HistoryEntryStatus.PENDING) {
    successful = TxStatus.Pending;
  } else {
    successful = TxStatus.Failed;
  }

  return {
    blockHeight: 0,
    blockSignedAt,
    txHash: item.txHash,
    successful,
    fromAddress: item.fromAddress,
    fromAddressLabel: '',
    toAddress: item.toAddress,
    toAddressLabel: '',
    value: item.value,
    valueQuote: 0,
    gasOffered: item.gasInfo.gasLimit,
    gasPrice: Number(item.gasInfo.gasPrice),
    gasSpent: 0,
    gasQuote: 0,
    gasQuoteRate: 0,
    fromType: EVMTxFromType.OUT,
    txType: item.txType,
    tokenEvent: [],
    source: 'local',
    info: item.info,
    rawTx,
    logEvents: [],
    transfers: [],
    chainId: item.chainId,
  };
}

export {
  getTxHistories,
  getErc20TransferHistories,
  getTxDetail,
  getNftDetail,
  decodedItemToTransaction,
  updateLocalTransactions,
};
