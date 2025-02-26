import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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

      <XStack gap="$1">
        <Stack
          bg="$bgStrong"
          borderRadius="$1"
          w="$4"
          h="$4"
          alignItems="center"
          justifyContent="center"
        >
          <SizableText color="$textSubdued" size="$headingXs">
            ⌘
          </SizableText>
        </Stack>

        <Stack
          bg="$bgStrong"
          borderRadius="$1"
          w="$4"
          h="$4"
          alignItems="center"
          justifyContent="center"
        >
          <SizableText color="$textSubdued" size="$headingXs">
            T
          </SizableText>
        </Stack>
      </XStack>
    </XStack>
  );
}
