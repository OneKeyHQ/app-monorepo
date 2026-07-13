import ServiceApproval from './ServiceApproval';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

describe('ServiceApproval', () => {
  it('enables Permit2 on each approval query', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        data: {
          contractApprovals: [],
          tokenMap: {},
          contractMap: {},
        },
      },
    });
    const getWalletTypeHeader = jest
      .fn()
      .mockResolvedValue({ 'X-OneKey-Wallet-Type': 'watched-only' });
    const service = new ServiceApproval({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: getWalletTypeHeader,
        },
      },
    });
    const client = {
      post,
    } as unknown as Awaited<ReturnType<typeof service.getClient>>;
    jest.spyOn(service, 'getClient').mockResolvedValue(client);

    await service.fetchAccountApprovals({
      accountId: 'watch--evm',
      networkId: 'evm--1',
      indexedAccountId: undefined,
      accountAddress: '0x96d39d6d3edce4687943c8b09179e2eb3a73e0c8',
    });

    expect(post).toHaveBeenCalledWith(
      '/wallet/v1/account/token-approval/list',
      {
        queries: [
          {
            accountId: 'watch--evm',
            networkId: 'evm--1',
            accountAddress: '0x96d39d6d3edce4687943c8b09179e2eb3a73e0c8',
            withPermit2: true,
          },
        ],
      },
      expect.objectContaining({
        headers: { 'X-OneKey-Wallet-Type': 'watched-only' },
      }),
    );
  });
});
