import { PendleRouterContract } from '@onekeyhq/shared/src/consts/addresses';
import { EStakeProtocolGroupEnum } from '@onekeyhq/shared/types/staking';
import type {
  IEarnManagePageResponse,
  IStakeProtocolListItem,
} from '@onekeyhq/shared/types/staking';

import { vaultFactory } from '../vaults/factory';

import ServiceStaking from './ServiceStaking';

import type { AxiosInstance } from 'axios';

const vault = '0xe9e8573bb351da16c6ee7ddac0cbc70b7f9784ae';
const token = '0x55d398326f99059ff775485246999027b3197955';
const receipt = '0x3333333333333333333333333333333333333333';
const attacker = '0x000000000000000000000000000000000000dead';
const account = '0x1111111111111111111111111111111111111111';
const query = {
  networkId: 'evm--56',
  accountId: 'account-1',
  provider: 'Unitas',
  symbol: 'USDT',
  vault,
};
const approval = {
  ...query,
  action: 'stake' as const,
  tokenAddress: token,
  spenderAddress: vault,
};

function harness(provider = 'Unitas', target = vault) {
  const page = {
    approve: { approveType: 'legacy', approveTarget: target },
    deposit: { data: { token: { info: { address: token } } } },
    withdrawApprove: { approveTarget: target, tokenAddress: receipt },
  } as IEarnManagePageResponse;
  const service = new ServiceStaking({
    backgroundApi: {
      serviceAccount: {
        getAccountAddressForApi: jest.fn().mockResolvedValue(account),
      },
      serviceAccountProfile: {
        _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
      },
    },
  });
  const protocol = {
    network: { networkId: 'evm--56' },
    provider: {
      name: provider,
      vault,
      group: EStakeProtocolGroupEnum.WithdrawOnly,
    },
  } as IStakeProtocolListItem;
  const getProtocolList = jest
    .spyOn(service, 'getProtocolList')
    .mockResolvedValue([protocol]);
  const get = jest.fn().mockResolvedValue({ data: { data: page } });
  jest
    .spyOn(service, 'getClient')
    .mockResolvedValue({ get } as unknown as AxiosInstance);
  jest.spyOn(service, 'getEarnAccount').mockResolvedValue(null);
  return { service, get, getProtocolList, page, protocol };
}

