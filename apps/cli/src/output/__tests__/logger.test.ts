import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger';

function repoRoot(): string {
  return path.resolve(__dirname, '../../../../..');
}

function trackedSourceFiles(paths: string[]): string[] {
  return execFileSync('git', ['ls-files', ...paths], {
    cwd: repoRoot(),
    encoding: 'utf-8',
  })
    .split('\n')
    .filter((filePath) => /\.(cjs|js|mjs|ts|tsx)$/.test(filePath));
}

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

  it('keeps CLI runtime source free of console.log', () => {
    const offenders = trackedSourceFiles(['apps/cli/src'])
      .filter((filePath) => !filePath.includes('__tests__/'))
      .filter((filePath) =>
        fs
          .readFileSync(path.join(repoRoot(), filePath), 'utf-8')
          .includes('console.log('),
      );

    expect(offenders).toEqual([]);
  });

  it('keeps command output writes behind OutputFormatter except interactive hardware prompts', () => {
    const allowedDirectWriteFiles = new Set([
      'apps/cli/src/commands/auth/hardware-login-command.ts',
      'apps/cli/src/commands/device/hardware-sdk.ts',
    ]);
    const pattern = /process\.(stdout|stderr)\.write\(/;
    const offenders = trackedSourceFiles(['apps/cli/src/commands'])
      .filter((filePath) => !filePath.includes('__tests__/'))
      .filter((filePath) => !allowedDirectWriteFiles.has(filePath))
      .filter((filePath) =>
        pattern.test(fs.readFileSync(path.join(repoRoot(), filePath), 'utf-8')),
      );

    expect(offenders).toEqual([]);
  });

  it('keeps runtime source free of telemetry SDK integrations', () => {
    const pattern = /Sentry\.init|mixpanel|prometheus|datadog/;
    const offenders = trackedSourceFiles([
      'apps/cli/src',
      'development/bot-wallet-key-service/src',
    ])
      .filter((filePath) => !filePath.includes('__tests__/'))
      .filter((filePath) =>
        pattern.test(fs.readFileSync(path.join(repoRoot(), filePath), 'utf-8')),
      );

    expect(offenders).toEqual([]);
  });
});
