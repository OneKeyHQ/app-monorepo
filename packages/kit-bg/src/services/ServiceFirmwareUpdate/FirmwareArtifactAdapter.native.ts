import { ReactNativeRangeDownloader } from '@onekeyfe/react-native-range-downloader';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IFirmwareArtifactAdapter } from './FirmwareArtifactAdapter.types';

const assertBackgroundRuntime = () => {
  if (
    !platformEnv.isJest &&
    (!platformEnv.isNative || platformEnv.isNativeMainThread)
  ) {
    throw new OneKeyLocalError(
      'Firmware artifacts are only available in the native background runtime',
    );
  }
};

export const firmwareArtifactAdapter: IFirmwareArtifactAdapter = {
  getCapabilities() {
    assertBackgroundRuntime();
    const capabilities =
      ReactNativeRangeDownloader.getFirmwareArtifactCapabilities();
    return {
      ...capabilities,
      supportedRouteTypes: ['domain'],
    };
  },
  async download(input) {
    assertBackgroundRuntime();
    return ReactNativeRangeDownloader.downloadFirmwareArtifact({
      taskId: input.taskId,
      transactionId: input.transactionId,
      leaseRef: input.leaseRef,
      artifactId: input.artifactId,
      url: input.url,
      routeType: 'domain',
      resolvedIp: undefined,
      ...(input.expectedSize !== undefined
        ? { expectedSize: input.expectedSize }
        : {}),
      ...(input.expectedSha256 ? { expectedSha256: input.expectedSha256 } : {}),
      maxBytes: input.maxBytes,
      overallDeadlineSeconds: input.overallDeadlineSeconds,
    });
  },
  cancelDownloads(transactionId) {
    assertBackgroundRuntime();
    return ReactNativeRangeDownloader.cancelFirmwareArtifactDownloads({
      transactionId,
    });
  },
  async materialize(input) {
    assertBackgroundRuntime();
    const result = await ReactNativeRangeDownloader.materializeFirmwareArchive({
      leaseRef: input.leaseRef,
      archiveArtifactRef: input.archiveArtifactRef,
      ...(input.expectedEntries
        ? { expectedEntries: [...input.expectedEntries] }
        : {}),
    });
    return result.artifacts;
  },
  open(artifactRef) {
    assertBackgroundRuntime();
    return ReactNativeRangeDownloader.openFirmwareArtifact({ artifactRef });
  },
  read(input) {
    assertBackgroundRuntime();
    return ReactNativeRangeDownloader.readFirmwareArtifact(input);
  },
  close(readerId) {
    assertBackgroundRuntime();
    return ReactNativeRangeDownloader.closeFirmwareArtifact({ readerId });
  },
  createLease(transactionId) {
    assertBackgroundRuntime();
    return ReactNativeRangeDownloader.createFirmwareArtifactLease({
      transactionId,
    });
  },
  retain(input) {
    assertBackgroundRuntime();
    return ReactNativeRangeDownloader.retainFirmwareArtifact(input);
  },
  releaseLease(input) {
    assertBackgroundRuntime();
    return ReactNativeRangeDownloader.releaseFirmwareArtifactLease(input);
  },
  sweepOrphans() {
    assertBackgroundRuntime();
    return ReactNativeRangeDownloader.sweepFirmwareArtifactOrphans();
  },
};
