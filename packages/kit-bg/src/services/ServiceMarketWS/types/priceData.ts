/* eslint-disable spellcheck/spell-checker */

import type { EMessageType } from './messageType';

export interface IWsPriceData {
  o: number; // open price
  h: number; // high price
  l: number; // low price
  c: number; // close price
  eventType: 'ohlcv';
  type: string; // time interval like '1m', '5m', '1h', etc.
  unixTime: number;
  v: number; // volume
  symbol: string;
  address: string;
}

export interface IWsPriceDataMessage {
  type: EMessageType.PRICE_DATA;
  data: IWsPriceData;
}

// Example data structure:
// {
//     "type": "PRICE_DATA",
//     "data": {
//         "o": 8.520053380016329,
//         "h": 8.520238527361094,
//         "l": 8.511732334801836,
//         "c": 8.511732334801836,
//         "eventType": "ohlcv",
//         "type": "1m",
//         "unixTime": 1757993760,
//         "v": 14.076172,
//         "symbol": "TRUMP",
//         "address": "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN"
//     }
// }
