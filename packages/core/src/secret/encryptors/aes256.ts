import * as crypto from 'crypto';

import { AES_CBC, Pbkdf2HmacSha256 } from 'asmcrypto.js';

import { IncorrectPassword } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { sha256 } from '../hash';

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
const encodeKey = `${encodeKeyPrefix}${generateUUID()}`;
const ENCODE_TEXT_PREFIX =
  'SENSITIVE_ENCODE::AE7EADC1-CDA0-45FA-A340-E93BEDDEA21E::';

function decodePassword({
  password,
  key,
}: {
  password: string;
  key?: string;
}): string {
  // do nothing if password is encodeKey, but not a real password
  if (password.startsWith(encodeKeyPrefix)) {
    return password;
  }
  // decode password if it is encoded
  if (password.startsWith(ENCODE_TEXT_PREFIX)) {
    if (platformEnv.isExtensionUi) {
      throw new Error('decodePassword can NOT be called from UI');
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return decodeSensitiveText({ encodedText: password, key });
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    password &&
    !platformEnv.isJest
  ) {
    console.error(
      'Passing raw password is not allowed and not safe, please encode it at the beginning of debugger breakpoint call stack.',
    );
    throw new Error('Passing raw password is not allowed and not safe.');
  }
  return password;
}

function encodePassword({
  password,
  key,
}: {
  password: string;
  key?: string;
}): string {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return encodeSensitiveText({
    text: password,
    key,
  });
}

function encrypt(password: string, data: Buffer | string): Buffer {
  const dataBuffer = bufferUtils.toBuffer(data);
  // eslint-disable-next-line no-param-reassign
  const passwordDecoded = decodePassword({ password });
  const salt: Buffer = crypto.randomBytes(PBKDF2_SALT_LENGTH);
  const key: Buffer = keyFromPasswordAndSalt(passwordDecoded, salt);
  const iv: Buffer = crypto.randomBytes(AES256_IV_LENGTH);
  return Buffer.concat([
    salt,
    iv,
    Buffer.from(AES_CBC.encrypt(dataBuffer, key, true, iv)),
  ]);
}

// TODO merge with encrypt
function encryptString({
  password,
  data,
  dataEncoding = 'hex',
}: {
  password: string;
  data: string;
  dataEncoding?: BufferEncoding;
}): string {
  const bytes = encrypt(password, bufferUtils.toBuffer(data, dataEncoding));
  return bufferUtils.bytesToHex(bytes);
}

async function encryptAsync({
  password,
  data,
}: {
  password: string;
  data: Buffer | string;
}): Promise<Buffer> {
  // eslint-disable-next-line no-param-reassign
  const passwordDecoded = decodePassword({ password });

  if (platformEnv.isNative && !platformEnv.isJest) {
    throw new Error('webembedApiProxy not ready yet');
    // const webembedApiProxy = (
    //   await import('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy')
    // ).default;
    // const str = await webembedApiProxy.secret.encrypt({
    //   password,
    //   data: bufferUtils.bytesToHex(data),
    // });
    // return bufferUtils.toBuffer(str, 'hex');
  }

  return Promise.resolve(encrypt(passwordDecoded, data));
}

function decrypt(password: string, data: Buffer | string): Buffer {
  const dataBuffer = bufferUtils.toBuffer(data);
  // eslint-disable-next-line no-param-reassign
  const passwordDecoded = decodePassword({ password });

  const salt: Buffer = dataBuffer.slice(0, PBKDF2_SALT_LENGTH);
  const key: Buffer = keyFromPasswordAndSalt(passwordDecoded, salt);
  const iv: Buffer = dataBuffer.slice(
    PBKDF2_SALT_LENGTH,
    ENCRYPTED_DATA_OFFSET,
  );

  try {
    return Buffer.from(
      AES_CBC.decrypt(dataBuffer.slice(ENCRYPTED_DATA_OFFSET), key, true, iv),
    );
  } catch (e) {
    if (!platformEnv.isJest) {
      console.error(e);
    }
    throw new IncorrectPassword();
  }
}

async function decryptAsync({
  password,
  data,
}: {
  password: string;
  data: Buffer | string;
}): Promise<Buffer> {
  // eslint-disable-next-line no-param-reassign
  const passwordDecoded = decodePassword({ password });

  if (platformEnv.isNative && !platformEnv.isJest) {
    throw new Error('webembedApiProxy not ready yet');
    // const webembedApiProxy = (
    //   await import('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy')
    // ).default;
    // const str = await webembedApiProxy.secret.decrypt({
    //   password,
    //   data: bufferUtils.bytesToHex(data),
    // });
    // return bufferUtils.toBuffer(str, 'hex');
  }

  return Promise.resolve(decrypt(passwordDecoded, data));
}

function decryptString({
  password,
  data,
  resultEncoding = 'hex',
  dataEncoding = 'hex',
}: {
  password: string;
  data: string;
  resultEncoding?: BufferEncoding;
  dataEncoding?: BufferEncoding;
}): string {
  const bytes = decrypt(password, bufferUtils.toBuffer(data, dataEncoding));
  if (resultEncoding === 'hex') {
    return bufferUtils.bytesToHex(bytes);
  }
  return bufferUtils.bytesToText(bytes, resultEncoding);
}

function checkKeyPassedOnExtUi(key?: string) {
  if (platformEnv.isExtensionUi && !key) {
    throw new Error(
      'Please get and pass key by:  await backgroundApiProxy.servicePassword.getBgSensitiveTextEncodeKey()',
    );
  }
}

function isEncodedSensitiveText(text: string) {
  return text.startsWith(ENCODE_TEXT_PREFIX);
}

function ensureSensitiveTextEncoded(text: string) {
  if (!isEncodedSensitiveText(text)) {
    throw new Error('Not encoded sensitive text');
  }
}

function decodeSensitiveText({
  encodedText,
  key,
}: {
  encodedText: string;
  key?: string;
}) {
  checkKeyPassedOnExtUi(key);
  const theKey = key || encodeKey;
  if (isEncodedSensitiveText(encodedText)) {
    const text = decrypt(
      theKey,
      Buffer.from(encodedText.slice(ENCODE_TEXT_PREFIX.length), 'hex'),
    ).toString('utf-8');
    return text;
  }
  throw new Error('Not correct encoded text');
}

function encodeSensitiveText({ text, key }: { text: string; key?: string }) {
  checkKeyPassedOnExtUi(key);
  const theKey = key || encodeKey;
  // text is already encoded
  if (isEncodedSensitiveText(text)) {
    if (!platformEnv.isExtensionUi) {
      // try to decode it to verify if encode by same key
      decodeSensitiveText({ encodedText: text });
    }
    return text;
  }
  const encoded = encrypt(theKey, Buffer.from(text, 'utf-8')).toString('hex');
  return `${ENCODE_TEXT_PREFIX}${encoded}`;
}

function getBgSensitiveTextEncodeKey() {
  if (platformEnv.isExtensionUi) {
    throw new Error(
      'Please use: await backgroundApiProxy.servicePassword.getBgSensitiveTextEncodeKey()',
    );
  }
  return encodeKey;
}

export {
  decodePassword,
  decodeSensitiveText,
  decrypt,
  decryptAsync,
  decryptString,
  encodePassword,
  encodeSensitiveText,
  encrypt,
  encryptAsync,
  encryptString,
  ensureSensitiveTextEncoded,
  getBgSensitiveTextEncodeKey,
  isEncodedSensitiveText,
};
