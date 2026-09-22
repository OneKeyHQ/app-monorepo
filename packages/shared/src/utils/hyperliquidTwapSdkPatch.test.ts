import { execFileSync } from 'node:child_process';

describe('Hyperliquid TWAP SDK patch', () => {
  it('accepts 7-day TWAP details without stripping trigger and stop prices', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import { createRequire } from 'node:module';
          import { TwapOrderRequest } from '@nktkas/hyperliquid/api/exchange';
          const sdkRequire = createRequire(import.meta.resolve('@nktkas/hyperliquid'));
          const v = sdkRequire('valibot');
          const result = v.safeParse(TwapOrderRequest, {
            action: {
              type: 'twapOrder',
              twap: { a: 0, b: true, s: '1', r: false, m: 10080, t: true },
              details: { t: { p: '100', a: true }, s: '110' },
            },
            nonce: 1,
            signature: {
              r: \`0x\${'0'.repeat(64)}\`,
              s: \`0x\${'0'.repeat(64)}\`,
              v: 27,
            },
          });
          process.stdout.write(JSON.stringify({
            success: result.success,
            details: result.success ? result.output.action.details : undefined,
          }));
        `,
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      success: true,
      details: {
        t: { p: '100', a: true },
        s: '110',
      },
    });
  });

  it('preserves Chase always_place and ordinary amendment defaults without the old patch', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import { createRequire } from 'node:module';
          import { ModifyRequest } from '@nktkas/hyperliquid/api/exchange';
          const sdkRequire = createRequire(import.meta.resolve('@nktkas/hyperliquid'));
          const v = sdkRequire('valibot');
          const request = {
            action: {
              type: 'modify',
              oid: 123,
              order: { a: 0, b: true, p: '100', s: '1', r: false, t: { limit: { tif: 'Gtc' } } },
            },
            nonce: 1,
            signature: { r: '0x' + '0'.repeat(64), s: '0x' + '0'.repeat(64), v: 27 },
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
        `,
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      ordinaryHasAlwaysPlace: false,
      chaseAlwaysPlace: true,
      chaseAssetId: 0,
    });
  });

  it('retains the transport hooks used by subscription reconciliation', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import { WebSocketTransport } from '@nktkas/hyperliquid';
          const transport = new WebSocketTransport({ url: 'ws://127.0.0.1:1' });
          process.stdout.write(JSON.stringify({
            dispatcher: typeof transport._dispatcher?.request,
            events: typeof transport._hlEvents?.addEventListener,
          }));
          transport.close();
        `,
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      dispatcher: 'function',
      events: 'function',
    });
  });
});
