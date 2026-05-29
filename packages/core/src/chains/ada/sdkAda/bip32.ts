/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

// @ts-expect-error
import { bech32, mnemonicToRootKeypair, toPublic } from 'cardano-crypto.js';

import { mnemonicFromEntropy } from '@onekeyhq/core/src/secret';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { DERIVATION_SCHEME, HARDENED_THRESHOLD } from './constants';

import type { ICoreHdCredentialEncryptHex } from '../../../types';
import type { IAdaBIP32Path } from '../types';

// Diagnostic hook so the (node_modules) cardano-crypto.js patch can log the
// internal steps of mnemonicToRootKeypair through our persisted logger
// (@LogToLocal). Registered at module load of the ada CoreChainHd segment,
// which runs before any derivation call. Keep it crash-safe.
(globalThis as any).__adaDebugLog = (
  tag: string,
  phase: 'start' | 'done' | 'error',
  info?: string,
) => {
  try {
    defaultLogger.account.adaDebug.step({ tag, phase, info });
  } catch {
    // logger unavailable — never let diagnostics break derivation
  }
};

// One-shot diagnostic: snapshot the bg-runtime environment and fire every
// async-deferral primitive once. Whichever logs 'start' but never 'done' is
// the scheduler that's dead on this runtime (that's why pbkdf2's async
// callback never returns). Also flips __adaProcTrace so the patched npm
// `process` polyfill logs its internal nextTick/runTimeout/drainQueue flow.
function __adaProbeDeferrals() {
  const g: any = globalThis;
  const L = g.__adaDebugLog || (() => {});
  g.__adaProcTrace = true;
  g.__adaProcTraceN = 0;
  try {
    const c = g.crypto;
    L(
      'probe.env',
      'done',
      `crypto=${typeof c} subtle=${typeof c?.subtle} digest=${typeof c?.subtle
        ?.digest} importKey=${typeof c?.subtle?.importKey} deriveBits=${typeof c
        ?.subtle
        ?.deriveBits} setTimeout=${typeof g.setTimeout} setImmediate=${typeof g.setImmediate} queueMicrotask=${typeof g.queueMicrotask} process=${typeof g.process} nextTick=${typeof g
        .process?.nextTick} browser=${String(g.process?.browser)}`,
    );
  } catch (e) {
    L('probe.env', 'error', String(e));
  }
  const fire = (tag: string, schedule: (cb: () => void) => void) => {
    try {
      L(tag, 'start');
      schedule(() => L(tag, 'done'));
    } catch (e) {
      L(tag, 'error', String(e));
    }
  };
  const g2: any = globalThis;
  fire('probe.setTimeout', (cb) => g2.setTimeout(cb, 0));
  fire('probe.promiseThen', (cb) => {
    void Promise.resolve().then(cb);
  });
  fire('probe.queueMicrotask', (cb) =>
    g2.queueMicrotask ? g2.queueMicrotask(cb) : cb(),
  );
  fire('probe.setImmediate', (cb) =>
    g2.setImmediate
      ? g2.setImmediate(cb)
      : L('probe.setImmediate', 'error', 'absent'),
  );
  fire('probe.processNextTick', (cb) =>
    g2.process && g2.process.nextTick
      ? g2.process.nextTick(cb)
      : L('probe.processNextTick', 'error', 'absent'),
  );
}

export function toBip32StringPath(derivationPath: IAdaBIP32Path) {
  return `m/${derivationPath
    .map(
      (item) =>
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        (item % HARDENED_THRESHOLD) + (item >= HARDENED_THRESHOLD ? "'" : ''),
    )
    .join('/')}`;
}

export function getPathIndex(path: string) {
  return path.split('/').slice(3, 4)[0].slice(0, -1);
}

export async function getRootKey(
  password: string,
  hdCredential: ICoreHdCredentialEncryptHex,
): Promise<Buffer> {
  __adaProbeDeferrals();
  defaultLogger.account.adaDebug.step({
    tag: 'getRootKey.mnemonicFromEntropy',
    phase: 'start',
  });
  let mnemonic: string;
  try {
    mnemonic = await mnemonicFromEntropy(hdCredential, password);
  } catch (e) {
    defaultLogger.account.adaDebug.step({
      tag: 'getRootKey.mnemonicFromEntropy',
      phase: 'error',
      info: String((e as Error)?.message || e),
    });
    throw e;
  }
  defaultLogger.account.adaDebug.step({
    tag: 'getRootKey.mnemonicFromEntropy',
    phase: 'done',
    info: `mnemonicWords=${mnemonic ? mnemonic.split(' ').length : 0}`,
  });

  defaultLogger.account.adaDebug.step({
    tag: 'getRootKey.mnemonicToRootKeypair',
    phase: 'start',
  });
  let rootKey: Buffer;
  try {
    rootKey = await mnemonicToRootKeypair(mnemonic, DERIVATION_SCHEME);
  } catch (e) {
    defaultLogger.account.adaDebug.step({
      tag: 'getRootKey.mnemonicToRootKeypair',
      phase: 'error',
      info: String((e as Error)?.message || e),
    });
    throw e;
  }
  defaultLogger.account.adaDebug.step({
    tag: 'getRootKey.mnemonicToRootKeypair',
    phase: 'done',
    info: `rootKeyLen=${rootKey ? rootKey.length : 0}`,
  });
  return rootKey;
}

export async function getXprvString(
  password: Buffer,
  entropy?: string,
): Promise<string>;
export async function getXprvString(
  password: string,
  entropy: Buffer,
): Promise<string>;
export async function getXprvString(
  password: any,
  entropy: any,
): Promise<string> {
  const rootKey =
    typeof password === 'string'
      ? await getRootKey(password, entropy)
      : password;
  const xprv = bech32.encode(
    'xprv',
    Buffer.concat([rootKey.slice(0, 64), rootKey.slice(96)]),
  ) as string;
  return xprv;
}

export async function generateExportedCredential(
  password: string,
  hdCredential: ICoreHdCredentialEncryptHex,
  path: string,
) {
  const index = getPathIndex(path);
  const rootKey = await getRootKey(password, hdCredential);
  const xprv = bech32.encode(
    'xprv',
    Buffer.concat([
      rootKey.slice(0, 64),
      rootKey.slice(96, 128),
      Buffer.from(index, 'utf8'),
    ]),
  ) as string;
  return xprv;
}

/*
 * @param xprv xprv string, 165 length, generate from OneKey wallet
 */
export function decodePrivateKeyByXprv(xprv: string) {
  const decodeXprv = bech32.decode(xprv);
  const index = decodeXprv.data.slice(96);
  const publicKey = toPublic(decodeXprv.data.slice(0, 64));
  const privateKey = Buffer.concat([
    decodeXprv.data.slice(0, 64),
    publicKey,
    decodeXprv.data.slice(64, 96),
    index,
  ]);
  return privateKey;
}

export function encodePrivateKey(privateKey: Buffer) {
  return {
    rootKey: privateKey.slice(0, 128),
    index: Buffer.from(privateKey.slice(128)).toString('utf8'),
  };
}

export function generateXprvFromPrivateKey(privateKey: Buffer) {
  const { rootKey, index } = encodePrivateKey(privateKey);
  const xprv = bech32.encode(
    'xprv',
    Buffer.concat([
      rootKey.slice(0, 64),
      rootKey.slice(96, 128),
      Buffer.from(index, 'utf8'),
    ]),
  ) as string;

  return xprv;
}
