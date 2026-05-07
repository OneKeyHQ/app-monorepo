import { OutputFormatter } from '../output/output-formatter';
import { detectOutputMode } from '../utils/mode-detector';

describe('detectOutputMode', () => {
  it('returns quiet when --quiet is set', () => {
    expect(detectOutputMode({ quiet: true })).toBe('quiet');
  });

  it('returns agent when --json is set', () => {
    expect(detectOutputMode({ json: true })).toBe('agent');
  });

  it('returns text when --format=text is set', () => {
    expect(detectOutputMode({ format: 'text' })).toBe('text');
  });

  it('returns human when --interactive is set', () => {
    expect(detectOutputMode({ interactive: true })).toBe('human');
  });

  it('defaults to human output when stdout is a TTY', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      process.stdout,
      'isTTY',
    );
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    });

    try {
      expect(detectOutputMode({})).toBe('human');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(process.stdout, 'isTTY', originalDescriptor);
      } else {
        delete (process.stdout as Partial<typeof process.stdout>).isTTY;
      }
    }
  });

  it('defaults to agent output when stdout is not a TTY', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      process.stdout,
      'isTTY',
    );
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    });

    try {
      expect(detectOutputMode({})).toBe('agent');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(process.stdout, 'isTTY', originalDescriptor);
      } else {
        delete (process.stdout as Partial<typeof process.stdout>).isTTY;
      }
    }
  });

  it('quiet takes precedence over json', () => {
    expect(detectOutputMode({ quiet: true, json: true })).toBe('quiet');
  });
});

describe('OutputFormatter', () => {
  let stdoutData: string;
  let stderrData: string;

  beforeEach(() => {
    stdoutData = '';
    stderrData = '';
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutData += String(chunk);
      return true;
    });
    jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrData += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('agent mode', () => {
    it('outputs JSON success to stdout', () => {
      const formatter = new OutputFormatter('agent');
      formatter.success({ balance: '1.5' });
      const parsed = JSON.parse(stdoutData.trim());
      expect(parsed.ok).toBe(true);
      expect(parsed.data).toEqual({ balance: '1.5' });
    });

    it('outputs JSON error to stdout (not stderr)', () => {
      const formatter = new OutputFormatter('agent');
      formatter.error({
        code: 'NET_TIMEOUT',
        message: 'timeout',
        suggestion: 'retry',
      });
      const parsed = JSON.parse(stdoutData.trim());
      expect(parsed.ok).toBe(false);
      expect(parsed.error.code).toBe('NET_TIMEOUT');
    });
  });

  describe('text mode', () => {
    it('outputs multi-line text success without ANSI', () => {
      const formatter = new OutputFormatter('text');
      formatter.success({ balance: '1.5', accessToken: 'secret-token' });

      expect(stdoutData).toContain('ok: true');
      expect(stdoutData).toContain('balance: 1.5');
      expect(stdoutData).not.toContain('secret-token');
      expect(stdoutData).toContain('accessToken: <REDACTED:sha256:');
    });
  });

  describe('quiet mode', () => {
    it('outputs only first value', () => {
      const formatter = new OutputFormatter('quiet');
      formatter.success({ balance: '1.5', chain: 'eth' });
      expect(stdoutData.trim()).toBe('1.5');
    });

    it('keeps error output plain text even when details are present', () => {
      const formatter = new OutputFormatter('quiet');
      formatter.error({
        code: 'AUTH_TRANSFER_TIMEOUT',
        message: 'timeout',
        suggestion: 'retry',
        details: {
          status: 'timeout',
          next_action: 'retry_app_transfer',
        },
      });

      expect(stderrData.trim()).toBe('AUTH_TRANSFER_TIMEOUT: timeout');
      expect(stdoutData).toBe('');
    });
  });

  describe('human mode', () => {
    it('outputs error to stderr', () => {
      const formatter = new OutputFormatter('human');
      formatter.error({ code: 'ERR', message: 'bad', suggestion: 'fix' });
      expect(stderrData).toContain('bad');
      expect(stdoutData).toBe('');
    });

    it('writes raw stdout output without envelopes', () => {
      const formatter = new OutputFormatter('human');
      formatter.raw('plain text');
      expect(stdoutData).toBe('plain text\n');
      expect(stderrData).toBe('');
    });
  });
});
