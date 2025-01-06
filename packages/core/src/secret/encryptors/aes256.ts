import * as crypto from 'crypto';

import { AES_CBC, Pbkdf2HmacSha256 } from 'asmcrypto.js';

import { IncorrectPassword } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { sha256 } from '../hash';

import { xorDecrypt, xorEncrypt } from './xor';

// Below codes are comments to note algorithm and digest method used.
// const ALGORITHM = 'aes-256-cbc';
// const PBKDF2_DIGEST_METHOD = 'sha256';
const PBKDF2_NUM_OF_ITERATIONS = 5000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_SALT_LENGTH = 32;
const AES256_IV_LENGTH = 16;
const ENCRYPTED_DATA_OFFSET = PBKDF2_SALT_LENGTH + AES256_IV_LENGTH;

function keyFromPasswordAndSalt(password: string, salt: Buffer): Buffer {
  return Buffer.from(
    Pbkdf2HmacSha256(
      sha256(Buffer.from(password, 'utf8')),
      salt,
      PBKDF2_NUM_OF_ITERATIONS,
      PBKDF2_KEY_LENGTH,
    ),
  );
}

export const encodeKeyPrefix =
  'ENCODE_KEY::755174C1-6480-401A-8C3D-84ADB2E0C376::';
let encodeKey = platformEnv.isWebEmbed
  ? ''
  : `${encodeKeyPrefix}${generateUUID()}`;
const ENCODE_TEXT_PREFIX = {
  aes: 'SENSITIVE_ENCODE::AE7EADC1-CDA0-45FA-A340-E93BEDDEA21E::',
  xor: 'SENSITIVE_ENCODE::AAAAAAAA-2E51-4DC6-A913-79EB1C62D09E::',
};
// xor more fast but not safe
const SENSITIVE_ENCODE_TYPE: 'xor' | 'aes' = 'aes';

function ensureEncodeKeyExists(key: string) {
  if (!key) {
    throw new Error(
      'encodeKey is not set, please call setBgSensitiveTextEncodeKey() from webembed',
    );
  }
}

function isEncodedSensitiveText(text: string) {
  return (
    text.startsWith(ENCODE_TEXT_PREFIX.aes) ||
    text.startsWith(ENCODE_TEXT_PREFIX.xor)
  );
}

/**
 * @deprecated 已弃用 - Use decodePasswordAsync instead. This synchronous decoding method will be removed in a future version.
 * @see decodePasswordAsync
 */
