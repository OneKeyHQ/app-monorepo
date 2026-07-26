import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IFirmwareArtifactStoreAdapter } from '../FirmwareArtifactStore';

export class FirmwareArtifactNativeAdapter implements IFirmwareArtifactStoreAdapter {
  private unavailable(): never {
    throw new OneKeyLocalError(
      'FirmwareArtifactNativeAdapter is available only in the Native background bundle',
    );
  }

  getCapabilities(): ReturnType<
    IFirmwareArtifactStoreAdapter['getCapabilities']
  > {
    return this.unavailable();
  }

  downloadArtifact(): ReturnType<
    IFirmwareArtifactStoreAdapter['downloadArtifact']
  > {
    return this.unavailable();
  }

  getArtifactStatus(): ReturnType<
    IFirmwareArtifactStoreAdapter['getArtifactStatus']
  > {
    return this.unavailable();
  }

  cancelDownload(): ReturnType<
    IFirmwareArtifactStoreAdapter['cancelDownload']
  > {
    return this.unavailable();
  }

  quarantineArtifact(): ReturnType<
    IFirmwareArtifactStoreAdapter['quarantineArtifact']
  > {
    return this.unavailable();
  }

  openArtifact(): ReturnType<IFirmwareArtifactStoreAdapter['openArtifact']> {
    return this.unavailable();
  }

  readArtifact(): ReturnType<IFirmwareArtifactStoreAdapter['readArtifact']> {
    return this.unavailable();
  }

  closeArtifact(): ReturnType<IFirmwareArtifactStoreAdapter['closeArtifact']> {
    return this.unavailable();
  }

  materializeArchive(): ReturnType<
    IFirmwareArtifactStoreAdapter['materializeArchive']
  > {
    return this.unavailable();
  }

  createLease(): ReturnType<IFirmwareArtifactStoreAdapter['createLease']> {
    return this.unavailable();
  }

  retainArtifact(): ReturnType<
    IFirmwareArtifactStoreAdapter['retainArtifact']
  > {
    return this.unavailable();
  }

  releaseLease(): ReturnType<IFirmwareArtifactStoreAdapter['releaseLease']> {
    return this.unavailable();
  }

  reconcileLeases(): ReturnType<
    IFirmwareArtifactStoreAdapter['reconcileLeases']
  > {
    return this.unavailable();
  }

  sweepOrphans(): ReturnType<IFirmwareArtifactStoreAdapter['sweepOrphans']> {
    return this.unavailable();
  }
}
