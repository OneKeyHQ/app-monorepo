import { createBorrowCollateralRepayTask } from './borrowCollateralRepayTask';

const identity = {
  accountId: 'account',
  accountAddress: 'owner',
  networkId: 'sol--101',
  provider: 'kamino',
  action: 'repayWithCollateral' as const,
  intent: { amount: '1' },
};

it('runs setup, preserves pending finality, then uses a fresh quote in one task', async () => {
  const calls: string[] = [];
  const owner = {
    isCurrent: () => true,
    verify: async () => undefined,
    buildSetup: async () => {
      calls.push('build-setup');
      return { tx: 'setup', orderId: 'setup-order' };
    },
    confirmSetup: async ({
      onBeforeSend,
      onConfirmed,
    }: {
      onBeforeSend: () => Promise<void>;
      onConfirmed: (txid: string) => Promise<void>;
    }) => {
      calls.push('confirm-setup');
      await onBeforeSend();
      await onConfirmed('setup-tx');
      return true;
    },
    recordSetup: async () => {
      calls.push('record-setup');
      return 'remoteUnknown' as const;
    },
    finality: async () => {
      calls.push('finality');
      return 'timeout' as const;
    },
    propagate: async () => {
      calls.push('propagate');
    },
    quote: async () => {
      calls.push('quote');
      return {
        routeKey: 'fresh',
        swapIn: '2',
        router: 'router',
        swapInReserveAddress: 'reserve',
        minimalExpectedSwapOut: '1',
        minimalExpectedSwapOutSymbol: 'USDC',
        fillPrice: '1',
        maxPriceImpact: '0',
      };
    },
    buildRepay: async (
      _intent: { amount: string },
      quote: { routeKey?: string } | undefined,
    ) => {
      calls.push(`build-repay:${quote?.routeKey}`);
      return { tx: 'repay', orderId: 'repay-order' };
    },
    confirmRepay: async ({
      onBeforeSend,
      onConfirmed,
    }: {
      onBeforeSend: () => Promise<void>;
      onConfirmed: (txid: string) => Promise<void>;
    }) => {
      calls.push('confirm-repay');
      await onBeforeSend();
      await onConfirmed('repay-tx');
      return true;
    },
  };
  const task = createBorrowCollateralRepayTask({
    identity,
    onAsyncError: jest.fn(),
  });
  const token = task.attachOwner(owner);
  await task.run(token);
  expect(calls).toEqual([
    'build-setup',
    'confirm-setup',
    'record-setup',
    'finality',
    'propagate',
    'quote',
    'build-repay:fresh',
    'confirm-repay',
  ]);
  expect(task.getTask().facts).toEqual(
    expect.objectContaining({
      recording: 'remoteUnknown',
      finality: 'pending',
    }),
  );
  expect(task.getTask().steps.at(-1)?.status).toEqual({
    type: 'handedOff',
    txid: 'repay-tx',
  });
  task.detachOwner(token);
  const next = createBorrowCollateralRepayTask({
    identity: { ...identity, intent: { amount: '2' } },
    onAsyncError: jest.fn(),
    preparation: 'freshQuote',
    predecessor: task,
  });
  const nextToken = next.attachOwner(owner);
  await next.run(nextToken);
  expect(calls.filter((call) => call === 'build-setup')).toHaveLength(1);
  expect(calls.filter((call) => call === 'record-setup')).toHaveLength(1);
  expect(calls.filter((call) => call === 'quote')).toHaveLength(2);
  let release: () => void = () => undefined;
  const delayed = new Promise<'timeout'>((resolve) => {
    release = () => resolve('timeout');
  });
  const firstRefresh = task.refreshSetupFinality({
    isCurrent: () => true,
    verify: async () => undefined,
    finality: async () => delayed,
  });
  await expect(
    task.refreshSetupFinality({
      isCurrent: () => true,
      verify: async () => undefined,
      finality: async () => 'finalized',
    }),
  ).resolves.toBe('confirmed');
  release();
  await expect(firstRefresh).resolves.toBe('confirmed');
  expect(task.getTask().facts?.finality).toBe('confirmed');
});

it('retries only a local failure before remote submission and does not rebuild setup', async () => {
  const buildSetup = jest.fn(async () => ({
    tx: 'setup',
    orderId: 'setup-order',
  }));
  const recordSetup = jest
    .fn()
    .mockResolvedValueOnce('localFailed')
    .mockResolvedValueOnce('saved');
  const finality = jest.fn(async () => 'finalized' as const);
  const quote = jest.fn(async () => ({
    routeKey: 'fresh',
    swapIn: '2',
    router: 'router',
    swapInReserveAddress: 'reserve',
    minimalExpectedSwapOut: '1',
    minimalExpectedSwapOutSymbol: 'USDC',
    fillPrice: '1',
    maxPriceImpact: '0',
  }));
  const owner = {
    isCurrent: () => true,
    verify: async () => undefined,
    buildSetup,
    confirmSetup: async ({
      onBeforeSend,
      onConfirmed,
    }: {
      onBeforeSend: () => Promise<void>;
      onConfirmed: (txid: string) => Promise<void>;
    }) => {
      await onBeforeSend();
      await onConfirmed('setup-tx');
      return true;
    },
    recordSetup,
    finality,
    propagate: async () => undefined,
    quote,
    buildRepay: async () => ({ tx: 'repay' }),
    confirmRepay: async ({
      onBeforeSend,
      onConfirmed,
    }: {
      onBeforeSend: () => Promise<void>;
      onConfirmed: (txid: string) => Promise<void>;
    }) => {
      await onBeforeSend();
      await onConfirmed('repay-tx');
      return true;
    },
  };
  const task = createBorrowCollateralRepayTask({
    identity,
    onAsyncError: jest.fn(),
  });
  const token = task.attachOwner(owner);
  await task.run(token);
  expect(task.getTask().facts?.recording).toBe('localFailed');
  expect(finality).not.toHaveBeenCalled();
  await Promise.all([task.retryRecording(token), task.retryRecording(token)]);
  expect(recordSetup).toHaveBeenCalledTimes(2);
  expect(task.getTask().facts?.recording).toBe('saved');
  await expect(task.tryRetryWait(token)).resolves.toBe('started');
  expect(buildSetup).toHaveBeenCalledTimes(1);
  expect(quote).toHaveBeenCalledTimes(1);
});
