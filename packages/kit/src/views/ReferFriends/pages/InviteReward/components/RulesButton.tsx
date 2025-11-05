import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { REFERRAL_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function RulesButton() {
  const handlePress = () => {
    void openUrlExternal(REFERRAL_HELP_LINK);
  };

  return (
    <XStack
      ai="center"
      gap="$2"
      px="$2"
      py="$1"
      borderRadius="$2"
      cursor="pointer"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      onPress={handlePress}
    >
      <Icon name="QuestionmarkOutline" size="$4" color="$iconSubdued" />
      <SizableText size="$bodyLgMedium" color="$textSubdued">
        Rules
      </SizableText>
    </XStack>
  );
}
