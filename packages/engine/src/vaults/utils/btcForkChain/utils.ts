// @ts-expect-error
import coinSelectFn from 'coinselect';
// @ts-expect-error
import coinSelectSplit from 'coinselect/split';

import { NotImplemented } from '../../../errors';

import { AddressEncodings } from './types';

import type { DBUTXOAccount } from '../../../types/account';
import type { IEncodedTxBtc, IUTXOInput, IUTXOOutput } from './types';

type IAccountDefault = {
  namePrefix: string;
  addressEncoding: AddressEncodings;
};

export function getAccountDefaultByPurpose(
  purpose: number,
  impl: string,
): IAccountDefault {
  const coinName = impl ? impl.toUpperCase() : '';
  switch (purpose) {
    case 44:
      return {
        namePrefix: `${coinName} Legacy`,
        addressEncoding: AddressEncodings.P2PKH,
      };
    case 49:
      return {
        namePrefix: `${coinName} Nested SegWit`,
        addressEncoding: AddressEncodings.P2SH_P2WPKH,
      };
    case 84:
      return {
        namePrefix: `${coinName} Native SegWit`,
        addressEncoding: AddressEncodings.P2WPKH,
      };
    case 86:
      return {
        namePrefix: `${coinName} Taproot`,
        addressEncoding: AddressEncodings.P2TR,
      };
    default:
      throw new NotImplemented(`Unsupported purpose ${purpose}.`);
  }
}

export function getBIP44Path(account: DBUTXOAccount, address: string) {
  let realPath = '';
  for (const [key, value] of Object.entries(account.addresses)) {
    if (value === address) {
      realPath = key;
      break;
    }
  }
  return `${account.path}/${realPath}`;
}

export const isTaprootPath = (pathPrefix: string) =>
  pathPrefix.startsWith(`m/86'/`);

export function isWatchAccountTaprootSegwit(xpubSegwit: string) {
  const reg = /^tr\((.*)\)$/;
  const match = reg.exec(xpubSegwit);
  if (match && match[1]) {
    return true;
  }
  return false;
}

export function isTaprootXpubSegwit(xpubSegwit: string) {
  const reg = /tr\(\[(.*)\](.*)\/<0;1>\/\*\)/;
  const match = reg.exec(xpubSegwit);
  if (match && match[2]) {
    return true;
  }
  return false;
}

export function getTaprootXpub(xpubSegwit: string) {
  const reg = /tr\(\[(.*)\](.*)\/<0;1>\/\*\)/;
  const match = reg.exec(xpubSegwit);
  if (match && match[2]) {
    return match[2];
  }
  return xpubSegwit;
}

export const coinSelect = (
  inputsForCoinSelect: IEncodedTxBtc['inputsForCoinSelect'],
  outputsForCoinSelect: IEncodedTxBtc['outputsForCoinSelect'],
  feeRate: string,
) => {
  const max = outputsForCoinSelect.every((i) => typeof i.value === 'undefined');
  const unspentSelectFn = max ? coinSelectSplit : coinSelectFn;
  const {
    inputs,
    outputs,
    fee,
  }: {
    inputs: IUTXOInput[];
    outputs: IUTXOOutput[];
    fee: number;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  } = unspentSelectFn(
    inputsForCoinSelect,
    outputsForCoinSelect,
    parseInt(feeRate),
  );
  return { inputs, outputs, fee };
};
