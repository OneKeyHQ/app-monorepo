import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import type { IFirmwareUpdateJournalEnvelope } from '../../../services/ServiceFirmwareUpdate/FirmwareUpdateJournal';

type IFirmwareUpdateJournalStorageCorruptionError = OneKeyLocalError & {
  firmwareUpdateJournalStorageCorruption: true;
};

const createStorageCorruptionError =
  (): IFirmwareUpdateJournalStorageCorruptionError =>
    Object.assign(
      new OneKeyLocalError(
        'Firmware update journal storage envelope is invalid',
      ),
      { firmwareUpdateJournalStorageCorruption: true as const },
    );

export const isFirmwareUpdateJournalStorageCorruptionError = (
  error: unknown,
): error is IFirmwareUpdateJournalStorageCorruptionError =>
  error instanceof OneKeyLocalError &&
  (error as Partial<IFirmwareUpdateJournalStorageCorruptionError>)
    .firmwareUpdateJournalStorageCorruption === true;

export class SimpleDbEntityFirmwareUpdateJournal extends SimpleDbEntityBase<IFirmwareUpdateJournalEnvelope> {
  entityName = 'firmwareUpdateJournal';

  override enableCache = false;

  private get quarantineKey() {
    return `${this.entityKey}:quarantine`;
  }

  async readPersistedEnvelope(): Promise<{
    exists: boolean;
    data?: unknown;
  }> {
    const persisted = await this.appStorage.getItem(this.entityKey);
    if (persisted === null || persisted === undefined) {
      return { exists: false };
    }
    let parsed: unknown;
    try {
      parsed =
        typeof persisted === 'string' ? JSON.parse(persisted) : persisted;
    } catch {
      throw createStorageCorruptionError();
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Object.prototype.hasOwnProperty.call(parsed, 'data')
    ) {
      throw createStorageCorruptionError();
    }
    return {
      exists: true,
      data: (parsed as { data: unknown }).data,
    };
  }

  async quarantinePersistedEnvelope(): Promise<boolean> {
    return this.mutex.runExclusive(async () => {
      const persisted = await this.appStorage.getItem(this.entityKey);
      if (persisted === null || persisted === undefined) {
        return false;
      }
      await this.appStorage.setItem(
        this.quarantineKey,
        JSON.stringify({
          quarantinedAt: Date.now(),
          persisted,
        }),
      );
      await this.appStorage.removeItem(this.entityKey);
      this.clearRawDataCache();
      return true;
    });
  }
}
