import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Only authenticated ciphertext belongs here. The device key stays in Keychain.
type ICloudBackupPasswordCache = Record<string, string>;

export class SimpleDbEntityCloudBackupPasswordCache extends SimpleDbEntityBase<ICloudBackupPasswordCache> {
  entityName = 'cloudBackupPasswordCache';

  override enableCache = false;

  async getPasswordCiphertext(key: string): Promise<string | undefined> {
    const data = await this.getRawData();
    const value = data?.[key];
    return typeof value === 'string' ? value : undefined;
  }

  async setPasswordCiphertext(key: string, ciphertext: string): Promise<void> {
    await this.setRawData((data) => ({ ...data, [key]: ciphertext }));
  }

  async removePasswordCiphertext(key: string): Promise<void> {
    await this.setRawData((data) => {
      const updated = { ...data };
      delete updated[key];
      return updated;
    });
  }
}
