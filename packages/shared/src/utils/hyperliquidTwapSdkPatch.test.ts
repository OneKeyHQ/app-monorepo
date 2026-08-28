import { execFileSync } from 'node:child_process';

describe('Hyperliquid TWAP SDK patch', () => {
  it('accepts 7-day TWAP details without stripping trigger and stop prices', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import * as v from './node_modules/@nktkas/hyperliquid/node_modules/valibot/dist/index.mjs';
          import { TwapOrderRequest } from '@nktkas/hyperliquid/api/exchange';
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
