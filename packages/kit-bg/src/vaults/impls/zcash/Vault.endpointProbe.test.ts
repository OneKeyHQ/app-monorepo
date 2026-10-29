// cspell:ignore lightd
/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');
jest.mock(
  '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect',
  () => ({
    ...jest.requireActual<
      typeof import('@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect')
    >('@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect'),
    fetchZcashLightdInfoDirect: jest.fn(),
  }),
);

import { fetchZcashLightdInfoDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import { ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET } from '@onekeyhq/shared/src/config/zcash';

import Vault from './Vault';

const NODE = 'https://lightwalletd.example';
const TIP = ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET + 1_000_000;

function createVault() {
  return Object.assign(Object.create(Vault.prototype) as Vault, {
    networkId: 'zec--0',
    zcashGetApi: async () => ({ getChainTip: async () => TIP }),
  });
}

describe('zcash node probe chain check', () => {
  afterEach(() => {
    jest.mocked(fetchZcashLightdInfoDirect).mockReset();
  });

  it('accepts a node that confirms mainnet', async () => {
    jest
      .mocked(fetchZcashLightdInfoDirect)
      .mockResolvedValue({ chainName: 'main' });

    await expect(
      createVault().zcashTestLightwalletdUrl(NODE, { validateChain: true }),
    ).resolves.toEqual({ ok: true, chainTip: TIP });
  });

  it.each([
    ['another chain', { chainName: 'test' }, 'wrong-chain'],
    ['an unknown chain name', { chainName: 'mainnet' }, 'wrong-chain'],
    ['no chain name', null, 'unconfirmed-chain'],
  ])('refuses a node that reports %s', async (_label, info, reason) => {
    jest.mocked(fetchZcashLightdInfoDirect).mockResolvedValue(info);

    await expect(
      createVault().zcashTestLightwalletdUrl(NODE, { validateChain: true }),
    ).resolves.toEqual({ ok: false, chainTip: TIP, reason });
  });

  it('does not ask for the chain when no check is requested', async () => {
    await expect(createVault().zcashTestLightwalletdUrl(NODE)).resolves.toEqual(
      { ok: true, chainTip: TIP },
    );
    expect(fetchZcashLightdInfoDirect).not.toHaveBeenCalled();
  });
});
