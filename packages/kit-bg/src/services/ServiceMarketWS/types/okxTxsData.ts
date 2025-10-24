/* eslint-disable spellcheck/spell-checker */

import {
  OKX_DATA_SOURCE,
  normalizeTimestamp,
  toBigNumber,
  toNumber,
} from './okxShared';

import type { IWsTxsData, IWsTxsTransferInfo } from './txsData';

/**
 * OKX API Transaction Data Format
 * This represents the actual data structure returned by OKX WebSocket API
 */
export interface IOkxTransferInfo {
  address: string;
  amount: string;
  symbol: string;
  decimals: number;
  nearestPrice: string | null;
  price: string | null;
  changeAmount: string | null;
  uiAmount: string | null;
  uiChangeAmount: string | null;
  typeSwap: 'from' | 'to';
}

export interface IOkxChangedTokenInfo {
  amount: string;
  tokenAddress: string;
  tokenSymbol: string;
}

export interface IOkxTxsData {
  alias: string | null;
  id: string;
  chainIndex: string;
  tokenContractAddress: string;
  txHashUrl: string;
  txHash: string;
  owner: string;
  poolLogoUrl: string;
  type: string;
  changedTokenInfo: IOkxChangedTokenInfo[];
  from: IOkxTransferInfo;
  to: IOkxTransferInfo;
  price: string;
  volume: string;
  time: string;
  blockUnixTime: number;
  side: string;
  network: string;
  platform: string;
  isFiltered: string;
  dataSource: string;
  poolId?: string;
}

const normalizeDecimals = (decimals: number | undefined): number => {
  if (!Number.isFinite(decimals)) {
    return 0;
  }
  const normalized = Math.trunc(decimals as number);
  return normalized >= 0 ? normalized : 0;
};

const deriveBaseUnitsAmount = (
  rawValue: string | number | null | undefined,
  uiValue: string | number | null | undefined,
  decimals: number,
) => {
  const amountBN = toBigNumber(rawValue);
  if (decimals > 0) {
    const uiAmountBN = toBigNumber(uiValue);
    if (!uiAmountBN.isZero()) {
      const scaledUiAmount = uiAmountBN.shiftedBy(decimals);
      if (scaledUiAmount.isFinite()) {
        const difference = scaledUiAmount.minus(amountBN).abs();
        if (difference.lte(1)) {
          return amountBN.toNumber();
        }
      }
    }

    if (!amountBN.isInteger()) {
      const shiftedAmount = amountBN.shiftedBy(decimals);
      return shiftedAmount.isFinite() ? shiftedAmount.toNumber() : 0;
    }
  }

  return amountBN.toNumber();
};

const createTokenAddressMap = (
  tokens: IOkxChangedTokenInfo[] | undefined,
): Record<string, string> => {
  if (!tokens || tokens.length === 0) {
    return {};
  }

  return tokens.reduce<Record<string, string>>((acc, token) => {
    if (token?.tokenSymbol) {
      acc[token.tokenSymbol] = token.tokenAddress ?? '';
    }
    return acc;
  }, {});
};

const mapTransferInfo = (
  info: IOkxTransferInfo | undefined,
  fallbackTypeSwap: 'from' | 'to',
  tokenAddressMap: Record<string, string>,
): IWsTxsTransferInfo => {
  const decimals = normalizeDecimals(info?.decimals);

  const symbol = info?.symbol ?? '';
  const resolvedAddress = info?.address?.trim()
    ? info.address
    : tokenAddressMap[symbol] ?? '';

  return {
    address: resolvedAddress,
    amount: deriveBaseUnitsAmount(info?.amount, info?.uiAmount, decimals),
    changeAmount: deriveBaseUnitsAmount(
      info?.changeAmount,
      info?.uiChangeAmount,
      decimals,
    ),
    decimals,
    nearestPrice: toNumber(info?.nearestPrice),
    price: toNumber(info?.price),
    symbol,
    type: 'transfer',
    typeSwap: info?.typeSwap === 'to' ? 'to' : fallbackTypeSwap,
    uiAmount: toNumber(info?.uiAmount ?? info?.amount),
    uiChangeAmount: toNumber(info?.uiChangeAmount ?? info?.changeAmount),
  } as IWsTxsTransferInfo;
};

