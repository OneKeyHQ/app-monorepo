/*
yarn jest packages/kit-bg/src/services/ServiceGas.gasAccountAuth.test.ts

OK-64746: Gas Account requests must carry the OneKey ID login token so the
Wallet BFF can resolve the member identity. The token is read per request from
the current session (empty when logged out) and merged with the wallet-type
header every GA endpoint already sends.
*/
const mockGetClient: jest.Mock<Promise<unknown>, unknown[]> = jest.fn();
const mockGetOneKeyIdAuthHeaders: jest.Mock<
  Promise<Record<string, string>>,
  []
> = jest.fn();

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }

    getClient = (...args: unknown[]): Promise<unknown> =>
      mockGetClient(...args);

    getOneKeyIdAuthHeaders = (): Promise<Record<string, string>> =>
      mockGetOneKeyIdAuthHeaders();
  },
}));

jest.mock('../states/jotai/atoms/settings', () => ({
  settingsPersistAtom: { get: jest.fn() },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));

jest.mock('../vaults/impls/fil/utils', () => ({
  FIL_MIN_BASE_FEE: '100',
}));

// eslint-disable-next-line import/first
import { settingsPersistAtom } from '../states/jotai/atoms/settings';
// eslint-disable-next-line import/first
import { vaultFactory } from '../vaults/factory';

// eslint-disable-next-line import/first
import ServiceGas from './ServiceGas';

const accountId = "hd-1--m/44'/60'/0'/0/0";
const networkId = 'evm--42161';
const walletTypeHeader = { 'X-OneKey-Wallet-Type': 'hd' };

function createService({ authToken }: { authToken?: string }) {
  const post = jest.fn(async () => ({
    data: {
      data: {
        isEIP1559: true,
        feeDecimals: 9,
        feeSymbol: 'Gwei',
        nativeDecimals: 18,
        nativeSymbol: 'ETH',
        result: [],
      },
    },
  }));
  mockGetClient.mockResolvedValue({ post });
  mockGetOneKeyIdAuthHeaders.mockResolvedValue(
    authToken ? { 'X-Onekey-Request-Token': authToken } : {},
  );
  const backgroundApi = {
    serviceAccountProfile: {
      _getWalletTypeHeader: jest.fn(async () => walletTypeHeader),
    },
  };
  const service = new ServiceGas({ backgroundApi });
  return { service, post, backgroundApi };
}

describe('ServiceGas gas account request auth headers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges the wallet-type header with the current OneKey ID token', async () => {
    const { service, backgroundApi } = createService({ authToken: 'token-a' });

    const headers = await service.getGasAccountRequestHeaders({ accountId });

    expect(headers).toEqual({
      'X-OneKey-Wallet-Type': 'hd',
      'X-Onekey-Request-Token': 'token-a',
    });
    expect(
      backgroundApi.serviceAccountProfile._getWalletTypeHeader,
    ).toHaveBeenCalledWith({ accountId });
  });

  it('sends only the wallet-type header when no OneKey ID session exists', async () => {
    const { service } = createService({});

    const headers = await service.getGasAccountRequestHeaders({ accountId });

    expect(headers).toEqual({ 'X-OneKey-Wallet-Type': 'hd' });
  });

  it('attaches the OneKey ID token to estimate-fee-batch', async () => {
    const { service, post } = createService({ authToken: 'token-a' });

    await service.batchEstimateFee({ accountId, networkId, encodedTxs: [] });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, , config] = post.mock.calls[0] as unknown as [
      string,
      unknown,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('/wallet/v1/account/estimate-fee-batch');
    expect(config.headers).toEqual({
      'X-OneKey-Wallet-Type': 'hd',
      'X-Onekey-Request-Token': 'token-a',
    });
  });
});

describe('ServiceGas estimateFee member-dimension passthrough', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps gasAccountSkipReason and the quote identity from the response', async () => {
    const { service } = createService({ authToken: 'token-a' });
    (settingsPersistAtom.get as unknown as jest.Mock).mockResolvedValue({});
    (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue({
      estimateFee: jest.fn(async () => ({
        data: {
          data: {
            isEIP1559: true,
            feeDecimals: 9,
            feeSymbol: 'Gwei',
            nativeDecimals: 18,
            nativeSymbol: 'ETH',
            payer: 'user',
            gasAccountEligible: false,
            gasAccountSkipReason: 'member_required',
            gasAccountQuote: {
              quoteId: 'quote-1',
              maxFee: '1',
              expiresAt: '2026-10-20T00:00:00Z',
              identity: { ownerType: 'member' },
            },
          },
        },
      })),
    });

    const result = await service.estimateFee({
      accountId,
      networkId,
      accountAddress: '0xaccount',
      encodedTx: {},
    });

    expect(result.gasAccountSkipReason).toBe('member_required');
    expect(result.gasAccountQuote?.identity?.ownerType).toBe('member');
  });
});
