import { OneKeyLocalError } from '../../errors';

import { withSesCheckDeadline } from './runtimeCheckDeadline';
import { SES_LIBRARY_TASKS } from './runtimeCheckLibraryTasks';

import type { ISesRuntimeCheckItem } from './runtimeCheck';
import type { ISesCheckDeadline } from './runtimeCheckDeadline';

const SHA256_ABC =
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const SHA512_ABC =
  'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f';

export function assertSesBehavior(condition: boolean, message: string): void {
  if (!condition) {
    throw new OneKeyLocalError(message);
  }
}

export function runSesLibraryChecks(
  options?: ISesCheckDeadline,
): Promise<ISesRuntimeCheckItem[]> {
  return Promise.all(
    SES_LIBRARY_TASKS.map(({ name, run }) =>
      checkSesBehavior(
        name,
        '验证 lockdown 后实际依赖库的运算、签名和初始化。',
        run,
        options,
      ),
    ),
  );
}

export async function checkSesBehavior(
  name: string,
  purpose: string,
  task: (signal: AbortSignal) => string | Promise<string>,
  options?: ISesCheckDeadline,
): Promise<ISesRuntimeCheckItem> {
  try {
    return {
      name,
      dimension: 'functionality',
      purpose,
      status: 'pass',
      detail: await withSesCheckDeadline(name, task, options),
    };
  } catch (error) {
    return {
      name,
      dimension: 'functionality',
      purpose,
      status: 'fail',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runSesLanguageChecks(
  options?: ISesCheckDeadline,
): Promise<ISesRuntimeCheckItem[]> {
  return Promise.all([
    checkSesBehavior(
      'Promise edge cases',
      '验证 thenable、错误传播和微任务顺序。',
      async () => {
        const order: string[] = [];
        const pending = Promise.resolve().then(() => order.push('microtask'));
        order.push('sync');
        await pending;
        assertSesBehavior(
          order.join(',') === 'sync,microtask',
          'microtask order',
        );
        const thenable = {
          // The probe deliberately exercises Promise assimilation of a thenable.
          // oxlint-disable-next-line unicorn/no-thenable
          then(resolve: (value: number) => void) {
            resolve(42);
            resolve(99);
          },
        };
        assertSesBehavior(
          (await Promise.resolve(thenable)) === 42,
          'thenable resolution',
        );
        const fixtureError = new OneKeyLocalError('public SES fixture');
        const caught = await Promise.resolve()
          .then(() => {
            throw fixtureError;
          })
          .finally(() => undefined)
          .catch((error: unknown) => error);
        assertSesBehavior(
          caught === fixtureError,
          'rejection identity through finally',
        );
        const finalError = await Promise.resolve(42)
          .finally(() => {
            throw fixtureError;
          })
          .catch((error: unknown) => error);
        assertSesBehavior(
          finalError === fixtureError,
          'finally rejection overrides fulfillment',
        );
        const rejected = await Promise.all([
          Promise.resolve(1),
          Promise.reject(fixtureError),
        ]).catch((error: unknown) => error);
        assertSesBehavior(rejected === fixtureError, 'Promise.all rejection');
        assertSesBehavior(
          (await Promise.all([])).length === 0,
          'empty Promise.all',
        );
        assertSesBehavior(
          (await Promise.allSettled([])).length === 0,
          'empty Promise.allSettled',
        );
        return 'microtask order, thenable first resolution, thrown errors, finally, all rejection, empty aggregates';
      },
      options,
    ),
    checkSesBehavior(
      'Collections and binary data',
      '验证集合、字节视图、Unicode 和 BigInt。',
      () => {
        const key = {};
        const map = new Map<object, number>([[key, 42]]);
        const weakMap = new WeakMap<object, number>([[key, 42]]);
        const set = new Set([1, 1, 2]);
        assertSesBehavior(
          map.get(key) === 42 && weakMap.get(key) === 42 && set.size === 2,
          'collection identity',
        );
        const bytes = new Uint8Array(8);
        const view = new DataView(bytes.buffer);
        view.setUint32(1, 0x12_34_56_78, true);
        assertSesBehavior(
          bytes.subarray(1, 5).join(',') === '120,86,52,18' &&
            view.getUint32(1, true) === 0x12_34_56_78,
          'DataView endianness',
        );
        const text = 'OneKey 🔐 中文';
        const encoded = new TextEncoder().encode(text);
        assertSesBehavior(
          new TextDecoder().decode(encoded) === text &&
            Buffer.from(encoded).toString('utf8') === text,
          'Unicode roundtrip',
        );
        assertSesBehavior(
          BigInt('9007199254740993') + 2n === 9_007_199_254_740_995n,
          'BigInt precision',
        );
        return 'Map/WeakMap identity, Set deduplication, TypedArray/DataView, UTF-8 Buffer/TextEncoder/TextDecoder, BigInt';
      },
      options,
    ),
  ]);
}

export async function runSesCryptoChecks(
  options?: ISesCheckDeadline,
): Promise<ISesRuntimeCheckItem[]> {
  // Public test vectors only; these checks never read wallet or storage data.
  return Promise.all([
    checkSesBehavior(
      'WebCrypto digest vectors',
      '验证 Gallery 与 PKCE 使用的 crypto.subtle.digest。',
      async () => {
        const data = new TextEncoder().encode('abc');
        for (const [algorithm, expected] of [
          ['SHA-256', SHA256_ABC],
          ['SHA-512', SHA512_ABC],
          ['SHA-1', 'a9993e364706816aba3e25717850c26c9cd0d89d'],
        ]) {
          const digest = await globalThis.crypto.subtle.digest(algorithm, data);
          assertSesBehavior(
            Buffer.from(digest).toString('hex') === expected,
            `${algorithm} subtle.digest vector mismatch`,
          );
        }
        return 'SHA-256, SHA-512, SHA-1 via crypto.subtle.digest (public abc vector)';
      },
      options,
    ),
    checkSesBehavior(
      'Hash and HMAC vectors',
      '验证实际平台 hash/HMAC 后端与公开向量一致。',
      async () => {
        const { sha256, sha512, hmacSHA256 } =
          await import('../../appCrypto/modules/hash');
        const data = Buffer.from('abc');
        assertSesBehavior(
          (await sha256(data)).toString('hex') === SHA256_ABC,
          'SHA-256 vector mismatch',
        );
        assertSesBehavior(
          (await sha512(data)).toString('hex') === SHA512_ABC,
          'SHA-512 vector mismatch',
        );
        assertSesBehavior(
          (
            await hmacSHA256(Buffer.alloc(20, 0x0b), Buffer.from('Hi There'))
          ).toString('hex') ===
            'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
          'RFC 4231 HMAC-SHA256 vector mismatch',
        );
        return 'SHA-256, SHA-512 (abc), RFC 4231 HMAC-SHA256; platform dispatcher';
      },
      options,
    ),
    checkSesBehavior(
      'PBKDF2 vector',
      '验证实际平台 KDF 后端输出。',
      async () => {
        const { pbkdf2, getPbkdf2BackendForCurrentPlatform } =
          await import('../../appCrypto/modules/pbkdf2');
        const result = await pbkdf2({
          password: Buffer.from('password'),
          salt: Buffer.from('salt'),
          iterations: 1,
          keyLength: 32,
        });
        assertSesBehavior(
          result.toString('hex') ===
            '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b',
          'PBKDF2-HMAC-SHA256 vector mismatch',
        );
        return `PBKDF2-HMAC-SHA256 public vector; backend=${getPbkdf2BackendForCurrentPlatform()}`;
      },
      options,
    ),
    checkSesBehavior(
      'AES-GCM vector and authentication',
      '验证加密、解密和拒绝篡改后的认证标签。',
      async () => {
        const {
          aesGcmEncrypt,
          aesGcmDecrypt,
          getAesGcmBackendForCurrentPlatform,
        } = await import('../../appCrypto/modules/aesGcm');
        const params = {
          key: Buffer.from('feffe9928665731c6d6a8f9467308308', 'hex'),
          nonce: Buffer.from('cafebabefacedbaddecaf888', 'hex'),
          aad: Buffer.from('feedfacedeadbeeffeedfacedeadbeefabaddad2', 'hex'),
          data: Buffer.from(
            'd9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39',
            'hex',
          ),
        };
        const encrypted = await aesGcmEncrypt(params);
        assertSesBehavior(
          encrypted.toString('hex') ===
            '42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e0915bc94fbc3221a5db94fae95ae7121a47',
          'NIST AES-GCM vector mismatch',
        );
        const decrypted = await aesGcmDecrypt({ ...params, data: encrypted });
        assertSesBehavior(
          decrypted.equals(params.data),
          'AES-GCM decrypt mismatch',
        );
        const tampered = Buffer.from(encrypted);
        tampered[tampered.length - 1] ^= 1;
        let rejected = false;
        try {
          await aesGcmDecrypt({ ...params, data: tampered });
        } catch {
          rejected = true;
        }
        assertSesBehavior(
          rejected,
          'AES-GCM accepted a tampered authentication tag',
        );
        return `NIST AES-GCM encrypt/decrypt, tampered tag rejected; backend=${getAesGcmBackendForCurrentPlatform()}`;
      },
      options,
    ),
  ]);
}
