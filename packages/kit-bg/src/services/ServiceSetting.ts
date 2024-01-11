import { isFunction, merge } from 'lodash';

import type { ILocaleSymbol } from '@onekeyhq/components';
import { LOCALES } from '@onekeyhq/components';
import { type ICurrencyItem } from '@onekeyhq/kit/src/views/Setting/pages/Currency';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import type { EOnekeyDomain } from '@onekeyhq/shared/types';

import {
  settingsLastActivityAtom,
  settingsPersistAtom,
} from '../states/jotai/atoms/settings';

import ServiceBase from './ServiceBase';

import type { ISettingsPersistAtom } from '../states/jotai/atoms/settings';

@backgroundClass()
class ServiceSetting extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  async refreshLocaleMessages() {
    const { locale: rawLocale } = await settingsPersistAtom.get();
    const locale = rawLocale === 'system' ? getDefaultLocale() : rawLocale;

    const messagesBuilder = await (LOCALES[locale] as unknown as Promise<
      (() => Promise<Record<string, string>>) | Promise<Record<string, string>>
    >);
    let messages: Record<string, string> = {};
    if (isFunction(messagesBuilder)) {
      messages = await messagesBuilder();
    } else {
      messages = messagesBuilder;
    }
    appLocale.setLocale(locale, messages);
  }

  @backgroundMethod()
  public async setTheme(theme: 'light' | 'dark' | 'system') {
    await settingsPersistAtom.set((prev) => ({ ...prev, theme }));
  }

  @backgroundMethod()
  public async setLocale(locale: ILocaleSymbol) {
    await settingsPersistAtom.set((prev) => ({ ...prev, locale }));
    await this.refreshLocaleMessages();
  }

  @backgroundMethod()
  public async setProtectCreateTransaction(value: boolean) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      protectCreateTransaction: value,
    }));
  }

  @backgroundMethod()
  public async setProtectCreateOrRemoveWallet(value: boolean) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      protectCreateOrRemoveWallet: value,
    }));
  }

  @backgroundMethod()
  public async setSpendDustUTXO(value: boolean) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      spendDustUTXO: value,
    }));
  }

  @backgroundMethod()
  public async setHardwareConnectSrc(value: EOnekeyDomain) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      hardwareConnectSrc: value,
    }));
  }

  @backgroundMethod()
  public async refreshLastActivity() {
    await settingsLastActivityAtom.set((prev) => ({
      ...prev,
      time: Date.now(),
    }));
  }

  @backgroundMethod()
  public async getCurrencyList(): Promise<ICurrencyItem[]> {
    const client = await this.getClient();
    const res = await client.get<{ data: ICurrencyItem[] }>(
      '/gateway/v1/currency/list',
    );
    return res.data.data;
  }

  @backgroundMethod()
  public async setCurrency(currencyInfo: { id: string; symbol: string }) {
    await settingsPersistAtom.set((prev) => ({ ...prev, currencyInfo }));
  }

  @backgroundMethod()
  public async setDevMode(devMode: Partial<ISettingsPersistAtom['devMode']>) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      devMode: merge({}, prev.devMode, devMode),
    }));
  }
}

export default ServiceSetting;
