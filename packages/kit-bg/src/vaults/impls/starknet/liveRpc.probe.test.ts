/* Live probe, skipped unless STARKNET_LIVE_RPC=1. Read-only, never broadcasts.
 *
 *   STARKNET_LIVE_RPC=1 STARKNET_LIVE_RPC_URL=<custom-rpc> yarn jest \
 *     packages/kit-bg/src/vaults/impls/starknet/liveRpc.probe.test.ts
 */
import CoreChainImported from '@onekeyhq/core/src/chains/starknet/CoreChainImported';
import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';
import type { IStarknetRawTx } from '@onekeyhq/core/src/chains/starknet/types';
import { encryptImportedCredential } from '@onekeyhq/core/src/secret';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import ClientStarknet from './sdkStarknet/ClientStarknet';
import { ZERO_SIGNATURE } from './sdkStarknet/consts';
import { zeroResourceBounds } from './utils';
import StarknetVault from './Vault';

/** Local-only password for the throwaway imported credential this harness builds. */
const PROBE_PASSWORD = '11111111';
const PROBE_RPC_URL =
  process.env.STARKNET_LIVE_RPC_URL || 'https://unused.invalid';
if (
  process.env.STARKNET_LIVE_RPC === '1' &&
  !process.env.STARKNET_LIVE_RPC_URL
) {
  throw new OneKeyLocalError(
    'STARKNET_LIVE_RPC_URL is required for the explicit custom-RPC probe',
  );
}

const run = process.env.STARKNET_LIVE_RPC === '1' ? describe : describe.skip;

const UNDEPLOYED =
  '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const STRK =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

run('ClientStarknet against live mainnet', () => {
  jest.setTimeout(60_000);
  const client = new ClientStarknet({
    networkId: 'starknet--mainnet',
    customRpcUrl: PROBE_RPC_URL,
  });
  const MAINNET_ACCOUNT =
    '0x4678eb497e96599c92b45f342c2bd284321fe219c60a9b6293d80f0fbfa61b5';

  it('serves the newer spec with the same field names', async () => {
    expect(await client.getSpecVersion()).toBe('0.10.2');
    expect(await client.getChainId()).toBe('0x534e5f4d41494e');
    expect(await client.getPreConfirmedBlockTag()).toBe('pre_confirmed');
  });

  it('detects deployment and reads a nonce', async () => {
    expect(await client.isAccountDeployed(MAINNET_ACCOUNT)).toBe(true);
    expect(await client.isAccountDeployed(UNDEPLOYED)).toBe(false);
    expect(typeof (await client.getNonce(MAINNET_ACCOUNT))).toBe('string');
  });

  it('reads metadata and balances', async () => {
    expect(await client.getTokenMetadata(STRK)).toEqual({
      name: 'Starknet Token',
      symbol: 'STRK',
      decimals: 18,
    });
    const [low, high] = await client.getTokenBalance({
      tokenAddress: STRK,
      accountAddress: MAINNET_ACCOUNT,
    });
    expect(typeof low).toBe('string');
    expect(typeof high).toBe('string');
  });

  it('returns the eight estimateFee fields the vault reads', async () => {
    const nonce = await client.getNonce(MAINNET_ACCOUNT);
    const [estimate] = await client.estimateFee([
      {
        type: 'INVOKE',
        version: '0x3',
        sender_address: MAINNET_ACCOUNT,
        calldata: [
          '0x1',
          STRK,
          '0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e',
          '0x3',
          MAINNET_ACCOUNT,
          '0x1',
          '0x0',
        ],
        signature: [...ZERO_SIGNATURE],
        nonce,
        resource_bounds: zeroResourceBounds(),
        tip: '0x0',
        paymaster_data: [],
        account_deployment_data: [],
        nonce_data_availability_mode: 'L1',
        fee_data_availability_mode: 'L1',
      },
    ]);
    console.log('mainnet estimateFee', estimate);
    expect(Object.keys(estimate).toSorted()).toEqual([
      'l1_data_gas_consumed',
      'l1_data_gas_price',
      'l1_gas_consumed',
      'l1_gas_price',
      'l2_gas_consumed',
      'l2_gas_price',
      'overall_fee',
      'unit',
    ]);
    expect(estimate.unit).toBe('FRI');
  });

  it('returns null for an unknown receipt', async () => {
    expect(
      await client.getTransactionReceipt(
        '0x1111111111111111111111111111111111111111111111111111111111111',
      ),
    ).toBeNull();
  });
});

/**
 * Production build and sign path, checked by the node without spending
 * anything: a throwaway key per run, then DEPLOY_ACCOUNT + INVOKE handed to
 * starknet_simulateTransactions with SKIP_FEE_CHARGE only. Validation stays on,
 * so the account contract verifies both signatures against hashes the node
 * computes itself, and the invoke runs against the state the deploy leaves.
 * A copy with one signature bit flipped must fail, proving validation ran.
 */
const simulationNetworks = [
  {
    id: 'starknet--mainnet',
    chainId: '0x534e5f4d41494e',
    shortname: 'STRK',
    isTestnet: false,
  },
] as const;
const simulationCases = simulationNetworks.flatMap((network) =>
  (['argent', 'openZeppelin', 'okx'] as const).map((accountContract) => ({
    ...network,
    accountContract,
  })),
);

type ISimulatedTrace = {
  fee_estimation?: Record<string, string>;
  transaction_trace?: {
    type?: string;
    validate_invocation?: unknown;
    constructor_invocation?: { revert_reason?: string } | null;
    execute_invocation?: { revert_reason?: string } | null;
  };
};

