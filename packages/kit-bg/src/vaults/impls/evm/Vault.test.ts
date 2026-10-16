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
