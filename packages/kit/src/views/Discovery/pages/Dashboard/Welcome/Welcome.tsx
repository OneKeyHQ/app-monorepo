import { Stack, XStack } from '@onekeyhq/components';
import { browserWelcomeLogos } from '@onekeyhq/shared/src/utils/browserUtils';

import { DefaultTitle } from './DefaultTitle';
import { SearchInput } from './SearchInput';
import { WelcomeItem } from './WelcomeItem';

export function Welcome({ banner }: { banner: React.ReactNode }) {
  const logos = Object.values(browserWelcomeLogos);

  return (
    <XStack width="100%" $gtSm={{ justifyContent: 'center' }}>
      <Stack $sm={{ display: 'none' }} flex={1} width="$50" height="100%">
        <WelcomeItem
          position="absolute"
          top="25%"
          right="$28"
          key={logos[0].name}
          logo={logos[0].icon}
          url={logos[0].url}
          size="$14"
        />

        <WelcomeItem
          position="absolute"
          bottom="25%"
          right="$12"
          key={logos[1].name}
          logo={logos[1].icon}
          url={logos[1].url}
          size="$12"
        />

        <WelcomeItem
          position="absolute"
          top="30%"
          right="$0"
          key={logos[2].name}
          logo={logos[2].icon}
          url={logos[2].url}
          size="$9"
        />
      </Stack>

      <Stack
        alignItems="center"
        justifyContent="center"
        width="auto"
        position="relative"
        gap="$5"
        px="$5"
        py="$6"
        minHeight="$48"
        $sm={{
          width: '100%',
        }}
      >
        {banner || <DefaultTitle />}

        <SearchInput />
      </Stack>

      <Stack $sm={{ display: 'none' }} flex={1} width="$50" height="100%">
        <WelcomeItem
          position="absolute"
          top="22%"
          left="$28"
          key={logos[3].name}
          logo={logos[3].icon}
          url={logos[3].url}
          size="$12"
        />

        <WelcomeItem
          position="absolute"
          bottom="22%"
          left="$11"
          key={logos[4].name}
          logo={logos[4].icon}
          url={logos[4].url}
          size="$10"
        />

        <WelcomeItem
          position="absolute"
          top="40%"
          left="$2"
          key={logos[5].name}
          logo={logos[5].icon}
          url={logos[5].url}
          size="$8"
        />
      </Stack>
    </XStack>
  );
}
