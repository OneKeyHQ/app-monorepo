import { unzipSync } from 'fflate';

import { BrowserLogStore } from './logger/BrowserLogStore';
import ServiceLogger from './ServiceLogger';

import type { IBrowserLogDatabase } from './logger/BrowserLogDatabase';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('./logger/logReset', () => ({
  notifyLogReset: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/utils', () => ({
  __esModule: true,
  default: {
    flushPendingRepeat: jest.fn().mockResolvedValue(undefined),
  },
}));

function createInMemoryLogDatabase(): IBrowserLogDatabase & {
  lines: string[];
  closedWithClear?: boolean;
} {
  const db = {
    lines: [] as string[],
    closedWithClear: undefined as boolean | undefined,
    async append(messages: string[]) {
      db.lines.push(...messages);
    },
    async snapshot() {
      return new Blob([db.lines.join('')], { type: 'text/plain' });
    },
    async close(clear = false) {
      db.closedWithClear = clear;
      if (clear) db.lines = [];
    },
  };
  return db;
}

describe('ServiceLogger reset diagnostic export', () => {
  it('blocks export while reset is running and exports only post-reset diagnostic logs after failure', async () => {
    const database = createInMemoryLogDatabase();
    const service = new ServiceLogger({ backgroundApi: {} });
    (service as unknown as { persistentLogs: BrowserLogStore }).persistentLogs =
      new BrowserLogStore(database);

    await service.addMsg('pre-reset secret wallet log\r\n');
    await service.stopPersistenceForReset(true);
    expect(database.closedWithClear).toBe(true);

    await service.addMsg(
      'setting.page.appResetStage stage=otherIndexedDBs event=blocked detail=workbox-expiration\r\n',
    );
    await service.addMsg(
      'setting.page.appResetStage stage=otherIndexedDBs event=timeout\r\n',
    );

    await expect(service.beginLogExport({ scope: 'recent' })).rejects.toThrow(
      'Log export unavailable during app reset',
    );

    service.markResetFailed();

    const started = await service.beginLogExport({ scope: 'recent' });
    const chunks: Uint8Array[] = [];
    let offset = 0;
    try {
      while (offset < started.sizeBytes) {
        const page = await service.readLogExportPage({
          id: started.id,
          offset,
        });
        const bytes = Buffer.from(page.data, 'base64');
        chunks.push(bytes);
        if (page.nextOffset <= offset) break;
        offset = page.nextOffset;
      }
    } finally {
      await service.closeLogExport({ id: started.id });
    }

    const archive = new Uint8Array(Buffer.concat(chunks));
    const files = unzipSync(archive);
    const content = Buffer.from(files['OneKeyLogs.txt']).toString('utf8');

    expect(content).not.toContain('pre-reset secret wallet log');
    expect(content).toContain('stage=otherIndexedDBs event=blocked');
    expect(content).toContain('stage=otherIndexedDBs event=timeout');

    service.beginResetAttempt();
    await expect(service.beginLogExport({ scope: 'recent' })).rejects.toThrow(
      'Log export unavailable during app reset',
    );
  });

  it('blocks new and existing exports immediately on beginResetAttempt and closes active sessions on retry', async () => {
    const database = createInMemoryLogDatabase();
    const service = new ServiceLogger({ backgroundApi: {} });
    (
      service as unknown as { persistentLogs: BrowserLogStore }
    ).persistentLogs = new BrowserLogStore(database);

    await service.addMsg('before-reset\r\n');
    const activeBeforeReset = await service.beginLogExport({ scope: 'recent' });

    service.beginResetAttempt();
    await expect(service.beginLogExport({ scope: 'recent' })).rejects.toThrow(
      'Log export unavailable during app reset',
    );
    await expect(
      service.readLogExportPage({ id: activeBeforeReset.id, offset: 0 }),
    ).rejects.toThrow('Log export expired');

    await service.stopPersistenceForReset(true);
    await service.addMsg('reset failure detail\r\n');
    service.markResetFailed();

    const activeDiagnostic = await service.beginLogExport({ scope: 'recent' });
    service.beginResetAttempt();
    await expect(
      service.readLogExportPage({ id: activeDiagnostic.id, offset: 0 }),
    ).rejects.toThrow('Log export expired');
  });

  it('keeps sibling tabs stopped by broadcast in discard mode even if markResetFailed is called', async () => {
    const database = createInMemoryLogDatabase();
    const service = new ServiceLogger({ backgroundApi: {} });
    (
      service as unknown as { persistentLogs: BrowserLogStore }
    ).persistentLogs = new BrowserLogStore(database);

    await service.stopPersistenceForReset(false);
    await service.addMsg('delayed pre-reset log in sibling tab\r\n');
    service.markResetFailed();

    await expect(service.beginLogExport({ scope: 'recent' })).rejects.toThrow(
      'Log export unavailable during app reset',
    );
  });
});
