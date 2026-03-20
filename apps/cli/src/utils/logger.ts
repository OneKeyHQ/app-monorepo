const PRIVATE_KEY_REGEX = /0x[a-fA-F0-9]{64}(?![a-fA-F0-9])/g;
const MNEMONIC_REGEX = /\b([a-z]{3,8} ){11,23}[a-z]{3,8}\b/g;

export function sanitize(message: string): string {
  return message
    .replace(PRIVATE_KEY_REGEX, '[REDACTED]')
    .replace(MNEMONIC_REGEX, '[REDACTED]');
}

export enum LogLevel {
  silent = 0,
  error = 1,
  warn = 2,
  info = 3,
  debug = 4,
}

export class Logger {
  constructor(private level: LogLevel) {}

  error(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.error) this.write('ERROR', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.warn) this.write('WARN', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.info) this.write('INFO', message, args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.debug) this.write('DEBUG', message, args);
  }

  private write(level: string, message: string, args: unknown[]): void {
    const sanitized = sanitize(message);
    const suffix =
      args.length > 0
        ? ' ' + args.map((a) => sanitize(String(a)).slice(0, 200)).join(' ')
        : '';
    process.stderr.write(`[${level}] ${sanitized}${suffix}\n`);
  }
}

export function createLogger(options: {
  verbose?: boolean;
  quiet?: boolean;
}): Logger {
  if (options.quiet) return new Logger(LogLevel.silent);
  if (options.verbose) return new Logger(LogLevel.debug);
  return new Logger(LogLevel.warn);
}
