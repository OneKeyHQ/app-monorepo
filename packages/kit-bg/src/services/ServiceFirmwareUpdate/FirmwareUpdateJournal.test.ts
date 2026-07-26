import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDb } from '../../dbs/simple/base/SimpleDb';
import { SimpleDbEntityFirmwareUpdateJournal } from '../../dbs/simple/entity/SimpleDbEntityFirmwareUpdateJournal';

import {
  FirmwareUpdateJournal,
  sanitizeFirmwareUpdateJournalError,
} from './FirmwareUpdateJournal';

import type {
  IFirmwareCheckpoint,
  IFirmwarePreparedPlan,
  IFirmwareUpdatePlan,
} from './firmwareUpdateCoordinatorTypes';

const SHA256_A = 'a'.repeat(64);
const SHA256_B = 'b'.repeat(64);
const SHA256_C = 'c'.repeat(64);
const SHA256_D = 'd'.repeat(64);
const TRANSACTION_ID = 'transaction-1';
const PLAN_ID = 'plan-classic1s-4.10.0';
const LEASE_REF = 'lease-1';
const ARTIFACT_ID = 'firmware-main';
const ARTIFACT_REF = 'artifact-ref-firmware-main';

type IRawDataBuilder = (rawData: unknown) => unknown | Promise<unknown>;

class MemoryJournalStorage {
  rawData: unknown;

  failNextRead = false;

  failNextWrite = false;

  failNextClear = false;

  events: string[] = [];

  private writeQueue: Promise<void> = Promise.resolve();

  async getRawData(): Promise<unknown> {
    if (this.failNextRead) {
      this.failNextRead = false;
      throw new OneKeyLocalError('simulated read failure');
    }
    return this.rawData;
  }

