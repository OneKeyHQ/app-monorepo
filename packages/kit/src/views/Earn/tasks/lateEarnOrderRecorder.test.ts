import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  createLateEarnOrderObserver,
  createLateEarnOrderRecorder,
} from './lateEarnOrderRecorder';

const mockAddOrder = jest.fn<Promise<unknown>, [unknown, unknown]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      addEarnOrder: (order: unknown, options: unknown) =>
        mockAddOrder(order, options),
    },
  },
}));

const fact = {
  uuid: 'uuid',
  accountId: 'old-account',
  networkId: 'evm--1',
  txid: 'txid',
};
const stakeInfo = {
  orderId: 'order-id',
  label: EEarnLabels.Withdraw,
  protocol: 'protocol',
  tags: ['tag'],
};
const args = { fact, accountId: 'old-account', networkId: 'evm--1', stakeInfo };

beforeEach(() => mockAddOrder.mockReset());

it('only records a verified fact accepted by the original task attempt', async () => {
  mockAddOrder.mockResolvedValue({
    localStatus: 'saved',
    remoteStatus: 'synced',
  });
  const onAccepted = jest.fn(() => true);
  const onError = jest.fn();
  const observe = createLateEarnOrderObserver({
    accountId: fact.accountId,
    networkId: fact.networkId,
    onError,
  });
  await observe({
    fact: { ...fact, accountId: 'other' },
    stakeInfo,
    onAccepted,
  });
  expect(onAccepted).not.toHaveBeenCalled();
  await observe({ fact, stakeInfo, onAccepted: () => false });
  expect(mockAddOrder).not.toHaveBeenCalled();
  await observe({ fact, stakeInfo, onAccepted });
  expect(mockAddOrder).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
});

it('records the accepted transaction for the bound original account without a synthetic signature', async () => {
  mockAddOrder.mockResolvedValue({
    localStatus: 'saved',
    remoteStatus: 'synced',
  });
  const record = createLateEarnOrderRecorder();
  await expect(record(args)).resolves.toBe('synced');
  expect(mockAddOrder).toHaveBeenCalledWith(
    {
      orderId: 'order-id',
      networkId: 'evm--1',
      txId: 'txid',
      status: EDecodedTxStatus.Pending,
      stakingLabel: EEarnLabels.Withdraw,
      stakingProtocol: 'protocol',
      stakingTags: ['tag'],
    },
    { remoteSync: 'once', preserveExistingTx: true },
  );
});

it.each([
  { accountId: 'other', networkId: 'evm--1', fact },
  { accountId: 'old-account', networkId: 'evm--10', fact },
  {
    accountId: 'old-account',
    networkId: 'evm--1',
    fact: { ...fact, uuid: '' },
  },
  {
    accountId: 'old-account',
    networkId: 'evm--1',
    fact: { ...fact, txid: '' },
  },
])('rejects an unbound transaction identity', async (input) => {
  const record = createLateEarnOrderRecorder();
  await expect(record({ ...input, stakeInfo })).resolves.toBe(
    'identityMismatch',
  );
  expect(mockAddOrder).not.toHaveBeenCalled();
});

it('does not create an order without an order id', async () => {
  const record = createLateEarnOrderRecorder();
  await expect(
    record({ ...args, stakeInfo: { ...stakeInfo, orderId: undefined } }),
  ).resolves.toBe('notTracked');
  expect(mockAddOrder).not.toHaveBeenCalled();
});

it('retains an order conflict without retrying the remote registration', async () => {
  mockAddOrder.mockResolvedValue({
    localStatus: 'existing',
    remoteStatus: 'skipped',
  });
  const record = createLateEarnOrderRecorder();
  await expect(record(args)).resolves.toBe('existingOrder');
  await expect(record(args)).resolves.toBe('existingOrder');
  expect(mockAddOrder).toHaveBeenCalledTimes(1);
});

