import { EFirmwareType } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { restoreFirmwareUpdatePlanFromPrepared } from './FirmwareArtifactPreflight';
import {
  FirmwareUpdateJournal,
  validateFirmwareUpdateJournalEnvelope,
} from './FirmwareUpdateJournal';
import { trustedFirmwareCatalog } from './trustedFirmwareCatalog.generated';

import type { IFirmwareArtifactAdapter } from './FirmwareArtifactAdapter.types';
import type { IPreparedFirmwareArtifacts } from './FirmwareArtifactPreflight';
import type { IFirmwareUpdateRolloutDecision } from './FirmwareUpdateRolloutPolicy';
import type { FirmwareCheckpoint, FirmwareUpdatePlan } from '@onekeyfe/hd-core';

const plan: FirmwareUpdatePlan = {
  schemaVersion: 1,
  planDigest: 'a'.repeat(64),
  executor: 'v2',
  deviceIdentity: 'device-1',
  deviceModel: 'classic1s',
  firmwareType: EFirmwareType.Universal,
  platform: 'desktop',
  artifacts: [
    {
      artifactId: 'firmware',
      role: 'firmware',
      target: 'firmware',
      url: 'https://example.invalid/firmware.bin',
      container: 'raw',
      expectedSize: 4,
      expectedSha256: 'b'.repeat(64),
      targetVersion: '1.2.3',
    },
  ],
  epochs: [
    {
      epoch: 0,
      kind: 'legacy-update',
      artifactIds: ['firmware'],
      targets: ['firmware'],
    },
    {
      epoch: 1,
      kind: 'final-verify',
      artifactIds: [],
      targets: ['firmware'],
    },
  ],
  targetsToUpdate: ['firmware'],
};

const prepared: IPreparedFirmwareArtifacts = {
  transactionId: 'fwtx:00000000-0000-4000-8000-000000000001',
  leaseRef: 'fwlease:00000000-0000-4000-8000-000000000002',
  plan,
  preparedPlan: {
    schemaVersion: 1,
    preparedPlanDigest: 'c'.repeat(64),
    planDigest: plan.planDigest,
    networkPolicy: 'forbid',
    executor: plan.executor,
    deviceIdentity: plan.deviceIdentity,
    deviceModel: plan.deviceModel,
    firmwareType: plan.firmwareType,
    platform: plan.platform,
    leaseRef: 'fwlease:00000000-0000-4000-8000-000000000002',
    artifacts: [
      {
        artifactId: 'firmware',
        role: 'firmware',
        target: 'firmware',
        container: 'raw',
        targetVersion: '1.2.3',
        artifact: {
          artifactRef: `fw:${'b'.repeat(64)}`,
          size: 4,
          sha256: 'b'.repeat(64),
        },
      },
    ],
    epochs: plan.epochs,
    targetsToUpdate: plan.targetsToUpdate,
  },
  artifactsById: {
    firmware: {
      artifactRef: `fw:${'b'.repeat(64)}`,
      size: 4,
      sha256: 'b'.repeat(64),
    },
  },
  selected: {
    firmware: {
      artifactRef: `fw:${'b'.repeat(64)}`,
      size: 4,
      sha256: 'b'.repeat(64),
    },
    componentArtifacts: {},
    resourceBundleArtifacts: [],
  },
  artifactReader: {
    open: jest.fn(),
    read: jest.fn(),
    close: jest.fn(),
  },
};

const allowedRollout: IFirmwareUpdateRolloutDecision = {
  allowed: true,
  reason: 'allowed',
  configReason: 'signed_remote',
  source: 'signed-remote',
  policyVersion: 4,
  cohortBucket: 1234,
  ruleName: 'coordinatorExternalOnly',
  engine: 'fnv1a32-v1',
  rule: {
    enabled: true,
    killSwitch: false,
    percentageBps: 10_000,
  },
};

const deniedRollout: IFirmwareUpdateRolloutDecision = {
  ...allowedRollout,
  allowed: false,
  reason: 'kill_switch',
  rule: {
    ...allowedRollout.rule,
    killSwitch: true,
  },
};

