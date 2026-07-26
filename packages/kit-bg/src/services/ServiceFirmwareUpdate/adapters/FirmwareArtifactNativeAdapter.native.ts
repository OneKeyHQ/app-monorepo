import {
  type FirmwareArtifactCapabilities,
  type FirmwareArtifactReceipt,
  ReactNativeRangeDownloader,
} from '@onekeyfe/react-native-range-downloader';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  IFirmwareArchiveMaterializedArtifact,
  IFirmwareArtifactAdapterReceipt,
  IFirmwareArtifactStoreAdapter,
} from '../FirmwareArtifactStore';

type IFirmwareNativeModule = typeof ReactNativeRangeDownloader & {
  quarantineFirmwareArtifact: (input: { artifactRef: string }) => Promise<void>;
};

const nativeModule =
  ReactNativeRangeDownloader as unknown as IFirmwareNativeModule;

const assertNativeBackgroundRuntime = () => {
  if (
    !platformEnv.isJest &&
    (!platformEnv.isNative || platformEnv.isNativeMainThread)
  ) {
    throw new OneKeyLocalError(
      'FirmwareArtifactNativeAdapter must run in the Native background bundle',
    );
  }
};

const normalizeReceipt = (
  receipt: FirmwareArtifactReceipt,
): IFirmwareArtifactAdapterReceipt => ({
  artifactRef: receipt.artifactRef,
  size: receipt.size,
  sha256: receipt.sha256,
  immutableToken: receipt.immutableToken,
});

export class FirmwareArtifactNativeAdapter implements IFirmwareArtifactStoreAdapter {
  constructor() {
    assertNativeBackgroundRuntime();
  }

  async getCapabilities() {
    const capabilities: FirmwareArtifactCapabilities =
      nativeModule.getFirmwareArtifactCapabilities();
    return {
      ...capabilities,
      supportedRouteTypes: capabilities.supportedRouteTypes.filter(
        (route): route is 'domain' | 'pinnedIp' =>
          route === 'domain' || route === 'pinnedIp',
      ),
    };
  }

  async downloadArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['downloadArtifact']>[0],
  ) {
    try {
      return normalizeReceipt(
        await nativeModule.downloadFirmwareArtifact(input),
      );
    } catch (error) {
      const status = await nativeModule
        .getFirmwareArtifactStatus({
          leaseRef: input.leaseRef,
          taskId: input.taskId,
        })
        .catch(() => undefined);
      if (status?.errorCode) {
        throw Object.assign(
          new OneKeyLocalError(
            status.errorMessage || 'Native firmware artifact download failed',
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

  async getArtifactStatus(
    input: Parameters<IFirmwareArtifactStoreAdapter['getArtifactStatus']>[0],
  ) {
    const status = await nativeModule.getFirmwareArtifactStatus(input);
    return {
      ...status,
      ...(status.receipt
        ? { receipt: normalizeReceipt(status.receipt) }
        : { receipt: undefined }),
    };
  }

  cancelDownload(
    input: Parameters<IFirmwareArtifactStoreAdapter['cancelDownload']>[0],
  ) {
    return nativeModule.cancelFirmwareArtifact(input);
  }

  quarantineArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['quarantineArtifact']>[0],
  ) {
    return nativeModule.quarantineFirmwareArtifact(input);
  }

  openArtifact(receipt: IFirmwareArtifactAdapterReceipt) {
    return nativeModule.openFirmwareArtifact({
      artifactRef: receipt.artifactRef,
      immutableToken: receipt.immutableToken,
    });
  }

  readArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['readArtifact']>[0],
  ) {
    return nativeModule.readFirmwareArtifact(input);
  }

  closeArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['closeArtifact']>[0],
  ) {
    return nativeModule.closeFirmwareArtifact(input);
  }

  async materializeArchive(
    input: Parameters<IFirmwareArtifactStoreAdapter['materializeArchive']>[0],
  ) {
    const result = await nativeModule.materializeFirmwareArchive(input);
    return {
      artifacts: result.artifacts.map(
        (artifact): IFirmwareArchiveMaterializedArtifact => ({
          archiveName: artifact.archiveName,
          artifactId: artifact.artifactId,
          receipt: normalizeReceipt(artifact.receipt),
        }),
      ),
    };
  }

  createLease(
    input: Parameters<IFirmwareArtifactStoreAdapter['createLease']>[0],
  ) {
    return nativeModule.createFirmwareArtifactLease(input);
  }

  retainArtifact(
    input: Parameters<IFirmwareArtifactStoreAdapter['retainArtifact']>[0],
  ) {
    return nativeModule.retainFirmwareArtifact(input);
  }

  releaseLease(
    input: Parameters<IFirmwareArtifactStoreAdapter['releaseLease']>[0],
  ) {
    return nativeModule.releaseFirmwareArtifactLease(input);
  }

  reconcileLeases(
    input: Parameters<IFirmwareArtifactStoreAdapter['reconcileLeases']>[0],
  ) {
    return nativeModule.reconcileFirmwareArtifactLeases(input);
  }

  sweepOrphans() {
    return nativeModule.sweepFirmwareArtifactOrphans();
  }
}
