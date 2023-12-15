import { isFunction } from 'lodash';

import type { ILocaleSymbol } from '@onekeyhq/components';
import { LOCALES } from '@onekeyhq/components';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import type { EOnekeyDomain } from '@onekeyhq/shared/types';

import { settingsPersistAtom } from '../states/jotai/atoms/settings';

import ServiceBase from './ServiceBase';

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
  public async setAppLockDuration(value: number) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      appLockDuration: value,
    }));
  }

  @backgroundMethod()
  public async setHardwareConnectSrc(value: EOnekeyDomain) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      hardwareConnectSrc: value,
    }));
  }
}

export default ServiceSetting;