const createFixture = () => {
  let stored: unknown;
  let rejectReads = false;
  let rejectWrites = false;
  const quarantined: unknown[] = [];
  const journalEntity = {
    readPersistedEnvelope: jest.fn(async () => {
      if (rejectReads) {
        throw new OneKeyLocalError('storage unavailable');
      }
      return stored === undefined
        ? { exists: false }
        : { exists: true, data: stored };
    }),
    quarantinePersistedEnvelope: jest.fn(async () => {
      if (stored === undefined) return false;
      quarantined.push(stored);
      stored = undefined;
      return true;
    }),
    setRawData: jest.fn(async (valueOrBuilder: unknown) => {
      if (rejectWrites) {
        throw new OneKeyLocalError('storage unavailable');
      }
      let nextValue = valueOrBuilder;
      if (typeof valueOrBuilder === 'function') {
        const builder = valueOrBuilder as (
          value: unknown,
        ) => unknown | Promise<unknown>;
        nextValue = await builder(stored);
      }
      stored = nextValue;
      return stored;
    }),
  };
  const createLease = jest.fn(async () => ({ leaseRef: prepared.leaseRef }));
  const releaseLease = jest.fn(async () => undefined);
  const reconcileLeases = jest.fn(async () => undefined);
  const sweepOrphans = jest.fn(async () => ({
    deletedFiles: 0,
    deletedBytes: 0,
  }));
  const retain = jest.fn(async () => undefined);
  const artifactAdapter = {
    createLease,
    releaseLease,
    reconcileLeases,
    sweepOrphans,
    retain,
  } as unknown as jest.Mocked<IFirmwareArtifactAdapter>;
  const journal = new FirmwareUpdateJournal(
    journalEntity as never,
    artifactAdapter,
    true,
  );
  return {
    journal,
    createLease,
    reconcileLeases,
    releaseLease,
    retain,
    sweepOrphans,
    quarantined,
    setStored(value: unknown) {
      stored = value;
    },
    setRejectReads(value: boolean) {
      rejectReads = value;
    },
    setRejectWrites(value: boolean) {
      rejectWrites = value;
    },
  };
};

const beginAllowed = async (fixture: ReturnType<typeof createFixture>) => {
  const started = await fixture.journal.begin({
    plan,
    backuped: true,
    usbConnected: true,
    rollout: allowedRollout,
  });
  if (!started) {
    throw new OneKeyLocalError('Expected rollout to allow the transaction');
  }
  return started;
};

const checkpoint = (
  sequence: number,
  stage: FirmwareCheckpoint['stage'],
): FirmwareCheckpoint => ({
  schemaVersion: 1,
  sequence,
  stage,
  destructiveActionStarted: true,
  target: 'firmware',
});

