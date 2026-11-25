import type { IEncodedTxStarknet } from '@onekeyhq/core/src/chains/starknet/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { fetchLocalWalletNativeTokenQuote } from '../../localWallet/nativeTokenPrice';

import StarknetVault from './Vault';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../localWallet/nativeTokenPrice', () => ({
  fetchLocalWalletNativeTokenQuote: jest.fn(async () => ({
    price: 0.05,
    price24h: 1,
  })),
}));

// captured from a live Sepolia starknet_estimateFee (spec 0.9.0)
const INVOKE_ESTIMATE = {
  l1_gas_consumed: '0x0',
  l1_gas_price: '0xa0a84ea20386',
  l2_gas_consumed: '0x122b53',
  l2_gas_price: '0x73c72e3b3',
  l1_data_gas_consumed: '0x80',
  l1_data_gas_price: '0xa6f6ce2211',
  overall_fee: '0x83cd0f4f25ec89',
  unit: 'FRI',
};
const DEPLOY_ESTIMATE = {
  ...INVOKE_ESTIMATE,
  l2_gas_consumed: '0x2199a8',
  overall_fee: '0xf446df984a0638',
};

const NETWORK = {
  id: 'starknet--sepolia',
  chainId: '0x534e5f5345504f4c4941',
  decimals: 18,
  symbol: 'STRK',
  feeMeta: { decimals: 18, symbol: 'STRK' },
};

const DEPLOY_BOUNDS = {
  l1_gas: { max_amount: '0x2', max_price_per_unit: '0x3' },
  l2_gas: { max_amount: '0x4', max_price_per_unit: '0x5' },
  l1_data_gas: { max_amount: '0x6', max_price_per_unit: '0x7' },
};

function buildEncodedTx(withDeploy: boolean): IEncodedTxStarknet {
  return {
    chainId: NETWORK.chainId,
    from: '0x0157d9497dee8bbdc5e6a968a96a2408d10c6bf6cfe2b4509602952429d094ec',
    version: '0x3',
    nonce: withDeploy ? '0x1' : '0x7',
    calls: [
      {
        contractAddress:
          '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
        entrypoint: 'transfer',
        calldata: ['0x1234', '0x64', '0x0'],
      },
    ],
    resourceBounds: {
      l1_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
      l2_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
      l1_data_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
    },
    tip: '0x0',
    paymasterData: [],
    accountDeploymentData: [],
    nonceDataAvailabilityMode: 'L1',
    feeDataAvailabilityMode: 'L1',
    ...(withDeploy
      ? {
          deployAccount: {
            classHash: '0x540d7f5',
            constructorCalldata: ['0x1'],
            addressSalt: '0x1',
            nonce: '0x0',
            resourceBounds: DEPLOY_BOUNDS,
          },
        }
      : {}),
  };
}

function buildVault() {
  const vault = Object.create(StarknetVault.prototype) as StarknetVault;
  Object.assign(vault, {
    networkId: NETWORK.id,
    accountId: 'hd-1--test',
    getNetwork: async () => NETWORK,
    getAccountAddress: async () => '0x1',
    getClient: async () => ({
      isAccountDeployed: jest.fn(async () => false),
      estimateFee: jest.fn(async (txs: unknown[]) =>
        txs.length === 2
          ? [DEPLOY_ESTIMATE, INVOKE_ESTIMATE]
          : [INVOKE_ESTIMATE],
      ),
    }),
  });
  return vault;
}

async function feeOf(withDeploy: boolean) {
  const resp = await buildVault().estimateFee({
    accountId: 'hd-1--test',
    networkId: NETWORK.id,
    accountAddress: '0x1',
    encodedTx: buildEncodedTx(withDeploy),
  });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return resp.data.data.feeStarknet![0];
}

