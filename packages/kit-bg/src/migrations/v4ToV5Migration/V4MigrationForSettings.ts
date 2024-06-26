import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { LOCALES_OPTION } from '@onekeyhq/shared/src/locale';

import { V4MigrationManagerBase } from './V4MigrationManagerBase';

import type { IV4ReduxSettingsState } from './v4types/v4typesRedux';

const validThemeValue = ['light', 'dark', 'system'];

export class V4MigrationForSettings extends V4MigrationManagerBase {
  private async getV4Settings(): Promise<IV4ReduxSettingsState | undefined> {
    const reduxData = await this?.v4dbHubs?.v4reduxDb?.reduxData;
    if (!reduxData) {
      return undefined;
    }
    return reduxData?.settings;
  }

  async convertV4SettingsToV5() {
    const v4Settings = await this.getV4Settings();
    if (!v4Settings) {
      return;
    }

    // set valid theme value
    await this.v4dbHubs.logger.runAsyncWithCatch(
      async () => {
        if (v4Settings.theme && validThemeValue.includes(v4Settings.theme)) {
          await this.backgroundApi.serviceSetting.setTheme(v4Settings.theme);
        }
      },
      {
        name: 'migrationThemeSettings',
        errorResultFn: () => undefined,
      },
    );

    // v4 language mn-MN, fil not support in v5
    await this.v4dbHubs.logger.runAsyncWithCatch(
      async () => {
        const existingLocale = LOCALES_OPTION.find(
          (item) => item.value === v4Settings.locale,
        );
        if (v4Settings.locale && existingLocale) {
          await this.backgroundApi.serviceSetting.setLocale(
            existingLocale.value as ILocaleSymbol,
          );
        }
      },
      {
        name: 'migrationLocaleSettings',
        errorResultFn: () => undefined,
      },
    );

    // Currency
    if (v4Settings.selectedFiatMoneySymbol) {
      await this.v4dbHubs.logger.runAsyncWithCatch(
        async () => {
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
        },
        {
          name: 'migrationCurrencySettings',
          errorResultFn: () => undefined,
        },
      );
    }

    // Auto Lock
    if (v4Settings.enableAppLock && v4Settings.appLockDuration) {
      await this.v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          await this.backgroundApi.servicePassword.setAppLockDuration(
            Number(v4Settings.appLockDuration),
          );
        },
        {
          name: 'migrationAutoLockSettings',
          errorResultFn: () => undefined,
        },
      );
    }

    if (v4Settings.validationSetting) {
      // Protection - Create Transaction
      await this.v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          if (
            v4Settings.validationSetting?.Payment !== undefined &&
            v4Settings.validationSetting?.Payment !== null
          ) {
            await this.backgroundApi.serviceSetting.setProtectCreateTransaction(
              v4Settings.validationSetting.Payment,
            );
          }
        },
        {
          name: 'migrationProtectCreateTransaction',
          errorResultFn: () => undefined,
        },
      );

      // Protection - Create / Remove Wallets
      await this.v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          if (
            v4Settings.validationSetting?.Wallet !== undefined &&
            v4Settings.validationSetting?.Wallet !== null
          ) {
            await this.backgroundApi.serviceSetting.setProtectCreateOrRemoveWallet(
              v4Settings.validationSetting.Wallet,
            );
          }
        },
        {
          name: 'migrationProtectCreateOrRemoveWallet',
          errorResultFn: () => undefined,
        },
      );

      // bio auth enable
      await this.v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          await this.backgroundApi.serviceSetting.setBiologyAuthSwitchOn(
            !!v4Settings.enableLocalAuthentication,
          );
        },
        {
          name: 'migrationBioAuthEnable',
          errorResultFn: () => undefined,
        },
      );
    }
  }
}
