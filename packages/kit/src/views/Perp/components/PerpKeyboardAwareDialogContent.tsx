import { type ReactNode, useMemo } from 'react';

import { ScrollView, useWindowDimensions } from 'react-native';

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
  resizeOnKeyboard = true,
}: {
  children: ReactNode;
  resizeOnKeyboard?: boolean;
}) {
  const reportedKeyboardHeight = useKeyboardHeight();
  const keyboardHeight = resizeOnKeyboard ? reportedKeyboardHeight : 0;
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

  // Animate the scroll insets with UIKit's keyboard transition in the fitted iOS sheet.
  const ScrollContainer = resizeOnKeyboard
    ? Keyboard.AwareScrollView
    : ScrollView;
  return (
    <ScrollContainer
      style={{ maxHeight: contentMaxHeight }}
      {...(resizeOnKeyboard
        ? { extraKeyboardSpace: -keyboardHeight }
        : { automaticallyAdjustKeyboardInsets: true })}
      bounces={false}
      keyboardDismissMode="none"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <YStack width="100%" pb={keyboardHeight > 0 ? 0 : '$5'}>
        {children}
      </YStack>
    </ScrollContainer>
  );
}
