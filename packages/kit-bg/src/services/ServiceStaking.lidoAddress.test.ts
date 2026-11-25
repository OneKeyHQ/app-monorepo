import axios from 'axios';

import ServiceStaking from './ServiceStaking';

const mockResolveVaultAccount = jest.fn<
  Promise<{ address: string; pub?: string }>,
  []
>();
jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: jest.fn(async () => ({
      getAccount: () => mockResolveVaultAccount(),
    })),
  },
}));

const owner = '0xAbCd';
const accountId = 'account';
const networkId = 'evm--1';

describe('Lido permit address binding', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  const resolveAddress = jest.fn<Promise<string>, [unknown]>();
  const post = jest.fn<
    Promise<{ data: { data: { message: string; deadline: number } } }>,
    [string, Record<string, unknown>]
  >(async () => ({ data: { data: { message: 'message', deadline: 1 } } }));
  let service: ServiceStaking;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });
  beforeEach(() => {
    resolveAddress.mockReset().mockResolvedValue(owner);
    mockResolveVaultAccount.mockReset().mockResolvedValue({ address: owner });
    post.mockClear();
    service = new ServiceStaking({
      backgroundApi: {
        serviceAccount: { getAccountAddressForApi: resolveAddress },
      },
    });
    jest
      .spyOn(service, 'getClient')
      .mockResolvedValue(Object.assign(axios.create(), { post }));
    jest.spyOn(service, 'getStakingConfigs').mockResolvedValue({
      enabled: true,
      usePublicKey: false,
    } as Awaited<ReturnType<ServiceStaking['getStakingConfigs']>>);
  });
  afterEach(() => jest.restoreAllMocks());

  it('rejects A to B to A during the background address resolution without requesting a permit', async () => {
    resolveAddress
      .mockResolvedValueOnce(owner)
      .mockResolvedValueOnce('0xOther')
      .mockResolvedValueOnce(owner);
    expect(await resolveAddress({})).toBe(owner);
    await expect(
      service.buildLidoEthPermitMessageData({
        accountId,
        networkId,
        amount: '1',
        expectedAccountAddress: owner,
      }),
    ).rejects.toThrow('Task account address changed');
    expect(await resolveAddress({})).toBe(owner);
    expect(post).not.toHaveBeenCalled();
  });

  it('accepts case differences for the same EVM address without sending the local expectation', async () => {
    await service.buildLidoEthPermitMessageData({
      accountId,
      networkId,
      amount: '1',
      expectedAccountAddress: owner.toLowerCase(),
    });
    expect(post).toHaveBeenCalledWith('/earn/v1/lido-eth/tx/permit_message', {
      accountAddress: owner,
      networkId,
      amount: '1',
    });
  });

  it('preserves legacy calls without an expected address', async () => {
    await service.buildLidoEthPermitMessageData({
      accountId,
      networkId,
      amount: '1',
    });
    expect(post).toHaveBeenCalledWith('/earn/v1/lido-eth/tx/permit_message', {
      accountAddress: owner,
      networkId,
      amount: '1',
    });
  });

  it('rejects a claim when the resolved account differs from its owner', async () => {
    mockResolveVaultAccount.mockResolvedValueOnce({ address: '0xOther' });
    await expect(
      service.buildClaimTransaction({
        accountId,
        networkId,
        amount: '0',
        symbol: 'ETH',
        provider: 'lido',
        vault: '',
        expectedAccountAddress: owner,
      }),
    ).rejects.toThrow('Claim account changed');
    expect(post).not.toHaveBeenCalled();
  });

  it('accepts the same EVM claim owner and never sends the local expectation', async () => {
    await service.buildClaimTransaction({
      accountId,
      networkId,
      amount: '0',
      symbol: 'ETH',
      provider: 'lido',
      vault: '',
      expectedAccountAddress: owner.toLowerCase(),
    });
    expect(post).toHaveBeenCalledWith(
      '/earn/v2/claim',
      expect.objectContaining({ accountAddress: owner }),
    );
    expect(post.mock.calls[0][1]).not.toHaveProperty('expectedAccountAddress');
  });

  it('does not record a Babylon claim using a different current account', async () => {
    mockResolveVaultAccount.mockResolvedValueOnce({ address: '0xOther' });
    await expect(
      service.babylonClaimRecord({
        accountId,
        networkId,
        provider: 'babylon',
        symbol: 'BTC',
        identity: 'claim',
        expectedAccountAddress: owner,
      }),
    ).rejects.toThrow('Claim account changed');
    expect(post).not.toHaveBeenCalled();
  });

  it('does not forward the local account guard in a Babylon claim record', async () => {
    await service.babylonClaimRecord({
      accountId,
      networkId,
      provider: 'babylon',
      symbol: 'BTC',
      identity: 'claim',
      expectedAccountAddress: owner,
    });
    expect(post).toHaveBeenCalledWith(
      '/earn/v1/claim/record',
      expect.objectContaining({ accountAddress: owner }),
    );
    expect(post.mock.calls[0][1]).not.toHaveProperty('expectedAccountAddress');
  });

  it('records a Babylon claim with the original owner when only its receive address rotates', async () => {
    mockResolveVaultAccount.mockResolvedValueOnce({
      address: 'bc1-new',
      pub: '02abcd',
    });
    await service.babylonClaimRecord({
      accountId,
      networkId: 'btc--0',
      provider: 'babylon',
      symbol: 'BTC',
      identity: 'claim',
      expectedAccountAddress: 'bc1-original',
      expectedAccountPublicKey: '02abcd',
    });
    expect(post).toHaveBeenCalledWith(
      '/earn/v1/claim/record',
      expect.objectContaining({
        accountAddress: 'bc1-original',
        publicKey: '02abcd',
        identity: 'claim',
      }),
    );
    expect(post.mock.calls[0][1]).not.toHaveProperty(
      'expectedAccountPublicKey',
    );
  });

  it.each([undefined, '03different'])(
    'rejects Babylon claim record when frozen public key no longer matches: %s',
    async (pub) => {
      mockResolveVaultAccount.mockResolvedValueOnce({
        address: 'bc1-new',
        pub,
      });
      await expect(
        service.babylonClaimRecord({
          accountId,
          networkId: 'btc--0',
          provider: 'babylon',
          symbol: 'BTC',
          identity: 'claim',
          expectedAccountAddress: 'bc1-original',
          expectedAccountPublicKey: '02abcd',
        }),
      ).rejects.toThrow('Claim account changed');
      expect(post).not.toHaveBeenCalled();
    },
  );

  it('exposes the resolved Babylon public key from the same account used to build the claim', async () => {
    mockResolveVaultAccount.mockResolvedValueOnce({
      address: 'bc1-original',
      pub: '02abcd',
    });
    const result = await service.buildClaimTransaction({
      accountId,
      networkId: 'btc--0',
      amount: '1',
      symbol: 'BTC',
      provider: 'babylon',
      vault: '',
      expectedAccountAddress: 'bc1-original',
    });
    expect(result.claimOwnerPublicKey).toBe('02abcd');
    expect(post).toHaveBeenCalledWith(
      '/earn/v2/claim',
      expect.objectContaining({ accountAddress: 'bc1-original' }),
    );
  });

  it('retains the existing claim build when the account public key is absent', async () => {
    mockResolveVaultAccount.mockResolvedValueOnce({ address: 'bc1-original' });
    const result = await service.buildClaimTransaction({
      accountId,
      networkId: 'btc--0',
      amount: '1',
      symbol: 'BTC',
      provider: 'babylon',
      vault: '',
      expectedAccountAddress: 'bc1-original',
    });
    expect(result.claimOwnerPublicKey).toBeUndefined();
    expect(post).toHaveBeenCalledWith(
      '/earn/v2/claim',
      expect.objectContaining({ accountAddress: 'bc1-original' }),
    );
  });

  it('preserves Babylon claim recording for callers without an account guard', async () => {
    await service.babylonClaimRecord({
      accountId,
      networkId,
      provider: 'babylon',
      symbol: 'BTC',
      identity: 'claim',
    });
    expect(post).toHaveBeenCalledWith(
      '/earn/v1/claim/record',
      expect.objectContaining({ accountAddress: owner }),
    );
  });

  it('rejects a transient different vault address before building the unstake', async () => {
    mockResolveVaultAccount
      .mockResolvedValueOnce({ address: owner })
      .mockResolvedValueOnce({ address: '0xOther' })
      .mockResolvedValueOnce({ address: owner });
    expect((await mockResolveVaultAccount()).address).toBe(owner);
    await expect(
      service.buildUnstakeTransaction({
        accountId,
        networkId,
        amount: '1',
        symbol: 'ETH',
        provider: 'lido',
        expectedAccountAddress: owner,
      }),
    ).rejects.toThrow('Task account address changed');
    expect((await mockResolveVaultAccount()).address).toBe(owner);
    expect(post).not.toHaveBeenCalled();
  });

  it('accepts case differences for the same EVM unstake owner without forwarding the guard', async () => {
    await service.buildUnstakeTransaction({
      accountId,
      networkId,
      amount: '1',
      symbol: 'ETH',
      provider: 'lido',
      expectedAccountAddress: owner.toLowerCase(),
    });
    expect(post).toHaveBeenCalledWith(
      '/earn/v2/unstake',
      expect.objectContaining({ accountAddress: owner }),
    );
    expect(post.mock.calls[0][1]).not.toHaveProperty('expectedAccountAddress');
  });
});
