import {
  decrypt,
  encrypt,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

class WebEmbedApiSecret {
  testShow({ name, random }: { name: string; random: number }) {
    if (random > 0.5) {
      // throw error test
      throw new Error('WebEmbedApiSecret show error!');
    }
    return Promise.resolve(`${111}---${name}`);
  }

  async encrypt({
    password, // password should be decoded first by decodePassword
    data,
  }: {
    password: string;
    data: string;
  }): Promise<string> {
    const bufferToEncrypt = bufferUtils.toBuffer(data, 'hex');

    // setTimeout(() => {
    //   document.body.innerHTML = `
    //   <div style="word-break: break-all;padding: 16px;">
    //     ${JSON.stringify({
    //       password,
    //       data,
    //       bufferToEncrypt0: bufferToEncrypt,
    //       bufferToEncrypt: bufferToEncrypt.toString(),
    //     })}
    //   </div>
    //   `;
    // }, 2000);

    const buffer = encrypt(password, bufferToEncrypt, {
      // can not use safe check in webview, as key is different,
      // you should safe check before call this method
      skipSafeCheck: true,
    });
    return Promise.resolve(bufferUtils.bytesToHex(buffer));
  }

  async decrypt({
    password, // password should be decoded first by decodePassword
    data,
  }: {
    password: string;
    data: string;
  }): Promise<string> {
    const buffer = decrypt(password, bufferUtils.toBuffer(data, 'hex'), {
      // can not use safe check in webview, as key is different,
      // you should safe check before call this method
      skipSafeCheck: true,
    });
    return Promise.resolve(bufferUtils.bytesToHex(buffer));
  }
}

export default WebEmbedApiSecret;