describe('Earn approval boundary', () => {
  const previous = globalThis.$onekeyIsInBackground;
  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previous;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['getManagePage', 'getProtocolDetails'] as const)(
    'rejects an unknown route before %s even when the backend would return a valid form',
    async (method) => {
      const { service, get } = harness();
      await expect(
        service[method]({ ...query, vault: attacker, accountAddress: account }),
      ).rejects.toThrow('Earn protocol is unavailable');
      expect(get).not.toHaveBeenCalled();
    },
  );
  it('canonicalizes checksum vaults and includes withdraw-only positions', async () => {
    const { service, get, getProtocolList } = harness();
    await service.getManagePage({
      ...query,
      vault: vault.toUpperCase(),
      accountAddress: account,
    });
    expect(getProtocolList).toHaveBeenCalledWith(
      expect.objectContaining({ includeWithdrawOnly: true }),
    );
    expect(get).toHaveBeenCalledWith(
      '/earn/v1/manage-page',
      expect.objectContaining({ params: expect.objectContaining({ vault }) }),
    );
  });
  it('does not accept an ambiguous omitted vault or an unavailable catalog', async () => {
    const { service, getProtocolList, protocol } = harness();
    getProtocolList
      .mockResolvedValueOnce([
        protocol,
        { ...protocol, provider: { ...protocol.provider, vault: attacker } },
      ])
      .mockResolvedValueOnce([]);
    await expect(
      service.assertEarnApproval({ ...approval, vault: undefined }),
    ).rejects.toThrow();
    await expect(service.assertEarnApproval(approval)).rejects.toThrow();
  });
  it('accepts Unitas deposit and independently rejects a substituted spender or token', async () => {
    const { service } = harness();
    await expect(service.assertEarnApproval(approval)).resolves.toBeUndefined();
    await expect(
      service.assertEarnApproval({ ...approval, spenderAddress: attacker }),
    ).rejects.toThrow();
    await expect(
      service.assertEarnApproval({ ...approval, tokenAddress: attacker }),
    ).rejects.toThrow();
  });
  it('keeps XAUt/XGLD separate from the USDu vault', async () => {
    const booster = '0x0a4db0575ce1518ba1d008cf7cc08aeb05f57b0e';
    const xaut = '0x21caef8a43163eea865baee23b9c2e327696a3bf';
    const { service, getProtocolList, page, protocol } = harness(
      'Unitas',
      booster,
    );
    getProtocolList.mockResolvedValue([
      { ...protocol, provider: { ...protocol.provider, vault: booster } },
    ]);
    if (page.deposit?.data?.token) page.deposit.data.token.info.address = xaut;
    const request = {
      ...approval,
      symbol: 'XAUt',
      vault: booster,
      tokenAddress: xaut,
      spenderAddress: booster,
    };
    await expect(service.assertEarnApproval(request)).resolves.toBeUndefined();
    await expect(
      service.assertEarnApproval({ ...request, spenderAddress: vault }),
    ).rejects.toThrow();
    await expect(
      service.assertEarnApproval({ ...request, vault }),
    ).rejects.toThrow();
  });
  it('also rejects an unknown vault when building an already-approved deposit', async () => {
    const { service } = harness();
    jest.spyOn(vaultFactory, 'getVault').mockResolvedValue({
      getAccount: async () => ({ address: account }),
    } as unknown as Awaited<ReturnType<typeof vaultFactory.getVault>>);
    jest
      .spyOn(service, 'getStakingConfigs')
      .mockResolvedValue({ enabled: true } as Awaited<
        ReturnType<ServiceStaking['getStakingConfigs']>
      >);
    await expect(
      service.buildStakeTransaction({
        ...query,
        protocolVault: attacker,
        amount: '1',
      }),
    ).rejects.toThrow('Earn protocol is unavailable');
  });

  it('fails closed when Unitas approval metadata is missing', async () => {
    const { service, page } = harness();
    page.approve = undefined;
    await expect(service.assertEarnApproval(approval)).rejects.toThrow();
  });
  it('approves the XGLD receipt for withdrawal, not the underlying asset', async () => {
    const { service } = harness();
    await expect(
      service.assertEarnApproval({
        ...approval,
        action: 'unstake',
        tokenAddress: receipt,
      }),
    ).resolves.toBeUndefined();
    await expect(
      service.assertEarnApproval({ ...approval, action: 'unstake' }),
    ).rejects.toThrow();
  });
  it('uses USDu claim metadata without forwarding validation-only fields to the API', async () => {
    const { service, get } = harness();
    jest.spyOn(vaultFactory, 'getVault').mockResolvedValue({
      getAccount: async () => ({ address: account }),
    } as unknown as Awaited<ReturnType<typeof vaultFactory.getVault>>);
    get.mockResolvedValue({
      data: {
        data: {
          items: [],
          claimApprove: { approveTarget: vault, tokenAddress: receipt },
        },
      },
    });
    await expect(
      service.assertEarnApproval({
        ...approval,
        action: 'claim',
        tokenAddress: receipt,
      }),
    ).resolves.toBeUndefined();
    const params = get.mock.calls[0][1].params;
    expect(params).not.toHaveProperty('spenderAddress');
    expect(params).not.toHaveProperty('action');
    await expect(
      service.assertEarnApproval({ ...approval, action: 'claim' }),
    ).rejects.toThrow();
  });
  it.each(['Spark', 'Morpho', 'Bitway', 'Lista'])(
    'preserves %s legacy authorization',
    async (provider) => {
      const { service } = harness(
        provider,
        provider === 'Lista' ? token : vault,
      );
      await expect(
        service.assertEarnApproval({ ...approval, provider }),
      ).resolves.toBeUndefined();
    },
  );
  it('keeps Pendle router approval for a supported sell asset', async () => {
    const { service } = harness('Pendle');
    jest.spyOn(service, 'getEarnAssetsList').mockResolvedValue({
      assets: [{ info: { address: receipt } }],
    } as Awaited<ReturnType<ServiceStaking['getEarnAssetsList']>>);
    await expect(
      service.assertEarnApproval({
        ...approval,
        provider: 'Pendle',
        action: 'unstake',
        tokenAddress: receipt,
        spenderAddress: PendleRouterContract,
      }),
    ).resolves.toBeUndefined();
    await expect(
      service.assertEarnApproval({
        ...approval,
        provider: 'Pendle',
        action: 'unstake',
        spenderAddress: PendleRouterContract,
      }),
    ).rejects.toThrow();
  });
  it('retains the supported wrapped token for Native multi-asset deposits', async () => {
    const { service } = harness('Native');
    jest.spyOn(service, 'getEarnAssetsList').mockResolvedValue({
      assets: [{ info: { address: receipt } }],
    } as Awaited<ReturnType<ServiceStaking['getEarnAssetsList']>>);
    await expect(
      service.assertEarnApproval({
        ...approval,
        provider: 'Native',
        tokenAddress: receipt,
      }),
    ).resolves.toBeUndefined();
  });
});
