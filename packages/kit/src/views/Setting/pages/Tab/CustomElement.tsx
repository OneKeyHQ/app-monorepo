import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Select, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleOptions } from '../../hooks';

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
          py="$3"
          px="$5"
          mx={0}
          borderRadius={0}
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
