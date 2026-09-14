import { type ReactNode, useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import {
  Keyboard,
  YStack,
  useKeyboardHeight,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const PERP_DIALOG_TOP_SAFE_GAP = 16;
const PERP_DIALOG_CHROME_HEIGHT = 176;
const PERP_DIALOG_MIN_CONTENT_HEIGHT = 120;

export function PerpKeyboardAwareDialogContent({
  children,
}: {
  children: ReactNode;
}) {
  const keyboardHeight = useKeyboardHeight();
  const { top: safeAreaTop } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const contentMaxHeight = useMemo(() => {
    if (!platformEnv.isNative) {
      return undefined;
    }

    const availableHeight =
      windowHeight -
      Math.max(keyboardHeight, 0) -
      safeAreaTop -
      PERP_DIALOG_TOP_SAFE_GAP -
      PERP_DIALOG_CHROME_HEIGHT;

    return Math.max(availableHeight, PERP_DIALOG_MIN_CONTENT_HEIGHT);
  }, [keyboardHeight, safeAreaTop, windowHeight]);

  if (!platformEnv.isNative) {
    return children;
  }

  return (
    <Keyboard.AwareScrollView
      style={{ maxHeight: contentMaxHeight }}
      // The dialog viewport already excludes the keyboard height.
      extraKeyboardSpace={-keyboardHeight}
      bounces={false}
      keyboardDismissMode="none"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <YStack width="100%" pb={keyboardHeight > 0 ? 0 : '$5'}>
        {children}
      </YStack>
    </Keyboard.AwareScrollView>
  );
}
