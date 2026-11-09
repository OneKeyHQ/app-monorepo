/*
yarn jest packages/kit-bg/src/services/ServiceSend.gasAccountAuth.test.ts

OK-64746: send-transaction (Gas Account execute) and pre-send-transaction must
carry the OneKey ID login token of the current session so Prime can bind the
member identity of the quote to the broadcast.
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
  backgroundMethodForDev:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  function createLoggerProxy(): unknown {
    return new Proxy(jest.fn(), {
      get: () => createLoggerProxy(),
    });
  }
  return { defaultLogger: createLoggerProxy() };
});

jest.mock('@onekeyhq/shared/src/logger/solanaTxDiagnostics', () => ({
  logSolanaTxDiagnostic: jest.fn(),
  createSolanaTxDiagnosticContext: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => undefined,
  },
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

jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));

jest.mock('../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import ServiceSend from './ServiceSend';

const accountId = "hd-1--m/44'/60'/0'/0/0";
const networkId = 'evm--42161';
const accountAddress = '0xaccount';
const gasAccountHeaders = {
  'X-OneKey-Wallet-Type': 'hd',
  'X-Onekey-Request-Token': 'token-a',
};

function createService() {
  const post = jest.fn(async () => ({
    data: { data: { result: 'txid-1', success: true } },
    status: 200,
  }));
  mockGetClient.mockResolvedValue({ post });
  mockGetOneKeyIdAuthHeaders.mockResolvedValue({
    'X-Onekey-Request-Token': 'token-a',
  });
  const backgroundApi = {
    serviceCustomRpc: {
      getCustomRpcForNetwork: jest.fn(async () => undefined),
    },
    serviceGas: {
      getGasAccountRequestHeaders: jest.fn(async () => gasAccountHeaders),
    },
    serviceAccountProfile: {
      _getWalletTypeHeader: jest.fn(async () => ({
        'X-OneKey-Wallet-Type': 'hd',
      })),
    },
    serviceDevSetting: {
      getDevSetting: jest.fn(async () => ({ enabled: false })),
    },
    serviceNetwork: {
      isCustomNetwork: jest.fn(async () => false),
    },
  };
  const service = new ServiceSend({ backgroundApi });
  return { service, post, backgroundApi };
}

function postConfigOf(post: jest.Mock) {
  const [url, body, config] = post.mock.calls[0] as unknown as [
    string,
    Record<string, unknown>,
    { headers?: Record<string, string> },
  ];
  return { url, body, config };
}

describe('ServiceSend gas account request auth headers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends the current session token with send-transaction', async () => {
    const { service, post, backgroundApi } = createService();

    const txid = await service.broadcastTransaction({
      accountId,
      networkId,
      accountAddress,
      signedTx: { rawTx: '0xraw', txid: '', encodedTx: {} },
      gasAccountUiState: {
        selectedPayer: 'gasAccount',
        gasAccountQuote: {
          quoteId: 'quote-1',
          maxFee: '1',
          expiresAt: '2026-10-20T00:00:00Z',
        },
        idempotencyKey: 'idem-1',
      },
    });

    expect(txid).toBe('txid-1');
    const { url, body, config } = postConfigOf(post);
    expect(url).toBe('/wallet/v1/account/send-transaction');
    expect(body).toMatchObject({
      quoteId: 'quote-1',
      idempotencyKey: 'idem-1',
    });
    expect(config.headers).toEqual(gasAccountHeaders);
    expect(
      backgroundApi.serviceGas.getGasAccountRequestHeaders,
    ).toHaveBeenCalledWith({ accountId });
  });

  it('sends the current session token with pre-send-transaction', async () => {
    const { service, post } = createService();

    await service.preCheckIsFeeInfoOverflow({
      encodedTx: {},
      feeAmount: '0.001',
      feeTokenSymbol: 'ETH',
      networkId,
      accountAddress,
    });

    const { url, config } = postConfigOf(post);
    expect(url).toBe('/wallet/v1/account/pre-send-transaction');
    expect(config.headers).toEqual({ 'X-Onekey-Request-Token': 'token-a' });
  });
});