it('records an independent order id without staking metadata', async () => {
  mockAddOrder.mockResolvedValue({
    localStatus: 'saved',
    remoteStatus: 'synced',
  });
  const record = createLateEarnOrderRecorder();
  await expect(
    record({
      fact,
      accountId: fact.accountId,
      networkId: fact.networkId,
      orderId: 'borrow-order',
    }),
  ).resolves.toBe('synced');
  expect(mockAddOrder).toHaveBeenCalledWith(
    {
      orderId: 'borrow-order',
      networkId: fact.networkId,
      txId: fact.txid,
      status: EDecodedTxStatus.Pending,
      stakingLabel: undefined,
      stakingProtocol: undefined,
      stakingTags: undefined,
    },
    { remoteSync: 'once', preserveExistingTx: true },
  );
});

it('rejects conflicting order ids without writing or poisoning the valid order', async () => {
  mockAddOrder.mockResolvedValue({
    localStatus: 'saved',
    remoteStatus: 'synced',
  });
  const record = createLateEarnOrderRecorder();
  await expect(record({ ...args, orderId: 'other-order' })).resolves.toBe(
    'orderMismatch',
  );
  expect(mockAddOrder).not.toHaveBeenCalled();
  await expect(record({ ...args, orderId: 'order-id' })).resolves.toBe(
    'synced',
  );
  await expect(record(args)).resolves.toBe('synced');
  expect(mockAddOrder).toHaveBeenCalledTimes(1);
});

it('accepts an independent order id when metadata has no order id', async () => {
  mockAddOrder.mockResolvedValue({
    localStatus: 'saved',
    remoteStatus: 'synced',
  });
  const record = createLateEarnOrderRecorder();
  await expect(
    record({
      ...args,
      orderId: 'borrow-order',
      stakeInfo: { ...stakeInfo, orderId: undefined },
    }),
  ).resolves.toBe('synced');
  expect(mockAddOrder).toHaveBeenCalledWith(
    expect.objectContaining({
      orderId: 'borrow-order',
      stakingProtocol: 'protocol',
    }),
    { remoteSync: 'once', preserveExistingTx: true },
  );
});

it('shares concurrent and repeated accepted facts without repeating the remote request', async () => {
  let resolve: (result: unknown) => void = () => undefined;
  mockAddOrder.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const record = createLateEarnOrderRecorder();
  const first = record(args);
  const second = record(args);
  expect(mockAddOrder).toHaveBeenCalledTimes(1);
  resolve({ localStatus: 'saved', remoteStatus: 'synced' });
  await expect(Promise.all([first, second])).resolves.toEqual([
    'synced',
    'synced',
  ]);
  await expect(record(args)).resolves.toBe('synced');
  expect(mockAddOrder).toHaveBeenCalledTimes(1);
});

it.each([
  [{ localStatus: 'failed', remoteStatus: 'notAttempted' }, 'localFailed'],
  [
    { localStatus: 'unavailable', remoteStatus: 'notAttempted' },
    'localUnavailable',
  ],
] as const)('allows an explicit retry after %s', async (failure, expected) => {
  mockAddOrder
    .mockResolvedValueOnce(failure)
    .mockResolvedValueOnce({ localStatus: 'saved', remoteStatus: 'synced' });
  const record = createLateEarnOrderRecorder();
  await expect(record(args)).resolves.toBe(expected);
  expect(mockAddOrder).toHaveBeenCalledTimes(1);
  await expect(record(args)).resolves.toBe('synced');
  expect(mockAddOrder).toHaveBeenCalledTimes(2);
});

it.each([
  [{ localStatus: 'saved', remoteStatus: 'failed' }, 'remoteUnknown'],
  [{ localStatus: 'superseded', remoteStatus: 'skipped' }, 'superseded'],
] as const)(
  'retains the outcome %s without another remote request',
  async (outcome, expected) => {
    mockAddOrder.mockResolvedValue(outcome);
    const record = createLateEarnOrderRecorder();
    await expect(record(args)).resolves.toBe(expected);
    await expect(record(args)).resolves.toBe(expected);
    expect(mockAddOrder).toHaveBeenCalledTimes(1);
  },
);

it('does not retry an ambiguous transport exception', async () => {
  mockAddOrder.mockRejectedValue(new Error('transport lost'));
  const record = createLateEarnOrderRecorder();
  await expect(record(args)).resolves.toBe('remoteUnknown');
  await expect(record(args)).resolves.toBe('remoteUnknown');
  expect(mockAddOrder).toHaveBeenCalledTimes(1);
});