describe('FirmwareUpdateJournal', () => {
  test('durably prepares before execution and retains artifacts after an execution error', async () => {
    const fixture = createFixture();
    const started = await beginAllowed(fixture);

    expect((await fixture.journal.read())?.phase).toBe('PREPARING');
    await fixture.journal.markPrepared(started.transactionId, {
      ...prepared,
      transactionId: started.transactionId,
      leaseRef: started.leaseRef,
    });
    expect((await fixture.journal.read())?.phase).toBe('PREPARED');

    await fixture.journal.markExecuting(started.transactionId);
    await fixture.journal.commitSdkCheckpoint(
      started.transactionId,
      checkpoint(1, 'FILE_TRANSFER_STARTED'),
    );
    await fixture.journal.markFailure(started.transactionId, {
      code: 'TRANSPORT_INTERRUPTED',
      message: 'must not be persisted',
    });

    const paused = await fixture.journal.read();
    expect(paused).toMatchObject({
      phase: 'PAUSED',
      destructiveStarted: true,
      recoveryReason: 'reconciliation_required',
      sanitizedError: {
        code: 'TRANSPORT_INTERRUPTED',
        stage: 'executing',
      },
    });
    expect(JSON.stringify(paused)).not.toContain('must not be persisted');
    expect(fixture.releaseLease.mock.calls).toHaveLength(0);

    const resumed = await fixture.journal.begin({
      plan,
      backuped: true,
      usbConnected: true,
      rollout: deniedRollout,
    });
    expect(resumed?.resumeCheckpoint).toMatchObject({
      sequence: 1,
      stage: 'FILE_TRANSFER_STARTED',
    });
    await fixture.journal.markExecuting(started.transactionId);
    expect(await fixture.journal.read()).toMatchObject({
      phase: 'EXECUTING',
      destructiveStarted: true,
    });
  });

  test('reuses one safely prepared transaction for the same plan', async () => {
    const fixture = createFixture();
    const started = await beginAllowed(fixture);
    await fixture.journal.markPrepared(started.transactionId, {
      ...prepared,
      transactionId: started.transactionId,
      leaseRef: started.leaseRef,
    });

    const resumed = await fixture.journal.begin({
      plan,
      backuped: true,
      usbConnected: true,
      rollout: deniedRollout,
    });

    expect(resumed).toBeDefined();
    if (!resumed) {
      throw new OneKeyLocalError('Expected prepared transaction reuse');
    }
    expect(resumed.transactionId).toBe(started.transactionId);
    expect(resumed.prepared?.artifacts).toHaveLength(1);
    expect(fixture.createLease.mock.calls).toHaveLength(1);
  });

  test('writes the terminal phase before releasing a completed lease', async () => {
    const fixture = createFixture();
    const started = await beginAllowed(fixture);
    await fixture.journal.markPrepared(started.transactionId, {
      ...prepared,
      transactionId: started.transactionId,
      leaseRef: started.leaseRef,
    });
    await fixture.journal.markExecuting(started.transactionId);
    await fixture.journal.commitSdkCheckpoint(
      started.transactionId,
      checkpoint(1, 'FINAL_VERIFIED'),
    );
    await fixture.journal.markCompleted(started.transactionId);

    const completed = await fixture.journal.read();
    expect(completed?.phase).toBe('COMPLETED');
    expect(completed?.completedAt).toEqual(expect.any(Number));
    expect(fixture.releaseLease.mock.calls).toContainEqual([
      {
        leaseRef: started.leaseRef,
        disposition: 'completed',
      },
    ]);
  });

  test('rejects stale SDK checkpoints and late writes after a terminal phase', async () => {
    const fixture = createFixture();
    const started = await beginAllowed(fixture);
    await fixture.journal.markPrepared(started.transactionId, {
      ...prepared,
      transactionId: started.transactionId,
      leaseRef: started.leaseRef,
    });
    await fixture.journal.markExecuting(started.transactionId);
    await fixture.journal.commitSdkCheckpoint(
      started.transactionId,
      checkpoint(1, 'FILE_TRANSFER_STARTED'),
    );
    await expect(
      fixture.journal.commitSdkCheckpoint(
        started.transactionId,
        checkpoint(1, 'FILE_TRANSFER_COMPLETED'),
      ),
    ).rejects.toThrow('sequence is stale');
    await fixture.journal.commitSdkCheckpoint(
      started.transactionId,
      checkpoint(2, 'FINAL_VERIFIED'),
    );
    await fixture.journal.markCompleted(started.transactionId);
    await expect(
      fixture.journal.commitSdkCheckpoint(
        started.transactionId,
        checkpoint(3, 'FINAL_VERIFIED'),
      ),
    ).rejects.toThrow('writer is stale');
  });

  test('fails closed and releases a new lease when the first journal write fails', async () => {
    const fixture = createFixture();
    fixture.setRejectWrites(true);

    await expect(
      fixture.journal.begin({
        plan,
        backuped: true,
        usbConnected: true,
        rollout: allowedRollout,
      }),
    ).rejects.toThrow('storage unavailable');
    expect(fixture.releaseLease.mock.calls).toContainEqual([
      {
        leaseRef: prepared.leaseRef,
        disposition: 'safeCancelled',
      },
    ]);
  });

  test('rejects unknown fields and forbidden URL data recursively', async () => {
    const fixture = createFixture();
    const started = await beginAllowed(fixture);
    await fixture.journal.markPrepared(started.transactionId, {
      ...prepared,
      transactionId: started.transactionId,
      leaseRef: started.leaseRef,
    });
    const valid = await fixture.journal.read();
    expect(valid).toBeDefined();

    expect(() =>
      validateFirmwareUpdateJournalEnvelope({
        ...valid,
        unexpected: true,
      }),
    ).toThrow('unexpected fields');
    expect(() =>
      validateFirmwareUpdateJournalEnvelope({
        ...valid,
        prepared: {
          ...valid?.prepared,
          artifacts: valid?.prepared?.artifacts.map((artifact) => ({
            ...artifact,
            targetVersion: 'https://example.invalid/leak',
          })),
        },
      }),
    ).toThrow('forbidden data');
  });

  test('quarantines an invalid terminal journal before starting a new transaction', async () => {
    const fixture = createFixture();
    const started = await beginAllowed(fixture);
    await fixture.journal.markFailure(
      started.transactionId,
      new OneKeyLocalError('preflight failed'),
    );
    const terminal = await fixture.journal.read();
    fixture.setStored({
      ...terminal,
      schemaVersion: 2,
    });

    const replacement = await beginAllowed(fixture);

    expect(replacement.transactionId).not.toBe(started.transactionId);
    expect(fixture.quarantined).toEqual([
      expect.objectContaining({
        transactionId: started.transactionId,
        phase: 'FAILED',
        schemaVersion: 2,
      }),
    ]);
  });

  test('retains the lease and rejects replacement for an invalid destructive journal', async () => {
    const fixture = createFixture();
    const started = await beginAllowed(fixture);
    await fixture.journal.markPrepared(started.transactionId, {
      ...prepared,
      transactionId: started.transactionId,
      leaseRef: started.leaseRef,
    });
    await fixture.journal.markExecuting(started.transactionId);
    await fixture.journal.commitSdkCheckpoint(
      started.transactionId,
      checkpoint(1, 'FILE_TRANSFER_STARTED'),
    );
    const active = await fixture.journal.read();
    fixture.setStored({
      ...active,
      schemaVersion: 2,
    });

    await expect(beginAllowed(fixture)).rejects.toThrow(
      'version fields are invalid',
    );
    await fixture.journal.bootstrapRecover();

    expect(fixture.quarantined).toEqual([]);
    expect(fixture.reconcileLeases.mock.calls).toContainEqual([
      [started.leaseRef],
    ]);
  });

  test('does not quarantine a journal after a transient storage read failure', async () => {
    const fixture = createFixture();
    await beginAllowed(fixture);
    fixture.setRejectReads(true);

    await expect(fixture.journal.read()).rejects.toThrow('storage unavailable');
    await expect(fixture.journal.bootstrapRecover()).rejects.toThrow(
      'storage unavailable',
    );
    await fixture.journal.sweepOrphansAfterRecovery();
    expect(fixture.quarantined).toEqual([]);
    expect(fixture.reconcileLeases.mock.calls).toHaveLength(0);
    expect(fixture.sweepOrphans.mock.calls).toHaveLength(0);
  });

  test('kill switch blocks only a new transaction and does not create a lease', async () => {
    const fixture = createFixture();
    await expect(
      fixture.journal.begin({
        plan,
        backuped: true,
        usbConnected: true,
        rollout: deniedRollout,
      }),
    ).resolves.toBeUndefined();
    expect(fixture.createLease.mock.calls).toHaveLength(0);
  });

  test('cold bootstrap resumes only a transaction that had entered execution', async () => {
    const preparing = createFixture();
    const preparingStarted = await beginAllowed(preparing);
    await preparing.journal.bootstrapRecover();
    expect(await preparing.journal.read()).toMatchObject({
      phase: 'ABANDONED',
      executionStarted: false,
      completedAt: expect.any(Number),
    });
    expect(preparing.releaseLease.mock.calls).toContainEqual([
      {
        leaseRef: preparingStarted.leaseRef,
        disposition: 'safeAbandoned',
      },
    ]);
    expect(preparing.reconcileLeases.mock.calls).toContainEqual([[]]);

    const interrupted = createFixture();
    const started = await beginAllowed(interrupted);
    await interrupted.journal.markPrepared(started.transactionId, {
      ...prepared,
      transactionId: started.transactionId,
      leaseRef: started.leaseRef,
    });
    await interrupted.journal.markExecuting(started.transactionId);

    await interrupted.journal.bootstrapRecover();

    expect(await interrupted.journal.read()).toMatchObject({
      phase: 'PREPARED',
      executionStarted: true,
      recoveryReason: 'interrupted_during_execution',
    });
    expect(interrupted.reconcileLeases.mock.calls).toContainEqual([
      [started.leaseRef],
    ]);
    expect(interrupted.retain).not.toHaveBeenCalled();
    expect(interrupted.sweepOrphans.mock.calls).toHaveLength(0);

    await interrupted.journal.sweepOrphansAfterRecovery();
    expect(interrupted.sweepOrphans.mock.calls).toHaveLength(1);

    const idlePrepared = createFixture();
    const idleStarted = await beginAllowed(idlePrepared);
    await idlePrepared.journal.markPrepared(idleStarted.transactionId, {
      ...prepared,
      transactionId: idleStarted.transactionId,
      leaseRef: idleStarted.leaseRef,
    });
    await idlePrepared.journal.bootstrapRecover();
    expect(await idlePrepared.journal.read()).toMatchObject({
      phase: 'PREPARED',
      executionStarted: false,
    });
    expect((await idlePrepared.journal.read())?.recoveryReason).toBeUndefined();
  });

  test('reconstructs a URL-free journal plan only from the bundled catalog', async () => {
    const catalogEntry = Object.entries(
      trustedFirmwareCatalog.artifactsByUrl,
    ).find(([, artifact]) => artifact.role === 'firmware');
    if (!catalogEntry) {
      throw new OneKeyLocalError('Expected a trusted firmware artifact');
    }
    const [url, trusted] = catalogEntry;
    const catalogPlan: FirmwareUpdatePlan = {
      ...plan,
      artifacts: [
        {
          artifactId: 'firmware',
          role: trusted.role as FirmwareUpdatePlan['artifacts'][number]['role'],
          target: 'firmware',
          url,
          container: trusted.container,
          expectedSize: trusted.expectedSize,
          expectedSha256: trusted.expectedSha256,
        },
      ],
    };
    const fixture = createFixture();
    const started = await fixture.journal.begin({
      plan: catalogPlan,
      backuped: true,
      usbConnected: true,
      rollout: allowedRollout,
    });
    if (!started) {
      throw new OneKeyLocalError('Expected catalog transaction');
    }
    await fixture.journal.markPrepared(started.transactionId, {
      ...prepared,
      transactionId: started.transactionId,
      leaseRef: started.leaseRef,
      plan: catalogPlan,
      preparedPlan: {
        ...prepared.preparedPlan,
        planDigest: catalogPlan.planDigest,
        leaseRef: started.leaseRef,
        artifacts: [
          {
            artifactId: 'firmware',
            role: trusted.role as FirmwareUpdatePlan['artifacts'][number]['role'],
            target: 'firmware',
            container: trusted.container,
            artifact: {
              artifactRef: `fw:${trusted.expectedSha256}`,
              size: trusted.expectedSize,
              sha256: trusted.expectedSha256,
            },
          },
        ],
      },
    });
    const journal = await fixture.journal.read();
    if (!journal?.prepared) {
      throw new OneKeyLocalError('Expected persisted prepared firmware plan');
    }
    const persistedPrepared = journal.prepared;

    expect(JSON.stringify(journal)).not.toContain(url);
    expect(
      restoreFirmwareUpdatePlanFromPrepared(persistedPrepared).artifacts[0],
    ).toMatchObject({
      url,
      expectedSize: trusted.expectedSize,
      expectedSha256: trusted.expectedSha256,
    });
    expect(() =>
      restoreFirmwareUpdatePlanFromPrepared({
        ...persistedPrepared,
        artifacts: persistedPrepared.artifacts.map((artifact) => ({
          ...artifact,
          artifact: {
            ...artifact.artifact,
            artifactRef: `fw:${'f'.repeat(64)}`,
            sha256: 'f'.repeat(64),
          },
        })),
      }),
    ).toThrow('not admitted by the bundled catalog');
  });
});