const deriveBlockNumber = (chainIndex: string | null | undefined): number => {
  const parsed = Number(chainIndex);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeNetwork = (network: string | null | undefined): string => {
  if (!network) {
    return '';
  }
  return network.toLowerCase();
};

export const isOkxTxsData = (data: unknown): data is IOkxTxsData => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const candidate = data as Partial<IOkxTxsData>;

  return (
    typeof candidate.txHash === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.side === 'string' &&
    typeof candidate.dataSource === 'string' &&
    candidate.dataSource === OKX_DATA_SOURCE &&
    typeof candidate.from === 'object' &&
    typeof candidate.to === 'object'
  );
};

export const convertOkxTxsDataToWsTxsData = (
  okxData: IOkxTxsData,
): IWsTxsData => {
  const tokenAddressMap = createTokenAddressMap(okxData.changedTokenInfo);

  const fromTransfer = mapTransferInfo(okxData.from, 'from', tokenAddressMap);
  const toTransfer = mapTransferInfo(okxData.to, 'to', tokenAddressMap);

  const blockUnixTime = normalizeTimestamp(
    okxData.blockUnixTime ?? okxData.time,
  );

  return {
    blockUnixTime,
    owner: okxData.owner ?? '',
    source: okxData.dataSource ?? OKX_DATA_SOURCE,
    txHash: okxData.txHash ?? okxData.txHashUrl ?? '',
    side: okxData.side ?? '',
    alias: okxData.alias ?? null,
    isTradeOnBe: false,
    platform: okxData.platform ?? '',
    volumeUSD: toNumber(okxData.volume ?? okxData.price),
    from: fromTransfer,
    to: toTransfer,
    poolId: okxData.poolId ?? '',
    poolLogoUrl: okxData.poolLogoUrl,
    network: normalizeNetwork(okxData.network),
    interactedProgramId: okxData.tokenContractAddress ?? okxData.poolId ?? '',
    insIndex: 0,
    blockNumber: deriveBlockNumber(okxData.chainIndex),
    innerInsIndex: 0,
  };
};

// [
//   "market",
//   {
//     "type": "TXS_DATA",
//     "data": [
//       {
//         "alias": null,
//         "id": "1761126233000!@#95200202!@#46054141940",
//         "chainIndex": "501",
//         "tokenContractAddress": "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
//         "txHashUrl": "5yWxL8rWPqcqmsM9Fz1H522e4Kb3SRqYHejYEW4khp1veFGeNWLUQwqMBzJJJ4LguK4UUPrudAfndBuecFdQPUpx",
//         "txHash": "5yWxL8rWPqcqmsM9Fz1H522e4Kb3SRqYHejYEW4khp1veFGeNWLUQwqMBzJJJ4LguK4UUPrudAfndBuecFdQPUpx",
//         "owner": "2LREmxK9aFvzcfbRRnK9UuWeM5yxZEGRkcnBFT9u2qA7",
//         "poolLogoUrl": "https://static.coinall.ltd/cdn/web3/protocol/logo/1710498417995.png/type=png_350_0",
//         "type": "sell",
//         "changedTokenInfo": [
//           {
//             "amount": "79.808833",
//             "tokenAddress": "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
//             "tokenSymbol": "TRUMP"
//           },
//           {
//             "amount": "463.699094",
//             "tokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
//             "tokenSymbol": "USDC"
//           }
//         ],
//         "from": {
//           "address": "",
//           "amount": "79.808833",
//           "symbol": "TRUMP",
//           "decimals": 0,
//           "nearestPrice": null,
//           "price": null,
//           "changeAmount": null,
//           "uiAmount": null,
//           "uiChangeAmount": null,
//           "typeSwap": "from"
//         },
//         "to": {
//           "address": "",
//           "amount": "463.699094",
//           "symbol": "USDC",
//           "decimals": 0,
//           "nearestPrice": null,
//           "price": "5.809367155109009049",
//           "changeAmount": null,
//           "uiAmount": null,
//           "uiChangeAmount": null,
//           "typeSwap": "to"
//         },
//         "price": "5.809367155109009049",
//         "volume": "463.638813117779999987129817",
//         "time": "1761126233000",
//         "blockUnixTime": 1761126233000,
//         "side": "sell",
//         "network": "Solana",
//         "platform": "Meteora DLMM",
//         "isFiltered": "0",
//         "dataSource": "okx"
//       }
//     ]
//   }
// ]
