import { SizableText, YStack } from '../../primitives';

/**
 * Web stand-in. The BottomSheet is the native half of DialogV2 and has no
 * web counterpart on purpose — DialogV2 presents a Base UI popup there.
 * The real demo lives in BottomSheetDemo.native.tsx; this file only keeps
 * the shared story loadable in the web shell. Props come from ./type —
 * type-only, so @expo/ui never reaches the web bundle.
 */
import type { IBottomSheetDemoProps } from './type';

export function BottomSheetDemo(_props: IBottomSheetDemoProps) {
  return (
    <YStack gap="$2" maxWidth={420}>
      <SizableText size="$headingMd">Native-only component</SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        The BottomSheet is the content-sized system sheet behind DialogV2's
        native face. Open this story in the on-device shell to play with it.
      </SizableText>
    </YStack>
  );
}
