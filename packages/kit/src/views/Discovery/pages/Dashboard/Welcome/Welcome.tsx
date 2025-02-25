import { Input, Stack, XStack } from '@onekeyhq/components';
import { browserWelcomeLogos } from '@onekeyhq/shared/src/utils/browserUtils';

import { DefaultTitle } from './DefaultTitle';
import { WelcomeItem } from './WelcomeItem';

export function Welcome({ banner }: { banner: React.ReactNode }) {
  return (
    <Stack>
      {banner || <DefaultTitle />}

      <Input />

      <XStack gap="$4" py="$4">
        {Object.entries(browserWelcomeLogos).map(([key, value]) => (
          <WelcomeItem key={key} logo={value.icon} url={value.url} />
        ))}
      </XStack>
    </Stack>
  );
}
