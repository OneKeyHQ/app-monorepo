import { OneKeyLocalError } from '../../errors';

import type {
  getMobileSesAcceptanceSentryOptions,
  getMobileSesAcceptanceSnapshot,
  recordAcceptanceHandled,
  recordAcceptanceRejection,
} from './mobileSesAcceptance';
import type { Envelope } from '@sentry/core';

type IAcceptanceModule = {
  getMobileSesAcceptanceSentryOptions: typeof getMobileSesAcceptanceSentryOptions;
  getMobileSesAcceptanceSnapshot: typeof getMobileSesAcceptanceSnapshot;
  recordAcceptanceHandled: typeof recordAcceptanceHandled;
  recordAcceptanceRejection: typeof recordAcceptanceRejection;
};
let acceptance: IAcceptanceModule;
const originalMode = process.env.ONEKEY_MOBILE_SES_ACCEPTANCE;
const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  process.env.ONEKEY_MOBILE_SES_ACCEPTANCE = 'true';
  process.env.NODE_ENV = 'production';
  jest.isolateModules(() => {
    acceptance = require('./mobileSesAcceptance') as IAcceptanceModule;
  });
});
afterEach(() => {
  if (originalMode === undefined)
    delete process.env.ONEKEY_MOBILE_SES_ACCEPTANCE;
  else process.env.ONEKEY_MOBILE_SES_ACCEPTANCE = originalMode;
  process.env.NODE_ENV = originalNodeEnv;
});

test('the local transport requires explicit production acceptance mode', () => {
  process.env.ONEKEY_MOBILE_SES_ACCEPTANCE = 'false';
  expect(() => acceptance.getMobileSesAcceptanceSentryOptions()).toThrow(
    'explicit production test build',
  );
  process.env.ONEKEY_MOBILE_SES_ACCEPTANCE = 'true';
  process.env.NODE_ENV = 'development';
  expect(() => acceptance.getMobileSesAcceptanceSentryOptions()).toThrow(
    'explicit production test build',
  );
});

test('transport records only safe probe metadata and acknowledges locally', async () => {
  const options = acceptance.getMobileSesAcceptanceSentryOptions();
  expect(options.dsn).toBe('https://public@127.0.0.1/1');
  const transport = options.transport?.({
    url: 'https://127.0.0.1/api/1/envelope/',
    recordDroppedEvent: () => {},
  });
  if (!transport) throw new OneKeyLocalError('missing fixture transport');
  const envelope: Envelope = [
    { event_id: 'public-envelope-id', sent_at: '2026-11-16T00:00:00.000Z' },
    [
      [
        { type: 'event' },
        {
          event_id: 'public-event-id',
          exception: {
            values: [
              {
                value: 'ONEKEY_SES_ACCEPTANCE_fixture secret ****',
                mechanism: { type: 'onunhandledrejection' },
                stacktrace: { frames: [{ function: 'publicFixture' }] },
              },
            ],
          },
        },
      ],
      [
        { type: 'event' },
        { exception: { values: [{ value: 'unrelated event' }] } },
      ],
      [
        { type: 'attachment', filename: 'ignored.bin', length: 0 },
        new Uint8Array(0),
      ],
    ],
  ];
  await expect(Promise.resolve(transport.send(envelope))).resolves.toEqual({
    statusCode: 200,
  });
  await expect(Promise.resolve(transport.flush(100))).resolves.toBe(true);
  expect(acceptance.getMobileSesAcceptanceSnapshot().events).toEqual([
    {
      marker: 'ONEKEY_SES_ACCEPTANCE_fixture',
      eventId: 'public-event-id',
      mechanism: 'onunhandledrejection',
      frames: 1,
      sanitized: true,
    },
  ]);
});

test('handled observations are scoped to synthetic unhandled rejection ids', () => {
  acceptance.recordAcceptanceRejection(
    1,
    new Error('ONEKEY_SES_ACCEPTANCE_fixture'),
  );
  acceptance.recordAcceptanceRejection(2, new Error('unrelated'));
  acceptance.recordAcceptanceHandled(1);
  acceptance.recordAcceptanceHandled(2);
  acceptance.recordAcceptanceHandled(1);
  expect(acceptance.getMobileSesAcceptanceSnapshot()).toMatchObject({
    unhandled: 1,
    handled: 1,
  });
});
