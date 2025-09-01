/* eslint-disable @typescript-eslint/no-unused-vars */
import crypto from 'crypto';

import appCrypto from '@onekeyhq/shared/src/appCrypto';
import {
  IncorrectPassword,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { xorDecrypt, xorEncrypt } from './xor';

const {
  AES256_IV_LENGTH,
  PBKDF2_KEY_LENGTH,
  PBKDF2_SALT_LENGTH,
  ENCRYPTED_DATA_OFFSET,
} = appCrypto.consts;

const { aesCbcDecryptSync, aesCbcDecrypt, aesCbcEncrypt, aesCbcEncryptSync } =
  appCrypto.aesCbc;

const { keyFromPasswordAndSalt } = appCrypto.keyGen;

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
    throw new OneKeyLocalError(
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
      throw new OneKeyLocalError('decodePassword can NOT be called from UI');
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
    throw new OneKeyLocalError(
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
  iterations?: number;
};

// ------------------------------------------------------------
export type IEncryptAsyncParams = {
  password: string;
  data: Buffer | string;
  allowRawPassword?: boolean;
  useWebembedApi?: boolean;
  customSalt?: Buffer | string;
  customIv?: Buffer | string;
  customDecodePasswordKey?: string;
  iterations?: number;
};
async function encryptAsync({
  password,
  data,
  allowRawPassword,
  useWebembedApi,
  customSalt,
  customIv,
  customDecodePasswordKey,
  iterations,
}: IEncryptAsyncParams): Promise<Buffer> {
  if (!password) {
    throw new IncorrectPassword();
  }

  if (
    useWebembedApi &&
    platformEnv.isNative &&
    !platformEnv.isJest &&
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
      customIv: customIv ? bufferUtils.bytesToHex(customIv) : undefined,
      customSalt: customSalt ? bufferUtils.bytesToHex(customSalt) : undefined,
      iterations,
    });
    return bufferUtils.toBuffer(str, 'hex');
  }

  const passwordDecoded = await decodePasswordAsync({
    password,
    allowRawPassword,
    key: customDecodePasswordKey,
  });

  if (!passwordDecoded) {
    throw new IncorrectPassword();
  }

  const dataBuffer = bufferUtils.toBuffer(data);

  const salt: Buffer = bufferUtils.toBuffer(
    customSalt || crypto.randomBytes(PBKDF2_SALT_LENGTH),
  );
  const iv: Buffer = bufferUtils.toBuffer(
    customIv || crypto.randomBytes(AES256_IV_LENGTH),
  );

  // in web environment, if async function is executed in indexedDB.transaction, it will cause the transaction to be committed prematurely, so here use synchronous function
  // ------------------------------------------------------------

  // const key: Buffer = platformEnv.isNative
  //   ? await keyFromPasswordAndSalt(passwordDecoded, salt)
  //   : keyFromPasswordAndSaltSync(passwordDecoded, salt);
  // const key: Buffer = await keyFromPasswordAndSalt(passwordDecoded, salt);
  const key: Buffer = await keyFromPasswordAndSalt({
    password: passwordDecoded,
    salt,
    iterations,
  });

  // const dataEncrypted = platformEnv.isNative
  //   ? await aesCbcEncrypt({
  //       data: dataBuffer,
  //       key,
  //       iv,
  //       //
  //     })
  //   : aesCbcEncryptSync({
  //       data: dataBuffer,
  //       key,
  //       iv,
  //     });
  // const dataEncrypted = await aesCbcEncrypt({
  //   data: dataBuffer,
  //   key,
  //   iv,
  //   //
  // });

  const dataEncrypted = await aesCbcEncrypt({
    data: dataBuffer,
    key,
    iv,
    //
  });

  return Buffer.concat([salt, iv, dataEncrypted]);
}

export type IDecryptAsyncParams = {
  password: string;
  data: Buffer | string;
  allowRawPassword?: boolean;
  ignoreLogger?: boolean;
  useWebembedApi?: boolean;
  iterations?: number;
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
  useWebembedApi,
  iterations,
}: IDecryptAsyncParams): Promise<Buffer> {
  if (!password) {
    throw new IncorrectPassword();
  }

  if (
    useWebembedApi &&
    platformEnv.isNative &&
    !platformEnv.isJest &&
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
      iterations,
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

  // const key: Buffer = platformEnv.isNative
  //   ? await keyFromPasswordAndSalt(passwordDecoded, salt)
  //   : keyFromPasswordAndSaltSync(passwordDecoded, salt);
  const key: Buffer = await keyFromPasswordAndSalt({
    password: passwordDecoded,
    salt,
    iterations,
  });

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

    // const aesDecryptData = platformEnv.isNative
    //   ? await aesCbcDecrypt({
    //       data: dataBuffer.slice(ENCRYPTED_DATA_OFFSET),
    //       key,
    //       iv,
    //     })
    //   : aesCbcDecryptSync({
    //       data: dataBuffer.slice(ENCRYPTED_DATA_OFFSET),
    //       key,
    //       iv,
    //     });

    const encryptedData = dataBuffer.slice(ENCRYPTED_DATA_OFFSET);
    const aesDecryptData = await aesCbcDecrypt({
      data: encryptedData,
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
  iterations?: number;
};

async function decryptStringAsync({
  password,
  data,
  resultEncoding = 'hex',
  dataEncoding = 'hex',
  allowRawPassword,
  iterations,
}: IDecryptStringParams): Promise<string> {
  const bytes = await decryptAsync({
    password,
    data: bufferUtils.toBuffer(data, dataEncoding),
    ignoreLogger: undefined,
    allowRawPassword,
    iterations,
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
  iterations,
}: IEncryptStringParams): Promise<string> {
  const bufferData = bufferUtils.toBuffer(data, dataEncoding);
  const bytes = await encryptAsync({
    password,
    data: bufferData,
    allowRawPassword,
    iterations,
  });
  return bufferUtils.bytesToHex(bytes);
}

function checkKeyPassedOnExtUi(key?: string) {
  if (platformEnv.isExtensionUi && !key) {
    throw new OneKeyLocalError(
      'Please get and pass key by:  await backgroundApiProxy.servicePassword.getBgSensitiveTextEncodeKey()',
    );
  }
}

function ensureSensitiveTextEncoded(text: string) {
  if (!isEncodedSensitiveText(text)) {
    throw new OneKeyLocalError('Not encoded sensitive text');
  }
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
        ignoreLogger,
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
  // if not encoded, return the original text
  return encodedText;
}

async function encodeSensitiveTextAsync({
  text,
  key,
  customIv,
  customSalt,
}: {
  text: string;
  key?: string;
  customSalt?: Buffer;
  customIv?: Buffer;
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
      await decodeSensitiveTextAsync({ encodedText: text });
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
        customSalt,
        customIv,
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

  throw new OneKeyLocalError('Unknown SENSITIVE_ENCODE_TYPE type');
}

function getBgSensitiveTextEncodeKey() {
  if (platformEnv.isExtensionUi) {
    throw new OneKeyLocalError(
      'Not allow to call ()getBgSensitiveTextEncodeKey from extension ui',
    );
  }
  return encodeKey;
}

function setBgSensitiveTextEncodeKey(key: string) {
  if (platformEnv.isExtensionUi) {
    throw new OneKeyLocalError(
      'Not allow to call setBgSensitiveTextEncodeKey() from extension ui',
    );
  }
  if (!platformEnv.isWebEmbed) {
    throw new OneKeyLocalError(
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
