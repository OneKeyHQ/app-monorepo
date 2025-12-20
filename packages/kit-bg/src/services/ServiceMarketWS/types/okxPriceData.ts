/* eslint-disable spellcheck/spell-checker */

import { OKX_DATA_SOURCE, normalizeTimestamp, toNumber } from './okxShared';

import type { IWsPriceData } from './priceData';

export interface IOkxPriceData {
  address: string;
  symbol: string;
  type: string;
  eventType: string;
  unixTime: number | string;
  o: number | string;
  h: number | string;
  l: number | string;
  c: number | string;
  v: number | string;
  volUsd?: number | string;
  confirm?: number | string;
  dataSource: string;
}

const normalizeString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
};

export const isOkxPriceData = (data: unknown): data is IOkxPriceData => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const candidate = data as Partial<IOkxPriceData>;

  return (
    typeof candidate.address === 'string' &&
    typeof candidate.symbol === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.dataSource === 'string' &&
    candidate.dataSource === OKX_DATA_SOURCE &&
    candidate.eventType === 'ohlcv'
  );
};

export const convertOkxPriceDataToWsPriceData = (
  okxData: IOkxPriceData,
): IWsPriceData => {
  const volUsd =
    okxData.volUsd === undefined ? undefined : toNumber(okxData.volUsd);
  const confirm =
    okxData.confirm === undefined ? undefined : toNumber(okxData.confirm);

  return {
    o: toNumber(okxData.o),
    h: toNumber(okxData.h),
    l: toNumber(okxData.l),
    c: toNumber(okxData.c),
    v: toNumber(okxData.v),
    eventType: 'ohlcv',
    type: normalizeString(okxData.type),
    unixTime: normalizeTimestamp(okxData.unixTime),
    symbol: normalizeString(okxData.symbol),
    address: normalizeString(okxData.address),
    volUsd,
    confirm,
    dataSource: OKX_DATA_SOURCE,
  };
};
