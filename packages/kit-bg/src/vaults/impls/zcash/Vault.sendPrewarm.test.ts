/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock(
  '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect',
  () => ({
    fetchZcashChainTipDirect: jest.fn(),
  }),
);

import { fetchZcashChainTipDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import type { IZcashSdkApi } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

import Vault from './Vault';

describe('Zcash send public-parameter warm-up', () => {
  const accountId = "hd-1--m/44'/133'/0'";

  function createVault(
    privacyEnabled: boolean,
    chainTip: number | null = 3_500_000,
  ) {
    const getPrivacyModeState = jest.fn(async () => ({
      intent: privacyEnabled ? 'on' : 'off',
    }));
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      backgroundApi: {
        simpleDb: {
          privacyChainState: { getZcashPrivacyModeState: getPrivacyModeState },
        },
      },
    });
    const prewarmPczt = jest.fn(async () => undefined);
    const api = jest.spyOn(vault, 'zcashGetApi').mockResolvedValue({
      prewarmPczt,
    } as unknown as IZcashSdkApi);
    const tip = jest
      .mocked(fetchZcashChainTipDirect)
      .mockResolvedValue(chainTip);
    jest
      .spyOn(vault, 'zcashResolveLightwalletdUrl')
      .mockResolvedValue('https://example.invalid');
    return { vault, prewarmPczt, api, tip, getPrivacyModeState };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it.each(['orchard', 'ironwood'])(
    'warms an active %s source before signing',
    async (sourcePool) => {
      const { vault, prewarmPczt } = createVault(true);
      await vault.getLocalWalletCapability().prewarmSend?.({
        accountId,
        sourcePool,
        toAddress: 't1-recipient',
      });
      expect(prewarmPczt).toHaveBeenCalledWith({
        network: 'main',
        targetHeight: 3_500_000,
      });
    },
  );

  it('does not initialize the carrier for ordinary transparent sends', async () => {
    const { vault, api, tip } = createVault(false);
    await vault.prewarmLocalWalletSend({
      accountId,
      sourcePool: 'transparent',
      toAddress: 't1-recipient',
    });
    expect(tip).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it('warms stateless shielding without enabling private wallet storage', async () => {
    const { vault, prewarmPczt, getPrivacyModeState } = createVault(false);
    await vault.prewarmLocalWalletSend({
      accountId,
      sourcePool: 'transparent',
      toAddress: 'u1-recipient',
    });
    expect(getPrivacyModeState).not.toHaveBeenCalled();
    expect(prewarmPczt).toHaveBeenCalledTimes(1);
  });

  it('does not warm a paused private source', async () => {
    const { vault, api, tip } = createVault(false);
    await vault.prewarmLocalWalletSend({
      accountId,
      sourcePool: 'ironwood',
      toAddress: 'u1-recipient',
    });
    expect(tip).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it('leaves normal sending to build its parameters when offline', async () => {
    const { vault, prewarmPczt } = createVault(true, null);
    await vault.prewarmLocalWalletSend({
      accountId,
      sourcePool: 'ironwood',
      toAddress: 't1-recipient',
    });
    expect(prewarmPczt).not.toHaveBeenCalled();
  });
});
