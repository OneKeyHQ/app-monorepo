import { sanitizeCaptchaDiagnostic } from './captchaDiagnostics';

import type { ICaptchaDiagnostic } from './captchaDiagnostics';

const valid: ICaptchaDiagnostic = {
  requestId: '6f0d4f7e-cc60-4ca7-aed2-20ed64c0a2dc',
  status: 'error',
  source: 'provider_message',
  code: '300010',
  elapsedMs: 500,
  readyReceived: true,
  readyElapsedMs: 100,
  terminal: false,
  sequence: 2,
  suppressedEvents: 0,
};

test('reconstructs a scalar whitelist without spreading arbitrary input', () => {
  const input = {
    ...valid,
    token: 'private-token',
    email: 'private-email@example.com',
    error: new Error('private-secret'),
    otp: 'private-otp',
    userAgent: 'private-UA',
    url: 'https://example.com/?secret=private-secret',
  };
  expect(sanitizeCaptchaDiagnostic(input)).toEqual(valid);
  expect(JSON.stringify(sanitizeCaptchaDiagnostic(input))).not.toContain(
    'private-',
  );
});

test.each([
  '110620',
  undefined,
  '',
  '12345',
  '1234567',
  '110620\n',
  'secret',
  { token: 'private-token' },
])('validates the exact six-digit code %s', (code) => {
  const input = { ...valid, code } as ICaptchaDiagnostic;
  expect(sanitizeCaptchaDiagnostic(input)?.code).toBe(
    code === '110620' ? code : null,
  );
});

test.each([
  { requestId: 'private-token' },
  { requestId: `${valid.requestId}\n` },
  { requestId: 'x'.repeat(10_000) },
  { status: 'private-secret' },
  { source: 'private-secret' },
  { elapsedMs: NaN },
  { elapsedMs: Infinity },
  { elapsedMs: -1 },
  { elapsedMs: 2_147_483_648 },
  { readyElapsedMs: 501 },
  { readyReceived: 'private-secret' },
  { sequence: 0.1 },
  { suppressedEvents: -1 },
  { terminal: new Error('private-secret') },
])('rejects invalid fields %j', (fields) => {
  expect(
    sanitizeCaptchaDiagnostic({ ...valid, ...fields } as ICaptchaDiagnostic),
  ).toBeUndefined();
});
