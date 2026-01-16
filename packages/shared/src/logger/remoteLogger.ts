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

/**
 * Check if a URL points to a local network address (localhost or private IP)
 * Allowed: localhost, 127.x.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x, ::1, fe80::
 */
function isLocalNetworkAddress(urlString: string): boolean {
  try {
    const normalizedUrl = urlString.includes('://')
      ? urlString
      : `http://${urlString}`;
    const host = new URL(normalizedUrl).hostname;

    if (host === 'localhost') {
      return true;
    }

    if (host === '::1' || host === '[::1]') {
      return true;
    }

    const hostLower = host.toLowerCase();
    if (hostLower.startsWith('fe80:') || hostLower.startsWith('[fe80:')) {
      return true;
    }

    const ipv4Match = host.match(
      /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
    );
    if (ipv4Match) {
      const octets = ipv4Match.slice(1).map(Number);
      const [a, b] = octets;

      if (octets.some((octet) => octet > 255)) {
        return false;
      }

      // Loopback (127.x.x.x) or Class A private (10.x.x.x)
      if (a === 127 || a === 10) {
        return true;
      }

      // Class B private (172.16-31.x.x) or Class C private (192.168.x.x)
      if ((a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

class RemoteLogger {
  private config: IRemoteLoggerConfig = {
    enabled: false,
    server: DEFAULT_LOG_SERVER,
  };

  private logQueue: ILogEntry[] = [];

  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  private platform: IPlatform | undefined;

  constructor() {
    this.platform = this.detectPlatform();
  }

  private detectPlatform(): IPlatform | undefined {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod/.test(ua)) {
        return 'ios';
      }
      if (/Android/.test(ua)) {
        return 'android';
      }
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      return 'ext';
    }

    if (typeof process !== 'undefined' && process.versions?.electron) {
      return 'desktop';
    }

    if (typeof globalThis !== 'undefined' && 'document' in globalThis) {
      return 'web';
    }

    return undefined;
  }

  private flush = (): void => {
    if (this.logQueue.length === 0) {
      return;
    }

    const logs = this.logQueue;
    this.logQueue = [];
    this.flushTimer = null;

    const isSingle = logs.length === 1;
    const endpoint = isSingle ? '/api/logs' : '/api/logs/batch';
    const body = isSingle ? logs[0] : { logs };

    void fetch(`${this.config.server}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  };

  private enqueue = (entry: ILogEntry): void => {
    this.logQueue.push(entry);

    if (this.logQueue.length >= 50) {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
      }
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(this.flush, 100);
    }
  };

  private send = (level: ILogLevel, args: unknown[]): void => {
    if (!this.config.enabled) {
      return;
    }

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

    const entry: ILogEntry = {
      level,
      message: messages.join(' ') || '[object]',
      ts: new Date().toISOString(),
      meta: meta && Object.keys(meta).length > 0 ? meta : undefined,
      platform: this.platform,
    };

    this.enqueue(entry);
  };

  enable(server?: string): void {
    this.config.enabled = true;
    if (server) {
      this.config.server = server;
    }
  }

  disable(): void {
    this.config.enabled = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flush();
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getServer(): string {
    return this.config.server;
  }

  setServer(server: string): void {
    this.config.server = server;
  }

  debug(...args: unknown[]): void {
    this.send('DEBUG', args);
  }

  info(...args: unknown[]): void {
    this.send('INFO', args);
  }

  log(...args: unknown[]): void {
    this.send('INFO', args);
  }

  warn(...args: unknown[]): void {
    this.send('WARN', args);
  }

  error(...args: unknown[]): void {
    this.send('ERROR', args);
  }
}

const remoteLogger = new RemoteLogger();

export { remoteLogger, DEFAULT_LOG_SERVER, isLocalNetworkAddress };
