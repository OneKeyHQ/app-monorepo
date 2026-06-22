import { serialize } from '@ethersproject/transactions';

import { buildHardwareEvmTransaction } from './hardwareTx';

describe('buildHardwareEvmTransaction', () => {
  it('keeps contract deployment unsigned transactions serializable by omitting to', () => {
    const { unsignedTx } = buildHardwareEvmTransaction({
      from: '0x1111111111111111111111111111111111111111',
      to: '',
      value: '0x0',
      data: '0x6001600055',
      nonce: 0,
      gasLimit: '100000',
      gasPrice: '1000000000',
      chainId: 1,
    });

    expect(unsignedTx.to).toBeUndefined();
    expect(() => serialize(unsignedTx)).not.toThrow();
  });

  it('keeps EIP-2930 access-list transactions typed as type 1', () => {
    const { hwTransaction, unsignedTx } = buildHardwareEvmTransaction({
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      value: '0x0',
      data: '0x',
      nonce: 1,
      gasLimit: '21000',
      gasPrice: '1000000000',
      chainId: 1,
      txType: 1,
      accessList: [
        {
          address: '0x3333333333333333333333333333333333333333',
          storageKeys: [],
        },
      ],
    });

    expect((hwTransaction as { txType?: number }).txType).toBe(1);
    expect(unsignedTx.type).toBe(1);
    expect(unsignedTx.accessList).toEqual([
      {
        address: '0x3333333333333333333333333333333333333333',
        storageKeys: [],
      },
    ]);
    expect(serialize(unsignedTx)).toMatch(/^0x01/u);
  });
});
