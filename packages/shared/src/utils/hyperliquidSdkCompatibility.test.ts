import { execFileSync } from 'node:child_process';

function runSdkCheck(script: string): unknown {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
    import { createRequire } from 'node:module';
    import { WebSocketTransport } from '@nktkas/hyperliquid';
    import { ModifyRequest, TwapOrderRequest } from '@nktkas/hyperliquid/api/exchange';
    const v = createRequire(import.meta.resolve('@nktkas/hyperliquid'))('valibot');
    const envelope = {
      nonce: 1,
      signature: { r: '0x' + '0'.repeat(64), s: '0x' + '0'.repeat(64), v: 27 },
    };
    ${script}
  `,
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    ),
  );
}

describe('Hyperliquid SDK compatibility', () => {
  it('preserves Chase always_place and ordinary amendment defaults without the old patch', () => {
    expect(
      runSdkCheck(`
      const request = {
        ...envelope,
        action: {
          type: 'modify',
          oid: 123,
          order: { a: 0, b: true, p: '100', s: '1', r: false, t: { limit: { tif: 'Gtc' } } },
        },
      };
      const ordinary = v.parse(ModifyRequest, request);
      const chase = v.parse(ModifyRequest, {
        ...request,
        action: { ...request.action, a: true },
      });
      process.stdout.write(JSON.stringify({
        ordinaryHasAlwaysPlace: Object.hasOwn(ordinary.action, 'a'),
        chaseAlwaysPlace: chase.action.a,
        chaseAssetId: chase.action.order.a,
      }));
    `),
    ).toEqual({
      ordinaryHasAlwaysPlace: false,
      chaseAlwaysPlace: true,
      chaseAssetId: 0,
    });
  });

  it('retains the transport hooks used by subscription reconciliation', () => {
    expect(
      runSdkCheck(`
      const transport = new WebSocketTransport({ url: 'ws://127.0.0.1:1' });
      process.stdout.write(JSON.stringify({
        dispatcher: typeof transport._dispatcher?.request,
        events: typeof transport._hlEvents?.addEventListener,
      }));
      transport.close();
    `),
    ).toEqual({ dispatcher: 'function', events: 'function' });
  });

  it('accepts 7-day TWAP details without stripping trigger and stop prices', () => {
    expect(
      runSdkCheck(`
      const result = v.safeParse(TwapOrderRequest, {
        ...envelope,
        action: {
          type: 'twapOrder',
          twap: { a: 0, b: true, s: '1', r: false, m: 10080, t: true },
          details: { t: { p: '100', a: true }, s: '110' },
        },
      });
      process.stdout.write(JSON.stringify({
        success: result.success,
        details: result.success ? result.output.action.details : undefined,
      }));
    `),
    ).toEqual({
      success: true,
      details: { t: { p: '100', a: true }, s: '110' },
    });
  });
});
