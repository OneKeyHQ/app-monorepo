import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function BorrowMoreToggle({
  expanded,
  onPress,
  testID,
}: {
  expanded: boolean;
  onPress: () => void;
  testID: string;
}) {
  const intl = useIntl();
  return (
    <XStack
      testID={testID}
      role="button"
      alignItems="center"
      justifyContent="center"
      gap="$1"
      py="$3"
      cursor="pointer"
      userSelect="none"
      focusable
      aria-expanded={expanded}
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineWidth: 2,
        outlineOffset: 2,
      }}
      hoverStyle={{ opacity: 0.7 }}
      pressStyle={{ opacity: 0.6 }}
      onPress={onPress}
    >
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: expanded
            ? ETranslations.global_show_less
            : ETranslations.global_show_more,
        })}
      </SizableText>
      <Icon
        name={expanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
        size="$4.5"
        color="$iconSubdued"
      />
    </XStack>
  );
}
