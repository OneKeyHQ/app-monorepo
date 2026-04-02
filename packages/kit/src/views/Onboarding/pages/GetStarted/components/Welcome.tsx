import { useIntl } from 'react-intl';

import {
  Heading,
  Image,
  LinearGradient,
  SizableText,
  Stack,
  ThemeableStack,
  useTheme,
} from '@onekeyhq/components';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function Welcome({
  setShowTransfer,
}: {
  setShowTransfer: (show: boolean) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const theme = useTheme();
  const bgAppColor = theme.bgApp.val;
  const transparentColor = theme.transparent.val;
  return (
    <Stack flex={1}>
      <ThemeableStack fullscreen alignItems="center" justifyContent="center">
        <MultipleClickStack
          onPress={() => {
            void navigation.popStack();
          }}
        >
          <Image
            w={360}
            h={360}
            source={require('@onekeyhq/kit/assets/logo-press.png')}
          />
        </MultipleClickStack>
      </ThemeableStack>

      <Stack px="$5" pt="$10" mt="auto">
        <LinearGradient
          position="absolute"
          top="$0"
          left="$0"
          right="$0"
          bottom="$0"
          colors={[transparentColor, bgAppColor]}
          $platform-native={{
            display: 'none',
          }}
        />
        <Stack zIndex={1}>
          <MultipleClickStack
            onPress={() => {
              setShowTransfer(true);
            }}
          >
            <Heading size="$heading4xl" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.onboarding_welcome_message,
              })}
            </Heading>

            <SizableText size="$bodyLg" textAlign="center" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.onboarding_welcome_description,
              })}
            </SizableText>
          </MultipleClickStack>
        </Stack>
      </Stack>
    </Stack>
  );
}
