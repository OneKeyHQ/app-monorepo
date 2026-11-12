import { parse } from '@ethersproject/transactions';

import {
  buildSignedTxFromSignatureEvm,
  packTransaction,
  packUnsignedTxForSignEvm,
} from '@onekeyhq/core/src/chains/evm/sdkEvm';

import { ethers } from './ethers';

import type { IEncodedTxEvm } from '../types';

const privateKey = `0x${'0a'.repeat(32)}`;
const from = ethers.utils.computeAddress(privateKey);
const KEY_A = `0x${'11'.repeat(32)}`;
const KEY_B = `0x${'22'.repeat(32)}`;

// Entry order and duplicates are part of what the sender commits to, so the
// list must reach the chain exactly as it was requested.
const accessList = [
  { address: `0x${'00'.repeat(20)}`, storageKeys: [KEY_B, KEY_A, KEY_B] },
  { address: `0x${'33'.repeat(20)}`, storageKeys: [] },
  { address: `0x${'00'.repeat(20)}`, storageKeys: [KEY_A] },
];

const baseTx: IEncodedTxEvm = {
  from,
  to: `0x${'44'.repeat(20)}`,
  value: '0x0',
  data: '0x',
  nonce: '0x1',
  gasLimit: '0x5208',
  chainId: '1',
};
const eip1559Tx: IEncodedTxEvm = {
  ...baseTx,
  maxFeePerGas: '0x77359400',
  maxPriorityFeePerGas: '0x3b9aca00',
};
const gasPriceTx: IEncodedTxEvm = { ...baseTx, gasPrice: '0x3b9aca00' };

// Signs the packed digest the way the software keyring does and reads the
// signed transaction back.
function signAndParse(encodedTx: IEncodedTxEvm) {
  const { digest, tx } = packUnsignedTxForSignEvm({ encodedTx } as never);
  const { recoveryParam, r, s } = new ethers.utils.SigningKey(
    privateKey,
  ).signDigest(digest);
  const { rawTx } = buildSignedTxFromSignatureEvm({
    tx,
    signature: { v: recoveryParam, r, s },
  });
  return parse(rawTx);
}

describe('packTransaction access list', () => {
  it('keeps the access list on an EIP-1559 transaction', () => {
    const signedTx = signAndParse({ ...eip1559Tx, accessList });

    expect(signedTx.type).toBe(2);
    expect(signedTx.accessList).toEqual(accessList);
    expect(signedTx.from).toBe(from);
  });

  it('signs a gas-price transaction with an access list as EIP-2930', () => {
    const signedTx = signAndParse({ ...gasPriceTx, accessList });

    expect(signedTx.type).toBe(1);
    expect(signedTx.accessList).toEqual(accessList);
    expect(signedTx.from).toBe(from);
  });

  it('treats an empty access list as absent', () => {
    expect(packTransaction({ ...gasPriceTx, accessList: [] })).toEqual(
      packTransaction(gasPriceTx),
    );
    expect(packTransaction({ ...eip1559Tx, accessList: [] })).toEqual(
      packTransaction(eip1559Tx),
    );
  });

  it('treats a malformed access list as absent', () => {
    const shortStorageKey = [
      { address: `0x${'33'.repeat(20)}`, storageKeys: ['0x1234'] },
    ];
    const notAList = { [`0x${'33'.repeat(20)}`]: [KEY_A] };

    expect(
      packTransaction({ ...gasPriceTx, accessList: shortStorageKey }),
    ).toEqual(packTransaction(gasPriceTx));
    expect(
      packTransaction({
        ...eip1559Tx,
        accessList: notAList as unknown as IEncodedTxEvm['accessList'],
      }),
    ).toEqual(packTransaction(eip1559Tx));
  });
});
