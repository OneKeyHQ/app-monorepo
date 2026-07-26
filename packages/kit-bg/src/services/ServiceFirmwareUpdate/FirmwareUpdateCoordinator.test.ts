import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  FirmwareUpdateCoordinator,
  type IFirmwareUpdateCoordinatorExecutor,
} from './FirmwareUpdateCoordinator';
import { FirmwareUpdateJournal } from './FirmwareUpdateJournal';

import type {
  FirmwareArtifactProvider,
  IFirmwareArtifactPreparationResult,
} from './FirmwareArtifactProvider';
import type { IFirmwareStoredArtifact } from './FirmwareArtifactStore';
import type {
  IFirmwarePreparedPlan,
  IFirmwareUpdatePlan,
} from './firmwareUpdateCoordinatorTypes';
import type { IFirmwareUpdateHostBinding } from './FirmwareUpdateRuntimeBinding';

const SHA256_A = 'a'.repeat(64);
const SHA256_B = 'b'.repeat(64);
const SHA256_C = 'c'.repeat(64);
const TRANSACTION_ID = 'transaction-1';
const LEASE_REF = 'lease-1';
const ARTIFACT_REF = 'artifact-ref-1';

type IRawDataBuilder = (rawData: unknown) => unknown | Promise<unknown>;

class MemoryJournalStorage {
  rawData: unknown;

  events: string[] = [];

  private writeQueue: Promise<void> = Promise.resolve();

  async getRawData() {
    return this.rawData;
  }