  async setRawData(dataOrBuilder: unknown | IRawDataBuilder): Promise<unknown> {
    const write = async () => {
      const next =
        typeof dataOrBuilder === 'function'
          ? await (dataOrBuilder as IRawDataBuilder)(this.rawData)
          : dataOrBuilder;
      if (this.failNextWrite) {
        this.failNextWrite = false;
        throw new OneKeyLocalError('simulated durable write failure');
      }
      this.rawData = JSON.parse(JSON.stringify(next)) as unknown;
      this.events.push('persisted');
      return next;
    };
    const operation = this.writeQueue.then(write, write);
    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async clearRawData(): Promise<void> {
    if (this.failNextClear) {
      this.failNextClear = false;
      throw new OneKeyLocalError('simulated clear failure');
    }
    this.rawData = undefined;
  }
}

const updatePlan: IFirmwareUpdatePlan = {
  schemaVersion: 1,
  planId: PLAN_ID,
  planDigest: SHA256_A,
  manifestSnapshotDigest: SHA256_B,
  manifestMode: 'external-only',
  catalogEpoch: 7,
  device: {
    identity: 'device-1',
    model: 'classic1s',
  },
  artifacts: [
    {
      artifactId: ARTIFACT_ID,
      role: 'firmware',
      sourceUrls: [
        'https://web.onekey-asset.com/firmware/classic1s-4.10.0.bin',
      ],
      expectedSize: 4096,
      expectedSha256: SHA256_C,
      integrity: 'catalog-trusted',
      container: {
        kind: 'raw',
      },
      target: 'firmware',
      devicePathRule: {
        kind: 'none',
      },
      dependsOn: [],
    },
  ],
  epochs: [
    {
      epochId: 'epoch-main',
      kind: 'component-install',
      artifactIds: [ARTIFACT_ID],
      dependsOn: [],
      targetIds: ['firmware'],
    },
  ],
  expectedFinalStates: [
    {
      target: 'firmware',
      version: '4.10.0',
      sha256: SHA256_C,
    },
  ],
};

const preparedPlan: IFirmwarePreparedPlan = {
  schemaVersion: 1,
  planId: PLAN_ID,
  planDigest: SHA256_A,
  manifestSnapshotDigest: SHA256_B,
  catalogEpoch: 7,
  networkPolicy: 'forbid',
  device: updatePlan.device,
  artifactReceipts: [
    {
      artifactId: ARTIFACT_ID,
      role: 'firmware',
      target: 'firmware',
      artifactRef: ARTIFACT_REF,
      size: 4096,
      sha256: SHA256_C,
      integrity: 'catalog-trusted',
      leaseId: LEASE_REF,
      materialization: {
        kind: 'raw',
      },
    },
  ],
  epochs: updatePlan.epochs,
  expectedFinalStates: updatePlan.expectedFinalStates,
};

const checkpoint = ({
  sequence,
  destructiveActionStarted,
}: {
  sequence: number;
  destructiveActionStarted?: boolean;
}): IFirmwareCheckpoint => ({
  schemaVersion: 1,
  transactionId: TRANSACTION_ID,
  planDigest: SHA256_A,
  sequence,
  state: destructiveActionStarted ? 'ENTERING_LOADER' : 'PREPARED',
  timestampMs: 1_721_862_400_000 + sequence,
  ...(destructiveActionStarted ? { destructiveActionStarted: true } : {}),
});

const contractValidators = {
  validateUpdatePlan: (value: unknown) => value as IFirmwareUpdatePlan,
  validatePreparedPlan: (value: unknown) => value as IFirmwarePreparedPlan,
  validateCheckpoint: (value: unknown) => value as IFirmwareCheckpoint,
};

const createInput = (): Parameters<FirmwareUpdateJournal['create']>[0] => ({
  transactionId: TRANSACTION_ID,
  phase: 'PLAN_CREATED',
  cancelDisposition: 'none',
  capabilities: {
    appJournalSchemaVersion: 1,
    sdkPlanSchemaVersion: 1,
    sdkPreparedPlanSchemaVersion: 1,
    sdkHostBindingProtocolVersion: 1,
    sdkCheckpointSchemaVersion: 1,
    artifactRuntime: 'native',
    artifactProtocolVersion: 1,
    maxReadBytes: 262_144,
  },
  stableDeviceId: 'device-1',
  model: 'classic1s',
  deviceSnapshotDigest: SHA256_C,
  planId: PLAN_ID,
  planDigest: SHA256_A,
  manifestDigest: SHA256_B,
  catalogEpoch: 7,
  updatePlan,
  artifacts: [],
  checkpointSeq: -1,
  rollout: {
    policyVersion: 7,
    cohortBucket: 123,
    engine: 'fnv1a32-v1',
    eligibilityAttestationDigest: SHA256_D,
  },
});

const createHarness = () => {
  const storage = new MemoryJournalStorage();
  let timestamp = 1_721_862_400_000;
  const journal = new FirmwareUpdateJournal({
    storage,
    now: () => {
      timestamp += 1;
      return timestamp;
    },
    loadContractValidators: async () => contractValidators,
  });
  return {
    journal,
    storage,
  };
};

const prepareJournal = async (journal: FirmwareUpdateJournal) => {
  const created = await journal.create(createInput());
  return journal.markPrepared({
    expectedRevision: created.revision,
    preparedPlan,
    artifacts: [
      {
        artifactId: ARTIFACT_ID,
        state: 'verified',
        leaseRef: LEASE_REF,
        artifactRef: ARTIFACT_REF,
        expectedSize: 4096,
        downloadedBytes: 4096,
        sha256: SHA256_C,
      },
    ],
    leaseRef: LEASE_REF,
  });
};

describe('FirmwareUpdateJournal', () => {
  it('stays private and disables the SimpleDB memory cache', () => {
    const entity = new SimpleDbEntityFirmwareUpdateJournal();
    expect(entity.entityName).toBe('firmwareUpdateJournal');
    expect(entity.enableCache).toBe(false);
    expect(
      Object.getOwnPropertyDescriptor(
        SimpleDb.prototype,
        'firmwareUpdateJournal',
      ),
    ).toBeUndefined();
  });

  it('durably creates and reads a versioned journal envelope', async () => {
    const { journal, storage } = createHarness();
    const created = await journal.create(createInput());

    expect(created).toMatchObject({
      schemaVersion: 1,
      revision: 0,
      transactionId: TRANSACTION_ID,
      checkpointSeq: -1,
      updatePlan,
    });
    expect(storage.events).toEqual(['persisted']);
    expect(await journal.read()).toEqual(created);
  });

  it.each([
    ['unsupported schema', { schemaVersion: 2 }],
    ['unknown field', { unsupportedField: true }],
    ['invalid phase', { phase: 'UNKNOWN' }],
    ['unsafe integer', { revision: Number.MAX_SAFE_INTEGER + 1 }],
    ['URL outside UpdatePlan', { recoveryReason: 'https://example.com/fail' }],
    ['real path', { recoveryReason: '/Users/alice/firmware.bin' }],
    [
      'non-JSON value',
      {
        sanitizedError: {
          name: 'FirmwareError',
          message: 'failed',
          payload: new ArrayBuffer(8),
        },
      },
    ],
  ])('rejects %s from durable storage', async (_name, mutation) => {
    const { journal, storage } = createHarness();
    const created = await journal.create(createInput());
    storage.rawData = {
      ...created,
      ...mutation,
    };

    await expect(journal.read()).rejects.toMatchObject({
      firmwareUpdateJournalCode: 'INVALID_JOURNAL',
    });
  });

  it('serializes writers and rejects a stale revision', async () => {
    const { journal } = createHarness();
    const created = await journal.create(createInput());
    const results = await Promise.allSettled([
      journal.commit({
        expectedRevision: created.revision,
        patch: {
          phase: 'ELIGIBILITY_CHECKING',
        },
      }),
      journal.commit({
        expectedRevision: created.revision,
        patch: {
          phase: 'ACQUIRING',
        },
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({
      reason: {
        firmwareUpdateJournalCode: 'STALE_REVISION',
      },
    });
    expect((await journal.read())?.revision).toBe(1);
  });

  it('persists a checkpoint before the caller can acknowledge it', async () => {
    const { journal, storage } = createHarness();
    const prepared = await prepareJournal(journal);
    storage.events = [];

    const committed = await journal.commitCheckpoint({
      expectedRevision: prepared.revision,
      checkpoint: checkpoint({ sequence: 0 }),
    });
    storage.events.push('acknowledged');

    expect(committed.checkpointSeq).toBe(0);
    expect(storage.events).toEqual(['persisted', 'acknowledged']);
  });

  it('fails closed when checkpoint storage does not commit', async () => {
    const { journal, storage } = createHarness();
    const prepared = await prepareJournal(journal);
    const persistedBeforeFailure = JSON.stringify(storage.rawData);
    storage.events = [];
    storage.failNextWrite = true;

    await expect(
      journal.commitCheckpoint({
        expectedRevision: prepared.revision,
        checkpoint: checkpoint({ sequence: 0 }),
      }),
    ).rejects.toMatchObject({
      firmwareUpdateJournalCode: 'STORAGE_FAILED',
    });
    expect(JSON.stringify(storage.rawData)).toBe(persistedBeforeFailure);
    expect(storage.events).toEqual([]);
  });

  it('removes all URL-bearing UpdatePlan data after PREPARED', async () => {
    const { journal, storage } = createHarness();
    const prepared = await prepareJournal(journal);
    const serialized = JSON.stringify(storage.rawData);

    expect(prepared.phase).toBe('PREPARED');
    expect(prepared.updatePlan).toBeUndefined();
    expect(serialized).not.toContain('sourceUrls');
    expect(serialized).not.toContain('https://');
    expect(prepared.preparedPlan).toEqual(preparedPlan);
  });

  it('rejects checkpoint sequence regression and same-sequence mutation', async () => {
    const { journal } = createHarness();
    const prepared = await prepareJournal(journal);
    const first = await journal.commitCheckpoint({
      expectedRevision: prepared.revision,
      checkpoint: checkpoint({ sequence: 1 }),
    });

    await expect(
      journal.commitCheckpoint({
        expectedRevision: first.revision,
        checkpoint: checkpoint({ sequence: 0 }),
      }),
    ).rejects.toMatchObject({
      firmwareUpdateJournalCode: 'CHECKPOINT_REGRESSION',
    });
    await expect(
      journal.commitCheckpoint({
        expectedRevision: first.revision,
        checkpoint: {
          ...checkpoint({ sequence: 1 }),
          timestampMs: checkpoint({ sequence: 1 }).timestampMs + 1,
        },
      }),
    ).rejects.toMatchObject({
      firmwareUpdateJournalCode: 'CHECKPOINT_REGRESSION',
    });
  });

  it('allows abandonment only before mutation or with device-proven safety', async () => {
    const beforeMutationHarness = createHarness();
    const created = await beforeMutationHarness.journal.create(createInput());
    const safelyAbandoned = await beforeMutationHarness.journal.markTerminal({
      expectedRevision: created.revision,
      state: 'ABANDONED',
      leaseDisposition: 'safeAbandoned',
      abandonSafety: 'before-destructive-checkpoint',
    });
    expect(safelyAbandoned.terminalTombstone?.abandonSafety).toBe(
      'before-destructive-checkpoint',
    );

    const destructiveHarness = createHarness();
    const prepared = await prepareJournal(destructiveHarness.journal);
    const destructive = await destructiveHarness.journal.commitCheckpoint({
      expectedRevision: prepared.revision,
      checkpoint: checkpoint({
        sequence: 0,
        destructiveActionStarted: true,
      }),
      phase: 'ENTERING_LOADER',
      pendingDestructiveAction: {
        kind: 'enter-loader',
        checkpointSeq: 0,
      },
    });
    await expect(
      destructiveHarness.journal.markTerminal({
        expectedRevision: destructive.revision,
        state: 'ABANDONED',
        leaseDisposition: 'safeAbandoned',
        abandonSafety: 'before-destructive-checkpoint',
      }),
    ).rejects.toMatchObject({
      firmwareUpdateJournalCode: 'UNSAFE_ABANDON',
    });
    await expect(
      destructiveHarness.journal.markTerminal({
        expectedRevision: destructive.revision,
        state: 'ABANDONED',
        leaseDisposition: 'safeAbandoned',
        abandonSafety: 'device-proven-safe',
      }),
    ).resolves.toMatchObject({
      phase: 'ABANDONED',
      terminalTombstone: {
        leaseDisposition: 'safeAbandoned',
        abandonSafety: 'device-proven-safe',
      },
    });
  });

  it('sanitizes errors without persisting stack, URLs, or paths', () => {
    const sanitized = sanitizeFirmwareUpdateJournalError({
      name: 'DownloadError',
      message:
        'GET https://example.com/firmware.bin failed at /Users/alice/cache/file.bin',
      code: 'DOWNLOAD_FAILED',
      retryable: true,
      stack: 'private stack',
    });

    expect(sanitized).toEqual({
      name: 'DownloadError',
      message: 'GET [redacted-url] failed at [redacted-path]',
      code: 'DOWNLOAD_FAILED',
      retryable: true,
    });
    expect(JSON.stringify(sanitized)).not.toContain('private stack');
  });

  it('clears only a terminal journal and wraps storage failures', async () => {
    const { journal, storage } = createHarness();
    const created = await journal.create(createInput());

    await expect(journal.clearTerminal()).rejects.toMatchObject({
      firmwareUpdateJournalCode: 'TERMINAL_JOURNAL',
    });
    const failed = await journal.markFailed({
      expectedRevision: created.revision,
      error: new OneKeyLocalError('firmware failed'),
    });
    expect(failed.terminalTombstone?.leaseDisposition).toBe('retained');

    storage.failNextClear = true;
    await expect(journal.clearTerminal()).rejects.toMatchObject({
      firmwareUpdateJournalCode: 'STORAGE_FAILED',
    });
    await journal.clearTerminal();
    expect(await journal.read()).toBeUndefined();

    storage.failNextRead = true;
    await expect(journal.read()).rejects.toMatchObject({
      firmwareUpdateJournalCode: 'STORAGE_FAILED',
    });
  });

  it('does not allow terminal records to be overwritten', async () => {
    const { journal } = createHarness();
    const created = await journal.create(createInput());
    const failed = await journal.markFailed({
      expectedRevision: created.revision,
      error: 'firmware failed',
    });

    await expect(
      journal.commit({
        expectedRevision: failed.revision,
        patch: {
          phase: 'ACQUIRING',
          terminalTombstone: undefined,
        },
      }),
    ).rejects.toMatchObject({
      firmwareUpdateJournalCode: 'TERMINAL_JOURNAL',
    });
  });
});
