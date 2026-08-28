import { logger } from '../logger';

describe('output/logger', () => {
  let stderrData = '';
  const originalDebug = process.env.DEBUG;

  beforeEach(() => {
    stderrData = '';
    delete process.env.DEBUG;
    jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrData += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    if (originalDebug === undefined) {
      delete process.env.DEBUG;
    } else {
      process.env.DEBUG = originalDebug;
    }
    jest.restoreAllMocks();
  });

  it('writes dot-separated events as structured stderr JSON', () => {
    logger.info('vault.read.start', { keyId: 'key_123456789' });

    const parsed = JSON.parse(stderrData);
    expect(parsed).toMatchObject({
      level: 'info',
      event: 'vault.read.start',
      fields: {
        keyId: 'key_1234',
      },
    });
  });

  it('rejects non dot-separated event names', () => {
    expect(() => logger.info('VaultReadStart')).toThrow(
      'Invalid logger event name',
    );
  });

  it('redacts displayAddress fields before writing stderr', () => {
    const displayAddress = '0x1234567890abcdef';
    logger.warn('vault.read.failed', { displayAddress });

    expect(stderrData).toContain('0x123456...abcdef');
    expect(stderrData).not.toContain(displayAddress);
  });

  it('gates debug logs behind DEBUG=onekey:vault', () => {
    logger.debug('vault.read.start', { keyId: 'key_123456789' });
    expect(stderrData).toBe('');

    process.env.DEBUG = 'onekey:vault';
    logger.debug('vault.read.start', { keyId: 'key_123456789' });
    expect(stderrData).toContain('"level":"debug"');
  });

  it('never writes complete access tokens to stderr', () => {
    const accessToken = 'access-token-super-secret';
    logger.error('service.fetch.failed', { accessToken });

    expect(stderrData).not.toContain(accessToken);
    expect(stderrData).toContain('<REDACTED:sha256:');
  });

  it('redacts Authorization headers in nested fields', () => {
    const token = 'access-token-super-secret';
    logger.error('service.fetch.failed', {
      request: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    expect(stderrData).not.toContain(token);
    expect(stderrData).toContain('<REDACTED:sha256:');
  });
});