function decodePassword({
  password,
  key,
  ignoreLogger,
  allowRawPassword,
}: {
  password: string;
  key?: string;
  ignoreLogger?: boolean;
  allowRawPassword?: boolean;
}): string {
  // do nothing if password is encodeKey, but not a real password
  if (password.startsWith(encodeKeyPrefix)) {
    return password;
  }
  // decode password if it is encoded
  if (isEncodedSensitiveText(password)) {
    if (platformEnv.isExtensionUi) {
      throw new Error('decodePassword can NOT be called from UI');
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return decodeSensitiveText({ encodedText: password, key, ignoreLogger });
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    password &&
    !platformEnv.isJest &&
    !allowRawPassword
  ) {
    console.error(
      'Passing raw password is not allowed and not safe, please encode it at the beginning of debugger breakpoint call stack.',
    );
    throw new Error('Passing raw password is not allowed and not safe.');
  }
  return password;
}

async function decodePasswordAsync({
  password,
  key,
  ignoreLogger,
  allowRawPassword,
}: {
  password: string;
  key?: string;
  ignoreLogger?: boolean;
  allowRawPassword?: boolean;
}): Promise<string> {
  // do nothing if password is encodeKey, but not a real password
  if (password.startsWith(encodeKeyPrefix)) {
    return password;
  }
  // decode password if it is encoded
  if (isEncodedSensitiveText(password)) {
    if (platformEnv.isExtensionUi) {
      throw new Error('decodePassword can NOT be called from UI');
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return decodeSensitiveTextAsync({
      encodedText: password,
      key,
      ignoreLogger,
    });
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    password &&
    !platformEnv.isJest &&
    !allowRawPassword
  ) {
    console.error(
      'Passing raw password is not allowed and not safe, please encode it at the beginning of debugger breakpoint call stack.',
    );
    throw new Error('Passing raw password is not allowed and not safe.');
  }
  return password;
}

async function encodePassword({
  password,
  key,
}: {
  password: string;
  key?: string;
}): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return encodeSensitiveText({
    text: password,
    key,
  });
}

// ------------------------------------------------------------

/**
 * @deprecated Use encryptAsync instead. This synchronous encryption method will be removed in a future version.
 * @see encryptAsync
 */
function encrypt(
  password: string,
  data: Buffer | string,
  allowRawPassword?: boolean,
): Buffer {
  console.warn('encrypt() is deprecated. Please use encryptAsync() instead');
  // eslint-disable-next-line no-console
  console.trace('encrypt() call stack');
  if (!password) {
    throw new IncorrectPassword();
  }
  const dataBuffer = bufferUtils.toBuffer(data);
  // eslint-disable-next-line no-param-reassign
  const passwordDecoded = decodePassword({ password, allowRawPassword });
  if (!passwordDecoded) {
    throw new IncorrectPassword();
  }
  const salt: Buffer = crypto.randomBytes(PBKDF2_SALT_LENGTH);
  const key: Buffer = keyFromPasswordAndSalt(passwordDecoded, salt);
  const iv: Buffer = crypto.randomBytes(AES256_IV_LENGTH);
  return Buffer.concat([
    salt,
    iv,
    Buffer.from(AES_CBC.encrypt(dataBuffer, key, true, iv)),
  ]);
}

// ------------------------------------------------------------

export type IEncryptStringParams = {
  password: string;
  data: string;
  dataEncoding?: BufferEncoding;
  allowRawPassword?: boolean;
};

/**
 * @deprecated Use encryptStringAsync instead. This synchronous encryption method will be removed in a future version.
 * @see encryptStringAsync
 */
function encryptString({
  password,
  data,
  dataEncoding = 'hex',
  allowRawPassword,
}: IEncryptStringParams): string {
  console.warn(
    'encryptString() is deprecated. Please use encryptStringAsync() instead',
  );
  // eslint-disable-next-line no-console
  console.trace('encryptString() call stack');
  const bytes = encrypt(
    password,
    bufferUtils.toBuffer(data, dataEncoding),
    allowRawPassword,
  );
  return bufferUtils.bytesToHex(bytes);
}

// ------------------------------------------------------------
export type IEncryptAsyncParams = {
  password: string;
  data: Buffer | string;
  allowRawPassword?: boolean;
};
async function encryptAsync({
  password,
  data,
  allowRawPassword,
}: IEncryptAsyncParams): Promise<Buffer> {
  if (!password) {
    throw new IncorrectPassword();
  }

  if (platformEnv.isNative && !platformEnv.isJest) {
    const webembedApiProxy = (
      await import('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy')
    ).default;
    const str = await webembedApiProxy.secret.encryptAsync({
      password,
      // data,
      data: bufferUtils.bytesToHex(data),
      allowRawPassword,
    });
    return bufferUtils.toBuffer(str, 'hex');
  }

  const passwordDecoded = decodePassword({ password, allowRawPassword });

  if (!passwordDecoded) {
    throw new IncorrectPassword();
  }

  const dataBuffer = bufferUtils.toBuffer(data);

  const salt: Buffer = crypto.randomBytes(PBKDF2_SALT_LENGTH);
  const key: Buffer = keyFromPasswordAndSalt(passwordDecoded, salt);
  const iv: Buffer = crypto.randomBytes(AES256_IV_LENGTH);
  return Buffer.concat([
    salt,
    iv,
    Buffer.from(AES_CBC.encrypt(dataBuffer, key, true, iv)),
  ]);
}

/**
 * @deprecated 已弃用 - Use decryptAsync instead. This synchronous decryption method will be removed in a future version.
 * @see decryptAsync
 */
function decrypt(
  password: string,
  data: Buffer | string,
  // avoid recursive call log output order confusion
  ignoreLogger?: boolean,
  allowRawPassword?: boolean,
): Buffer {
  if (!ignoreLogger) {
    console.warn(
      'decrypt() 已弃用 (deprecated). Please use decryptAsync() instead',
    );
    console.trace('decrypt() call stack');
  }
  if (!password) {
    throw new IncorrectPassword();
  }
  const dataBuffer = bufferUtils.toBuffer(data);

  if (!ignoreLogger) {
    defaultLogger.account.secretPerf.decodePassword();
  }
  // eslint-disable-next-line no-param-reassign
  const passwordDecoded = decodePassword({
    password,
    ignoreLogger: true,
    allowRawPassword,
  });

  if (!passwordDecoded) {
    throw new IncorrectPassword();
  }

  if (!ignoreLogger) {
    defaultLogger.account.secretPerf.decodePasswordDone();
  }

  const salt: Buffer = dataBuffer.slice(0, PBKDF2_SALT_LENGTH);

  if (!ignoreLogger) {
    defaultLogger.account.secretPerf.keyFromPasswordAndSalt();
  }
  const key: Buffer = keyFromPasswordAndSalt(passwordDecoded, salt);
  if (!ignoreLogger) {
    defaultLogger.account.secretPerf.keyFromPasswordAndSaltDone();
  }

  const iv: Buffer = dataBuffer.slice(
    PBKDF2_SALT_LENGTH,
    ENCRYPTED_DATA_OFFSET,
  );

  try {
    if (!ignoreLogger) {
      defaultLogger.account.secretPerf.decryptAES();
    }
    // TODO make to async call RN_AES(@metamask/react-native-aes-crypto)
    // const aesDecryptData = await RN_AES.decrypt(
    //   dataBuffer.slice(ENCRYPTED_DATA_OFFSET).toString('base64'),
    //   key.toString('base64'),
    //   iv.toString('base64'),
    // );

    const aesDecryptData = AES_CBC.decrypt(
      dataBuffer.slice(ENCRYPTED_DATA_OFFSET),
      key,
      true,
      iv,
    );
    if (!ignoreLogger) {
      defaultLogger.account.secretPerf.decryptAESDone();
    }

    return Buffer.from(aesDecryptData);
  } catch (e) {
    if (!platformEnv.isJest) {
      console.error(e);
    }
    throw new IncorrectPassword();
  }
}

export type IDecryptAsyncParams = {
  password: string;
  data: Buffer | string;
  allowRawPassword?: boolean;
  ignoreLogger?: boolean;
};
/**
 * The recommended asynchronous decryption method
 * @param password - The password to decrypt with
 * @param data - The data to decrypt
 * @param allowRawPassword - Whether to allow raw password input
 * @returns Promise<Buffer> - The decrypted data
 */
async function decryptAsync({
  password,
  data,
  allowRawPassword,
  ignoreLogger,
}: IDecryptAsyncParams): Promise<Buffer> {
  if (!password) {
    throw new IncorrectPassword();
  }
  if (platformEnv.isNative && !platformEnv.isJest) {
    const webembedApiProxy = (
      await import('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy')
    ).default;
    const str = await webembedApiProxy.secret.decryptAsync({
      password,
      // data,
      data: bufferUtils.bytesToHex(data),
      allowRawPassword,
      ignoreLogger,
    });
    return bufferUtils.toBuffer(str, 'hex');
  }

  if (!ignoreLogger) {
    defaultLogger.account.secretPerf.decodePassword();
  }
  // eslint-disable-next-line no-param-reassign
  const passwordDecoded = await decodePasswordAsync({
    password,
    allowRawPassword,
    ignoreLogger: true,
  });
  if (!passwordDecoded) {
    throw new IncorrectPassword();
  }
  if (!ignoreLogger) {
    defaultLogger.account.secretPerf.decodePasswordDone();
  }

  const dataBuffer = bufferUtils.toBuffer(data);
  const salt: Buffer = dataBuffer.slice(0, PBKDF2_SALT_LENGTH);

  if (!ignoreLogger) {
    defaultLogger.account.secretPerf.keyFromPasswordAndSalt();
  }
  const key: Buffer = keyFromPasswordAndSalt(passwordDecoded, salt);
  if (!ignoreLogger) {
    defaultLogger.account.secretPerf.keyFromPasswordAndSaltDone();
  }

  const iv: Buffer = dataBuffer.slice(
    PBKDF2_SALT_LENGTH,
    ENCRYPTED_DATA_OFFSET,
  );

  try {
    if (!ignoreLogger) {
      defaultLogger.account.secretPerf.decryptAES();
    }
    // TODO make to async call RN_AES(@metamask/react-native-aes-crypto)
    // const aesDecryptData = await RN_AES.decrypt(
    //   dataBuffer.slice(ENCRYPTED_DATA_OFFSET).toString('base64'),
    //   key.toString('base64'),
    //   iv.toString('base64'),
    // );

    const aesDecryptData = AES_CBC.decrypt(
      dataBuffer.slice(ENCRYPTED_DATA_OFFSET),
      key,
      true,
      iv,
    );
    if (!ignoreLogger) {
      defaultLogger.account.secretPerf.decryptAESDone();
    }

    return Buffer.from(aesDecryptData);
  } catch (e) {
    if (!platformEnv.isJest) {
      console.error(e);
    }
    throw new IncorrectPassword();
  }
}

export type IDecryptStringParams = {
  password: string;
  data: string;
  resultEncoding?: BufferEncoding;
  dataEncoding?: BufferEncoding;
  allowRawPassword?: boolean;
};
/**
 * @deprecated 已弃用 - Use decryptStringAsync instead. This synchronous decryption method will be removed in a future version.
 * @see decryptStringAsync
 */
function decryptString({
  password,
  data,
  resultEncoding = 'hex',
  dataEncoding = 'hex',
  allowRawPassword,
}: IDecryptStringParams): string {
  console.warn(
    'decryptString() 已弃用 (deprecated). Please use decryptStringAsync() instead',
  );
  console.trace('decryptString() call stack');
  const bytes = decrypt(
    password,
    bufferUtils.toBuffer(data, dataEncoding),
    undefined,
    allowRawPassword,
  );
  if (resultEncoding === 'hex') {
    return bufferUtils.bytesToHex(bytes);
  }
  return bufferUtils.bytesToText(bytes, resultEncoding);
}

async function decryptStringAsync({
  password,
  data,
  resultEncoding = 'hex',
  dataEncoding = 'hex',
  allowRawPassword,
}: IDecryptStringParams): Promise<string> {
  const bytes = await decryptAsync({
    password,
    data: bufferUtils.toBuffer(data, dataEncoding),
    allowRawPassword,
  });
  if (resultEncoding === 'hex') {
    return bufferUtils.bytesToHex(bytes);
  }
  return bufferUtils.bytesToText(bytes, resultEncoding);
}

async function encryptStringAsync({
  password,
  data,
  dataEncoding = 'hex',
  allowRawPassword,
}: IEncryptStringParams): Promise<string> {
  const bufferData = bufferUtils.toBuffer(data, dataEncoding);
  const bytes = await encryptAsync({
    password,
    data: bufferData,
    allowRawPassword,
  });
  return bufferUtils.bytesToHex(bytes);
}

function checkKeyPassedOnExtUi(key?: string) {
  if (platformEnv.isExtensionUi && !key) {
    throw new Error(
      'Please get and pass key by:  await backgroundApiProxy.servicePassword.getBgSensitiveTextEncodeKey()',
    );
  }
}

function ensureSensitiveTextEncoded(text: string) {
  if (!isEncodedSensitiveText(text)) {
    throw new Error('Not encoded sensitive text');
  }
}

/**
 * @deprecated 已弃用 - Use decodeSensitiveTextAsync instead. This synchronous decoding method will be removed in a future version.
 * @see decodeSensitiveTextAsync
 */
function decodeSensitiveText({
  encodedText,
  key,
  ignoreLogger,
  allowRawPassword,
}: {
  encodedText: string;
  key?: string;
  // avoid recursive call log output order confusion
  ignoreLogger?: boolean;
  allowRawPassword?: boolean;
}): string {
  console.warn(
    'decodeSensitiveText() 已弃用 (deprecated). Please use decodeSensitiveTextAsync() instead',
  );
  console.trace('decodeSensitiveText() call stack');
  checkKeyPassedOnExtUi(key);
  const theKey = key || encodeKey;
  ensureEncodeKeyExists(theKey);
  if (isEncodedSensitiveText(encodedText)) {
    if (encodedText.startsWith(ENCODE_TEXT_PREFIX.aes)) {
      const text = decrypt(
        theKey,
        Buffer.from(encodedText.slice(ENCODE_TEXT_PREFIX.aes.length), 'hex'),
        ignoreLogger,
        allowRawPassword,
      ).toString('utf-8');
      return text;
    }
    if (encodedText.startsWith(ENCODE_TEXT_PREFIX.xor)) {
      const text = xorDecrypt({
        encryptedDataHex: encodedText.slice(ENCODE_TEXT_PREFIX.xor.length),
        key: theKey,
      });
      return text;
    }
  }
  throw new Error('Not correct encoded text');
}

async function decodeSensitiveTextAsync({
  encodedText,
  key,
  ignoreLogger,
  allowRawPassword,
}: {
  encodedText: string;
  key?: string;
  // avoid recursive call log output order confusion
  ignoreLogger?: boolean;
  allowRawPassword?: boolean;
}): Promise<string> {
  checkKeyPassedOnExtUi(key);
  const theKey = key || encodeKey;
  ensureEncodeKeyExists(theKey);
  if (isEncodedSensitiveText(encodedText)) {
    if (encodedText.startsWith(ENCODE_TEXT_PREFIX.aes)) {
      const decrypted = await decryptAsync({
        password: theKey,
        data: Buffer.from(
          encodedText.slice(ENCODE_TEXT_PREFIX.aes.length),
          'hex',
        ),
        allowRawPassword,
      });
      return decrypted.toString('utf-8');
    }
    if (encodedText.startsWith(ENCODE_TEXT_PREFIX.xor)) {
      const text = xorDecrypt({
        encryptedDataHex: encodedText.slice(ENCODE_TEXT_PREFIX.xor.length),
        key: theKey,
      });
      return text;
    }
  }
  throw new Error('Not correct encoded text');
}

async function encodeSensitiveText({
  text,
  key,
}: {
  text: string;
  key?: string;
}) {
  checkKeyPassedOnExtUi(key);
  const theKey = key || encodeKey;
  ensureEncodeKeyExists(theKey);
  // text is already encoded
  if (isEncodedSensitiveText(text)) {
    if (
      !platformEnv.isExtensionUi &&
      !platformEnv.isNative &&
      platformEnv.isDev
    ) {
      // try to decode it to verify if encode by same key
      decodeSensitiveText({ encodedText: text });
    }
    return text;
  }

  // *** aes encode
  if (SENSITIVE_ENCODE_TYPE === 'aes') {
    // const encoded = encrypt(theKey, Buffer.from(text, 'utf-8'), true).toString(
    //   'hex',
    // );
    const encoded = (
      await encryptAsync({
        password: theKey,
        data: Buffer.from(text, 'utf-8'),
        allowRawPassword: true,
      })
    ).toString('hex');
    return `${ENCODE_TEXT_PREFIX.aes}${encoded}`;
  }

  // *** xor encode
  if (SENSITIVE_ENCODE_TYPE === 'xor') {
    const encoded = xorEncrypt({
      data: text,
      key: theKey,
    });
    return `${ENCODE_TEXT_PREFIX.xor}${encoded}`;
  }

  throw new Error('Unknown SENSITIVE_ENCODE_TYPE type');
}

function getBgSensitiveTextEncodeKey() {
  if (platformEnv.isExtensionUi) {
    throw new Error(
      'Not allow to call ()getBgSensitiveTextEncodeKey from extension ui',
    );
  }
  return encodeKey;
}

function setBgSensitiveTextEncodeKey(key: string) {
  if (platformEnv.isExtensionUi) {
    throw new Error(
      'Not allow to call setBgSensitiveTextEncodeKey() from extension ui',
    );
  }
  if (!platformEnv.isWebEmbed) {
    throw new Error(
      'Only allow to call setBgSensitiveTextEncodeKey() from webembed',
    );
  }
  encodeKey = key;
}

export {
  decodePassword,
  decodePasswordAsync,
  decodeSensitiveText,
  decodeSensitiveTextAsync,
  decrypt,
  decryptAsync,
  decryptString,
  decryptStringAsync,
  encodePassword,
  encodeSensitiveText,
  encrypt,
  encryptAsync,
  encryptString,
  encryptStringAsync,
  ensureSensitiveTextEncoded,
  getBgSensitiveTextEncodeKey,
  isEncodedSensitiveText,
  setBgSensitiveTextEncodeKey,
};
