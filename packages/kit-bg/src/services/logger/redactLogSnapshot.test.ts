import { redactLogSnapshot } from './redactLogSnapshot';

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));

const PRIVATE_KEY = 'a'.repeat(32) + 'b'.repeat(32);
const MNEMONIC = Array.from({ length: 12 }, () => 'abandon').join(' ');

const redact = async (text: string) =>
  (await redactLogSnapshot(new Blob([text], { type: 'text/plain' }))).text();

describe('redactLogSnapshot', () => {
  it('removes key material and keeps ordinary diagnostics', async () => {
    const lines = [
      `export key 0x${PRIVATE_KEY}`,
      'wif L1aW4aubDFB7yfras2S1mN3bqg9nwySY8nkoLmJebSLD5BWv3ENZ done',
      `restore ${MNEMONIC}`,
      `auth Bearer ${'x'.repeat(32)}`,
      `jwt eyJ${'A'.repeat(48)}`,
      `send to 0x${'c'.repeat(40)} failed with code 500`,
    ];
    const output = (await redact(lines.join('\n'))).split('\n');
    expect(
      output.slice(0, 5).every((line) => line.includes('[REDACTED]')),
    ).toBe(true);
    expect(output.join('\n')).not.toContain(PRIVATE_KEY);
    expect(output.join('\n')).not.toContain(MNEMONIC);
    expect(output[5]).toBe(lines[5]);
  });

  it('keeps a public transaction id and still redacts a raw key on the same line', async () => {
    const txid = 'ab'.repeat(32);
    const line = `transaction => send => rawTxFetchFailed : {"network":"btc--0","txids":["${txid}"],"key":"${PRIVATE_KEY}"}`;
    const output = await redact(line);
    expect(output).toContain(txid);
    expect(output).not.toContain(PRIVATE_KEY);
    expect(output).toContain('"key":"[REDACTED]"');
  });

  it('matches a secret that crosses a read page boundary', async () => {
    const filler = 'log line\n'.repeat(Math.floor(65_520 / 9));
    const text = `${filler}key=${PRIVATE_KEY}\nnext line\n`;
    const output = await redact(text);
    expect(output).not.toContain(PRIVATE_KEY);
    expect(output.endsWith('key=[REDACTED]\nnext line\n')).toBe(true);
    expect(output.startsWith(filler)).toBe(true);
  });
});
