/*
yarn jest packages/kit-bg/src/services/ServiceBatchTxSign.test.ts

Covers the background batch-sign orchestrator: sequential signing, resume
after a stop, drill-down (markItemSigned) skip, mid-flight cancellation, the
concurrent-call guard, the confirm-time precheck gate, the once-per-batch
password prompt, and takeFinalizedResults retry-ability. All items use autoFinalized:false so
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

// Backs the mocked atom with a real get/set pair (rather than a bare
// jest.fn()) so tests can assert on clearAtomIfOwnedBy's ownership check and
// on whether a given signRemaining branch published at all. Everything the
// factory needs is created inside it (a closure variable), since jest.mock()
// calls are hoisted above any outer const/let — referencing an outer
// variable here would hit the temporal dead zone.
jest.mock('../states/jotai/atoms', () => {
  let current: unknown;
  return {
    batchTxSignAtom: {
      set: jest.fn(async (value: unknown) => {
        current = value;
      }),
      get: jest.fn(async () => current),
    },
  };
});

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
import { batchTxSignAtom } from '../states/jotai/atoms';
// eslint-disable-next-line import-js/order, import/first
import type { IBatchTxSignCreateItem } from './ServiceBatchTxSign';
// eslint-disable-next-line import-js/order, import/first
import ServiceBatchTxSign from './ServiceBatchTxSign';

const mockAtomSet = batchTxSignAtom.set as unknown as jest.Mock;

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
      externalAmountValue: '1000',
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
  const precheckUnsignedTxs = jest.fn(async () => undefined);
  const buildDecodedTx = jest.fn(async ({ unsignedTx }) => ({
    decodedFor: getMarker(unsignedTx as IUnsignedTxPro),
  }));
  const addItemFromSendProcess = jest.fn(async () => undefined);
  const getNetwork = jest.fn();
  const promptPasswordVerifyByAccount = jest.fn(async () => ({
    password: 'encoded-password',
    isHardware: false,
    isQrWallet: false,
    deviceParams: undefined,
  }));
  const backgroundApi = {
    serviceSend: { signTransaction, precheckUnsignedTxs, buildDecodedTx },
    serviceSignature: { addItemFromSendProcess },
    serviceNetwork: { getNetwork },
    servicePassword: {
      promptPasswordVerifyByAccount,
    },
  };
  const service = new ServiceBatchTxSign({ backgroundApi } as any);
  return {
    service,
    backgroundApi,
    signTransaction,
    precheckUnsignedTxs,
    buildDecodedTx,
    addItemFromSendProcess,
    getNetwork,
    promptPasswordVerifyByAccount,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ServiceBatchTxSign', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

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

  test('signRemaining records each directly-signed item into the signature history', async () => {
    const { service, buildDecodedTx, addItemFromSendProcess } = makeService();
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });
    const sourceInfo = { origin: 'https://dapp.example' } as any;

    // Drill-down item: recorded by its own TxConfirm flow, so signRemaining
    // must NOT record it a second time.
    await service.markItemSigned({
      batchId,
      index: 0,
      signedPsbtHex: 'signed-by-drilldown',
    });

    await service.signRemaining({ batchId, sourceInfo });

    expect(buildDecodedTx).toHaveBeenCalledTimes(1);
    expect(addItemFromSendProcess).toHaveBeenCalledTimes(1);
    expect(addItemFromSendProcess).toHaveBeenCalledWith(
      {
        signedTx: expect.objectContaining({ psbtHex: 'signed-psbt-1' }),
        decodedTx: { decodedFor: 'psbt-1' },
      },
      sourceInfo,
    );
  });

  test('a signature-record failure never fails the batch', async () => {
    const { service, addItemFromSendProcess } = makeService();
    addItemFromSendProcess.mockRejectedValue(new Error('record failed'));
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });

    await service.signRemaining({ batchId });

    const progress = await service.getBatchProgress({ batchId });
    expect(progress.status).toBe(EBatchTxSignStatus.Complete);
    expect(progress.signedCount).toBe(2);
  });

  test('markItemSigned rejects an empty signedPsbtHex', async () => {
    const { service } = makeService();
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(1),
    });

    await expect(
      service.markItemSigned({ batchId, index: 0, signedPsbtHex: '' }),
    ).rejects.toThrow('invalid markItemSigned call');
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
    // The in-flight item's signature must never land: signedCount stays 0
    // rather than the item reading Signed with no recorded hex.
    expect(progress.signedCount).toBe(0);
    expect(signTransaction).toHaveBeenCalledTimes(1);

    await expect(service.takeFinalizedResults({ batchId })).rejects.toThrow();
  });

  test('cancelBatch during the confirm precheck keeps the batch terminally cancelled', async () => {
    const { service, signTransaction, precheckUnsignedTxs } = makeService();
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });
    // Cancellation arrives while the precheck (a network call) is in-flight —
    // before any status mutation of this signing attempt.
    precheckUnsignedTxs.mockImplementation(async () => {
      await service.cancelBatch({ batchId });
    });

    await service.signRemaining({ batchId });

    expect(signTransaction).not.toHaveBeenCalled();
    const progress = await service.getBatchProgress({ batchId });
    expect(progress.status).toBe(EBatchTxSignStatus.Cancelled);
    // The only published snapshot is cancelBatch's own; signRemaining must
    // never resurrect the batch into a Signing publish.
    expect(mockAtomSet).toHaveBeenCalledTimes(1);
    expect((mockAtomSet.mock.calls[0][0] as { status: unknown }).status).toBe(
      EBatchTxSignStatus.Cancelled,
    );
  });

  test('disposeBatch during the password prompt never signs nor publishes', async () => {
    const { service, signTransaction, promptPasswordVerifyByAccount } =
      makeService();
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });
    // The extension popup dies right after Sign all: the provider's finally
    // disposes the batch while the password prompt is still up.
    promptPasswordVerifyByAccount.mockImplementation(async () => {
      await service.disposeBatch({ batchId });
      return {
        password: 'encoded-password',
        isHardware: false,
        isQrWallet: false,
        deviceParams: undefined,
      };
    });

    await service.signRemaining({ batchId });

    expect(signTransaction).not.toHaveBeenCalled();
    // No zombie snapshot for the deleted batch.
    expect(mockAtomSet).not.toHaveBeenCalled();
    await expect(service.getBatchProgress({ batchId })).rejects.toThrow(
      'unknown batchId',
    );
  });

  test('cancelBatch after partial progress resets signed items and reports signedCount 0', async () => {
    const { service } = makeService();
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(3),
    });

    // Sign one item via drill-down before cancelling the rest of the batch.
    await service.markItemSigned({
      batchId,
      index: 0,
      signedPsbtHex: 'signed-by-drilldown',
    });

    await service.cancelBatch({ batchId });

    const progress = await service.getBatchProgress({ batchId });
    expect(progress.status).toBe(EBatchTxSignStatus.Cancelled);
    expect(progress.signedCount).toBe(0);
    expect(progress.items.map((item) => item.status)).toEqual([
      EBatchTxSignItemStatus.Ready,
      EBatchTxSignItemStatus.Ready,
      EBatchTxSignItemStatus.Ready,
    ]);
  });

  test('treats a signed result missing psbtHex as a signing failure', async () => {
    const { service, signTransaction } = makeService(async ({ unsignedTx }) => {
      if (getMarker(unsignedTx) === 'psbt-0') {
        return { txid: '', rawTx: '', encodedTx: null };
      }
      return defaultSignTransaction({ unsignedTx });
    });
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });

    await expect(service.signRemaining({ batchId })).rejects.toThrow(
      'signed tx missing psbtHex',
    );

    const progress = await service.getBatchProgress({ batchId });
    expect(progress.status).toBe(EBatchTxSignStatus.Stopped);
    expect(progress.items[0].status).toBe(EBatchTxSignItemStatus.Failed);
    expect(progress.items[0].errorMessage).toBe('signed tx missing psbtHex');
    expect(signTransaction).toHaveBeenCalledTimes(1);

    await expect(service.takeFinalizedResults({ batchId })).rejects.toThrow();
  });

  test('disposeBatch while an item is in-flight prevents a zombie atom publish', async () => {
    const inFlight = createDeferred<ISignedTxPro>();
    const started = createDeferred<void>();
    const { service, signTransaction } = makeService(async () => {
      started.resolve();
      return inFlight.promise;
    });
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });

    const signPromise = service.signRemaining({ batchId });
    await started.promise;

    const callsBeforeDispose = mockAtomSet.mock.calls.length;
    await service.disposeBatch({ batchId });
    const callsAfterDispose = mockAtomSet.mock.calls.length;
    // dispose itself publishes the clear (once ownership is confirmed).
    expect(callsAfterDispose).toBeGreaterThan(callsBeforeDispose);

    // The in-flight item now completes successfully at the device, after the
    // batch has already been disposed.
    inFlight.resolve({
      txid: '',
      rawTx: '',
      encodedTx: null,
      psbtHex: 'signed-psbt-0',
    });
    await expect(signPromise).resolves.toBeUndefined();

    // No further atom writes: the completion must see Cancelled and drop
    // the signature instead of publishing into the now-deleted batch.
    expect(mockAtomSet.mock.calls.length).toBe(callsAfterDispose);
    expect(signTransaction).toHaveBeenCalledTimes(1);
  });

  test('disposeBatch while an item is in-flight, then the call rejects, does not overwrite Cancelled', async () => {
    const inFlight = createDeferred<ISignedTxPro>();
    const started = createDeferred<void>();
    const { service, signTransaction } = makeService(async () => {
      started.resolve();
      return inFlight.promise;
    });
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });

    const signPromise = service.signRemaining({ batchId });
    await started.promise;

    const callsBeforeDispose = mockAtomSet.mock.calls.length;
    await service.disposeBatch({ batchId });
    const callsAfterDispose = mockAtomSet.mock.calls.length;
    expect(callsAfterDispose).toBeGreaterThan(callsBeforeDispose);

    // The common failure shape: the in-flight call rejects (device rejection
    // / transport drop) after the extension popup already died and disposed
    // the batch.
    inFlight.reject(new OneKeyLocalError('device disconnected'));

    await expect(signPromise).rejects.toThrow('device disconnected');

    // Cancelled must not be overwritten by Stopped, and no zombie snapshot
    // gets published for the already-deleted batch.
    expect(mockAtomSet.mock.calls.length).toBe(callsAfterDispose);
    expect(signTransaction).toHaveBeenCalledTimes(1);
  });

  test('disposeBatch only clears the atom when it still owns the published progress', async () => {
    const { service: serviceA } = makeService();
    const { batchId: batchIdA } = await serviceA.createBatch({
      accountId,
      networkId,
      items: makeItems(1),
    });
    await serviceA.signRemaining({ batchId: batchIdA });

    // A second, independent batch becomes the most recently published
    // progress after batch A's.
    const { service: serviceB } = makeService();
    const { batchId: batchIdB } = await serviceB.createBatch({
      accountId,
      networkId,
      items: makeItems(1),
    });
    await serviceB.signRemaining({ batchId: batchIdB });

    await serviceA.disposeBatch({ batchId: batchIdA });

    const current = await batchTxSignAtom.get();
    expect(current?.batchId).toBe(batchIdB);
  });

  test('createBatch does not publish to the shared atom slot', async () => {
    const { service } = makeService();
    await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });

    // Another batch's page may still be live when this batch is created;
    // the first publish must wait until this batch actually changes state.
    expect(mockAtomSet).not.toHaveBeenCalled();
  });

  test('takeFinalizedResults keeps the batch alive so a failed hand-back can retry', async () => {
    const { service } = makeService();
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });

    await service.signRemaining({ batchId });

    const firstTake = await service.takeFinalizedResults({ batchId });
    // Simulates the dapp resolve RPC failing after a successful take: the
    // page retries Done, which re-enters with the same batchId and must get
    // identical results instead of "unknown batchId".
    const secondTake = await service.takeFinalizedResults({ batchId });
    expect(secondTake).toEqual(firstTake);
    expect(firstTake).toEqual(['signed-psbt-0', 'signed-psbt-1']);

    // The provider's finally block owns the actual deletion.
    await expect(service.disposeBatch({ batchId })).resolves.toBeUndefined();
    await expect(service.getBatchProgress({ batchId })).rejects.toThrow();
  });

  test('a precheck rejection blocks signing and leaves the batch re-signable', async () => {
    const { service, signTransaction, precheckUnsignedTxs } = makeService();
    precheckUnsignedTxs.mockRejectedValueOnce(
      new OneKeyLocalError('protected ordinals'),
    );
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });

    await expect(service.signRemaining({ batchId })).rejects.toThrow(
      'protected ordinals',
    );
    expect(signTransaction).not.toHaveBeenCalled();
    // The rejection happened before any status mutation/publish.
    expect(mockAtomSet).not.toHaveBeenCalled();

    // A later attempt (e.g. after the user unfreezes the utxo) still works.
    await service.signRemaining({ batchId });
    const progress = await service.getBatchProgress({ batchId });
    expect(progress.status).toBe(EBatchTxSignStatus.Complete);
  });

  test('precheck only covers items that still need signing', async () => {
    const { service, precheckUnsignedTxs } = makeService();
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

    expect(precheckUnsignedTxs).toHaveBeenCalledTimes(1);
    const [params] = precheckUnsignedTxs.mock.calls[0] as unknown as [
      { unsignedTxs: IUnsignedTxPro[] },
    ];
    expect(params.unsignedTxs.map(getMarker)).toEqual(['psbt-1']);
  });

  test('software batches prompt once and thread the credentials; hardware batches never prompt', async () => {
    const soft = makeService();
    const { batchId: softBatchId } = await soft.service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });
    await soft.service.signRemaining({ batchId: softBatchId });
    // One prompt for the whole batch; every item reuses the same credentials
    // via prefetchedCredentials, so signTransaction never re-prompts and the
    // exemption cannot leak to transactions outside this batch (the previous
    // global password-security-session approach could).
    expect(soft.promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
    expect(soft.signTransaction).toHaveBeenCalledTimes(2);
    for (const [params] of soft.signTransaction.mock.calls as unknown as [
      { prefetchedCredentials?: { password: string } },
    ][]) {
      expect(params.prefetchedCredentials).toEqual({
        password: 'encoded-password',
        deviceParams: undefined,
      });
    }

    const hw = makeService();
    const { batchId: hwBatchId } = await hw.service.createBatch({
      accountId: 'hw-1--btc--0',
      networkId,
      items: makeItems(2),
    });
    await hw.service.signRemaining({ batchId: hwBatchId });
    // Hardware wallets confirm each item on the device; signTransaction keeps
    // its own per-item prompt path (which resolves deviceParams, no password).
    expect(hw.promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(hw.signTransaction).toHaveBeenCalledTimes(2);
    for (const [params] of hw.signTransaction.mock.calls as unknown as [
      { prefetchedCredentials?: { password: string } },
    ][]) {
      expect(params.prefetchedCredentials).toBeUndefined();
    }
  });

  test('a rejected password prompt blocks signing and leaves the batch re-signable', async () => {
    const { service, signTransaction, promptPasswordVerifyByAccount } =
      makeService();
    promptPasswordVerifyByAccount.mockRejectedValueOnce(
      new OneKeyLocalError('user cancelled password'),
    );
    const { batchId } = await service.createBatch({
      accountId,
      networkId,
      items: makeItems(2),
    });

    await expect(service.signRemaining({ batchId })).rejects.toThrow(
      'user cancelled password',
    );
    expect(signTransaction).not.toHaveBeenCalled();
    // The rejection happened before any status mutation/publish, so the page
    // still shows the untouched Overview.
    expect(mockAtomSet).not.toHaveBeenCalled();

    // A later attempt prompts again and completes normally.
    await service.signRemaining({ batchId });
    const progress = await service.getBatchProgress({ batchId });
    expect(progress.status).toBe(EBatchTxSignStatus.Complete);
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
