/**
 * Remote Logger - sends console logs to a remote server
 * Can be enabled/disabled at runtime via developer settings
 */

type ILogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
type IPlatform = 'ios' | 'android' | 'web' | 'desktop' | 'ext';

interface ILogEntry {
  level: ILogLevel;
  message: string;
  meta?: Record<string, unknown>;
  platform?: IPlatform;
  ts?: string;
}

interface IRemoteLoggerConfig {
  enabled: boolean;
  server: string;
}

const DEFAULT_LOG_SERVER = 'http://localhost:3300';

class RemoteLogger {
  private config: IRemoteLoggerConfig = {
    enabled: false,
    server: DEFAULT_LOG_SERVER,
  };

  private logQueue: ILogEntry[] = [];

  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  private originalLog: typeof console.log | null = null;

  private originalWarn: typeof console.warn | null = null;

  private originalError: typeof console.error | null = null;

  private originalDebug: typeof console.debug | null = null;

  private platform: IPlatform | undefined;

  private isIntercepting = false;

  constructor() {
    this.platform = this.detectPlatform();
  }

  private detectPlatform(): IPlatform | undefined {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
      if (/Android/.test(ua)) return 'android';
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) return 'ext';
    if (typeof process !== 'undefined' && process.versions?.electron)
      return 'desktop';
    if (typeof globalThis !== 'undefined' && 'document' in globalThis)
      return 'web';
    return undefined;
  }

  private flush = () => {
    if (this.logQueue.length === 0) return;

    const logs = this.logQueue;
    this.logQueue = [];
    this.flushTimer = null;

    const isSingle = logs.length === 1;
    const endpoint = isSingle ? '/api/logs' : '/api/logs/batch';
    const body = isSingle ? logs[0] : { logs };

    fetch(`${this.config.server}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  };

  private enqueue = (entry: ILogEntry) => {
    this.logQueue.push(entry);

    // Flush immediately if queue is large
    if (this.logQueue.length >= 50) {
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flush();
    } else if (!this.flushTimer) {
      // Debounce flush for 100ms
      this.flushTimer = setTimeout(this.flush, 100);
    }
  };

  private send = (level: ILogLevel, args: unknown[]) => {
    if (!this.config.enabled) return;

    const messages: string[] = [];
    let meta: Record<string, unknown> | undefined;

    for (const arg of args) {
      if (typeof arg === 'string') {
        messages.push(arg);
      } else if (typeof arg === 'number' || typeof arg === 'boolean') {
        messages.push(String(arg));
      } else if (arg !== null && typeof arg === 'object') {
        meta = { ...meta, ...(arg as Record<string, unknown>) };
      }
    }

    const hasNonEmptyMeta = meta && Object.keys(meta).length > 0;
    const entry: ILogEntry = {
      level,
      message: messages.join(' ') || '[object]',
      ts: new Date().toISOString(),
      meta: hasNonEmptyMeta ? meta : undefined,
      platform: this.platform,
    };

    this.enqueue(entry);
  };

  private startIntercepting() {
    if (this.isIntercepting) return;

    this.originalLog = console.log;
    this.originalWarn = console.warn;
    this.originalError = console.error;
    this.originalDebug = console.debug;

    console.debug = (...args: unknown[]) => {
      this.originalDebug?.(...args);
      this.send('DEBUG', args);
    };
    console.log = (...args: unknown[]) => {
      this.originalLog?.(...args);
      this.send('INFO', args);
    };
    console.warn = (...args: unknown[]) => {
      this.originalWarn?.(...args);
      this.send('WARN', args);
    };
    console.error = (...args: unknown[]) => {
      this.originalError?.(...args);
      this.send('ERROR', args);
    };

    this.isIntercepting = true;
  }

  private stopIntercepting() {
    if (!this.isIntercepting) return;

    if (this.originalLog) console.log = this.originalLog;
    if (this.originalWarn) console.warn = this.originalWarn;
    if (this.originalError) console.error = this.originalError;
    if (this.originalDebug) console.debug = this.originalDebug;

    this.originalLog = null;
    this.originalWarn = null;
    this.originalError = null;
    this.originalDebug = null;

    this.isIntercepting = false;

    // Flush remaining logs
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flush();
    }
  }

  enable(server?: string) {
    this.config.enabled = true;
    if (server) {
      this.config.server = server;
    }
    this.startIntercepting();
  }

  disable() {
    this.config.enabled = false;
    this.stopIntercepting();
  }

  isEnabled() {
    return this.config.enabled;
  }

  getServer() {
    return this.config.server;
  }

  setServer(server: string) {
    this.config.server = server;
  }
}

const remoteLogger = new RemoteLogger();

export { remoteLogger, DEFAULT_LOG_SERVER };
