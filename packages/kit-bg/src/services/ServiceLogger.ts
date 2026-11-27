import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { ILoggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import {
  BROWSER_LOG_MAX_BYTES,
  ELogUploadStage,
  type ILogExportScope,
  type ILogUploadViaIpTableResult,
  RECENT_LOG_EXPORT_BYTES,
} from '@onekeyhq/shared/src/logger/types';
import loggerUtils from '@onekeyhq/shared/src/logger/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { withCustomUAHeaders } from '@onekeyhq/shared/src/request/customUA';
import { uploadFileViaIpTable } from '@onekeyhq/shared/src/request/helpers/ipTableAdapter';
import { sanitizeSniDiagnosticText } from '@onekeyhq/shared/src/request/helpers/sniLogRedaction';
import { getSniRequestErrorCode } from '@onekeyhq/shared/src/request/helpers/sniRequestQaUtils';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';

import { BrowserLogExport } from './logger/BrowserLogExport';
import { createLogArchive } from './logger/createLogArchive';
import createLogStore from './logger/createLogStore';
import { notifyLogReset } from './logger/logReset';
import ServiceBase from './ServiceBase';

const RESET_DIAGNOSTIC_LOG_MAX_BYTES = 256 * 1024;
const RESET_DIAGNOSTIC_MESSAGE_LIMIT = 2048;

@backgroundClass()
class ServiceLogger extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  maxLength = 1000;

  private persistentLogs = createLogStore();

  private logExport = new BrowserLogExport();

  private resettingLogs = false;

  private resetExportBlocked = false;

  private resetDiagnosticActive = false;

  private resetFailedDiagnosticExport = false;

  // In-memory diagnostic ring for logs emitted after stopPersistenceForReset(true),
  // allowing post-failure export without touching disk or retaining pre-reset logs.
  private resetDiagnosticBuffer: { message: string; bytes: number }[] = [];

  private resetDiagnosticBytes = 0;

  // Circular buffer: O(1) insert, O(n) read (read is infrequent)
  private buffer: string[] = [];

  private writeIndex = 0;

  private isFull = false;

  private appendResetDiagnosticMsg(message: string) {
    if (!message) return;
    const bounded =
      message.length > RESET_DIAGNOSTIC_MESSAGE_LIMIT
        ? `${message.slice(0, RESET_DIAGNOSTIC_MESSAGE_LIMIT - 16)}...(truncated)\r\n`
        : message;
    const bytes = new TextEncoder().encode(bounded).byteLength;
    this.resetDiagnosticBuffer.push({ message: bounded, bytes });
    this.resetDiagnosticBytes += bytes;
    while (
      this.resetDiagnosticBytes > RESET_DIAGNOSTIC_LOG_MAX_BYTES &&
      this.resetDiagnosticBuffer.length > 1
    ) {
      const removed = this.resetDiagnosticBuffer.shift();
      if (removed) this.resetDiagnosticBytes -= removed.bytes;
    }
  }

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
    if (this.resettingLogs) {
      if (this.resetDiagnosticActive) {
        this.appendResetDiagnosticMsg(message);
      }
      return true;
    }
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

  beginResetAttempt() {
    this.resetExportBlocked = true;
    this.resetFailedDiagnosticExport = false;
    this.logExport.close();
  }

  markResetFailed() {
    this.resetExportBlocked = false;
    if (this.resettingLogs && this.resetDiagnosticActive) {
      this.resetFailedDiagnosticExport = true;
    }
  }

  async stopPersistenceForReset(clear = true, clearDatabase = clear) {
    this.resettingLogs = true;
    this.resetDiagnosticActive = clear;
    this.resetFailedDiagnosticExport = false;
    this.resetDiagnosticBuffer = [];
    this.resetDiagnosticBytes = 0;
    this.logExport.close();
    if (clear) notifyLogReset();
    // ServiceApp erases both storage layouts without queuing a default IDB delete.
    await this.persistentLogs?.stop(clearDatabase).catch(() => {});
  }

  @backgroundMethod()
  async beginLogExport({ scope = 'recent' }: { scope?: ILogExportScope } = {}) {
    if (scope !== 'recent' && scope !== 'full')
      throw new OneKeyLocalError('Invalid log export scope');
    if (this.resetExportBlocked) {
      throw new OneKeyLocalError('Log export unavailable during app reset');
    }
    if (this.resettingLogs) {
      if (!this.resetFailedDiagnosticExport || !this.resetDiagnosticActive) {
        throw new OneKeyLocalError('Log export unavailable during app reset');
      }
      return this.logExport.begin(async (isCancelled) => {
        await loggerUtils.flushPendingRepeat();
        // resetDiagnosticBuffer is already capped at 256 KiB (below both export limits).
        const snapshot = new Blob(
          this.resetDiagnosticBuffer.map((item) => item.message),
          { type: 'text/plain' },
        );
        return createLogArchive(snapshot, isCancelled);
      });
    }
    const store = this.persistentLogs;
    if (!store)
      throw new OneKeyLocalError(
        'Log export unavailable: persistent logger not initialized',
      );
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

  /**
   * Upload a log archive over the IP table's pinned-IP/SNI route. Runs in bg
   * because only bg holds the IP table config on split-runtime targets; the
   * native SNI module and the archive file are shared with main. On desktop
   * (single runtime) the transport is the Electron main-process SNI API.
   */
  @backgroundMethod()
  async uploadLogFileViaIpTable(params: {
    requestId?: string;
    uploadToken: string;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
    timeoutMs: number;
  }): Promise<ILogUploadViaIpTableResult> {
    const { uploadToken, filePath, mimeType, sizeBytes, timeoutMs, requestId } =
      params;
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      return { route: 'skipped', reason: 'unsupported_platform' };
    }
    if (!uploadToken || sizeBytes <= 0) {
      throw new OneKeyLocalError('Invalid log upload params');
    }
    const endpointInfo = await this.getClientEndpointInfo(
      EServiceEndpointEnum.Wallet,
    );
    const uploadUrl = `${endpointInfo.endpoint.replace(
      /\/$/,
      '',
    )}/wallet/v1/client/log`;
    const baseHeaders: Record<string, string> = {
      ...(await getRequestHeaders()),
      authorization: `Bearer ${uploadToken}`,
      'content-type': mimeType,
    };
    // Content-Length is owned by the native transport.
    delete baseHeaders['content-length'];
    delete baseHeaders['Content-Length'];
    const headers = await withCustomUAHeaders(uploadUrl, baseHeaders);

    try {
      const result = await uploadFileViaIpTable({
        ...(requestId ? { requestId } : {}),
        url: uploadUrl,
        filePath,
        headers,
        timeout: timeoutMs,
        ...(requestId
          ? {
              onUploadProgress: (bytesSent: number, totalBytes: number) => {
                appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
                  stage: ELogUploadStage.Uploading,
                  requestId,
                  bytesSent,
                  totalBytes,
                  progressPercent: Math.min(
                    99,
                    Math.floor((bytesSent / totalBytes) * 100),
                  ),
                });
              },
            }
          : {}),
      });
      if (result.route === 'skipped') {
        return result;
      }
      const httpStatus =
        result.response.statusCode ?? result.response.status ?? 0;
      return {
        route: 'sni',
        httpStatus,
        body: result.response.body ?? result.response.data ?? '',
        ipHash: result.ipHash,
      };
    } catch (error) {
      const errorCode = getSniRequestErrorCode(error) || 'unknown';
      const errorMessage = sanitizeSniDiagnosticText(
        error instanceof Error ? error.message : String(error),
      );
      // Plain result instead of a thrown error: the native error shape does
      // not survive the bg -> main bridge reliably.
      return { route: 'failed', errorCode, errorMessage };
    }
  }
}

export default ServiceLogger;

