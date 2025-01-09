import { encodeSensitiveText } from '@onekeyhq/core/src/secret';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';

import { biologyAuthUtils } from '../../services/ServicePassword/biologyAuthUtils';

import { V4MigrationManagerBase } from './V4MigrationManagerBase';

export class V4MigrationForSecurePassword extends V4MigrationManagerBase {
  private async getV4SecurePassword(): Promise<string> {
    const v4SecurePassword = await secureStorageInstance.getSecureItem(
      'password',
    );
    if (v4SecurePassword) {
      return encodeSensitiveText({ text: v4SecurePassword });
    }
    return '';
  }

  async convertV4SecurePasswordToV5() {
    const v4SecurePassword = await this.getV4SecurePassword();
    if (v4SecurePassword) {
      await biologyAuthUtils.savePassword(v4SecurePassword);
      return true;
    }
    return false;
  }

  async writeSecurePasswordToV5() {
    const isBiologyAuthSwitchOn =
      await this.backgroundApi.serviceSetting.getBiologyAuthSwitchOn();
    if (isBiologyAuthSwitchOn) {
      const password =
        await this.backgroundApi.servicePassword.getCachedPassword();
      if (password) {
        await biologyAuthUtils.savePassword(password);
      }
    }
  }
}
