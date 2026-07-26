import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IFirmwareArtifactStoreAdapter } from '../FirmwareArtifactStore';

type IDesktopFirmwareArtifactProxy = IFirmwareArtifactStoreAdapter;

const getFirmwareArtifactProxy = (): IDesktopFirmwareArtifactProxy => {
  const proxy = (
    globalThis.desktopApiProxy as unknown as {
      firmwareArtifact?: IDesktopFirmwareArtifactProxy;
    }
  ).firmwareArtifact;
  if (!proxy) {
    throw new OneKeyLocalError(
      'Desktop firmware artifact API is not available',
    );
  }
  return proxy;
};

export class FirmwareArtifactDesktopAdapter implements IFirmwareArtifactStoreAdapter {
  getCapabilities() {
    return getFirmwareArtifactProxy().getCapabilities();
  }

  async downloadArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['downloadArtifact']>[0],
  ) {
    const proxy = getFirmwareArtifactProxy();
    try {
      return await proxy.downloadArtifact(input);
    } catch (error) {
      const status = await proxy
        .getArtifactStatus({
          leaseRef: input.leaseRef,
          taskId: input.taskId,
        })
        .catch(() => undefined);
      if (status?.errorCode) {
        throw Object.assign(
          new OneKeyLocalError(
            status.errorMessage || 'Desktop firmware artifact download failed',
          ),
          {
            firmwareArtifactNativeCode: status.errorCode,
            firmwareArtifactNativeRetryable: status.retryable === true,
            cause: error,
          },
        );
      }
      throw error;
    }
  }

  getArtifactStatus(
    input: Parameters<IFirmwareArtifactStoreAdapter['getArtifactStatus']>[0],
  ) {
    return getFirmwareArtifactProxy().getArtifactStatus(input);
  }

  cancelDownload(
    input: Parameters<IFirmwareArtifactStoreAdapter['cancelDownload']>[0],
  ) {
    return getFirmwareArtifactProxy().cancelDownload(input);
  }

  quarantineArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['quarantineArtifact']>[0],
  ) {
    return getFirmwareArtifactProxy().quarantineArtifact(input);
  }

  openArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['openArtifact']>[0],
  ) {
    return getFirmwareArtifactProxy().openArtifact(input);
  }

  readArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['readArtifact']>[0],
  ) {
    return getFirmwareArtifactProxy().readArtifact(input);
  }

  closeArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['closeArtifact']>[0],
  ) {
    return getFirmwareArtifactProxy().closeArtifact(input);
  }

  materializeArchive(
    input: Parameters<IFirmwareArtifactStoreAdapter['materializeArchive']>[0],
  ) {
    return getFirmwareArtifactProxy().materializeArchive(input);
  }

  createLease(
    input: Parameters<IFirmwareArtifactStoreAdapter['createLease']>[0],
  ) {
    return getFirmwareArtifactProxy().createLease(input);
  }

  retainArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['retainArtifact']>[0],
  ) {
    return getFirmwareArtifactProxy().retainArtifact(input);
  }

  releaseLease(
    input: Parameters<IFirmwareArtifactStoreAdapter['releaseLease']>[0],
  ) {
    return getFirmwareArtifactProxy().releaseLease(input);
  }

  reconcileLeases(
    input: Parameters<IFirmwareArtifactStoreAdapter['reconcileLeases']>[0],
  ) {
    return getFirmwareArtifactProxy().reconcileLeases(input);
  }

  sweepOrphans() {
    return getFirmwareArtifactProxy().sweepOrphans();
  }
}
