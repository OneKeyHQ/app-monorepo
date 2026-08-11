/*
yarn jest packages/kit-bg/src/services/ServiceBatchTxSign.test.ts

Covers the background batch-sign orchestrator: sequential signing, resume
after a stop, drill-down (markItemSigned) skip, mid-flight cancellation, and
the concurrent-call guard. All items use autoFinalized:false so
takeFinalizedResults never needs a real psbt network / finalizer, keeping the
suite free of bitcoinjs-lib fixtures.
*/

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('../states/jotai/atoms', () => ({
  batchTxSignAtom: { set: jest.fn() },
}));

// eslint-disable-next-line import-js/order, import/first
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
// eslint-disable-next-line import-js/order, import/first
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
// eslint-disable-next-line import-js/order, import/first
import {
  EBatchTxSignItemStatus,
  EBatchTxSignStatus,
} from '@onekeyhq/shared/types/batchTxSign';
// eslint-disable-next-line import-js/order, import/first
import type { IBatchTxSignCreateItem } from './ServiceBatchTxSign';
// eslint-disable-next-line import-js/order, import/first
import ServiceBatchTxSign from './ServiceBatchTxSign';

const accountId = 'hd-1--btc--0';
const networkId = 'btc--0';

// Each fixture unsignedTx carries a `marker` so the mocked signTransaction
// can identify which item it was called for and echo it back deterministically.
function makeUnsignedTx(marker: string): IUnsignedTxPro {
  return {
    encodedTx: {},
    payload: { marker },
  } as unknown as IUnsignedTxPro;
}

function getMarker(unsignedTx: IUnsignedTxPro): string {
  return (unsignedTx.payload as { marker: string }).marker;
}

function makeItem(index: number): IBatchTxSignCreateItem {
  return {
    unsignedTx: makeUnsignedTx(`psbt-${index}`),
    summary: {
      index,
      recipient: `bc1q-recipient-${index}`,
      extraRecipientCount: 0,
      amountValue: '1000',
      feeValue: '100',
      status: EBatchTxSignItemStatus.Ready,
    },
    inputsToSign: [{ index: 0 }],
    autoFinalized: false,
  };
}

function makeItems(count: number): IBatchTxSignCreateItem[] {
  return Array.from({ length: count }, (_, index) => makeItem(index));
}

async function defaultSignTransaction({
  unsignedTx,
}: {
  unsignedTx: IUnsignedTxPro;
}): Promise<ISignedTxPro> {
  return {
    txid: '',
    rawTx: '',
    encodedTx: null,
    psbtHex: `signed-${getMarker(unsignedTx)}`,
  };
}

