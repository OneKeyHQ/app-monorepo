/**
 * Re-export bridge for the few `node:fs` calls inside `store.ts`. Exists for
 * the same reason as `crypto-bridge.ts`: `node:fs` exports cannot be spied
 * directly under jest. Tests stub `fsBridge.renameSync` to simulate atomic
 * rename failures (AC5).
 */
import {
  closeSync as nodeCloseSync,
  fsyncSync as nodeFsyncSync,
  openSync as nodeOpenSync,
  renameSync as nodeRenameSync,
  unlinkSync as nodeUnlinkSync,
  writeSync as nodeWriteSync,
} from 'node:fs';

export const fsBridge = {
  openSync: (path: string, flags: string, mode?: number) =>
    nodeOpenSync(path, flags, mode),
  writeSync: (fd: number, data: string) => nodeWriteSync(fd, data),
  fsyncSync: (fd: number) => nodeFsyncSync(fd),
  closeSync: (fd: number) => nodeCloseSync(fd),
  renameSync: (from: string, to: string) => nodeRenameSync(from, to),
  unlinkSync: (path: string) => nodeUnlinkSync(path),
};
