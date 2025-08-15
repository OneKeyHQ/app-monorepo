import { Anchor, SizableText, Stack, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const AnchorGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Anchor"
    description="Anchor component provides a way to link to external websites. It extends SizableText, adding the href, target, and rel attributes."
    elements={[
      {
        title: 'Basic Usage',
        element: (
          <YStack gap="$4" alignItems="flex-start">
            <Anchor href="https://tamagui.dev">Tamagui Website</Anchor>
            <Anchor href="https://github.com/onekeyhq">OneKey GitHub</Anchor>
          </YStack>
        ),
      },
      {
        title: 'Different Sizes',
        element: (
          <YStack gap="$4" alignItems="flex-start">
            <Anchor href="https://tamagui.dev" size="$heading2xl">
              Extra Large Link
            </Anchor>
            <Anchor href="https://tamagui.dev" size="$headingLg">
              Large Link
            </Anchor>
            <Anchor href="https://tamagui.dev" size="$bodyMd">
              Medium Link
            </Anchor>
            <Anchor href="https://tamagui.dev" size="$bodySm">
              Small Link
            </Anchor>
          </YStack>
        ),
      },
      {
        title: 'Custom Colors',
        element: (
          <YStack gap="$4" alignItems="flex-start">
            <Anchor href="https://tamagui.dev" color="$red10">
              Red Link
            </Anchor>
            <Anchor href="https://tamagui.dev" color="$green10">
              Green Link
            </Anchor>
            <Anchor href="https://tamagui.dev" color="$blue10">
              Blue Link
            </Anchor>
            <Anchor href="https://tamagui.dev" color="$orange10">
              Orange Link
            </Anchor>
          </YStack>
        ),
      },
      {
        title: 'Target and Rel Attributes',
        element: (
          <YStack gap="$4" alignItems="flex-start">
            <Anchor href="https://tamagui.dev" target="_blank">
              Open in New Tab
            </Anchor>
            <Anchor
              href="https://tamagui.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in New Tab (Secure)
            </Anchor>
          </YStack>
        ),
      },
      {
        title: 'With Context',
        element: (
          <Stack gap="$2">
            <SizableText>
              Visit the{' '}
              <Anchor href="https://tamagui.dev">Tamagui website</Anchor> for
              more information.
            </SizableText>
            <SizableText>
              Check out our{' '}
              <Anchor href="https://github.com/onekeyhq">
                GitHub repository
              </Anchor>{' '}
              to see our code.
            </SizableText>
          </Stack>
        ),
      },
    ]}
  />
);

export default AnchorGallery;
