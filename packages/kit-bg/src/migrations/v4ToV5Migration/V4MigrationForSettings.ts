import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { LOCALES_OPTION } from '@onekeyhq/shared/src/locale';

import { V4MigrationManagerBase } from './V4MigrationManagerBase';

import type { IV4ReduxSettingsState } from './v4types/v4typesRedux';

const validThemeValue = ['light', 'dark', 'system'];

export class V4MigrationForSettings extends V4MigrationManagerBase {
  private async getV4Settings(): Promise<IV4ReduxSettingsState | undefined> {
    const reduxData = await this.v4dbHubs.v4reduxDb.reduxData;
    if (!reduxData) {
      return undefined;
    }
    return reduxData.settings;
  }

  async convertV4SettingsToV5() {
    const v4Settings = await this.getV4Settings();
    if (!v4Settings) {
      return;
    }

    // set valid theme value
    if (v4Settings.theme && validThemeValue.includes(v4Settings.theme)) {
      await this.backgroundApi.serviceSetting.setTheme(v4Settings.theme);
    }

    // v4 language mn-MN, fil not support in v5
    const existingLocale = LOCALES_OPTION.find(
      (item) => item.value === v4Settings.locale,
    );
    if (v4Settings.locale && existingLocale) {
      await this.backgroundApi.serviceSetting.setLocale(
        existingLocale.value as ILocaleSymbol,
      );
    }

    // Currency
    if (v4Settings.selectedFiatMoneySymbol) {
      try {
        const currencyList =
          await this.backgroundApi.serviceSetting.getCurrencyList();
        const existingCurrencyItem = currencyList.find(
          (i) => i.id === v4Settings.selectedFiatMoneySymbol,
        );
        if (existingCurrencyItem) {
          await this.backgroundApi.serviceSetting.setCurrency({
            id: existingCurrencyItem.id,
            symbol: existingCurrencyItem.unit,
          });
        }
      } catch (e) {
        console.log('Error in setting currency: ', e);
        // continue
      }
    }

    // Auto Lock
    if (v4Settings.enableAppLock && v4Settings.appLockDuration) {
      await this.backgroundApi.servicePassword.setAppLockDuration(
        Number(v4Settings.appLockDuration),
      );
    }

    // Protection - Create Transaction
    if (v4Settings.validationSetting) {
      if (
        v4Settings.validationSetting.Payment !== undefined &&
        v4Settings.validationSetting.Payment !== null
      ) {
        await this.backgroundApi.serviceSetting.setProtectCreateTransaction(
          v4Settings.validationSetting.Payment,
        );
      }

      if (
        v4Settings.validationSetting.Wallet !== undefined &&
        v4Settings.validationSetting.Wallet !== null
      ) {
        await this.backgroundApi.serviceSetting.setProtectCreateOrRemoveWallet(
          v4Settings.validationSetting.Wallet,
        );
      }
    }
  }
}
