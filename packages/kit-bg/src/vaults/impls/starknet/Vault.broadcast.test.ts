jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import type { IEncodedTxStarknet } from '@onekeyhq/core/src/chains/starknet/types';

// eslint-disable-next-line import/first
import { STRK20_SCREENING_WINDOW_MS } from './sdkStarknet';
// eslint-disable-next-line import/first
import StarknetVault from './Vault';

/*
yarn jest packages/kit-bg/src/vaults/impls/starknet/Vault.broadcast.test.ts

A deposit's screening attestation expires, so a build the user sat on must be
refused locally instead of burning a real fee on a SCREENING_REQUIRED revert.
*/
const POOL =
  '0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91';

const baseEncodedTx = {
  chainId: '0x534e5f5345504f4c4941',
  from: '0x1',
  version: '0x3',
  nonce: '0x1',
  calls: [],
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
} as IEncodedTxStarknet;

function privacyTx(kind: string, builtAt: number): IEncodedTxStarknet {
  return {
    ...baseEncodedTx,
    privacy: {
      poolAddress: POOL,
      kind,
      proofFacts: ['0xaa'],
      proof: '0xproof',
      provingBlockId: 991,
      builtAt,
    },
  } as IEncodedTxStarknet;
}

function buildVault() {
  const vault = Object.create(StarknetVault.prototype) as StarknetVault;
  const addInvokeTransaction = jest.fn(async () => ({
    transaction_hash: '0xsent',
  }));
  Object.assign(vault, {
    networkId: 'starknet--sepolia',
    accountId: 'hd-1--a',
  });
  return { vault, addInvokeTransaction };
}

async function broadcast(encodedTx: IEncodedTxStarknet) {
  const { vault, addInvokeTransaction } = buildVault();
  const signedTx = {
    txid: '0xabc',
    rawTx: JSON.stringify({
      invoke: { type: 'INVOKE' },
      invokeTxHash: '0xabc',
    }),
    encodedTx,
  };
  const promise = (
    vault as unknown as {
      _broadcast: (p: unknown) => Promise<unknown>;
    }
  )._broadcast({
    client: { addInvokeTransaction },
    signedTx,
  });
  return { promise, addInvokeTransaction };
}

describe('StarknetVault privacy build freshness', () => {
  it('refuses a deposit built outside the screening window', async () => {
    const { promise, addInvokeTransaction } = await broadcast(
      privacyTx('deposit', Date.now() - STRK20_SCREENING_WINDOW_MS - 1000),
    );

    await expect(promise).rejects.toThrow();
    expect(addInvokeTransaction).not.toHaveBeenCalled();
  });

  it('submits a deposit still inside the window', async () => {
    const { promise, addInvokeTransaction } = await broadcast(
      privacyTx('deposit', Date.now() - 1000),
    );

    await promise;
    expect(addInvokeTransaction).toHaveBeenCalledTimes(1);
  });

  it.each(['withdraw', 'transfer', 'register'])(
    'does not time-box a %s, which carries no attestation',
    async (kind) => {
      const { promise, addInvokeTransaction } = await broadcast(
        privacyTx(kind, Date.now() - STRK20_SCREENING_WINDOW_MS - 60_000),
      );

      await promise;
      expect(addInvokeTransaction).toHaveBeenCalledTimes(1);
    },
  );

  it('leaves an ordinary transparent send alone', async () => {
    const { promise, addInvokeTransaction } = await broadcast(baseEncodedTx);

    await promise;
    expect(addInvokeTransaction).toHaveBeenCalledTimes(1);
  });
});
