import { Suspense, useCallback, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import { Select, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { UniversalContainerWithSuspense } from '@onekeyhq/kit/src/components/BiologyAuthComponent/container/UniversalContainer';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useBiometricAuthInfo } from '@onekeyhq/kit/src/hooks/useBiometricAuthInfo';
import { TabFreezeOnBlurContext } from '@onekeyhq/kit/src/provider/Container/TabFreezeOnBlurContainer';
import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleOptions } from '../../hooks';

import { TabSettingsListItem } from './ListItem';

export function LanguageListItem() {
  const locales = useLocaleOptions();
  const intl = useIntl();
  const [{ locale }] = useSettingsPersistAtom();
  const onChange = useCallback(async (text: string) => {
    await backgroundApiProxy.serviceSetting.setLocale(text as ILocaleSymbol);
    setTimeout(() => {
      if (platformEnv.isDesktop) {
        globalThis.desktopApi.changeLanguage(text);
      }
      backgroundApiProxy.serviceApp.restartApp();
    }, 0);
  }, []);

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={intl.formatMessage({ id: ETranslations.global_language })}
      items={locales}
      value={locale}
      onChange={onChange}
      placement="bottom-end"
      floatingPanelProps={{ maxHeight: 280 }}
      sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
      renderTrigger={({ label }) => (
        <ListItem
          userSelect="none"
          icon="TranslateOutline"
          title={intl.formatMessage({ id: ETranslations.global_language })}
        >
          <XStack>
            <ListItem.Text primary={label} align="right" />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </ListItem>
      )}
    />
  );
}

export function ThemeListItem() {
  const [{ theme }] = useSettingsPersistAtom();
  const { setFreezeOnBlur } = useContext(TabFreezeOnBlurContext);
  const intl = useIntl();

  const options = useMemo<ISelectItem[]>(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.global_auto,
        }),
        description: intl.formatMessage({
          id: ETranslations.global_follow_the_system,
        }),
        value: 'system' as const,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_light }),
        value: 'light' as const,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_dark }),
        value: 'dark' as const,
      },
    ],
    [intl],
  );

  const onChange = useCallback(
    async (text: 'light' | 'dark' | 'system') => {
      setFreezeOnBlur(false);
      await backgroundApiProxy.serviceSetting.setTheme(text);
      setFreezeOnBlur(true);
    },
    [setFreezeOnBlur],
  );

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={intl.formatMessage({ id: ETranslations.settings_theme })}
      items={options}
      value={theme}
      onChange={onChange}
      placement="bottom-end"
      renderTrigger={({ label }) => (
        <TabSettingsListItem
          userSelect="none"
          icon="PaletteOutline"
          title={intl.formatMessage({ id: ETranslations.settings_theme })}
        >
          <XStack>
            <ListItem.Text primary={label} align="right" />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </TabSettingsListItem>
      )}
    />
  );
}

function SuspenseBiologyAuthListItem() {
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  const { title, icon } = useBiometricAuthInfo();

  return isPasswordSet && (biologyAuthIsSupport || webAuthIsSupport) ? (
    <TabSettingsListItem icon={icon} title={title}>
      <UniversalContainerWithSuspense />
    </TabSettingsListItem>
  ) : null;
}

export function BiologyAuthListItem() {
  return (
    <Suspense fallback={null}>
      <SuspenseBiologyAuthListItem />
    </Suspense>
  );
}
