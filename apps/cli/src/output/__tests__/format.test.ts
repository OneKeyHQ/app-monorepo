import { CLI_ERROR_CODES } from '../../errors';
import { formatError, formatOk } from '../format';
import { redactSecret } from '../redact';

const FIXED_NOW = new Date('2026-04-28T01:02:03.000Z');

describe('output/format', () => {
  it('formats ok responses as parseable single-line JSON', () => {
    const output = formatOk({ value: 'signed' }, 'json', { now: FIXED_NOW });

    expect(output).not.toContain('\n');
    expect(JSON.parse(output)).toEqual({
      ok: true,
      data: { value: 'signed' },
    });
  });

  it('formats errors as parseable single-line JSON', () => {
    const output = formatError(
      CLI_ERROR_CODES.SERVICE_UNREACHABLE,
      'service down',
      'json',
      { now: FIXED_NOW },
    );

    expect(output).not.toContain('\n');
    expect(JSON.parse(output)).toEqual({
      ok: false,
      error: {
        code: CLI_ERROR_CODES.SERVICE_UNREACHABLE,
        message: 'service down',
      },
    });
  });

  it('redacts sensitive substrings in error messages', () => {
    const privateKey = `0x${'a'.repeat(64)}`;
    const output = formatError(
      CLI_ERROR_CODES.UNKNOWN_COMMAND,
      `unknown command ${privateKey}`,
      'json',
      { now: FIXED_NOW },
    );

    expect(output).not.toContain(privateKey);
    expect(JSON.parse(output)).toMatchObject({
      ok: false,
      error: {
        code: CLI_ERROR_CODES.UNKNOWN_COMMAND,
      },
    });
  });

  it('formats text output as multi-line labels with redacted fields', () => {
    const secret = 'access-token-secret';
    const output = formatOk(
      {
        displayAddress: '0x1234567890abcdef',
        keyId: 'key_123456789abcdef',
        accessToken: secret,
      },
      'text',
      { now: FIXED_NOW, isTTY: true },
    );

    expect(output).toContain('ok: true');
    expect(output).toContain('timestamp:');
    expect(output).toContain('displayAddress: 0x123456...abcdef');
    expect(output).toContain('keyId: key_1234');
    expect(output).not.toContain(secret);
    expect(output).toContain(`accessToken: ${redactSecret(secret)}`);
    expect(output).not.toContain(
      `accessToken: ${redactSecret(redactSecret(secret))}`,
    );
    expect(output.split('\n').length).toBeGreaterThan(3);
  });

  it('preserves public token fields while redacting access tokens', () => {
    const secret = 'access-token-secret';
    const output = formatOk(
      {
        token: 'SOL',
        accessToken: secret,
      },
      'json',
      { now: FIXED_NOW },
    );

    expect(JSON.parse(output)).toEqual({
      ok: true,
      data: {
        token: 'SOL',
        accessToken: redactSecret(secret),
      },
    });
  });

  it('forces JSON when output is piped', () => {
    const output = formatOk({ displayAddress: '0x1234567890abcdef' }, 'text', {
      now: FIXED_NOW,
      isTTY: false,
    });

    expect(JSON.parse(output)).toMatchObject({
      ok: true,
      data: { displayAddress: '0x123456...abcdef' },
    });
  });

  it('does not emit ANSI control sequences', () => {
    const ansiPattern = new RegExp(
      `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
    );
    const output = formatError(CLI_ERROR_CODES.INVALID_TX, 'bad tx', 'text', {
      now: FIXED_NOW,
      isTTY: true,
    });

    expect(output).not.toMatch(ansiPattern);
  });
});
