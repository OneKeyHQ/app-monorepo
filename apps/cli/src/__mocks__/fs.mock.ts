import path from 'node:path';

import { Volume, createFsFromVolume } from 'memfs';

import type { Stats } from 'node:fs';

export type IFsMock = ReturnType<typeof createFsMock>;

export function createFsMock(initialJson: Record<string, string> = {}) {
  const volume = Volume.fromJSON(initialJson, '/');
  const fs = createFsFromVolume(volume) as unknown as typeof import('node:fs');

  return {
    volume,
    async readFile(filePath: string): Promise<Buffer> {
      return fs.promises.readFile(filePath);
    },
    async writeFile(filePath: string, data: Buffer | string): Promise<void> {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, data);
    },
    async rename(fromPath: string, toPath: string): Promise<void> {
      await fs.promises.mkdir(path.dirname(toPath), { recursive: true });
      await fs.promises.rename(fromPath, toPath);
    },
    async unlink(filePath: string): Promise<void> {
      await fs.promises.unlink(filePath);
    },
    exists(filePath: string): boolean {
      return fs.existsSync(filePath);
    },
    async stat(filePath: string): Promise<Stats> {
      return fs.promises.stat(filePath);
    },
  };
}
