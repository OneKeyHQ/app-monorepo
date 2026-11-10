import { serialize } from '@ethersproject/transactions';

import {
  buildHardwareEvmTransaction,
  packTransaction,
} from '@onekeyhq/core/src/chains/evm/sdkEvm';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import EvmVault from './Vault';

// Instantiating the full vault requires a backgroundApi context; the
// buildUnsignedTx nonce-chaining path only touches networkId, so a bare
// prototype instance is enough.
const buildVault = () => {
  const vault = Object.create(EvmVault.prototype) as EvmVault;
  vault.networkId = 'evm--8453';
  return vault;
};

const baseEncodedTx: IEncodedTxEvm = {
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  value: '0x0',
  data: '0x',
};

describe('EvmVault.buildUnsignedTx nonce chaining', () => {
  it('assigns nonce prevNonce + 1 when prevNonce is 0', async () => {
    const vault = buildVault();
    const unsignedTx = await vault.buildUnsignedTx({
      encodedTx: { ...baseEncodedTx },
      prevNonce: 0,
    });
    expect(unsignedTx.nonce).toBe(1);
    expect((unsignedTx.encodedTx as IEncodedTxEvm).nonce).toBe(1);
  });

  it('assigns nonce prevNonce + 1 when prevNonce is positive', async () => {
    const vault = buildVault();
    const unsignedTx = await vault.buildUnsignedTx({
      encodedTx: { ...baseEncodedTx },
      prevNonce: 5,
    });
    expect(unsignedTx.nonce).toBe(6);
    expect((unsignedTx.encodedTx as IEncodedTxEvm).nonce).toBe(6);
  });

  it('leaves nonce unset when prevNonce is not provided', async () => {
    const vault = buildVault();
    const unsignedTx = await vault.buildUnsignedTx({
      encodedTx: { ...baseEncodedTx },
    });
    expect(unsignedTx.nonce).toBeUndefined();
    expect((unsignedTx.encodedTx as IEncodedTxEvm).nonce).toBeUndefined();
  });
});

