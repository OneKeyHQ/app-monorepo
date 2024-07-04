import { LOCALES_OPTION } from '@onekeyhq/shared/src/locale';

import { biologyAuthUtils } from '../../services/ServicePassword/biologyAuthUtils';
import {
  cloudBackupPersistAtom,
  settingsPersistAtom,
} from '../../states/jotai/atoms';

import { V4MigrationManagerBase } from './V4MigrationManagerBase';

import type { IV4ReduxSettingsState } from './v4types/v4typesRedux';
import type { ICloudBackupPersistAtom } from '../../states/jotai/atoms';

const validThemeValue = ['light', 'dark', 'system'];

export class V4MigrationForSettings extends V4MigrationManagerBase {
  private async getV4Settings(): Promise<IV4ReduxSettingsState | undefined> {
    const reduxData = await this?.v4dbHubs?.v4reduxDb?.reduxData;
    if (!reduxData) {
      return undefined;
    }
    return reduxData?.settings;
  }

  async migrateBaseSettings() {
    const v4Settings = await this.getV4Settings();
    if (!v4Settings) {
      return;
    }

    // instanceId
    await this.v4dbHubs.logger.runAsyncWithCatch(
      async () => {
        if (v4Settings.instanceId) {
          const v5settings = await settingsPersistAtom.get();
          if (!v5settings.instanceIdBackup) {
            v5settings.instanceIdBackup = {
              v4MigratedInstanceId: v4Settings.instanceId,
              v5InitializedInstanceId: v5settings.instanceId,
            };
            v5settings.instanceId = v4Settings.instanceId;
            await settingsPersistAtom.set((v) => ({
              ...v,
              ...v5settings,
              instanceId: v4Settings.instanceId,
            }));
          }
        }
      },
      {
        name: 'migrationInstanceId',
        errorResultFn: () => undefined,
      },
    );

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
            existingLocale.value,
          );
        }
      },
      {
        name: 'migrationLocaleSettings',
        errorResultFn: () => undefined,
      },
    );

    // Currency
    if (v4Settings?.selectedFiatMoneySymbol) {
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

    // cloud backup
    await this.v4dbHubs.logger.runAsyncWithCatch(
      async () => {
        const reduxData = await this?.v4dbHubs?.v4reduxDb?.reduxData;
        if (reduxData?.cloudBackup) {
          await cloudBackupPersistAtom.set((v) => {
            const isEnabled = Boolean(reduxData?.cloudBackup?.enabled);
            const newValue: ICloudBackupPersistAtom = {
              ...v,
              isEnabled,
            };
            return newValue;
          });
        }
      },
      {
        name: 'migrationCloudBackupSettings',
        errorResultFn: () => undefined,
      },
    );
  }

  async migrateSettings() {
    const v4Settings = await this.getV4Settings();
    if (!v4Settings) {
      return;
    }

    await this.migrateBaseSettings();
    // Auto Lock
    if (v4Settings.enableAppLock && !Number.isNaN(v4Settings.appLockDuration)) {
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

    // Protection
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
    }

    // bio auth enable
    await this.v4dbHubs.logger.runAsyncWithCatch(
      async () => {
        let currentV5BioAuthEnable =
          await this.backgroundApi.serviceSetting.getBiologyAuthSwitchOn();
        if (currentV5BioAuthEnable) {
          try {
            const securePassword = await biologyAuthUtils.getPassword();
            currentV5BioAuthEnable = !!securePassword;
          } catch (e) {
            currentV5BioAuthEnable = false;
          }
        }
        if (!currentV5BioAuthEnable)
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
