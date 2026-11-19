import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  IconButton,
  Popover,
  SizableText,
  XStack,
  getFontSize,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getNumberColor } from '../../utils/getNumberColor';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import { ASTERISK_DROP } from './EarnTickingTotal';

// A small tertiary icon button sits 5 px out of its place (its negative
// margin), so its hover circle met the words before it. This much after the
// words gives the circle the row's gap
export const TEXT_BEFORE_ICON_SPACE = 5;

/**
 * Under a net worth: what a day is estimated to earn, signed and in its
 * color, and the note that says how it is estimated. The DeFi home's hero
 * and My portfolio's top state it the same way
 */
export function EarnEarnings24hLine({
  earnings24h,
  currency,
  isHidden,
}: {
  earnings24h: string;
  currency: string;
  isHidden: boolean;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  return (
    <XStack ai="center" gap="$1.5">
      <NumberSizeableTextWrapper
        hideValue
        size="$bodyMdMedium"
        formatter="value"
        formatterOptions={{
          currency,
          showPlusMinusSigns: Number(earnings24h) !== 0,
        }}
        color={isHidden ? '$textSubdued' : getNumberColor(earnings24h)}
        y={
          isHidden
            ? Math.round(getFontSize('$bodyMdMedium') * ASTERISK_DROP)
            : undefined
        }
      >
        {earnings24h}
      </NumberSizeableTextWrapper>
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        mr={TEXT_BEFORE_ICON_SPACE}
      >
        {intl.formatMessage({ id: ETranslations.earn_24h_earnings })}
      </SizableText>
      <Popover
        placement="bottom-start"
        renderTrigger={
          <IconButton
            testID="earn-desktop-24h-earnings-info"
            hotKey
            aria-label={intl.formatMessage({ id: ETranslations.global_info })}
            variant="tertiary"
            size="small"
            icon="InfoCircleOutline"
            transition={reduceMotion ? undefined : 'quick'}
            animateOnly={ANIMATE_ONLY_BG_COLOR}
          />
        }
        title={intl.formatMessage({ id: ETranslations.earn_24h_earnings })}
        renderContent={
          <SizableText px="$pagePadding" py="$4">
            {intl.formatMessage({
              id: ETranslations.earn_24h_earnings_tooltip,
            })}
          </SizableText>
        }
      />
    </XStack>
  );
}
