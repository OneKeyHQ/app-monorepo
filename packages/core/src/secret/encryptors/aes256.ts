import crypto from 'crypto';

import {
  IncorrectPassword,
  OneKeyPlainTextError,
} from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import {
  AES256_IV_LENGTH,
  ENCRYPTED_DATA_OFFSET,
  PBKDF2_SALT_LENGTH,
  aesCbcDecrypt,
  aesCbcEncrypt,
  keyFromPasswordAndSalt,
} from '../crypto-functions';

import { xorDecrypt, xorEncrypt } from './xor';

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
    throw new OneKeyPlainTextError(
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

async function decodePasswordAsync({
  password,
  key,
  ignoreLogger,
  allowRawPassword,
  useRnJsCrypto,
}: {
  password: string;
  key?: string;
  ignoreLogger?: boolean;
  allowRawPassword?: boolean;
  useRnJsCrypto?: boolean;
}): Promise<string> {
  // do nothing if password is encodeKey, but not a real password
  if (password.startsWith(encodeKeyPrefix)) {
    return password;
  }
  // decode password if it is encoded
  if (isEncodedSensitiveText(password)) {
    if (platformEnv.isExtensionUi) {
      throw new OneKeyPlainTextError(
        'decodePassword can NOT be called from UI',
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return decodeSensitiveTextAsync({
      encodedText: password,
      key,
      ignoreLogger,
      useRnJsCrypto,
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
    throw new OneKeyPlainTextError(
      'Passing raw password is not allowed and not safe.',
    );
  }
  return password;
}

async function encodePasswordAsync({
  password,
  key,
}: {
  password: string;
  key?: string;
}): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return encodeSensitiveTextAsync({
    text: password,
    key,
  });
}

// ------------------------------------------------------------

export type IEncryptStringParams = {
  password: string;
  data: string;
  dataEncoding?: BufferEncoding;
  allowRawPassword?: boolean;
};

// ------------------------------------------------------------
export type IEncryptAsyncParams = {
  password: string;
  data: Buffer | string;
  allowRawPassword?: boolean;
  useRnJsCrypto?: boolean;
};
async function encryptAsync({
  password,
  data,
  allowRawPassword,
  useRnJsCrypto,
}: IEncryptAsyncParams): Promise<Buffer> {
  if (!password) {
    throw new IncorrectPassword();
  }
  if (!useRnJsCrypto) {
    console.log('encryptAsync useRnJsCrypto', useRnJsCrypto);
    // console.log('encryptAsync useRnJsCrypto', useRnJsCrypto);
  }

  if (
    platformEnv.isNative &&
    !platformEnv.isJest &&
    !useRnJsCrypto &&
    !globalThis.$onekeyAppWebembedApiWebviewInitFailed
  ) {
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

  const passwordDecoded = await decodePasswordAsync({
    password,
    allowRawPassword,
  });

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
    aesCbcEncrypt({
      data: dataBuffer,
      key,
      iv,
      //
    }),
  ]);
}

export type IDecryptAsyncParams = {
  password: string;
  data: Buffer | string;
  allowRawPassword?: boolean;
  ignoreLogger?: boolean;
  useRnJsCrypto?: boolean; // useRnJsCrypto or webembedApi
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
  useRnJsCrypto,
}: IDecryptAsyncParams): Promise<Buffer> {
  if (!password) {
    throw new IncorrectPassword();
  }
  if (!useRnJsCrypto) {
    // console.log('decryptAsync useRnJsCrypto', useRnJsCrypto);
  }
  if (
    platformEnv.isNative &&
    !platformEnv.isJest &&
    !useRnJsCrypto &&
    !globalThis.$onekeyAppWebembedApiWebviewInitFailed
  ) {
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
    useRnJsCrypto,
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

    const aesDecryptData = aesCbcDecrypt({
      data: dataBuffer.slice(ENCRYPTED_DATA_OFFSET),
      key,
      iv,
    });
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
    ignoreLogger: undefined,
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
    throw new OneKeyPlainTextError(
      'Please get and pass key by:  await backgroundApiProxy.servicePassword.getBgSensitiveTextEncodeKey()',
    );
  }
}

function ensureSensitiveTextEncoded(text: string) {
  if (!isEncodedSensitiveText(text)) {
    throw new OneKeyPlainTextError('Not encoded sensitive text');
  }
}

async function decodeSensitiveTextAsync({
  encodedText,
  key,
  ignoreLogger,
  allowRawPassword,
  useRnJsCrypto,
}: {
  encodedText: string;
  key?: string;
  // avoid recursive call log output order confusion
  ignoreLogger?: boolean;
  allowRawPassword?: boolean;
  useRnJsCrypto?: boolean;
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
        ignoreLogger,
        allowRawPassword,
        useRnJsCrypto,
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
  // if not encoded, return the original text
  return encodedText;
}

async function encodeSensitiveTextAsync({
  text,
  key,
  useRnJsCrypto,
}: {
  text: string;
  key?: string;
  useRnJsCrypto?: boolean;
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
      await decodeSensitiveTextAsync({ encodedText: text, useRnJsCrypto });
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
        useRnJsCrypto,
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

  throw new OneKeyPlainTextError('Unknown SENSITIVE_ENCODE_TYPE type');
}

function getBgSensitiveTextEncodeKey() {
  if (platformEnv.isExtensionUi) {
    throw new OneKeyPlainTextError(
      'Not allow to call ()getBgSensitiveTextEncodeKey from extension ui',
    );
  }
  return encodeKey;
}

function setBgSensitiveTextEncodeKey(key: string) {
  if (platformEnv.isExtensionUi) {
    throw new OneKeyPlainTextError(
      'Not allow to call setBgSensitiveTextEncodeKey() from extension ui',
    );
  }
  if (!platformEnv.isWebEmbed) {
    throw new OneKeyPlainTextError(
      'Only allow to call setBgSensitiveTextEncodeKey() from webembed',
    );
  }
  encodeKey = key;
}

export {
  decodePasswordAsync,
  decodeSensitiveTextAsync,
  decryptAsync,
  decryptStringAsync,
  encodePasswordAsync,
  encodeSensitiveTextAsync,
  encryptAsync,
  encryptStringAsync,
  ensureSensitiveTextEncoded,
  getBgSensitiveTextEncodeKey,
  isEncodedSensitiveText,
  setBgSensitiveTextEncodeKey,
};
