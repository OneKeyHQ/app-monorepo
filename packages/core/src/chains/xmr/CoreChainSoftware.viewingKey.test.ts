import CoreChainSoftware from './CoreChainSoftware';
import { deriveXmrAccount } from './sdkXmrRuntime/address';

import type { ICoreApiSignBasePayload } from '../../types';

jest.mock('./sdkXmrRuntime/address', () => ({ deriveXmrAccount: jest.fn() }));

describe('XMR viewing-key authorization', () => {
  it.each([false, true])(
    'returns the derived viewing pair only for the matching account (testnet: %s)',
    async (isTestnet) => {
      const derive = jest.mocked(deriveXmrAccount).mockResolvedValue({
        primaryAddress: 'synthetic-primary',
        spendPublicKeyHex: '11'.repeat(32),
        viewPrivateKeyHex: '22'.repeat(32),
      });
      const core = Object.assign(
        Object.create(CoreChainSoftware.prototype) as CoreChainSoftware,
        {
          baseGetSingleSigner: async () => ({
            getPrvkeyHex: async () => 'synthetic-key',
          }),
        },
      );
      const payload = {
        account: { address: 'synthetic-primary', path: "m/44'/128'/0'" },
        networkInfo: { isTestnet },
      } as unknown as ICoreApiSignBasePayload;

      await expect(core.getViewingKeyPair(payload)).resolves.toBe(
        `${'11'.repeat(32)}:${'22'.repeat(32)}`,
      );
      expect(derive).toHaveBeenLastCalledWith({
        network: isTestnet ? 'testnet' : 'mainnet',
        bip32PrivateKeyHex: 'synthetic-key',
      });
    },
  );

  it('rejects a key derived for a different account before returning viewing material', async () => {
    jest.mocked(deriveXmrAccount).mockResolvedValue({
      primaryAddress: 'another-primary',
      spendPublicKeyHex: '11'.repeat(32),
      viewPrivateKeyHex: '22'.repeat(32),
    });
    const core = Object.assign(
      Object.create(CoreChainSoftware.prototype) as CoreChainSoftware,
      {
        baseGetSingleSigner: async () => ({
          getPrvkeyHex: async () => 'synthetic-key',
        }),
      },
    );

    await expect(
      core.getViewingKeyPair({
        account: { address: 'synthetic-primary', path: "m/44'/128'/0'" },
        networkInfo: { isTestnet: false },
      } as unknown as ICoreApiSignBasePayload),
    ).rejects.toThrow('does not match this account');
  });
});
