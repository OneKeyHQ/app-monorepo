import { IMPL_ZCASH } from '@onekeyhq/shared/src/engine/engineConsts';

import coreTestsUtils from '../../../@tests/coreTestsUtils';
import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';
import { getCoreChainApiScopeByImpl } from '../../instance/coreChainApi';

import CoreChainHd from './CoreChainHd';

// Expected values were derived independently (standard BIP39/BIP32 +
// Zcash t1 base58check) from the shared test mnemonic, so these tests validate
// the whole HD -> xpub -> t-address pipeline, not just the address codec.
const { hdCredential, networkInfo, hdAccountTemplate, hdAccounts } =
  coreTestsFixtures.prepareCoreChainTestsFixtures({
    networkInfo: {
      networkChainCode: 'zec',
      chainId: '0',
      networkId: 'zec--0',
      networkImpl: 'zec',
      isTestnet: false,
    },
    hdAccountTemplate: "m/44'/133'/$$INDEX$$'/0/0",
    hdAccounts: [
      {
        address: 't1MZCJGByCheP3hZjEDrVTkMRwiaxTFuzJA',
        addresses: { '0/0': 't1MZCJGByCheP3hZjEDrVTkMRwiaxTFuzJA' },
        path: "m/44'/133'/0'",
        relPaths: ['0/0'],
        xpub: 'xpub6CTtvTVbDbZu89GVR6dCs7ezFPNTUXH4UmHYc75hWrmDq6npasnzm7qDiRebwHEmxAQxTX1HZvTZEmSiiNHDwbUu5thgjXWZcCRcQB3ovgP',
        xpvtRaw:
          '0488ade4036e8bea46800000008441ce52adda7546d6071935b845fd922f5775865d7458f6b6ef23d774c5e89300e5cba5d8c7d4b22e86b918348bc6f86f36bd56c6c9316a43b6e102eac9159f4f',
        publicKey:
          '02373e7545c54e59414e2259067ced9fb3a5f285dce814c32567234c276748a55f',
        privateKeyRaw:
          '17e443e9a323283f7c88141f92e7207737d511bd86f802e268275fa4d20341c1',
      },
    ],
    txSamples: [],
    msgSamples: [],
  });

// yarn jest packages/core/src/chains/zcash/CoreChainSoftware.test.ts
describe('ZCASH Core tests', () => {
  it('registers the Core API under the network implementation', () => {
    expect(getCoreChainApiScopeByImpl({ impl: IMPL_ZCASH }).impl).toBe('zec');
  });

  it('mnemonic verify', async () => {
    await coreTestsUtils.expectMnemonicValid({ hdCredential });
  });
  it('getAddressFromPublic', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPublicOk({
      coreApi,
      networkInfo,
      hdAccounts,
    });
  });
  it('getAddressFromPrivate', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPrivateOk({
      coreApi,
      networkInfo,
      hdAccounts,
    });
  });
  it('getAddressesFromHd', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromHdOk({
      coreApi,
      networkInfo,
      hdAccounts,
      hdAccountTemplate,
      hdCredential,
    });
  });
  it('getPrivateKeys hd', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetPrivateKeysHdOk({
      coreApi,
      networkInfo,
      hdAccounts,
      hdCredential,
    });
  });

  it('signTransaction is not the BTC path (handled by PCZT signer)', async () => {
    const coreApi = new CoreChainHd();
    await expect(coreApi.signTransaction({} as any)).rejects.toThrow(/PCZT/);
  });
});
