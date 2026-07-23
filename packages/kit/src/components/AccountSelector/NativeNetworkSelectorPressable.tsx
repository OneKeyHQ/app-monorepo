import type { ComponentProps } from 'react';

import { Pressable } from 'react-native';

function NativeNetworkSelectorPressable(
  props: ComponentProps<typeof Pressable>,
) {
  return <Pressable {...props} />;
}

function resolveNativeNetworkSelectorPressableTestIDs({
  isNativeIOS,
  legacyTestID,
  nativePressableTestID,
  useNativePressable,
}: {
  isNativeIOS: boolean;
  legacyTestID?: string;
  nativePressableTestID?: string;
  useNativePressable: boolean;
}) {
  const clickableLeafTestID =
    isNativeIOS && useNativePressable
      ? (nativePressableTestID ??
        (legacyTestID?.startsWith('select-item-') ? legacyTestID : undefined))
      : undefined;
  return {
    clickableLeafTestID,
    contentTestID:
      clickableLeafTestID !== undefined && clickableLeafTestID === legacyTestID
        ? undefined
        : legacyTestID,
  };
}

export {
  NativeNetworkSelectorPressable,
  resolveNativeNetworkSelectorPressableTestIDs,
};
