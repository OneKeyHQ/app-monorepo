import type { IMarketWsPriceData } from '@onekeyhq/shared/types/marketV2';

import type { EMessageType } from './messageType';

export type IWsPriceData = IMarketWsPriceData;

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
