import {
  decrypt,
  encrypt,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

class WebEmbedApiSecret {
  show({ name }: { name: string }) {
    // throw new Error('WebEmbedApiSecret show error!');
    return Promise.resolve(`${111}---${name}`);
  }

  hi() {
    return Promise.resolve(2);
  }

  async encrypt({
    password,
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
      skipSafeCheck: true,
    });
    return Promise.resolve(bufferUtils.bytesToHex(buffer));
  }

  async decrypt({
    password,
    data,
  }: {
    password: string;
    data: string;
  }): Promise<string> {
    const buffer = decrypt(password, bufferUtils.toBuffer(data, 'hex'), {
      skipSafeCheck: true,
    });
    return Promise.resolve(bufferUtils.bytesToHex(buffer));
  }
}

export default WebEmbedApiSecret;
