import ServiceSwap from './ServiceSwap';

describe('ServiceSwap private send check', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('never sends a withholding chain address to the token detail endpoint', async () => {
    const service = new ServiceSwap({ backgroundApi: {} });
    const fetchDetails = jest
      .spyOn(service, 'fetchSwapTokenDetails')
      .mockResolvedValue([]);

    await expect(
      service.checkTokenPrivateSendSupported({
        networkId: 'xmr--0',
        contractAddress: '',
        accountAddress: '4own',
        accountId: 'hd-1--0',
      }),
    ).resolves.toBe(false);
    expect(fetchDetails).not.toHaveBeenCalled();
  });
});
