import os from 'os';

import type { IDesktopApiPlatformInfo } from '@onekeyhq/shared/types/desktopApiPlatformInfo';

import { getProcessStartAt } from './getProcessStartAt';

// cspell:ignore Flathub bubblewrap
const getChannel = (): string | undefined => {
  let channel: string | undefined;
  if (process.platform === 'linux') {
    // Flatpak MUST be detected first, and via RUNTIME signals: the Flathub
    // package re-extracts our prebuilt AppImage, so the build-time
    // `DESK_CHANNEL=appImage` define is baked in and would otherwise win and
    // mis-tag the flatpak as an AppImage. `FLATPAK_ID` is exported by the
    // flatpak launcher and `container=flatpak` is set by bubblewrap; neither
    // is an esbuild `define`, so both reflect the real runtime environment.
    // (`FLATPAK` itself is a build-time define and only set for a dedicated
    // flatpak build, kept here as an extra signal.)
    if (
      process.env.FLATPAK ||
      process.env.FLATPAK_ID ||
      process.env.container === 'flatpak'
    ) {
      channel = 'flatpak';
    } else if (process.env.DESK_CHANNEL === 'appImage') {
      // AppImage is detected via the build-time `DESK_CHANNEL=appImage` flag
      // (set in release-desktop-all.yml and baked in by esbuild `define`).
      // We deliberately do not use the runtime `APPIMAGE` env for detection —
      // it can be empty when a wrapper launcher strips it, giving a false
      // negative for what is in fact an AppImage build.
      channel = 'appImage';
    } else if (process.env.SNAP) {
      channel = 'snap';
    }
  }
  return channel;
};

export const buildDesktopPlatformInfo = (): IDesktopApiPlatformInfo => ({
  arch: process.arch,
  platform: process.platform,
  systemVersion:
    typeof process.getSystemVersion === 'function'
      ? process.getSystemVersion()
      : '',
  logicalProcessorCount:
    typeof os.availableParallelism === 'function'
      ? os.availableParallelism()
      : os.cpus().length,
  totalMemoryBytes: os.totalmem(),
  isMas: Boolean((process as { mas?: boolean }).mas),
  channel: getChannel(),
  deskChannel: process.env.DESK_CHANNEL || '',
  processStartAt: getProcessStartAt(),
  supportsShareImageFile: process.platform === 'darwin',
});

let cachedDesktopPlatformInfo: IDesktopApiPlatformInfo | undefined;

// Hardware and process metadata are stable for the Electron main-process
// lifetime. Both platform-info writers share this lazy snapshot.
export const getDesktopPlatformInfo = (): IDesktopApiPlatformInfo => {
  cachedDesktopPlatformInfo ??= buildDesktopPlatformInfo();
  return cachedDesktopPlatformInfo;
};
