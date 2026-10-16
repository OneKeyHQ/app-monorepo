import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';

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

describe('final swap fee attachment', () => {
  const common = {
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeDecimals: 18,
    nativeSymbol: 'ETH',
  };
  it.each(['240996', '300000'])(
    'serializes the selected legacy gas %s into both gas fields',
    async (gasLimit) => {
      const final = await buildVault()._attachFeeInfoToEncodedTx({
        encodedTx: { ...baseEncodedTx, gas: '0x781c', gasLimit: '0x781c' },
        feeInfo: { common, gas: { gasLimit, gasPrice: '2' } },
      });
      expect(BigInt(final.gas ?? '0')).toBe(BigInt(gasLimit));
      expect(final.gasLimit).toBe(final.gas);
      expect(BigInt(final.gasPrice ?? '0')).toBe(2_000_000_000n);
    },
  );
  it('serializes the selected EIP-1559 gas without changing either fee rate', async () => {
    const final = await buildVault()._attachFeeInfoToEncodedTx({
      encodedTx: baseEncodedTx,
      feeInfo: {
        common,
        gasEIP1559: {
          gasLimit: '240996',
          gasLimitForDisplay: '240996',
          baseFeePerGas: '1',
          maxFeePerGas: '3',
          maxPriorityFeePerGas: '2',
        },
      },
    });
    expect(BigInt(final.gas ?? '0')).toBe(240_996n);
    expect(final.gasLimit).toBe(final.gas);
    expect(BigInt(final.maxFeePerGas ?? '0')).toBe(3_000_000_000n);
    expect(BigInt(final.maxPriorityFeePerGas ?? '0')).toBe(2_000_000_000n);
  });
});