describe('StarknetVault.estimateFee', () => {
  beforeEach(() => {
    jest
      .mocked(fetchLocalWalletNativeTokenQuote)
      .mockResolvedValue({ price: 0.05, price24h: 1 });
  });

  it('uses the backend quote for fee fiat conversion', async () => {
    const vault = buildVault();
    const response = await vault.estimateFee({
      accountId: 'hd-1--test',
      networkId: NETWORK.id,
      accountAddress: '0x1',
      encodedTx: buildEncodedTx(false),
    });
    expect(response.data.data.nativeTokenPrice).toEqual({
      price: 0.05,
      price24h: 1,
    });
  });

  it('leaves an unavailable quote unknown instead of manufacturing a zero price', async () => {
    jest.mocked(fetchLocalWalletNativeTokenQuote).mockResolvedValue({});
    const vault = buildVault();
    const response = await vault.estimateFee({
      accountId: 'hd-1--test',
      networkId: NETWORK.id,
      accountAddress: '0x1',
      encodedTx: buildEncodedTx(false),
    });
    expect(response.data.data.nativeTokenPrice).toBeUndefined();
    expect(response.data.data.feeStarknet?.[0].overallFee).toBe(
      BigInt(INVOKE_ESTIMATE.overall_fee).toString(),
    );
  });
  it("reports the node's overall_fee for the invoke leg in decimal FRI", async () => {
    const fee = await feeOf(false);
    expect(fee.overallFee).toBe(BigInt('0x83cd0f4f25ec89').toString(10));
  });

  it('keeps overallFee on the invoke leg when a deploy is attached', async () => {
    const fee = await feeOf(true);
    // not the deploy leg's overall_fee, and not the two summed
    expect(fee.overallFee).toBe(BigInt('0x83cd0f4f25ec89').toString(10));
    expect(fee.overallFee).not.toBe(BigInt('0xf446df984a0638').toString(10));
  });

  it('keeps deployAccountFee separate, from the bounds that get signed', async () => {
    const fee = await feeOf(true);
    expect(fee.deployAccountFee).toBe(String(2 * 3 + 4 * 5 + 6 * 7));
  });

  it("reports the deploy leg's own overall_fee for display", async () => {
    const fee = await feeOf(true);
    expect(fee.deployAccountOverallFee).toBe(
      BigInt('0xf446df984a0638').toString(10),
    );
  });

  it('omits deployAccountFee for an already-deployed account', async () => {
    const fee = await feeOf(false);
    expect(fee.deployAccountFee).toBeUndefined();
    expect(fee.deployAccountOverallFee).toBeUndefined();
  });

  it('reports padded bounds above the node overall_fee', async () => {
    const fee = await feeOf(false);
    const boundsTotal = [fee.l1Gas, fee.l2Gas, fee.l1DataGas].reduce(
      (total, bound) =>
        total + BigInt(bound.maxAmount) * BigInt(bound.maxPricePerUnit),
      BigInt(0),
    );
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(boundsTotal).toBeGreaterThan(BigInt(fee.overallFee!));
  });
});

