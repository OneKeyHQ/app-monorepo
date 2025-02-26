import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

import { KeyboardShortcutKey } from './KeyboardShortcutKey';

export function SearchInput() {
  const intl = useIntl();

  return (
    <XStack
      position="relative"
      maxWidth={384}
      background="$bgStrong"
      borderRadius="$full"
      alignItems="center"
    >
      <Stack>
        <SizableText>
          {intl.formatMessage({
            id: ETranslations.browser_search_dapp_or_enter_url,
          })}
        </SizableText>
      </Stack>

      {platformEnv.isDesktop ? (
        <XStack gap="$1">
          <KeyboardShortcutKey label={shortcutsKeys.CmdOrCtrl} />
          <KeyboardShortcutKey label="T" />
        </XStack>
      ) : null}
    </XStack>
  );
}
