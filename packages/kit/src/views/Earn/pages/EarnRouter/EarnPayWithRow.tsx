import { Icon, SizableText, Skeleton, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import type { IEarnRouterPayToken } from './earnRouter.utils';

/**
 * Pay with, under the amount box: the token the amount is in. The box shows
 * it too, as the amount's unit; this pill is where it changes. Without a
 * token yet (the wallet still loading) a placeholder holds its place
 */
export function EarnPayWithRow({
  token,
  onPress,
  disabled,
}: {
  token?: Pick<IEarnRouterPayToken['token'], 'logoURI' | 'symbol'>;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const handlePress = token && !disabled ? onPress : undefined;
  return (
    // In line with the text inside the box above
    <XStack ai="center" gap="$2" px="$3.5">
      <SizableText size="$bodyMd" color="$textSubdued">
        {EARN_DESKTOP_DEMO_COPY.payWith}
      </SizableText>
      {token ? (
        <XStack
          testID="earn-pay-with-token"
          role={handlePress ? 'button' : undefined}
          aria-label={`${EARN_DESKTOP_DEMO_COPY.payWith} ${token.symbol}`}
          ai="center"
          gap="$1.5"
          h="$8"
          pl="$1.5"
          // The chevron brings its own room on the right
          pr={handlePress ? '$2' : '$3'}
          borderRadius="$full"
          borderCurve="continuous"
          // A Secondary button's fill: this is a control, the boxes are not
          bg="$bgStrong"
          userSelect="none"
          {...(handlePress
            ? {
                cursor: 'pointer',
                hoverStyle: { bg: '$bgStrongHover' },
                pressStyle: { bg: '$bgStrongActive' },
                onPress: handlePress,
              }
            : null)}
          {...buildKeyboardPressProps(handlePress)}
        >
          <Token size="xs" tokenImageUri={token.logoURI} />
          <SizableText size="$bodyMdMedium" numberOfLines={1}>
            {token.symbol}
          </SizableText>
          {handlePress ? (
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              color="$iconSubdued"
            />
          ) : null}
        </XStack>
      ) : (
        <Skeleton w="$20" h="$8" radius="round" />
      )}
    </XStack>
  );
}
