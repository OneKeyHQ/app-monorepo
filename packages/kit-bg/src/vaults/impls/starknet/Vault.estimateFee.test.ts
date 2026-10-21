jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import type { IEncodedTxStarknet } from '@onekeyhq/core/src/chains/starknet/types';

// eslint-disable-next-line import/first
import StarknetVault from './Vault';

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
    getClient: async () => ({
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
