import { encryptRevealableSeed, mnemonicToRevealableSeed } from '../../secret';

import CoreChainHd from './CoreChainHd';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'a-test-password';
const SPEC_CONNECTED_PUBKEY =
  '03aaeb52dd7494c361049de67cc680e83ebcbbbdbeb13637d92cd845f70308af5e';
// Pinned vector — must match the wallet-integration spec and the UniSat ship.
const PINNED =
  'f82ced3be0e29591a7863ece03d65f79fb494fe0de7203549855f462455df008';

describe('CoreChainSoftwareBtc.deriveContextHashBtc', () => {
  it('reproduces the pinned conformance vector via the core API', async () => {
    const rs = mnemonicToRevealableSeed(MNEMONIC);
    const hd = await encryptRevealableSeed({ rs, password: PASSWORD });

    const core = new CoreChainHd();
    const out = await core.deriveContextHashBtc({
      credentials: { hd },
      password: PASSWORD,
      appName: 'test-app',
      canonicalNetworkName: 'bitcoin-mainnet',
      connectedPubkey: SPEC_CONNECTED_PUBKEY,
      context: 'deadbeef',
    });
    expect(out).toBe(PINNED);
  });

  it('rejects credentials without an HD seed', async () => {
    const core = new CoreChainHd();
    await expect(
      core.deriveContextHashBtc({
        credentials: {},
        password: PASSWORD,
        appName: 'test-app',
        canonicalNetworkName: 'bitcoin-mainnet',
        connectedPubkey: SPEC_CONNECTED_PUBKEY,
        context: 'deadbeef',
      }),
    ).rejects.toThrow(/HD credential/i);
  });

  it('rejects a malformed connectedPubkey', async () => {
    const rs = mnemonicToRevealableSeed(MNEMONIC);
    const hd = await encryptRevealableSeed({ rs, password: PASSWORD });
    const core = new CoreChainHd();
    await expect(
      core.deriveContextHashBtc({
        credentials: { hd },
        password: PASSWORD,
        appName: 'test-app',
        canonicalNetworkName: 'bitcoin-mainnet',
        connectedPubkey: 'NOT-HEX',
        context: 'deadbeef',
      }),
    ).rejects.toThrow(/compressed SEC1/i);
  });
});
