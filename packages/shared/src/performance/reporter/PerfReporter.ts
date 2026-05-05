/**
 * Performance Reporter
 *
 * Handles WebSocket connection and event reporting to the performance server.
 */

import type {
  IFpsData,
  IFunctionCallData,
  ILongTaskData,
  IMarkData,
  IMemoryData,
  IModuleLoadData,
  IPerfEvent,
  IPerfReporterInstance,
  IPerfReporterOptions,
} from './types';

type IBufferedModuleLoad = IModuleLoadData & { ts?: number };
type IBufferedFunctionCall = IFunctionCallData & {
  absoluteTime?: number;
  timestamp?: number;
};
type IBufferedMark = {
  name: string;
  detail?: unknown;
  absoluteTime: number;
  timestamp: number;
};

type IPerfReporterGlobal = {
  __perfReportModuleLoad?: (data: IModuleLoadData) => void;
  __perfReportFunctionCall?: (data: IFunctionCallData) => void;
  __perfReportMemory?: (data: IMemoryData) => void;
  __perfReportFPS?: (data: IFpsData) => void;
  __perfReportLongTask?: (data: ILongTaskData) => void;
  __perfReportMark?: (data: IMarkData) => void;
  __perfReporterReady?: boolean;

  __perfModuleBuffer?: IBufferedModuleLoad[];
  __perfFunctionBuffer?: IBufferedFunctionCall[];
  __perfMarkBuffer?: IBufferedMark[];
};

class PerfReporter implements IPerfReporterInstance {
  private ws: WebSocket | null = null;

  private sessionId: string;

  private sessionStartTime: number;

  private platform: IPerfEvent['platform'];

