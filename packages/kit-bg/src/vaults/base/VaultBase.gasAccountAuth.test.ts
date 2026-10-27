/*
yarn jest packages/kit-bg/src/vaults/base/VaultBase.gasAccountAuth.test.ts

OK-64746: the shared estimate-fee API call must send the Gas Account request
headers (wallet type + OneKey ID login token) so the Wallet BFF can mint the
member assertion for sponsorship eligibility.
*/
import type { IEstimateGasParams } from '@onekeyhq/shared/types/fee';

// Importing a vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('@onekeyhq/shared/src/logger/solanaTxDiagnostics', () => ({
  logSolanaTxDiagnostic: jest.fn(),
  createSolanaTxDiagnosticContext: jest.fn(),
}));

jest.mock('../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import SolVault from '../impls/sol/Vault';

const accountId = "hd-1--m/44'/501'/0'/0'";
const networkId = 'sol--101';
const gasAccountHeaders = {
  'X-OneKey-Wallet-Type': 'hd',
  'X-Onekey-Request-Token': 'token-a',
};

function buildVault() {
  const post = jest.fn(async () => ({ data: { data: { payer: 'user' } } }));
  const backgroundApi = {
    serviceGas: {
      getClient: jest.fn(async () => ({ post })),
      getGasAccountRequestHeaders: jest.fn(async () => gasAccountHeaders),
    },
    serviceAccountProfile: {
      _getWalletTypeHeader: jest.fn(async () => ({
        'X-OneKey-Wallet-Type': 'hd',
      })),
    },
  };
  const vault = Object.create(SolVault.prototype) as SolVault;
  vault.networkId = networkId;
  vault.accountId = accountId;
  vault.backgroundApi = backgroundApi as unknown as SolVault['backgroundApi'];
  return { vault, post, backgroundApi };
}

describe('VaultBase estimateFeeByApi gas account auth', () => {
  it('sends the gas account request headers with estimate-fee', async () => {
    const { vault, post, backgroundApi } = buildVault();
    const params: IEstimateGasParams = {
      accountId,
      networkId,
      accountAddress: 'sol-address',
      encodedTx: 'encoded',
      gasAccountEnabled: true,
    };

    await vault.estimateFeeByApi(params);

    expect(
      backgroundApi.serviceGas.getGasAccountRequestHeaders,
    ).toHaveBeenCalledWith({ accountId });
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('/wallet/v1/account/estimate-fee');
    expect(body).not.toHaveProperty('accountId');
    expect(config.headers).toEqual(gasAccountHeaders);
  });
});
