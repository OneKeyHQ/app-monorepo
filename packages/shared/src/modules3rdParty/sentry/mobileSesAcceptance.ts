import { OneKeyLocalError } from '../../errors';
import { getSesHardenRuntimeState } from '../../security/sesHarden';
import { withSesCheckDeadline } from '../../security/sesHarden/runtimeCheckDeadline';

import type { init } from '@sentry/react-native';

type ISentryOptions = Parameters<typeof init>[0];
type IProbeEvent = {
  marker: string;
  eventId?: string;
  mechanism?: string;
  frames: number;
  sanitized: boolean;
};
const PREFIX = 'ONEKEY_SES_ACCEPTANCE_';
const PUBLIC_HEX = `0x${'01'.repeat(32)}`;
const events: IProbeEvent[] = [];
const rejectionIds = new Set<number>();
const handledIds = new Set<number>();

function requireAcceptanceBuild() {
  if (
    process.env.ONEKEY_MOBILE_SES_ACCEPTANCE !== 'true' ||
    process.env.NODE_ENV !== 'production'
  ) {
    throw new OneKeyLocalError(
      'Mobile SES acceptance requires an explicit production test build.',
    );
  }
}

export function recordAcceptanceRejection(id: number, error: unknown) {
  requireAcceptanceBuild();
  if (error instanceof Error && error.message.startsWith(PREFIX))
    rejectionIds.add(id);
}

export function recordAcceptanceHandled(id: number) {
  requireAcceptanceBuild();
  if (rejectionIds.has(id)) handledIds.add(id);
}

export function getMobileSesAcceptanceSnapshot() {
  requireAcceptanceBuild();
  return {
    events: [...events],
    unhandled: rejectionIds.size,
    handled: handledIds.size,
  };
}

export function getMobileSesAcceptanceSentryOptions(): Pick<
  ISentryOptions,
  'dsn' | 'transport'
> {
  requireAcceptanceBuild();
  return {
    dsn: 'https://public@127.0.0.1/1',
    transport: () => ({
      send(envelope) {
        envelope[1].forEach(([headers, payload]) => {
          if (
            headers.type !== 'event' ||
            typeof payload !== 'object' ||
            payload === null ||
            !('exception' in payload)
          )
            return;
          const event = payload as {
            event_id?: string;
            exception?: {
              values?: {
                value?: string;
                mechanism?: { type?: string };
                stacktrace?: { frames?: unknown[] };
              }[];
            };
          };
          const exception = event.exception?.values?.find((value) =>
            value.value?.startsWith(PREFIX),
          );
          if (!exception?.value) return;
          events.push({
            marker: exception.value.split(' ')[0],
            eventId: event.event_id,
            mechanism: exception.mechanism?.type,
            frames: exception.stacktrace?.frames?.length ?? 0,
            sanitized:
              exception.value.includes('****') &&
              !exception.value.includes(PUBLIC_HEX),
          });
        });
        return Promise.resolve({ statusCode: 200 });
      },
      flush: async () => true,
    }),
  };
}

export async function runMobileSesAcceptance() {
  requireAcceptanceBuild();
  const { NativeLogger, LogLevel } =
    await import('../react-native-file-logger');
  const state = getSesHardenRuntimeState();
  const runtime = state?.runtime;
  const write = (result: object) =>
    NativeLogger.write(
      LogLevel.Info,
      `[MobileSesAcceptance] ${JSON.stringify({ runtime, ...result })}`,
    );
  let late: Promise<never> | undefined;
  try {
    if (__DEV__ || !runtime?.startsWith('mobile-') || !state?.lockdownApplied)
      throw new OneKeyLocalError(
        'Acceptance did not run in a hardened native Release runtime.',
      );
    const initialPromise = Promise;
    const sentry = await import('@sentry/react-native');
    const client = sentry.getClient();
    if (!client?.getTransport())
      throw new OneKeyLocalError('Sentry transport was not initialized.');
    const marker = (kind: string) => `${PREFIX}${runtime}_${kind}`;
    // These synthetic errors contain only public fixtures, including the hex
    // value used to verify the production sanitizer before transport delivery.
    // oxlint-disable-next-line onekey/no-raw-error, no-restricted-syntax
    const synthetic = (kind: string) =>
      new Error(`${marker(kind)} secret ${PUBLIC_HEX}`);
    sentry.captureException(synthetic('captured'));
    const globalErrors = globalThis as typeof globalThis & {
      ErrorUtils?: {
        getGlobalHandler: () => (error: Error, isFatal: boolean) => void;
      };
    };
    const handler = globalErrors.ErrorUtils?.getGlobalHandler();
    if (!handler)
      throw new OneKeyLocalError('Native ErrorUtils handler is missing.');
    handler(synthetic('sync'), false);
    // Deliberate unhandled rejection: verify the real Hermes -> OneKey -> SDK path.
    void Promise.reject(synthetic('unhandled'));
    late = Promise.reject(synthetic('late'));
    await withSesCheckDeadline(
      'Sentry unhandled delivery',
      async (signal) => {
        while (
          !signal.aborted &&
          !events.some((event) => event.marker === marker('late'))
        )
          await new Promise((resolve) => setTimeout(resolve, 50));
      },
      { timeoutMs: 10_000 },
    );
    void late.catch(() => undefined);
    await withSesCheckDeadline(
      'Sentry handled callback',
      async (signal) => {
        while (!signal.aborted && handledIds.size !== 1)
          await new Promise((resolve) => setTimeout(resolve, 50));
      },
      { timeoutMs: 5000 },
    );
    if (!(await client.flush(5000)))
      throw new OneKeyLocalError('Sentry did not flush the acceptance events.');
    await new Promise((resolve) => setTimeout(resolve, 250));
    for (const kind of ['captured', 'sync', 'unhandled', 'late']) {
      const matching = events.filter((event) => event.marker === marker(kind));
      if (
        matching.length !== 1 ||
        !matching[0].sanitized ||
        matching[0].frames === 0
      )
        throw new OneKeyLocalError(
          `Sentry ${kind}: expected one sanitized event with stack frames, got ${matching.length}`,
        );
    }
    if (
      rejectionIds.size !== 2 ||
      Promise !== initialPromise ||
      !Object.isFrozen(Promise) ||
      !Object.isFrozen(Promise.prototype)
    )
      throw new OneKeyLocalError(
        'Sentry replaced Promise or duplicated rejection tracking.',
      );
    const { buildSesRuntimeCheckReport } =
      await import('../../security/sesHarden/runtimeCheck');
    const report = await buildSesRuntimeCheckReport();
    if (report.summary.failed !== 0)
      throw new OneKeyLocalError(
        `Runtime checks failed: ${report.checks
          .filter((check) => check.status === 'fail')
          .map((check) => `${check.name}: ${check.detail}`)
          .join('; ')}`,
      );
    write({
      status: 'pass',
      dev: __DEV__,
      nodeEnv: process.env.NODE_ENV,
      summary: report.summary,
      events,
      unhandled: rejectionIds.size,
      handled: handledIds.size,
      promiseFrozen: true,
      libraries: report.checks.filter((check) =>
        check.name.endsWith('after lockdown'),
      ),
    });
  } catch (error) {
    write({
      status: 'fail',
      error: error instanceof Error ? error.message : String(error),
      events,
      unhandled: rejectionIds.size,
      handled: handledIds.size,
    });
  } finally {
    void late?.catch(() => undefined);
  }
}
