import axios from 'axios';
import BigNumber from 'bignumber.js';
import camelcase from 'camelcase-keys';

import debugCodes from '@onekeyhq/shared/src/debug/debugCodes';
import { HISTORY_CONSTS } from '@onekeyhq/shared/src/engine/engineConsts';

import { getCovalentApiEndpoint } from '../endpoint';
import { EVMTxFromType, TxStatus } from '../types/covalent';
import { EVMDecodedTxType } from '../vaults/impl/evm/decoder/types';
import { isEvmNativeTransferType } from '../vaults/impl/evm/decoder/util';
import { IDecodedTxActionType, IDecodedTxStatus } from '../vaults/types';
import { convertTokenOnChainValueToAmount } from '../vaults/utils/tokenUtils';

import { getAsset } from './nft';

import type {
  BlockTransactionWithLogEvents,
  HistoryDetailList,
  ICovalentHistoryList,
  ICovalentHistoryListItem,
  ICovalentHistoryListItemLogEvent,
  ICovalentHistoryListItemTokenTransfer,
  LogEvent,
  NftDetail,
  NftMetadata,
  Transaction,
  Transfer,
  TransferEvent,
} from '../types/covalent';
import type { NFTAsset } from '../types/nft';
import type { Token } from '../types/token';
import type { IEncodedTxEvm } from '../vaults/impl/evm/Vault';
import type { IDecodedTx, IDecodedTxAction } from '../vaults/types';
import type { VaultBase } from '../vaults/VaultBase';

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
  const request = `${getCovalentApiEndpoint()}/v1/${chainId}/tokens/${contractAddress}/nft_metadata/${tokenId}/`;

  return axios
    .get<NftDetail>(request, {
      params: {
        // 'key': COVALENT_API_KEY,
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
        if (parseFloat(value) > 0) {
          if (from === user) {
            fromType = EVMTxFromType.OUT;
          } else {
            fromType = EVMTxFromType.IN;
          }
        } else {
          fromType = EVMTxFromType.OUT;
        }
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

  if (
    tx.fromAddress.toLowerCase() !== user.toLowerCase() &&
    tx.toAddress.toLowerCase() === user.toLowerCase()
  ) {
    txDetail.fromType = EVMTxFromType.IN;
  }

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
  pageNumber = 0,
  pageSize = 50,
): Promise<HistoryDetailList | null> {
  const request = `${getCovalentApiEndpoint()}/v1/${chainId}/address/${address}/transactions_v2/`;
  return axios
    .get<HistoryDetailList>(request, {
      params: {
        'page-number': pageNumber,
        'page-size': pageSize,
        // 'key': COVALENT_API_KEY,
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

async function createOutputActionFromCovalent({
  vault,
  covalentTx,
  encodedTx,
  address,
}: ICovalentTxToDecodedTxParseOptions) {
  let nativeTransferAction: IDecodedTxAction | undefined;
  // polygon also has log_events in nativeTransfer
  let isContractCall =
    Boolean(covalentTx?.log_events?.length) &&
    Boolean(covalentTx?.log_events?.find((item) => !!item.decoded));
  if (encodedTx) {
    const isNativeTransfer = isEvmNativeTransferType({
      data: encodedTx.data || '',
      to: encodedTx.to,
    });
    isContractCall = !isNativeTransfer;
  }
  const isTokenQuery = !!covalentTx?.transfers?.length;
  if (parseFloat(covalentTx.value) > 0 || !isContractCall) {
    const tokenInfo = await vault.engine.getNativeTokenInfo(vault.networkId);
    const fromAddress = covalentTx.from_address?.toLocaleLowerCase();
    const toAddress = covalentTx.to_address?.toLocaleLowerCase();
    const accountAddress = address.toLocaleLowerCase();
    if (
      tokenInfo &&
      (fromAddress === accountAddress || toAddress === accountAddress)
    ) {
      const { value } = covalentTx;
      nativeTransferAction = {
        type: IDecodedTxActionType.NATIVE_TRANSFER,
        nativeTransfer: {
          tokenInfo,
          from: fromAddress,
          to: toAddress,
          amount: convertTokenOnChainValueToAmount({ tokenInfo, value }),
          amountValue: value,
          extraInfo: null,
        },
      };
    }
  }
  const commonAction = {
    type: IDecodedTxActionType.UNKNOWN,
    evmInfo: {
      from: covalentTx.from_address,
      to: covalentTx.to_address,
      value: covalentTx.value,
    },
  };

  return {
    isContractCall,
    isTokenQuery,
    commonAction,
    nativeTransferAction,
  };
}

async function createOutputActionFromCovalentTransferInfo({
  transfer,
  vault,
  address,
}: {
  transfer: ICovalentHistoryListItemTokenTransfer;
  vault: VaultBase;
  address: string;
}) {
  const from = transfer.from_address;
  const to = transfer.to_address;
  const value = transfer.delta;
  let tokenInfo = await vault.engine.findToken({
    networkId: vault.networkId,
    tokenIdOnNetwork: transfer.contract_address,
  });
  let action: IDecodedTxAction | undefined;
  if (!tokenInfo) {
    const token: Token = {
      id: '',
      networkId: vault.networkId,
      tokenIdOnNetwork: transfer.contract_address || '',
      decimals: transfer.contract_decimals ?? undefined,
      symbol: transfer.contract_ticker_symbol || '',
      name: transfer.contract_name || '',
      logoURI: transfer.logo_url || '',
    };
    tokenInfo = token;
  }
  if (tokenInfo) {
    action = {
      type: IDecodedTxActionType.TOKEN_TRANSFER,
      hidden: !(from === address || to === address),
      tokenTransfer: {
        tokenInfo,
        from,
        to,
        amount: convertTokenOnChainValueToAmount({ tokenInfo, value }),
        amountValue: value,
        extraInfo: null,
      },
    };
  }
  return action;
}

async function getTokenInfoFromEvent({
  event,
  vault,
}: {
  event: ICovalentHistoryListItemLogEvent;
  vault: VaultBase;
}) {
  let tokenInfo = await vault.engine.findToken({
    networkId: vault.networkId,
    tokenIdOnNetwork: event.sender_address,
  });
  debugCodes.breakpointCovalentTx({ txHash: event.tx_hash });
  if (!tokenInfo) {
    const token: Token = {
      id: '',
      networkId: vault.networkId,
      tokenIdOnNetwork: event.sender_address || '',
      decimals: event.sender_contract_decimals ?? undefined,
      symbol: event.sender_contract_ticker_symbol || '',
      name: event.sender_name || '',
      logoURI: event.sender_logo_url || '',
    };
    tokenInfo = token;
  }
  return tokenInfo;
}

async function createOutputActionFromCovalentLogEvent({
  event,
  vault,
  address,
}: {
  event: ICovalentHistoryListItemLogEvent;
  vault: VaultBase;
  address: string;
}): Promise<IDecodedTxAction | null> {
  if (event.decoded) {
    const { name, signature, params } = event.decoded;
    let action: IDecodedTxAction = {
      type: IDecodedTxActionType.FUNCTION_CALL,
      hidden: true,
      functionCall: {
        target: event.sender_address,
        functionName: name,
        functionHash: '',
        functionSignature: signature,
        args: params,
        extraInfo: null,
      },
    };
    if (name === 'Transfer') {
      const tokenInfo = await getTokenInfoFromEvent({
        vault,
        event,
      });

      debugCodes.breakpointCovalentTx({ txHash: event.tx_hash });

      if (tokenInfo) {
        // TODO valueInfo decoded=false
        const value = params.find((p) => p.name === 'value')?.value || '0';
        const from = (
          params.find((p) => p.name === 'from')?.value || ''
        ).toLowerCase();
        const to = (
          params.find((p) => p.name === 'to')?.value || ''
        ).toLowerCase();
        const tokenId = (
          params.find((p) => p.name === 'tokenId')?.value || ''
        ).toLowerCase();
        tokenInfo.id = tokenId;

        action = {
          type: IDecodedTxActionType.TOKEN_TRANSFER,
          hidden: !(from === address || to === address),
          tokenTransfer: {
            tokenInfo,
            from,
            to,
            amount: convertTokenOnChainValueToAmount({ tokenInfo, value }),
            amountValue: value,
            extraInfo: null,
          },
        };
      }
    }
    if (name === 'Approval') {
      const tokenInfo = await getTokenInfoFromEvent({
        vault,
        event,
      });
      if (tokenInfo) {
        const value = params.find((p) => p.name === 'value')?.value || '0';
        const owner = (
          params.find((p) => p.name === 'owner')?.value || ''
        ).toLowerCase();
        const tokenId = (
          params.find((p) => p.name === 'tokenId')?.value || ''
        ).toLowerCase();
        tokenInfo.id = tokenId;

        const amount = convertTokenOnChainValueToAmount({ tokenInfo, value });
        action = {
          type: IDecodedTxActionType.TOKEN_APPROVE,
          hidden: owner !== address,
          tokenApprove: {
            tokenInfo,
            owner,
            spender: params.find((p) => p.name === 'spender')?.value || '',
            amount,
            amountValue: value,
            isMax:
              event.raw_log_data ===
                '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' ||
              new BigNumber(amount).gte(10 ** 55),
            extraInfo: null,
          },
        };
      }
    }
    if (name === 'TransferSingle') {
      const { accountId, networkId } = vault;

      const from = (
        params.find((p) => p.name === '_from')?.value || ''
      ).toLowerCase();
      const to = (
        params.find((p) => p.name === '_to')?.value || ''
      ).toLowerCase();
      const tokenId = params.find((p) => p.name === '_id')?.value || '';
      const amount = params.find((p) => p.name === '_amount')?.value || '0';
      const asset = await getAsset({
        accountId,
        networkId,
        contractAddress: event.sender_address,
        tokenId,
        local: true,
      });

      if (asset) {
        action = {
          type: IDecodedTxActionType.NFT_TRANSFER,
          hidden: !(from === address || to === address),
          nftTransfer: {
            asset: asset as NFTAsset,
            amount,
            send: from,
            receive: to,
            extraInfo: null,
          },
        };
      }
    }

    return action;
  }
  return null;
}
export type ICovalentTxToDecodedTxParseOptions = {
  covalentTx: ICovalentHistoryListItem;
  address: string;
  vault: VaultBase;
  encodedTx?: IEncodedTxEvm | undefined;
};
export async function parseCovalentTxToDecodedTx(
  options: ICovalentTxToDecodedTxParseOptions,
) {
  const { covalentTx, address, vault } = options;
  const { networkId, accountId } = vault;
  const { nativeTransferAction, commonAction, isContractCall, isTokenQuery } =
    await createOutputActionFromCovalent(options);
  const parsedDecodedTx: IDecodedTx | undefined = {
    txid: covalentTx.tx_hash,
    owner: address,
    signer: covalentTx.from_address,

    nonce: 0, // TODO covalentTx lack of nonce
    actions: [],
    outputActions: [nativeTransferAction].filter(Boolean),

    status: covalentTx.successful
      ? IDecodedTxStatus.Confirmed
      : IDecodedTxStatus.Failed,

    networkId,
    accountId,

    extraInfo: null,
  };
  let InvolvedInDelegateVotesChanged = false;

  if (isTokenQuery && covalentTx.transfers) {
    const actions = await Promise.all(
      covalentTx.transfers.map((transfer) =>
        createOutputActionFromCovalentTransferInfo({
          transfer,
          vault,
          address,
        }),
      ),
    );
    parsedDecodedTx.outputActions = [
      parseFloat(nativeTransferAction?.nativeTransfer?.amount ?? '0') > 0
        ? nativeTransferAction
        : null,
      ...actions,
    ].filter(Boolean);
  } else if (
    isContractCall &&
    covalentTx.log_events &&
    covalentTx.log_events.length
  ) {
    let outputActions = await Promise.all(
      covalentTx.log_events
        .filter((event) => {
          if (event.decoded) {
            const { name, params } = event.decoded;
            if (name === 'Transfer') {
              const from = (
                params.find((p) => p.name === 'from')?.value || ''
              ).toLowerCase();
              const to = (
                params.find((p) => p.name === 'to')?.value || ''
              ).toLowerCase();
              return from === address || to === address;
            }
            if (name === 'Approval') {
              const owner = (
                params.find((p) => p.name === 'owner')?.value || ''
              ).toLowerCase();
              return owner === address;
            }

            if (name === 'TransferSingle') {
              const from = (
                params.find((p) => p.name === '_from')?.value || ''
              ).toLowerCase();
              const to = (
                params.find((p) => p.name === '_to')?.value || ''
              ).toLowerCase();
              return from === address || to === address;
            }

            if (name === 'DelegateVotesChanged') {
              InvolvedInDelegateVotesChanged = true;
            }
          }
          return false;
        })
        .map((event) =>
          createOutputActionFromCovalentLogEvent({
            event,
            vault,
            address,
          }),
        ),
    );

    debugCodes.breakpointCovalentTx({ txHash: covalentTx.tx_hash });

    outputActions = outputActions
      .filter((item) => item && !item.hidden)
      .filter(Boolean);

    // If address only involved in tx DelegateVotesChanged event in multi log events
    // Then this tx does not belong to this address
    if (
      isContractCall &&
      !outputActions.length &&
      covalentTx.log_events.length > 1 &&
      InvolvedInDelegateVotesChanged
    ) {
      covalentTx.onlyInvolvedInDelegateVotesChanged = true;
      return covalentTx;
    }

    if (isContractCall && !outputActions.length) {
      outputActions = [commonAction];
    }
    parsedDecodedTx.outputActions = [
      ...(parsedDecodedTx.outputActions || []),
      ...(outputActions || []),
    ].filter(Boolean);
  }

  if (
    !parsedDecodedTx.outputActions ||
    !parsedDecodedTx.outputActions?.length
  ) {
    // TODO nativeTransfer > 0
    // TODO [ nativeTransferAction, commonAction, ...others ]
    // TODO [ nativeTransferAction, ...others ]
    // TODO [ commonAction ]
    parsedDecodedTx.outputActions = [commonAction];
  }

  parsedDecodedTx.outputActions = parsedDecodedTx.outputActions.filter(
    (item) => item && !item.hidden,
  );

  const outputActionsLength = parsedDecodedTx.outputActions.length;
  let shouldFilterOutTokenApprove = false;
  if (outputActionsLength >= 3) {
    shouldFilterOutTokenApprove = true;
  } else if (outputActionsLength === 2) {
    shouldFilterOutTokenApprove = !parsedDecodedTx.outputActions.find(
      (item) => item.type === IDecodedTxActionType.NATIVE_TRANSFER,
    );
  }
  // covalent including some fake tokenApprove log_events
  if (shouldFilterOutTokenApprove) {
    parsedDecodedTx.outputActions = parsedDecodedTx.outputActions.filter(
      (item) => item && item.type !== IDecodedTxActionType.TOKEN_APPROVE,
    );
  }

  covalentTx.parsedDecodedTx = parsedDecodedTx;
  debugCodes.breakpointCovalentTx({ txHash: covalentTx.tx_hash });
  return covalentTx;
}

async function fetchCovalentHistoryRaw({
  chainId,
  address,
  contract,
  pageNumber,
  pageSize,
}: {
  chainId: string;
  address: string;
  contract?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<ICovalentHistoryList> {
  // eslint-disable-next-line no-param-reassign
  pageNumber = pageNumber ?? 0;
  // eslint-disable-next-line no-param-reassign
  pageSize = pageSize ?? HISTORY_CONSTS.FETCH_ON_CHAIN_LIMIT;

  // https://www.covalenthq.com/docs/api/#/0/Get%20ERC20%20token%20transfers%20for%20address/USD/1
  const tokenRequestUrl = `${getCovalentApiEndpoint()}/v1/${chainId}/address/${address}/transfers_v2/`;
  // https://www.covalenthq.com/docs/api/#/0/Get%20transactions%20for%20address/USD/1
  const url = `${getCovalentApiEndpoint()}/v1/${chainId}/address/${address}/transactions_v2/`;

  const response = await axios.get<ICovalentHistoryList>(
    contract ? tokenRequestUrl : url,
    {
      params: {
        'page-number': pageNumber,
        'page-size': pageSize,
        // 'key': COVALENT_API_KEY,
        'contract-address': contract,
      },
    },
  );
  return response.data;
}

function getErc20TransferHistories(
  chainId: string,
  address: string,
  contract: string,
  pageNumber: number,
  pageSize: number,
): Promise<HistoryDetailList | null> {
  const request = `${getCovalentApiEndpoint()}/v1/${chainId}/address/${address}/transfers_v2/`;
  return axios
    .get<HistoryDetailList>(request, {
      params: {
        'page-number': pageNumber,
        'page-size': pageSize,
        // 'key': COVALENT_API_KEY,
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

export {
  fetchCovalentHistoryRaw,
  getTxHistories,
  getErc20TransferHistories,
  getNftDetail,
};
