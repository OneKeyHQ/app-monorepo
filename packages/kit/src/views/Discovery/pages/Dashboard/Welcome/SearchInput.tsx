import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

import { KeyboardShortcutKey } from './KeyboardShortcutKey';

export function SearchInput() {
  const intl = useIntl();

  const navigation = useAppNavigation();
  const handleSearchBarPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.SearchModal,
    });
  }, [navigation]);

  return (
    <XStack
      testID="search-input"
      gap="$2"
      position="relative"
      width="100%"
      backgroundColor="$bgStrong"
      borderRadius="$full"
      alignItems="center"
      hoverStyle={{
        cursor: 'pointer',
        opacity: 0.8,
      }}
      pressStyle={{
        opacity: 1,
      }}
      onPress={handleSearchBarPress}
      p="$3"
      $gtSm={{
        w: 384,
      }}
    >
      <Icon name="SearchOutline" size="$5" color="$textSubdued" />

      <Stack flex={1}>
        <SizableText size="$bodyLg" color="$textPlaceholder">
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