  async setRawData(dataOrBuilder: unknown | IRawDataBuilder) {
    const write = async () => {
      const next =
        typeof dataOrBuilder === 'function'
          ? await (dataOrBuilder as IRawDataBuilder)(this.rawData)
          : dataOrBuilder;
      this.rawData = JSON.parse(JSON.stringify(next)) as unknown;
      this.events.push('durable');
      return next;
    };
    const operation = this.writeQueue.then(write, write);
    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async clearRawData() {
    this.rawData = undefined;
  }
}

const plan: IFirmwareUpdatePlan = {
  schemaVersion: 1,
  planId: 'plan-classic1s',
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
      artifactId: 'firmware-main',
      role: 'firmware',
      sourceUrls: ['https://web.onekey-asset.com/firmware.bin'],
      expectedSize: 4096,
      expectedSha256: SHA256_C,
      integrity: 'catalog-trusted',
      container: {
        kind: 'raw',
      },
      target: 'firmware',
      targetVersion: '4.10.0',
      devicePathRule: {
        kind: 'none',
      },
      dependsOn: [],
    },
  ],
  epochs: [
    {
      epochId: 'firmware-install',
      kind: 'component-install',
      artifactIds: ['firmware-main'],
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
  planId: plan.planId,
  planDigest: plan.planDigest,
  manifestSnapshotDigest: plan.manifestSnapshotDigest,
  catalogEpoch: plan.catalogEpoch,
  networkPolicy: 'forbid',
  device: plan.device,
  artifactReceipts: [
    {
      artifactId: 'firmware-main',
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
  epochs: plan.epochs,
  expectedFinalStates: plan.expectedFinalStates,
};

const storedArtifact: IFirmwareStoredArtifact = {
  taskId: 'task-1',
  requirement: plan.artifacts[0],
  adapterReceipt: {
    artifactRef: ARTIFACT_REF,
    size: 4096,
    sha256: SHA256_C,
    immutableToken: 'immutable-1',
  },
  preparedReceipt: preparedPlan.artifactReceipts[0],
};

const CAPABILITY_GATE = {
  ready: true,
  engine: 'transaction',
  planSchemaVersion: 1,
  preparedPlanSchemaVersion: 1,
  hostBindingProtocolVersion: 1,
  checkpointSchemaVersion: 1,
  artifactProtocolVersion: 1,
  maxReadBytes: 262_144,
} as const;

const ROLLOUT_DECISION = {
  allowed: true,
  reason: 'allowed',
  source: 'signed-remote',
  policyVersion: 11,
  ruleName: 'coordinatorExternalOnly',
  cohortBucket: 123,
  engine: 'fnv1a32-v1',
} as const;

const START_INPUT = {
  transactionId: TRANSACTION_ID,
  plan,
  deviceSnapshotDigest: SHA256_C,
  capabilityGate: CAPABILITY_GATE,
  rolloutDecision: ROLLOUT_DECISION,
  confirmations: {
    backuped: true,
    usbConnected: true,
  },
  eligibilityContext: {
    connectId: 'connect-1',
  },
};

const createHarness = ({
  failEligibility,
  executePreparedPlan,
}: {
  failEligibility?: boolean;
  executePreparedPlan?: IFirmwareUpdateCoordinatorExecutor<{
    connectId: string;
  }>;
} = {}) => {
  const storage = new MemoryJournalStorage();
  let now = 1_721_862_400_000;
  const journal = new FirmwareUpdateJournal({
    storage,
    now: () => {
      now += 1;
      return now;
    },
    loadContractValidators: async () => ({
      validateUpdatePlan: (value) => value as IFirmwareUpdatePlan,
      validatePreparedPlan: (value) => value as IFirmwarePreparedPlan,
      validateCheckpoint: (value) =>
        value as Parameters<
          IFirmwareUpdateHostBinding['checkpointSink']['commit']
        >[0],
    }),
  });
  const order: string[] = [];
  let runtimeHostBinding: IFirmwareUpdateHostBinding | undefined;
  const releaseLease = jest.fn(async () => undefined);
  const artifactProvider = {
    prepareArtifacts: jest.fn(
      async ({
        lifecycle,
      }: Parameters<
        FirmwareArtifactProvider['prepareArtifacts']
      >[0]): Promise<IFirmwareArtifactPreparationResult> => {
        order.push('artifact-provider');
        await lifecycle?.onLeaseCreated?.(LEASE_REF);
        await lifecycle?.onArtifactReady?.(storedArtifact);
        return {
          leaseRef: LEASE_REF,
          storedArtifacts: [storedArtifact],
          preparedPlan,
        };
      },
    ),
    resumeArtifacts: jest.fn(
      async ({
        leaseRef,
        lifecycle,
      }: Parameters<
        FirmwareArtifactProvider['resumeArtifacts']
      >[0]): Promise<IFirmwareArtifactPreparationResult> => {
        order.push('artifact-provider-resume');
        await lifecycle?.onArtifactReady?.(storedArtifact);
        return {
          leaseRef,
          storedArtifacts: [storedArtifact],
          preparedPlan,
        };
      },
    ),
  };
  const eligibility = {
    createUserAttestation: jest.fn(async () => ({
      backuped: true as const,
      usbConnected: true as const,
      confirmedAt: 1_721_862_400_000,
      attestationDigest: SHA256_A,
    })),
    assertBeforeAcquisition: jest.fn(async () => {
      order.push('eligibility');
      if (failEligibility) {
        throw new OneKeyLocalError('eligibility denied');
      }
    }),
    assertBeforeDeviceMutation: jest.fn(async () => {
      order.push('device-revalidation');
    }),
  };
  const runtimeBinding = {
    bind: jest.fn(async ({ binding }) => {
      order.push('runtime-binding');
      runtimeHostBinding = binding;
      return {
        generation: 1,
        kind: 'direct' as const,
        token: 1,
      };
    }),
    clear: jest.fn(async () => undefined),
    getSnapshot: jest.fn(() => undefined),
  };
  const publishProjection = jest.fn(async () => undefined);
  const executor = jest.fn(
    executePreparedPlan ??
      (async () => {
        order.push('executor');
      }),
  );
  const coordinator = new FirmwareUpdateCoordinator({
    journal,
    artifactProvider,
    artifactStore: {
      createArtifactReader: () => ({
        open: async () => ({ readerId: 'reader-1', size: 4096 }),
        read: async () => ({
          data: new ArrayBuffer(0),
          bytesRead: 0,
          eof: true,
        }),
        close: async () => undefined,
        cancel: async () => undefined,
      }),
      releaseLease,
      restorePreparedPlan: jest.fn(async () => undefined),
    },
    eligibility,
    runtimeBinding,
    validatePlan: async (value) => value as IFirmwareUpdatePlan,
    validatePreparedPlan: async (value) => {
      order.push('prepared-plan-revalidated');
      return value as IFirmwarePreparedPlan;
    },
    executePreparedPlan: executor,
    publishProjection,
  });
  return {
    artifactProvider,
    coordinator,
    eligibility,
    executor,
    getRuntimeBinding: () => runtimeHostBinding,
    journal,
    order,
    publishProjection,
    releaseLease,
    storage,
  };
};

describe('FirmwareUpdateCoordinator', () => {
  it('runs eligibility before acquisition and never mutates the device on gate failure', async () => {
    const harness = createHarness({ failEligibility: true });

    await expect(
      harness.coordinator.createAndPrepare(START_INPUT),
    ).rejects.toThrow('eligibility denied');

    expect(harness.order).toEqual(['eligibility']);
    expect(harness.artifactProvider.prepareArtifacts).not.toHaveBeenCalled();
    expect(harness.executor).not.toHaveBeenCalled();
    expect((await harness.journal.read())?.phase).toBe('FAILED');
  });

  it('commits every artifact and a revalidated PreparedPlan before the ready barrier', async () => {
    const harness = createHarness();

    const projection = await harness.coordinator.createAndPrepare(START_INPUT);
    const persisted = await harness.journal.read();

    expect(harness.order).toEqual([
      'eligibility',
      'artifact-provider',
      'prepared-plan-revalidated',
    ]);
    expect(projection.phase).toBe('PREPARED');
    expect(persisted?.preparedPlan).toEqual(preparedPlan);
    expect(persisted?.updatePlan).toBeUndefined();
    expect(JSON.stringify(harness.storage.rawData)).not.toContain('https://');
    expect(harness.executor).not.toHaveBeenCalled();
  });

  it('binds the reader, revalidates the device, then executes with network forbidden', async () => {
    const harness = createHarness();
    await harness.coordinator.createAndPrepare(START_INPUT);

    await harness.coordinator.execute({
      sessionId: TRANSACTION_ID,
      eligibilityContext: START_INPUT.eligibilityContext,
    });

    expect(harness.order).toEqual([
      'eligibility',
      'artifact-provider',
      'prepared-plan-revalidated',
      'device-revalidation',
      'runtime-binding',
      'executor',
    ]);
    expect(harness.executor).toHaveBeenCalledWith({
      transactionId: TRANSACTION_ID,
      preparedPlan: expect.objectContaining({
        networkPolicy: 'forbid',
      }),
      checkpoint: undefined,
      eligibilityContext: START_INPUT.eligibilityContext,
    });
    expect((await harness.journal.read())?.phase).toBe('COMPLETED');
    expect(harness.releaseLease).toHaveBeenCalledWith(LEASE_REF, 'completed');
  });

  it('durably commits SDK checkpoints before acknowledging them', async () => {
    const events: string[] = [];
    const harness = createHarness({
      executePreparedPlan: async () => {
        const binding = harness.getRuntimeBinding();
        if (!binding) {
          throw new OneKeyLocalError('runtime binding missing');
        }
        harness.storage.events = [];
        await binding.checkpointSink.commit({
          schemaVersion: 1,
          transactionId: TRANSACTION_ID,
          planDigest: SHA256_A,
          sequence: 0,
          state: 'ENTERING_LOADER',
          timestampMs: 1_721_862_400_100,
          destructiveActionStarted: true,
        });
        events.push(
          (await harness.journal.read())?.checkpointSeq === 0
            ? 'durable-before-ack'
            : 'not-durable',
        );
      },
    });
    await harness.coordinator.createAndPrepare(START_INPUT);

    await harness.coordinator.execute({
      sessionId: TRANSACTION_ID,
      eligibilityContext: START_INPUT.eligibilityContext,
    });

    expect(events).toEqual(['durable-before-ack']);
    expect(harness.storage.events[0]).toBe('durable');
  });

  it('releases a pre-mutation lease with safe-cancel semantics', async () => {
    const harness = createHarness();
    await harness.coordinator.createAndPrepare(START_INPUT);

    const projection = await harness.coordinator.cancel(TRANSACTION_ID);

    expect(projection).toMatchObject({
      phase: 'ABANDONED',
      cancelDisposition: 'cancelled-before-mutation',
    });
    expect(harness.releaseLease).toHaveBeenCalledWith(
      LEASE_REF,
      'safeCancelled',
    );
    expect(harness.executor).not.toHaveBeenCalled();
  });

  it('rejects overlapping transaction creation through the single owner', async () => {
    const harness = createHarness();
    const results = await Promise.allSettled([
      harness.coordinator.createAndPrepare(START_INPUT),
      harness.coordinator.createAndPrepare({
        ...START_INPUT,
        transactionId: 'transaction-2',
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(await harness.journal.read()).toMatchObject({
      transactionId: TRANSACTION_ID,
      phase: 'PREPARED',
    });
  });

  it('rebroadcasts the durable projection for late UI subscribers', async () => {
    const harness = createHarness();
    await harness.coordinator.createAndPrepare(START_INPUT);
    harness.publishProjection.mockClear();

    const projection = await harness.coordinator.getProjection({
      broadcast: true,
    });

    expect(projection?.phase).toBe('PREPARED');
    expect(harness.publishProjection).toHaveBeenCalledWith(projection);
  });
});
