const PRIVATE_KEY_REGEX = /0x[a-fA-F0-9]{64}(?![a-fA-F0-9])/g;
const MNEMONIC_REGEX = /\b([a-z]{3,8} ){11,23}[a-z]{3,8}\b/g;

export function sanitize(message: string): string {
  return message
    .replace(PRIVATE_KEY_REGEX, '[REDACTED]')
    .replace(MNEMONIC_REGEX, '[REDACTED]');
}

export enum ELogLevel {
  silent = 0,
  error = 1,
  warn = 2,
  info = 3,
  debug = 4,
}

export class Logger {
  // eslint-disable-next-line no-useless-constructor, no-empty-function
  constructor(private level: ELogLevel) {}

  error(message: string, ...args: unknown[]): void {
    if (this.level >= ELogLevel.error) this.write('ERROR', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level >= ELogLevel.warn) this.write('WARN', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level >= ELogLevel.info) this.write('INFO', message, args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level >= ELogLevel.debug) this.write('DEBUG', message, args);
  }

  private write(level: string, message: string, args: unknown[]): void {
    const sanitized = sanitize(message);
    const suffix =
      args.length > 0
        ? ` ${args.map((a) => sanitize(String(a)).slice(0, 200)).join(' ')}`
        : '';
    process.stderr.write(`[${level}] ${sanitized}${suffix}\n`);
  }
}

export function createLogger(options: {
  verbose?: boolean;
  quiet?: boolean;
}): Logger {
  if (options.quiet) return new Logger(ELogLevel.silent);
  if (options.verbose) return new Logger(ELogLevel.debug);
  return new Logger(ELogLevel.warn);
}
