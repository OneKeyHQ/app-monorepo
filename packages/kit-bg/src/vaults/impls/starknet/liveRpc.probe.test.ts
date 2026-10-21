/* Live probe, skipped unless STARKNET_LIVE_RPC=1. Read-only, never broadcasts.
 *
 *   STARKNET_LIVE_RPC=1 npx jest \
 *     packages/kit-bg/src/vaults/impls/starknet/liveRpc.probe.test.ts
 *
 * The last block in this file is different: it SPENDS REAL SEPOLIA STRK. It is
 * skipped unless a Stark private key is supplied as well, and it deploys the
 * account when that key's address has never been deployed:
 *
 *   STARKNET_LIVE_RPC=1 STARKNET_SEPOLIA_PRIVATE_KEY=0x<64 hex> npx jest \
 *     packages/kit-bg/src/vaults/impls/starknet/liveRpc.probe.test.ts \
 *     -t "real Sepolia broadcast"
 *
 * The key is read from the environment only, never from a file, and is never
 * logged. Fund the derived address with Sepolia STRK first; the address is
 * printed at the start of the run. Budget a few minutes: the test polls until
 * both transactions reach ACCEPTED_ON_L2.
 */
import CoreChainImported from '@onekeyhq/core/src/chains/starknet/CoreChainImported';
import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';
import type { IStarknetRawTx } from '@onekeyhq/core/src/chains/starknet/types';
import { encryptImportedCredential } from '@onekeyhq/core/src/secret';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import ClientStarknet from './sdkStarknet/ClientStarknet';
import {
  STARKNET_DEFAULT_RPC_URLS,
  ZERO_SIGNATURE,
} from './sdkStarknet/consts';
import {
  toResourceBounds,
  u256ToDecimalString,
  zeroResourceBounds,
} from './utils';
import StarknetVault from './Vault';

import type { IStarknetBroadcastTx } from './sdkStarknet/types';

/** Local-only password for the throwaway imported credential this harness builds. */
const PROBE_PASSWORD = '11111111';

const run = process.env.STARKNET_LIVE_RPC === '1' ? describe : describe.skip;

const DEPLOYED =
  '0x77dfdc45ba4695eac4c961f3d9bf820ed7e925a44d9963de7b7a0daf8768af0';
const UNDEPLOYED =
  '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const STRK =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

