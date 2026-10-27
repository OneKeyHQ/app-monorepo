import type { IEncodedTxZcash } from '@onekeyhq/kit-bg/src/vaults/impls/zcash/types';
import type { IDisplayComponent } from '@onekeyhq/shared/types/signatureConfirm';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';

import {
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
