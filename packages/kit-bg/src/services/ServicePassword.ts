import {
  decodePassword,
  decrypt,
  encodeSensitiveText,
  encrypt,
  getBgSensitiveTextEncodeKey,
} from '@onekeyhq/core/src/secret/encryptors/aes256';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import * as error from '@onekeyhq/shared/src/errors';

import localDb from '../dbs/local/localDb';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServicePassword extends ServiceBase {
  private cachedPassword?: string;

  clearCachedPassword() {
    this.cachedPassword = undefined;
  }

  async setCachedPassword(password: string): Promise<string> {
    const key = await this.getBgSensitiveTextEncodeKey();
    const enCodedPassword = encrypt(
      key,
      Buffer.from(password, 'utf8'),
    ).toString('hex');
    this.cachedPassword = enCodedPassword;
    console.log('enCodePassword', enCodedPassword);
    return enCodedPassword;
  }

  async getCachedPassword(): Promise<string | undefined> {
    if (!this.cachedPassword) {
      return undefined;
    }
    try {
      const key = await this.getBgSensitiveTextEncodeKey();
      const cachedPassword = decrypt(
        key,
        Buffer.from(this.cachedPassword, 'hex'),
      ).toString('utf8');
      return cachedPassword;
    } catch {
      return undefined;
    }
  }

  async validatePasswordStrength(password: string): Promise<string> {
    const realPassword = decodePassword({ password });
    if (realPassword.length >= 8 && realPassword.length <= 128) {
      return Promise.resolve(password);
    }
    throw new error.PasswordStrengthValidationFailed();
  }

  @backgroundMethod()
  async saveCachedPassword(password: string): Promise<void> {
    const checkResult = await this.verifyPassword(password);
    if (checkResult) {
      await this.setCachedPassword(password);
    }
  }

  @backgroundMethod()
  async verifyPassword(password: string): Promise<string> {
    const enCodePassword = encodeSensitiveText({ text: password });
    const verified = await localDb.verifyPassword(enCodePassword);
    if (verified) {
      return enCodePassword;
    }
    return '';
  }

  @backgroundMethod()
  async updatePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<string> {
    const enCodedOldPassword = encodeSensitiveText({ text: oldPassword });
    const enCodedNewPassword = encodeSensitiveText({ text: newPassword });
    await this.validatePasswordStrength(enCodedNewPassword);
    await localDb.updatePassword(enCodedOldPassword, enCodedNewPassword);
    // TODO update status passwordSet
    await this.saveCachedPassword(enCodedNewPassword);
    return enCodedNewPassword;
  }

  @backgroundMethod()
  async getBgSensitiveTextEncodeKey(): Promise<string> {
    return Promise.resolve(getBgSensitiveTextEncodeKey());
  }
}
