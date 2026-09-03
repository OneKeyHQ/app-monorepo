import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

import ServiceBulkSend from './ServiceBulkSend';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  checkDevOnlyPassword: jest.fn(),
}));

const ETH_ACCOUNT_ID = "hd-1--m/44'/60'/0'/0/0";
const ETH_ADDRESS = '0xe639600bAF0A229Da04A5D5024B521521689430A';

function createNativeToken(networkId: string, symbol: string): IToken {
  return {
    address: '',
    name: symbol,
    symbol,
    decimals: 18,
    isNative: true,
    logoURI: `https://img.test/${symbol}.png`,
    networkId,
  };
}

describe('ServiceBulkSend.getAddressesInputSeed', () => {
  const getNetworkAccountsInSameIndexedAccountId = jest.fn();
  const getAccountAddressInfoForApi = jest.fn();
  const getWalletSafe = jest.fn();
  const getNativeToken = jest.fn();
  const getNetworkSafe = jest.fn();

  function createService() {
    return new ServiceBulkSend({
      backgroundApi: {
        serviceAccount: {
          getNetworkAccountsInSameIndexedAccountId,
          getAccountAddressInfoForApi,
          getWalletSafe,
        },
        serviceToken: { getNativeToken },
        serviceNetwork: { getNetworkSafe },
      },
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    getNativeToken.mockImplementation(
      async ({ networkId }: { networkId: string }) =>
        createNativeToken(networkId, networkId === 'evm--1' ? 'ETH' : 'X'),
    );
    getNetworkSafe.mockImplementation(async ({ networkId }) => ({
      id: networkId,
      name: networkId === 'evm--1' ? 'Ethereum' : 'Other',
      logoURI: `https://img.test/${networkId as string}.png`,
      isCustomNetwork: false,
    }));
    getAccountAddressInfoForApi.mockResolvedValue({
      address: ETH_ADDRESS,
      account: { id: ETH_ACCOUNT_ID, name: 'Account #1' },
    });
    getWalletSafe.mockResolvedValue({ id: 'hd-1', name: 'Wallet 1' });
    getNetworkAccountsInSameIndexedAccountId.mockResolvedValue([
      { account: { id: ETH_ACCOUNT_ID } },
    ]);
  });

  it('resolves token, network and sender for OneToMany in one call', async () => {
    const seed = await createService().getAddressesInputSeed({
      networkId: 'evm--1',
      accountId: ETH_ACCOUNT_ID,
      indexedAccountId: 'hd-1--0',
      bulkSendMode: EBulkSendMode.OneToMany,
    });

    expect(seed).toEqual({
      accountId: ETH_ACCOUNT_ID,
      indexedAccountId: 'hd-1--0',
      networkId: 'evm--1',
      isSupportedNetwork: true,
      token: expect.objectContaining({
        symbol: 'ETH',
        networkId: 'evm--1',
        networkName: 'Ethereum',
      }),
      network: {
        id: 'evm--1',
        name: 'Ethereum',
        logoURI: 'https://img.test/evm--1.png',
        isCustomNetwork: false,
      },
      sender: {
        address: ETH_ADDRESS,
        accountName: 'Account #1',
        walletName: 'Wallet 1',
      },
    });
    // A supported network needs no account re-resolution.
    expect(getNetworkAccountsInSameIndexedAccountId).not.toHaveBeenCalled();
    expect(getNativeToken).toHaveBeenCalledWith({
      networkId: 'evm--1',
      accountId: ETH_ACCOUNT_ID,
      tokenInfoOnly: true,
    });
  });

  it('skips the sender lookup for ManyToOne and ManyToMany', async () => {
    const service = createService();
    for (const bulkSendMode of [
      EBulkSendMode.ManyToOne,
      EBulkSendMode.ManyToMany,
    ]) {
      const seed = await service.getAddressesInputSeed({
        networkId: 'evm--1',
        accountId: ETH_ACCOUNT_ID,
        indexedAccountId: 'hd-1--0',
        bulkSendMode,
      });
      expect(seed.sender).toBeUndefined();
      expect(seed.token?.symbol).toBe('ETH');
    }
    expect(getAccountAddressInfoForApi).not.toHaveBeenCalled();
  });

  it('re-resolves the account on the fixed network when the home network is unsupported', async () => {
    const seed = await createService().getAddressesInputSeed({
      networkId: 'evm--999999',
      accountId: 'hd-1--m/44/60/0/0/0-unsupported',
      indexedAccountId: 'hd-1--0',
      bulkSendMode: EBulkSendMode.OneToMany,
    });

    expect(seed.isSupportedNetwork).toBe(false);
    expect(seed.networkId).toBe('evm--1');
    expect(seed.accountId).toBe(ETH_ACCOUNT_ID);
    expect(getNetworkAccountsInSameIndexedAccountId).toHaveBeenCalledWith({
      networkIds: ['evm--1'],
      indexedAccountId: 'hd-1--0',
    });
  });

  it('resolves the per-network account for the All Networks home selection', async () => {
    const seed = await createService().getAddressesInputSeed({
      networkId: 'onekeyall--0',
      accountId: 'hd-1--all',
      indexedAccountId: 'hd-1--0',
      bulkSendMode: EBulkSendMode.OneToMany,
    });

    expect(seed.networkId).toBe('evm--1');
    expect(seed.accountId).toBe(ETH_ACCOUNT_ID);
    expect(seed.sender?.address).toBe(ETH_ADDRESS);
  });

  it('drops the account when the corrected network has none yet', async () => {
    // Keeping the All Networks / unsupported-network account would make the
    // token and sender lookups (and the page) run against the wrong network.
    getNetworkAccountsInSameIndexedAccountId.mockResolvedValueOnce([]);

    const seed = await createService().getAddressesInputSeed({
      networkId: 'onekeyall--0',
      accountId: 'hd-1--all',
      indexedAccountId: 'hd-1--0',
      bulkSendMode: EBulkSendMode.OneToMany,
    });

    expect(seed.networkId).toBe('evm--1');
    expect(seed.accountId).toBeUndefined();
    expect(seed.token).toBeUndefined();
    expect(seed.sender).toBeUndefined();
    expect(getNativeToken).not.toHaveBeenCalled();
    expect(getAccountAddressInfoForApi).not.toHaveBeenCalled();
  });

  it('resolves a partial seed when the account remap rejects', async () => {
    // This was the only seed lookup without a fallback: an unsupported /
    // All Networks home selection whose account lookup threw rejected the
    // whole request and left the page initializing forever.
    getNetworkAccountsInSameIndexedAccountId.mockRejectedValueOnce(
      new Error('Network not found'),
    );

    const seed = await createService().getAddressesInputSeed({
      networkId: 'onekeyall--0',
      accountId: 'hd-1--all',
      indexedAccountId: 'hd-1--0',
      bulkSendMode: EBulkSendMode.OneToMany,
    });

    expect(seed.networkId).toBe('evm--1');
    expect(seed.network?.id).toBe('evm--1');
    expect(seed.indexedAccountId).toBe('hd-1--0');
    // The All Networks pseudo account cannot seed lookups on evm--1.
    expect(seed.accountId).toBeUndefined();
    expect(seed.token).toBeUndefined();
    expect(seed.sender).toBeUndefined();
    expect(getNativeToken).not.toHaveBeenCalled();
    expect(getAccountAddressInfoForApi).not.toHaveBeenCalled();
  });

  it('keeps a caller-provided token and only fills the network name', async () => {
    const seed = await createService().getAddressesInputSeed({
      networkId: 'evm--1',
      accountId: ETH_ACCOUNT_ID,
      indexedAccountId: 'hd-1--0',
      tokenInfo: {
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
        isNative: false,
      },
      bulkSendMode: EBulkSendMode.OneToMany,
    });

    expect(getNativeToken).not.toHaveBeenCalled();
    expect(seed.token).toEqual(
      expect.objectContaining({
        symbol: 'USDT',
        networkId: 'evm--1',
        networkName: 'Ethereum',
      }),
    );
  });

  it('degrades to a partial seed when a lookup fails', async () => {
    getNativeToken.mockRejectedValueOnce(new Error('offline'));
    getAccountAddressInfoForApi.mockRejectedValueOnce(new Error('no account'));

    const seed = await createService().getAddressesInputSeed({
      networkId: 'evm--1',
      accountId: ETH_ACCOUNT_ID,
      indexedAccountId: 'hd-1--0',
      bulkSendMode: EBulkSendMode.OneToMany,
    });

    expect(seed.token).toBeUndefined();
    expect(seed.sender).toBeUndefined();
    expect(seed.network?.name).toBe('Ethereum');
    expect(seed.accountId).toBe(ETH_ACCOUNT_ID);
  });

  it('returns an empty seed when nothing is selected', async () => {
    const seed = await createService().getAddressesInputSeed({
      bulkSendMode: EBulkSendMode.OneToMany,
    });
    expect(seed.accountId).toBeUndefined();
    expect(seed.token).toBeUndefined();
    expect(seed.sender).toBeUndefined();
    expect(getNativeToken).not.toHaveBeenCalled();
  });
});
