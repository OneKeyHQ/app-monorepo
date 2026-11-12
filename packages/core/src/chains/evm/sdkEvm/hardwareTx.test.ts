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

  // The hardware gas-price sign message has no access-list field, so the
  // device always signs the legacy payload. Assembling a type 1 envelope
  // locally would pair that signature with different bytes (OK-67031).
  describe('gas-price transactions', () => {
    const gasPriceTx = {
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      value: '0x0',
      data: '0x',
      nonce: 1,
      gasLimit: '21000',
      gasPrice: '1000000000',
      chainId: 56,
    };
    const accessList = [
      {
        address: '0x3333333333333333333333333333333333333333',
        storageKeys: [`0x${'00'.repeat(31)}01`],
      },
    ];
    const legacySerialized = serialize(
      buildHardwareEvmTransaction(gasPriceTx).unsignedTx,
    );

    it('signs as legacy and drops a non-empty access list', () => {
      const { hwTransaction, unsignedTx } = buildHardwareEvmTransaction({
        ...gasPriceTx,
        accessList,
      });

      expect(hwTransaction).not.toHaveProperty('accessList');
      expect(unsignedTx.type).toBeUndefined();
      expect(unsignedTx.accessList).toBeUndefined();
      expect(serialize(unsignedTx)).toBe(legacySerialized);
    });

    it('signs as legacy when the access list is empty', () => {
      const { hwTransaction, unsignedTx } = buildHardwareEvmTransaction({
        ...gasPriceTx,
        accessList: [],
      });

      expect(hwTransaction).not.toHaveProperty('accessList');
      expect(unsignedTx.type).toBeUndefined();
      expect(serialize(unsignedTx)).toBe(legacySerialized);
    });

    it('does not forward an EIP-2930 txType to the device', () => {
      const { hwTransaction, unsignedTx } = buildHardwareEvmTransaction({
        ...gasPriceTx,
        txType: 1,
        accessList,
      });

      expect(hwTransaction).not.toHaveProperty('txType');
      expect(serialize(unsignedTx)).toBe(legacySerialized);
    });
  });

  it('keeps the access list on EIP-1559 transactions', () => {
    const accessList = [
      {
        address: '0x3333333333333333333333333333333333333333',
        storageKeys: [`0x${'00'.repeat(31)}01`],
      },
    ];
    const { hwTransaction, unsignedTx } = buildHardwareEvmTransaction({
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      value: '0x0',
      data: '0x',
      nonce: 1,
      gasLimit: '21000',
      maxFeePerGas: '2000000000',
      maxPriorityFeePerGas: '1000000000',
      chainId: 1,
      accessList,
    });

    expect((hwTransaction as { accessList?: unknown }).accessList).toEqual(
      accessList,
    );
    expect(unsignedTx.type).toBe(2);
    expect(unsignedTx.accessList).toEqual(accessList);
  });
});
