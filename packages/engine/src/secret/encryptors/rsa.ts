import { KEYUTIL, KJUR } from 'jsrsasign';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import type { RSAKey } from 'jsrsasign';

const KEY_LENGTH = 1024;

function generateKeypair() {
  const rsaKeypair = KEYUTIL.generateKeypair('RSA', KEY_LENGTH);
  return {
    publicKey: KEYUTIL.getPEM(rsaKeypair.pubKeyObj as RSAKey),
    privateKey: KEYUTIL.getPEM(rsaKeypair.prvKeyObj as RSAKey, 'PKCS8PRV'),
  };
}

// data.length < 100
function rsaEncrypt(publicKey: string, data: string) {
  try {
    const pubKeyObj = KEYUTIL.getKey(publicKey);
    return KJUR.crypto.Cipher.encrypt(data, pubKeyObj as RSAKey, 'RSA');
  } catch (error) {
    debugLogger.common.error('rsa encrypt fail = ', error);
    return false;
  }
}

function rsaDecrypt(privateKey: string, encryptData: string) {
  try {
    const prvKeyObj = KEYUTIL.getKey(privateKey) as RSAKey;
    return KJUR.crypto.Cipher.decrypt(encryptData, prvKeyObj, 'RSA');
  } catch (error) {
    debugLogger.common.error('rsa decrypt fail = ', error);
    return false;
  }
}

export { generateKeypair, rsaEncrypt, rsaDecrypt };
