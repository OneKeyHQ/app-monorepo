import { OutputFormatter } from '../output/output-formatter';
import { detectOutputMode } from '../utils/mode-detector';

describe('detectOutputMode', () => {
  it('returns quiet when --quiet is set', () => {
    expect(detectOutputMode({ quiet: true })).toBe('quiet');
  });

  it('returns agent when --json is set', () => {
    expect(detectOutputMode({ json: true })).toBe('agent');
  });

  it('returns human when --interactive is set', () => {
    expect(detectOutputMode({ interactive: true })).toBe('human');
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
      expect(parsed.status).toBe('success');
      expect(parsed.api_version).toBe('1');
      expect(parsed.data).toEqual({ balance: '1.5' });
      expect(parsed.metadata).toBeDefined();
    });

    it('outputs JSON error to stdout (not stderr)', () => {
      const formatter = new OutputFormatter('agent');
      formatter.error({
        code: 'NET_TIMEOUT',
        message: 'timeout',
        suggestion: 'retry',
      });
      const parsed = JSON.parse(stdoutData.trim());
      expect(parsed.status).toBe('error');
      expect(parsed.error.code).toBe('NET_TIMEOUT');
    });
  });

  describe('quiet mode', () => {
    it('outputs only first value', () => {
      const formatter = new OutputFormatter('quiet');
      formatter.success({ balance: '1.5', chain: 'eth' });
      expect(stdoutData.trim()).toBe('1.5');
    });
  });

  describe('human mode', () => {
    it('outputs error to stderr', () => {
      const formatter = new OutputFormatter('human');
      formatter.error({ code: 'ERR', message: 'bad', suggestion: 'fix' });
      expect(stderrData).toContain('bad');
      expect(stdoutData).toBe('');
    });
  });
});