describe('EvmVault order access-list preservation', () => {
  const accessList = [
    { address: baseEncodedTx.to, storageKeys: [`0x${'11'.repeat(32)}`] },
  ];
  const encodedTx = {
    ...baseEncodedTx,
    data: '0x1234',
    chainId: '1',
    nonce: 1,
    type: '0x2',
    accessList,
  };
  const common = {
    feeDecimals: 9,
    feeSymbol: 'ETH',
    nativeDecimals: 18,
    nativeSymbol: 'ETH',
  };

  it('preserves the complete marker through unsigned construction and estimation', async () => {
    const vault = buildVault();
    const unsigned = await vault.buildUnsignedTx({ encodedTx });
    const estimate = await vault.buildEstimateFeeParams({
      encodedTx: unsigned.encodedTx as IEncodedTxEvm,
    });
    expect(estimate.encodedTx).toMatchObject({
      accessList,
      data: encodedTx.data,
      value: encodedTx.value,
    });
  });

  it.each([
    {
      name: 'legacy gas quote',
      fees: { gas: { gasPrice: '2', gasLimit: '100000' } },
    },
    {
      name: 'dynamic gas quote',
      fees: {
        gasEIP1559: {
          maxFeePerGas: '2',
          maxPriorityFeePerGas: '1',
          gasLimit: '100000',
          baseFeePerGas: '1',
          gasLimitForDisplay: '100000',
        },
      },
    },
  ])(
    'uses the same type 2 envelope for all signers with $name',
    async ({ fees }) => {
      const vault = buildVault();
      const result = await vault._attachFeeInfoToEncodedTx({
        encodedTx,
        feeInfo: { common, ...fees },
      });
      expect(result).toMatchObject({
        type: '0x2',
        txType: 2,
        accessList,
        data: encodedTx.data,
        value: encodedTx.value,
        maxFeePerGas: '0x77359400',
      });
      expect(result.gasPrice).toBeUndefined();
      if (fees.gas)
        expect(result.maxPriorityFeePerGas).toBe(result.maxFeePerGas);
      const { unsignedTx, hwTransaction } = buildHardwareEvmTransaction(result);
      expect(hwTransaction.accessList).toEqual(accessList);
      expect(hwTransaction.gasPrice).toBeUndefined();
      expect(serialize(packTransaction(result))).toBe(serialize(unsignedTx));
      expect(encodedTx).not.toHaveProperty('maxFeePerGas');
    },
  );

  it.each([EReplaceTxType.SpeedUp, EReplaceTxType.Cancel])(
    'handles the access list correctly for %s replacement',
    async (replaceType) => {
      const vault = buildVault();
      const tx = await vault.buildReplaceEncodedTx({
        decodedTx: { encodedTx, nonce: 1 } as IDecodedTx,
        replaceType,
      });
      if (replaceType === EReplaceTxType.SpeedUp) {
        expect(tx.accessList).toEqual(accessList);
        expect(tx.data).toBe(encodedTx.data);
        expect(tx.type).toBe('0x2');
      } else {
        expect(tx.accessList).toBeUndefined();
        expect(tx.data).toBe('0x');
      }
    },
  );

  it.each([
    { type: undefined },
    { type: '0x0' },
    { type: '0x1' },
    { type: '0x4', authorizationList: [] },
    { type: '0x3', blobVersionedHashes: [`0x${'11'.repeat(32)}`] },
    { type: '0x71' },
    { type: '0x1', txType: 4 },
    { type: '0x2', txType: 4 },
    { type: '0x2', authorizationList: [] },
    { type: '0x2', blobVersionedHashes: [] },
    { type: '0x2', blobs: [] },
    { type: '0x2', maxFeePerBlobGas: '0x1' },
  ])('does not rewrite another transaction envelope $type', async (extra) => {
    const vault = buildVault();
    const original = { ...encodedTx, ...extra };
    const result = await vault._attachFeeInfoToEncodedTx({
      encodedTx: original,
      feeInfo: { common, gas: { gasPrice: '2', gasLimit: '100000' } },
    });
    expect(result).toMatchObject({
      ...extra,
      accessList,
      gasPrice: '0x77359400',
    });
    expect(result.maxFeePerGas).toBeUndefined();
  });

  it('keeps the fee model unchanged when no access list was supplied', async () => {
    const vault = buildVault();
    const result = await vault._attachFeeInfoToEncodedTx({
      encodedTx: { ...encodedTx, accessList: undefined },
      feeInfo: { common, gas: { gasPrice: '2', gasLimit: '100000' } },
    });
    expect(result).toMatchObject({ type: '0x2', gasPrice: '0x77359400' });
    expect(result.maxFeePerGas).toBeUndefined();
    expect(result.txType).toBeUndefined();
  });

  it.each([0, 1, 2])(
    'synchronizes ordinary type %s with a selected dynamic fee quote',
    async (type) => {
      const vault = buildVault();
      const result = await vault._attachFeeInfoToEncodedTx({
        encodedTx: { ...encodedTx, type, txType: type },
        feeInfo: {
          common,
          gasEIP1559: {
            maxFeePerGas: '2',
            maxPriorityFeePerGas: '1',
            gasLimit: '100000',
            baseFeePerGas: '1',
            gasLimitForDisplay: '100000',
          },
        },
      });
      expect(result).toMatchObject({
        type: '0x2',
        txType: 2,
        accessList,
        maxFeePerGas: '0x77359400',
        maxPriorityFeePerGas: '0x3b9aca00',
      });
      expect(result.gasPrice).toBeUndefined();
      expect(packTransaction(result).type).toBe(2);
    },
  );

  it('preserves ordinary type 1 with a selected gas-price quote', async () => {
    const vault = buildVault();
    const result = await vault._attachFeeInfoToEncodedTx({
      encodedTx: { ...encodedTx, type: '0x1', txType: 1 },
      feeInfo: { common, gas: { gasPrice: '2', gasLimit: '100000' } },
    });
    expect(result).toMatchObject({
      type: '0x1',
      txType: 1,
      accessList,
      gasPrice: '0x77359400',
    });
    expect(packTransaction(result).type).toBe(1);
  });

  it.each([
    { type: '0x3' },
    { type: '0x4' },
    { type: '0x71' },
    { type: '0x2', txType: 4 },
    { type: '0x2', authorizationList: [] },
    { type: '0x2', blobVersionedHashes: [] },
  ])(
    'preserves special envelopes with dynamic fee quotes: $type',
    async (extra) => {
      const vault = buildVault();
      const result = await vault._attachFeeInfoToEncodedTx({
        encodedTx: { ...encodedTx, ...extra },
        feeInfo: {
          common,
          gasEIP1559: {
            maxFeePerGas: '2',
            maxPriorityFeePerGas: '1',
            gasLimit: '100000',
            baseFeePerGas: '1',
            gasLimitForDisplay: '100000',
          },
        },
      });
      expect(result).toMatchObject({ ...extra, accessList });
      expect(result.txType).toBe(extra.txType);
    },
  );
});