run('ClientStarknet against live Sepolia', () => {
  jest.setTimeout(60_000);
  // no customRpcUrl: exercises the default transport selection
  const client = new ClientStarknet({ networkId: 'starknet--sepolia' });

  it('reports spec, chain and head', async () => {
    const spec = await client.getSpecVersion();
    const chainId = await client.getChainId();
    const blockNumber = await client.getBlockNumber();
    const tag = await client.getPreConfirmedBlockTag();
    console.log({ spec, chainId, blockNumber, tag });
    expect(chainId).toBe('0x534e5f5345504f4c4941');
    expect(blockNumber).toBeGreaterThan(0);
    // the default path pins /rpc/v0_10: below 0.10.1 the node cannot carry a
    // STRK20 `proof` on starknet_addInvokeTransaction
    expect(spec.startsWith('0.10.')).toBe(true);
    expect(tag).toBe('pre_confirmed');
  });

  it('detects deployment both ways', async () => {
    expect(await client.isAccountDeployed(DEPLOYED)).toBe(true);
    expect(await client.isAccountDeployed(UNDEPLOYED)).toBe(false);
    console.log('nonce', await client.getNonce(DEPLOYED));
  });

  it('reads an ERC-20 balance and decimals', async () => {
    const [low, high] = await client.getTokenBalance({
      tokenAddress: STRK,
      accountAddress: DEPLOYED,
    });
    console.log('balanceOf STRK', {
      low,
      high,
      decimal: u256ToDecimalString(low, high),
    });
    expect(await client.getTokenDecimals(STRK)).toBe(18);
  });

  it('reads ERC-20 metadata in both Cairo encodings', async () => {
    const strk = await client.getTokenMetadata(STRK);
    const eth = await client.getTokenMetadata(
      '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    );
    console.log('metadata', { strk, eth });
    expect(strk).toEqual({
      name: 'Starknet Token',
      symbol: 'STRK',
      decimals: 18,
    });
    expect(eth).toEqual({ name: 'Ether', symbol: 'ETH', decimals: 18 });
  });

  it('estimates an invoke with SKIP_VALIDATE', async () => {
    const nonce = await client.getNonce(DEPLOYED);
    const invoke: IStarknetBroadcastTx = {
      type: 'INVOKE',
      version: '0x3',
      sender_address: DEPLOYED,
      // spec-valid felts, the form core now emits
      calldata: [
        '0x1',
        STRK,
        '0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e',
        '0x3',
        '0x1',
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
    };
    const [estimate] = await client.estimateFee([invoke]);
    console.log('estimateFee', estimate);
    console.log('padded bounds', toResourceBounds(estimate));
    expect(estimate.unit).toBe('FRI');
    expect(BigInt(estimate.overall_fee)).toBeGreaterThan(BigInt(0));
  });

  it('returns null for an unknown receipt and a real one otherwise', async () => {
    expect(
      await client.getTransactionReceipt(
        '0x1111111111111111111111111111111111111111111111111111111111111',
      ),
    ).toBeNull();
  });
});

run('ClientStarknet against live mainnet', () => {
  jest.setTimeout(60_000);
  const client = new ClientStarknet({ networkId: 'starknet--mainnet' });
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
 * Real broadcast. Gated on the private key as well as STARKNET_LIVE_RPC, so an
 * ordinary live-probe run never spends anything. Exercises the production path
 * end to end: Vault.buildEncodedTx (including deploy detection and pricing),
 * core's signer, then Vault.broadcastTransaction, which sends DEPLOY_ACCOUNT
 * before INVOKE when the account is new.
 */
const broadcastKey = process.env.STARKNET_SEPOLIA_PRIVATE_KEY;
const runBroadcast =
  process.env.STARKNET_LIVE_RPC === '1' && broadcastKey
    ? describe
    : describe.skip;

runBroadcast('real Sepolia broadcast (spends STRK)', () => {
  jest.setTimeout(900_000);

  const NETWORK = {
    id: 'starknet--sepolia',
    chainId: '0x534e5f5345504f4c4941',
    decimals: 18,
    symbol: 'STRK',
    shortname: 'TSTRK',
    logoURI: '',
    feeMeta: { decimals: 18, symbol: 'STRK' },
  };
  const SELF_TRANSFER_AMOUNT = '0.00001';

  const sleep = (ms: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  async function waitForAcceptance(client: ClientStarknet, txid: string) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const receipt = await client.getTransactionReceipt(txid);
      if (
        receipt?.finality_status === 'ACCEPTED_ON_L2' ||
        receipt?.finality_status === 'ACCEPTED_ON_L1'
      ) {
        return receipt;
      }
      if (receipt?.finality_status === 'REJECTED') {
        return receipt;
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(5000);
    }
    return null;
  }

  it('deploys when needed and lands a self-transfer', async () => {
    // env only, never a file; the key itself is never printed
    const starkPrivateKey = sdkStarknet.normalizeStarkPrivateKey(
      broadcastKey ?? '',
    );
    const publicKey = sdkStarknet.getStarkPublicKey(starkPrivateKey);
    // an account id without the OpenZeppelin suffix is the default Argent type
    const address = sdkStarknet.getAddressFromStarkPublicKey(
      publicKey,
      'argent',
    );
    console.log('broadcasting from', address);

    const client = new ClientStarknet({ networkId: NETWORK.id });

    const [low, high] = await client.getTokenBalance({
      tokenAddress: STRK,
      accountAddress: address,
    });
    const balance = BigInt(u256ToDecimalString(low, high));
    console.log('STRK balance (FRI)', balance.toString(10));
    expect(balance).toBeGreaterThan(BigInt(0));

    const wasDeployed = await client.isAccountDeployed(address);
    console.log('account already deployed:', wasDeployed);

    const vault = Object.create(StarknetVault.prototype) as StarknetVault;
    Object.assign(vault, {
      networkId: NETWORK.id,
      accountId: 'imported--starknet-live-probe',
      getNetwork: async () => NETWORK,
      getClient: async () => client,
      getAccount: async () => ({ address, pub: publicKey }),
    });

    const encodedTx = await vault.buildEncodedTx({
      transfersInfo: [
        {
          from: address,
          to: address,
          amount: SELF_TRANSFER_AMOUNT,
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
    expect(Boolean(encodedTx.deployAccount)).toBe(!wasDeployed);

    const signedTx = await new CoreChainImported().signTransaction({
      networkInfo: {
        networkChainCode: 'starknet',
        chainId: NETWORK.chainId,
        networkId: NETWORK.id,
        networkImpl: 'starknet',
        isTestnet: true,
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
    expect(BigInt(rawTx.invoke.sender_address)).toBe(BigInt(address));

    const result = await vault.broadcastTransaction({
      accountId: 'imported--starknet-live-probe',
      networkId: NETWORK.id,
      accountAddress: address,
      signedTx: { ...signedTx, encodedTx },
    });
    console.log('invoke txid', result.txid);
    expect(result.txid).toBe(rawTx.invokeTxHash);

    if (!wasDeployed) {
      expect(rawTx.deployAccountTxHash).toBeTruthy();
      console.log('deploy_account txid', rawTx.deployAccountTxHash);
      const deployReceipt = await waitForAcceptance(
        client,
        rawTx.deployAccountTxHash ?? '',
      );
      expect(deployReceipt?.finality_status).toBe('ACCEPTED_ON_L2');
      expect(deployReceipt?.execution_status).toBe('SUCCEEDED');
      expect(await client.isAccountDeployed(address)).toBe(true);
    }

    const invokeReceipt = await waitForAcceptance(client, result.txid);
    console.log('invoke receipt', invokeReceipt);
    expect(invokeReceipt?.finality_status).toBe('ACCEPTED_ON_L2');
    expect(invokeReceipt?.execution_status).toBe('SUCCEEDED');
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
    id: 'starknet--sepolia',
    chainId: '0x534e5f5345504f4c4941',
    shortname: 'TSTRK',
    isTestnet: true,
  },
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
  networkId: string,
  transactions: unknown[],
): Promise<{ result?: ISimulatedTrace[]; error?: unknown }> {
  const response = await fetch(STARKNET_DEFAULT_RPC_URLS[networkId], {
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
      const client = new ClientStarknet({ networkId: network.id });
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
