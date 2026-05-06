import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';

import { XStack } from '../../../primitives';

export default function HeaderButtonGroup(props: GetProps<typeof XStack>) {
  const { children, ...rest } = props;

  return (
    <XStack
      gap="$4"
      alignItems="center"
      // iOS 26 wraps headerLeft/right custom views in a UIBarButtonItem
      // glass container that vertically aligns to its content's intrinsic
      // size. Without an explicit height the icon ends up flush with the
      // top of the bar instead of centered against the title. 44pt matches
      // the iOS navigation bar standard height.
      {...(platformEnv.isNativeIOS26Plus && { height: 44 })}
      testID="Navigation-HeaderView-ButtonGroup"
      {...rest}
    >
      {children}
    </XStack>
  );
}
