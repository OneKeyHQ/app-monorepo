import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// react-native-web does not fire `onTextLayout` reliably, so the toggle is
// gated on a character count that approximates two lines at the detail page's
// section width instead of measuring the rendered text. Wider glyphs (CJK) can
// exceed the approximation, so the clamp is only applied when the toggle is
// offered: short-but-wide text renders unclamped rather than being cut with no
// way to expand it.
const MARKET_ABOUT_DESCRIPTION_COLLAPSED_LENGTH = 200;
const MARKET_ABOUT_DESCRIPTION_COLLAPSED_LINES = 2;

export function MarketAboutDescription({
  description,
  testID,
  toggleTestID,
}: {
  description: string;
  testID?: string;
  toggleTestID?: string;
}) {
  const intl = useIntl();
  const [isExpanded, setIsExpanded] = useState(false);
  const canExpand =
    description.length > MARKET_ABOUT_DESCRIPTION_COLLAPSED_LENGTH;

  return (
    <YStack gap="$2" alignItems="flex-start">
      <SizableText
        testID={testID}
        size="$bodyMd"
        color="$textSubdued"
        numberOfLines={
          canExpand && !isExpanded
            ? MARKET_ABOUT_DESCRIPTION_COLLAPSED_LINES
            : undefined
        }
      >
        {description}
      </SizableText>
      {canExpand ? (
        <Button
          testID={toggleTestID}
          size="small"
          variant="tertiary"
          alignSelf="flex-start"
          onPress={() => setIsExpanded((value) => !value)}
        >
          {intl.formatMessage({
            id: isExpanded
              ? ETranslations.global_show_less
              : ETranslations.global_show_more,
          })}
        </Button>
      ) : null}
    </YStack>
  );
}
