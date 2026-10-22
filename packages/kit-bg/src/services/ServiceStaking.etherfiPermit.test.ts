import { EtherFiLiquidReferContract } from '@onekeyhq/shared/src/consts/addresses';
import { EApproveType } from '@onekeyhq/shared/types/staking';
import type { IEarnPermit2ApproveSignData } from '@onekeyhq/shared/types/staking';

import ServiceStaking from './ServiceStaking';

import type { AxiosInstance } from 'axios';

const accountAddress = '0x1111111111111111111111111111111111111111';
const protocolVault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const inputTokenAddress = '0x35fa164735182de50811e8e2e824cfb9b6118ac2';
const permitSignature = `0x${'11'.repeat(65)}`;
const unsignedMessage: IEarnPermit2ApproveSignData = {
  domain: {
    name: 'EETH',
    version: '1',
    chainId: 1,
    verifyingContract: inputTokenAddress,
  },
  primaryType: 'Permit',
  message: {
    owner: accountAddress,
    spender: EtherFiLiquidReferContract,
    value: '1000000000000000001',
    nonce: '9007199254740993',
    deadline: '18446744073709551615',
  },
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
};
const params = {
  networkId: 'evm--1',
  provider: 'etherfi',
  symbol: 'eETH',
  amount: '1.000000000000000001',
  protocolVault,
  inputTokenAddress,
};
const txResponse = {
  tx: {
    from: accountAddress,
    to: EtherFiLiquidReferContract,
    data: '0x1234',
    value: '0x0',
  },
  orderId: 'order-id',
};

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: jest.fn(async () => ({
      getAccount: async () => ({ address: accountAddress }),
    })),
  },
}));

function createServiceHarness() {
  const service = new ServiceStaking({
    backgroundApi: {
      serviceReferralCode: {
        checkAndUpdateReferralCode: jest
          .fn<Promise<undefined>, [{ accountId: string }]>()
          .mockResolvedValue(undefined),
      },
    },
  });
  const get = jest
    .fn<
      Promise<{ data: { data: { feeFiatValue: string } } }>,
      [string, { params: Record<string, unknown> }]
    >()
    .mockResolvedValue({ data: { data: { feeFiatValue: '0.25' } } });
  const post = jest
    .fn<
      Promise<{ data: { data: typeof txResponse } }>,
      [string, Record<string, unknown>]
    >()
    .mockResolvedValue({ data: { data: txResponse } });
  jest
    .spyOn(service, 'getClient')
    .mockResolvedValue({ get, post } as unknown as AxiosInstance);
  jest.spyOn(service, 'getStakingConfigs').mockResolvedValue({
    enabled: true,
    usePublicKey: false,
  } as Awaited<ReturnType<ServiceStaking['getStakingConfigs']>>);
  return { service, get, post };
}

describe('ServiceStaking EtherFi Permit requests', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serializes the fee query Permit without losing large integers or the actual vault', async () => {
    const { service, get } = createServiceHarness();
    const input = Object.freeze({
      ...params,
      accountAddress,
      action: 'stake' as const,
      approveType: 'permit' as const,
      permitSignature,
      unsignedMessage,
    });

    await expect(service.estimateFee(input)).resolves.toMatchObject({
      feeFiatValue: '0.25',
    });

    expect(get).toHaveBeenCalledTimes(1);
    const [url, options] = get.mock.calls[0];
    expect(url).toBe('/earn/v1/estimate-fee');
    expect(options.params).toMatchObject({
      symbol: 'eETH',
      amount: params.amount,
      vault: protocolVault,
      inputTokenAddress,
      approveType: 'permit',
      permitSignature,
    });
    expect(options.params).not.toHaveProperty('protocolVault');
    expect(typeof options.params.unsignedMessage).toBe('string');
    const restored: unknown = JSON.parse(
      options.params.unsignedMessage as string,
    );
    expect(restored).toEqual(unsignedMessage);
    expect(restored).toMatchObject({
      message: {
        deadline: '18446744073709551615',
        nonce: '9007199254740993',
        value: '1000000000000000001',
      },
    });
    expect(input.unsignedMessage).toBe(unsignedMessage);
  });

  it('does not require a Permit message when an existing allowance is sufficient', async () => {
    const { service, post } = createServiceHarness();

    await expect(
      service.buildStakeTransaction({
        ...params,
        accountId: 'account-id',
        approveType: EApproveType.Permit,
      }),
    ).resolves.toEqual(txResponse);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/earn/v2/stake',
      expect.objectContaining({
        symbol: 'eETH',
        accountAddress,
        amount: params.amount,
        vault: protocolVault,
        inputTokenAddress,
        approveType: EApproveType.Permit,
        permitSignature: undefined,
        unsignedMessage: undefined,
      }),
    );
  });

  it('keeps the signature and original typed message together for the actual EtherFi vault', async () => {
    const { service, post } = createServiceHarness();
    const input = Object.freeze({
      ...params,
      accountId: 'account-id',
      approveType: EApproveType.Permit,
      permitSignature,
      unsignedMessage,
    });

    await expect(service.buildStakeTransaction(input)).resolves.toEqual(
      txResponse,
    );

    expect(post).toHaveBeenCalledWith(
      '/earn/v2/stake',
      expect.objectContaining({
        symbol: 'eETH',
        accountAddress,
        vault: protocolVault,
        approveType: EApproveType.Permit,
        permitSignature,
        unsignedMessage,
      }),
    );
    const body = post.mock.calls[0][1];
    expect(body.unsignedMessage).toBe(unsignedMessage);
    expect(body.vault).not.toBe(EtherFiLiquidReferContract);
    expect(body).not.toHaveProperty('protocolVault');
    expect(input.protocolVault).toBe(protocolVault);
  });
});
