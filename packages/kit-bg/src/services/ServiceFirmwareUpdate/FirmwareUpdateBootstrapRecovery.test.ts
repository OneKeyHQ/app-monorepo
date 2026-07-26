import type { IFirmwareUpdateCapabilityGate } from '@onekeyhq/shared/src/hardware/firmwareUpdateCapabilities';

import {
  FIRMWARE_UPDATE_JOURNAL_RECOVERY_TTL_MS,
  FirmwareUpdateBootstrapRecovery,
} from './FirmwareUpdateBootstrapRecovery';

import type {
  IFirmwareUpdateCoordinatorProjection,
  IFirmwareUpdateJournalEnvelope,
} from './firmwareUpdateCoordinatorTypes';

const READY_GATE: IFirmwareUpdateCapabilityGate = {
  ready: true,
  engine: 'transaction',
  planSchemaVersion: 1,
  preparedPlanSchemaVersion: 1,
  hostBindingProtocolVersion: 1,
  checkpointSchemaVersion: 1,
  artifactProtocolVersion: 1,
  maxReadBytes: 256 * 1024,
};

const createJournal = (
  overrides: Partial<IFirmwareUpdateJournalEnvelope> = {},
): IFirmwareUpdateJournalEnvelope => ({
  schemaVersion: 1,
  transactionId: 'transaction-1',
  revision: 4,
  createdAt: 100,
  updatedAt: 200,
  phase: 'ACQUIRING',
  cancelDisposition: 'none',
  capabilities: {
    appJournalSchemaVersion: 1,
    sdkPlanSchemaVersion: 1,
    sdkPreparedPlanSchemaVersion: 1,
    sdkHostBindingProtocolVersion: 1,
    sdkCheckpointSchemaVersion: 1,
    artifactRuntime: 'native',
    artifactProtocolVersion: 1,
    maxReadBytes: 256 * 1024,
  },
  stableDeviceId: 'device-1',
  model: 'classic1s',
  deviceSnapshotDigest: 'a'.repeat(64),
  artifacts: [],
  leaseRef: 'lease-1',
  checkpointSeq: -1,
  rollout: {
    policyVersion: 1,
    cohortBucket: 10,
    engine: 'fnv1a32-v1',
    eligibilityAttestationDigest: 'b'.repeat(64),
  },
  ...overrides,
});

const createProjection = (
  journal: IFirmwareUpdateJournalEnvelope,
): IFirmwareUpdateCoordinatorProjection => ({
  sessionId: journal.transactionId,
  revision: journal.revision,
  phase: journal.phase,
  engine: 'transaction',
  action: 'none',
});

const createHarness = ({
  journal = createJournal(),
  capabilityGate = READY_GATE,
  now = 300,
}: {
  journal?: IFirmwareUpdateJournalEnvelope | undefined;
  capabilityGate?: IFirmwareUpdateCapabilityGate;
  now?: number;
} = {}) => {
  const order: string[] = [];
  const projection = journal ? createProjection(journal) : undefined;
  const dependencies = {
    journal: {
      read: jest.fn(async () => {
        order.push('journal-load');
        return journal;
      }),
    },
    artifactStore: {
      reconcileLeases: jest.fn(async () => {
        order.push('lease-reconcile');
      }),
      sweepOrphans: jest.fn(async () => {
        order.push('orphan-sweep');
        return {
          deletedFiles: 0,
          deletedBytes: 0,
        };
      }),
    },
    coordinator: {
      initializeFromJournal: jest.fn(async () => {
        order.push('projection');
        return projection;
      }),
    },
    getCapabilityGate: jest.fn(async () => {
      order.push('capability');
      return capabilityGate;
    }),
    recoverTransaction: jest.fn(async () => {
      order.push('recovery-decision');
      return projection;
    }),
    now: () => now,
  };
  return {
    dependencies,
    order,
    recovery: new FirmwareUpdateBootstrapRecovery(dependencies),
  };
};

describe('FirmwareUpdateBootstrapRecovery', () => {
  it('keeps critical initialization local and defers recovery work', async () => {
    const { dependencies, order, recovery } = createHarness();

    await recovery.initializeCritical();

    expect(order).toEqual(['journal-load', 'capability', 'projection']);
    expect(dependencies.artifactStore.reconcileLeases).not.toHaveBeenCalled();
    expect(dependencies.recoverTransaction).not.toHaveBeenCalled();
  });

  it('reconciles the active lease before recovery and sweeps afterward', async () => {
    const { dependencies, order, recovery } = createHarness();
    await recovery.initializeCritical();

    await recovery.recoverAfterCritical();

    expect(order).toEqual([
      'journal-load',
      'capability',
      'projection',
      'lease-reconcile',
      'recovery-decision',
      'orphan-sweep',
    ]);
    expect(dependencies.artifactStore.reconcileLeases).toHaveBeenCalledWith([
      'lease-1',
    ]);
  });

  it('retains the active lease when recovery capabilities are incompatible', async () => {
    const { dependencies, order, recovery } = createHarness({
      capabilityGate: {
        ready: false,
        engine: 'recovery_unsupported',
        failure: 'sdk_capabilities_incompatible',
      },
    });

    await recovery.initializeCritical();
    await recovery.recoverAfterCritical();

    expect(dependencies.recoverTransaction).not.toHaveBeenCalled();
    expect(order.at(-2)).toBe('lease-reconcile');
    expect(order.at(-1)).toBe('orphan-sweep');
  });

  it('marks an old active journal as expired without deleting its lease', async () => {
    const journal = createJournal({
      updatedAt: 1,
      lastCommittedCheckpoint: {
        schemaVersion: 1,
        transactionId: 'transaction-1',
        planDigest: 'c'.repeat(64),
        sequence: 8,
        state: 'INSTALLING',
        timestampMs: 1,
        destructiveActionStarted: true,
        terminal: false,
      },
      checkpointSeq: 8,
    });
    const { dependencies, recovery } = createHarness({
      journal,
      now: FIRMWARE_UPDATE_JOURNAL_RECOVERY_TTL_MS + 2,
    });

    await recovery.initializeCritical();
    await recovery.recoverAfterCritical();

    expect(dependencies.recoverTransaction).toHaveBeenCalledWith({
      journal,
      expired: true,
    });
    expect(dependencies.artifactStore.reconcileLeases).toHaveBeenCalledWith([
      'lease-1',
    ]);
  });
});
