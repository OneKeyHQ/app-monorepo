import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';

import { XStack } from '../../../primitives';
import { useInGlassHeader } from '../../../primitives/Button/GlassHeaderContext';

export default function HeaderButtonGroup(props: GetProps<typeof XStack>) {
  const { children, ...rest } = props;
  const inGlassHeader = useInGlassHeader();

  return (
    <XStack
      gap="$4"
      alignItems="center"
      // iOS 26 wraps headerLeft/right custom views in a UIBarButtonItem
      // glass container. With only a height set, our intrinsic 36-wide
      // children produced a 36x44 frame; the glass container then padded
      // it horizontally and rendered as a wide pill instead of a circle.
      // Forcing a 44x44 square frame keeps the container circular and
      // aligned to the bar's vertical center. Gate on the in-glass context
      // (not isNativeIOS26Plus) so in-page headers like the Home tab — which
      // are not inside the native glass bar — keep their natural spacing.
      {...(inGlassHeader && {
        height: 44,
        minWidth: 44,
        justifyContent: 'center',
      })}
      testID="Navigation-HeaderView-ButtonGroup"
      {...rest}
    >
      {children}
    </XStack>
  );
}