  private connected = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = this.getHighResTime();
    this.platform = 'web'; // Will be set during init
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `perf-${timestamp}-${random}`;
  }

  private getHighResTime(): number {
    if (
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
    ) {
      return performance.now();
    }
    return Date.now();
  }

  async connect(options: IPerfReporterOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const { serverUrl, timeout, platform } = options;

      if (platform) {
        this.platform = platform;
      }

      const timer = setTimeout(() => {
        // eslint-disable-next-line no-console
        console.warn('[PerfReporter] Connection timeout, profiling disabled');
        this.cleanup();
        resolve(false);
      }, timeout);

      try {
        this.ws = new WebSocket(serverUrl);

        this.ws.onopen = () => {
          clearTimeout(timer);
          this.connected = true;
          // eslint-disable-next-line no-console
          console.log(`[PerfReporter] Connected, sessionId: ${this.sessionId}`);

          // Send initial session info
          this.sendRaw({
            sessionId: this.sessionId,
            timestamp: 0,
            absoluteTime: Date.now(),
            platform: this.platform,
            type: 'module_load',
            data: { path: '__session_start__', duration: 0 },
          });

          this.installGlobalHooks();
          resolve(true);
        };

        this.ws.onerror = () => {
          clearTimeout(timer);
          // eslint-disable-next-line no-console
          console.warn('[PerfReporter] Connection failed, profiling disabled');
          this.cleanup();
          resolve(false);
        };

        this.ws.onclose = () => {
          this.connected = false;
        };
      } catch (err) {
        clearTimeout(timer);
        // eslint-disable-next-line no-console
        console.warn('[PerfReporter] WebSocket error:', err);
        this.cleanup();
        resolve(false);
      }
    });
  }

  private cleanup() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.connected = false;
  }

  private sendRaw(event: IPerfEvent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[PerfReporter] Send error:', err);
      }
    }
  }

  send(type: IPerfEvent['type'], data: IPerfEvent['data']) {
    if (!this.connected) return;

    const event: IPerfEvent = {
      sessionId: this.sessionId,
      timestamp: this.getHighResTime() - this.sessionStartTime,
      absoluteTime: Date.now(),
      platform: this.platform,
      type,
      data,
    };

    this.sendRaw(event);
  }

  isConnected(): boolean {
    return this.connected;
  }

  close() {
    this.cleanup();
    this.removeGlobalHooks();
  }

  private installGlobalHooks() {
    const g = globalThis as unknown as IPerfReporterGlobal;

    // Module load reporting
    g.__perfReportModuleLoad = (data) => {
      this.send('module_load', data);
    };

    // Function call reporting
    g.__perfReportFunctionCall = (data) => {
      this.send('function_call', data);
    };

    // Memory reporting
    g.__perfReportMemory = (data) => {
      this.send('memory', data);
    };

    // FPS reporting
    g.__perfReportFPS = (data) => {
      this.send('fps', data);
    };

    // Long task reporting
    g.__perfReportLongTask = (data) => {
      this.send('long_task', data);
    };

    // Mark reporting
    g.__perfReportMark = (data) => {
      this.send('mark', data);
    };

    // Mark reporter as ready
    g.__perfReporterReady = true;

    // Flush any buffered data from before reporter was ready
    this.flushBufferedModuleLoads();
    this.flushBufferedFunctionCalls();
    this.flushBufferedMarks();
  }

  private flushBufferedModuleLoads() {
    const g = globalThis as unknown as IPerfReporterGlobal;
    const buffer = g.__perfModuleBuffer;

    if (Array.isArray(buffer) && buffer.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[PerfReporter] Flushing ${buffer.length} buffered module loads`,
      );

      buffer.forEach((item) => {
        if (!item) {
          return;
        }
        this.send('module_load', {
          path: item.path,
          duration: item.duration,
        });
      });

      // Clear the buffer
      g.__perfModuleBuffer = [];
    }
  }

  private flushBufferedFunctionCalls() {
    const g = globalThis as unknown as IPerfReporterGlobal;
    const buffer = g.__perfFunctionBuffer;

    if (Array.isArray(buffer) && buffer.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[PerfReporter] Flushing ${buffer.length} buffered function calls`,
      );

      buffer.forEach((item) => {
        if (!item) {
          return;
        }
        this.send('function_call', {
          name: item.name,
          file: item.file,
          line: item.line,
          duration: item.duration,
          module: item.module,
          stack: item.stack,
        });
      });

      // Clear the buffer
      g.__perfFunctionBuffer = [];
    }
  }

  private flushBufferedMarks() {
    const g = globalThis as unknown as IPerfReporterGlobal;
    const buffer = g.__perfMarkBuffer;

    if (Array.isArray(buffer) && buffer.length > 0) {
      buffer.forEach((item) => {
        if (!item || !item.name) {
          return;
        }

        const absoluteTime = Number(item.absoluteTime);
        const rawTs = Number(item.timestamp);
        const timestamp = Number.isFinite(rawTs)
          ? rawTs - this.sessionStartTime
          : 0;

        this.sendRaw({
          sessionId: this.sessionId,
          timestamp: Number.isFinite(timestamp) ? Math.max(0, timestamp) : 0,
          absoluteTime: Number.isFinite(absoluteTime)
            ? absoluteTime
            : Date.now(),
          platform: this.platform,
          type: 'mark',
          data: { name: item.name, detail: item.detail },
        });
      });

      g.__perfMarkBuffer = [];
    }
  }

  private removeGlobalHooks() {
    const g = globalThis as unknown as IPerfReporterGlobal;
    delete g.__perfReportModuleLoad;
    delete g.__perfReportFunctionCall;
    delete g.__perfReportMemory;
    delete g.__perfReportFPS;
    delete g.__perfReportLongTask;
    delete g.__perfReportMark;
    delete g.__perfReporterReady;
  }
}

// Singleton instance
let reporterInstance: PerfReporter | null = null;

/**
 * Initialize the performance reporter.
 * Should be called at the very beginning of the app, before any other imports.
 *
 * @param options Configuration options
 * @returns Promise that resolves to true if connected, false otherwise
 */
export async function initPerfReporter(
  options: IPerfReporterOptions,
): Promise<boolean> {
  if (reporterInstance) {
    return reporterInstance.isConnected();
  }

  reporterInstance = new PerfReporter();
  return reporterInstance.connect(options);
}

/**
 * Get the current reporter instance (if initialized)
 */
export function getPerfReporter(): IPerfReporterInstance | null {
  return reporterInstance;
}

/**
 * Close the reporter connection
 */
export function closePerfReporter() {
  if (reporterInstance) {
    reporterInstance.close();
    reporterInstance = null;
  }
}

export default {
  initPerfReporter,
  getPerfReporter,
  closePerfReporter,
};
