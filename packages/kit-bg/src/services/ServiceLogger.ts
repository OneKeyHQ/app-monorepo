import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ILoggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import {
  BROWSER_LOG_MAX_BYTES,
  type ILogExportScope,
  RECENT_LOG_EXPORT_BYTES,
} from '@onekeyhq/shared/src/logger/types';
import loggerUtils from '@onekeyhq/shared/src/logger/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';

import { BrowserLogExport } from './logger/BrowserLogExport';
import { createLogArchive } from './logger/createLogArchive';
import createLogStore from './logger/createLogStore';
import { notifyLogReset } from './logger/logReset';
import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceLogger extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  maxLength = 1000;

  private persistentLogs = createLogStore();

  private logExport = new BrowserLogExport();

  private resettingLogs = false;

  // Circular buffer: O(1) insert, O(n) read (read is infrequent)
  private buffer: string[] = [];

  private writeIndex = 0;

  private isFull = false;

  @backgroundMethod()
  async getAllMsg() {
    if (this.persistentLogs) {
      throw new OneKeyLocalError('Persistent logs require paginated export');
    }
    if (!this.isFull) {
      return Promise.resolve(this.buffer.slice(0, this.writeIndex));
    }
    // Return in chronological order: oldest → newest
    return Promise.resolve([
      ...this.buffer.slice(this.writeIndex),
      ...this.buffer.slice(0, this.writeIndex),
    ]);
  }

  @backgroundMethod()
  async addMsg(message: string) {
    if (this.persistentLogs) {
      await this.persistentLogs.add(message);
      return true;
    }
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      if (this.buffer.length < this.maxLength) {
        this.buffer.push(message);
      } else {
        this.buffer[this.writeIndex] = message;
        this.isFull = true;
      }
      this.writeIndex = (this.writeIndex + 1) % this.maxLength;
    }
    return Promise.resolve(true);
  }

  async stopPersistenceForReset(clear = true) {
    this.resettingLogs = true;
    this.logExport.close();
    if (clear) notifyLogReset();
    // The general reset also clears all buckets/databases if explicit deletion fails.
    await this.persistentLogs?.stop(clear).catch(() => {});
  }

  @backgroundMethod()
  async beginLogExport({ scope = 'recent' }: { scope?: ILogExportScope } = {}) {
    if (scope !== 'recent' && scope !== 'full')
      throw new OneKeyLocalError('Invalid log export scope');
    const store = this.persistentLogs;
    if (!store || this.resettingLogs)
      throw new OneKeyLocalError('Log export unavailable');
    return this.logExport.begin(async (isCancelled) => {
      // Web shares the UI heap; extension background must also flush its own tail.
      await loggerUtils.flushPendingRepeat();
      const snapshot = await store.snapshot(
        scope === 'full' ? BROWSER_LOG_MAX_BYTES : RECENT_LOG_EXPORT_BYTES,
      );
      return createLogArchive(snapshot, isCancelled);
    });
  }

  @backgroundMethod()
  async readLogExportPage(params: { id: string; offset: number }) {
    return this.logExport.read(params);
  }

  @backgroundMethod()
  async closeLogExport({ id }: { id: string }) {
    this.logExport.close(id);
  }

  /**
   * Persist a logger config from the UI. On native, main and bg hold
   * separate LoggerConfigManager singletons in isolated JS heaps; routing the
   * save through bg keeps the runtime that emits most logs in sync without a
   * restart. Callers must mirror the config into their own runtime afterwards.
   */
  @backgroundMethod()
  async updateLoggerConfig(config: ILoggerConfig) {
    loggerConfig.saveLoggerConfig(config);
  }

  @backgroundMethod()
  async requestUploadToken(payload: { sizeBytes: number; sha256: string }) {
    if (payload.sizeBytes <= 0) {
      throw new OneKeyLocalError('Log bundle is empty');
    }
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const response = await client.post<
      IApiClientResponse<{ uploadToken: string; expiresAt: number }>
    >('/wallet/v1/client/log/token', payload);
    return response.data.data;
  }
}

export default ServiceLogger;
