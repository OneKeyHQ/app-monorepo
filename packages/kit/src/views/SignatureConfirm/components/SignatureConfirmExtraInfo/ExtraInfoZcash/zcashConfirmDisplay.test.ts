import type { IEncodedTxZcash } from '@onekeyhq/kit-bg/src/vaults/impls/zcash/types';
import type { IDisplayComponent } from '@onekeyhq/shared/types/signatureConfirm';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';

import {
  getZcashConfirmFrom,
  getZcashEncodedTx,
  isZcashShieldedSpend,
  replaceAccountAddressComponent,
} from './zcashConfirmDisplay';

const T1_A = 't1UYsZVJkLPeMjxEtACvSxfWuNmddpWfxzs';
const T1_B = 't1gzpngZcWuDFHqVKdStPJTN1WFLQyQ6grR';
const U1 = 'u1privateaddress';

function buildTx(overrides: Partial<IEncodedTxZcash>): IEncodedTxZcash {
  return {
    inputs: [],
    outputs: [{ address: T1_B, value: '1000' }],
    inputsForCoinSelect: [],
    outputsForCoinSelect: [],
    fee: '10000',
    txSize: undefined,
    zcashMode: 'privacy',
    zcashTo: T1_B,
    zcashAmountValue: '1000',
    ...overrides,
  };
}

function input(address: string, vout: number) {
  return { txid: 'aa'.repeat(32), vout, value: '5000', address, path: '' };
}

describe('getZcashConfirmFrom', () => {
  it('lists deduplicated spending t1 addresses for transparent sends', () => {
    const tx = buildTx({
      zcashMode: 'transparent',
      inputs: [input(T1_A, 0), input(T1_B, 1), input(T1_A, 2)],
    });
    expect(getZcashConfirmFrom(tx)).toEqual({
      kind: 'addresses',
      addresses: [T1_A, T1_B],
    });
  });

  it('falls back to the pool label when inputs carry no address', () => {
    const tx = buildTx({ zcashMode: 'transparent', inputs: [input('', 0)] });
    expect(getZcashConfirmFrom(tx)).toEqual({
      kind: 'pool',
      label: 'Transparent',
    });
  });

  it('shows the shielded pool name', () => {
    expect(
      getZcashConfirmFrom(buildTx({ zcashSpendSource: 'ironwood' })),
    ).toEqual({ kind: 'pool', label: 'Ironwood' });
    expect(
      getZcashConfirmFrom(buildTx({ zcashSpendSource: 'orchard' })),
    ).toEqual({ kind: 'pool', label: 'Orchard' });
    expect(getZcashConfirmFrom(buildTx({}))).toEqual({
      kind: 'pool',
      label: 'Shielded',
    });
  });
});

describe('zcash encoded tx detection', () => {
  it('only treats privacy-mode Zcash txs as shielded spends', () => {
    expect(
      isZcashShieldedSpend(buildTx({ zcashSpendSource: 'ironwood' })),
    ).toBe(true);
    expect(isZcashShieldedSpend(buildTx({ zcashMode: 'transparent' }))).toBe(
      false,
    );
    expect(isZcashShieldedSpend({ inputs: [], outputs: [] })).toBe(false);
    expect(isZcashShieldedSpend('0xdead')).toBe(false);
    expect(getZcashEncodedTx(undefined)).toBeUndefined();
  });
});

describe('replaceAccountAddressComponent', () => {
  const network: IDisplayComponent = {
    type: EParseTxComponentType.Network,
    label: 'Network',
    networkId: 'zec--0',
  };
  const accountRow: IDisplayComponent = {
    type: EParseTxComponentType.Address,
    label: 'Account address',
    address: T1_A,
    tags: [],
  };
  const recipientRow: IDisplayComponent = {
    type: EParseTxComponentType.Address,
    label: 'To',
    address: T1_A,
    tags: [],
  };
  const components = [network, accountRow, recipientRow];

  it('replaces only the leading account row', () => {
    const next = replaceAccountAddressComponent({
      components,
      signer: T1_A,
      address: U1,
    });
    expect(next[1]).toEqual({ ...accountRow, address: U1 });
    expect(next[2]).toBe(recipientRow);
    expect(components[1]).toBe(accountRow);
  });

  it('keeps components untouched without an override or on signer mismatch', () => {
    expect(
      replaceAccountAddressComponent({
        components,
        signer: T1_A,
        address: undefined,
      }),
    ).toBe(components);
    expect(
      replaceAccountAddressComponent({
        components,
        signer: T1_B,
        address: U1,
      }),
    ).toBe(components);
  });
});
