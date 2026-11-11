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

  it('rejects type 1 before the hardware SDK can discard its access list', () => {
    expect(() =>
      buildHardwareEvmTransaction({
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
      }),
    ).toThrow('require EIP-1559 fees');
  });

  it('keeps existing type 1 behavior when no access list was supplied', () => {
    const { unsignedTx } = buildHardwareEvmTransaction({
      to: '0x2222222222222222222222222222222222222222',
      nonce: 1,
      gasLimit: '21000',
      gasPrice: '1000000000',
      chainId: 1,
      txType: 1,
    });

    expect(unsignedTx.type).toBe(1);
    expect(unsignedTx.accessList).toBeUndefined();
    expect(() => serialize(unsignedTx)).not.toThrow();
  });
});
