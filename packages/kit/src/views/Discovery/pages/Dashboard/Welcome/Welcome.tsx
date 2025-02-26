import { useIntl } from 'react-intl';

import { Icon, Input, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { browserWelcomeLogos } from '@onekeyhq/shared/src/utils/browserUtils';

import { DefaultTitle } from './DefaultTitle';
import { WelcomeItem } from './WelcomeItem';

export function Welcome({ banner }: { banner: React.ReactNode }) {
  const intl = useIntl();
  // Convert browserWelcomeLogos to array for easier distribution
  const logos = Object.values(browserWelcomeLogos);
  const showIcons = false;

  return (
    <Stack position="relative" py="$6">
      {banner || <DefaultTitle />}

      {/* Main search input */}
      <Stack position="relative" zIndex={1}>
        <Stack position="relative" maxWidth={384}>
          <Input
            InputComponentStyle={{
              background: 'transparent',
            }}
            containerProps={{
              borderWidth: 0,
              borderRadius: '$full',
              background: '$bgStrong',
            }}
            addOns={[
              {
                renderContent: (
                  <Stack>
                    <Icon name="ArrowRightOutline" size="$5" />
                  </Stack>
                ),
                onPress: () => {},
              },
            ]}
            size="large"
            placeholder={intl.formatMessage({
              id: ETranslations.browser_search_dapp_or_enter_url,
            })}
            leftIconName="SearchOutline"
            borderRadius="$full"
            py="$3"
            bg="$backgroundStrong"
          />
        </Stack>

        {/* Scattered app icons */}
        <Stack
          display={showIcons ? 'flex' : 'none'}
          top="$8"
          position="absolute"
          width="100%"
          height="100%"
          pointerEvents="none"
        >
          {/* Top left */}
          <Stack position="absolute" top="$2" left="$2">
            <WelcomeItem
              key={logos[0].name}
              logo={logos[0].icon}
              url={logos[0].url}
              size="$14"
            />
          </Stack>

          {/* Top right */}
          <Stack position="absolute" top="$4" right="$2">
            <WelcomeItem
              key={logos[1].name}
              logo={logos[1].icon}
              url={logos[1].url}
              size="$13"
            />
          </Stack>

          {/* Bottom left */}
          <Stack position="absolute" bottom="$8" left="$8">
            <WelcomeItem
              key={logos[2].name}
              logo={logos[2].icon}
              url={logos[2].url}
              size="$16"
            />
          </Stack>

          {/* Middle left */}
          <Stack
            position="absolute"
            top="50%"
            left="$4"
            // transform="translateY(-50%)"
          >
            <WelcomeItem
              key={logos[3].name}
              logo={logos[3].icon}
              url={logos[3].url}
              size="$14"
            />
          </Stack>

          {/* Middle right */}
          <Stack position="absolute" top="40%" right="$4">
            <WelcomeItem
              key={logos[4].name}
              logo={logos[4].icon}
              url={logos[4].url}
              size="$15"
            />
          </Stack>

          {/* Bottom right */}
          <Stack position="absolute" bottom="$6" right="$6">
            <WelcomeItem
              key={logos[5].name}
              logo={logos[5].icon}
              url={logos[5].url}
              size="$15"
            />
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  );
}