async function simulate(
  _networkId: string,
  transactions: unknown[],
): Promise<{ result?: ISimulatedTrace[]; error?: unknown }> {
  const response = await fetch(PROBE_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'starknet_simulateTransactions',
      params: ['latest', transactions, ['SKIP_FEE_CHARGE']],
    }),
  });
  return (await response.json()) as {
    result?: ISimulatedTrace[];
    error?: unknown;
  };
}

const runSimulation =
  process.env.STARKNET_LIVE_RPC === '1' ? describe : describe.skip;

runSimulation.each(simulationCases)(
  'signed $accountContract deploy + first transfer, simulated on $id (no funds)',
  (network) => {
    it('passes account validation and executes; a tampered signature does not', async () => {
      const keyBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
      // below 2^251, so always inside the Stark curve order
      keyBytes[0] = 0;
      keyBytes[1] = Math.max(1, keyBytes[1] % 0x08);
      const starkPrivateKey = sdkStarknet.normalizeStarkPrivateKey(
        Buffer.from(keyBytes),
      );
      const publicKey = sdkStarknet.getStarkPublicKey(starkPrivateKey);
      const address = sdkStarknet.getAddressFromStarkPublicKey(
        publicKey,
        network.accountContract,
      );
      const client = new ClientStarknet({
        networkId: network.id,
        customRpcUrl: PROBE_RPC_URL,
      });
      expect(await client.isAccountDeployed(address)).toBe(false);

      const networkInfo = {
        id: network.id,
        chainId: network.chainId,
        decimals: 18,
        symbol: 'STRK',
        shortname: network.shortname,
        logoURI: '',
        feeMeta: { decimals: 18, symbol: 'STRK' },
      };
      const vault = Object.create(StarknetVault.prototype) as StarknetVault;
      Object.assign(vault, {
        networkId: network.id,
        accountId: {
          argent: 'imported--starknet-simulation',
          openZeppelin: `imported--starknet-simulation--${EAddressEncodings.STARKNET_OZ}`,
          okx: `imported--starknet-simulation--${EAddressEncodings.STARKNET_OKX}`,
        }[network.accountContract],
        getNetwork: async () => networkInfo,
        getClient: async () => client,
        getAccount: async () => ({ address, pub: publicKey }),
      });

      const encodedTx = await vault.buildEncodedTx({
        transfersInfo: [
          {
            from: address,
            to: address,
            amount: '0',
            tokenInfo: {
              address: STRK,
              decimals: 18,
              symbol: 'STRK',
              name: 'Starknet Token',
              isNative: true,
              logoURI: '',
            },
          },
        ],
      });
      expect(encodedTx.deployAccount).toBeTruthy();

      const signedTx = await new CoreChainImported().signTransaction({
        networkInfo: {
          networkChainCode: 'starknet',
          chainId: network.chainId,
          networkId: network.id,
          networkImpl: 'starknet',
          isTestnet: network.isTestnet,
        },
        password: PROBE_PASSWORD,
        credentials: {
          imported: await encryptImportedCredential({
            password: PROBE_PASSWORD,
            credential: { privateKey: starkPrivateKey },
          }),
        },
        account: { address, path: '', pub: publicKey, pubKey: publicKey },
        unsignedTx: { encodedTx },
      });
      const rawTx = JSON.parse(signedTx.rawTx) as IStarknetRawTx;
      expect(rawTx.deployAccount).toBeTruthy();

      const ok = await simulate(network.id, [
        rawTx.deployAccount,
        rawTx.invoke,
      ]);
      console.log(network.id, 'simulation', JSON.stringify(ok).slice(0, 600));
      expect(ok.error).toBeUndefined();
      const [deployTrace, invokeTrace] = ok.result ?? [];
      expect(deployTrace?.transaction_trace?.type).toBe('DEPLOY_ACCOUNT');
      expect(deployTrace?.transaction_trace?.validate_invocation).toBeTruthy();
      expect(
        deployTrace?.transaction_trace?.constructor_invocation?.revert_reason,
      ).toBeUndefined();
      expect(invokeTrace?.transaction_trace?.type).toBe('INVOKE');
      expect(invokeTrace?.transaction_trace?.validate_invocation).toBeTruthy();
      expect(
        invokeTrace?.transaction_trace?.execute_invocation?.revert_reason,
      ).toBeUndefined();

      // the vault prices with SKIP_VALIDATE; the signed bounds must still
      // cover what execution with validation actually uses
      const pairs = [
        [deployTrace, rawTx.deployAccount],
        [invokeTrace, rawTx.invoke],
      ] as const;
      for (const [trace, tx] of pairs) {
        const used = trace?.fee_estimation ?? {};
        const bounds = tx?.resource_bounds;
        for (const resource of ['l1_gas', 'l2_gas', 'l1_data_gas'] as const) {
          const consumed = BigInt(used[`${resource}_consumed`] ?? '0x0');
          const price = BigInt(used[`${resource}_price`] ?? '0x0');
          const maxAmount = BigInt(bounds?.[resource].max_amount ?? '0x0');
          const maxPrice = BigInt(
            bounds?.[resource].max_price_per_unit ?? '0x0',
          );
          console.log(
            network.id,
            tx?.type,
            resource,
            `consumed ${consumed} / max ${maxAmount}`,
            `price ${price} / max ${maxPrice}`,
          );
          expect(consumed <= maxAmount).toBe(true);
          expect(price <= maxPrice).toBe(true);
        }
      }

      const [r, s] = rawTx.invoke.signature;
      const tampered = {
        ...rawTx.invoke,
        signature: [r, `0x${(BigInt(s) ^ BigInt(1)).toString(16)}`],
      };
      const bad = await simulate(network.id, [rawTx.deployAccount, tampered]);
      console.log(network.id, 'tampered', JSON.stringify(bad).slice(0, 300));
      expect(bad.error).toBeTruthy();
    }, 120_000);
  },
);
