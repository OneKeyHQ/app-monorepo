import type { IFirmwareUpdateCapabilityGate } from '@onekeyhq/shared/src/hardware/firmwareUpdateCapabilities';

import type { FirmwareArtifactStore } from './FirmwareArtifactStore';
import type { FirmwareUpdateCoordinator } from './FirmwareUpdateCoordinator';
import type {
  IFirmwareUpdateCoordinatorProjection,
  IFirmwareUpdateJournalEnvelope,
} from './firmwareUpdateCoordinatorTypes';
import type { FirmwareUpdateJournal } from './FirmwareUpdateJournal';

export const FIRMWARE_UPDATE_JOURNAL_RECOVERY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type IFirmwareUpdateBootstrapRecoverySnapshot = {
  journal: IFirmwareUpdateJournalEnvelope | undefined;
  capabilityGate: IFirmwareUpdateCapabilityGate | undefined;
  expired: boolean;
  projection: IFirmwareUpdateCoordinatorProjection | undefined;
};

type IFirmwareUpdateBootstrapRecoveryDependencies<TEligibilityContext> = {
  journal: Pick<FirmwareUpdateJournal, 'read'>;
  artifactStore: Pick<
    FirmwareArtifactStore,
    'reconcileLeases' | 'sweepOrphans'
  >;
  coordinator: Pick<
    FirmwareUpdateCoordinator<TEligibilityContext>,
    'initializeFromJournal'
  >;
  getCapabilityGate: (
    hasActiveJournal: boolean,
  ) => Promise<IFirmwareUpdateCapabilityGate>;
  recoverTransaction: (input: {
    journal: IFirmwareUpdateJournalEnvelope;
    expired: boolean;
  }) => Promise<IFirmwareUpdateCoordinatorProjection | undefined>;
  now: () => number;
};

export class FirmwareUpdateBootstrapRecovery<TEligibilityContext> {
  private criticalSnapshot:
    | IFirmwareUpdateBootstrapRecoverySnapshot
    | undefined;

  constructor(
    private readonly dependencies: IFirmwareUpdateBootstrapRecoveryDependencies<TEligibilityContext>,
  ) {}

  async initializeCritical(): Promise<IFirmwareUpdateBootstrapRecoverySnapshot> {
    const journal = await this.dependencies.journal.read();
    const hasActiveJournal = Boolean(journal && !journal.terminalTombstone);
    const capabilityGate = hasActiveJournal
      ? await this.dependencies.getCapabilityGate(true)
      : undefined;
    const expired = Boolean(
      journal &&
      !journal.terminalTombstone &&
      this.dependencies.now() - journal.updatedAt >
        FIRMWARE_UPDATE_JOURNAL_RECOVERY_TTL_MS,
    );
    const projection =
      await this.dependencies.coordinator.initializeFromJournal(
        capabilityGate && !capabilityGate.ready
          ? {
              journal,
              unavailableReason: capabilityGate.failure,
              recoveryReason:
                'Firmware recovery capability versions are incompatible',
            }
          : { journal },
      );
    const snapshot = {
      journal,
      capabilityGate,
      expired,
      projection,
    };
    this.criticalSnapshot = snapshot;
    return snapshot;
  }

  async recoverAfterCritical(): Promise<
    IFirmwareUpdateCoordinatorProjection | undefined
  > {
    const snapshot = this.criticalSnapshot ?? (await this.initializeCritical());
    const activeJournal =
      snapshot.journal && !snapshot.journal.terminalTombstone
        ? snapshot.journal
        : undefined;
    await this.dependencies.artifactStore.reconcileLeases(
      activeJournal?.leaseRef ? [activeJournal.leaseRef] : [],
    );
    try {
      if (
        !activeJournal ||
        (snapshot.capabilityGate && !snapshot.capabilityGate.ready)
      ) {
        return snapshot.projection;
      }
      return await this.dependencies.recoverTransaction({
        journal: activeJournal,
        expired: snapshot.expired,
      });
    } finally {
      await this.dependencies.artifactStore.sweepOrphans();
    }
  }
}
