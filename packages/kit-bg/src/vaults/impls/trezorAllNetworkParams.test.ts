import { KeyringHardwareTrezor as BtcTrezorKeyring } from './btc/KeyringHardwareTrezor';
import { KeyringHardwareTrezor as EvmTrezorKeyring } from './evm/KeyringHardwareTrezor';
import { KeyringHardwareTrezor as SolTrezorKeyring } from './sol/KeyringHardwareTrezor';
import { KeyringHardwareTrezor as TronTrezorKeyring } from './tron/KeyringHardwareTrezor';

import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
} from '../types';

function createKeyring<T extends { hwSdkNetwork: IHwSdkNetwork | undefined }>(
  Keyring: { prototype: T },
  hwSdkNetwork: IHwSdkNetwork,
): T {
  return Object.assign(Object.create(Keyring.prototype) as T, {
    hwSdkNetwork,
  });
}

const baseParams = {
  path: "m/44'/60'/0'/0/0",
  template: "m/44'/60'/0'/0/{index}",
  index: 0,
} satisfies IBuildHwAllNetworkPrepareAccountsParams;

describe('Trezor all-network account params', () => {
  it('builds EVM all-network params with the numeric chain id', async () => {
    const keyring = Object.assign(createKeyring(EvmTrezorKeyring, 'evm'), {
      getNetworkChainId: jest.fn().mockResolvedValue('1'),
    });

    await expect(
      keyring.buildHwAllNetworkPrepareAccountsParams(baseParams),
    ).resolves.toEqual({
      network: 'evm',
      path: baseParams.path,
      showOnOneKey: false,
      chainName: '1',
    });
  });

  it('builds SOL and TRON all-network params', async () => {
    const solKeyring = createKeyring(SolTrezorKeyring, 'sol');
    const tronKeyring = createKeyring(TronTrezorKeyring, 'tron');

    await expect(
      solKeyring.buildHwAllNetworkPrepareAccountsParams({
        ...baseParams,
        path: "m/44'/501'/0'/0'",
        template: "m/44'/501'/{index}'/0'",
      }),
    ).resolves.toEqual({
      network: 'sol',
      path: "m/44'/501'/0'/0'",
      showOnOneKey: false,
    });

    await expect(
      tronKeyring.buildHwAllNetworkPrepareAccountsParams({
        ...baseParams,
        path: "m/44'/195'/0'/0/0",
        template: "m/44'/195'/0'/0/{index}",
      }),
    ).resolves.toEqual({
      network: 'tron',
      path: "m/44'/195'/0'/0/0",
      showOnOneKey: false,
    });
  });

  it('builds BTC all-network params at account-xpub path level', async () => {
    const keyring = createKeyring(BtcTrezorKeyring, 'btc');

    await expect(
      keyring.buildHwAllNetworkPrepareAccountsParams({
        ...baseParams,
        path: "m/84'/0'/0'/0/0",
        template: "m/84'/0'/{index}'/0/0",
      }),
    ).resolves.toEqual({
      network: 'btc',
      path: "m/84'/0'/0'",
      showOnOneKey: false,
    });
  });
});
