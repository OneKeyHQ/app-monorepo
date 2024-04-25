import uuid from 'react-native-uuid';

import type {
  IDBAccount,
  IDBUtxoAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

export function generateUUID() {
  return uuid.v4() as string;
}

export const uidForWagmi = (function () {
  const size = 256;
  let index = size;
  let buffer: string;
  return function (length = 11): string {
    if (!buffer || index + length > size * 2) {
      buffer = '';
      index = 0;
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < size; i++) {
        // eslint-disable-next-line no-bitwise
        buffer += ((256 + Math.random() * 256) | 0).toString(16).substring(1);
      }
    }
    // eslint-disable-next-line no-plusplus
    return buffer.substring(index, index++ + length);
  };
})();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function noopObject(..._: any[]) {
  return null;
}

const CONTACT_NAMESPACE = '63363334-3563-5463-a336-666666353665';
const HD_ACCOUNT_NAMESPACE = '31626535-3739-5531-a536-306136356236';
const IMPORTED_ACCOUNT_NAMESPACE = '36383162-6565-5764-a462-343664326230';
const WATCHING_ACCOUNT_NAMESPACE = '62363931-3936-5332-b633-636233663336';

export function getImportedAccountUUID(account: IDBAccount): string {
  return uuid.v5(account.id, IMPORTED_ACCOUNT_NAMESPACE) as string;
}

export function getWatchingAccountUUID(account: IDBAccount): string {
  return uuid.v5(account.id, WATCHING_ACCOUNT_NAMESPACE) as string;
}

export function getContactUUID({
  address,
  networkId,
}: {
  address: string;
  networkId: string;
}): string {
  return uuid.v5(`${networkId},${address}`, CONTACT_NAMESPACE) as string;
}

export function getHDAccountUUID(account: IDBAccount): string {
  let uuidName = '';

  const { type, path, pub = '', address = '' } = account;

  if ((type === 'simple' || type === 'variant') && pub.length > 0) {
    // Simple account & Variant address account should have a pubkey
    uuidName = `${path},${pub}`;
  } else if (type === 'utxo') {
    const { xpub } = account as IDBUtxoAccount;
    if (xpub.length > 0) {
      // UTXO account should have a xpub in BCH, Doge and so on.
      uuidName = `${path},${xpub}`;
    } else {
      // special UTXOs, such as those not utilizing xpub in Nexa.
      uuidName = `${path},${address}`;
    }
  }

  if (uuidName.length > 0) {
    return uuid.v5(uuidName, HD_ACCOUNT_NAMESPACE) as string;
  }
  return '';
}
