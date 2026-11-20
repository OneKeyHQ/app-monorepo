import { createMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

import { SimpleDbEntityEarnFunding } from './SimpleDbEntityEarnFunding';

function createFundingEntity(storage = createMemoryStorage(null)) {
  const entity = new SimpleDbEntityEarnFunding();
  Reflect.set(entity, 'appStorage', storage);
  return { entity, storage };
}

const scope = 'wallet-a|evm--1|wallet-a-base|evm--8453|vault-a';

const swapRecovery = {
  sender: {
    accountId: 'wallet-a',
    networkId: 'evm--1',
    address: '0xa',
    amount: '1',
    token: {
      networkId: 'evm--1',
      contractAddress: '0x1',
      symbol: 'A',
      decimals: 18,
    },
  },
  receiver: {
    accountId: 'wallet-b',
    networkId: 'evm--8453',
    address: '0xb',
    amount: '2',
    token: {
      networkId: 'evm--8453',
      contractAddress: '0x2',
      symbol: 'B',
      decimals: 6,
    },
  },
  provider: { provider: 'p', providerName: 'Provider' },
  useOrderId: false,
  ctx: { route: 'x' },
  currency: { id: 'usd', symbol: '$' },
  createdAt: 1,
};

it('recovers only the persisted swap UUID after a restart and rejects conflicts', async () => {
  const { entity, storage } = createFundingEntity();
  await entity.changeFunding(scope, {
    type: 'claim',
    attemptId: 'owner',
    intentAmount: '1',
    swapRecovery,
    swapTxUuid: 'swap-uuid',
  });
  const restarted = createFundingEntity(storage).entity;
  expect(
    (await restarted.recoverSwapFunding(scope, 'other', 'tx')).applied,
  ).toBe(false);
  expect((await restarted.getFunding(scope))?.status).toBe('unknown');
  expect(
    (await restarted.recoverSwapFunding(scope, 'swap-uuid', 'tx')).applied,
  ).toBe(true);
  expect(await restarted.getFunding(scope)).toEqual(
    expect.objectContaining({
      status: 'submitted',
      txId: 'tx',
      swapTxUuid: 'swap-uuid',
    }),
  );
  await restarted.changeFunding(scope, {
    type: 'submitted',
    attemptId: 'owner',
    txId: 'other-tx',
  });
  expect(
    (await restarted.recoverSwapFunding(scope, 'swap-uuid', 'tx')).applied,
  ).toBe(false);
  expect(await restarted.getFunding(scope)).toEqual(
    expect.objectContaining({ status: 'unknown', txIdConflict: true }),
  );
});

it('retains a later chain failure when the same attempt was already marked submitted', async () => {
  const { entity } = createFundingEntity();
  await entity.changeFunding(scope, {
    type: 'claim',
    attemptId: 'owner',
    swapRecovery,
    swapTxUuid: 'swap-uuid',
  });
  await entity.changeFunding(scope, {
    type: 'submitted',
    attemptId: 'owner',
    txId: 'tx',
  });
  expect(
    (await entity.recoverSwapFunding(scope, 'swap-uuid', 'tx', true)).applied,
  ).toBe(true);
  expect(await entity.getFunding(scope)).toMatchObject({
    status: 'submitted',
    txId: 'tx',
    sourceTxFailed: true,
  });
  expect(
    (
      await entity.changeFunding(scope, {
        type: 'settled',
        txId: 'tx',
        receivedAmount: '5',
      })
    ).applied,
  ).toBe(false);
  expect(await entity.getFunding(scope)).toMatchObject({
    status: 'submitted',
    txId: 'tx',
    sourceTxFailed: true,
  });
  expect(
    (await entity.recoverSwapFunding(scope, 'swap-uuid', 'other', true))
      .applied,
  ).toBe(false);
});

it('persists the swap recovery context with its claim and submitted hash across restart', async () => {
  const { entity, storage } = createFundingEntity();
  expect(
    (
      await entity.changeFunding(scope, {
        type: 'claim',
        attemptId: 'owner',
        intentAmount: '1',
        swapRecovery,
      })
    ).applied,
  ).toBe(true);
  expect(
    (
      await entity.changeFunding(scope, {
        type: 'submitted',
        attemptId: 'owner',
        txId: 'swap-tx',
      })
    ).applied,
  ).toBe(true);
  const restarted = createFundingEntity(storage).entity;
  expect(await restarted.getFunding(scope)).toEqual(
    expect.objectContaining({
      status: 'submitted',
      txId: 'swap-tx',
      swapRecovery,
    }),
  );
});

it('rejects an oversized recovery claim without damaging existing records', async () => {
  const { entity } = createFundingEntity();
  await entity.changeFunding('existing', {
    type: 'claim',
    attemptId: 'existing-owner',
  });
  expect(
    (
      await entity.changeFunding(scope, {
        type: 'claim',
        attemptId: 'owner',
        swapRecovery: { ...swapRecovery, ctx: 'x'.repeat(40_000) },
      })
    ).applied,
  ).toBe(false);
  expect(await entity.getFunding('existing')).toEqual(
    expect.objectContaining({ status: 'unknown' }),
  );
  expect(await entity.getFunding(scope)).toBeNull();
});

it('keeps conflicting broadcasts blocked with their original recovery context', async () => {
  const { entity } = createFundingEntity();
  await entity.changeFunding(scope, {
    type: 'claim',
    attemptId: 'owner',
    swapRecovery,
  });
  await entity.changeFunding(scope, {
    type: 'submitted',
    attemptId: 'owner',
    txId: 'first',
  });
  await entity.changeFunding(scope, {
    type: 'submitted',
    attemptId: 'owner',
    txId: 'second',
  });
  expect(await entity.getFunding(scope)).toEqual(
    expect.objectContaining({
      status: 'unknown',
      txIdConflict: true,
      swapRecovery,
    }),
  );
});

it('serializes distinct loan steps in one market while allowing unrelated markets', async () => {
  const { entity } = createFundingEntity();
  const group = 'lending-market-a';
  const [supply, borrow, otherMarket] = await Promise.all([
    entity.changeFunding('supply', {
      type: 'claim',
      attemptId: 'supply-action',
      group,
    }),
    entity.changeFunding('borrow', {
      type: 'claim',
      attemptId: 'direct-borrow-action',
      group,
    }),
    entity.changeFunding('other-supply', {
      type: 'claim',
      attemptId: 'other-action',
      group: 'lending-market-b',
    }),
  ]);
  expect(supply.applied).toBe(true);
  expect(borrow.applied).toBe(false);
  expect(otherMarket.applied).toBe(true);
  await entity.changeFunding('supply', {
    type: 'submitted',
    attemptId: 'supply-action',
    txId: 'supply-tx',
  });
  expect(
    (
      await entity.changeFunding('borrow', {
        type: 'claim',
        attemptId: 'early-borrow-action',
        group,
      })
    ).applied,
  ).toBe(false);
  await entity.changeFunding('supply', {
    type: 'settled',
    txId: 'supply-tx',
    receivedAmount: '1',
  });
  expect(
    (
      await entity.changeFunding('bridge', {
        type: 'claim',
        attemptId: 'late-window',
        group,
        startsGroup: true,
      })
    ).applied,
  ).toBe(false);
  expect(
    (
      await entity.changeFunding('borrow', {
        type: 'claim',
        attemptId: 'confirmed-borrow-action',
        group,
      })
    ).applied,
  ).toBe(true);
});

it('consumes a bridge receipt once the supply settles and keeps the evidence needed to borrow', async () => {
  const { entity } = createFundingEntity();
  const group = 'lending-market';
  const source = { scope: 'bridge', txId: 'bridge-tx' };
  await entity.changeFunding(source.scope, {
    type: 'claim',
    attemptId: 'bridge-window',
    group,
    startsGroup: true,
  });
  await entity.changeFunding(source.scope, {
    type: 'submitted',
    attemptId: 'bridge-window',
    txId: source.txId,
  });
  await entity.changeFunding(source.scope, {
    type: 'settled',
    txId: source.txId,
    receivedAmount: '5',
  });
  expect(
    (
      await entity.changeFunding('foreign-supply', {
        type: 'claim',
        attemptId: 'other-market',
        source,
        group: 'other-market',
      })
    ).applied,
  ).toBe(false);
  expect(
    (
      await entity.changeFunding('supply', {
        type: 'claim',
        attemptId: 'supply-window',
        source,
        group,
      })
    ).applied,
  ).toBe(true);
  await entity.changeFunding('supply', {
    type: 'submitted',
    attemptId: 'supply-window',
    txId: 'supply-tx',
  });
  const consume = {
    type: 'complete',
    txId: 'supply-tx',
    keepDestination: true,
  } as const;
  expect((await entity.changeFunding('supply', consume)).applied).toBe(false);
  await entity.changeFunding('supply', {
    type: 'settled',
    txId: 'supply-tx',
    receivedAmount: '5',
  });
  const suppliedReceipt = { scope: 'supply', txId: 'supply-tx' };
  const claimBorrow = {
    type: 'claim',
    attemptId: 'borrow-window',
    source: suppliedReceipt,
    group,
  } as const;
  expect(await entity.getFunding('supply')).toEqual(
    expect.objectContaining({ source }),
  );
  expect((await entity.changeFunding('borrow', claimBorrow)).applied).toBe(
    false,
  );
  expect((await entity.changeFunding('supply', consume)).applied).toBe(true);
  expect(await entity.getFunding(source.scope)).toBeNull();
  expect(await entity.getFunding('supply')).toEqual({
    status: 'funded',
    txId: 'supply-tx',
    receivedAmount: '5',
  });
  expect((await entity.changeFunding('supply', consume)).applied).toBe(false);
  expect((await entity.changeFunding('borrow', claimBorrow)).applied).toBe(
    true,
  );
  await entity.changeFunding('borrow', {
    type: 'submitted',
    attemptId: 'borrow-window',
    txId: 'borrow-tx',
  });
  expect(await entity.getFunding('borrow')).toEqual(
    expect.objectContaining({ status: 'submitted', source: suppliedReceipt }),
  );
  await entity.changeFunding('borrow', {
    type: 'settled',
    txId: 'borrow-tx',
    receivedAmount: '3',
  });
  expect(
    (
      await entity.changeFunding('borrow', {
        type: 'complete',
        txId: 'borrow-tx',
      })
    ).applied,
  ).toBe(true);
  expect(await entity.getFunding('borrow')).toBeNull();
  expect(await entity.getFunding('supply')).toBeNull();
});

it('allows only one continuation for a funded swap and consumes both receipts atomically', async () => {
  const { entity, storage } = createFundingEntity();
  const source = { scope, txId: 'swap-tx' };
  const depositScope = 'vault-deposit';
  const competingScope = 'other-vault-option';
  await entity.changeFunding(scope, { type: 'claim', attemptId: 'swap-owner' });
  await entity.changeFunding(scope, {
    type: 'submitted',
    attemptId: 'swap-owner',
    txId: source.txId,
  });
  await entity.changeFunding(scope, {
    type: 'settled',
    txId: source.txId,
    receivedAmount: '12.25',
  });
  const [deposit, competitor] = await Promise.all([
    entity.changeFunding(depositScope, {
      type: 'claim',
      attemptId: 'form-a',
      source,
    }),
    entity.changeFunding(competingScope, {
      type: 'claim',
      attemptId: 'form-b',
      source,
    }),
  ]);
  expect(deposit.applied).toBe(true);
  expect(competitor.applied).toBe(false);
  expect(
    (
      await entity.changeFunding(scope, {
        type: 'clear',
        txId: source.txId,
        status: 'funded',
      })
    ).applied,
  ).toBe(false);

  await entity.changeFunding(depositScope, {
    type: 'submitted',
    attemptId: 'form-a',
    txId: 'deposit-tx',
  });
  const reopened = createFundingEntity(storage).entity;
  expect(
    (
      await reopened.changeFunding(depositScope, {
        type: 'complete',
        txId: 'deposit-tx',
      })
    ).applied,
  ).toBe(false);
  expect((await reopened.getFunding(depositScope))?.status).toBe('submitted');
  expect((await reopened.getFunding(scope))?.status).toBe('funded');

  await reopened.changeFunding(depositScope, {
    type: 'settled',
    txId: 'deposit-tx',
    receivedAmount: '12.25',
  });
  expect(
    (
      await reopened.changeFunding(depositScope, {
        type: 'complete',
        txId: 'wrong-tx',
      })
    ).applied,
  ).toBe(false);

  storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(
    reopened.changeFunding(depositScope, {
      type: 'complete',
      txId: 'deposit-tx',
    }),
  ).rejects.toThrow('storage unavailable');
  expect((await reopened.getFunding(depositScope))?.status).toBe('funded');
  expect((await reopened.getFunding(scope))?.status).toBe('funded');

  expect(
    await reopened.changeFunding(depositScope, {
      type: 'complete',
      txId: 'deposit-tx',
    }),
  ).toEqual({ applied: true, funding: null, consumedScope: scope });
  expect(await reopened.getFunding(depositScope)).toBeNull();
  expect(await reopened.getFunding(scope)).toBeNull();
  expect(
    (
      await reopened.changeFunding(competingScope, {
        type: 'claim',
        attemptId: 'late-form',
        source,
      })
    ).applied,
  ).toBe(false);
});

it('releases only the reverted deposit and lets a retry use the original bridge receipt', async () => {
  const { entity } = createFundingEntity();
  const source = { scope, txId: 'swap-tx' };
  const depositScope = 'deposit';
  await entity.changeFunding(scope, { type: 'claim', attemptId: 'swap-owner' });
  await entity.changeFunding(scope, {
    type: 'submitted',
    attemptId: 'swap-owner',
    txId: source.txId,
  });
  await entity.changeFunding(scope, {
    type: 'settled',
    txId: source.txId,
    receivedAmount: '1',
  });
  await entity.changeFunding(depositScope, {
    type: 'claim',
    attemptId: 'deposit-owner',
    source,
  });
  await entity.changeFunding(depositScope, {
    type: 'submitted',
    attemptId: 'deposit-owner',
    txId: 'deposit-tx',
  });
  expect(
    (
      await entity.changeFunding(depositScope, {
        type: 'clear',
        txId: 'deposit-tx',
        status: 'submitted',
      })
    ).applied,
  ).toBe(true);
  expect(await entity.getFunding(scope)).toEqual({
    status: 'funded',
    txId: source.txId,
    receivedAmount: '1',
  });
  expect(
    (
      await entity.changeFunding(depositScope, {
        type: 'claim',
        attemptId: 'retry-deposit-owner',
        source,
      })
    ).applied,
  ).toBe(true);
});

it('admits just one concurrent claim and recovers the immutable amount after restart', async () => {
  const { entity, storage } = createFundingEntity();
  const [first, second] = await Promise.all([
    entity.changeFunding(scope, {
      type: 'claim',
      attemptId: 'window-a',
      intentAmount: '12.25',
      positionBefore: '0',
    }),
    entity.changeFunding(scope, {
      type: 'claim',
      attemptId: 'window-b',
      intentAmount: '50',
    }),
  ]);
  expect(first.applied).toBe(true);
  expect(second.applied).toBe(false);
  await entity.changeFunding(scope, {
    type: 'cancelled',
    attemptId: 'window-b',
  });
  await entity.changeFunding(scope, {
    type: 'submitted',
    attemptId: 'window-a',
    txId: 'tx-a',
  });

  const reopened = createFundingEntity(storage).entity;
  expect(await reopened.getFunding(scope)).toEqual({
    status: 'submitted',
    txId: 'tx-a',
    intentAmount: '12.25',
    positionBefore: '0',
  });
  expect(await reopened.getFunding('other-wallet')).toBeNull();
  expect(
    (
      await reopened.changeFunding(scope, {
        type: 'settled',
        txId: 'tx-b',
        receivedAmount: '50',
      })
    ).applied,
  ).toBe(false);
  expect(
    (
      await reopened.changeFunding(scope, {
        type: 'cancelled',
        attemptId: 'window-a',
      })
    ).applied,
  ).toBe(false);
  expect(
    (
      await reopened.changeFunding(scope, {
        type: 'settled',
        txId: 'tx-a',
        receivedAmount: '10',
      })
    ).funding,
  ).toEqual({
    status: 'funded',
    txId: 'tx-a',
    receivedAmount: '10',
    intentAmount: '12.25',
    positionBefore: '0',
  });
  expect(
    (
      await reopened.changeFunding(scope, {
        type: 'clear',
        txId: 'tx-a',
        status: 'submitted',
      })
    ).applied,
  ).toBe(false);
  expect(
    (
      await reopened.changeFunding(scope, {
        type: 'clear',
        txId: 'tx-a',
        status: 'funded',
      })
    ).applied,
  ).toBe(true);
});

it('keeps an ambiguous receipt blocked even if the first transaction later settles', async () => {
  const { entity } = createFundingEntity();
  await entity.changeFunding(scope, { type: 'claim', attemptId: 'owner' });
  await entity.changeFunding(scope, {
    type: 'submitted',
    attemptId: 'owner',
    txId: 'tx-a',
  });
  await entity.changeFunding(scope, {
    type: 'submitted',
    attemptId: 'owner',
    txId: 'tx-b',
  });
  await entity.changeFunding(scope, {
    type: 'settled',
    txId: 'tx-a',
    receivedAmount: '12.25',
  });
  expect(await entity.getFunding(scope)).toEqual({
    status: 'unknown',
    txIdConflict: true,
  });
  expect(
    (
      await entity.changeFunding(scope, {
        type: 'cancelled',
        attemptId: 'owner',
      })
    ).applied,
  ).toBe(false);
  expect(
    (
      await entity.changeFunding(scope, {
        type: 'claim',
        attemptId: 'new-owner',
      })
    ).applied,
  ).toBe(false);
});

it('waits for storage to acknowledge a claim and propagates failure before sending', async () => {
  const { entity, storage } = createFundingEntity();
  storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(
    entity.changeFunding(scope, { type: 'claim', attemptId: 'owner' }),
  ).rejects.toThrow('storage unavailable');
  expect(await entity.getFunding(scope)).toBeNull();
});

it('keeps unreadable data intact and refuses to send when existing state cannot be read', async () => {
  const { entity, storage } = createFundingEntity(
    createMemoryStorage('{broken state'),
  );
  await expect(
    entity.changeFunding(scope, { type: 'claim', attemptId: 'owner' }),
  ).rejects.toThrow('invalid persisted data');
  expect(storage.value).toBe('{broken state');
});