describe('Starknet standard multi-transaction confirmation', () => {
  async function prepare() {
    const vault = buildVault();
    const original = {
      uuid: 'send-identity',
      accountId: 'hd-1--test',
      networkId: NETWORK.id,
      encodedTx: buildEncodedTx(true),
      transfersInfo: [{ from: '0x1', to: '0x1234', amount: '1' }],
    } as IUnsignedTxPro;
    const txs = (await vault.prepareSendConfirmation([original], false))
      .unsignedTxs;
    return { vault, original, activation: txs[0], transfer: txs[1], txs };
  }

  it('separates activation and transfer without mutating or duplicating their identities', async () => {
    const { vault, original, activation, transfer, txs } = await prepare();
    expect(txs).toHaveLength(2);
    expect(activation.uuid).not.toBe(transfer.uuid);
    expect(activation.transfersInfo).toBeUndefined();
    expect(transfer.uuid).toBe(original.uuid);
    expect(transfer.transfersInfo).toEqual(original.transfersInfo);
    expect(activation.encodedTx).toMatchObject({
      type: 'DEPLOY_ACCOUNT',
      nonce: '0x0',
      calls: [],
    });
    expect(transfer.encodedTx).toMatchObject({
      nonce: '0x1',
      deploymentDependency: expect.anything(),
    });
    expect(transfer.encodedTx).toHaveProperty('deployAccount', undefined);
    expect(original.encodedTx).not.toHaveProperty('type');
    expect(
      (await vault.prepareSendConfirmation(txs, false)).unsignedTxs,
    ).toEqual(txs);
  });

  it('exposes an unsigned prerequisite for a reviewed transfer', async () => {
    const { vault, original } = await prepare();
    const deploymentProgress = jest.fn().mockResolvedValue({});
    Object.assign(vault, { getAccountDeploymentProgress: deploymentProgress });
    const planned = await vault.prepareSendConfirmation([original], true);
    expect(planned.prerequisite).toMatchObject({
      transfersInfo: original.transfersInfo,
      unsignedTx: { encodedTx: { type: 'DEPLOY_ACCOUNT' } },
    });

    await expect(
      vault.prepareSendConfirmation([original], false),
    ).resolves.toMatchObject({
      unsignedTxs: [expect.anything(), expect.anything()],
    });
    expect(deploymentProgress).toHaveBeenCalledTimes(1);
  });

  it('tracks a pending prerequisite without offering another activation', async () => {
    const { vault, original } = await prepare();
    Object.assign(vault, {
      getAccountDeploymentProgress: jest
        .fn()
        .mockResolvedValue({ txid: '0x123' }),
    });
    const planned = await vault.prepareSendConfirmation([original], true);
    expect(planned.prerequisite?.pendingTxid).toBe('0x123');
    expect(planned.prerequisite?.unsignedTx).toBeUndefined();
  });

  it('keeps already deployed sends as one unchanged transaction', async () => {
    const { vault, original } = await prepare();
    original.encodedTx = buildEncodedTx(false);
    expect(
      (await vault.prepareSendConfirmation([original], false)).unsignedTxs,
    ).toEqual([original]);
  });

  it('displays activation as an operation and charges its resource bounds once', async () => {
    const { vault, activation } = await prepare();
    const decoded = await vault.buildDecodedTx({ unsignedTx: activation });
    expect(decoded.actions[0].type).toBe(EDecodedTxActionType.FUNCTION_CALL);
    expect(decoded.nativeAmount).toBe('0');
    expect(decoded.isFeeOnly).toBe(true);
    expect(decoded.totalFeeInNative).toBe('0.000000000000000068');
    expect(decoded.extraInfo).toEqual({ accountDeployment: true });
  });

  it('estimates activation alone and the dependent invoke against the deployment', async () => {
    const { vault, activation, transfer } = await prepare();
    const client = {
      isAccountDeployed: jest.fn(async () => false),
      estimateFee: jest.fn(async (txs: { type: string }[]) =>
        txs.map((tx) =>
          tx.type === 'DEPLOY_ACCOUNT' ? DEPLOY_ESTIMATE : INVOKE_ESTIMATE,
        ),
      ),
    };
    jest
      .spyOn(vault, 'getClient')
      .mockResolvedValue(
        client as unknown as Awaited<ReturnType<StarknetVault['getClient']>>,
      );
    const activationFee = await vault.estimateFee({
      accountId: 'hd-1--test',
      networkId: NETWORK.id,
      accountAddress: '0x1',
      encodedTx: activation.encodedTx,
    });
    const transferFee = await vault.estimateFee({
      accountId: 'hd-1--test',
      networkId: NETWORK.id,
      accountAddress: '0x1',
      encodedTx: transfer.encodedTx,
    });
    expect(client.estimateFee.mock.calls[0][0].map((tx) => tx.type)).toEqual([
      'DEPLOY_ACCOUNT',
    ]);
    expect(client.estimateFee.mock.calls[1][0].map((tx) => tx.type)).toEqual([
      'DEPLOY_ACCOUNT',
      'INVOKE',
    ]);
    expect(activationFee.data.data.feeStarknet?.[0].overallFee).toBe(
      BigInt(DEPLOY_ESTIMATE.overall_fee).toString(),
    );
    expect(transferFee.data.data.feeStarknet?.[0].overallFee).toBe(
      BigInt(INVOKE_ESTIMATE.overall_fee).toString(),
    );
    expect(
      activationFee.data.data.feeStarknet?.[0].deployAccountFee,
    ).toBeUndefined();
    expect(
      transferFee.data.data.feeStarknet?.[0].deployAccountFee,
    ).toBeUndefined();
    client.isAccountDeployed.mockResolvedValue(true);
    await vault.estimateFee({
      accountId: 'hd-1--test',
      networkId: NETWORK.id,
      accountAddress: '0x1',
      encodedTx: transfer.encodedTx,
    });
    expect(client.estimateFee.mock.calls[2][0].map((tx) => tx.type)).toEqual([
      'INVOKE',
    ]);
  });

  it('updates the actual activation bounds with the selected fee', async () => {
    const { vault, activation } = await prepare();
    const fee = (
      await vault.estimateFee({
        accountId: 'hd-1--test',
        networkId: NETWORK.id,
        accountAddress: '0x1',
        encodedTx: activation.encodedTx,
      })
    ).data.data.feeStarknet?.[0];
    const updated = await vault.updateUnsignedTx({
      unsignedTx: activation,
      feeInfo: {
        common: {
          feeDecimals: 18,
          feeSymbol: 'STRK',
          nativeDecimals: 18,
          nativeSymbol: 'STRK',
        },
        feeStarknet: checkIsDefined(fee),
      },
    });
    const encoded = updated.encodedTx as IEncodedTxStarknet;
    expect(encoded.resourceBounds).toEqual(
      encoded.deployAccount?.resourceBounds,
    );
  });
});