function makeService(
  signTransactionImpl: (params: {
    unsignedTx: IUnsignedTxPro;
  }) => Promise<ISignedTxPro> = defaultSignTransaction,
) {
  const signTransaction = jest.fn(signTransactionImpl);
  const getNetwork = jest.fn();
  const backgroundApi = {
    serviceSend: { signTransaction },
    serviceNetwork: { getNetwork },
  };
  const service = new ServiceBatchTxSign({ backgroundApi } as any);
  return { service, backgroundApi, signTransaction, getNetwork };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('ServiceBatchTxSign', () => {
  test('signs remaining items sequentially and completes', async () => {
    const { service, signTransaction } = makeService();
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(3),
    });

    await service.signRemaining({ batchId });

    const progress = await service.getBatchProgress({ batchId });
    expect(progress.status).toBe(EBatchTxSignStatus.Complete);
    expect(progress.items.map((item) => item.status)).toEqual([
      EBatchTxSignItemStatus.Signed,
      EBatchTxSignItemStatus.Signed,
      EBatchTxSignItemStatus.Signed,
    ]);
    expect(signTransaction).toHaveBeenCalledTimes(3);

    const results = await service.takeFinalizedResults({ batchId });
    expect(results).toEqual([
      'signed-psbt-0',
      'signed-psbt-1',
      'signed-psbt-2',
    ]);
  });

  test('stops the queue when an item fails', async () => {
    const { service, signTransaction } = makeService(async ({ unsignedTx }) => {
      if (getMarker(unsignedTx) === 'psbt-1') {
        throw new OneKeyLocalError('device rejected');
      }
      return defaultSignTransaction({ unsignedTx });
    });
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(3),
    });

    await expect(service.signRemaining({ batchId })).rejects.toThrow(
      'device rejected',
    );

    const progress = await service.getBatchProgress({ batchId });
    expect(progress.status).toBe(EBatchTxSignStatus.Stopped);
    expect(progress.items.map((item) => item.status)).toEqual([
      EBatchTxSignItemStatus.Signed,
      EBatchTxSignItemStatus.Failed,
      EBatchTxSignItemStatus.Ready,
    ]);
    expect(progress.currentIndex).toBeUndefined();
    expect(signTransaction).toHaveBeenCalledTimes(2);

    await expect(service.takeFinalizedResults({ batchId })).rejects.toThrow();
  });

  test('resumes after a stop and only re-signs unsigned items', async () => {
    let failFirstAttempt = true;
    const { service, signTransaction } = makeService(async ({ unsignedTx }) => {
      if (getMarker(unsignedTx) === 'psbt-1' && failFirstAttempt) {
        failFirstAttempt = false;
        throw new OneKeyLocalError('device rejected');
      }
      return defaultSignTransaction({ unsignedTx });
    });
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(3),
    });

    await expect(service.signRemaining({ batchId })).rejects.toThrow(
      'device rejected',
    );
    await service.signRemaining({ batchId });

    const callMarkers = signTransaction.mock.calls.map(([params]) =>
      getMarker(params.unsignedTx),
    );
    expect(callMarkers).toEqual(['psbt-0', 'psbt-1', 'psbt-1', 'psbt-2']);

    const progress = await service.getBatchProgress({ batchId });
    expect(progress.status).toBe(EBatchTxSignStatus.Complete);

    const results = await service.takeFinalizedResults({ batchId });
    expect(results).toEqual([
      'signed-psbt-0',
      'signed-psbt-1',
      'signed-psbt-2',
    ]);
  });

  test('markItemSigned records a drill-down signature and signRemaining skips it', async () => {
    const { service, signTransaction } = makeService();
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });

    await service.markItemSigned({
      batchId,
      index: 0,
      signedPsbtHex: 'signed-by-drilldown',
    });

    await service.signRemaining({ batchId });

    expect(signTransaction).toHaveBeenCalledTimes(1);

    const results = await service.takeFinalizedResults({ batchId });
    expect(results).toEqual(['signed-by-drilldown', 'signed-psbt-1']);
  });

  test('cancelBatch mid-flight drops the in-flight signature', async () => {
    const { service, signTransaction } = makeService();
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });

    signTransaction.mockImplementation(async ({ unsignedTx }) => {
      if (getMarker(unsignedTx) === 'psbt-0') {
        await service.cancelBatch({ batchId });
      }
      return defaultSignTransaction({ unsignedTx });
    });

    await service.signRemaining({ batchId });

    const progress = await service.getBatchProgress({ batchId });
    expect(progress.status).toBe(EBatchTxSignStatus.Cancelled);
    expect(signTransaction).toHaveBeenCalledTimes(1);

    await expect(service.takeFinalizedResults({ batchId })).rejects.toThrow();
  });

  test('disposeBatch after takeFinalizedResults is a no-op', async () => {
    const { service } = makeService();
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(1),
    });

    await service.signRemaining({ batchId });
    await service.takeFinalizedResults({ batchId });

    await expect(service.disposeBatch({ batchId })).resolves.toBeUndefined();
    await expect(service.getBatchProgress({ batchId })).rejects.toThrow();
  });

  test('rejects a concurrent signRemaining call while one is in-flight', async () => {
    const deferred = createDeferred<ISignedTxPro>();
    const { service } = makeService(async () => deferred.promise);
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });

    const firstCall = service.signRemaining({ batchId });

    await expect(service.signRemaining({ batchId })).rejects.toThrow(
      'already in progress',
    );

    deferred.resolve({
      txid: '',
      rawTx: '',
      encodedTx: null,
      psbtHex: 'signed-psbt-0',
    });
    await firstCall;
  });
});
