import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IFirmwareArtifactAdapter } from './FirmwareArtifactAdapter.types';

const unavailable = (): never => {
  throw new OneKeyLocalError(
    'External firmware artifacts are not used on this platform',
  );
};

export const firmwareArtifactAdapter: IFirmwareArtifactAdapter = {
  getCapabilities: unavailable,
  download: unavailable,
  cancelDownloads: unavailable,
  materialize: unavailable,
  open: unavailable,
  read: unavailable,
  close: unavailable,
  createLease: unavailable,
  retain: unavailable,
  releaseLease: unavailable,
  reconcileLeases: unavailable,
  sweepOrphans: unavailable,
};
