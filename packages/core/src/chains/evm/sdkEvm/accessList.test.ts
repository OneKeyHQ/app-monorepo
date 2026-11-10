import { parse, serialize } from '@ethersproject/transactions';

import type { IEncodedTxEvm } from '../types';

import { buildHardwareEvmTransaction } from './hardwareTx';
import { packTransaction } from './index';

const accessList = [
  {
    address: '0x3333333333333333333333333333333333333333',
    storageKeys: [`0x${'11'.repeat(32)}`],
  },
];
const tx: IEncodedTxEvm = {
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  value: '0x1',
  data: '0x1234',
  nonce: 1,
  chainId: '1',
  gasLimit: '100000',
  accessList,
};

describe('access-list signing commitment', () => {
  it.each([
    { type: 1, fees: { gasPrice: '1000000000' } },
    {
      type: 2,
      fees: { maxFeePerGas: '2000000000', maxPriorityFeePerGas: '1000000000' },
    },
  ])(
    'software serializes the signed type $type access list',
    ({ type, fees }) => {
      const encodedTx = { ...tx, ...fees };
      const software = packTransaction(encodedTx);
      expect(software.type).toBe(type);
      expect(software.accessList).toEqual(accessList);
      if (type === 2) {
        const { hwTransaction, unsignedTx } =
          buildHardwareEvmTransaction(encodedTx);
        expect(hwTransaction.accessList).toEqual(accessList);
        expect(serialize(software)).toBe(serialize(unsignedTx));
      } else {
        expect(() => buildHardwareEvmTransaction(encodedTx)).toThrow(
          'require EIP-1559 fees',
        );
      }
      expect(parse(serialize(software))).toMatchObject({
        type,
        accessList,
        data: tx.data,
      });
      expect(
        serialize(
          packTransaction({
            ...encodedTx,
            accessList: [
              { ...accessList[0], storageKeys: [`0x${'22'.repeat(32)}`] },
            ],
          }),
        ),
      ).not.toBe(serialize(software));
    },
  );

  it.each([undefined, 1])(
    'keeps unmarked gas-price transactions legacy with txType %s',
    (txType) => {
      const result = packTransaction({
        ...tx,
        accessList: undefined,
        gasPrice: '1000000000',
        txType,
      });
      expect(result.type).toBeUndefined();
      expect(parse(serialize(result)).accessList).toBeUndefined();
    },
  );
});
