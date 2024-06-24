import { encodeSensitiveText } from '@onekeyhq/core/src/secret';
import secureStorage from '@onekeyhq/shared/src/storage/secureStorage';

import { biologyAuthUtils } from '../../services/ServicePassword/biologyAuthUtils';

import { V4MigrationManagerBase } from './V4MigrationManagerBase';

export class V4MigrationForSecurePassword extends V4MigrationManagerBase {
  private async getV4SecurePassword(): Promise<string> {
    const v4SecurePassword = await secureStorage.getSecureItem('password');
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
}
