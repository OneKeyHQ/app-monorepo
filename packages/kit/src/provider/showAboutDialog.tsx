import { upperFirst } from 'lodash';

import { Dialog, Image, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IntlShape } from 'react-intl';

// About dialog for app menus without a system about panel (desktop on
// Windows/Linux and the iPadOS menu bar).
export function showAboutDialog({
  intl,
  platformLabel,
}: {
  intl: IntlShape;
  platformLabel: string;
}) {
  const versionString = intl.formatMessage(
    {
      id: ETranslations.settings_version_versionnum,
    },
    {
      'versionNum': ` ${process.env.VERSION || 1}(${
        platformEnv.buildNumber || 1
      })`,
    },
  );
  Dialog.show({
    showFooter: false,
    renderContent: (
      <YStack gap={4} alignItems="center" pt="$4">
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('../../assets/logo.png')}
          size={72}
          borderRadius="$full"
        />
        <YStack gap="$2" pt="$4" alignItems="center">
          <SizableText size="$heading2xl">OneKey</SizableText>
          <SizableText size="$bodySm">{platformLabel}</SizableText>
          <SizableText size="$bodySm">{upperFirst(versionString)}</SizableText>
          <SizableText size="$bodySm">Copyright © OneKey</SizableText>
        </YStack>
      </YStack>
    ),
  });
}
