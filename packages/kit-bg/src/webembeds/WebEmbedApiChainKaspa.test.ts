import WebEmbedApiChainKaspa from './WebEmbedApiChainKaspa';

jest.mock('@onekeyhq/core/src/chains/kaspa/sdkKaspa/sdk/kaspaWebSdk', () => ({
  __esModule: true,
  default: {
    getKaspaApi: jest.fn(),
  },
}));

const mockGetKaspaApi = jest.requireMock(
  '@onekeyhq/core/src/chains/kaspa/sdkKaspa/sdk/kaspaWebSdk',
).default.getKaspaApi as jest.Mock;

describe('WebEmbedApiChainKaspa', () => {
  beforeEach(() => {
    mockGetKaspaApi.mockReset().mockResolvedValue({});
  });

  it('preloads the lazy Kaspa SDK before readiness is announced', async () => {
    const api = new WebEmbedApiChainKaspa();

    await expect(api.preload()).resolves.toBeUndefined();
    expect(mockGetKaspaApi).toHaveBeenCalledTimes(1);
  });
});
