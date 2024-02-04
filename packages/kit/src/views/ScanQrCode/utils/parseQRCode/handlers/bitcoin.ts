import { EQRCodeHandlerType } from '../type';

import type { IBitcoinValue, IQRCodeHandler } from '../type';

// bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=20.3&label=Luke-Jr

// from https://github.com/bitcoinjs/bip21/blob/fb796720b56d4b22dff8ad543ef4153ef45a10ad/index.js#L7
export const bitcoin: IQRCodeHandler<IBitcoinValue> = (value, options) => {
  const urnScheme = options?.bitcoinUrlScheme || 'bitcoin';
  const urnSchemeActual = value.slice(0, urnScheme.length).toLowerCase();
  if (urnSchemeActual !== urnScheme || value.charAt(urnScheme.length) !== ':')
    return null;

  const split = value.indexOf('?');
  const address = value.slice(
    urnScheme.length + 1,
    split === -1 ? undefined : split,
  );
  if (/^\/\//.test(address)) {
    return null;
  }
  const query = split === -1 ? '' : value.slice(split + 1);
  const urlSearch = new URLSearchParams(query);
  const queryList = Array.from(urlSearch.entries()).reduce<{
    [key: string]: any;
  }>((paramList, [paramKey, paramValue]) => {
    paramList[paramKey] = paramValue;
    return paramList;
  }, {});

  if (queryList?.amount) {
    queryList.amount = Number(queryList?.amount);
    if (!Number.isFinite(queryList?.amount)) throw new Error('Invalid amount');
    if (queryList?.amount < 0) throw new Error('Invalid amount');
  }

  const { amount, label, message, ...paramList } = queryList;

  const bitcoinValue = { address, amount, label, message, paramList };
  return {
    type: EQRCodeHandlerType.BITCOIN,
    data: bitcoinValue,
  };
};
