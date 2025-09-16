/* eslint-disable spellcheck/spell-checker */

import type { EMessageType } from './messageType';

export interface IWsTxsTransferInfo {
  address: string;
  amount: number;
  changeAmount: number;
  decimals: number;
  nearestPrice: number;
  price: number;
  symbol: string;
  type: 'transfer';
  typeSwap: 'from' | 'to';
  uiAmount: number;
  uiChangeAmount: number;
  feeInfo?: unknown;
}

export interface IWsTxsData {
  blockUnixTime: number;
  owner: string;
  source: string;
  txHash: string;
  side: string;
  alias: string | null;
  isTradeOnBe: boolean;
  platform: string;
  volumeUSD: number;
  from: IWsTxsTransferInfo;
  to: IWsTxsTransferInfo;
  poolId: string;
  network: string;
  interactedProgramId: string;
  insIndex: number;
  blockNumber: number;
  innerInsIndex: number;
}

export interface IWsTxsDataMessage {
  type: EMessageType.TXS_DATA;
  data: IWsTxsData;
}

// Example data structure:
// {
//     "type": "TXS_DATA",
//     "data": {
//         "blockUnixTime": 1757993777,
//         "owner": "7R9UKwY8XuSZ7nVDbnU6ZWbE5EZpw2ozWcA27JxS483h",
//         "source": "solfi",
//         "txHash": "5SdoJviqd3C3E5Tbqu7YeHEdWWDdBuPCvCerDqBKuGwYaFymS2ueh5uk1pdJBudGq7Rzgcid9MVeEA7LyEKx6xMD",
//         "side": "swap",
//         "alias": null,
//         "isTradeOnBe": false,
//         "platform": "H1kxA6mDD3CwMbyPSLQ3dLcG6rCzwYe1ZkZM7gMrb5Ks",
//         "volumeUSD": 59.421674,
//         "from": {
//             "address": "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
//             "amount": 6979906,
//             "changeAmount": -6979906,
//             "decimals": 6,
//             "nearestPrice": 8.520238527361094,
//             "price": 8.511732334801836,
//             "symbol": "TRUMP",
//             "type": "transfer",
//             "typeSwap": "from",
//             "uiAmount": 6.979906,
//             "uiChangeAmount": -6.979906
//         },
//         "to": {
//             "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
//             "amount": 59421674,
//             "changeAmount": 59421674,
//             "decimals": 6,
//             "feeInfo": null,
//             "nearestPrice": 0.99982191,
//             "price": 0.99982191,
//             "symbol": "USDC",
//             "type": "transfer",
//             "typeSwap": "to",
//             "uiAmount": 59.421674,
//             "uiChangeAmount": 59.421674
//         },
//         "poolId": "3AbG3ZA19fJKjTSTMTCz7j2bodPagXog4PwTBi8H7UA4",
//         "network": "solana",
//         "interactedProgramId": "H1kxA6mDD3CwMbyPSLQ3dLcG6rCzwYe1ZkZM7gMrb5Ks",
//         "insIndex": 2,
//         "blockNumber": 367122833,
//         "innerInsIndex": 2
//     }
// }
