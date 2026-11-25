import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EMessageTypesStarknet } from '@onekeyhq/shared/types/message';

import { vaultFactory } from '../vaults/factory';

import ProviderApiStarknet from './ProviderApiStarknet';

import type { IBackgroundApi } from '../apis/IBackgroundApi';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (ctor: unknown) => ctor,
  backgroundMethod: () => () => undefined,
  providerApiMethod: () => () => undefined,
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: jest.fn(),
  },
}));

describe('ProviderApiStarknet', () => {
  const accountAddress =
    '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  function createProvider(connected = true) {
    const openConnectionModal = jest.fn(async () => undefined);
    const openSignAndSendTransactionModal = jest.fn(async () => ({
      txid: '0xdeadbeef',
    }));
    const openSignMessageModal = jest.fn(async () =>
      JSON.stringify(['0x11', '0x22']),
    );
    const backgroundApi = {
      serviceDApp: {
        dAppGetConnectedAccountsInfo: jest.fn(async () =>
          connected
            ? [
                {
                  account: { address: accountAddress },
                  accountInfo: {
                    accountId: 'hd-1--m/44/9004/0/0/0',
                    networkId: 'starknet--mainnet',
                  },
                },
              ]
            : [],
        ),
        openConnectionModal,
        switchConnectedNetwork: jest.fn(async () => undefined),
        openSignAndSendTransactionModal,
        openSignMessageModal,
      },
      serviceNetwork: {
        getNetwork: jest.fn(async ({ networkId }: { networkId: string }) => ({
          chainId:
            networkId === 'starknet--sepolia'
              ? '0x534e5f5345504f4c4941'
              : '0x534e5f4d41494e',
        })),
      },
    } as unknown as IBackgroundApi;

    const provider = new ProviderApiStarknet({ backgroundApi });
    jest.spyOn(provider, 'getAccountsInfo').mockResolvedValue([
      {
        account: { address: accountAddress },
        accountInfo: {
          accountId: 'hd-1--m/44/9004/0/0/0',
          networkId: 'starknet--mainnet',
        },
      } as never,
    ]);
    return {
      provider,
      openConnectionModal,
      openSignAndSendTransactionModal,
      openSignMessageModal,
    };
  }

  const req = { origin: 'https://starkgate.starknet.io', scope: 'starknet' };

  it('reports supported wallet API versions, RPC specs, and permissions', async () => {
    const { provider } = createProvider(true);
    expect(await provider.wallet_supportedWalletApi()).toEqual(['0.7', '0.8']);
    expect(await provider.wallet_supportedSpecs()).toEqual([
      '0.7',
      '0.8',
      '0.9',
    ]);
    expect(await provider.wallet_getPermissions(req as never)).toEqual([
      'accounts',
    ]);
    expect(await provider.wallet_requestChainId(req as never)).toBe(
      '0x534e5f4d41494e',
    );
  });

  it('uses Starknet Wallet API error codes for unlisted network (112) and already deployed account (115)', async () => {
    const { provider } = createProvider(true);
    await expect(
      provider.wallet_switchStarknetChain(req as never, {
        chainId: '0xdeadbeef',
      }),
    ).rejects.toMatchObject({ code: 112 });

    (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue({
      getAccountDeploymentData: jest.fn(async () => undefined),
    });
    await expect(
      provider.wallet_deploymentData(req as never),
    ).rejects.toMatchObject({ code: 115 });
  });

  it('respects silent_mode in wallet_requestAccounts without prompting', async () => {
    const { provider, openConnectionModal } = createProvider(false);
    expect(
      await provider.wallet_requestAccounts(req as never, {
        silent_mode: true,
      }),
    ).toEqual([]);
    expect(openConnectionModal).not.toHaveBeenCalled();
  });

  it('builds and submits Starknet invoke calls via wallet_addInvokeTransaction', async () => {
    const { provider, openSignAndSendTransactionModal } = createProvider(true);
    const buildDappInvokeEncodedTx = jest.fn(async () => ({
      from: accountAddress,
      calls: [],
    }));
    (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue({
      buildDappInvokeEncodedTx,
    });

    const res = await provider.wallet_addInvokeTransaction(req as never, {
      calls: [
        {
          contract_address: '0x123',
          entry_point: 'transfer',
          calldata: ['0x1', '100', '0'],
        },
      ],
    });

    expect(buildDappInvokeEncodedTx).toHaveBeenCalledWith({
      calls: [
        {
          contractAddress:
            '0x0000000000000000000000000000000000000000000000000000000000000123',
          entrypoint: 'transfer',
          calldata: ['0x1', '0x64', '0x0'],
        },
      ],
    });
    expect(openSignAndSendTransactionModal).toHaveBeenCalled();
    expect(res).toEqual({ transaction_hash: '0xdeadbeef' });
  });

  it('signs SNIP-12 typed data via wallet_signTypedData', async () => {
    const { provider, openSignMessageModal } = createProvider(true);
    const typedData = {
      types: { StarkNetDomain: [] },
      primaryType: 'Message',
      domain: { name: 'StarkGate' },
      message: { value: '1' },
    };

    const sig = await provider.wallet_signTypedData(req as never, typedData);

    expect(openSignMessageModal).toHaveBeenCalledWith(
      expect.objectContaining({
        unsignedMessage: {
          type: EMessageTypesStarknet.SIGN_TYPED_DATA,
          message: stringUtils.stableStringify(typedData),
        },
      }),
    );
    expect(sig).toEqual(['0x11', '0x22']);
  });
});
