import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IFirmwareArtifactAdapter } from './FirmwareArtifactAdapter.types';

const getDesktopAdapter = (): IFirmwareArtifactAdapter => {
  const adapter = (
    globalThis.desktopApiProxy as unknown as {
      firmwareArtifact?: IFirmwareArtifactAdapter;
    }
  ).firmwareArtifact;
  if (!adapter) {
    throw new OneKeyLocalError('Desktop firmware artifact API is unavailable');
  }
  return adapter;
};

export const firmwareArtifactAdapter: IFirmwareArtifactAdapter = {
  getCapabilities: () => getDesktopAdapter().getCapabilities(),
  download: (input) => getDesktopAdapter().download(input),
  cancelDownloads: (transactionId) =>
    getDesktopAdapter().cancelDownloads(transactionId),
  materialize: (input) => getDesktopAdapter().materialize(input),
  open: (artifactRef) => getDesktopAdapter().open(artifactRef),
  read: (input) => getDesktopAdapter().read(input),
  close: (readerId) => getDesktopAdapter().close(readerId),
  createLease: (transactionId) =>
    getDesktopAdapter().createLease(transactionId),
  retain: (input) => getDesktopAdapter().retain(input),
  releaseLease: (input) => getDesktopAdapter().releaseLease(input),
  sweepOrphans: () => getDesktopAdapter().sweepOrphans(),
};
