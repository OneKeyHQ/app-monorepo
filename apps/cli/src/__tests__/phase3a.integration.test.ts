import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const BIN = resolve(__dirname, '../../bin/onekey');

function run(...args: string[]): string {
  return execFileSync(BIN, args, {
    encoding: 'utf-8',
    timeout: 30_000,
  }).trim();
}

// Suppress unused-variable lint — run() will be used when todos become real tests
void run;

describe('token commands (integration)', () => {
  it.todo('token search returns matching tokens');
  it.todo('token info returns token details');
  it.todo('token price returns price and changes');
  it.todo('token trending returns trending list');
  it.todo('token trades returns trade stats');
  it.todo('token liquidity returns top holders');
});

describe('market commands (integration)', () => {
  it.todo('market price returns single token price');
  it.todo('market prices returns batch prices');
  it.todo('market kline returns OHLCV data');
});

describe('swap commands (integration)', () => {
  it.todo('swap quote returns quotes with security data');
  it.todo('swap build creates pending order');
  it.todo('swap execute completes swap flow');
  it.todo('swap status returns transaction state');
});

describe('security commands (integration)', () => {
  it.todo('security audit returns risk assessment');
  it.todo('security simulate returns tx simulation');
});
