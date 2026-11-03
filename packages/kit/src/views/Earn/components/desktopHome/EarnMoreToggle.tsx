import { useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { buildKeyboardPressProps } from './earnDesktopPressable';
import { useEarnDesktopScrollPin } from './useEarnDesktopScrollPin';

/**
 * "Show N more" under a list's first rows, "Show less" once they are out:
 * the rest open in place over the list's fold. The holdings list and Your
 * loans share it
 */
export function EarnMoreToggle({
  count,
  isExpanded,
  onPress,
  testID,
}: {
  count: number;
  isExpanded: boolean;
  onPress: () => void;
  testID: string;
}) {
  const intl = useIntl();
  // Subdued until hovered, the way the tile titles brighten
  const [isHovered, setIsHovered] = useState(false);
  // Show less keeps the control where it was pressed: the page scrolls up
  // with the rows folding above it
  const toggleRef = useRef<IElement>(null);
  const pinScroll = useEarnDesktopScrollPin();
  const handlePress = () => {
    if (isExpanded) {
      pinScroll(toggleRef.current);
    }
    onPress();
  };
  return (
    <XStack
      ref={toggleRef}
      testID={testID}
      role="button"
      aria-expanded={isExpanded}
      alignSelf="flex-start"
      ai="center"
      gap="$0.5"
      h={44}
      cursor="pointer"
      userSelect="none"
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={handlePress}
      {...buildKeyboardPressProps(handlePress, 2)}
    >
      <SizableText
        size="$bodyMdMedium"
        color={isHovered ? '$text' : '$textSubdued'}
      >
        {isExpanded
          ? intl.formatMessage({ id: ETranslations.global_show_less })
          : EARN_DESKTOP_DEMO_COPY.showMore(count)}
      </SizableText>
      <Icon
        name={isExpanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
        size="$4"
        color={isHovered ? '$icon' : '$iconSubdued'}
      />
    </XStack>
  );
}
